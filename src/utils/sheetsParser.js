import { normalizeOrderStatus, isDoneOrder, activeOrders, sortOrdersBySource } from './orderState.js'
import Papa from 'papaparse'
import { monitoringHeader } from '../../supabase/functions/pic-profiles/sheetHeader.js'
const clean = value => String(value ?? '').trim()
const header = value => clean(value).toLowerCase().replace(/[\s_\-]/g, '')
const columns = {
  jam: 'jam', noAc: 'noac', namaAc: 'namaac', kodeToko: 'kodetoko', namaToko: 'namatoko', cabang: 'cabang', region: 'region', shipment: 'shipment', namaKonsumen: 'namakonsumen', sla: 'sla', amName: 'namaam', noAm: 'noam', podAc: 'podac', apvAm: 'apvam', pic: 'pic', sheetStatus: 'status', kondisiMotor: 'kondisimotor', jumlahPersonil: 'jumlahpersonil', namaPejabat: 'namapejabat', kendala: 'kendala', grouping: 'grouping', gli: 'gli',
}
export function parseMonitoringSheet(csv, source) {
  if (typeof csv !== 'string' || /^\s*</.test(csv)) throw new Error(`${source}: respons bukan data spreadsheet. Periksa akses baca Google Sheets.`)
  const parsed = Papa.parse(csv, { skipEmptyLines: 'greedy' })
  if (parsed.errors.length) throw new Error(`${source}: format CSV tidak dapat dibaca.`)
  return parseMonitoringValues(parsed.data, source)
}
export function parseMonitoringValues(values, source) {
  if (!Array.isArray(values)) throw new Error(`${source}: isi spreadsheet tidak valid.`)
  const headerIndex = values.slice(0, 25).findIndex(row => monitoringHeader(row))
  if (headerIndex < 0) throw new Error(`${source}: kolom monitoring tidak ditemukan. Pastikan tab tanggal tersebut tersedia.`)
  const detected = monitoringHeader(values[headerIndex])
  const headers = detected.names
  const indices = Object.fromEntries(Object.entries(columns).map(([key, label]) => [key, headers.indexOf(label)]))
  indices.pic = detected.pic
  for (const key of ['jam', 'namaAc', 'kodeToko', 'namaToko', 'cabang', 'shipment', 'sla', 'pic', 'sheetStatus']) {
    if (indices[key] < 0) throw new Error(`${source}: kolom ${columns[key]} tidak ditemukan.`)
  }
  const rows = []
  values.slice(headerIndex + 1).forEach((cells, index) => {
    const row = Object.fromEntries(Object.entries(indices).map(([key, col]) => [key, col < 0 ? '' : clean(cells[col])]))
    if (!row.shipment || !row.kodeToko || header(row.shipment) === 'shipment') return
    const sheetRow = headerIndex + index + 2
    rows.push({ ...row, source, sheetRow, id: `sheet-${source}-${sheetRow}-${row.shipment}` })
  })
  return rows
}

// Source status is per order. Local chat status must never overwrite it.
export function filterSheetRows(rows, { source = 'ALL', pic = 'ALL', orderStatus = 'ALL' } = {}) {
  return rows.filter(row => (source === 'ALL' || row.source === source) && (pic === 'ALL' || String(row.pic || '').trim().toUpperCase() === String(pic).trim().toUpperCase()) && (orderStatus === 'ALL' || (orderStatus === 'EMPTY' ? !normalizeOrderStatus(row.sheetStatus) : orderStatus === 'ACTIVE' ? !isDoneOrder(row) : normalizeOrderStatus(row.sheetStatus) === normalizeOrderStatus(orderStatus))))
}

// The operational queue always excludes DONE, regardless of old saved filters.
export function workingSheetRows(rows, preferences = {}) {
  const orderStatus = normalizeOrderStatus(preferences.orderStatus) === 'DONE' ? 'ACTIVE' : preferences.orderStatus
  return sortOrdersBySource(activeOrders(filterSheetRows(rows, { ...preferences, orderStatus })))
}
