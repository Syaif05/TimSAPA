import { randomUUID } from 'node:crypto'
import { FOLLOW_UP_FIELDS, planFollowUpCarry, textValue } from '../src/utils/smartSheet.js'
import { SPREADSHEET_ID, jakartaDate } from '../src/utils/sheetsConfig.js'
import { httpError } from './googleOAuth.js'
import { queryPath } from './cloudDatabase.js'

const quote = title => `'${title.replaceAll("'", "''")}'`
const normalize = value => textValue(value).toLowerCase().replace(/[\s_-]/g, '')
export function followUpColumns(header) {
  const names = header.map(normalize)
  return Object.fromEntries(FOLLOW_UP_FIELDS.map(field => {
    const matches = names.flatMap((name, index) => name === field.header ? [index] : [])
    if (matches.length !== 1 || matches[0] >= 22) throw httpError(409, `Kolom ${field.label} tidak ditemukan atau ganda. Perubahan dibatalkan.`)
    return [field.key, matches[0]]
  }))
}

export function createFollowUpSync({ monitoring, googleRequest, database, invalidate, now = () => Date.now() }) {
  return async function carryForward(body, actor) {
    const { date, mode, source = 'ALL' } = body
    const pic = String(body.targetPic || '').trim().toUpperCase()
    if (mode !== 'daily' || date !== jakartaDate(new Date(now())) || !pic || pic === 'ALL' || pic.length > 80 || !['ALL', 'DS', 'REG'].includes(source)) throw httpError(400, 'Pilih satu PIC, sumber, dan tanggal hari ini untuk meneruskan isian.')
    // Same lock as Tarik Data: an append/duplicate cannot move the write target mid-flight.
    const lockKey = `lock:tarik:${SPREADSHEET_ID}`, token = randomUUID()
    await database(queryPath('sapa_source_cache', { cache_key: `eq.${lockKey}`, expires_at: `lt.${new Date(now()).toISOString()}` }), { method: 'DELETE' })
    const lock = await database('sapa_source_cache?on_conflict=cache_key', { method: 'POST', body: { cache_key: lockKey, snapshot: { token }, expires_at: new Date(now() + 600000).toISOString() }, prefer: 'resolution=ignore-duplicates,return=representation' })
    if (!lock?.length) throw httpError(409, 'Update spreadsheet lain sedang berjalan. Perbarui data sebelum mencoba kembali.')
    let uncertain = false
    let audit
    try {
      const fresh = await monitoring({ mode, date, force: true })
      if (fresh.stale || fresh.date !== date) throw httpError(503, 'Data terbaru belum terverifikasi. Isian belum diteruskan.')
      const plan = planFollowUpCarry(fresh.rows, { pic, source })
      if (!plan.length) return { saved: true, updatedRows: 0, updatedCells: 0, remaining: 0 }
      const batch = plan.filter(item => item.row.source === plan[0].row.source).slice(0, 100)
      const titles = [...new Set(batch.map(item => item.row.sheetTitle))]
      const params = new URLSearchParams({ valueRenderOption: 'FORMULA' })
      titles.forEach(title => params.append('ranges', `${quote(title)}!A1:V25`))
      batch.forEach(({ row }) => params.append('ranges', `${quote(row.sheetTitle)}!A${row.sheetRow}:V${row.sheetRow}`))
      const check = await googleRequest(SPREADSHEET_ID, `/values:batchGet?${params}`)
      if (check.valueRanges?.length !== titles.length + batch.length) throw httpError(502, 'Pemeriksaan sel belum lengkap. Isian belum diteruskan.')
      const headers = new Map(titles.map((title, i) => {
        const header = check.valueRanges[i].values?.find(cells => cells.map(normalize).includes('shipment') && cells.map(normalize).includes('status'))
        if (!header) throw httpError(409, 'Header spreadsheet berubah. Perbarui data.')
        return [title, { columns: followUpColumns(header), names: header.map(normalize) }]
      }))
      const data = []
      batch.forEach(({ row, changes }, index) => {
        const cells = check.valueRanges[titles.length + index].values?.[0] || []
        const { columns, names } = headers.get(row.sheetTitle)
        if (textValue(cells[names.indexOf('shipment')]) !== row.shipment || textValue(cells[names.indexOf('kodetoko')]) !== row.kodeToko || textValue(cells[names.indexOf('jam')]) !== row.jam) throw httpError(409, 'Posisi pesanan berubah. Perbarui data sebelum meneruskan isian.')
        for (const [key, value] of Object.entries(changes)) {
          // FORMULA catches formulas whose displayed result is empty. Never replace them.
          if (textValue(cells[columns[key]])) throw httpError(409, 'Sel tujuan baru diisi atau berisi rumus. Isian tidak ditimpa; perbarui data.')
          data.push({ range: `${quote(row.sheetTitle)}!${String.fromCharCode(65 + columns[key])}${row.sheetRow}`, values: [[value]] })
        }
      })
      audit = (await database('sapa_sheet_audit', { method: 'POST', body: { actor, source: batch[0].row.source, sheet_date: date, shipment: `CARRY:${token}`, sheet_row: batch[0].row.sheetRow, before_value: { emptyOnly: true, pic }, after_value: { rows: batch.length, cells: data.length, updates: data }, outcome: 'pending' } }))[0]
      if (!audit?.id) throw httpError(503, 'Riwayat belum tersimpan. Isian belum diteruskan.')
      uncertain = true
      await googleRequest(SPREADSHEET_ID, '/values:batchUpdate', { method: 'POST', body: { valueInputOption: 'RAW', data } })
      uncertain = false
      await invalidate(mode, date)
      await database(queryPath('sapa_sheet_audit', { id: `eq.${audit.id}` }), { method: 'PATCH', body: { outcome: 'completed' } }).catch(() => {})
      return { saved: true, updatedRows: batch.length, updatedCells: data.length, remaining: plan.length - batch.length }
    } catch (error) {
      if (uncertain) {
        if (audit) await database(queryPath('sapa_sheet_audit', { id: `eq.${audit.id}` }), { method: 'PATCH', body: { outcome: 'uncertain' } }).catch(() => {})
        throw httpError(409, 'Hasil penyimpanan belum dapat dipastikan. Otomatis dijeda. Periksa spreadsheet dan perbarui data sebelum mencoba lagi; update dikunci sementara.')
      }
      throw error
    } finally {
      if (!uncertain) await database(queryPath('sapa_source_cache', { cache_key: `eq.${lockKey}`, 'snapshot->>token': `eq.${token}` }), { method: 'DELETE' }).catch(() => {})
    }
  }
}
