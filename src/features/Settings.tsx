import { useEffect, useState, type FormEvent } from 'react'
import { useApp, useWorkspace } from '../core/runtime'
import { ApiError, loadPlans } from '../core/c4Adapter'
import type { Plan } from '../core/domain'
import { Field, Icon, PageHeading } from '../components/ui'
import { ConfirmAction } from './CreateDialogs'
const limitLabel = (key: string) => key.replaceAll('_', ' ')
const limitValue = (value: number) => (value < 0 ? 'Unlimited' : value.toLocaleString())
export function UsagePage() {
  const { entitlements } = useWorkspace()
  const [plans, setPlans] = useState<Plan[]>([]),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true),
    [attempt, setAttempt] = useState(0)
  useEffect(() => {
    const c = new AbortController()
    setLoading(true)
    setError('')
    void loadPlans(c.signal)
      .then(setPlans)
      .catch((e) => {
        if (!c.signal.aborted) {
          setError(e instanceof Error ? e.message : 'Unable to load plans.')
          if (e instanceof ApiError && e.status === 401) useApp.getState().clearSession()
        }
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false)
      })
    return () => c.abort()
  }, [attempt])
  if (!entitlements) return null
  return (
    <>
      <PageHeading
        eyebrow="GOOD WORK, WITHIN YOUR LIMITS"
        title="Usage & billing"
        text="Your current balance, subscription, and limits from your workspace account."
      />
      <div className="usage-overview">
        <section className="credit-panel">
          <div className="row-between">
            <span className="eyebrow">MESTHI CREDITS</span>
            <span className="pill">{entitlements.plan.name}</span>
          </div>
          <strong>
            {entitlements.availableCredits.toLocaleString()}
            <span>available</span>
          </strong>
          <p>Subscription: {entitlements.subscriptionStatus}</p>
          <small>Balance reported by your account.</small>
        </section>
        <section className="panel budget-panel">
          <div className="panel-heading">
            <h2>Plan limits</h2>
            <Icon name="ShieldCheck" />
          </div>
          <dl>
            {Object.entries(entitlements.plan.limits).map(([key, value]) => (
              <div className="limit-row" key={key}>
                <dt>{limitLabel(key)}</dt>
                <dd>{limitValue(value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      </div>
      <section className="panel settings-card">
        <h2>Available plans</h2>
        {loading && <p>Loading plans…</p>}
        {error && (
          <div role="alert">
            <p>{error}</p>
            <button className="button secondary" onClick={() => setAttempt((a) => a + 1)}>
              Retry plans
            </button>
          </div>
        )}
        <div className="plan-comparison">
          {plans.map((plan) => (
            <div key={plan.id}>
              <span className="eyebrow">{plan.code}</span>
              <h2>{plan.name}</h2>
              <p>
                {new Intl.NumberFormat(undefined, {
                  style: 'currency',
                  currency: plan.currency,
                }).format(plan.price_monthly_cents / 100)}{' '}
                / month
              </p>
              <ul>
                {Object.entries(plan.features)
                  .filter(([, enabled]) => enabled)
                  .map(([name]) => (
                    <li key={name}>{limitLabel(name)}</li>
                  ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="inline-note">
          Contact your administrator to change the subscription. Self-service checkout is not
          enabled.
        </p>
      </section>
    </>
  )
}
export function SettingsPage({
  theme,
  onTheme,
  onLogout,
}: {
  theme: string
  onTheme: () => void
  onLogout: () => void
}) {
  const { workspace, activeId, accountName, writable, command, lastSynced } = useWorkspace()
  const [name, setName] = useState(workspace?.name ?? ''),
    [description, setDescription] = useState(workspace?.description ?? ''),
    [deleting, setDeleting] = useState(false)
  useEffect(() => {
    setName(workspace?.name ?? '')
    setDescription(workspace?.description ?? '')
  }, [workspace?.id, workspace?.name, workspace?.description])
  async function save(e: FormEvent) {
    e.preventDefault()
    await command({ type: 'update-workspace', workspaceId: activeId, name, description })
  }
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Settings"
        text="Your account and workspace preferences."
      />
      <div className="settings-layout">
        <section className="panel settings-card">
          <div className="settings-heading">
            <Icon name="Layers" />
            <h2>Workspace</h2>
          </div>
          {workspace ? (
            <form className="stack gap-4" onSubmit={save}>
              <Field label="Workspace name">
                <input
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
              <button className="button primary" disabled={!writable || !name.trim()}>
                Save workspace
              </button>
            </form>
          ) : (
            <p>Create a workspace to manage your team.</p>
          )}
        </section>
        <section className="panel settings-card">
          <div className="settings-heading">
            <Icon name="ShieldCheck" />
            <h2>Your account</h2>
          </div>
          <p>{accountName}</p>
          <p>
            {lastSynced
              ? 'Last synced: ' + new Date(lastSynced).toLocaleString()
              : 'Waiting for synchronization'}
          </p>
          <div className="stack gap-4">
            <button className="button secondary" onClick={onTheme}>
              <Icon name={theme === 'dark' ? 'Sun' : 'Moon'} />
              Switch to {theme === 'dark' ? 'light' : 'dark'}
            </button>
            <button className="button secondary" onClick={onLogout}>
              Sign out
            </button>
          </div>
        </section>
        <section className="panel settings-card">
          <div className="settings-heading">
            <Icon name="Plug" />
            <h2>Additional services</h2>
          </div>
          <p>
            File uploads, custom characters, scheduled workflows, external publishing, and checkout
            are not enabled in this release.
          </p>
          <p>Your administrator must connect these services before they can be used.</p>
          <a
            className="text-button"
            href="https://github.com/arumora-id/ai.mesthi.com/blob/main/docs/PRODUCTION_READINESS.md"
            target="_blank"
            rel="noreferrer"
          >
            Administrator setup guide
            <Icon name="ExternalLink" />
          </a>
        </section>
        {workspace && (
          <section className="panel settings-card">
            <h2>Delete workspace</h2>
            <p>
              Remove this workspace and its associated resources according to the server's retention
              policy.
            </p>
            <button
              className="button secondary danger-text"
              disabled={!writable}
              onClick={() => setDeleting(true)}
            >
              Delete workspace
            </button>
          </section>
        )}
      </div>
      {deleting && workspace && (
        <ConfirmAction
          title="Delete workspace"
          name={workspace.name}
          destructive
          description="This operation cannot be undone from this interface. Review the workspace before continuing."
          onClose={() => setDeleting(false)}
          onConfirm={async () => {
            if (await command({ type: 'delete-workspace', workspaceId: activeId }))
              setDeleting(false)
          }}
        />
      )}
    </>
  )
}
