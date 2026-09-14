import { expect, test } from '@playwright/test'
import { mkdir } from 'node:fs/promises'
import { installApi, secondWorkspaceId } from './apiFixture'
import { agentId, timestamp } from '../fixtures/c4'
test.beforeEach(async ({ page }) => {
  page.on('pageerror', (error) => console.log('BROWSER_ERROR:', error.message))
  await page.emulateMedia({ reducedMotion: 'reduce' })
})
test('requires authentication and never restores old demo business data', async ({ page }) => {
  const api = await installApi(page)
  api.authorized = false
  await page.addInitScript(() =>
    localStorage.setItem(
      'mesthi:demo:v1',
      JSON.stringify({ workspaces: [{ name: 'Private old workspace' }] }),
    ),
  )
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace.' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Sign in' })).toHaveAttribute(
    'href',
    '/oauth2/start?rd=%2F',
  )
  await expect(page.getByText('Private old workspace')).toHaveCount(0)
  expect(await page.evaluate(() => localStorage.getItem('mesthi:demo:v1'))).toBeNull()
})
test('renders API data and the office without runtime errors', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await installApi(page)
  await page.goto('/')
  await expect(page.getByRole('heading', { name: /Mission control/ })).toBeVisible()
  await expect(page.locator('[data-testid="office-canvas"] canvas')).toBeVisible()
  await expect(page.getByText('4,321', { exact: false }).first()).toBeVisible()
  await mkdir('test-results/screenshots', { recursive: true })
  await page.screenshot({
    path: 'test-results/screenshots/production-workspace.png',
    fullPage: true,
  })
  await page.getByRole('button', { name: 'Live office', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Live office/ })).toBeVisible()
  await page.getByRole('button', { name: 'Pause animation' }).click()
  await expect(page.getByRole('button', { name: 'Resume animation' })).toBeVisible()
  expect(errors).toEqual([])
})
test('creates, queues, starts and cancels a real API task as separate commands', async ({
  page,
}) => {
  const api = await installApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  await page.getByLabel('Task title', { exact: true }).fill('Requested task')
  await page.getByLabel('Instructions', { exact: true }).fill('Produce the requested report.')
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect(api.calls.filter((c) => c.method === 'POST').map((c) => c.path)).toEqual([
    '/v1/workspaces/' + api.workspaces[0].id + '/tasks',
  ])
  await page.getByRole('button', { name: 'Requested task', exact: true }).click()
  for (const action of ['Queue task', 'Start task', 'Cancel task']) {
    await page.getByRole('button', { name: action, exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: action, exact: true }).click()
  }
  await expect(page.getByRole('dialog').getByText('Cancelled', { exact: true })).toBeVisible()
  expect(api.calls.filter((c) => c.method === 'POST').map((c) => c.path.split('/').at(-1))).toEqual(
    ['tasks', 'queue', 'start', 'cancel'],
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Requested task', exact: true })).toBeVisible()
  expect(
    await page.evaluate(() => Object.keys(localStorage).filter((k) => k !== 'mesthi:theme')),
  ).toEqual([])
})
test('edits an agent and keeps workspace data isolated', async ({ page }) => {
  const api = await installApi(page)
  await page.goto('/#agents')
  await page
    .getByRole('button')
    .filter({ has: page.getByRole('heading', { name: 'Research agent', exact: true }) })
    .click()
  await page.getByRole('button', { name: 'Configure agent', exact: true }).click()
  await expect(page.getByLabel('System instructions', { exact: true })).toHaveAccessibleName(
    'System instructions',
  )
  await page.getByLabel('System instructions', { exact: true }).fill('Use only approved sources.')
  await page.getByLabel('Model ID', { exact: true }).fill('configured-model')
  await page.getByRole('button', { name: 'Save agent', exact: true }).click()
  await expect.poll(() => api.agents[0].system_prompt).toBe('Use only approved sources.')
  expect(api.calls.some((c) => c.method === 'PATCH' && c.path.endsWith('/agents/' + agentId))).toBe(
    true,
  )
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByLabel('Switch workspace').selectOption(secondWorkspaceId)
  await expect(page.getByRole('heading', { name: /Mission control/ })).toBeVisible()
  await expect(page.getByText('Server task', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Your workforce', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Room for a new teammate' })).toBeVisible()
})
test('downloads only result content returned by the API', async ({ page }) => {
  const api = await installApi(page)
  api.tasks[0].status = 'completed'
  api.tasks[0].completed_at = timestamp
  api.tasks[0].result_summary = 'Actual server result <script>alert(1)</script>'
  await page.goto('/#artifacts')
  await page.getByRole('button', { name: 'Read result' }).click()
  await expect(page.locator('.result-text').last()).toHaveText(
    'Actual server result <script>alert(1)</script>',
  )
  const download = page.waitForEvent('download')
  await page.getByRole('dialog').getByRole('button', { name: 'Download', exact: true }).click()
  expect((await download).suggestedFilename()).toBe('Server task.md')
  expect(
    await page
      .locator('script')
      .evaluateAll((nodes) => nodes.some((n) => n.textContent?.includes('alert(1)'))),
  ).toBe(false)
})
test('clears visible private data on session expiry', async ({ page }) => {
  const api = await installApi(page)
  await page.goto('/')
  await expect(page.getByRole('button', { name: 'Server task', exact: true })).toBeVisible()
  api.authorized = false
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Welcome to your workspace.' })).toBeVisible()
  await expect(page.getByText('Server task', { exact: true })).toHaveCount(0)
})
test('blocks duplicate actions after a lost response and requires review', async ({ page }) => {
  const api = await installApi(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'New task', exact: true }).click()
  await page.getByLabel('Task title', { exact: true }).fill('Uncertain task')
  await page.getByLabel('Instructions', { exact: true }).fill('Process once.')
  api.loseWriteResponse = true
  await page.getByRole('button', { name: 'Create task', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Create task', exact: true })).toBeDisabled()
  expect(api.calls.filter((c) => c.method === 'POST')).toHaveLength(1)
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.locator('.sync-banner')).toBeVisible()
  api.loseWriteResponse = false
  await page.getByRole('button', { name: 'Refresh', exact: true }).click()
  await expect(page.getByRole('button', { name: 'New task', exact: true })).toBeEnabled()
})
test('supports GSAP, keyboard navigation, and reduced-motion mobile content', async ({ page }) => {
  await installApi(page)
  await page.emulateMedia({ reducedMotion: 'no-preference' })
  await page.goto('/')
  await expect(page.locator('[data-testid="office-canvas"] canvas')).toBeVisible()
  await page.keyboard.press('Control+k')
  await page.getByRole('textbox', { name: 'Global search' }).fill('Your workforce')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: /Your workforce/ })
    .click()
  await expect(page.getByRole('heading', { name: /Your workforce/ })).toBeVisible()
  await expect(page.locator('.agent-card').first()).toHaveCSS('visibility', 'visible')
  await page.setViewportSize({ width: 390, height: 844 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Content studio', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Content studio/ })).toBeVisible()
  await page.getByLabel('Project title', { exact: true }).fill('Campaign')
  await page.getByLabel('Audience', { exact: true }).fill('New customers')
  await page
    .getByLabel('Creative brief', { exact: true })
    .fill('Write a product launch storyboard.')
  await page.getByRole('button', { name: 'Choose agent & create task' }).click()
  await expect(page.getByLabel('Instructions', { exact: true })).toHaveAccessibleName(
    'Instructions',
  )
  await expect(page.getByLabel('Instructions', { exact: true })).toHaveValue(
    /Write a product launch storyboard/,
  )
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Open navigation' }).click()
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to dark', exact: true }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await mkdir('test-results/screenshots', { recursive: true })
  await page.screenshot({ path: 'test-results/screenshots/production-mobile.png', fullPage: true })
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test.afterEach(async ({ page }, info) => {
  if (info.status !== info.expectedStatus) {
    console.log('FAILED_PAGE:', page.url())
    console.log('FAILED_BODY:', (await page.locator('body').innerText()).slice(0, 10000))
    console.log(
      'FAILED_DIALOGS:',
      await page.locator('dialog').evaluateAll((nodes) =>
        nodes.map((n) => ({
          open: (n as HTMLDialogElement).open,
          text: (n as HTMLElement).innerText.slice(0, 1500),
        })),
      ),
    )
  }
})
