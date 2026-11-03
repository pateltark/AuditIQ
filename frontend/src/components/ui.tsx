import { useEffect, type ReactNode } from 'react'
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

export function IconButton({ label, danger, onClick, children }: { label: string; danger?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" title={label} aria-label={label} onClick={onClick}
      className={`shrink-0 rounded-md p-1.5 text-slate-400 transition-colors ${danger ? 'hover:bg-red-50 hover:text-red-600' : 'hover:bg-slate-100 hover:text-slate-700'}`}>
      {children}
    </button>
  )
}

interface ConfirmProps { title: string; message: string; confirmLabel: string; busy: boolean; onConfirm: () => void; onCancel: () => void }

export function ConfirmDialog({ title, message, confirmLabel, busy, onConfirm, onCancel }: ConfirmProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel()
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [busy, onCancel])

  return (
    <div className="fixed inset-0 z-50 grid place-items-center p-4" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={() => !busy && onCancel()} />
      <div className="relative w-full max-w-sm rounded-xl border border-slate-200 bg-white p-5 shadow-xl">
        <h3 id="confirm-title" className="text-base font-semibold">{title}</h3>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button onClick={onCancel} disabled={busy} className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 disabled:opacity-60">Cancel</button>
          <button onClick={onConfirm} disabled={busy} className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60">{busy ? 'Deleting…' : confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
