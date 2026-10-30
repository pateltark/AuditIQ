import { useState, type FormEvent } from 'react'
import type { Api, Toast } from '../types'

interface Listing { name: string; url: string }
interface Props { api: Api; toast: (msg: string, kind?: Toast['kind']) => void }

const input = 'w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-600 focus:outline-none'

export function IcalForm({ api, toast }: Props) {
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [listings, setListings] = useState<Listing[]>([])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    try {
      const res = await api.saveConfig(name.trim(), url.trim())
      setListings((l) => [{ name: name.trim(), url: url.trim() }, ...l.filter((x) => x.name !== name.trim())])
      toast(`${name.trim()} saved. ${res.active_dates_count} booked dates loaded.`, 'ok')
      setName(''); setUrl('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="rounded-xl border border-slate-200 p-5 lg:col-span-2">
      <h2 className="text-base font-semibold">Listing calendar</h2>
      <p className="mt-1 text-sm text-slate-500">Checkout dates from the Airbnb iCal feed are matched against each invoice.</p>
      <form onSubmit={submit} className="mt-4 space-y-4">
        <div>
          <label htmlFor="listing" className="mb-1 block text-sm font-medium">Listing name</label>
          <input id="listing" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Harbor View Loft" className={input} />
        </div>
        <div>
          <label htmlFor="ical" className="mb-1 block text-sm font-medium">Airbnb iCal URL</label>
          <input id="ical" type="url" required value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://www.airbnb.com/calendar/ical/…" className={`${input} font-mono`} />
        </div>
        <div className="flex items-center gap-3">
          <button disabled={saving} className="rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-800 disabled:opacity-60">
            {saving ? 'Saving…' : 'Save listing'}
          </button>
          {error && <span className="text-sm text-red-600">{error}</span>}
        </div>
      </form>
      {listings.length > 0 && (
        <ul className="mt-5 divide-y divide-slate-100 border-t border-slate-100 text-sm">
          {listings.map((l) => (
            <li key={l.name} className="flex items-center justify-between gap-3 py-2.5">
              <span className="truncate font-medium">{l.name}</span>
              <span className="max-w-[55%] truncate font-mono text-xs text-slate-500" title={l.url}>{l.url.replace(/^https?:\/\//, '')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
