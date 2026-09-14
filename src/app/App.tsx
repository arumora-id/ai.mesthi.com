import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { usePageMotion } from './useMotion'
import { useApp, useWorkspace } from '../core/runtime'
import { pages, type Page } from '../core/domain'
import { signInUrl, signOutUrl } from '../core/config'
import { Empty, Icon, Logo, Modal } from '../components/ui'
import { Overview } from '../features/Overview'
import { AgentsPage, AgentDetail } from '../features/Agents'
import { RunsPage, RunDetail } from '../features/Runs'
import { OfficePage } from '../features/Workflows'
import { CreateRun, CreateWorkspace } from '../features/CreateDialogs'
import { ArtifactsPage } from '../features/LibraryPages'
import { ContentStudio } from '../features/ContentStudio'
import { SettingsPage, UsagePage } from '../features/Settings'
const navigation: { label: string; items: { page: Page; label: string; icon: string }[] }[] = [
  {
    label: 'WORKSPACE',
    items: [
      { page: 'overview', label: 'Mission control', icon: 'LayoutDashboard' },
      { page: 'runs', label: 'Tasks & runs', icon: 'ListTodo' },
      { page: 'agents', label: 'Your workforce', icon: 'Bot' },
      { page: 'office', label: 'Live office', icon: 'Coffee' },
    ],
  },
  {
    label: 'CREATE & COLLECT',
    items: [
      { page: 'content', label: 'Content studio', icon: 'Clapperboard' },
      { page: 'artifacts', label: 'Task results', icon: 'FolderOpen' },
    ],
  },
  {
    label: 'MANAGE',
    items: [
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
        <p>
          The interface encountered an unexpected error. Reload to retrieve the latest server state.
        </p>
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
    workspaces,
    workspace,
    entitlements,
    activeId,
    accountName,
    agents,
    runs,
    page,
    navigate,
    selectWorkspace,
    refresh,
    phase,
    busy,
    refreshing,
    stale,
    uncertain,
    lastSynced,
    writable,
    error,
    notice,
    clearMessage,
    clearSession,
  } = useWorkspace()
  const [mobileOpen, setMobileOpen] = useState(false),
    [newWorkspace, setNewWorkspace] = useState(false),
    [newRun, setNewRun] = useState(false),
    [runId, setRunId] = useState(''),
    [agentId, setAgentId] = useState(''),
    [search, setSearch] = useState(false),
    [query, setQuery] = useState('')
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('mesthi:theme') === 'dark' ? 'dark' : 'light'
    } catch {
      return 'light'
    }
  })
  const mainRef = useRef<HTMLElement>(null)
  const title = navItems.find((n) => n.page === page)?.label ?? 'Workspace'
  usePageMotion(mainRef, page + '-' + activeId + '-' + phase)
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem('mesthi:theme', theme)
    } catch {
      /* Appearance is optional. */
    }
  }, [theme])
  useEffect(() => {
    const handler = () => {
      const p = location.hash.slice(1) as Page
      if (pages.includes(p)) useApp.setState({ page: p })
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
    setNewRun(false)
  }, [page, activeId, title])
  useEffect(() => {
    void refresh()
    const sync = () => {
      if (!document.hidden && !['signed-out', 'forbidden'].includes(useApp.getState().phase))
        void refresh()
    }
    const timer = window.setInterval(sync, 15000)
    window.addEventListener('online', sync)
    document.addEventListener('visibilitychange', sync)
    const logout = (e: StorageEvent) => {
      if (e.key === 'mesthi:signout') clearSession()
    }
    window.addEventListener('storage', logout)
    return () => {
      clearInterval(timer)
      window.removeEventListener('online', sync)
      document.removeEventListener('visibilitychange', sync)
      window.removeEventListener('storage', logout)
    }
  }, [refresh, clearSession])
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (useApp.getState().phase === 'ready') setSearch((s) => !s)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
  useEffect(() => {
    if (notice) {
      const timer = setTimeout(clearMessage, 6500)
      return () => clearTimeout(timer)
    }
  }, [notice, clearMessage])
  function logout() {
    clearSession()
    try {
      localStorage.setItem('mesthi:signout', String(Date.now()))
    } catch {
      /* The server session still expires. */
    }
    location.assign(signOutUrl)
  }
  if (phase !== 'ready' && phase !== 'loading')
    return (
      <main className="auth-page">
        <section className="panel auth-card">
          <Logo />
          <span className="eyebrow">YOUR WORK, CONNECTED</span>
          <h1>
            {phase === 'signed-out'
              ? 'Welcome to your workspace.'
              : phase === 'forbidden'
                ? 'Workspace access is restricted.'
                : 'We could not connect.'}
          </h1>
          <p>
            {error || 'Sign in with your organization account to access your agents and tasks.'}
          </p>
          <div className="row gap-3">
            <a className="button primary" href={signInUrl}>
              Sign in
              <Icon name="ArrowRight" />
            </a>
            <button
              className="button secondary"
              disabled={refreshing}
              onClick={() => void refresh(true)}
            >
              {refreshing ? 'Connecting…' : 'Try again'}
            </button>
            {phase === 'forbidden' && (
              <button className="text-button" onClick={logout}>
                Sign out
              </button>
            )}
          </div>
          <small>Your workspace data is loaded from your account after authentication.</small>
        </section>
      </main>
    )
  const newTask = () => {
    clearMessage()
    setNewRun(true)
  }
  function content() {
    if (page === 'settings')
      return (
        <SettingsPage
          theme={theme}
          onTheme={() => setTheme(theme === 'light' ? 'dark' : 'light')}
          onLogout={logout}
        />
      )
    if (!workspace)
      return (
        <Empty
          title="Make room for your next idea"
          text="Create your first workspace, add an agent, and give it a task."
          action={
            <button
              className="button primary"
              disabled={!writable}
              onClick={() => setNewWorkspace(true)}
            >
              Create workspace
              <Icon name="Plus" />
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
      case 'office':
        return <OfficePage onAgent={setAgentId} />
      case 'content':
        return <ContentStudio />
      case 'artifacts':
        return <ArtifactsPage onOpen={setRunId} />
      case 'usage':
        return <UsagePage />
    }
  }
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
            <Icon name="Layers" size={19} />
          </span>
          <label>
            <span>YOUR WORKSPACE</span>
            <select
              aria-label="Switch workspace"
              value={activeId}
              disabled={busy || phase === 'loading'}
              onChange={(e) => selectWorkspace(e.target.value)}
            >
              {!workspaces.length && <option value="">No workspace yet</option>}
              {workspaces.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>
          </label>
          <button
            className="icon-button"
            aria-label="Create workspace"
            disabled={!writable}
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
              {entitlements?.availableCredits.toLocaleString() ?? '—'}
              <small>available</small>
            </strong>
          </button>
          <button className="profile-button" onClick={() => navigate('settings')}>
            <span>M</span>
            <div>
              <strong>{accountName || 'Your account'}</strong>
              <small>{entitlements?.plan.name ?? 'Workspace settings'}</small>
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
            <span className={'mode-badge ' + (stale ? 'is-stale' : '')}>
              <i />
              {stale ? 'Sync needed' : 'Connected'}
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
            <button
              className="icon-button theme-button"
              aria-label="Toggle color theme"
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
            >
              <Icon name={theme === 'light' ? 'Moon' : 'Sun'} size={18} />
            </button>
            <button
              className="button secondary compact"
              disabled={refreshing || busy}
              onClick={() => void refresh(true)}
            >
              {refreshing ? 'Syncing…' : 'Refresh'}
            </button>
          </div>
        </header>
        <main ref={mainRef} id="main-content" className="main-content" tabIndex={-1}>
          {(stale || uncertain) && phase === 'ready' && (
            <div className="sync-banner" role="alert">
              <Icon name="CircleHelp" />
              <span>
                {uncertain
                  ? 'An operation needs confirmation. Refresh and review the server state before continuing.'
                  : 'This view may be out of date. Refresh before making changes.'}
              </span>
            </div>
          )}
          {phase === 'loading' ? (
            <div className="loading-page">
              <Icon name="Loader2" className="spin" size={28} />
              Loading your workspace…
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
            {lastSynced
              ? 'Last synced ' + new Date(lastSynced).toLocaleTimeString()
              : 'Connecting to your workspace'}
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
      {newWorkspace && <CreateWorkspace onClose={() => setNewWorkspace(false)} />}
      {newRun && workspace && <CreateRun key={activeId} onClose={() => setNewRun(false)} />}
      {runId && <RunDetail runId={runId} onClose={() => setRunId('')} />}
      {agentId && <AgentDetail agentId={agentId} onClose={() => setAgentId('')} />}
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
