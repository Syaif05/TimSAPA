// The source is a follow-up history export; counts follow Excel COUNT, not SUM.
export const REPORT_FIELDS = {
  descp_follow_up: 'Kendala follow up', grouping_follow_up: 'Grouping follow up',
  branch_name: 'Cabang', store_id: 'Kode toko', is_tag_i: 'Kategori',
}
export const REPORT_DEFAULTS = { title: 'Hasil Laporan Follow Up', start: '', end: '', category: '', followed: '', names: [], detailNames: [], separateNames: false, summarySort: 'stores-desc', detailSort: 'count-desc', field: 'descp_follow_up', showZero: false, countBlankStores: true, grid: false, fontSize: 11 }
const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').trim().replace(/\s+/g, ' ')
const az = (a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' })
const dayString = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
export function reportDate(value, parseExcelDate) {
  if (typeof value === 'number') { const d = parseExcelDate?.(value); return d ? dayString(d.y, d.m, d.d) : '' }
  const text = clean(value)
  let match = text.match(/^(\d{4})-(\d{2})-(\d{2})(?:$|[ T])/)
  if (match) return match[0].slice(0, 10)
  match = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})(?:$|\s)/)
  if (match) return dayString(match[3], match[2], match[1])
  return ''
}
export function parseReportRows(matrix, parseExcelDate) {
  const headerIndex = matrix.findIndex(row => row.some(cell => clean(cell).toLowerCase() === 'nomor_shipment'))
  if (headerIndex < 0) throw new Error('Kolom nomor_shipment tidak ditemukan. Gunakan ekspor pending_delivery_follow_up.')
  const headers = matrix[headerIndex].map(cell => clean(cell).toLowerCase())
  for (const field of ['nomor_shipment', 'store_id', 'agent_follow_up', 'descp_follow_up', 'update_at']) if (!headers.includes(field)) throw new Error(`Kolom wajib ${field} tidak ditemukan.`)
  let ignored = 0
  const rows = []
  for (const cells of matrix.slice(headerIndex + 1)) {
    if (!cells.some(cell => clean(cell))) continue
    const row = Object.fromEntries(headers.map((key, index) => [key, clean(cells[index])]))
    if (!row.nomor_shipment) { ignored++; continue }
    row.agent_follow_up = row.agent_follow_up.toUpperCase() || '(Kosong)'
    row.date = reportDate(cells[headers.indexOf('update_at')], parseExcelDate)
    rows.push(row)
  }
  if (!rows.length) throw new Error('Tidak ada baris shipment yang dapat dilaporkan.')
  return { rows, ignored, undated: rows.filter(row => !row.date).length, duplicates: rows.length - new Set(rows.map(row => row.nomor_shipment)).size }
}
export function reportOptions(rows) {
  return { names: [...new Set(rows.map(row => row.agent_follow_up))].sort(az), dates: [...new Set(rows.map(row => row.date).filter(Boolean))].sort(), categories: [...new Set(rows.map(row => row.is_tag_i))].sort(az) }
}
export function buildReport(rows, options) {
  const opts = { ...REPORT_DEFAULTS, ...options }
  const base = rows.filter(row => (!opts.start || row.date >= opts.start) && (!opts.end || (row.date && row.date <= opts.end)) && (!opts.category || row.is_tag_i === (opts.category === '__EMPTY__' ? '' : opts.category)) && (!opts.followed || row.sudah_follow_up === opts.followed))
  const summaryRows = base.filter(row => opts.names.includes(row.agent_follow_up))
  const detailRows = base.filter(row => (opts.separateNames ? opts.detailNames : opts.names).includes(row.agent_follow_up))
  const groups = new Map()
  for (const row of summaryRows) {
    if (!groups.has(row.agent_follow_up)) groups.set(row.agent_follow_up, { name: row.agent_follow_up, stores: new Set(), shipments: 0 })
    const group = groups.get(row.agent_follow_up)
    group.shipments++
    if (row.store_id || opts.countBlankStores) group.stores.add(row.store_id)
  }
  const summary = [...groups.values()].map(group => ({ ...group, stores: group.stores.size }))
  summary.sort((a, b) => (opts.summarySort === 'stores-desc' ? b.stores - a.stores : opts.summarySort === 'shipments-desc' ? b.shipments - a.shipments : 0) || az(a.name, b.name))
  const names = [...new Set(detailRows.map(row => row.agent_follow_up))].sort(az)
  const categories = new Map()
  for (const row of detailRows) {
    const label = row[opts.field] || '(Kosong)'
    if (!categories.has(label)) categories.set(label, { label, counts: {}, total: 0 })
    const category = categories.get(label)
    category.counts[row.agent_follow_up] = (category.counts[row.agent_follow_up] || 0) + 1
    category.total++
  }
  const detail = [...categories.values()].sort((a, b) => (opts.detailSort === 'count-desc' ? b.total - a.total : 0) || az(a.label, b.label))
  return { summary, detail, names, stores: new Set(summaryRows.map(row => row.store_id).filter(value => value || opts.countBlankStores)).size, shipments: summaryRows.length, detailTotal: detailRows.length, columnTotals: Object.fromEntries(names.map(name => [name, detailRows.filter(row => row.agent_follow_up === name).length])), matched: base.length }
}
export function reportTsv(report) {
  const cell = value => { const text = String(value ?? ''); return /[\t\n\r"]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text }
  const rows = [['Nama', 'Toko unik', 'Shipment'], ...report.summary.map(row => [row.name, row.stores, row.shipments]), ['Grand Total', report.stores, report.shipments], [], ['Kendala / kategori', ...report.names, 'Grand Total'], ...report.detail.map(row => [row.label, ...report.names.map(name => row.counts[name] || ''), row.total]), ['Grand Total', ...report.names.map(name => report.columnTotals[name]), report.detailTotal]]
  return rows.map(row => row.map(cell).join('\t')).join('\n')
}
