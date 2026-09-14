import { useWorkspace } from '../core/runtime'
import { Avatar, Icon, PageHeading, shortTime } from '../components/ui'
import { RunTable } from './Runs'
import OfficeView from '../game/OfficeView'
export function Overview({
  onNew,
  onOpen,
  onAgent,
}: {
  onNew: () => void
  onOpen: (id: string) => void
  onAgent: (id: string) => void
}) {
  const { agents, runs, entitlements, navigate, writable } = useWorkspace()
  const metrics = [
    {
      title: 'Active agents',
      value: agents.filter((a) => a.state === 'working').length,
      detail: agents.length + ' in your workforce',
      icon: 'Bot',
      color: 'green',
      page: 'agents' as const,
    },
    {
      title: 'Tasks in motion',
      value: runs.filter((r) => ['running', 'delivering'].includes(r.status)).length,
      detail: 'Currently executing or delivering',
      icon: 'Activity',
      color: 'blue',
      page: 'runs' as const,
    },
    {
      title: 'Tasks queued',
      value: runs.filter((r) => r.status === 'queued').length,
      detail: 'Ready for the next step',
      icon: 'Clock3',
      color: 'amber',
      page: 'runs' as const,
    },
    {
      title: 'Tasks completed',
      value: runs.filter((r) => r.status === 'completed').length,
      detail: 'Completion confirmed by the server',
      icon: 'CheckCheck',
      color: 'purple',
      page: 'artifacts' as const,
    },
  ]
  const failed = runs.filter((r) => r.status === 'failed')
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE SPACE. BIG POSSIBILITIES."
        title="Mission control"
        text="A clear view of your team, and a little room for your next big idea."
        action={
          <button disabled={!writable} className="button primary" onClick={onNew}>
            <Icon name="Plus" />
            New task
          </button>
        }
      />
      <div className="overview-hero">
        <div className="hero-copy">
          <span className="pill">
            <span className="live-dot" />
            YOUR WORKFORCE, CONNECTED
          </span>
          <h2>
            Great work.
            <br />
            In good company<span>.</span>
          </h2>
          <p>Turn your next “what if” into something real. Your AI team is right here with you.</p>
          <button disabled={!writable} className="button ink" onClick={onNew}>
            Give your team a mission
            <Icon name="ArrowUpRight" />
          </button>
          <div className="hero-team">
            <div className="avatar-stack">
              {agents.slice(0, 4).map((a) => (
                <Avatar agent={a} key={a.id} small />
              ))}
            </div>
            <span>
              {agents.length
                ? agents.length + ' minds. One shared workspace.'
                : 'Build a team that works your way.'}
            </span>
          </div>
        </div>
        <div className="hero-office">
          <div className="office-topline">
            <span>
              <i className="live-dot" />
              THE LIVE OFFICE
            </span>
            <button onClick={() => navigate('office')} aria-label="Open full live office">
              <Icon name="Maximize2" size={15} />
            </button>
          </div>
          <OfficeView agents={agents} onAgent={(a) => onAgent(a.id)} onNavigate={navigate} />
          <div className="office-bottomline">
            <span>
              <Icon name="Coffee" size={14} />A place for every kind of work
            </span>
            <button onClick={() => navigate('office')}>
              Step inside
              <Icon name="ArrowRight" size={14} />
            </button>
          </div>
        </div>
      </div>
      <div className="metrics-grid">
        {metrics.map((m) => (
          <button className="metric" key={m.title} onClick={() => navigate(m.page)}>
            <div className="row-between">
              <span>{m.title}</span>
              <span className={'metric-icon ' + m.color}>
                <Icon name={m.icon} size={17} />
              </span>
            </div>
            <strong data-metric-value={m.value}>{m.value.toString().padStart(2, '0')}</strong>
            <small>
              {m.detail}
              <Icon name="ArrowUpRight" size={13} />
            </small>
          </button>
        ))}
      </div>
      <div className="overview-bottom">
        <section className="panel">
          <div className="panel-heading">
            <div className="row gap-2">
              <h2>On your team's desk</h2>
              <span className="count-badge">{runs.length}</span>
            </div>
            <button className="text-button" onClick={() => navigate('runs')}>
              View all tasks
              <Icon name="ArrowRight" size={14} />
            </button>
          </div>
          <RunTable runs={runs.slice(0, 5)} onOpen={onOpen} />
        </section>
        <aside className="stack gap-4">
          <section className="panel attention-panel">
            <div className="panel-heading">
              <h2>A moment of your time</h2>
              <Icon name="ShieldCheck" />
            </div>
            <div className="attention-body">
              {failed.length ? (
                <>
                  <span className="review-label">TASK NEEDS ATTENTION</span>
                  <h3>{failed[0].title}</h3>
                  <p>Review the server's error details before attempting further work.</p>
                  <button className="button secondary" onClick={() => onOpen(failed[0].id)}>
                    Review task
                  </button>
                </>
              ) : (
                <>
                  <Icon name="CheckCheck" size={26} />
                  <h3>A clear view of your work.</h3>
                  <p>
                    {runs.length ? 'No failed tasks in this workspace.' : 'Create a task to begin.'}
                  </p>
                </>
              )}
            </div>
          </section>
          <section className="panel pulse-panel">
            <div className="panel-heading">
              <h2>Workspace pulse</h2>
              <span className="live-dot" />
            </div>
            <div className="pulse-list">
              {runs.slice(0, 3).map((r) => (
                <button key={r.id} onClick={() => onOpen(r.id)}>
                  <i />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.backendStatus + ' · ' + shortTime(r.updatedAt)}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="pulse-footer">
              <Icon name="Coins" size={15} />
              <span>
                {entitlements
                  ? entitlements.availableCredits.toLocaleString() + ' credits available'
                  : 'Balance unavailable'}
              </span>
            </div>
          </section>
        </aside>
      </div>
    </>
  )
}
