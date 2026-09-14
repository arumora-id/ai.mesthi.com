import { create } from 'zustand'
import {
  ApiError,
  executeC4Command,
  loadC4Snapshot,
  loadIdentity,
  loadWorkspaces,
} from './c4Adapter'
import { pages, type Command, type Page, type Snapshot, type Workspace } from './domain'
export const emptySnapshot = (): Snapshot => ({ agents: [], runs: [], entitlements: null })
type Phase = 'loading' | 'ready' | 'signed-out' | 'forbidden' | 'offline'
interface Store {
  workspaces: Workspace[]
  data: Snapshot
  activeId: string
  accountName: string
  page: Page
  phase: Phase
  busy: boolean
  refreshing: boolean
  error: string
  notice: string
  stale: boolean
  uncertain: boolean
  lastSynced: string | null
  navigate: (page: Page) => void
  selectWorkspace: (id: string) => void
  command: (cmd: Command) => Promise<boolean>
  refresh: (manual?: boolean) => Promise<void>
  notify: (text: string) => void
  clearMessage: () => void
  clearSession: () => void
}
let epoch = 0
let refreshController: AbortController | undefined
const initialPage = pages.includes(location.hash.slice(1) as Page)
  ? (location.hash.slice(1) as Page)
  : 'overview'
// Remove obsolete business data. Only appearance preferences persist.
try {
  localStorage.removeItem('mesthi:demo:v1')
} catch {
  /* Storage is optional. */
}
export const useApp = create<Store>((set, get) => ({
  workspaces: [],
  data: emptySnapshot(),
  activeId: '',
  accountName: '',
  page: initialPage,
  phase: 'loading',
  busy: false,
  refreshing: false,
  error: '',
  notice: '',
  stale: true,
  uncertain: false,
  lastSynced: null,
  navigate: (page) => {
    if (!pages.includes(page)) return
    if (location.hash !== '#' + page) history.pushState(null, '', '#' + page)
    set({ page })
  },
  selectWorkspace: (id) => {
    if (get().busy || id === get().activeId || !get().workspaces.some((w) => w.id === id)) return
    ++epoch
    refreshController?.abort()
    set({
      activeId: id,
      data: emptySnapshot(),
      phase: 'loading',
      stale: true,
      lastSynced: null,
      error: '',
      notice: '',
      page: 'overview',
      refreshing: false,
    })
    history.pushState(null, '', '#overview')
    void get().refresh()
  },
  notify: (notice) => set({ notice }),
  clearMessage: () => set({ notice: '', error: '' }),
  clearSession: () => {
    ++epoch
    refreshController?.abort()
    set({
      workspaces: [],
      data: emptySnapshot(),
      activeId: '',
      accountName: '',
      phase: 'signed-out',
      error: '',
      notice: '',
      stale: true,
      busy: false,
      refreshing: false,
      lastSynced: null,
      uncertain: false,
    })
  },
  refresh: async (manual = false) => {
    if (get().busy || (get().refreshing && !manual)) return
    refreshController?.abort()
    const controller = new AbortController()
    refreshController = controller
    const current = ++epoch
    set({ refreshing: true })
    try {
      const accountName = await loadIdentity(controller.signal)
      const workspaces = await loadWorkspaces(controller.signal)
      const activeId = workspaces.some((w) => w.id === get().activeId)
        ? get().activeId
        : (workspaces[0]?.id ?? '')
      const data = activeId ? await loadC4Snapshot(activeId, controller.signal) : emptySnapshot()
      if (epoch !== current) return
      set({
        accountName,
        workspaces,
        activeId,
        data,
        phase: 'ready',
        stale: false,
        error: '',
        lastSynced: new Date().toISOString(),
        ...(manual ? { uncertain: false } : {}),
      })
    } catch (error) {
      if (epoch !== current || controller.signal.aborted) return
      const message = error instanceof Error ? error.message : 'Unable to load your workspace.'
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        get().clearSession()
        set({ phase: error.status === 401 ? 'signed-out' : 'forbidden', error: message })
      } else set({ stale: true, phase: get().lastSynced ? 'ready' : 'offline', error: message })
    } finally {
      if (epoch === current) set({ refreshing: false })
    }
  },
  command: async (cmd) => {
    if (get().busy || get().stale || get().uncertain || get().phase !== 'ready') return false
    if ('workspaceId' in cmd && cmd.workspaceId !== get().activeId) {
      set({ error: 'Select this workspace before changing it.' })
      return false
    }
    refreshController?.abort()
    const current = ++epoch
    set({ busy: true, refreshing: false, error: '', notice: '' })
    try {
      const createdId = await executeC4Command(cmd)
      if (epoch !== current) return false
      if (createdId) set({ activeId: createdId, page: 'overview' })
      set({ busy: false, stale: true })
      await get().refresh()
      if (get().stale)
        set({
          uncertain: true,
          error:
            'The server accepted the operation, but the updated data could not be loaded. Refresh and review the result before repeating it.',
        })
      else set({ notice: 'Changes saved by the server.' })
      return true
    } catch (error) {
      if (epoch !== current) return false
      if (error instanceof ApiError && [401, 403].includes(error.status)) {
        get().clearSession()
        set({ phase: error.status === 401 ? 'signed-out' : 'forbidden', error: error.message })
      } else
        set({
          error: error instanceof Error ? error.message : 'The operation could not be completed.',
          uncertain: error instanceof ApiError && error.uncertain,
          stale:
            error instanceof ApiError && (error.uncertain || [404, 409].includes(error.status)),
        })
      return false
    } finally {
      if (epoch === current) set({ busy: false })
    }
  },
}))
export function useWorkspace() {
  const s = useApp()
  return {
    ...s,
    workspace: s.workspaces.find((w) => w.id === s.activeId),
    agents: s.data.agents,
    runs: s.data.runs,
    entitlements: s.data.entitlements,
    writable: s.phase === 'ready' && !s.busy && !s.stale && !s.uncertain,
  }
}
