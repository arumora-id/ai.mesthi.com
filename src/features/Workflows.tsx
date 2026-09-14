import { useState } from 'react'
import { useWorkspace } from '../core/runtime'
import { Avatar, Empty, Icon, PageHeading } from '../components/ui'
import OfficeView from '../game/OfficeView'
export function OfficePage({ onAgent }: { onAgent: (id: string) => void }) {
  const { agents, navigate } = useWorkspace()
  const [motion, setMotion] = useState(true)
  return (
    <>
      <PageHeading
        eyebrow="A PLACE FOR YOUR TEAM"
        title="Live office"
        text="Your agents and their current task status, together in one space."
        action={
          <button
            className="button secondary"
            aria-pressed={!motion}
            onClick={() => setMotion(!motion)}
          >
            <Icon name={motion ? 'Pause' : 'Play'} />
            {motion ? 'Pause animation' : 'Resume animation'}
          </button>
        }
      />
      <section className="panel full-office">
        <OfficeView
          agents={agents}
          onAgent={(a) => onAgent(a.id)}
          onNavigate={navigate}
          motion={motion}
        />
      </section>
      <p className="page-footnote">
        Status follows your workspace. Movement is decorative and does not start or complete tasks.
      </p>
      <div className="office-roster">
        {agents.map((a) => (
          <button key={a.id} className="panel" onClick={() => onAgent(a.id)}>
            <Avatar agent={a} small />
            <span>
              <strong>{a.name}</strong>
              <small>{a.role}</small>
            </span>
            <span className={'agent-state ' + a.state}>
              <i />
              {a.state}
            </span>
          </button>
        ))}
      </div>
      {!agents.length && (
        <Empty
          title="Your office is ready"
          text="Create your first agent to bring this space to life."
          action={
            <button className="button primary" onClick={() => navigate('agents')}>
              Create your team
            </button>
          }
        />
      )}
    </>
  )
}
