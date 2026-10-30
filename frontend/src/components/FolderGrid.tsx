import { reportNameFor } from '../lib'
import type { FolderName, Folders } from '../types'

const META: Record<FolderName, { label: string; hint: string; tone: string }> = {
  inbox: { label: 'Inbox', hint: 'Held while an audit runs', tone: 'bg-slate-100 text-slate-700' },
  processed: { label: 'Processed', hint: 'Passed the audit', tone: 'bg-emerald-50 text-emerald-700' },
  flagged: { label: 'Flagged', hint: 'Needs your review', tone: 'bg-amber-50 text-amber-700' },
  reports: { label: 'Reports', hint: 'Extracted JSON', tone: 'bg-brand-50 text-brand-700' },
}

interface Props {
  folders: Folders
  refreshing: boolean
  onRefresh: () => void
  onOpen: (reportName: string, title: string) => void
}

export function FolderGrid({ folders, refreshing, onRefresh, onOpen }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Folders</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <svg className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0018.4 9" /></svg>
          Refresh
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(META) as FolderName[]).map((key) => {
          const { label, hint, tone } = META[key]
          const files = folders[key]
          const clickable = key !== 'inbox'
          return (
            <div key={key} className="flex flex-col rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
                <span className={`rounded-md px-2.5 py-1 text-lg font-semibold tabular-nums ${tone}`}>{files.length}</span>
              </div>
              <ul className="max-h-64 overflow-y-auto p-2">
                {files.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nothing here yet</li>}
                {files.map((name) => (
                  <li key={name}>
                    <button disabled={!clickable} onClick={() => onOpen(key === 'reports' ? name : reportNameFor(name), name)}
                      className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-left ${clickable ? 'hover:bg-slate-50' : 'cursor-default'}`}>
                      <span className="min-w-0 flex-1 truncate text-sm">{name}</span>
                      {clickable && <svg className="h-4 w-4 shrink-0 text-slate-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )
        })}
      </div>
    </section>
  )
}
