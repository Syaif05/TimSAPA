import { createHash } from 'node:crypto'
import { parseMonitoringSheet } from '../src/utils/sheetsParser.js'
import { dailySheetTitle, jakartaDate, LINKED_SHEET_DATE, SHEET_SOURCES, SPREADSHEET_ID } from '../src/utils/sheetsConfig.js'
const CACHE_MS = 30000
export function createSheetsReader(fetchImpl = fetch, now = () => Date.now()) {
  const cache = new Map()
  const pending = new Map()
  return async function readSheets({ mode = 'linked', date } = {}) {
    if (!['linked', 'daily'].includes(mode)) throw new Error('Mode sumber tidak valid.')
    const sourceDate = mode === 'linked' ? LINKED_SHEET_DATE : date || jakartaDate()
    dailySheetTitle('REG', sourceDate)
    const key = `${mode}:${sourceDate}`
    if (cache.has(key) && now() - cache.get(key).cachedAt < CACHE_MS) return cache.get(key).snapshot
    if (pending.has(key)) return pending.get(key)
    const request = (async () => {
      const sources = await Promise.all(SHEET_SOURCES.map(async source => {
        const title = mode === 'linked' ? source.title : dailySheetTitle(source.key, sourceDate)
        const url = new URL(`https://docs.google.com/spreadsheets/d/${SPREADSHEET_ID}/${mode === 'linked' ? 'export' : 'gviz/tq'}`)
        if (mode === 'linked') { url.searchParams.set('format', 'csv'); url.searchParams.set('gid', source.gid) }
        else { url.searchParams.set('tqx', 'out:csv'); url.searchParams.set('sheet', title); url.searchParams.set('headers', '0') }
        url.searchParams.set('range', 'A:V')
        const response = await fetchImpl(url, { method: 'GET', credentials: 'omit', signal: AbortSignal.timeout(25000), headers: { 'Cache-Control': 'no-cache' } })
        if (!response.ok || response.url?.includes('accounts.google.com')) throw new Error(`${title}: akses baca gagal (${response.status}).`)
        if (!response.headers.get('content-type')?.includes('text/csv')) throw new Error(`${title}: Google tidak mengirim CSV. Periksa akses atau nama tab.`)
        const csv = await response.text()
        if (Buffer.byteLength(csv) > 12 * 1024 * 1024) throw new Error(`${title}: data terlalu besar untuk sinkronisasi.`)
        const rows = parseMonitoringSheet(csv, source.key)
        return { key: source.key, title, gid: mode === 'linked' ? source.gid : null, rows, checksum: createHash('sha256').update(csv).digest('hex') }
      }))
      const snapshot = { mode, date: sourceDate, fetchedAt: new Date(now()).toISOString(), revision: createHash('sha256').update(key + ':' + sources.map(s => s.checksum).join(':')).digest('hex'), sources: sources.map(({ rows, checksum, ...s }) => ({ ...s, count: rows.length })), rows: sources.flatMap(s => s.rows) }
      cache.set(key, { cachedAt: now(), snapshot })
      if (cache.size > 8) cache.delete(cache.keys().next().value)
      return snapshot
    })()
    pending.set(key, request)
    try { return await request } finally { pending.delete(key) }
  }
}
