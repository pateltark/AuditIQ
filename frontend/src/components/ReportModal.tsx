import { useEffect, useState } from 'react'
import { fmtMoney, pick } from '../lib'
import type { Api, Report } from '../types'
import { Badge } from './ui'

interface Props { api: Api; name: string; title: string; onClose: () => void }
type Disc = string | Record<string, any>

const reason = (d: Disc): string => (typeof d === 'string' ? d : pick(d, ['reason', 'message', 'issue', 'detail', 'description']) ?? JSON.stringify(d))
const dDate = (d: Disc) => (typeof d === 'string' ? undefined : pick(d, ['date', 'service_date']))

export function ReportModal({ api, name, title, onClose }: Props) {
  const [report, setReport] = useState<Report | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    setReport(null); setError('')
    api.report(name).then(setReport).catch((e: Error) => setError(e.message))
  }, [api, name])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])

  const inv = report?.invoice ?? {}
  const disc = report?.discrepancies ?? []
  const items: Record<string, any>[] = pick(inv, ['line_items', 'items', 'charges']) ?? []
  const cur: string = pick(inv, ['currency', 'currency_code']) ?? 'USD'
  const flagged = !!report && (String(report.status).toUpperCase() === 'FLAGGED' || disc.length > 0)
  const flagFor = (i: Record<string, any>) =>
    disc.find((d) => typeof d !== 'string' && ((dDate(d) && dDate(d) === pick(i, ['date', 'service_date'])) || (d.description && d.description === pick(i, ['description', 'name', 'item']))))

  const Field = ({ k, v }: { k: string; v: unknown }) => (
    <div><dt className="text-xs text-slate-500">{k}</dt><dd className="mt-0.5 break-words text-sm font-medium">{String(v ?? '—')}</dd></div>
  )

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center sm:items-center sm:p-6" role="dialog" aria-modal="true" aria-labelledby="report-title">
      <div className="absolute inset-0 bg-slate-900/40" onClick={onClose} />
      <div className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-slate-200 bg-white shadow-xl sm:max-w-2xl sm:rounded-2xl">
        <div className="sticky top-0 flex items-start justify-between gap-4 border-b border-slate-100 bg-white px-6 py-4">
          <div className="min-w-0">
            <h3 id="report-title" className="truncate text-base font-semibold">{title}</h3>
            {report && <div className="mt-1"><Badge status={flagged ? 'flagged' : 'passed'} /></div>}
          </div>
          <button onClick={onClose} aria-label="Close" className="rounded-md p-1 text-slate-500 hover:bg-slate-100">
            <svg className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-5">
          {error && <p className="text-sm text-red-600">Could not load this report: {error}</p>}
          {!report && !error && <p className="text-sm text-slate-500">Loading report…</p>}
          {report && (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <Field k="Invoice" v={pick(inv, ['invoice_number', 'invoice_no', 'number'])} />
                <Field k="Vendor" v={pick(inv, ['vendor_name', 'vendor', 'supplier'])} />
                <Field k="Invoice date" v={pick(inv, ['invoice_date', 'date'])} />
                <Field k="Audited" v={report.processed_at} />
              </dl>

              <div className="flex items-baseline justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
                <div>
                  <p className="text-xs text-slate-500">Grand total</p>
                  <p className="text-2xl font-semibold tabular-nums">{fmtMoney(pick(inv, ['grand_total', 'total_amount', 'total', 'amount_due']), cur)}</p>
                </div>
                <span className="text-sm text-slate-500">{cur}</span>
              </div>

              <div>
                <h4 className="mb-2 text-sm font-semibold">Line items</h4>
                <div className="overflow-x-auto rounded-lg border border-slate-200">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-left text-xs text-slate-500">
                      <tr><th className="px-3 py-2 font-medium">Description</th><th className="px-3 py-2 font-medium">Date</th><th className="px-3 py-2 text-right font-medium">Amount</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.length === 0 && <tr><td colSpan={3} className="px-3 py-4 text-center text-slate-400">No line items in this report</td></tr>}
                      {items.map((i, idx) => {
                        const f = flagFor(i)
                        return (
                          <tr key={idx} className={f ? 'bg-amber-50/60' : ''}>
                            <td className="px-3 py-2">
                              {pick(i, ['description', 'name', 'item']) ?? '—'}
                              {f && <p className="mt-0.5 text-xs text-amber-700">{reason(f)}</p>}
                            </td>
                            <td className="whitespace-nowrap px-3 py-2 text-slate-500">{pick(i, ['date', 'service_date']) ?? '—'}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{fmtMoney(pick(i, ['amount', 'line_total', 'total', 'price']), cur)}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {disc.length > 0 ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                  <h4 className="text-sm font-semibold text-amber-800">{disc.length} discrepanc{disc.length > 1 ? 'ies' : 'y'} found</h4>
                  <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm text-amber-800">
                    {disc.map((d, idx) => <li key={idx}>{reason(d)}{dDate(d) && ` (${dDate(d)})`}</li>)}
                  </ul>
                </div>
              ) : (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">Every line item matches a checkout in the booking calendar.</div>
              )}

              <details>
                <summary className="cursor-pointer text-sm font-medium text-slate-700">Raw JSON</summary>
                <pre className="mt-2 max-h-64 overflow-auto rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs">{JSON.stringify(report, null, 2)}</pre>
              </details>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
