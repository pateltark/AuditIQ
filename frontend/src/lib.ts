export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))
export const stemOf = (name: string) => name.replace(/\.pdf$/i, '')
/** The API writes reports as `<pdf stem>_report.json`. */
export const reportNameFor = (pdf: string) => `${stemOf(pdf)}_report.json`

/** First non-empty value among several possible key names. */
export const pick = (o: Record<string, any> | null | undefined, keys: string[]): any => {
  for (const k of keys) if (o?.[k] != null && o[k] !== '') return o[k]
  return undefined
}

export const fmtSize = (b: number) =>
  b > 1_048_576 ? `${(b / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`

export const fmtMoney = (v: unknown, currency = 'USD') => {
  const n = Number(v)
  if (v == null || v === '' || Number.isNaN(n)) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(n)
  } catch {
    return `${currency} ${n.toFixed(2)}`
  }
}
