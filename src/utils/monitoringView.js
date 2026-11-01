import { isDoneOrder, sourcePriority } from './orderState.js'

export function slaBucket(value) {
  const text = String(value || '').toLowerCase()
  const hours = text.match(/\b(12|6|2|1)\s*jam\b/)
  if (hours) return `${hours[1]}h`
  if (/\b45\s*(?:menit|m)\b/.test(text)) return '45m'
  if (/\b30\s*(?:menit|m)\b/.test(text)) return '30m'
  return ''
}
export function matchesSla(value, filter = 'ALL') {
  const bucket = slaBucket(value)
  return filter === 'ALL' || ({ CRITICAL: ['12h', '6h'], OVER_1_2: ['12h', '6h', '2h', '1h'], '12_JAM': ['12h'], '6_JAM': ['6h'], '2_JAM': ['2h'], '1_JAM': ['1h'], UNDER_1: ['45m', '30m'] }[filter] || []).includes(bucket)
}
export function filterMonitoringGroups(groups, filters = {}, search = '', statuses = {}) {
  const q = search.trim().toLowerCase()
  const any = value => !value || value === 'ALL'
  return groups.flatMap(group => {
    if (!any(filters.status) && (statuses[group.acKey] || group.status || 'belum_dikerjakan') !== filters.status) return []
    const groupMatch = !q || String(group.acName || '').toLowerCase().includes(q) || String(group.phone || '').includes(q)
    const rows = group.rows.filter(row => !isDoneOrder(row)
      && (any(filters.pic) || String(row.pic || '').trim().toUpperCase() === filters.pic.trim().toUpperCase())
      && (any(filters.jam) || row.jam === filters.jam)
      && matchesSla(row.sla, filters.sla)
      && (groupMatch || [row.kodeToko, row.namaToko, row.shipment].some(value => String(value || '').toLowerCase().includes(q))))
    if (!rows.length) return []
    if (rows.length === group.rows.length) return [group]
    const storesList = [...new Map(rows.map(row => [row.kodeToko, `${row.kodeToko} - ${row.namaToko || ''}`])).values()]
    const slaBreakdown = {}
    rows.forEach(row => { const key = row.sla || 'Lainnya'; slaBreakdown[key] = (slaBreakdown[key] || 0) + 1 })
    return [{ ...group, rows, storesList, slaBreakdown, totalShipments: rows.length, totalStores: new Set(rows.map(row => row.kodeToko).filter(Boolean)).size }]
  })
}

export const SHEET_COLUMNS = [
  ['jam', 'Jam', 75], ['noAc', 'No AC', 145], ['namaAc', 'Nama AC', 200],
  ['kodeToko', 'Kode Toko', 95], ['namaToko', 'Nama Toko', 195], ['cabang', 'Cabang', 150],
  ['region', 'Region', 140], ['shipment', 'Shipment', 190], ['namaKonsumen', 'Nama Konsumen', 190],
  ['sla', 'SLA', 140], ['amName', 'Nama AM', 180], ['noAm', 'No AM', 140],
  ['podAc', 'POD AC', 100], ['apvAm', 'APV AM', 100], ['pic', 'PIC', 115], ['sheetStatus', 'Status', 165],
  ['kondisiMotor', 'Kondisi Motor', 130], ['jumlahPersonil', 'Jumlah Personil', 130],
  ['namaPejabat', 'Nama Pejabat', 160], ['kendala', 'Kendala', 250], ['grouping', 'Grouping', 120], ['gli', 'GLI', 80],
].map(([key, label, width], index) => ({ key, label, width, letter: String.fromCharCode(65 + index) }))
export const VISIBLE_SHEET_COLUMNS = SHEET_COLUMNS.filter(column => !['K', 'L', 'M'].includes(column.letter))
export const DEFAULT_HIDDEN_SHEET_COLUMNS = SHEET_COLUMNS.filter(column => ['K', 'L', 'M'].includes(column.letter)).map(column => column.key)
export const SHEET_COLUMN_VISIBILITY_KEY = 'sapa_sheet_hidden_columns_v1'
export function normalizeHiddenSheetColumns(value) {
  if (!Array.isArray(value)) return DEFAULT_HIDDEN_SHEET_COLUMNS
  const allowed = new Set(SHEET_COLUMNS.map(column => column.key))
  const hidden = [...new Set(value.filter(key => allowed.has(key)))]
  return hidden.length < SHEET_COLUMNS.length ? hidden : DEFAULT_HIDDEN_SHEET_COLUMNS
}
export function visibleSheetColumns(hidden = DEFAULT_HIDDEN_SHEET_COLUMNS) {
  const excluded = new Set(normalizeHiddenSheetColumns(hidden))
  return SHEET_COLUMNS.filter(column => !excluded.has(column.key))
}
const compareText = (a, b) => String(a || '').localeCompare(String(b || ''), 'id', { numeric: true, sensitivity: 'base' })
export const sortSpreadsheetEntries = entries => [...entries].sort((a, b) =>
  compareText(a.row.kodeToko, b.row.kodeToko)
  || compareText(a.row.namaAc || a.group?.acName, b.row.namaAc || b.group?.acName)
  || compareText(a.row.pic, b.row.pic)
  || sourcePriority(a.row.source) - sourcePriority(b.row.source)
  || (Number(a.row.sheetRow) || Infinity) - (Number(b.row.sheetRow) || Infinity))

