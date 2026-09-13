import { agentColors, packs, toolsCatalog } from './catalog'
import { iso, uid, type Command, type Snapshot, type Workspace, type Run } from './domain'
export function installPack(data: Snapshot, name: string, packId: string): Workspace {
  const pack = packs.find((p) => p.id === packId)
  if (!pack) throw new Error('Choose a valid workforce pack.')
  if (!name.trim() || name.trim().length > 60)
    throw new Error('Workspace name must be 1–60 characters.')
  const w: Workspace = {
    id: uid('ws'),
    name: name.trim(),
    description: pack.description,
    packId,
    icon: pack.icon,
    monthlyBudget: 2500,
    dailyBudget: 500,
    perRunBudget: 100,
    concurrency: 2,
  }
  data.workspaces.push(w)
  pack.agents.forEach(([name, role], i) =>
    data.agents.push({
      id: uid('agent'),
      workspaceId: w.id,
      name,
      role,
      color: agentColors[i % agentColors.length],
      state: 'idle',
      skills: pack.skills.filter((_, n) => n % Math.max(1, pack.agents.length) === i),
      model: 'MESTHI managed',
      policy: role.includes('Publisher') ? 'supervised' : 'draft_only',
    }),
  )
  pack.workflows.forEach((f) =>
    data.workflows.push({
      ...f,
      id: uid('flow'),
      workspaceId: w.id,
      trigger: 'manual',
      enabled: true,
    }),
  )
  if (packId === 'custom')
    data.workflows.push({
      id: uid('flow'),
      workspaceId: w.id,
      name: 'Custom task',
      description: 'Work from a brief and return a draft for review.',
      steps: ['Plan', 'Work', 'Review'],
      estimatedCredits: 20,
      requiresApproval: true,
      trigger: 'manual',
      enabled: true,
    })
  return w
}
export function usage(data: Snapshot, workspaceId: string, period: 'month' | 'day' = 'month') {
  const prefix = iso().slice(0, period === 'day' ? 10 : 7)
  return data.ledger
    .filter((l) => l.workspaceId === workspaceId && l.createdAt.startsWith(prefix))
    .reduce((n, l) => n + l.credits, 0)
}
export const reserved = (d: Snapshot, w: string, except?: string) =>
  d.runs
    .filter(
      (r) =>
        r.workspaceId === w &&
        !['completed', 'cancelled', 'failed'].includes(r.status) &&
        r.id !== except,
    )
    .reduce((n, r) => n + r.estimatedCredits, 0)
