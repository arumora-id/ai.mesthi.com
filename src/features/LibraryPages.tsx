import { useState } from 'react'
import { useWorkspace } from '../core/runtime'
import { Empty, Icon, PageHeading, Status, downloadText } from '../components/ui'
export function ArtifactsPage({ onOpen }: { onOpen: (id: string) => void }) {
  const { runs } = useWorkspace(),
    [query, setQuery] = useState('')
  const results = runs.filter(
    (r) => r.resultSummary && r.title.toLowerCase().includes(query.toLowerCase()),
  )
  return (
    <>
      <PageHeading
        eyebrow="IDEAS, BROUGHT TO LIFE"
        title="Task results"
        text="Read and download result summaries returned by your agents."
      />
      <div className="page-tools">
        <div className="search-field">
          <Icon name="Search" />
          <input
            aria-label="Search results"
            placeholder="Find a result…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
      </div>
      <div className="artifact-grid">
        {results.map((r) => (
          <section className="panel artifact-card" key={r.id}>
            <div className="row-between">
              <Icon name="FileText" size={25} />
              <Status status={r.status} />
            </div>
            <h2>{r.title}</h2>
            <p>{r.resultSummary!.slice(0, 160)}</p>
            <small>{new Date(r.updatedAt).toLocaleString()}</small>
            <div className="row gap-3">
              <button className="button secondary" onClick={() => onOpen(r.id)}>
                Read result
              </button>
              <button
                className="icon-button"
                aria-label={'Download ' + r.title}
                onClick={() => downloadText(r.title + '.md', r.resultSummary!)}
              >
                <Icon name="Download" />
              </button>
            </div>
          </section>
        ))}
      </div>
      {!results.length && (
        <Empty
          title="Your results will land here"
          text="When an agent returns a result summary, you can read it and download it from this workspace."
        />
      )}
    </>
  )
}