export function spreadsheetRows(rows, groups, filters = {}, search = '', orderStatus = 'ALL') {
  const activeById = new Map(groups.flatMap(group => group.rows.map(row => [row.id, group])))
  const q = search.trim().toLowerCase()
  return sortSpreadsheetEntries(rows.filter(row =>
    (filters.pic === 'ALL' || !filters.pic || String(row.pic || '').toUpperCase() === filters.pic.toUpperCase())
    && (filters.jam === 'ALL' || !filters.jam || row.jam === filters.jam)
    && matchesSla(row.sla, filters.sla)
    && (orderStatus === 'ALL' || (orderStatus === 'ACTIVE' ? !isDoneOrder(row) : orderStatus === 'EMPTY' ? !String(row.sheetStatus || '').trim() : String(row.sheetStatus || '').trim().toUpperCase() === orderStatus.toUpperCase()))
    && (!q || [row.namaAc, row.noAc, row.kodeToko, row.namaToko, row.shipment, row.pic].some(value => String(value || '').toLowerCase().includes(q)))
  ).map((row, index) => ({ row, group: activeById.get(row.id), key: JSON.stringify([row.source, row.id || index, row.shipment]) })))
}
export function filterSpreadsheetEntries(entries, excluded = {}) {
  return entries.filter(entry => SHEET_COLUMNS.every(column => !(excluded[column.key] || []).includes(sheetFilterValue(entry, column))))
}
export const sheetFilterValue = (entry, column) => column.key === 'sheetStatus' ? sheetCellValue(entry, column).trim().toUpperCase() : sheetCellValue(entry, column).trim()
export function sortSpreadsheetColumn(entries, columnKey, direction = 'asc') {
  if (!columnKey) return entries
  const column = SHEET_COLUMNS.find(item => item.key === columnKey)
  if (!column) return entries
  const factor = direction === 'desc' ? -1 : 1
  return [...entries].sort((a, b) => factor * compareText(sheetCellValue(a, column), sheetCellValue(b, column))
    || compareText(a.row.kodeToko, b.row.kodeToko)
    || compareText(a.row.namaAc, b.row.namaAc)
    || compareText(a.row.pic, b.row.pic))
}

export function spreadsheetEntries(groups) {
  return sortSpreadsheetEntries(groups.flatMap(group => group.rows.filter(row => !isDoneOrder(row)).map((row, index) => ({
    row, group, key: JSON.stringify([group.acKey, row.id || index, row.shipment]),
  }))))
}
export const sheetCellValue = (entry, column) => String(entry.row[column.key] ?? (column.key === 'namaAc' ? entry.group?.acName : '') ?? '')
export function spreadsheetTsv(entries, { includeDone = false, columns = VISIBLE_SHEET_COLUMNS } = {}) {
  const escape = value => /[\t\n\r"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
  return [['Sumber', ...columns.map(column => column.label)], ...entries.filter(entry => includeDone || !isDoneOrder(entry.row)).map(entry => [entry.row.source || entry.group?.source || '', ...columns.map(column => sheetCellValue(entry, column))])].map(row => row.map(value => escape(String(value))).join('\t')).join('\n')
}
