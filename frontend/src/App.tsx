import { useCallback, useEffect, useState } from 'react'
import { FolderGrid } from './components/FolderGrid'
import { Header } from './components/Header'
import { IcalForm } from './components/IcalForm'
import { ReportModal } from './components/ReportModal'
import { UploadQueue } from './components/UploadQueue'
import { Toasts } from './components/ui'
import { useBackend } from './hooks'
import type { Folders, Toast } from './types'

const EMPTY: Folders = { inbox: [], processed: [], flagged: [], reports: [] }

export default function App() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [folders, setFolders] = useState<Folders>(EMPTY)
  const [refreshing, setRefreshing] = useState(false)
  const [open, setOpen] = useState<{ name: string; title: string } | null>(null)

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500)
  }, [])

  const { api, baseUrl, setBaseUrl, demo, setDemo, online } = useBackend(() => toast('Backend not reachable. Showing demo mode.'))

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { setFolders(await api.folders()) } catch { /* health pill already shows the outage */ }
    setRefreshing(false)
  }, [api])

  useEffect(() => {
    refresh()
    const t = setInterval(refresh, 5000)
    return () => clearInterval(t)
  }, [refresh])

  const closeModal = useCallback(() => setOpen(null), [])

  return (
    <>
      <Header baseUrl={baseUrl} onBaseUrl={setBaseUrl} demo={demo} onDemo={setDemo} online={online} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <IcalForm key={`ical-${demo}`} api={api} toast={toast} />
          <UploadQueue key={`queue-${demo}`} api={api} onProcessed={refresh} toast={toast} />
        </div>
        <FolderGrid folders={folders} refreshing={refreshing} onRefresh={refresh} onOpen={(name, title) => setOpen({ name, title })} />
      </main>
      {open && <ReportModal api={api} name={open.name} title={open.title} onClose={closeModal} />}
      <Toasts toasts={toasts} />
    </>
  )
}
