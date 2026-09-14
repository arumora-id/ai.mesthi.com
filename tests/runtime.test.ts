import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import {
  agent,
  entitlement,
  secondWorkspace,
  secondWorkspaceId,
  task,
  taskValues,
  workspace,
  workspaceId,
} from './fixtures/c4'
let failStatus = 0
let loseWriteResponse = false
let postCount = 0
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => {
  vi.resetModules()
  failStatus = 0
  loseWriteResponse = false
  postCount = 0
  vi.stubGlobal('location', { hash: '', origin: 'https://ai.mesthi.com' })
  vi.stubGlobal('history', { pushState: vi.fn() })
  vi.stubGlobal('localStorage', {
    removeItem: vi.fn(),
    getItem: vi.fn(() => 'obsolete local data'),
    setItem: vi.fn(),
  })
  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: unknown, options?: RequestInit) => {
      if (options?.method === 'POST') {
        postCount++
        if (loseWriteResponse) throw new TypeError('lost')
        return json(task, 201)
      }
      if (failStatus) return json({}, failStatus)
      const path = String(input)
      if (path.endsWith('/me')) return json({ name: 'Test account' })
      if (path.endsWith('/workspaces')) return json([workspace, secondWorkspace])
      if (path.includes(secondWorkspaceId))
        return json(
          path.endsWith('/entitlements') ? { ...entitlement, workspace_id: secondWorkspaceId } : [],
        )
      return json(
        path.endsWith('/agents') ? [agent] : path.endsWith('/tasks') ? [task] : entitlement,
      )
    }),
  )
})
afterEach(() => vi.unstubAllGlobals())
it('starts empty and never reads or writes persisted business data', async () => {
  const { useApp } = await import('../src/core/runtime')
  expect(useApp.getState().data.runs).toEqual([])
  await useApp.getState().refresh()
  expect(useApp.getState().data.runs[0].id).toBe(task.id)
  expect(localStorage.getItem).not.toHaveBeenCalled()
  expect(localStorage.setItem).not.toHaveBeenCalled()
})
it.each([401, 403])(
  'clears all workspace data when authorization fails with %s',
  async (status) => {
    const { useApp } = await import('../src/core/runtime')
    await useApp.getState().refresh()
    failStatus = status
    await useApp.getState().refresh(true)
    expect(useApp.getState().workspaces).toEqual([])
    expect(useApp.getState().data.runs).toEqual([])
    expect(useApp.getState().activeId).toBe('')
    expect(useApp.getState().phase).toBe(status === 401 ? 'signed-out' : 'forbidden')
  },
)
it('keeps an explicitly stale read-only view during a service outage', async () => {
  const { useApp } = await import('../src/core/runtime')
  await useApp.getState().refresh()
  failStatus = 503
  await useApp.getState().refresh()
  expect(useApp.getState().stale).toBe(true)
  expect(
    await useApp.getState().command({ type: 'create-run', workspaceId, values: taskValues }),
  ).toBe(false)
  expect(postCount).toBe(0)
})
it('prevents a duplicate command after an uncertain response until explicit refresh', async () => {
  const { useApp } = await import('../src/core/runtime')
  await useApp.getState().refresh()
  loseWriteResponse = true
  const command = { type: 'create-run' as const, workspaceId, values: taskValues }
  expect(await useApp.getState().command(command)).toBe(false)
  await useApp.getState().refresh()
  expect(await useApp.getState().command(command)).toBe(false)
  expect(postCount).toBe(1)
  await useApp.getState().refresh(true)
  expect(useApp.getState().uncertain).toBe(false)
})
it('clears the previous workspace immediately when switching', async () => {
  const { useApp } = await import('../src/core/runtime')
  await useApp.getState().refresh()
  useApp.getState().selectWorkspace(secondWorkspaceId)
  expect(useApp.getState().data.runs).toEqual([])
  await vi.waitFor(() => expect(useApp.getState().phase).toBe('ready'))
  expect(useApp.getState().activeId).toBe(secondWorkspaceId)
  expect(useApp.getState().data.agents).toEqual([])
})
it('ignores a response that arrives after sign-out', async () => {
  const { useApp } = await import('../src/core/runtime')
  let resolve!: (value: Response) => void
  vi.mocked(fetch).mockImplementationOnce(
    () =>
      new Promise((r) => {
        resolve = r
      }),
  )
  const pending = useApp.getState().refresh()
  useApp.getState().clearSession()
  resolve(json({ name: 'Previous account' }))
  await pending
  expect(useApp.getState().phase).toBe('signed-out')
  expect(useApp.getState().data.runs).toEqual([])
})
