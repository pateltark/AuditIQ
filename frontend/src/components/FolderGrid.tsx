import { reportNameFor } from '../lib'
import type { FolderName, Folders } from '../types'
import { IconButton } from './ui'

const META: Record<FolderName, { label: string; hint: string; tone: string }> = {
  inbox: { label: 'Inbox', hint: 'Held while an audit runs', tone: 'bg-slate-100 text-slate-700' },
  processed: { label: 'Processed', hint: 'Passed the audit', tone: 'bg-emerald-50 text-emerald-700' },
  flagged: { label: 'Flagged', hint: 'Needs your review', tone: 'bg-amber-50 text-amber-700' },
  reports: { label: 'Reports', hint: 'Extracted JSON', tone: 'bg-brand-50 text-brand-700' },
}
const icon = 'h-4 w-4'

interface Props {
  folders: Folders
  refreshing: boolean
  onRefresh: () => void
  onOpenReport: (reportName: string, title: string) => void
  onOpenPdf: (folder: FolderName, name: string) => void
  onDelete: (folder: FolderName, name: string) => void
}

export function FolderGrid({ folders, refreshing, onRefresh, onOpenReport, onOpenPdf, onDelete }: Props) {
  return (
    <section>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold">Folders</h2>
        <button onClick={onRefresh} className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-900">
          <svg className={`${icon} ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h5M20 20v-5h-5M5.6 15A8 8 0 0018.4 9" /></svg>
          Refresh
        </button>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {(Object.keys(META) as FolderName[]).map((key) => {
          const { label, hint, tone } = META[key]
          const files = folders[key]
          return (
            <div key={key} className="flex flex-col rounded-xl border border-slate-200">
              <div className="flex items-center justify-between border-b border-slate-100 p-4">
                <div>
                  <h3 className="text-sm font-semibold">{label}</h3>
                  <p className="text-xs text-slate-500">{hint}</p>
                </div>
                <span className={`rounded-md px-2.5 py-1 text-lg font-semibold tabular-nums ${tone}`}>{files.length}</span>
              </div>
              <ul className="max-h-72 overflow-y-auto p-2">
                {files.length === 0 && <li className="px-3 py-6 text-center text-sm text-slate-400">Nothing here yet</li>}
                {files.map((name) => (
                  <li key={name} className="flex items-center gap-0.5 rounded-md hover:bg-slate-50">
                    <button disabled={key === 'inbox'} title={key === 'inbox' ? name : 'View audit report'}
                      onClick={() => onOpenReport(key === 'reports' ? name : reportNameFor(name), name)}
                      className="min-w-0 flex-1 truncate px-3 py-2 text-left text-sm enabled:cursor-pointer disabled:cursor-default">{name}</button>
                    {key !== 'reports' && (
                      <IconButton label="Open PDF" onClick={() => onOpenPdf(key, name)}>
                        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
                      </IconButton>
                    )}
                    {key !== 'inbox' && (
                      <IconButton label="Delete" danger onClick={() => onDelete(key, name)}>
                        <svg className={icon} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a1 1 0 01-1 1H8a1 1 0 01-1-1V7" /></svg>
                      </IconButton>
                    )}
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
