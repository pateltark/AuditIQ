export function Header({ online }: { online: boolean | null }) {
  const [tone, dot, label] =
    online === null ? ['border-slate-200 bg-slate-50 text-slate-600', 'bg-slate-400', 'Connecting…']
    : online ? ['border-emerald-200 bg-emerald-50 text-emerald-700', 'bg-emerald-500', 'API online']
    : ['border-red-200 bg-red-50 text-red-700', 'bg-red-500', 'API offline']

  return (
    <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-lg bg-brand-700 text-white">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight">ReconFlow</h1>
            <p className="text-xs leading-tight text-slate-500">Cleaning invoice auditing</p>
          </div>
        </div>
        <div role="status" className={`flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${tone}`}>
          <span className="relative flex h-2 w-2">
            {online && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${dot}`} />}
            <span className={`relative inline-flex h-2 w-2 rounded-full ${dot}`} />
          </span>
          {label}
        </div>
      </div>
    </header>
  )
}
