import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  ApiError,
  c4Request,
  executeC4Command,
  loadC4Snapshot,
  loadModels,
  loadPlans,
  mapTaskStatus,
} from '../src/core/c4Adapter'
import { apiBase } from '../src/core/config'
import {
  agent,
  agentId,
  agentValues,
  entitlement,
  plan,
  secondWorkspaceId,
  task,
  taskId,
  taskValues,
  workspaceId,
} from './fixtures/c4'
import contract from '../docs/openapi.c4.json'
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
beforeEach(() => vi.stubGlobal('fetch', vi.fn()))
afterEach(() => vi.unstubAllGlobals())
function snapshotResponses(values = { agents: [agent], tasks: [task], entitlements: entitlement }) {
  vi.mocked(fetch).mockImplementation(async (input) => {
    const url = String(input)
    return json(
      url.endsWith('/agents')
        ? values.agents
        : url.endsWith('/tasks')
          ? values.tasks
          : values.entitlements,
    )
  })
}
describe('production C4 adapter', () => {
  it('uses the cookie gateway without accepting or storing bearer credentials', async () => {
    vi.mocked(fetch).mockResolvedValue(json({}))
    await c4Request('/v1/me')
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/v1/me')
    expect(options).toMatchObject({
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
    })
    expect(new Headers(options?.headers).has('Authorization')).toBe(false)
  })
  it('permits only a path on the same origin', () => {
    for (const value of [
      'https://other.example/api',
      '//other.example/api',
      '/api?x=1',
      '/api/../x',
      '/api#x',
    ])
      expect(() => apiBase(value)).toThrow()
    expect(apiBase('/api')).toBe('/api')
  })
  it('preserves unknown statuses without inventing completion', () => {
    for (const status of ['__proto__', 'toString', 'unexpected'])
      expect(mapTaskStatus(status)).toBe('unknown')
    expect(mapTaskStatus('delivering')).toBe('delivering')
  })
  it('loads only the selected workspace and reports actual results and balance', async () => {
    snapshotResponses()
    const result = await loadC4Snapshot(workspaceId)
    expect(fetch).toHaveBeenCalledTimes(3)
    expect(result.entitlements?.availableCredits).toBe(4321)
    expect(result.runs[0]).not.toHaveProperty('progress')
    expect(result.runs[0]).not.toHaveProperty('taskSessionId')
    expect(result.runs[0].resultSummary).toBeNull()
  })
  it.each(['agents', 'tasks', 'entitlements'] as const)(
    'rejects a workspace mismatch in %s',
    async (key) => {
      const values = { agents: [agent], tasks: [task], entitlements: entitlement }
      if (key === 'agents') values.agents = [{ ...agent, workspace_id: secondWorkspaceId }]
      if (key === 'tasks') values.tasks = [{ ...task, workspace_id: secondWorkspaceId }]
      if (key === 'entitlements')
        values.entitlements = { ...entitlement, workspace_id: secondWorkspaceId }
      snapshotResponses(values)
      await expect(loadC4Snapshot(workspaceId)).rejects.toMatchObject({ status: 403 })
    },
  )
  it('creates a task without automatically starting execution', async () => {
    vi.mocked(fetch).mockResolvedValue(json(task, 201))
    await executeC4Command({ type: 'create-run', workspaceId, values: taskValues })
    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toBe('/api/v1/workspaces/' + workspaceId + '/tasks')
    expect(options?.method).toBe('POST')
    expect(JSON.parse(String(options?.body))).toEqual(taskValues)
    expect(new Headers(options?.headers).get('X-Mesthi-Request')).toBe('1')
    expect(Object.keys(taskValues).sort()).toEqual(
      Object.keys(contract.components.schemas.TaskCreate.properties).sort(),
    )
  })
  it('saves real agent routing and instructions with PATCH', async () => {
    vi.mocked(fetch).mockResolvedValue(json(agent))
    await executeC4Command({
      type: 'update-agent',
      workspaceId,
      agentId,
      values: { ...agentValues, status: 'disabled' },
    })
    const [url, options] = vi.mocked(fetch).mock.calls[0]
    expect(url).toContain('/agents/' + agentId)
    expect(options?.method).toBe('PATCH')
    expect(JSON.parse(String(options?.body))).toMatchObject({
      system_prompt: 'Write accurately.',
      status: 'disabled',
      model_source: 'mesthi_ai',
    })
  })
  it('rejects invalid paths and unsupported lifecycle actions before sending', async () => {
    await expect(c4Request('/v1/../internal')).rejects.toThrow()
    await expect(
      executeC4Command({
        type: 'run-action',
        workspaceId,
        runId: taskId,
        action: 'approve',
      } as never),
    ).rejects.toThrow()
    await expect(
      executeC4Command({ type: 'create-run', workspaceId: '../x', values: taskValues }),
    ).rejects.toThrow()
    expect(fetch).not.toHaveBeenCalled()
  })
  it.each([401, 403, 409, 422, 429])(
    'returns HTTP %s without retry or fallback',
    async (status) => {
      vi.mocked(fetch).mockResolvedValue(json({}, status))
      await expect(c4Request('/v1/workspaces', 'POST', {})).rejects.toMatchObject({
        status,
        uncertain: false,
      })
      expect(fetch).toHaveBeenCalledTimes(1)
    },
  )
  it('treats a lost mutation response as unknown, never as success', async () => {
    vi.mocked(fetch).mockRejectedValue(new TypeError('network error'))
    await expect(c4Request('/v1/workspaces', 'POST', {})).rejects.toMatchObject({ uncertain: true })
    expect(fetch).toHaveBeenCalledTimes(1)
  })
  it('rejects login HTML and malformed JSON returned as a successful mutation', async () => {
    vi.mocked(fetch).mockResolvedValue(
      new Response('<html>sign in</html>', { headers: { 'Content-Type': 'text/html' } }),
    )
    await expect(c4Request('/v1/workspaces', 'POST', {})).rejects.toMatchObject({ uncertain: true })
    vi.mocked(fetch).mockResolvedValue(
      new Response('{', { headers: { 'Content-Type': 'application/json' } }),
    )
    await expect(c4Request('/v1/workspaces', 'POST', {})).rejects.toMatchObject({ uncertain: true })
  })
  it('reads server plan prices and rejects fabricated model-list formats', async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce(json([plan]))
      .mockResolvedValueOnce(json({ unknown: [] }))
    expect((await loadPlans())[0].price_monthly_cents).toBe(2900)
    await expect(loadModels()).rejects.toBeInstanceOf(ApiError)
  })
})

it('refuses malformed or out-of-scope mutation results even when HTTP succeeded', async () => {
  vi.mocked(fetch)
    .mockResolvedValueOnce(json({ ok: true }))
    .mockResolvedValueOnce(json({ ...agent, workspace_id: secondWorkspaceId }))
  await expect(
    executeC4Command({ type: 'create-agent', workspaceId, values: agentValues }),
  ).rejects.toMatchObject({ uncertain: true })
  await expect(
    executeC4Command({ type: 'create-agent', workspaceId, values: agentValues }),
  ).rejects.toMatchObject({ status: 403, uncertain: true })
})
