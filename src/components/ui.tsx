import {
  Children,
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  type ReactNode,
  type CSSProperties,
} from 'react'
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Box,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Code2,
  Coffee,
  Coins,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  GitBranch,
  Globe,
  Image,
  Layers,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Maximize2,
  Menu,
  MessageCircle,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Telescope,
  Upload,
  WandSparkles,
  X,
  Zap,
} from 'lucide-react'
import { animateDialog } from '../app/useMotion'
import { useApp } from '../core/runtime'
import type { Agent, RunStatus } from '../core/domain'
const icons = {
  Activity,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Bot,
  Box,
  Check,
  CheckCheck,
  ChevronRight,
  CircleHelp,
  Clapperboard,
  Clock3,
  Code2,
  Coffee,
  Coins,
  Download,
  ExternalLink,
  FileText,
  Film,
  FolderOpen,
  GitBranch,
  Globe,
  Image,
  Layers,
  LayoutDashboard,
  ListTodo,
  Loader2,
  Maximize2,
  Menu,
  MessageCircle,
  Moon,
  Music2,
  Pause,
  Play,
  Plus,
  Plug,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Sun,
  Telescope,
  Upload,
  WandSparkles,
  X,
  Zap,
}
export function Icon({
  name,
  size = 18,
  className = '',
}: {
  name: string
  size?: number
  className?: string
}) {
  const C = icons[name as keyof typeof icons] || Box
  return <C size={size} strokeWidth={1.7} className={className} aria-hidden="true" />
}
export function Logo() {
  return (
    <span className="logo">
      <img src="/favicon.svg" alt="" width="31" height="31" />
      <span>
        mesthi<span className="logo-period">.</span>
      </span>
      <small>AI</small>
    </span>
  )
}
export function Avatar({ agent, small = false }: { agent: Agent; small?: boolean }) {
  const style = { '--avatar-color': agent.color } as CSSProperties
  return (
    <span className={'avatar ' + (small ? 'small' : '')} style={style} aria-label={agent.name}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M7 3h10v3h3v9h-3v3h-2v3H9v-3H7v-3H4V6h3z" fill="currentColor" />
        <path d="M7 7h10v7H7z" fill="#f3ebd6" />
        <path d="M8 9h2v3H8zm6 0h2v3h-2zM9 17h6v4H9z" fill="#263a33" />
      </svg>
    </span>
  )
}
export const statusLabel: Record<RunStatus, string> = {
  draft: 'Draft',
  queued: 'Queued',
  running: 'In progress',
  delivering: 'Delivering',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
  failed: 'Failed',
  unknown: 'Unknown',
}
export function Status({ status }: { status: RunStatus }) {
  return (
    <span className={'status status-' + status}>
      <i />
      {statusLabel[status]}
    </span>
  )
}
export function Empty({
  title,
  text,
  action,
}: {
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name="Layers" size={27} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  )
}
export function PageHeading({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow?: string
  title: string
  text: string
  action?: ReactNode
}) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <span className="eyebrow">{eyebrow}</span>}
        <h1>
          {title}
          <span className="heading-dot">.</span>
        </h1>
        <p>{text}</p>
      </div>
      {action}
    </div>
  )
}
export function Modal({
  title,
  description,
  children,
  onClose,
  wide = false,
}: {
  title: string
  description?: string
  children: ReactNode
  onClose: () => void
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null),
    titleId = useRef('dialog-' + crypto.randomUUID()).current
  const error = useApp((s) => s.error)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    d.showModal()
    const cleanup = animateDialog(d)
    return () => {
      cleanup()
      d.close()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      className={'modal ' + (wide ? 'wide' : '')}
      aria-labelledby={titleId}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-content">
        <header className="row-between">
          <h2 id={titleId}>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close dialog">
            <Icon name="X" />
          </button>
        </header>
        {description && <p className="modal-description">{description}</p>}
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {children}
      </div>
    </dialog>
  )
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string
  children: ReactNode
  hint?: string
}) {
  const controlId = useId()
  const hintId = controlId + '-hint'
  return (
    <div className="field">
      <label htmlFor={controlId}>{label}</label>
      {Children.map(children, (child) =>
        isValidElement<{ id?: string; 'aria-describedby'?: string }>(child) &&
        typeof child.type === 'string' &&
        ['input', 'textarea', 'select'].includes(child.type)
          ? cloneElement(child, {
              id: controlId,
              'aria-describedby':
                [child.props['aria-describedby'], hint ? hintId : ''].filter(Boolean).join(' ') ||
                undefined,
            })
          : child,
      )}
      {hint && <small id={hintId}>{hint}</small>}
    </div>
  )
}
export function downloadText(name: string, text: string) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/markdown;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = name.replace(/[/\\:*?"<>|]/g, '-')
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 500)
}
export function shortTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
