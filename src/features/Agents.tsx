import { useState, type FormEvent } from 'react'
import { mode, useWorkspace } from '../core/runtime'
import { Avatar, Empty, Field, Icon, Modal, PageHeading } from '../components/ui'
export function AgentsPage({ onAgent }: { onAgent: (id: string) => void }) {
  const { agents } = useWorkspace()
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
        text="A specialist for every step. Give each agent the skills to do their best work."
        action={
          <button className="button primary" onClick={() => setCreating(true)}>
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
                {a.state.replaceAll('_', ' ')}
              </span>
            </div>
            <h2>{a.name}</h2>
            <p>{a.role}</p>
            <div className="skill-tags">
              {a.skills.slice(0, 3).map((s) => (
                <span key={s}>{s}</span>
              ))}
              {!a.skills.length && (
                <span>
                  {mode === 'api' ? 'Skills not exposed in C4' : 'Ready for your instructions'}
                </span>
              )}
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
        <Empty
          title="Room for a new teammate"
          text="Create an agent or install a workforce pack to get started."
        />
      )}
      {creating && <CreateAgent onClose={() => setCreating(false)} />}
    </>
  )
}
function CreateAgent({ onClose }: { onClose: () => void }) {
  const { activeId, command, busy } = useWorkspace()
  const [name, setName] = useState(''),
    [role, setRole] = useState(''),
    [skills, setSkills] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (
      await command({
        type: 'create-agent',
        workspaceId: activeId,
        name,
        role,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      })
    )
      onClose()
  }
  return (
    <Modal title="Meet your next teammate" onClose={onClose}>
      <form className="stack gap-4 mt-5" onSubmit={submit}>
        <Field label="Name">
          <input
            required
            maxLength={40}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Nova"
          />
        </Field>
        <Field label="Role">
          <input
            required
            maxLength={64}
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="e.g. Digital Marketing Strategist"
          />
        </Field>
        <Field
          label="Skills"
          hint={
            mode === 'api'
              ? 'C4 AgentCreate does not expose skills.'
              : 'Comma-separated skill names. Add markdown documents in Knowledge & skills.'
          }
        >
          <input
            disabled={mode === 'api'}
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="research, copywriting, SEO"
          />
        </Field>
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="button primary">
            Create agent
            <Icon name="ArrowRight" />
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function AgentDetail({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const { agents, runs, activeId, command, busy, notify } = useWorkspace(),
    a = agents.find((a) => a.id === agentId)
  const [model, setModel] = useState(a?.model ?? 'MESTHI managed'),
    [policy, setPolicy] = useState(a?.policy ?? 'draft_only'),
    [width, setWidth] = useState(32),
    [height, setHeight] = useState(32),
    [error, setError] = useState('')
  if (!a) return null
  async function upload(file?: File) {
    if (!file) return
    try {
      if (!['image/png', 'image/webp'].includes(file.type) || file.size > 512000)
        throw new Error('Choose a PNG or WebP sprite sheet under 500 KB.')
      if (![width, height].every((n) => Number.isInteger(n) && n >= 16 && n <= 256))
        throw new Error('Frame size must be a whole number from 16 to 256.')
      const bitmap = await createImageBitmap(file),
        valid =
          bitmap.width <= 2048 &&
          bitmap.height <= 2048 &&
          bitmap.width % width === 0 &&
          bitmap.height % height === 0
      bitmap.close()
      if (!valid)
        throw new Error(
          'Sheet size must be at most 2048×2048 and divisible by the frame dimensions.',
        )
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(String(reader.result))
        reader.onerror = reject
        reader.readAsDataURL(file)
      })
      if (
        await command({
          type: 'update-agent',
          workspaceId: activeId,
          agentId,
          avatar: { version: crypto.randomUUID(), dataUrl, frameWidth: width, frameHeight: height },
        })
      ) {
        notify('Character added. Open Live Office to see your agent.')
        setError('')
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to read this image.')
    }
  }
  return (
    <Modal title={a.name + ' · ' + a.role} onClose={onClose}>
      <div className="agent-detail-header">
        <Avatar agent={a} />
        <div>
          <span className={'agent-state ' + a.state}>
            <i />
            {a.state.replaceAll('_', ' ')}
          </span>
          <p>{runs.filter((r) => r.agentId === agentId).length} tasks assigned</p>
        </div>
      </div>
      <div className="stack gap-4">
        <Field label="Model routing">
          <select
            disabled={mode === 'api'}
            value={model}
            onChange={(e) => setModel(e.target.value)}
          >
            {mode === 'api' ? (
              <option>{a.model}</option>
            ) : (
              <>
                <option>MESTHI managed</option>
                <option>OmniRoute · configured pool</option>
                <option>BYOK · server-managed key</option>
              </>
            )}
          </select>
        </Field>
        <Field label="Autonomy policy">
          <select
            disabled={mode === 'api'}
            value={policy}
            onChange={(e) => setPolicy(e.target.value as typeof policy)}
          >
            <option value="draft_only">
              {mode === 'api' ? 'Not exposed by C4 AgentRead' : 'Create drafts only'}
            </option>
            <option value="supervised">Human approval before delivery</option>
          </select>
        </Field>
        <p className="inline-note">
          <Icon name="ShieldCheck" />
          Provider credentials belong on the server. This interface never stores provider API keys.
        </p>
        <div>
          <span className="field-label">Installed skills</span>
          <div className="skill-tags">
            {a.skills.map((s) => (
              <span key={s}>{s}</span>
            ))}
            {!a.skills.length && (
              <span>{mode === 'api' ? 'Not exposed by C4' : 'No skills assigned'}</span>
            )}
          </div>
        </div>
        <details className="avatar-upload">
          <summary>
            <Icon name="Upload" size={16} />
            Import PixelLab character
          </summary>
          <p>
            Upload a PNG/WebP sprite sheet. The first frame represents your agent; movement follows
            the office path. Directional animation mapping is a future extension.
          </p>
          <div className="form-grid">
            <Field label="Frame width">
              <input
                type="number"
                min={16}
                max={256}
                value={width}
                onChange={(e) => setWidth(Number(e.target.value))}
              />
            </Field>
            <Field label="Frame height">
              <input
                type="number"
                min={16}
                max={256}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
              />
            </Field>
          </div>
          <input
            type="file"
            accept="image/png,image/webp"
            aria-label="Upload character sprite sheet"
            disabled={mode === 'api'}
            onChange={(e) => {
              void upload(e.target.files?.[0])
              e.target.value = ''
            }}
          />
          {mode === 'api' && <small>Avatar storage requires a media API extension.</small>}
        </details>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="modal-actions">
          <button className="button secondary" onClick={onClose}>
            Close
          </button>
          <button
            disabled={busy || mode === 'api'}
            className="button primary"
            onClick={async () => {
              if (
                await command({
                  type: 'update-agent',
                  workspaceId: activeId,
                  agentId,
                  model,
                  policy,
                })
              ) {
                notify('Agent preferences saved.')
                onClose()
              }
            }}
          >
            Save preferences
          </button>
        </div>
      </div>
    </Modal>
  )
}
