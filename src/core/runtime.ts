import { create } from 'zustand'
import { reduceCommand, seed } from './demo'
import { executeC4Command, loadC4Snapshot } from './c4Adapter'
import { pages, snapshotSchema, type Command, type Page, type Snapshot } from './domain'
export const mode = import.meta.env.VITE_DATA_MODE === 'api' ? 'api' : 'demo'
const storageKey = 'mesthi:demo:v1'
const empty: Snapshot = {
  version: 1,
  workspaces: [],
  agents: [],
  runs: [],
  workflows: [],
  artifacts: [],
  knowledge: [],
  connections: [],
  ledger: [],
}
function localSnapshot() {
  try {
    const raw = localStorage.getItem(storageKey)
    if (!raw) return { data: seed(), error: '' }
    const parsed = snapshotSchema.safeParse(JSON.parse(raw))
    return parsed.success
      ? { data: parsed.data, error: '' }
      : { data: seed(), error: 'Saved demo data was incompatible. A fresh demo was loaded.' }
  } catch {
    return {
      data: seed(),
      error: 'Local storage is unavailable. Changes may not survive a reload.',
    }
  }
}
let epoch = 0
const initial = mode === 'demo' ? localSnapshot() : { data: empty, error: '' }
const initialPage = pages.includes(location.hash.slice(1) as Page)
  ? (location.hash.slice(1) as Page)
  : 'overview'
interface Store {
  data: Snapshot
  activeId: string
  page: Page
  busy: boolean
  ready: boolean
  error: string
  notice: string
  navigate: (page: Page) => void
  selectWorkspace: (id: string) => void
  command: (cmd: Command) => Promise<boolean>
  refresh: () => Promise<void>
  notify: (text: string) => void
  clearMessage: () => void
}
export const useApp = create<Store>((set, get) => ({
  data: initial.data,
  activeId: initial.data.workspaces[0]?.id ?? '',
  page: initialPage,
  busy: false,
  ready: mode === 'demo',
  error: initial.error,
  notice: '',
  navigate: (page) => {
    if (location.hash !== '#' + page) history.pushState(null, '', '#' + page)
    set({ page })
  },
  selectWorkspace: (id) => {
    if (get().data.workspaces.some((w) => w.id === id)) {
      set({ activeId: id, page: 'overview' })
      history.pushState(null, '', '#overview')
    }
  },
  notify: (notice) => set({ notice, error: '' }),
  clearMessage: () => set({ notice: '', error: '' }),
  command: async (cmd) => {
    if (get().busy) return false
    set({ busy: true, error: '' })
    ++epoch
    let submitted = false
    try {
      let data: Snapshot
      const oldIds = new Set(get().data.workspaces.map((w) => w.id))
      if (mode === 'demo') {
        data = reduceCommand(get().data, cmd)
        localStorage.setItem(storageKey, JSON.stringify(data))
      } else {
        await executeC4Command(cmd)
        submitted = true
        data = snapshotSchema.parse(await loadC4Snapshot())
      }
      const nextId =
        cmd.type === 'create-workspace'
          ? data.workspaces.find((w) => !oldIds.has(w.id))?.id
          : undefined
      set({ data, ...(nextId ? { activeId: nextId, page: 'overview' as Page } : {}) })
      return true
    } catch (e) {
      set({
        error:
          (submitted
            ? 'The operation was accepted, but refreshing failed. Refresh before repeating the action. '
            : '') + (e instanceof Error ? e.message : 'The action could not be completed.'),
      })
      return submitted
    } finally {
      set({ busy: false })
    }
  },
  refresh: async () => {
    if (mode === 'demo' || get().busy) return
    const currentEpoch = ++epoch
    try {
      const data = snapshotSchema.parse(await loadC4Snapshot())
      if (epoch !== currentEpoch) return
      set({
        data,
        activeId: data.workspaces.some((w) => w.id === get().activeId)
          ? get().activeId
          : (data.workspaces[0]?.id ?? ''),
        ready: true,
        error: '',
      })
    } catch (e) {
      if (epoch === currentEpoch)
        set({ ready: true, error: e instanceof Error ? e.message : 'Unable to load workspace.' })
    }
  },
}))
export function useWorkspace() {
  const s = useApp(),
    { data, activeId } = s
  return {
    ...s,
    workspace: data.workspaces.find((w) => w.id === activeId),
    agents: data.agents.filter((a) => a.workspaceId === activeId),
    runs: data.runs.filter((r) => r.workspaceId === activeId),
    workflows: data.workflows.filter((w) => w.workspaceId === activeId),
    artifacts: data.artifacts.filter((a) => a.workspaceId === activeId),
    knowledge: data.knowledge.filter((k) => k.workspaceId === activeId),
    connections: data.connections.filter((c) => c.workspaceId === activeId),
  }
}
