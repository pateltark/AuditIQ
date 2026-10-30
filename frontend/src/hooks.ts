import { useEffect, useMemo, useRef, useState } from 'react'
import { createDemoApi } from './api/demo'
import { createLiveApi } from './api/live'
import type { Api } from './types'

const demoApi = createDemoApi()

/** Owns the backend URL, demo-mode switch and health polling. Falls back to demo if the API is down at startup. */
export function useBackend(onFallback: () => void) {
  const [baseUrl, setBaseUrl] = useState(() => localStorage.getItem('rf.base') ?? import.meta.env.VITE_API_URL ?? 'http://127.0.0.1:8000')
  const [demo, setDemo] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)
  const baseRef = useRef(baseUrl)
  baseRef.current = baseUrl
  const live = useMemo(() => createLiveApi(() => baseRef.current), [])
  const firstCheck = useRef(true)
  const fallback = useRef(onFallback)
  fallback.current = onFallback

  useEffect(() => {
    if (demo) return setOnline(true)
    let cancelled = false
    const check = async () => {
      try {
        await live.health()
        if (!cancelled) setOnline(true)
      } catch {
        if (cancelled) return
        setOnline(false)
        if (firstCheck.current) { setDemo(true); fallback.current() }
      }
      firstCheck.current = false
    }
    setOnline(null)
    check()
    const t = setInterval(check, 10_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [demo, baseUrl, live])

  const api: Api = demo ? demoApi : live
  const changeBase = (v: string) => { localStorage.setItem('rf.base', v); setBaseUrl(v) }
  return { api, baseUrl, setBaseUrl: changeBase, demo, setDemo, online }
}
