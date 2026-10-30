import type { Api, Folders, Report } from '../types'
import { reportNameFor, sleep } from '../lib'

function mockReport(file: string, flagged: boolean): Report {
  const items = [
    { description: 'Standard turnover clean', date: '2026-10-04', amount: 120 },
    { description: 'Linen and laundry', date: '2026-10-04', amount: 35 },
    { description: 'Restock supplies', date: '2026-10-04', amount: 18 },
  ]
  const discrepancies: Report['discrepancies'] = []
  if (flagged) {
    items.push({ description: 'Deep clean', date: '2026-10-11', amount: 85 })
    discrepancies.push({ description: 'Deep clean', date: '2026-10-11', reason: 'Service date has no checkout in the booking calendar' })
  }
  return {
    file_name: file,
    processed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
    status: flagged ? 'FLAGGED' : 'PASSED',
    invoice: {
      invoice_number: `INV-${1000 + Math.floor(Math.random() * 9000)}`,
      vendor_name: 'SparkleCrew Cleaning Co.',
      invoice_date: '2026-10-12',
      currency: 'USD',
      line_items: items,
      total_amount: items.reduce((t, i) => t + i.amount, 0),
    },
    discrepancies,
  }
}

/** In-memory fake backend with the same shapes as the real API, for previewing without a server. */
export function createDemoApi(): Api {
  const folders: Folders = { inbox: [], processed: [], flagged: [], reports: [] }
  const reports = new Map<string, Report>()

  const store = (file: string, flagged: boolean) => {
    const name = reportNameFor(file)
    ;(flagged ? folders.flagged : folders.processed).unshift(file)
    folders.reports.unshift(name)
    reports.set(name, mockReport(file, flagged))
  }
  const seed: [string, boolean][] = [['invoice_sep_wk4.pdf', false], ['invoice_oct_wk1.pdf', false], ['invoice_oct_wk2.pdf', true]]
  seed.forEach(([file, flagged]) => store(file, flagged))

  return {
    health: () => sleep(250),
    saveConfig: async () => {
      await sleep(300)
      return { status: 'success', message: 'Updated calendar config', active_dates_count: 12 + Math.floor(Math.random() * 20) }
    },
    audit: async (file) => {
      folders.inbox.unshift(file.name)
      await sleep(1500 + Math.random() * 1500)
      folders.inbox = folders.inbox.filter((n) => n !== file.name)
      const flagged = Math.random() < 0.35
      store(file.name, flagged)
      return flagged ? 'flagged' : 'passed'
    },
    folders: async () => structuredClone(folders),
    report: async (name) => {
      const r = reports.get(name)
      if (!r) throw new Error(`Report file '${name}' not found.`)
      return r
    },
  }
}
