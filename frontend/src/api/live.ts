import type { Api, Folders } from '../types'

/** Talks to the real FastAPI backend. `getBase` is read on every call so the URL can change live. */
export function createLiveApi(getBase: () => string): Api {
  async function http<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(getBase().replace(/\/+$/, '') + path, init)
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(typeof body.detail === 'string' ? body.detail : `${res.status} ${res.statusText}`)
    return body as T
  }

  return {
    health: async () => {
      await http('/')
    },
    saveConfig: (listing_name, ical_url) =>
      http('/api/calendar/config/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listing_name, ical_url }),
      }),
    audit: async (file) => {
      const fd = new FormData()
      fd.append('file', file)
      const r = await http<{ status: string }>('/audit-invoice/', { method: 'POST', body: fd })
      return String(r.status).toUpperCase() === 'FLAGGED' ? 'flagged' : 'passed'
    },
    folders: async () => {
      const r = await http<Partial<Folders>>('/api/folders/')
      return { inbox: r.inbox ?? [], processed: r.processed ?? [], flagged: r.flagged ?? [], reports: r.reports ?? [] }
    },
    report: (name) => http('/api/reports/' + encodeURIComponent(name)),
  }
}