function guard(data: Snapshot, w: Workspace, cost: number, except?: string) {
  if (cost > w.perRunBudget)
    throw new Error('This task exceeds the per-run budget. Adjust Usage & billing first.')
  if (usage(data, w.id) + reserved(data, w.id, except) + cost > w.monthlyBudget)
    throw new Error('Monthly budget reached, including reserved credits.')
  if (usage(data, w.id, 'day') + reserved(data, w.id, except) + cost > w.dailyBudget)
    throw new Error('Daily budget reached, including reserved credits.')
  if (
    data.runs.filter((r) => r.workspaceId === w.id && r.status === 'running' && r.id !== except)
      .length >= w.concurrency
  )
    throw new Error('Concurrency limit reached. Pause a run or adjust capacity in Usage & billing.')
}
function complete(data: Snapshot, run: Run) {
  run.status = 'completed'
  run.progress = 100
  run.updatedAt = iso()
  if (data.ledger.some((l) => l.runId === run.id)) return
  data.ledger.push({
    id: uid('meter'),
    workspaceId: run.workspaceId,
    runId: run.id,
    category: 'AgentRun',
    credits: run.estimatedCredits,
    createdAt: iso(),
  })
  const video = data.workflows.find((w) => w.id === run.workflowId)?.name.includes('video')
  data.artifacts.push({
    id: uid('artifact'),
    workspaceId: run.workspaceId,
    runId: run.id,
    name: run.title + '.md',
    kind: video ? 'storyboard' : 'document',
    createdAt: iso(),
    content:
      '# ' +
      run.title +
      '\n\nLocal demo sample — not AI-generated, researched, rendered, or published.\n\n## Brief\n' +
      run.brief +
      '\n\n' +
      (video
        ? '## Storyboard\n1. Hook (0–5s): a busy desk. Introduce the audience problem.\n2. Story (5–20s): an AI team collaborates on a clear brief.\n3. Close (20–30s): review the result and invite the audience to explore.\n\nVideo rendering requires a backend media provider.'
        : '## Draft outline\n- Define the audience and intended outcome.\n- Gather evidence and validate each claim.\n- Develop a narrative with concrete examples.\n- Review tone and accuracy before delivery.') +
      '\n\n## Review\nHuman review is required before external delivery.',
  })
  run.log.push('Demo complete. Sample artifact created; no external action was taken.')
}
function reconcile(data: Snapshot) {
  for (const a of data.agents) {
    const runs = data.runs.filter((r) => r.agentId === a.id)
    a.state = runs.some((r) => r.status === 'running')
      ? 'working'
      : runs.some((r) => r.status === 'awaiting_approval')
        ? 'waiting_approval'
        : runs.some((r) => r.status === 'paused')
          ? 'paused'
          : 'idle'
  }
}
export function seed(): Snapshot {
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
  const content = installPack(data, 'MESTHI Creative', 'content')
  installPack(data, 'Engineering Lab', 'software')
  installPack(data, 'Research Desk', 'research')
  const rows = [
    ['September brand launch', 'running', 36, 0, 0],
    ['A better way to work — social post', 'awaiting_approval', 78, 4, 1],
    ['Creator economy: audience research', 'running', 64, 1, 2],
    ['The MESTHI voice & tone guide', 'completed', 100, 2, 2],
    ['Weekly content performance', 'completed', 100, 0, 3],
    ['Product story — 30 second reel', 'paused', 22, 3, 0],
  ] as const
  rows.forEach(([title, status, progress, a, f]) => {
    const flow = data.workflows.filter((w) => w.workspaceId === content.id)[f]
    const run: Run = {
      id: uid('run'),
      workspaceId: content.id,
      title,
      brief:
        'Sample brief: ' +
        title +
        '. Audience: independent builders and creative teams. Tone: clear, thoughtful, optimistic.',
      agentId: data.agents[a].id,
      workflowId: flow.id,
      status,
      progress,
      estimatedCredits: flow.estimatedCredits,
      requiresApproval: flow.requiresApproval,
      approved: false,
      createdAt: iso(),
      updatedAt: iso(),
      log: ['Sample run loaded. Demo activity is simulated locally.'],
    }
    data.runs.push(run)
    if (status === 'completed') complete(data, run)
  })
  data.knowledge.push({
    id: uid('knowledge'),
    workspaceId: content.id,
    name: 'Brand foundations',
    category: 'knowledge',
    content:
      '# MESTHI\n\nA shared workspace for your AI workforce.\n\nVoice: thoughtful, clear, practical.\nAudience: independent builders and creators.\nAlways send public content for human review.',
    createdAt: iso(),
  })
  reconcile(data)
  return data
}
export function reduceCommand(input: Snapshot, cmd: Command): Snapshot {
  const data = structuredClone(input)
  if (cmd.type === 'create-workspace') installPack(data, cmd.name, cmd.packId)
  else if (cmd.type === 'tick') {
    for (const run of data.runs.filter((r) => r.status === 'running')) {
      run.progress = Math.min(100, run.progress + 3)
      run.updatedAt = iso()
      if (run.requiresApproval && !run.approved && run.progress >= 78) {
        run.progress = 78
        run.status = 'awaiting_approval'
        run.log.push('Demo draft ready. Waiting for a human approval decision.')
      } else if (run.progress >= 100) complete(data, run)
    }
  } else {
    const w = data.workspaces.find((w) => w.id === cmd.workspaceId)
    if (!w) throw new Error('Workspace no longer exists.')
    if (cmd.type === 'create-agent') {
      if (!cmd.name.trim() || !cmd.role.trim()) throw new Error('Add an agent name and role.')
      data.agents.push({
        id: uid('agent'),
        workspaceId: w.id,
        name: cmd.name.trim().slice(0, 40),
        role: cmd.role.trim().slice(0, 64),
        color: agentColors[data.agents.length % agentColors.length],
        state: 'idle',
        model: 'MESTHI managed',
        policy: 'draft_only',
        skills: cmd.skills,
      })
    } else if (cmd.type === 'update-agent') {
      const a = data.agents.find((a) => a.id === cmd.agentId && a.workspaceId === w.id)
      if (!a) throw new Error('Agent is not in this workspace.')
      if (cmd.model) a.model = cmd.model
      if (cmd.policy) a.policy = cmd.policy
      if (cmd.avatar) a.avatar = cmd.avatar
    } else if (cmd.type === 'create-run') {
      const f = data.workflows.find(
        (f) => f.id === cmd.workflowId && f.workspaceId === w.id && f.enabled,
      )
      if (!f) throw new Error('Choose an enabled workflow in this workspace.')
      if (!data.agents.some((a) => a.id === cmd.agentId && a.workspaceId === w.id))
        throw new Error('Choose an agent in this workspace.')
      if (!cmd.title.trim() || cmd.title.length > 140 || !cmd.brief.trim())
        throw new Error('Add a task title (up to 140 characters) and a brief.')
      guard(data, w, f.estimatedCredits)
      data.runs.unshift({
        id: uid('run'),
        workspaceId: w.id,
        title: cmd.title.trim(),
        brief: cmd.brief.trim(),
        agentId: cmd.agentId,
        workflowId: f.id,
        status: 'running',
        progress: 0,
        estimatedCredits: f.estimatedCredits,
        requiresApproval: f.requiresApproval,
        approved: false,
        createdAt: iso(),
        updatedAt: iso(),
        log: [
          'Demo run started. No model calls or external tools are executed.',
          'Plan created from the selected workflow template.',
        ],
      })
    } else if (cmd.type === 'run-action') {
      const r = data.runs.find((r) => r.id === cmd.runId && r.workspaceId === w.id)
      if (!r) throw new Error('Run is not in this workspace.')
      if (cmd.action === 'pause' && r.status === 'running') r.status = 'paused'
      else if (cmd.action === 'resume' && r.status === 'paused') {
        guard(data, w, r.estimatedCredits, r.id)
        r.status = 'running'
      } else if (cmd.action === 'approve' && r.status === 'awaiting_approval') {
        guard(data, w, r.estimatedCredits, r.id)
        r.approved = true
        r.status = 'running'
      } else if (cmd.action === 'reject' && r.status === 'awaiting_approval') r.status = 'cancelled'
      else if (cmd.action === 'cancel' && !['completed', 'cancelled', 'failed'].includes(r.status))
        r.status = 'cancelled'
      else throw new Error('That action is no longer available. Refresh the run state.')
      r.updatedAt = iso()
      r.log.push('Demo action: ' + cmd.action + '.')
    } else if (cmd.type === 'save-knowledge') {
      if (!cmd.name.trim() || !cmd.content.trim() || cmd.content.length > 65536)
        throw new Error('Add a title and content, up to 64 KB.')
      data.knowledge.unshift({
        id: uid('doc'),
        workspaceId: w.id,
        name: cmd.name.trim(),
        content: cmd.content,
        category: cmd.category,
        createdAt: iso(),
      })
    } else if (cmd.type === 'configure-connection') {
      if (!toolsCatalog.some((t) => t.id === cmd.toolId)) throw new Error('Unknown tool.')
      const c = data.connections.find((c) => c.workspaceId === w.id && c.toolId === cmd.toolId)
      if (c) c.status = cmd.enabled ? 'demo' : 'disconnected'
      else
        data.connections.push({
          id: uid('connection'),
          workspaceId: w.id,
          toolId: cmd.toolId,
          status: cmd.enabled ? 'demo' : 'disconnected',
        })
    } else if (cmd.type === 'update-workflow') {
      const f = data.workflows.find((f) => f.id === cmd.workflowId && f.workspaceId === w.id)
      if (!f) throw new Error('Workflow is not in this workspace.')
      f.trigger = cmd.trigger
      f.enabled = cmd.enabled
    } else if (cmd.type === 'update-budget') {
      if (
        [cmd.monthlyBudget, cmd.dailyBudget, cmd.perRunBudget, cmd.concurrency].some(
          (n) => !Number.isInteger(n) || n <= 0,
        )
      )
        throw new Error('Limits must be positive whole numbers.')
      if (
        cmd.concurrency > 10 ||
        cmd.perRunBudget > cmd.dailyBudget ||
        cmd.dailyBudget > cmd.monthlyBudget
      )
        throw new Error('Use per-run ≤ daily ≤ monthly, and concurrency from 1 to 10.')
      Object.assign(w, {
        monthlyBudget: cmd.monthlyBudget,
        dailyBudget: cmd.dailyBudget,
        perRunBudget: cmd.perRunBudget,
        concurrency: cmd.concurrency,
      })
      const projected = reserved(data, w.id)
      const exceeded =
        usage(data, w.id) + projected > w.monthlyBudget ||
        usage(data, w.id, 'day') + projected > w.dailyBudget
      let running = 0
      for (const r of data.runs.filter((r) => r.workspaceId === w.id && r.status === 'running')) {
        if (exceeded || r.estimatedCredits > w.perRunBudget || running >= w.concurrency) {
          r.status = 'paused'
          r.log.push('Demo budget guard paused this run after a limit change.')
        } else running++
      }
    }
  }
  reconcile(data)
  return data
}
