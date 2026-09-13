import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePageMotion } from './useMotion'
import { useApp, useWorkspace, mode } from '../core/runtime'
import { hasAccessToken } from '../core/c4Adapter'
import { usage, reserved } from '../core/demo'
import { pages, type Page } from '../core/domain'
import { Empty, Icon, Logo, Modal } from '../components/ui'
import { Overview } from '../features/Overview'
import { AgentsPage, AgentDetail } from '../features/Agents'
import { RunsPage, RunDetail, ApprovalsPage } from '../features/Runs'
import { OfficePage, TemplatesPage, WorkflowsPage } from '../features/Workflows'
import { CreateRun, CreateWorkspace } from '../features/CreateDialogs'
import { ArtifactsPage, ConnectionsPage, KnowledgePage } from '../features/LibraryPages'
import { ContentStudio } from '../features/ContentStudio'
import { SettingsPage, UsagePage } from '../features/Settings'
const navigation: { label: string; items: { page: Page; label: string; icon: string }[] }[] = [
  {
    label: 'WORKSPACE',
    items: [
      { page: 'overview', label: 'Mission control', icon: 'LayoutDashboard' },
      { page: 'runs', label: 'Tasks & runs', icon: 'ListTodo' },
      { page: 'agents', label: 'Your workforce', icon: 'Bot' },
      { page: 'workflows', label: 'Workflows', icon: 'GitBranch' },
      { page: 'office', label: 'Live office', icon: 'Coffee' },
    ],
  },
  {
    label: 'CREATE & COLLECT',
    items: [
      { page: 'content', label: 'Content studio', icon: 'Clapperboard' },
      { page: 'artifacts', label: 'Outputs', icon: 'FolderOpen' },
      { page: 'knowledge', label: 'Knowledge & skills', icon: 'BookOpen' },
      { page: 'templates', label: 'Workforce packs', icon: 'Layers' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
      { page: 'approvals', label: 'Approvals', icon: 'ShieldCheck' },
      { page: 'connections', label: 'Connections', icon: 'Plug' },
      { page: 'usage', label: 'Usage & billing', icon: 'Coins' },
      { page: 'settings', label: 'Settings', icon: 'Settings2' },
    ],
  },
]
const navItems = navigation.flatMap((n) => n.items)
class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? (
      <main className="fatal-error">
        <Logo />
        <h1>Let's reopen your workspace.</h1>
        <p>The interface encountered an unexpected error. Your saved demo data has been kept.</p>
        <button className="button primary" onClick={() => location.reload()}>
          Reload workspace
        </button>
      </main>
    ) : (
      this.props.children
    )
  }
}
function WorkspaceApp() {
  const {
    data,
    workspace,
    activeId,
    agents,
    runs,
    page,
    navigate,
    selectWorkspace,
    command,
    refresh,
    ready,
    error,
    notice,
    clearMessage,
  } = useWorkspace()
  const [mobileOpen, setMobileOpen] = useState(false),
    [newWorkspace, setNewWorkspace] = useState(false),
    [newRun, setNewRun] = useState(false),
    [runId, setRunId] = useState(''),
    [agentId, setAgentId] = useState(''),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState(''),
    [help, setHelp] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mesthi:theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const mainRef = useRef<HTMLElement>(null)
  usePageMotion(mainRef, page + '-' + activeId + '-' + ready)
  const approvals = runs.filter((r) => r.status === 'awaiting_approval').length,
    title = navItems.find((n) => n.page === page)?.label ?? 'Workspace'
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('mesthi:theme', theme)
    } catch {
      /* Appearance can remain session-only. */
    }
  }, [theme])
  useEffect(() => {
    const handler = () => {
      const p = location.hash.slice(1)
      if (pages.includes(p as Page)) useApp.setState({ page: p as Page })
    }
    window.addEventListener('hashchange', handler)
    return () => window.removeEventListener('hashchange', handler)
  }, [])
  useEffect(() => {
    document.title = title + ' · MESTHI'
    setMobileOpen(false)
    window.scrollTo({ top: 0 })
    setRunId('')
    setAgentId('')
  }, [page, activeId, title])
  useEffect(() => {
    if (mode === 'api' && hasAccessToken()) void refresh()
    const timer = window.setInterval(
      () => {
        if (document.hidden) return
        if (mode === 'demo') {
          if (useApp.getState().data.runs.some((r) => r.status === 'running'))
            void command({ type: 'tick' })
        } else if (hasAccessToken()) void refresh()
      },
      mode === 'demo' ? 4500 : 15000,
    )
    return () => window.clearInterval(timer)
  }, [command, refresh])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearch((s) => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(clearMessage, 6500)
    return () => window.clearTimeout(timer)
  }, [notice, clearMessage])
  const newTask = () => {
    clearMessage()
    setNewRun(true)
  }
  function content() {
    if (!workspace && !['templates', 'settings'].includes(page))
      return (
        <Empty
          title={mode === 'api' ? 'Connect your C4 workspace' : 'Make room for something great'}
          text={
            mode === 'api'
              ? 'Connect an authorized API session in Settings. The backend remains the source of truth for execution and permissions.'
              : 'Create a workspace to get started.'
          }
          action={
            <button
              className="button primary"
              onClick={() => (mode === 'api' ? navigate('settings') : setNewWorkspace(true))}
            >
              {mode === 'api' ? 'Open settings' : 'Create workspace'}
              <Icon name="ArrowRight" />
            </button>
          }
        />
      )
    switch (page) {
      case 'overview':
        return <Overview onNew={newTask} onOpen={setRunId} onAgent={setAgentId} />
      case 'runs':
        return <RunsPage onNew={newTask} onOpen={setRunId} />
      case 'agents':
        return <AgentsPage onAgent={setAgentId} />
      case 'workflows':
        return <WorkflowsPage />
      case 'office':
        return <OfficePage onAgent={setAgentId} />
      case 'templates':
        return <TemplatesPage />
      case 'content':
        return <ContentStudio />
      case 'artifacts':
        return <ArtifactsPage />
      case 'approvals':
        return <ApprovalsPage onOpen={setRunId} />
      case 'knowledge':
        return <KnowledgePage />
      case 'connections':
        return <ConnectionsPage />
      case 'usage':
        return <UsagePage />
      case 'settings':
        return (
          <SettingsPage
            theme={theme}
            onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          />
        )
    }
  }
  const used = usage(data, activeId),
    available =
      workspace?.entitlements?.availableCredits ??
      Math.max(0, (workspace?.monthlyBudget ?? 0) - used - reserved(data, activeId))
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {mobileOpen && (
        <button
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
        />
      )}
      <aside className={'sidebar ' + (mobileOpen ? 'open' : '')}>
        <button
          className="brand-button"
          aria-label="MESTHI home"
          onClick={() => navigate('overview')}
        >
          <Logo />
        </button>
        <div className="workspace-picker">
          <span className="workspace-mark">
            <Icon name={workspace?.icon ?? 'Layers'} size={19} />
          </span>
          <label>
            <span>YOUR WORKSPACE</span>
            <select
              aria-label="Switch workspace"
              value={activeId}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {!data.workspaces.length && <option value="">Connect workspace</option>}
              {data.workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Create workspace"
            onClick={() => {
              clearMessage()
              setNewWorkspace(true)
            }}
          >
            <Icon name="Plus" size={15} />
          </button>
        </div>
        <nav aria-label="Main navigation">
          {navigation.map((group) => (
            <div className="nav-group" key={group.label}>
              <span className="nav-caption">{group.label}</span>
              {group.items.map((n) => (
                <button
                  key={n.page}
                  className={'nav-item ' + (page === n.page ? 'active' : '')}
                  aria-current={page === n.page ? 'page' : undefined}
                  onClick={() => navigate(n.page)}
                >
                  <Icon name={n.icon} size={18} />
                  <span>{n.label}</span>
                  {n.page === 'office' && <i className="nav-live" />}
                  {n.page === 'approvals' && approvals > 0 && (
                    <span className="nav-count">{approvals}</span>
                  )}
                  {n.page === 'templates' && <span className="nav-new">NEW</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <button className="sidebar-credits" onClick={() => navigate('usage')}>
            <div className="row-between">
              <span>
                <Icon name="Zap" size={14} />
                Workspace credits
              </span>
              <Icon name="ArrowUpRight" size={13} />
            </div>
            <strong>
              {workspace ? available.toLocaleString() : '—'}
              <small>{mode === 'demo' ? 'demo balance' : 'available'}</small>
            </strong>
            <div>
              <i
                style={{
                  width:
                    Math.min(100, (available / Math.max(workspace?.monthlyBudget ?? 1, 1)) * 100) +
                    '%',
                }}
              />
            </div>
          </button>
          <button className="profile-button" onClick={() => navigate('settings')}>
            <span>M</span>
            <div>
              <strong>MESTHI workspace</strong>
              <small>{mode === 'demo' ? 'Personal · Demo mode' : 'C4 API mode'}</small>
            </div>
            <Icon name="Settings2" size={16} />
          </button>
        </div>
      </aside>
      <div className="app-body">
        <header className="topbar">
          <div className="row gap-3">
            <button
              className="icon-button mobile-menu"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            >
              <Icon name="Menu" />
            </button>
            <span className="breadcrumb-workspace">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <strong>{title}</strong>
          </div>
          <div className="topbar-actions">
            <span className="mode-badge">
              <i />
              {mode === 'demo' ? 'Demo workspace' : 'C4 API'}
            </span>
            <button
              className="command-button"
              onClick={() => {
                setQuery('')
                setSearch(true)
              }}
              aria-label="Search workspace"
            >
              <Icon name="Search" size={16} />
              <span>Search anything</span>
              <kbd>⌘ K</kbd>
            </button>
            <span className="topbar-divider" />
            <button
              className="icon-button theme-button"
              aria-label="Toggle color theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <Icon name={theme === 'light' ? 'Moon' : 'Sun'} size={18} />
            </button>
            <button
              className="icon-button notification-button"
              aria-label={approvals + ' pending approvals'}
              onClick={() => navigate('approvals')}
            >
              <Icon name="Bell" size={18} />
              {approvals > 0 && <i />}
            </button>
            <button
              className="help-button"
              aria-label="Workspace help"
              onClick={() => setHelp(true)}
            >
              <Icon name="CircleHelp" size={19} />
            </button>
          </div>
        </header>
        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          {!ready && mode === 'api' && hasAccessToken() ? (
            <div className="loading-page">
              <Icon name="Loader2" className="spin" size={28} />
              Connecting your workspace…
            </div>
          ) : (
            <div key={activeId + '-' + page} className="page-enter">
              {content()}
            </div>
          )}
        </main>
        <footer className="app-footer">
          <span>MESTHI / A SPACE FOR POSSIBILITY</span>
          <span>
            <i className="live-dot" />
            {mode === 'demo'
              ? 'Demo data · No external execution'
              : 'Mesthi control plane · C4 API'}
          </span>
        </footer>
      </div>
      {(error || notice) && (
        <div className={'toast ' + (error ? 'error' : '')} role={error ? 'alert' : 'status'}>
          <Icon name={error ? 'CircleHelp' : 'Check'} />
          <span>{error || notice}</span>
          <button onClick={clearMessage} aria-label="Dismiss message">
            <Icon name="X" size={16} />
          </button>
        </div>
      )}
      {newWorkspace && <CreateWorkspace onClose={() => setNewWorkspace(false)} />}{' '}
      {newRun && workspace && <CreateRun key={activeId} onClose={() => setNewRun(false)} />}{' '}
      {runId && <RunDetail runId={runId} onClose={() => setRunId('')} />}{' '}
      {agentId && <AgentDetail agentId={agentId} onClose={() => setAgentId('')} />}{' '}
      {search && (
        <Modal title="Find your next step" onClose={() => setSearch(false)}>
          <div className="search-field command-search">
            <Icon name="Search" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search pages, agents, and tasks…"
              aria-label="Global search"
            />
          </div>
          <div className="search-results">
            {navItems
              .filter((n) => n.label.toLowerCase().includes(query.toLowerCase()))
              .map((n) => (
                <button
                  key={n.page}
                  onClick={() => {
                    navigate(n.page)
                    setSearch(false)
                  }}
                >
                  <Icon name={n.icon} />
                  <span>{n.label}</span>
                  <small>Page</small>
                </button>
              ))}
            {query &&
              agents
                .filter((a) => (a.name + ' ' + a.role).toLowerCase().includes(query.toLowerCase()))
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      setAgentId(a.id)
                      setSearch(false)
                    }}
                  >
                    <Icon name="Bot" />
                    <span>{a.name}</span>
                    <small>Agent</small>
                  </button>
                ))}
            {query &&
              runs
                .filter((r) => r.title.toLowerCase().includes(query.toLowerCase()))
                .slice(0, 8)
                .map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setRunId(r.id)
                      setSearch(false)
                    }}
                  >
                    <Icon name="FileText" />
                    <span>{r.title}</span>
                    <small>Task</small>
                  </button>
                ))}
          </div>
        </Modal>
      )}{' '}
      {help && (
        <Modal title="A workspace for your AI workforce" onClose={() => setHelp(false)}>
          <div className="detail-section">
            <p>
              Start with a workforce pack, give your team a task, and follow progress in Mission
              Control. Explore teammates in Live Office, shape stories in Content Studio, and review
              drafts in Approvals.
            </p>
            <p>
              {mode === 'demo'
                ? 'Sample data and local simulation. Inference, rendering, payments, and external delivery are not connected.'
                : 'C4 owns execution. Capabilities outside the verified API need backend extensions.'}
            </p>
            <p>
              <a
                href="https://github.com/arumora-id/ai.mesthi.com"
                target="_blank"
                rel="noreferrer"
              >
                Read the setup and architecture documentation
                <Icon name="ExternalLink" size={14} />
              </a>
            </p>
          </div>
          <div className="modal-actions">
            <button className="button primary" onClick={() => setHelp(false)}>
              Make yourself at home
              <Icon name="ArrowRight" />
            </button>
          </div>
        </Modal>
      )}
    </>
  )
}
export default function App() {
  return (
    <ErrorBoundary>
      <WorkspaceApp />
    </ErrorBoundary>
  )
}
