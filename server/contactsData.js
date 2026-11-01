import { createHash } from 'node:crypto'
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises'
import { resolve } from 'node:path'
import { CONTACTS_SOURCE } from '../src/utils/sheetsConfig.js'
const CACHE_MS = 5 * 60 * 1000
const cacheFolder = resolve('.sapa-cache')
const cachePath = resolve(cacheFolder, 'contacts.json')
const diskCache = {
  load: async () => { try { return JSON.parse(await readFile(cachePath, 'utf8')) } catch { return null } },
  save: async snapshot => { await mkdir(cacheFolder, { recursive: true, mode: 0o700 }); const temp = `${cachePath}.${process.pid}.tmp`; await writeFile(temp, JSON.stringify(snapshot), { mode: 0o600 }); await rename(temp, cachePath) },
}
export function createContactsReader({ fetchImpl = fetch, now = () => Date.now(), cache = diskCache, parse } = {}) {
  let snapshot = null
  let pending = null
  let loadingCache = null
  let lastError = ''
  let retryAt = 0
  const refresh = () => {
    if (pending) return pending
    pending = (async () => {
      try {
        const url = new URL('https://drive.usercontent.google.com/download')
        url.searchParams.set('id', CONTACTS_SOURCE.id)
        url.searchParams.set('export', 'download')
        url.searchParams.set('confirm', 't')
        const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', signal: AbortSignal.timeout(60000) })
        if (!response.ok) throw new Error(`Kontak spreadsheet tidak dapat dibaca (${response.status}).`)
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > 20 * 1024 * 1024) throw new Error('File kontak melebihi batas 20 MB.')
        const parseWorkbook = parse || (await import('./contactWorkbook.js')).parseContactWorkbook
        const contacts = parseWorkbook(buffer)
        const next = { sourceId: CONTACTS_SOURCE.id, sheet: CONTACTS_SOURCE.sheet, fetchedAt: new Date(now()).toISOString(), revision: createHash('sha256').update(JSON.stringify(contacts)).digest('hex'), contacts }
        snapshot = next
        lastError = ''
        retryAt = 0
        // A disk error must not invalidate a successful live read.
        try { await cache.save(next) } catch { /* memory cache remains available */ }
      } catch (error) {
        lastError = error.name === 'TimeoutError' ? 'Sumber kontak belum merespons. Coba sinkronkan kembali.' : error.message
        retryAt = now() + 30000
        throw new Error(lastError)
      } finally { pending = null }
    })()
    return pending
  }
  return async function readContacts() {
    if (!loadingCache) loadingCache = (async () => {
      let saved = null
      try { saved = await cache.load() } catch { /* unreadable cache can be replaced from source */ }
      if (saved?.sourceId === CONTACTS_SOURCE.id && Array.isArray(saved.contacts) && saved.contacts.length && Number.isFinite(Date.parse(saved.fetchedAt))) snapshot = saved
    })()
    await loadingCache
    const stale = !snapshot || now() - Date.parse(snapshot.fetchedAt) >= CACHE_MS
    if (!snapshot) {
      if (lastError && now() < retryAt) throw new Error(lastError)
      await refresh()
    } else if (stale && now() >= retryAt) {
      refresh().catch(() => {})
    }
    return { ...snapshot, stale: now() - Date.parse(snapshot.fetchedAt) >= CACHE_MS, error: lastError }
  }
}
