export type FolderName = 'inbox' | 'processed' | 'flagged' | 'reports'
export type Folders = Record<FolderName, string[]>
export type AuditStatus = 'passed' | 'flagged'
export type QueueStatus = 'pending' | 'processing' | AuditStatus | 'error'

export interface QueueItem {
  id: number
  file: File
  status: QueueStatus
  error?: string
}

/** Mirrors the JSON written by POST /audit-invoice/ into reports/. `invoice` comes from
 *  invoice_data.model_dump() in engine.py, so it is typed loosely until the model is pinned down. */
export interface Report {
  file_name: string
  processed_at: string
  status: string
  invoice: Record<string, any>
  discrepancies: (string | Record<string, any>)[]
}

export interface ConfigResult {
  status: string
  message: string
  active_dates_count: number
}

export interface Api {
  health(): Promise<void>
  saveConfig(listingName: string, icalUrl: string): Promise<ConfigResult>
  audit(file: File): Promise<AuditStatus>
  folders(): Promise<Folders>
  report(name: string): Promise<Report>
}

export interface Toast {
  id: number
  msg: string
  kind: 'info' | 'ok' | 'error'
}
