import { useRef, useState } from 'react'
import { fmtSize } from '../lib'
import type { Api, QueueItem, Toast } from '../types'
import { Badge } from './ui'

interface Props { api: Api; onProcessed: () => void; toast: (msg: string, kind?: Toast['kind']) => void }

export function UploadQueue({ api, onProcessed, toast }: Props) {
  const [items, setItems] = useState<QueueItem[]>([])
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const nextId = useRef(0)
  const pending = items.filter((i) => i.status === 'pending').length

  const patch = (id: number, p: Partial<QueueItem>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)))

  const add = (files: FileList | null) => {
    if (!files) return
    const pdfs = Array.from(files).filter((f) => /\.pdf$/i.test(f.name))
    if (pdfs.length < files.length) toast('Only PDF files were added', 'error')
    setItems((xs) => [...xs, ...pdfs.map((file) => ({ id: ++nextId.current, file, status: 'pending' as const }))])
  }

  const processAll = async () => {
    setBusy(true)
    let flagged = 0
    for (const item of items.filter((i) => i.status === 'pending')) {
      patch(item.id, { status: 'processing', error: undefined })
      setTimeout(onProcessed, 700) // the file sits in Inbox while the audit runs
      try {
        const status = await api.audit(item.file)
        if (status === 'flagged') flagged++
        patch(item.id, { status })
      } catch (e) {
        patch(item.id, { status: 'error', error: (e as Error).message })
      }
      onProcessed()
    }
    setBusy(false)
    toast(flagged ? `Batch finished: ${flagged} invoice${flagged > 1 ? 's' : ''} flagged for review` : 'Batch finished with no flags', flagged ? 'info' : 'ok')
  }

  return (
    <section className="flex flex-col rounded-xl border border-slate-200 p-5 lg:col-span-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold">Upload invoices</h2>
          <p className="mt-1 text-sm text-slate-500">Add one or more PDF invoices, then audit them in one batch.</p>
        </div>
        <button onClick={() => setItems((xs) => xs.filter((i) => i.status === 'pending' || i.status === 'processing'))}
          className="text-sm text-slate-500 hover:text-slate-800 hover:underline">Clear finished</button>
      </div>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); add(e.dataTransfer.files) }}
        className={`mt-4 flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 text-center transition-colors hover:border-brand-600 ${dragging ? 'border-brand-600 bg-brand-50' : 'border-slate-300 bg-slate-50'}`}>
        <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
        <p className="mt-2 text-sm"><span className="font-medium text-brand-700">Choose PDFs</span> or drop them here</p>
        <p className="mt-0.5 text-xs text-slate-500">PDF only, multiple files supported</p>
        <input type="file" accept="application/pdf,.pdf" multiple className="sr-only" onChange={(e) => { add(e.target.files); e.target.value = '' }} />
      </label>

      <ul className="mt-4 flex-1 space-y-2">
        {items.length === 0 && <li className="py-3 text-center text-sm text-slate-400">No invoices in the queue yet.</li>}
        {items.map((i) => (
          <li key={i.id} className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2">
            <svg className="h-5 w-5 shrink-0 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M7 3h7l5 5v13H7V3zm7 0v5h5" /></svg>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{i.file.name}</p>
              <p className="text-xs text-slate-500">{fmtSize(i.file.size)}{i.error && <> · <span className="text-red-600">{i.error}</span></>}</p>
            </div>
            <Badge status={i.status} />
            {i.status === 'pending' && (
              <button onClick={() => setItems((xs) => xs.filter((x) => x.id !== i.id))} aria-label={`Remove ${i.file.name}`} className="text-slate-400 hover:text-slate-700">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
              </button>
            )}
          </li>
        ))}
      </ul>

      <div className="mt-4 flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{items.length > 0 && `${pending} of ${items.length} waiting to be processed`}</p>
        <button onClick={processAll} disabled={!pending || busy}
          className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-400">
          {busy ? 'Processing…' : 'Process all invoices'}
        </button>
      </div>
    </section>
  )
}
