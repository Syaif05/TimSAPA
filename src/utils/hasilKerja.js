import { isDoneOrder } from './orderState.js'
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const unique = values => [...new Set(values.map(clean).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'id', { numeric: true }))
export const WORK_FIELDS = [
  ['shipment', 'Nomor Shipment (Dipisah Koma)'],
  ['jumlahPersonil', 'Jumlah Personil Toko'],
  ['namaPejabat', 'Nama Pejabat Toko'],
  ['kondisiMotor', 'Status Equipment Motor'],
  ['grouping', 'Hasil Follow Up (Grouping)'],
  ['kendala', 'Catatan Tambahan (Kendala)'],
]
export function groupWorkResults(rows, { pic = 'ALL', source = 'ALL' } = {}) {
  const groups = new Map()
  for (const row of rows) {
    if (!isDoneOrder(row) || !clean(row.shipment) || (pic !== 'ALL' && clean(row.pic).toUpperCase() !== clean(pic).toUpperCase()) || (source !== 'ALL' && row.source !== source)) continue
    const key = clean(row.kendala).toLocaleLowerCase('id')
    if (!groups.has(key)) groups.set(key, { key, rows: [] })
    groups.get(key).rows.push(row)
  }
  return [...groups.values()].map(group => {
    const fields = Object.fromEntries(WORK_FIELDS.map(([key]) => [key, unique(group.rows.map(row => row[key])).join(', ')]))
    fields.kendala = clean(group.rows[0].kendala)
    const signature = JSON.stringify(group.rows.map(row => [row.source || '', clean(row.pic), ...WORK_FIELDS.map(([field]) => clean(row[field]))]).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
    return { ...group, fields, signature, shipments: unique(group.rows.map(row => row.shipment)), mixed: WORK_FIELDS.filter(([field]) => !['shipment','kendala'].includes(field) && unique(group.rows.map(row => row[field])).length > 1).map(([,label]) => label), missing: WORK_FIELDS.filter(([field]) => group.rows.some(row => !clean(row[field]))).map(([,label]) => label) }
  }).sort((a,b) => a.key.localeCompare(b.key, 'id'))
}
export function workProgress(groups, checks) {
  const completed = groups.filter(group => checks[group.key] === group.signature)
  return { completed: completed.length, total: groups.length, percent: groups.length ? Math.round(completed.length / groups.length * 100) : 0, shipments: unique(groups.flatMap(g => g.shipments)).length, completedShipments: unique(completed.flatMap(g => g.shipments)).length }
}
export function allWorkNotes(groups) { return unique(groups.map(group => group.fields.kendala)).join(', ') }
