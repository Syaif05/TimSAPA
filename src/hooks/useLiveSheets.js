import { useCallback, useEffect, useState, useRef } from 'react'
import { jakartaDate } from '../utils/sheetsConfig'
const load = (storage, key, fallback) => { try { return storage.getItem(key) ?? fallback } catch { return fallback } }
export function useLiveSheets({ storage = localStorage, active = true, forceEnabled = false } = {}) {
  const [storedEnabled, setEnabled] = useState(() => load(storage, 'sapa_sheets_enabled', 'true') === 'true')
  const enabled = forceEnabled || storedEnabled
  const [mode, setMode] = useState(() => load(storage, 'sapa_sheets_mode', 'daily') === 'daily' ? 'daily' : 'linked')
  const [today, setToday] = useState(jakartaDate)
  const [retry, setRetry] = useState(0)
  const [state, setState] = useState({ key: '', snapshot: null, phase: 'loading', error: '', checkedAt: null })
  const snapshots = useRef(new Map())
  const key = `${mode}:${mode === 'daily' ? today : 'linked'}`
  useEffect(() => {
    const timer = setInterval(() => setToday(jakartaDate()), 30000)
    return () => clearInterval(timer)
  }, [])
  useEffect(() => { if (!forceEnabled) { try { storage.setItem('sapa_sheets_enabled', String(enabled)); storage.setItem('sapa_sheets_mode', mode) } catch {} } }, [enabled, mode, storage, forceEnabled])
  useEffect(() => {
    if (!enabled || !active) return
    let disposed = false
    let timer
    let working = false
    let failures = 0
    let snapshot = snapshots.current.get(key) || null
    let etag = ''
    const controller = new AbortController()
    setState({ key, snapshot, phase: snapshot ? 'syncing' : 'loading', error: '', checkedAt: snapshot?.fetchedAt || null })
    const tick = async () => {
      if (working || disposed) return
      clearTimeout(timer)
      if (document.hidden) { timer = setTimeout(tick, 30000); return }
      working = true
      setState(prev => ({ ...prev, phase: snapshot ? 'syncing' : 'loading' }))
      try {
        if (!navigator.onLine) throw new Error('Anda sedang offline. Menunggu koneksi internet.')
        const params = new URLSearchParams({ mode, ...(mode === 'daily' ? { date: today } : {}) })
        const response = await fetch(`/api/sheets?${params}`, { signal: controller.signal, cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} })
        if (disposed) return
        if (response.status === 304 && snapshot) {
          setState({ key, snapshot, phase: 'live', error: '', checkedAt: response.headers.get('X-SAPA-Fetched-At') || new Date().toISOString() })
        } else {
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Layanan data aplikasi belum tersedia. Periksa konfigurasi server.')
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'Gagal membaca spreadsheet.')
          if (!Array.isArray(data.rows) || !Array.isArray(data.sources) || !data.revision) throw new Error('Respons Google Sheets tidak lengkap.')
          etag = response.headers.get('ETag') || `"${data.revision}"`
          snapshot = data
          snapshots.current.set(key, data)
          if (snapshots.current.size > 8) snapshots.current.delete(snapshots.current.keys().next().value)
          setState({ key, snapshot, phase: data.stale ? 'error' : 'live', error: data.stale ? data.error || 'Menggunakan data terakhir; pembaruan akan dicoba kembali.' : '', checkedAt: data.fetchedAt })
        }
        failures = 0
      } catch (error) {
        if (!disposed) { failures++; setState(prev => ({ ...prev, phase: 'error', error: error.message || 'Sinkronisasi gagal.' })) }
      } finally {
        working = false
        if (!disposed) timer = setTimeout(tick, Math.min(120000, 30000 * 2 ** Math.max(0, failures - 1)))
      }
    }
    const resume = () => { if (!document.hidden) tick() }
    tick()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    window.addEventListener('sapa:sheets-changed', resume)
    return () => { disposed = true; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume); window.removeEventListener('sapa:sheets-changed', resume) }
  }, [enabled, active, mode, today, retry, key])
  const refresh = useCallback(() => setRetry(value => value + 1), [])
  // Changing source/day cannot leak rows from the previous source into the new view.
  return { enabled, setEnabled, mode, setMode, refresh, snapshot: state.key === key ? state.snapshot : null, phase: enabled ? (state.key === key ? state.phase : 'loading') : 'manual', error: state.key === key ? state.error : '', checkedAt: state.key === key ? state.checkedAt : null }
}
