import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../core/runtime'
import type { Run, TaskInput } from '../core/domain'
import { Empty, Field, Icon, Modal } from '../components/ui'
export function CreateWorkspace({ onClose }: { onClose: () => void }) {
  const { command, writable } = useWorkspace()
  const [name, setName] = useState(''),
    [description, setDescription] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (await command({ type: 'create-workspace', name, description })) onClose()
  }
  return (
    <Modal
      title="Create a workspace"
      description="Keep your team's agents and tasks together."
      onClose={onClose}
    >
      <form className="stack gap-4" onSubmit={submit}>
        <Field label="Workspace name">
          <input
            autoFocus
            required
            maxLength={120}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="Description">
          <textarea
            maxLength={2000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button className="button primary" disabled={!writable || !name.trim()}>
            Create workspace
            <Icon name="ArrowRight" />
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function CreateRun({
  onClose,
  task,
  initial,
}: {
  onClose: () => void
  task?: Run
  initial?: Partial<TaskInput>
}) {
  const { activeId, agents, command, writable, navigate } = useWorkspace()
  const available = agents.filter((a) => a.status === 'active')
  const [values, setValues] = useState<TaskInput>({
    agent_id: task?.agentId ?? available[0]?.id ?? '',
    title: task?.title ?? initial?.title ?? '',
    instructions: task?.brief ?? initial?.instructions ?? '',
    priority: (task?.priority as TaskInput['priority']) ?? 'normal',
  })
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await command(
        task
          ? { type: 'update-run', workspaceId: activeId, runId: task.id, values }
          : { type: 'create-run', workspaceId: activeId, values },
      )
    )
      onClose()
  }
  return (
    <Modal
      title={task ? 'Edit task' : 'Give your team a mission'}
      description="Save a task, then queue and start it when you are ready."
      onClose={onClose}
    >
      {!available.length ? (
        <Empty
          title="Add an active agent first"
          text="An agent needs a model and the right instructions for this task."
          action={
            <button
              className="button primary"
              onClick={() => {
                onClose()
                navigate('agents')
              }}
            >
              Open workforce
            </button>
          }
        />
      ) : (
        <form className="stack gap-4" onSubmit={submit}>
          <Field label="Task title">
            <input
              autoFocus
              required
              maxLength={200}
              value={values.title}
              onChange={(e) => setValues({ ...values, title: e.target.value })}
            />
          </Field>
          <Field label="Instructions">
            <textarea
              rows={7}
              required
              maxLength={100000}
              value={values.instructions}
              onChange={(e) => setValues({ ...values, instructions: e.target.value })}
              placeholder="Describe the outcome, constraints, and how the result should be delivered."
            />
          </Field>
          <div className="form-grid">
            <Field label="Assigned agent">
              <select
                required
                value={values.agent_id}
                onChange={(e) => setValues({ ...values, agent_id: e.target.value })}
              >
                <option value="" disabled>
                  Select an agent
                </option>
                {available.map((a) => (
                  <option value={a.id} key={a.id}>
                    {a.name} · {a.role}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Priority">
              <select
                value={values.priority}
                onChange={(e) =>
                  setValues({ ...values, priority: e.target.value as TaskInput['priority'] })
                }
              >
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <option key={p}>{p}</option>
                ))}
              </select>
            </Field>
          </div>
          <div className="modal-actions">
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              disabled={
                !writable ||
                !available.some((a) => a.id === values.agent_id) ||
                !values.title.trim() ||
                !values.instructions.trim()
              }
              className="button primary"
            >
              {task ? 'Save task' : 'Create task'}
              <Icon name="ArrowRight" />
            </button>
          </div>
        </form>
      )}
    </Modal>
  )
}
export function ConfirmAction({
  title,
  name,
  description,
  onConfirm,
  onClose,
  destructive = false,
}: {
  title: string
  name: string
  description: string
  onConfirm: () => Promise<void>
  onClose: () => void
  destructive?: boolean
}) {
  const { writable } = useWorkspace()
  const [confirmation, setConfirmation] = useState('')
  return (
    <Modal title={title} description={description} onClose={onClose}>
      <p>
        <strong>{name}</strong>
      </p>
      {destructive && (
        <Field label="Type the name to confirm">
          <input
            autoComplete="off"
            value={confirmation}
            onChange={(e) => setConfirmation(e.target.value)}
          />
        </Field>
      )}
      <div className="modal-actions">
        <button className="button secondary" onClick={onClose}>
          Back
        </button>
        <button
          className="button primary"
          disabled={!writable || (destructive && confirmation !== name)}
          onClick={() => void onConfirm()}
        >
          {title}
        </button>
      </div>
    </Modal>
  )
}
