import { useWorkspace, mode } from '../core/runtime'
import { usage } from '../core/demo'
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
  const { data, activeId, agents, runs, artifacts, navigate } = useWorkspace(),
    approvals = runs.filter((r) => r.status === 'awaiting_approval')
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
      detail: 'Ideas becoming outcomes',
      icon: 'Activity',
      color: 'blue',
      page: 'runs' as const,
    },
    {
      title: 'Needs your eyes',
      value: mode === 'api' ? null : approvals.length,
      detail: mode === 'api' ? 'Approval extension needed' : 'Waiting for approval',
      icon: 'ShieldCheck',
      color: 'amber',
      page: 'approvals' as const,
    },
    {
      title: 'Work delivered',
      value: runs.filter((r) => r.status === 'completed').length,
      detail: mode === 'api' ? 'Backend completion status' : artifacts.length + ' outputs ready',
      icon: 'CheckCheck',
      color: 'purple',
      page: 'artifacts' as const,
    },
  ]
  return (
    <>
      <PageHeading
        eyebrow="A LITTLE SPACE. BIG POSSIBILITIES."
        title="Mission control"
        text="A clear view of your team, and a little room for your next big idea."
        action={
          <button className="button primary" onClick={onNew}>
            <Icon name="Plus" size={17} />
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
          <button className="button ink" onClick={onNew}>
            Give your team a mission
            <Icon name="ArrowUpRight" size={17} />
          </button>
          <div className="hero-team">
            <div className="avatar-stack">
              {agents.slice(0, 4).map((a) => (
                <Avatar key={a.id} agent={a} small />
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
            <strong data-metric-value={m.value === null ? undefined : m.value}>
              {m.value === null ? '—' : m.value.toString().padStart(2, '0')}
            </strong>
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
              <Icon name="ShieldCheck" size={18} />
            </div>
            {approvals.length ? (
              approvals.slice(0, 1).map((r) => (
                <div className="attention-body" key={r.id}>
                  <span className="review-label">READY FOR REVIEW</span>
                  <h3>{r.title}</h3>
                  <p>Your team has prepared a draft. Take a look before the next step.</p>
                  <button className="button secondary" onClick={() => onOpen(r.id)}>
                    Review draft
                    <Icon name="ArrowUpRight" size={15} />
                  </button>
                </div>
              ))
            ) : (
              <div className="attention-body">
                <Icon name="CheckCheck" size={26} />
                <h3>{mode === 'api' ? 'Your control plane.' : 'All caught up.'}</h3>
                <p>
                  {mode === 'api'
                    ? 'Task status comes from the C4 API. General approvals need a backend extension.'
                    : 'Your team will let you know when a decision needs you.'}
                </p>
              </div>
            )}
          </section>
          <section className="panel pulse-panel">
            <div className="panel-heading">
              <h2>Workspace pulse</h2>
              <span className="live-dot" />
            </div>
            <div className="pulse-list">
              {runs.slice(0, 3).map((r) => (
                <button onClick={() => onOpen(r.id)} key={r.id}>
                  <i />
                  <span>
                    <strong>{r.title}</strong>
                    <small>{r.status.replaceAll('_', ' ') + ' · ' + shortTime(r.updatedAt)}</small>
                  </span>
                </button>
              ))}
            </div>
            <div className="pulse-footer">
              <Icon name="Coins" size={15} />
              <span>
                {mode === 'demo'
                  ? usage(data, activeId) + ' credits used this month'
                  : 'Billing balance available in Usage'}
              </span>
            </div>
          </section>
        </aside>
      </div>
      <div className="workspace-bottom-note">
        <Icon name="Sparkles" size={15} />
        Made for the way you work. Built to grow with your ideas.
        <button onClick={() => navigate('templates')}>
          Explore workforce packs
          <Icon name="ArrowRight" size={13} />
        </button>
      </div>
    </>
  )
}
