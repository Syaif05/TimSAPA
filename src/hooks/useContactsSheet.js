import { useCallback, useEffect, useState } from 'react'
export function useContactsSheet() {
  const [state, setState] = useState({ snapshot: null, phase: 'loading', error: '', checkedAt: null })
  const [retry, setRetry] = useState(0)
  useEffect(() => {
    let disposed = false
    let timer
    let working = false
    let etag = ''
    const controller = new AbortController()
    const tick = async () => {
      if (working || disposed) return
      clearTimeout(timer)
      if (document.hidden) { timer = setTimeout(tick, 60000); return }
      working = true
      try {
        const response = await fetch('/api/contacts', { signal: controller.signal, cache: 'no-store', headers: etag ? { 'If-None-Match': etag } : {} })
        if (disposed) return
        if (response.status === 304) {
          setState(prev => ({ ...prev, phase: prev.snapshot?.stale ? 'cached' : 'live', error: prev.snapshot?.error || '', checkedAt: response.headers.get('X-SAPA-Fetched-At') || prev.checkedAt }))
        } else {
          if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Jalankan ulang SAPA untuk mengaktifkan sumber kontak spreadsheet.')
          const data = await response.json()
          if (!response.ok) throw new Error(data.error || 'Gagal memuat sumber kontak.')
          if (!Array.isArray(data.contacts) || !data.contacts.length) throw new Error('Data kontak tidak lengkap.')
          etag = response.headers.get('ETag') || ''
          setState({ snapshot: data, phase: data.stale ? 'cached' : 'live', error: data.error || '', checkedAt: data.fetchedAt })
        }
      } catch (error) {
        if (!disposed) setState(prev => ({ ...prev, phase: 'error', error: error.message || 'Sumber kontak tidak terhubung.' }))
      } finally {
        working = false
        if (!disposed) timer = setTimeout(tick, 60000)
      }
    }
    const resume = () => { if (!document.hidden) tick() }
    tick()
    document.addEventListener('visibilitychange', resume)
    window.addEventListener('online', resume)
    return () => { disposed = true; clearTimeout(timer); controller.abort(); document.removeEventListener('visibilitychange', resume); window.removeEventListener('online', resume) }
  }, [retry])
  const refresh = useCallback(() => setRetry(value => value + 1), [])
  return { ...state, refresh, ready: Boolean(state.snapshot?.contacts?.length) }
}
