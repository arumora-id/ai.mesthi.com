import { useState, type FormEvent } from 'react'
import { useWorkspace } from '../core/runtime'
import { Field, Icon, PageHeading } from '../components/ui'
import { CreateRun } from './CreateDialogs'
export function ContentStudio() {
  const { writable } = useWorkspace()
  const [title, setTitle] = useState(''),
    [audience, setAudience] = useState(''),
    [format, setFormat] = useState('Storyboard'),
    [brief, setBrief] = useState(''),
    [creating, setCreating] = useState(false)
  function prepare(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
  }
  const instructions = [
    'Deliverable: ' + format,
    'Audience: ' + audience,
    'Brief:',
    brief,
    'Return a clear result summary. Do not publish externally unless an authorized delivery workflow explicitly permits it.',
  ].join('\n\n')
  return (
    <>
      <PageHeading
        eyebrow="MAKE SOMETHING WORTH SHARING"
        title="Content studio"
        text="Prepare a brief for a storyboard, script, campaign, or research task."
      />
      <section className="panel content-brief">
        <form className="stack gap-4" onSubmit={prepare}>
          <Field label="Project title">
            <input
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Give this project a name"
            />
          </Field>
          <div className="form-grid">
            <Field label="Deliverable">
              <select value={format} onChange={(e) => setFormat(e.target.value)}>
                {[
                  'Storyboard',
                  'Video script',
                  'Campaign brief',
                  'Social copy',
                  'Article',
                  'Research report',
                ].map((f) => (
                  <option key={f}>{f}</option>
                ))}
              </select>
            </Field>
            <Field label="Audience">
              <input
                required
                maxLength={1000}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
                placeholder="Who is this for?"
              />
            </Field>
          </div>
          <Field label="Creative brief">
            <textarea
              rows={9}
              required
              maxLength={90000}
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              placeholder="Describe the goal, tone, sources, length, and acceptance criteria."
            />
          </Field>
          <p className="inline-note">
            This creates a task for your configured agent. Video rendering and publishing require an
            enabled delivery service.
          </p>
          <div className="modal-actions">
            <button
              className="button primary"
              disabled={!writable || !title.trim() || !brief.trim() || !audience.trim()}
            >
              Choose agent & create task
              <Icon name="ArrowRight" />
            </button>
          </div>
        </form>
      </section>
      {creating && (
        <CreateRun initial={{ title, instructions }} onClose={() => setCreating(false)} />
      )}
    </>
  )
}
