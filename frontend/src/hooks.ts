import { useEffect, useState } from 'react'
import { api } from './api'

/** Polls the API root every 10 s; `null` until the first answer. */
export function useHealth() {
  const [online, setOnline] = useState<boolean | null>(null)
  useEffect(() => {
    let stopped = false
    const check = async () => {
      try { await api.health(); if (!stopped) setOnline(true) } catch { if (!stopped) setOnline(false) }
    }
    check()
    const t = setInterval(check, 10_000)
    return () => { stopped = true; clearInterval(t) }
  }, [])
  return online
}
