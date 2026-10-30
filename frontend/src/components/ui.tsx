import type { QueueStatus, Toast } from '../types'

const STYLES: Record<QueueStatus, string> = {
  pending: 'bg-slate-100 text-slate-600',
  processing: 'bg-blue-50 text-blue-700',
  passed: 'bg-emerald-50 text-emerald-700',
  flagged: 'bg-amber-50 text-amber-700',
  error: 'bg-red-50 text-red-700',
}

export function Badge({ status }: { status: QueueStatus }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {status === 'processing' && (
        <svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" opacity=".25" />
          <path d="M21 12a9 9 0 00-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        </svg>
      )}
      {status[0].toUpperCase() + status.slice(1)}
    </span>
  )
}

export function Toasts({ toasts }: { toasts: Toast[] }) {
  const tone = { info: 'border-slate-200 text-slate-700', ok: 'border-emerald-200 text-emerald-700', error: 'border-red-200 text-red-700' }
  return (
    <div className="fixed bottom-4 right-4 z-50 space-y-2" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`max-w-xs rounded-lg border bg-white px-4 py-2.5 text-sm shadow-lg ${tone[t.kind]}`}>{t.msg}</div>
      ))}
    </div>
  )
}
