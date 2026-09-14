import { z } from 'zod'
import { apiBase } from './config'
import type {
  Agent,
  Command,
  Entitlements,
  Plan,
  Run,
  RunStatus,
  Snapshot,
  Workspace,
} from './domain'
const id = z.uuid()
const text = (max: number) => z.string().trim().min(1).max(max)
const date = z.string().datetime({ offset: true })
const workspaceDTO = z.object({
  id,
  name: z.string(),
  description: z.string().nullable(),
  created_at: date,
  updated_at: date,
})
const agentDTO = z.object({
  id,
  workspace_id: id,
  name: z.string(),
  role: z.string(),
  status: z.string(),
  description: z.string().nullable(),
  system_prompt: z.string().nullable(),
  model_source: z.string(),
  model_id: z.string().nullable(),
  repository_full_name: z.string().nullable(),
  default_branch: z.string(),
})
const taskDTO = z.object({
  id,
  workspace_id: id,
  agent_id: id.nullable(),
  agent_name_snapshot: z.string(),
  title: z.string(),
  instructions: z.string(),
  priority: z.string(),
  status: z.string(),
  repository_full_name: z.string().nullable(),
  base_branch: z.string().nullable(),
  branch_name: z.string().nullable(),
  result_summary: z.string().nullable(),
  error_message: z.string().nullable(),
  created_at: date,
  updated_at: date,
  started_at: date.nullable(),
  completed_at: date.nullable(),
})
const planDTO = z.object({
  id,
  code: z.string(),
  name: z.string(),
  price_monthly_cents: z.number().int().nonnegative(),
  currency: z.string().regex(/^[A-Z]{3}$/),
  limits: z.record(z.string(), z.number().finite()),
  features: z.record(z.string(), z.boolean()),
})
const entitlementDTO = z.object({
  workspace_id: id,
  plan: planDTO,
  credits: z.object({ available: z.number().finite() }),
  subscription: z.object({ status: z.string() }),
})
const workspaceInput = z
  .object({ name: text(120), description: z.string().trim().max(2000) })
  .strict()
const agentInput = z
  .object({
    name: text(120),
    role: text(64),
    description: z.string().max(10000),
    system_prompt: z.string().max(50000),
    model_source: z.enum(['mesthi_ai', 'byok']),
    model_id: text(200).nullable(),
    repository_full_name: z
      .string()
      .max(255)
      .regex(/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/)
      .nullable(),
    default_branch: text(255),
  })
  .strict()
const taskInput = z
  .object({
    agent_id: id,
    title: text(200),
    instructions: text(100000),
    priority: z.enum(['low', 'normal', 'high', 'urgent']),
  })
  .strict()
