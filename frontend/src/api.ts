import type { Api, FolderName, Folders } from './types'

/** Dev: talks to uvicorn directly. Production: same-origin unless VITE_API_URL is set. */
const BASE = String(import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? 'http://127.0.0.1:8000' : '')).replace(/\/+$/, '')
/** Optional shared secret, sent as X-API-Key (backend enforces it when RECONFLOW_API_KEY is set). */
const KEY: string | undefined = import.meta.env.VITE_API_KEY || undefined

async function request(path: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers)
  if (KEY) headers.set('X-API-Key', KEY)
  let res: Response
  try {
    res = await fetch(BASE + path, { ...init, headers })
  } catch {
    throw new Error('Cannot reach the server. Check your connection and try again.')
  }
  if (!res.ok) {
    const body = await res.clone().json().catch(() => ({}))
    throw new Error(typeof body.detail === 'string' ? body.detail : `Request failed (${res.status})`)
  }
  return res
}
const json = async <T>(path: string, init?: RequestInit): Promise<T> => (await request(path, init)).json()
const filePath = (folder: FolderName, name: string) => `/api/files/${folder}/${encodeURIComponent(name)}`

export const api: Api = {
  health: async () => {
    await request('/')
  },
  saveConfig: (listing_name, ical_url) =>
    json('/api/calendar/config/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ listing_name, ical_url }),
    }),
  audit: async (file) => {
    const fd = new FormData()
    fd.append('file', file)
    const r = await json<{ status: string }>('/audit-invoice/', { method: 'POST', body: fd })
    return String(r.status).toUpperCase() === 'FLAGGED' ? 'flagged' : 'passed'
  },
  folders: async () => {
    const r = await json<Partial<Folders>>('/api/folders/')
    return { inbox: r.inbox ?? [], processed: r.processed ?? [], flagged: r.flagged ?? [], reports: r.reports ?? [] }
  },
  report: (name) => json(`/api/reports/${encodeURIComponent(name)}`),

  /** Opens the PDF in a new tab. The tab is opened synchronously (inside the click) so popup blockers allow it. */
  openFile: async (folder, name) => {
    const tab = window.open('', '_blank')
    try {
      const blob = await (await request(filePath(folder, name))).blob()
      const url = URL.createObjectURL(blob)
      if (tab) tab.location.href = url
      else Object.assign(document.createElement('a'), { href: url, download: name }).click()
      setTimeout(() => URL.revokeObjectURL(url), 60_000)
    } catch (e) {
      tab?.close()
      throw e
    }
  },
  deleteFile: async (folder, name) => (await json<{ deleted: string[] }>(filePath(folder, name), { method: 'DELETE' })).deleted,
}
