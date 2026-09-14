import { useEffect, useState, type FormEvent } from 'react'
import { useApp, useWorkspace } from '../core/runtime'
import { ApiError, loadModels } from '../core/c4Adapter'
import type { Agent, AgentInput } from '../core/domain'
import { Avatar, Empty, Field, Icon, Modal, PageHeading } from '../components/ui'
import { ConfirmAction } from './CreateDialogs'
export function AgentsPage({ onAgent }: { onAgent: (id: string) => void }) {
  const { agents, writable } = useWorkspace()
  const [creating, setCreating] = useState(false),
    [query, setQuery] = useState('')
  const filtered = agents.filter((a) =>
    (a.name + ' ' + a.role).toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeading
        eyebrow="MANY TALENTS. ONE TEAM."
        title="Your workforce"
        text="Give each agent a role, a model, and clear instructions."
        action={
          <button className="button primary" disabled={!writable} onClick={() => setCreating(true)}>
            <Icon name="Plus" />
            Create agent
          </button>
        }
      />
      <div className="page-tools">
        <div className="search-field">
          <Icon name="Search" size={16} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search agents"
            placeholder="Find a teammate…"
          />
        </div>
        <span className="muted">{agents.length} agents in this workspace</span>
      </div>
      <div className="agent-grid">
        {filtered.map((a) => (
          <button className="panel agent-card" key={a.id} onClick={() => onAgent(a.id)}>
            <div className="row-between">
              <Avatar agent={a} />
              <span className={'agent-state ' + a.state}>
                <i />
                {a.state}
              </span>
            </div>
            <h2>{a.name}</h2>
            <p>{a.role}</p>
            <div className="skill-tags">
              <span>{a.repository ?? 'No repository'}</span>
            </div>
            <div className="agent-card-footer">
              <span>
                <Icon name="Zap" size={14} />
                {a.model}
              </span>
              <Icon name="ArrowUpRight" size={16} />
            </div>
          </button>
        ))}
      </div>
      {!filtered.length && (
        <Empty title="Room for a new teammate" text="Create an agent to start assigning work." />
      )}
      {creating && <AgentEditor onClose={() => setCreating(false)} />}
    </>
  )
}
function AgentEditor({ agent, onClose }: { agent?: Agent; onClose: () => void }) {
  const { activeId, command, writable, refresh } = useWorkspace()
  const [values, setValues] = useState<AgentInput>({
    name: agent?.name ?? '',
    role: agent?.role ?? 'custom',
    description: agent?.description ?? '',
    system_prompt: agent?.systemPrompt ?? '',
    model_source: agent?.modelSource === 'byok' ? 'byok' : 'mesthi_ai',
    model_id: agent?.modelId ?? null,
    repository_full_name: agent?.repository ?? null,
    default_branch: agent?.defaultBranch ?? 'main',
  })
  const [status, setStatus] = useState<'active' | 'disabled'>(
    agent?.status === 'disabled' ? 'disabled' : 'active',
  )
  const [models, setModels] = useState<string[]>([]),
    [modelError, setModelError] = useState('')
  useEffect(() => {
    const controller = new AbortController()
    void loadModels(controller.signal)
      .then(setModels)
      .catch((e) => {
        if (controller.signal.aborted) return
        setModelError(e instanceof Error ? e.message : 'Unable to load models.')
        if (e instanceof ApiError && e.status === 401) useApp.getState().clearSession()
        else if (e instanceof ApiError && e.status === 403) void refresh()
      })
    return () => controller.abort()
  }, [refresh])
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await command(
        agent
          ? {
              type: 'update-agent',
              workspaceId: activeId,
              agentId: agent.id,
              values: { ...values, status },
            }
          : { type: 'create-agent', workspaceId: activeId, values },
      )
    )
      onClose()
  }
  return (
    <Modal title={agent ? 'Configure ' + agent.name : 'Meet your next teammate'} onClose={onClose}>
      <form className="stack gap-4" onSubmit={submit}>
        <div className="form-grid">
          <Field label="Name">
            <input
              required
              autoFocus
              maxLength={120}
              value={values.name}
              onChange={(e) => setValues({ ...values, name: e.target.value })}
            />
          </Field>
          <Field label="Role">
            <input
              required
              maxLength={64}
              value={values.role}
              onChange={(e) => setValues({ ...values, role: e.target.value })}
            />
          </Field>
        </div>
        <Field label="Description">
          <textarea
            maxLength={10000}
            value={values.description}
            onChange={(e) => setValues({ ...values, description: e.target.value })}
          />
        </Field>
        <Field label="System instructions">
          <textarea
            rows={5}
            maxLength={50000}
            value={values.system_prompt}
            onChange={(e) => setValues({ ...values, system_prompt: e.target.value })}
            placeholder="Describe this agent's responsibilities and constraints."
          />
        </Field>
        <div className="form-grid">
          <Field label="Model source">
            <select
              value={values.model_source}
              onChange={(e) =>
                setValues({ ...values, model_source: e.target.value as AgentInput['model_source'] })
              }
            >
              <option value="mesthi_ai">MESTHI managed</option>
              <option value="byok">Your provider configuration</option>
            </select>
          </Field>
          <Field label="Model ID" hint="Leave empty to use the backend default.">
            <input
              list="available-models"
              maxLength={200}
              value={values.model_id ?? ''}
              onChange={(e) => setValues({ ...values, model_id: e.target.value.trim() || null })}
            />
            <datalist id="available-models">
              {models.map((m) => (
                <option key={m} value={m} />
              ))}
            </datalist>
          </Field>
        </div>
        {modelError && <p className="inline-note">{modelError}</p>}
        {values.model_source === 'byok' && (
          <p className="inline-note">
            Your provider credentials must already be configured for your account by the
            administrator.
          </p>
        )}
        <div className="form-grid">
          <Field
            label="GitHub repository"
            hint="Optional for work that does not need code delivery."
          >
            <input
              placeholder="owner/repository"
              maxLength={255}
              pattern="[a-zA-Z0-9_.-]+/[a-zA-Z0-9_.-]+"
              value={values.repository_full_name ?? ''}
              onChange={(e) =>
                setValues({ ...values, repository_full_name: e.target.value.trim() || null })
              }
            />
          </Field>
          <Field label="Default branch">
            <input
              required
              maxLength={255}
              value={values.default_branch}
              onChange={(e) => setValues({ ...values, default_branch: e.target.value })}
            />
          </Field>
        </div>
        {agent && (
          <Field label="Agent status">
            <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)}>
              <option value="active">Active</option>
              <option value="disabled">Disabled</option>
            </select>
          </Field>
        )}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            disabled={!writable || !values.name.trim() || !values.role.trim()}
            className="button primary"
          >
            {agent ? 'Save agent' : 'Create agent'}
            <Icon name="ArrowRight" />
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function AgentDetail({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { agents, runs, activeId, command, writable } = useWorkspace()
  const [editing, setEditing] = useState(false),
    [deleting, setDeleting] = useState(false)
  const a = agents.find((agent) => agent.id === agentId)
  if (!a) return null
  if (editing) return <AgentEditor agent={a} onClose={() => setEditing(false)} />
  if (deleting)
    return (
      <ConfirmAction
        title="Delete agent"
        name={a.name}
        destructive
        description="This removes the agent from the workspace. Existing tasks remain subject to backend retention rules."
        onClose={() => setDeleting(false)}
        onConfirm={async () => {
          if (await command({ type: 'delete-agent', workspaceId: activeId, agentId })) onClose()
        }}
      />
    )
  return (
    <Modal title={a.name + ' · ' + a.role} onClose={onClose}>
      <div className="agent-detail-header">
        <Avatar agent={a} />
        <div>
          <span className={'agent-state ' + a.state}>
            <i />
            {a.status}
          </span>
          <p>{runs.filter((r) => r.agentId === agentId).length} assigned tasks</p>
        </div>
      </div>
      <dl className="detail-grid">
        <dt>Model</dt>
        <dd>{a.model}</dd>
        <dt>Repository</dt>
        <dd>{a.repository ?? 'None'}</dd>
        <dt>Default branch</dt>
        <dd>{a.defaultBranch}</dd>
      </dl>
      {a.description && <p>{a.description}</p>}
      <h3>System instructions</h3>
      <pre className="result-text">{a.systemPrompt || 'No additional instructions.'}</pre>
      <div className="modal-actions">
        <button
          className="text-button danger-text"
          disabled={!writable}
          onClick={() => setDeleting(true)}
        >
          Delete agent
        </button>
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
        <button className="button primary" disabled={!writable} onClick={() => setEditing(true)}>
          Configure agent
        </button>
      </div>
    </Modal>
  )
}
