import { useCallback, useEffect, useState } from 'react'
import { api } from './api'
import { FolderGrid } from './components/FolderGrid'
import { Header } from './components/Header'
import { IcalForm } from './components/IcalForm'
import { ReportModal } from './components/ReportModal'
import { UploadQueue } from './components/UploadQueue'
import { ConfirmDialog, Toasts } from './components/ui'
import { useHealth } from './hooks'
import type { FolderName, Folders, Toast } from './types'

const EMPTY: Folders = { inbox: [], processed: [], flagged: [], reports: [] }
type Target = { folder: FolderName; name: string }

export default function App() {
  const online = useHealth()
  const [toasts, setToasts] = useState<Toast[]>([])
  const [folders, setFolders] = useState<Folders>(EMPTY)
  const [refreshing, setRefreshing] = useState(false)
  const [report, setReport] = useState<{ name: string; title: string } | null>(null)
  const [target, setTarget] = useState<Target | null>(null)
  const [deleting, setDeleting] = useState(false)

  const toast = useCallback((msg: string, kind: Toast['kind'] = 'info') => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, msg, kind }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4000)
  }, [])

  const refresh = useCallback(async () => {
    setRefreshing(true)
    try { setFolders(await api.folders()) } catch { /* the health pill already shows an outage */ }
    setRefreshing(false)
  }, [])

  useEffect(() => {
    refresh()
    const t = setInterval(() => { if (!document.hidden) refresh() }, 5000)
    return () => clearInterval(t)
  }, [refresh])

  const openPdf = useCallback((folder: FolderName, name: string) => {
    api.openFile(folder, name).catch((e: Error) => toast(e.message, 'error'))
  }, [toast])

  const confirmDelete = async () => {
    if (!target) return
    setDeleting(true)
    try {
      const gone = await api.deleteFile(target.folder, target.name)
      toast(`Deleted ${gone.join(' and ')}`, 'ok')
      if (report && gone.includes(report.name)) setReport(null)
      setTarget(null)
      refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setDeleting(false)
    }
  }

  const closeReport = useCallback(() => setReport(null), [])
  const cancelDelete = useCallback(() => setTarget(null), [])

  return (
    <>
      <Header online={online} />
      <main className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6">
        <div className="grid gap-6 lg:grid-cols-5">
          <IcalForm api={api} toast={toast} />
          <UploadQueue api={api} onProcessed={refresh} toast={toast} />
        </div>
        <FolderGrid folders={folders} refreshing={refreshing} onRefresh={refresh}
          onOpenReport={(name, title) => setReport({ name, title })} onOpenPdf={openPdf}
          onDelete={(folder, name) => setTarget({ folder, name })} />
      </main>

      {report && <ReportModal api={api} name={report.name} title={report.title} onClose={closeReport} onOpenPdf={openPdf} />}
      {target && (
        <ConfirmDialog
          title={`Delete ${target.name}?`}
          message={target.folder === 'reports' ? 'This deletes the report only. The invoice PDF is kept.' : 'This deletes the invoice PDF and its audit report. It cannot be undone.'}
          confirmLabel="Delete" busy={deleting} onConfirm={confirmDelete} onCancel={cancelDelete} />
      )}
      <Toasts toasts={toasts} />
    </>
  )
}
