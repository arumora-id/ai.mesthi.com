import { useState } from 'react'
import { useWorkspace } from '../core/runtime'
import type { Run } from '../core/domain'
import { Empty, Icon, Modal, PageHeading, Status, downloadText } from '../components/ui'
import { ConfirmAction, CreateRun } from './CreateDialogs'
export function RunTable({ runs, onOpen }: { runs: Run[]; onOpen: (id: string) => void }) {
  return runs.length ? (
    <div className="table-scroll">
      <table className="run-table">
        <thead>
          <tr>
            <th>Task</th>
            <th>Agent</th>
            <th>Status</th>
            <th>Updated</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.id}>
              <td>
                <button className="task-title" onClick={() => onOpen(r.id)}>
                  {r.title}
                </button>
                <small className="muted">{r.priority}</small>
              </td>
              <td>{r.agentName || 'Unassigned'}</td>
              <td>
                <Status status={r.status} />
              </td>
              <td>{new Date(r.updatedAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  ) : (
    <Empty title="A clear desk" text="Tasks will appear here when you create them." />
  )
}
export function RunsPage({ onNew, onOpen }: { onNew: () => void; onOpen: (id: string) => void }) {
  const { runs, writable } = useWorkspace()
  const [query, setQuery] = useState(''),
    [status, setStatus] = useState('all'),
    [view, setView] = useState('list')
  const filtered = runs.filter(
    (r) =>
      (r.title + ' ' + r.agentName).toLowerCase().includes(query.toLowerCase()) &&
      (status === 'all' || r.status === status),
  )
  return (
    <>
      <PageHeading
        eyebrow="FROM AN IDEA TO AN OUTCOME"
        title="Tasks & runs"
        text="Create, queue, and start work. Follow the status reported by your team."
        action={
          <button disabled={!writable} className="button primary" onClick={onNew}>
            <Icon name="Plus" />
            New task
          </button>
        }
      />
      <div className="page-tools">
        <div className="search-field">
          <Icon name="Search" />
          <input
            aria-label="Search tasks"
            placeholder="Find a task…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Filter task status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="all">All statuses</option>
          {[
            'draft',
            'queued',
            'running',
            'delivering',
            'completed',
            'failed',
            'cancelled',
            'paused',
            'unknown',
          ].map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <div className="segmented">
          <button aria-pressed={view === 'list'} onClick={() => setView('list')}>
            List
          </button>
          <button aria-pressed={view === 'board'} onClick={() => setView('board')}>
            Board
          </button>
        </div>
      </div>
      {view === 'list' ? (
        <section className="panel">
          <RunTable runs={filtered} onOpen={onOpen} />
        </section>
      ) : (
        <div className="production-board">
          {[
            'draft',
            'queued',
            'running',
            'delivering',
            'completed',
            'failed',
            'cancelled',
            'paused',
            'unknown',
          ]
            .filter((s) => filtered.some((r) => r.status === s))
            .map((s) => (
              <section className="board-column" key={s}>
                <h2>{s.replaceAll('_', ' ')}</h2>
                {filtered
                  .filter((r) => r.status === s)
                  .map((r) => (
                    <button className="panel board-task" key={r.id} onClick={() => onOpen(r.id)}>
                      <strong>{r.title}</strong>
                      <span>{r.agentName}</span>
                      <Status status={r.status} />
                    </button>
                  ))}
              </section>
            ))}
        </div>
      )}
    </>
  )
}
export function RunDetail({ runId, onClose }: { runId: string; onClose: () => void }) {
  const { runs, activeId, command, writable } = useWorkspace()
  const [action, setAction] = useState<'queue' | 'start' | 'cancel' | 'delete' | ''>(''),
    [editing, setEditing] = useState(false)
  const r = runs.find((run) => run.id === runId)
  if (!r) return null
  if (editing) return <CreateRun task={r} onClose={() => setEditing(false)} />
  if (action) {
    const titles = {
      queue: 'Queue task',
      start: 'Start task',
      cancel: 'Cancel task',
      delete: 'Delete task',
    }
    const explanations = {
      queue: 'Add this task to the backend queue.',
      start:
        'Start actual execution using the configured agent, model, tools, and repository. Workspace limits and provider usage apply.',
      cancel:
        'Ask the backend to cancel this task. Already completed external actions cannot be reversed here.',
      delete: 'Permanently remove this task record according to backend retention rules.',
    }
    return (
      <ConfirmAction
        title={titles[action]}
        name={r.title}
        description={explanations[action]}
        destructive={action === 'delete'}
        onClose={() => setAction('')}
        onConfirm={async () => {
          if (
            await command(
              action === 'delete'
                ? { type: 'delete-run', workspaceId: activeId, runId }
                : { type: 'run-action', workspaceId: activeId, runId, action },
            )
          ) {
            setAction('')
            if (action === 'delete') onClose()
          }
        }}
      />
    )
  }
  const editable = r.status === 'draft',
    removable = ['draft', 'completed', 'cancelled', 'failed'].includes(r.status)
  return (
    <Modal title={r.title} onClose={onClose}>
      <div className="row-between">
        <Status status={r.status} />
        <span className="muted">{r.priority} priority</span>
      </div>
      <dl className="detail-grid">
        <dt>Agent</dt>
        <dd>{r.agentName || 'Unassigned'}</dd>
        <dt>Task ID</dt>
        <dd>
          <code>{r.id}</code>
        </dd>
        <dt>Server status</dt>
        <dd>{r.backendStatus}</dd>
        <dt>Repository</dt>
        <dd>{r.repository ?? 'None'}</dd>
        <dt>Branch</dt>
        <dd>{r.branchName ?? 'Not assigned'}</dd>
        <dt>Started</dt>
        <dd>{r.startedAt ? new Date(r.startedAt).toLocaleString() : 'Not started'}</dd>
        <dt>Completed</dt>
        <dd>{r.completedAt ? new Date(r.completedAt).toLocaleString() : 'Not completed'}</dd>
      </dl>
      <h3>Instructions</h3>
      <pre className="result-text">{r.brief}</pre>
      {r.errorMessage && (
        <div className="form-error" role="alert">
          {r.errorMessage}
        </div>
      )}
      {r.resultSummary && (
        <>
          <div className="row-between">
            <h3>Result from your agent</h3>
            <button
              className="text-button"
              onClick={() => downloadText(r.title + '.md', r.resultSummary!)}
            >
              <Icon name="Download" />
              Download
            </button>
          </div>
          <pre className="result-text">{r.resultSummary}</pre>
        </>
      )}
      <div className="modal-actions wrap">
        {removable && (
          <button
            disabled={!writable}
            className="text-button danger-text"
            onClick={() => setAction('delete')}
          >
            Delete task
          </button>
        )}
        {editable && (
          <button
            disabled={!writable}
            className="button secondary"
            onClick={() => setEditing(true)}
          >
            Edit task
          </button>
        )}
        {editable && (
          <button
            disabled={!writable}
            className="button primary"
            onClick={() => setAction('queue')}
          >
            Queue task
          </button>
        )}
        {r.status === 'queued' && (
          <button
            disabled={!writable}
            className="button primary"
            onClick={() => setAction('start')}
          >
            <Icon name="Play" />
            Start task
          </button>
        )}
        {['draft', 'queued', 'running', 'delivering'].includes(r.status) && (
          <button
            disabled={!writable}
            className="button secondary"
            onClick={() => setAction('cancel')}
          >
            Cancel task
          </button>
        )}
        <button className="button secondary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  )
}