export class ApiError extends Error {
  constructor(
    message: string,
    public status = 0,
    public uncertain = false,
    public requestId = '',
  ) {
    super(message)
    this.name = 'ApiError'
  }
}
export function mapTaskStatus(status: string): RunStatus {
  const mapping: Record<string, RunStatus> = {
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
  return Object.hasOwn(mapping, status) ? mapping[status] : 'unknown'
}
export async function c4Request(
  path: string,
  method = 'GET',
  body?: unknown,
  signal?: AbortSignal,
): Promise<unknown> {
  if (!/^\/v1\/[a-zA-Z0-9_/-]+$/.test(path) || path.includes('//'))
    throw new ApiError('Invalid API path.')
  const mutating = method !== 'GET'
  let response: Response
  try {
    response = await fetch(apiBase() + path, {
      method,
      credentials: 'same-origin',
      cache: 'no-store',
      redirect: 'error',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(15000)])
        : AbortSignal.timeout(15000),
      headers: {
        Accept: 'application/json',
        ...(mutating ? { 'X-Mesthi-Request': '1' } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    })
  } catch (error) {
    if (signal?.aborted) throw error
    throw new ApiError(
      mutating
        ? 'The connection ended before the result was confirmed. Check the latest server state before trying again.'
        : 'Unable to reach your workspace. Check your connection and try again.',
      0,
      mutating,
    )
  }
  const requestId = (response.headers.get('x-request-id') || '').slice(0, 100)
  if (!response.ok) {
    const messages: Record<number, string> = {
      401: 'Your session has expired. Sign in to continue.',
      403: 'Your account is not allowed to access this resource.',
      404: 'This resource is no longer available. Refresh your workspace.',
      409: 'The resource changed or cannot perform this action in its current state. Refresh and review it.',
      422: 'The server could not accept these values. Check the form and your agent configuration.',
      429: 'The request limit was reached. Wait a moment before trying again.',
    }
    throw new ApiError(
      messages[response.status] ||
        'The service could not complete the request. Please try again later.',
      response.status,
      mutating && (response.status >= 500 || response.status === 408),
      requestId,
    )
  }
  if (response.status === 204) return null
  if (!response.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(
      'The gateway returned an unexpected response. Contact your workspace administrator.',
      response.status,
      mutating,
      requestId,
    )
  try {
    return await response.json()
  } catch {
    throw new ApiError(
      'The server returned an unreadable response.',
      response.status,
      mutating,
      requestId,
    )
  }
}
function validated<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value)
  if (!result.success)
    throw new ApiError(
      'The API response does not match the supported contract. Contact your workspace administrator.',
    )
  return result.data
}
export async function loadIdentity(signal?: AbortSignal): Promise<string> {
  // /v1/me has an unspecified response schema. Verify authentication, without guessing claims or roles.
  const me = validated(
    z.record(z.string(), z.unknown()),
    await c4Request('/v1/me', 'GET', undefined, signal),
  )
  return typeof me.name === 'string' && me.name ? me.name.slice(0, 120) : 'Your account'
}
export async function loadWorkspaces(signal?: AbortSignal): Promise<Workspace[]> {
  return validated(
    z.array(workspaceDTO),
    await c4Request('/v1/workspaces', 'GET', undefined, signal),
  ).map((w) => ({
    id: w.id,
    name: w.name,
    description: w.description ?? '',
    createdAt: w.created_at,
    updatedAt: w.updated_at,
  }))
}
export async function loadC4Snapshot(workspaceId: string, signal?: AbortSignal): Promise<Snapshot> {
  const base = '/v1/workspaces/' + id.parse(workspaceId)
  const [agentRaw, taskRaw, entitlementRaw] = await Promise.all([
    c4Request(base + '/agents', 'GET', undefined, signal),
    c4Request(base + '/tasks', 'GET', undefined, signal),
    c4Request(base + '/entitlements', 'GET', undefined, signal),
  ])
  const agents = validated(z.array(agentDTO), agentRaw),
    tasks = validated(z.array(taskDTO), taskRaw),
    entitlement = validated(entitlementDTO, entitlementRaw)
  if (
    agents.some((a) => a.workspace_id !== workspaceId) ||
    tasks.some((t) => t.workspace_id !== workspaceId) ||
    entitlement.workspace_id !== workspaceId
  )
    throw new ApiError('The service returned data outside the selected workspace.', 403)
  const colors = ['#b6c98a', '#d6b0cc', '#aac5d9', '#e2c492', '#b7afda', '#a9cbb9']
  const mappedAgents: Agent[] = agents.map((a, i) => ({
    id: a.id,
    workspaceId: a.workspace_id,
    name: a.name,
    role: a.role,
    description: a.description ?? '',
    systemPrompt: a.system_prompt ?? '',
    state:
      a.status === 'disabled'
        ? 'paused'
        : tasks.some(
              (t) => t.agent_id === a.id && ['running', 'started', 'delivering'].includes(t.status),
            )
          ? 'working'
          : a.status === 'active'
            ? 'idle'
            : 'error',
    status: a.status,
    model: a.model_id ?? a.model_source,
    modelId: a.model_id,
    modelSource: a.model_source,
    repository: a.repository_full_name,
    defaultBranch: a.default_branch,
    color: colors[i % colors.length],
  }))
  const runs: Run[] = tasks
    .map((t) => ({
      id: t.id,
      workspaceId: t.workspace_id,
      agentId: t.agent_id,
      agentName: t.agent_name_snapshot,
      title: t.title,
      brief: t.instructions,
      status: mapTaskStatus(t.status),
      backendStatus: t.status,
      priority: t.priority,
      repository: t.repository_full_name,
      baseBranch: t.base_branch,
      branchName: t.branch_name,
      resultSummary: t.result_summary,
      errorMessage: t.error_message,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      startedAt: t.started_at,
      completedAt: t.completed_at,
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const entitlements: Entitlements = {
    workspaceId,
    plan: entitlement.plan,
    availableCredits: entitlement.credits.available,
    subscriptionStatus: entitlement.subscription.status,
  }
  return { agents: mappedAgents, runs, entitlements }
}
export async function loadPlans(signal?: AbortSignal): Promise<Plan[]> {
  return validated(z.array(planDTO), await c4Request('/v1/billing/plans', 'GET', undefined, signal))
}
export async function loadModels(signal?: AbortSignal): Promise<string[]> {
  const response = await c4Request('/v1/models', 'GET', undefined, signal)
  const parsed = z
    .object({ data: z.array(z.object({ id: z.string().min(1).max(200) })) })
    .safeParse(response)
  if (!parsed.success)
    throw new ApiError(
      'The model directory format is not supported. Enter a model ID configured by your administrator.',
    )
  return [...new Set(parsed.data.data.map((m) => m.id))]
}
export async function executeC4Command(cmd: Command): Promise<string | undefined> {
  if (cmd.type === 'create-workspace') {
    const raw = await c4Request(
      '/v1/workspaces',
      'POST',
      workspaceInput.parse({ name: cmd.name, description: cmd.description }),
    )
    const parsed = workspaceDTO.safeParse(raw)
    if (!parsed.success)
      throw new ApiError(
        'Workspace creation was accepted but its response could not be verified. Refresh before creating another workspace.',
        200,
        true,
      )
    return parsed.data.id
  }
  const base = '/v1/workspaces/' + id.parse(cmd.workspaceId)
  switch (cmd.type) {
    case 'update-workspace':
      await c4Request(
        base,
        'PATCH',
        workspaceInput.parse({ name: cmd.name, description: cmd.description }),
      )
      break
    case 'delete-workspace':
      await c4Request(base, 'DELETE')
      break
    case 'create-agent':
      await c4Request(base + '/agents', 'POST', agentInput.parse(cmd.values))
      break
    case 'update-agent':
      await c4Request(
        base + '/agents/' + id.parse(cmd.agentId),
        'PATCH',
        agentInput.extend({ status: z.enum(['active', 'disabled']) }).parse(cmd.values),
      )
      break
    case 'delete-agent':
      await c4Request(base + '/agents/' + id.parse(cmd.agentId), 'DELETE')
      break
    case 'create-run':
      await c4Request(base + '/tasks', 'POST', taskInput.parse(cmd.values))
      break
    case 'update-run':
      await c4Request(base + '/tasks/' + id.parse(cmd.runId), 'PATCH', taskInput.parse(cmd.values))
      break
    case 'delete-run':
      await c4Request(base + '/tasks/' + id.parse(cmd.runId), 'DELETE')
      break
    case 'run-action':
      await c4Request(
        base +
          '/tasks/' +
          id.parse(cmd.runId) +
          '/' +
          z.enum(['queue', 'start', 'cancel']).parse(cmd.action),
        'POST',
      )
      break
    default:
      throw new ApiError('This operation is not supported by the control plane.')
  }
}
