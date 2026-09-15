import { z } from 'zod'
import type { Command, RunStatus, Snapshot } from './domain'
import { agentColors } from './catalog'
import {
  authMode,
  getAccessToken,
  markAuthenticated,
  markUnauthenticated,
  setAccessToken,
  hasAccessToken,
} from './auth'

export { setAccessToken, hasAccessToken }

// DTOs verified against the canonical C4 OpenAPI contract, API 1.12.1.
const workspaceDTO = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
const agentDTO = z.object({
  id: z.string(),
  workspace_id: z.string(),
  name: z.string(),
  role: z.string(),
  status: z.string(),
  model_source: z.string(),
  model_id: z.string().nullable(),
})
const taskDTO = z.object({
  id: z.string(),
  workspace_id: z.string(),
  agent_id: z.string().nullable(),
  title: z.string(),
  instructions: z.string(),
  status: z.string(),
  branch_name: z.string().nullable(),
  result_summary: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})
const entitlementsDTO = z.object({
  plan: z.object({
    name: z.string(),
    limits: z.object({
      max_agents: z.number(),
      max_parallel_tasks: z.number(),
      max_active_worktrees: z.number(),
      monthly_llm_credits: z.number(),
    }),
  }),
  subscription: z.object({ status: z.string() }),
  credits: z.object({ available: z.number() }),
})
export function mapTaskStatus(status: string): RunStatus {
  const map: Record<string, RunStatus> = {
    draft: 'draft',
    created: 'draft',
    queued: 'queued',
    pending: 'queued',
    running: 'running',
    started: 'running',
    delivering: 'delivering',
    completed: 'completed',
    cancelled: 'cancelled',
    canceled: 'cancelled',
    failed: 'failed',
    paused: 'paused',
  }
  return Object.hasOwn(map, status) ? map[status] : 'unknown'
}

export async function c4Request(path: string, method = 'GET', body?: unknown): Promise<unknown> {
  const accessToken = getAccessToken()
  if (authMode === 'bearer' && !accessToken)
    throw new Error('Connect an authorized API session in Settings to load the C4 backend.')

  const base = import.meta.env.VITE_API_BASE_URL || '/api'
  const url = new URL(base.replace(/\/$/, '') + path, location.origin)
  if (url.origin !== location.origin)
    throw new Error('Use a same-origin /api reverse proxy to the Mesthi control plane.')

  const response = await fetch(url, {
    method,
    credentials: authMode === 'session' ? 'same-origin' : 'omit',
    cache: 'no-store',
    signal: AbortSignal.timeout(15000),
    headers: {
      Accept: 'application/json',
      ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })

  if (!response.ok) {
    if (response.status === 401) {
      markUnauthenticated()
      throw new Error('Your session is missing or expired. Sign in again to continue.')
    }
    if (response.status === 403)
      throw new Error('Your account does not have permission for this operation.')
    throw new Error(
      'The C4 API rejected this request (' +
        response.status +
        '). Refresh the task before retrying.',
    )
  }

  markAuthenticated()
  if (response.status === 204) return null
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new Error('The gateway returned HTML. Configure /api to proxy the C4 API.')
  return response.json()
}
export async function loadC4Snapshot(): Promise<Snapshot> {
  const workspaces = z.array(workspaceDTO).parse(await c4Request('/v1/workspaces'))
  const data: Snapshot = {
    version: 1,
    workspaces: [],
    agents: [],
    runs: [],
    workflows: [],
    artifacts: [],
    knowledge: [],
    connections: [],
    ledger: [],
  }
  for (const w of workspaces) {
    const base = '/v1/workspaces/' + encodeURIComponent(w.id)
    const [a, t, eRaw] = await Promise.all([
      c4Request(base + '/agents'),
      c4Request(base + '/tasks'),
      c4Request(base + '/entitlements'),
    ])
    const agents = z.array(agentDTO).parse(a),
      tasks = z.array(taskDTO).parse(t),
      e = entitlementsDTO.parse(eRaw)
    data.workspaces.push({
      id: w.id,
      name: w.name,
      description: w.description ?? '',
      icon: 'Layers',
      packId: 'custom',
      monthlyBudget: e.plan.limits.monthly_llm_credits,
      dailyBudget: 0,
      perRunBudget: 0,
      concurrency: e.plan.limits.max_parallel_tasks,
      entitlements: {
        planName: e.plan.name,
        availableCredits: e.credits.available,
        maxAgents: e.plan.limits.max_agents,
        maxWorktrees: e.plan.limits.max_active_worktrees,
        subscriptionStatus: e.subscription.status,
      },
    })
    for (const [i, a] of agents.entries()) {
      if (a.workspace_id !== w.id) throw new Error('API agent workspace mismatch.')
      data.agents.push({
        id: a.id,
        workspaceId: a.workspace_id,
        name: a.name,
        role: a.role,
        state: tasks.some(
          (t) => t.agent_id === a.id && ['running', 'started', 'delivering'].includes(t.status),
        )
          ? 'working'
          : a.status === 'disabled'
            ? 'paused'
            : 'idle',
        model: a.model_id ?? a.model_source,
        color: agentColors[i % agentColors.length],
        skills: [],
        policy: 'draft_only',
      })
    }
    for (const t of tasks) {
      if (t.workspace_id !== w.id) throw new Error('API task workspace mismatch.')
      data.runs.push({
        id: t.id,
        taskId: t.id,
        workspaceId: t.workspace_id,
        agentId: t.agent_id ?? '',
        title: t.title,
        brief: t.instructions,
        workflowId: '',
        status: mapTaskStatus(t.status),
        backendStatus: t.status,
        progress: t.status === 'completed' ? 100 : 0,
        estimatedCredits: 0,
        requiresApproval: false,
        approved: false,
        branchName: t.branch_name,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
        log: [
          'Backend task status: ' + t.status,
          ...(t.result_summary ? [t.result_summary] : []),
          ...(t.error_message ? ['Error: ' + t.error_message] : []),
        ],
      })
    }
  }
  data.runs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  return data
}
export async function executeC4Command(cmd: Command): Promise<void> {
  if (cmd.type === 'tick') throw new Error('Backend execution is owned by the control plane.')
  if (cmd.type === 'create-workspace') {
    if (cmd.packId !== 'custom')
      throw new Error(
        'Workforce packs require an atomic backend template endpoint. Use an empty workspace on C4.',
      )
    await c4Request('/v1/workspaces', 'POST', {
      name: cmd.name,
      description: 'Created from the MESTHI workspace UI.',
    })
    return
  }
  const base = '/v1/workspaces/' + encodeURIComponent(cmd.workspaceId)
  if (cmd.type === 'create-agent') {
    if (cmd.skills.length)
      throw new Error(
        'C4 AgentCreate does not support skills. Create the agent without skills or add the skill API extension.',
      )
    await c4Request(base + '/agents', 'POST', {
      name: cmd.name,
      role: cmd.role,
      model_source: 'mesthi_ai',
    })
    return
  }
  if (cmd.type === 'create-run') {
    await c4Request(base + '/tasks', 'POST', {
      agent_id: cmd.agentId,
      title: cmd.title,
      instructions: cmd.brief,
      priority: 'normal',
    })
    return
  }
  if (cmd.type === 'run-action' && ['queue', 'start', 'cancel'].includes(cmd.action)) {
    await c4Request(base + '/tasks/' + encodeURIComponent(cmd.runId) + '/' + cmd.action, 'POST')
    return
  }
  throw new Error(
    'This capability is outside the verified C4 API contract and requires a backend extension.',
  )
}
