import { useState, type FormEvent } from 'react'
import { useWorkspace, mode } from '../core/runtime'
import { usage, reserved } from '../core/demo'
import { hasAccessToken, setAccessToken } from '../core/c4Adapter'
import { Field, Icon, Modal, PageHeading } from '../components/ui'
export function UsagePage() {
  const { data, workspace, activeId, command, busy, notify } = useWorkspace()
  const [editing, setEditing] = useState(false),
    [pricing, setPricing] = useState(false)
  if (!workspace) return null
  const used = usage(data, activeId),
    ledger = data.ledger.filter((l) => l.workspaceId === activeId),
    held = reserved(data, activeId),
    available =
      workspace.entitlements?.availableCredits ?? Math.max(0, workspace.monthlyBudget - used - held)
  const categories = [
    'AgentRun',
    'ModelCall',
    'ToolCall',
    'MediaGeneration',
    'SandboxExecution',
  ] as const
  return (
    <>
      <PageHeading
        eyebrow="GOOD WORK, WITHIN YOUR LIMITS"
        title="Usage & billing"
        text="Understand what your team uses and set a comfortable pace for autonomous work."
        action={
          <button className="button secondary" onClick={() => setPricing(true)}>
            Plan details
            <Icon name="ArrowUpRight" size={16} />
          </button>
        }
      />
      <div className="usage-overview">
        <section className="credit-panel">
          <div className="row-between">
            <span className="eyebrow">MESTHI CREDITS</span>
            <span className="pill">{workspace.entitlements?.planName ?? 'DEMO ALLOWANCE'}</span>
          </div>
          <strong>
            {available.toLocaleString()}
            <span>available</span>
          </strong>
          <div className="credit-track">
            <span
              style={{
                width:
                  Math.min(
                    100,
                    ((mode === 'demo'
                      ? used + held
                      : Math.max(0, workspace.monthlyBudget - available)) /
                      Math.max(workspace.monthlyBudget, 1)) *
                      100,
                  ) + '%',
              }}
            />
          </div>
          <p>
            {mode === 'demo'
              ? used +
                ' used · ' +
                held +
                ' reserved · ' +
                workspace.monthlyBudget.toLocaleString() +
                ' monthly budget'
              : workspace.monthlyBudget.toLocaleString() + ' credits included in your plan'}
          </p>
          <small>
            {mode === 'demo'
              ? 'Local simulation credits. No money is charged.'
              : 'Subscription: ' + workspace.entitlements?.subscriptionStatus}
          </small>
        </section>
        <section className="panel budget-panel">
          <div className="panel-heading">
            <h2>Budget guard</h2>
            <Icon name="ShieldCheck" />
          </div>
          <dl>
            <dt>Monthly budget</dt>
            <dd>{workspace.monthlyBudget.toLocaleString()} credits</dd>
            <dt>Daily limit</dt>
            <dd>{mode === 'demo' ? workspace.dailyBudget + ' credits' : 'Not exposed in C4'}</dd>
            <dt>Per-run limit</dt>
            <dd>{mode === 'demo' ? workspace.perRunBudget + ' credits' : 'Not exposed in C4'}</dd>
            <dt>Concurrent tasks</dt>
            <dd>{workspace.concurrency}</dd>
          </dl>
          <button
            className="button secondary"
            disabled={mode === 'api'}
            onClick={() => setEditing(true)}
          >
            Adjust limits
            <Icon name="Settings2" size={15} />
          </button>
        </section>
      </div>
      <section className="panel usage-breakdown">
        <div className="panel-heading">
          <h2>Usage by activity</h2>
          <span className="muted">Current workspace</span>
        </div>
        {categories.map((category, i) => {
          const credits = ledger
            .filter((l) => l.category === category)
            .reduce((n, l) => n + l.credits, 0)
          return (
            <div className="usage-category" key={category}>
              <span>
                <i
                  style={{ background: ['#9ebc80', '#acc6d6', '#d9bc8d', '#c4b1d3', '#cfb5a7'][i] }}
                />
                {category.replace(/([a-z])([A-Z])/g, '$1 $2')}
              </span>
              <div className="progress-track">
                <span style={{ width: (used ? (credits / used) * 100 : 0) + '%' }} />
              </div>
              <strong>{mode === 'api' ? 'Not exposed' : credits}</strong>
            </div>
          )
        })}
        <p className="page-footnote">
          {mode === 'demo'
            ? 'One AgentRun charge is recorded on completion. Model, tool, media, and sandbox costs are not simulated.'
            : 'C4 exposes an entitlement balance. A usage-ledger endpoint is needed for category totals; zero usage is not assumed.'}
        </p>
      </section>
      {editing && (
        <BudgetDialog
          onClose={() => setEditing(false)}
          defaults={workspace}
          busy={busy}
          save={async (values) => {
            if (await command({ type: 'update-budget', workspaceId: activeId, ...values })) {
              setEditing(false)
              notify('Workspace limits updated.')
            }
          }}
        />
      )}{' '}
      {pricing && (
        <Modal
          title="Simple plans, thoughtful limits"
          description={
            mode === 'demo'
              ? 'Product preview. Pricing and credit conversion are proposals; checkout is not connected.'
              : 'Actual subscription values come from the C4 entitlement API.'
          }
          onClose={() => setPricing(false)}
        >
          <div className="plan-comparison">
            <div>
              <span className="eyebrow">FREE</span>
              <h2>A place to begin</h2>
              <p>Try a small workspace, built-in templates, and limited runs.</p>
            </div>
            <div>
              <span className="eyebrow">PRO · PROPOSAL</span>
              <h2>Room to do more</h2>
              <p>
                Included credits, top-ups, and BYOK. Proposed price: $19–29/month; not a purchasable
                offer.
              </p>
            </div>
          </div>
          <p className="inline-note">
            With BYOK, model inference is paid to the provider. Platform compute, orchestration, and
            storage require separate metering.
          </p>
          <div className="modal-actions">
            <button className="button secondary" onClick={() => setPricing(false)}>
              Got it
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
function BudgetDialog({
  onClose,
  save,
  defaults,
  busy,
}: {
  onClose: () => void
  save: (v: {
    monthlyBudget: number
    dailyBudget: number
    perRunBudget: number
    concurrency: number
  }) => Promise<void>
  defaults: {
    monthlyBudget: number
    dailyBudget: number
    perRunBudget: number
    concurrency: number
  }
  busy: boolean
}) {
  const [v, setV] = useState({
    monthlyBudget: defaults.monthlyBudget,
    dailyBudget: defaults.dailyBudget,
    perRunBudget: defaults.perRunBudget,
    concurrency: defaults.concurrency,
  })
  return (
    <Modal
      title="Set a comfortable pace"
      description="A run reserves its estimate at the start. Completion is charged once. Cancellation releases its reservation."
      onClose={onClose}
    >
      <form
        className="stack gap-4"
        onSubmit={(e) => {
          e.preventDefault()
          void save(v)
        }}
      >
        {(
          [
            ['monthlyBudget', 'Monthly credit budget'],
            ['dailyBudget', 'Daily credit limit'],
            ['perRunBudget', 'Per-run credit limit'],
            ['concurrency', 'Concurrent runs'],
          ] as const
        ).map(([key, label]) => (
          <Field key={key} label={label}>
            <input
              type="number"
              min={1}
              max={key === 'concurrency' ? 10 : 1000000}
              step={1}
              required
              value={v[key]}
              onChange={(e) => setV({ ...v, [key]: Number(e.target.value) })}
            />
          </Field>
        ))}
        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>
            Cancel
          </button>
          <button disabled={busy} className="button primary">
            Save limits
          </button>
        </div>
      </form>
    </Modal>
  )
}
export function SettingsPage({ theme, onTheme }: { theme: string; onTheme: () => void }) {
  const { workspace, refresh, notify } = useWorkspace()
  const [token, setToken] = useState(''),
    [loading, setLoading] = useState(false)
  async function connect(e: FormEvent) {
    e.preventDefault()
    setLoading(true)
    setAccessToken(token)
    setToken('')
    await refresh()
    setLoading(false)
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        text="Workspace preferences and the connection to your control plane."
      />
      <div className="settings-layout">
        <section className="panel settings-card">
          <div className="settings-heading">
            <span className="workflow-icon">
              <Icon name="Layers" />
            </span>
            <div>
              <h2>Workspace</h2>
              <p>{workspace?.name ?? 'Connect to your workspace'}</p>
            </div>
          </div>
          <dl>
            <dt>Data mode</dt>
            <dd>
              <span className="pill subtle">{mode === 'demo' ? 'Local demo' : 'C4 API'}</span>
            </dd>
            <dt>Workspace scope</dt>
            <dd>Agents, tasks, documents, and tools</dd>
            <dt>Public actions</dt>
            <dd>{mode === 'demo' ? 'Simulated only' : 'Backend permission checks'}</dd>
            <dt>Appearance</dt>
            <dd>
              <button className="button secondary" onClick={onTheme}>
                <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} size={15} />
                {'Switch to ' + (theme === 'dark' ? 'light' : 'dark')}
              </button>
            </dd>
          </dl>
        </section>
        <section className="panel settings-card">
          <div className="settings-heading">
            <span className="workflow-icon">
              <Icon name="Plug" />
            </span>
            <div>
              <h2>C4 control plane</h2>
              <p>Workspace → Task → TaskSession → Hermes</p>
            </div>
          </div>
          {mode === 'api' ? (
            <form onSubmit={connect} className="stack gap-4">
              <p>
                Use an authorized short-lived access token. It stays in browser memory, clears on
                reload, and is never saved in local storage.
              </p>
              <Field label="API access token">
                <input
                  type="password"
                  autoComplete="off"
                  value={token}
                  onChange={(e) => setToken(e.target.value)}
                  required
                  placeholder="Paste your authorized access token"
                />
              </Field>
              <div className="row gap-3">
                <button className="button primary" disabled={loading}>
                  {loading ? 'Connecting…' : 'Connect session'}
                  <Icon name="ArrowRight" />
                </button>
                {hasAccessToken() && (
                  <button
                    type="button"
                    className="button secondary"
                    onClick={() => {
                      setAccessToken('')
                      location.reload()
                    }}
                  >
                    Disconnect
                  </button>
                )}
              </div>
            </form>
          ) : (
            <>
              <p>
                The demo is self-contained. For the existing backend, configure the build with{' '}
                <code>VITE_DATA_MODE=api</code> and a same-origin API gateway.
              </p>
              <p>
                Verified integration: C4 workspaces, agents, tasks, lifecycle, and billing
                entitlements. Templates, content, approvals, and connectors need additional APIs.
              </p>
              <button
                className="text-button"
                onClick={() =>
                  notify(
                    'Read docs/C4_ALIGNMENT.md and docs/API_CONTRACT.md in the repository for mapping and integration steps.',
                  )
                }
              >
                View integration guidance
                <Icon name="ArrowRight" size={15} />
              </button>
            </>
          )}
        </section>
        <section className="panel settings-card">
          <div className="settings-heading">
            <span className="workflow-icon">
              <Icon name="ShieldCheck" />
            </span>
            <div>
              <h2>Model & credential boundaries</h2>
              <p>Your tools, with clear permissions.</p>
            </div>
          </div>
          <p>
            OmniRoute remains behind the backend. Hermes, sandbox access, Git Broker, provider keys,
            and billing enforcement remain server responsibilities.
          </p>
          <p>
            Markdown skills add context. They never grant permissions for publishing or external
            messages.
          </p>
          <a
            className="text-button"
            href="https://github.com/arumora-id/ai.mesthi.com"
            target="_blank"
            rel="noreferrer"
          >
            Open source repository
            <Icon name="ExternalLink" size={15} />
          </a>
        </section>
      </div>
    </>
  )
}
