import { Component, lazy, Suspense, type ReactNode } from 'react'
import type { Agent, Page } from '../core/domain'

const OfficeCanvas = lazy(() => import('./OfficeCanvas'))
type Props = {
  agents: Agent[]
  onAgent: (agent: Agent) => void
  onNavigate: (page: Page) => void
  motion?: boolean
}

class OfficeBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  render() {
    return this.state.failed ? (
      <div className="office-fallback" role="status">
        The office could not open. Your team, tasks, and workspace navigation remain available.
      </div>
    ) : (
      this.props.children
    )
  }
}

export default function OfficeView(props: Props) {
  return (
    <OfficeBoundary>
      <Suspense fallback={<div className="office-loading">Opening your office…</div>}>
        <OfficeCanvas {...props} />
      </Suspense>
    </OfficeBoundary>
  )
}
