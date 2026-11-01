import { createHash } from 'node:crypto'
import { parseMonitoringValues } from '../src/utils/sheetsParser.js'
import { CONTACTS_SOURCE, dailySheetTitle, jakartaDate, LINKED_SHEET_DATE, SHEET_SOURCES, SPREADSHEET_ID } from '../src/utils/sheetsConfig.js'
import { parseContactRows } from './contactRows.js'
import { httpError } from './googleOAuth.js'
import { queryPath } from './cloudDatabase.js'
const hash = value => createHash('sha256').update(JSON.stringify(value)).digest('hex')
const quote = title => `'${title.replaceAll("'", "''")}'`
export function createGoogleSheetsApi({ database, googleRequest, now = () => Date.now(), contactsSource = async () => CONTACTS_SOURCE }) {
  const memory = new Map(); const pending = new Map()
  let cleanupAt = 0
  async function cached(key, ttl, loader, force = false) {
    if (pending.has(key)) {
      const previous = await pending.get(key)
      if (!force) return previous
    }
    const work = (async () => {
      const stored = (await database(queryPath('sapa_source_cache', { cache_key: `eq.${key}`, select: 'snapshot,expires_at' })))[0]
      const prior = stored || memory.get(key)
      if (!force && prior && Date.parse(prior.expires_at) > now()) return { ...prior.snapshot, stale: false, error: '' }
      try {
        const snapshot = await loader()
        const next = { snapshot, expires_at: new Date(Date.parse(snapshot.fetchedAt) + ttl).toISOString() }
        await database('sapa_source_cache?on_conflict=cache_key', { method: 'POST', body: { cache_key: key, ...next }, prefer: 'resolution=merge-duplicates,return=minimal' })
        if (now() >= cleanupAt) {
          cleanupAt = now() + 3600000
          // Cached copies can be regenerated; keep approximately one week to bound storage.
          await database(queryPath('sapa_source_cache', { expires_at: `lt.${new Date(now() - 7 * 86400000).toISOString()}` }), { method: 'DELETE' }).catch(() => {})
        }
        memory.set(key, next)
        if (memory.size > 8) memory.delete(memory.keys().next().value)
        return { ...snapshot, stale: !!snapshot.stale, error: snapshot.error || '' }
      } catch (error) {
        // Never substitute another date/source. Every cache entry has its own exact key.
        if (prior) return { ...prior.snapshot, stale: true, error: error.message }
        throw error
      }
    })()
    pending.set(key, work)
    try { return await work } finally { pending.delete(key) }
  }
  async function monitoring({ mode = 'daily', date, force = false } = {}) {
    if (!['linked', 'daily'].includes(mode)) throw httpError(400, 'Mode sumber tidak valid.')
    const sourceDate = mode === 'linked' ? LINKED_SHEET_DATE : date || jakartaDate()
    dailySheetTitle('REG', sourceDate)
    return cached(`monitoring:${mode}:${sourceDate}`, 30000, async () => {
      const metadata = await googleRequest(SPREADSHEET_ID, '?fields=sheets(properties(sheetId,title))')
      const tabs = SHEET_SOURCES.map(source => {
        const title = mode === 'linked' ? null : dailySheetTitle(source.key, sourceDate)
        const tab = metadata.sheets?.find(s => title ? s.properties.title === title : String(s.properties.sheetId) === source.gid)?.properties
        if (!tab) throw httpError(422, `Tab ${title || source.title} belum tersedia. Periksa tab tanggal tersebut di spreadsheet.`)
        return { key: source.key, title: tab.title, gid: String(tab.sheetId) }
      })
      const params = new URLSearchParams({ valueRenderOption: 'FORMATTED_VALUE', majorDimension: 'ROWS' })
      tabs.forEach(tab => params.append('ranges', `${quote(tab.title)}!A:V`))
      const data = await googleRequest(SPREADSHEET_ID, `/values:batchGet?${params}`)
      if (data.valueRanges?.length !== tabs.length) throw httpError(502, 'Respons Sheets API belum lengkap.')
      const sources = tabs.map((tab, index) => ({ ...tab, rows: parseMonitoringValues(data.valueRanges[index].values || [], tab.key).map(row => ({ ...row, sheetDate: sourceDate, sheetMode: mode, sheetTitle: tab.title })) }))
      const rows = sources.flatMap(s => s.rows)
      return { mode, date: sourceDate, fetchedAt: new Date(now()).toISOString(), revision: hash(rows), sources: sources.map(({ rows: sourceRows, ...s }) => ({ ...s, count: sourceRows.length })), rows, transport: 'google-api' }
    }, force)
  }
  async function contacts(readExcel) {
    const source = await contactsSource()
    return cached(readExcel ? 'contacts:master:excel' : `contacts:${source.id}:${source.sheet}`, 300000, async () => {
      if (readExcel) return { ...await readExcel(), transport: 'excel' }
      const data = await googleRequest(source.id, `/values/${encodeURIComponent(`${quote(source.sheet)}!A:AZ`)}?valueRenderOption=FORMATTED_VALUE`)
      const rows = parseContactRows(data.values || [])
      return { sourceId: source.id, sheet: source.sheet, contacts: rows, fetchedAt: new Date(now()).toISOString(), revision: hash(rows), transport: 'google-api' }
    })
  }
  // Only these two columns can be changed. Headers are resolved afresh before each write.
  async function updateOrder(body, actor) {
    const { source, date, mode, sheetRow, shipment, store, changes, expected } = body
    if (!['REG', 'DS'].includes(source) || !['daily', 'linked'].includes(mode) || !Number.isSafeInteger(sheetRow) || sheetRow < 2 || sheetRow > 200000 || typeof shipment !== 'string' || typeof store !== 'string') throw httpError(400, 'Identitas pesanan tidak valid.')
    dailySheetTitle(source, date)
    if (!changes || !expected || Object.keys(changes).length < 1 || Object.keys(changes).some(k => !['sheetStatus', 'kendala'].includes(k))) throw httpError(400, 'Kolom perubahan tidak diizinkan.')
    for (const [key, value] of Object.entries(changes)) if (typeof value !== 'string' || value.length > (key === 'sheetStatus' ? 80 : 2000) || typeof expected[key] !== 'string') throw httpError(400, 'Isi perubahan tidak valid.')
    const fresh = await monitoring({ mode, date, force: true })
    if (fresh.stale) throw httpError(503, 'Data terbaru belum dapat diperiksa. Perubahan belum dikirim.')
    if (fresh.date !== date) throw httpError(400, 'Tanggal pesanan tidak sesuai dengan tab sumber.')
    const row = fresh.rows.find(r => r.source === source && r.sheetRow === sheetRow && r.shipment === shipment && r.kodeToko === store)
    if (!row) throw httpError(409, 'Posisi pesanan berubah. Sinkronkan lalu coba lagi.')
    for (const key of Object.keys(changes)) if (String(row[key] || '') !== expected[key]) throw httpError(409, 'Isi pesanan sudah berubah. Sinkronkan lalu periksa kembali.')
    const headerData = await googleRequest(SPREADSHEET_ID, `/values/${encodeURIComponent(`${quote(row.sheetTitle)}!A1:V25`)}?valueRenderOption=FORMATTED_VALUE`)
    const header = headerData.values?.find(cells => cells.some(c => String(c).trim().toLowerCase() === 'shipment') && cells.some(c => String(c).trim().toLowerCase() === 'status'))
    if (!header) throw httpError(409, 'Struktur kolom berubah. Perubahan dibatalkan.')
    const labels = { sheetStatus: 'status', kendala: 'kendala' }
    const updates = Object.entries(changes).map(([key, value]) => {
      const col = header.findIndex(cell => String(cell).trim().toLowerCase() === labels[key])
      if (col < 0 || col >= 22) throw httpError(409, 'Kolom tujuan tidak ditemukan.')
      return { range: `${quote(row.sheetTitle)}!${String.fromCharCode(65 + col)}${sheetRow}`, values: [[value]] }
    })
    const audit = (await database('sapa_sheet_audit', { method: 'POST', body: { actor, source, sheet_date: date, shipment, sheet_row: sheetRow, before_value: Object.fromEntries(Object.keys(changes).map(k => [k, row[k] || ''])), after_value: changes, outcome: 'pending' } }))[0]
    if (!audit?.id) throw httpError(503, 'Riwayat perubahan belum dapat disimpan. Perubahan dibatalkan.')
    try {
      await googleRequest(SPREADSHEET_ID, '/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data: updates } })
    } catch (error) {
      await database(queryPath('sapa_sheet_audit', { id: `eq.${audit.id}` }), { method: 'PATCH', body: { outcome: 'uncertain' } }).catch(() => {})
      throw error
    }
    // Google has no atomic compare-and-swap for cells; expected values are a preflight check.
    // A timeout after sending a write can have an uncertain outcome: do not auto-retry writes.
    memory.clear()
    const cacheKey = `monitoring:${mode}:${fresh.date}`
    await database(queryPath('sapa_source_cache', { cache_key: `eq.${cacheKey}` }), { method: 'DELETE' })
    await database(queryPath('sapa_sheet_audit', { id: `eq.${audit.id}` }), { method: 'PATCH', body: { outcome: 'completed' } })
    return { saved: true }
  }
  return { monitoring, contacts, updateOrder }
}
