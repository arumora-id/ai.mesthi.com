// Test data is only imported by tests and never by application code.
export const workspaceId = '10000000-0000-4000-8000-000000000001'
export const secondWorkspaceId = '10000000-0000-4000-8000-000000000002'
export const agentId = '20000000-0000-4000-8000-000000000001'
export const taskId = '30000000-0000-4000-8000-000000000001'
export const timestamp = '2026-09-13T10:00:00Z'
export const workspace = {
  id: workspaceId,
  name: 'TEST_ONLY_WORKSPACE',
  description: 'Contract fixture',
  created_at: timestamp,
  updated_at: timestamp,
}
export const secondWorkspace = { ...workspace, id: secondWorkspaceId, name: 'Second workspace' }
export const agent = {
  id: agentId,
  workspace_id: workspaceId,
  name: 'Research agent',
  slug: 'research-agent',
  description: 'Research and content',
  role: 'research',
  system_prompt: 'Cite sources.',
  model_source: 'mesthi_ai',
  model_id: 'configured-model',
  repository_full_name: null,
  default_branch: 'main',
  status: 'active',
  created_at: timestamp,
  updated_at: timestamp,
}
export const task = {
  id: taskId,
  workspace_id: workspaceId,
  agent_id: agentId,
  agent_name_snapshot: agent.name,
  agent_slug_snapshot: agent.slug,
  title: 'Server task',
  instructions: 'Research the requested topic.',
  priority: 'normal',
  status: 'draft',
  repository_full_name: null,
  base_branch: null,
  branch_name: null,
  result_summary: null as string | null,
  error_message: null as string | null,
  created_at: timestamp,
  updated_at: timestamp,
  started_at: null as string | null,
  completed_at: null as string | null,
}
export const plan = {
  id: '40000000-0000-4000-8000-000000000001',
  code: 'team',
  name: 'Team',
  price_monthly_cents: 2900,
  currency: 'USD',
  limits: {
    max_agents: 10,
    max_skills: 20,
    max_parallel_tasks: 2,
    max_concurrent_sessions: 2,
    max_active_worktrees: 2,
    max_members: 3,
    monthly_llm_credits: 5000,
    monthly_runtime_minutes: 1200,
    storage_gb: 10,
    max_session_minutes: 30,
    idle_timeout_minutes: 10,
  },
  features: {
    allow_topup: true,
    allow_auto_recharge: false,
    allow_byok: true,
    allow_browser: true,
    allow_team: true,
    allow_rbac: true,
    allow_audit: true,
  },
}
export const entitlement = {
  workspace_id: workspaceId,
  plan,
  credits: { available: 4321, subscription: 4321, topup: 0, promotion: 0, other: 0 },
  subscription: {
    id: '50000000-0000-4000-8000-000000000001',
    workspace_id: workspaceId,
    plan_id: plan.id,
    status: 'active',
    current_period_start: timestamp,
    current_period_end: '2026-10-13T10:00:00Z',
    cancel_at_period_end: false,
  },
}
export const agentValues = {
  name: 'Editor',
  role: 'copywriter',
  description: '',
  system_prompt: 'Write accurately.',
  model_source: 'mesthi_ai' as const,
  model_id: null,
  repository_full_name: null,
  default_branch: 'main',
}
export const taskValues = {
  agent_id: agentId,
  title: 'New task',
  instructions: 'Produce a sourced report.',
  priority: 'high' as const,
}
