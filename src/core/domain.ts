export type RunStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'delivering'
  | 'paused'
  | 'completed'
  | 'cancelled'
  | 'failed'
  | 'unknown'
export interface Workspace {
  id: string
  name: string
  description: string
  createdAt: string
  updatedAt: string
}
export interface Agent {
  id: string
  workspaceId: string
  name: string
  role: string
  description: string
  state: 'working' | 'idle' | 'paused' | 'error'
  status: string
  color: string
  model: string
  modelSource: string
  modelId: string | null
  systemPrompt: string
  repository: string | null
  defaultBranch: string
}
export interface Run {
  id: string
  workspaceId: string
  agentId: string | null
  agentName: string
  title: string
  brief: string
  status: RunStatus
  backendStatus: string
  priority: string
  repository: string | null
  baseBranch: string | null
  branchName: string | null
  resultSummary: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  completedAt: string | null
}
export interface Plan {
  id: string
  code: string
  name: string
  price_monthly_cents: number
  currency: string
  limits: Record<string, number>
  features: Record<string, boolean>
}
export interface Entitlements {
  workspaceId: string
  plan: Plan
  availableCredits: number
  subscriptionStatus: string
}
export interface Snapshot {
  agents: Agent[]
  runs: Run[]
  entitlements: Entitlements | null
}
export interface AgentInput {
  name: string
  role: string
  description: string
  system_prompt: string
  model_source: 'mesthi_ai' | 'byok'
  model_id: string | null
  repository_full_name: string | null
  default_branch: string
}
export interface TaskInput {
  agent_id: string
  title: string
  instructions: string
  priority: 'low' | 'normal' | 'high' | 'urgent'
}
export type Command =
  | { type: 'create-workspace'; name: string; description: string }
  | { type: 'update-workspace'; workspaceId: string; name: string; description: string }
  | { type: 'delete-workspace'; workspaceId: string }
  | { type: 'create-agent'; workspaceId: string; values: AgentInput }
  | {
      type: 'update-agent'
      workspaceId: string
      agentId: string
      values: AgentInput & { status: 'active' | 'disabled' }
    }
  | { type: 'delete-agent'; workspaceId: string; agentId: string }
  | { type: 'create-run'; workspaceId: string; values: TaskInput }
  | { type: 'update-run'; workspaceId: string; runId: string; values: TaskInput }
  | { type: 'delete-run'; workspaceId: string; runId: string }
  | { type: 'run-action'; workspaceId: string; runId: string; action: 'queue' | 'start' | 'cancel' }
export const pages = [
  'overview',
  'agents',
  'runs',
  'office',
  'content',
  'artifacts',
  'usage',
  'settings',
] as const
export type Page = (typeof pages)[number]
