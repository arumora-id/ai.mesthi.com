import type { Page } from '@playwright/test'
import {
  agent,
  entitlement,
  plan,
  secondWorkspace,
  secondWorkspaceId,
  task,
  timestamp,
  workspace,
  workspaceId,
} from '../fixtures/c4'
export async function installApi(page: Page) {
  const state = {
    authorized: true,
    readStatus: 0,
    writeStatus: 0,
    loseWriteResponse: false,
    calls: [] as { method: string; path: string; body: Record<string, unknown> | null }[],
    workspaces: structuredClone([workspace, secondWorkspace]),
    agents: structuredClone([agent]),
    tasks: structuredClone([task]),
  }
  await page.route('**/api/**', async (route) => {
    const request = route.request(),
      path = new URL(request.url()).pathname.replace('/api', ''),
      method = request.method()
    const body = request.postData() ? (request.postDataJSON() as Record<string, unknown>) : null
    state.calls.push({ method, path, body })
    if (request.headers().authorization)
      throw new Error('The browser must not send bearer credentials.')
    if (!state.authorized) return route.fulfill({ status: 401, json: { detail: 'Unauthorized' } })
    if (method === 'GET' && state.readStatus)
      return route.fulfill({ status: state.readStatus, json: { detail: 'Unavailable' } })
    if (method !== 'GET' && state.loseWriteResponse) return route.abort('failed')
    if (method !== 'GET' && state.writeStatus)
      return route.fulfill({ status: state.writeStatus, json: { detail: 'Rejected' } })
    if (path === '/v1/me') return route.fulfill({ json: { name: 'Test account' } })
    if (path === '/v1/models')
      return route.fulfill({ json: { data: [{ id: 'configured-model' }] } })
    if (path === '/v1/billing/plans') return route.fulfill({ json: [plan] })
    if (path === '/v1/workspaces') {
      if (method === 'POST') {
        const w = { ...workspace, id: crypto.randomUUID(), ...body }
        state.workspaces.push(w)
        return route.fulfill({ status: 201, json: w })
      }
      return route.fulfill({ json: state.workspaces })
    }
    const parts = path.split('/'),
      wid = parts[3],
      resource = parts[4],
      recordId = parts[5],
      action = parts[6]
    if (!state.workspaces.some((w) => w.id === wid)) return route.fulfill({ status: 404 })
    if (!resource) {
      if (method === 'DELETE') {
        state.workspaces = state.workspaces.filter((w) => w.id !== wid)
        return route.fulfill({ status: 204 })
      }
      const record = state.workspaces.find((w) => w.id === wid)!
      if (method === 'PATCH') Object.assign(record, body)
      return route.fulfill({ json: record })
    }
    if (resource === 'entitlements')
      return route.fulfill({ json: { ...entitlement, workspace_id: wid } })
    if (resource === 'agents') {
      if (method === 'POST') {
        const record = { ...agent, ...body, id: crypto.randomUUID(), workspace_id: wid }
        state.agents.push(record)
        return route.fulfill({ status: 201, json: record })
      }
      if (recordId) {
        const record = state.agents.find((a) => a.id === recordId && a.workspace_id === wid)
        if (!record) return route.fulfill({ status: 404 })
        if (method === 'DELETE') {
          state.agents = state.agents.filter((a) => a !== record)
          return route.fulfill({ status: 204 })
        }
        if (method === 'PATCH') Object.assign(record, body)
        return route.fulfill({ json: record })
      }
      return route.fulfill({ json: state.agents.filter((a) => a.workspace_id === wid) })
    }
    if (resource === 'tasks') {
      if (method === 'POST') {
        const record = { ...task, ...body, id: crypto.randomUUID(), workspace_id: wid }
        state.tasks.push(record)
        return route.fulfill({ status: 201, json: record })
      }
      if (recordId) {
        const record = state.tasks.find((t) => t.id === recordId && t.workspace_id === wid)
        if (!record) return route.fulfill({ status: 404 })
        if (method === 'DELETE') {
          state.tasks = state.tasks.filter((t) => t !== record)
          return route.fulfill({ status: 204 })
        }
        if (method === 'PATCH') Object.assign(record, body)
        if (action === 'queue') record.status = 'queued'
        if (action === 'start') {
          record.status = 'running'
          record.started_at = timestamp
        }
        if (action === 'cancel') record.status = 'cancelled'
        return route.fulfill({ json: record })
      }
      return route.fulfill({ json: state.tasks.filter((t) => t.workspace_id === wid) })
    }
    return route.fulfill({ status: 404, json: { detail: 'No test handler for this endpoint' } })
  })
  return state
}
export { workspaceId, secondWorkspaceId }
