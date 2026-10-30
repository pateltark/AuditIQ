import { useEffect, useState } from 'react'

interface Props {
  baseUrl: string
  onBaseUrl: (v: string) => void
  demo: boolean
  onDemo: (v: boolean) => void
  online: boolean | null
}

export function Header({ baseUrl, onBaseUrl, demo, onDemo, online }: Props) {
  const [draft, setDraft] = useState(baseUrl)
  useEffect(() => setDraft(baseUrl), [baseUrl])

  const [tone, dot, label] = demo
    ? ['border-violet-200 bg-violet-50 text-violet-700', 'bg-violet-500', 'Demo mode']
    : online === null
      ? ['border-slate-200 bg-slate-50 text-slate-600', 'bg-slate-400', 'Checking…']
      : online
        ? ['border-emerald-200 bg-emerald-50 text-emerald-700', 'bg-emerald-500', 'API online']
        : ['border-red-200 bg-red-50 text-red-700', 'bg-red-500', 'API offline']

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">ReconFlow</h1>
            <p className="text-xs leading-tight text-slate-500">Cleaning invoice auditing</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="hidden sm:inline">Backend</span>
            <input
              value={draft} spellCheck={false} onChange={(e) => setDraft(e.target.value)}
              onBlur={() => draft !== baseUrl && onBaseUrl(draft)}
              onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
              className="w-56 rounded-md border border-slate-300 px-2.5 py-1.5 font-mono text-sm focus:border-brand-600 focus:outline-none"
            />
          </label>
          <div role="status" className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${tone}`}>
            <span className="relative flex h-2 w-2">
              {online && !demo && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />}
              <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
            </span>
            {label}
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-600">
            Demo mode
            <button type="button" role="switch" aria-checked={demo} onClick={() => onDemo(!demo)}
              className={`relative h-6 w-11 rounded-full transition-colors ${demo ? 'bg-violet-600' : 'bg-slate-300'}`}>
              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${demo ? 'translate-x-5' : ''}`} />
            </button>
          </label>
        </div>
      </div>
    </header>
  )
}
