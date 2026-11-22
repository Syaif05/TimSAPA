import { isDoneOrder } from './orderState.js'
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ')
const normalized = value => clean(value).toLocaleLowerCase('id')
const compare = (a, b) => a.localeCompare(b, 'id', { numeric: true })
const unique = values => [...new Set(values.map(clean).filter(Boolean))].sort(compare)
export const WORK_FIELDS = [
  ['shipment', 'Nomor Shipment (Dipisah Koma)'],
  ['jumlahPersonil', 'Jumlah Personil Toko'],
  ['namaPejabat', 'Nama Pejabat Toko'],
  ['kondisiMotor', 'Status Equipment Motor'],
  ['grouping', 'Hasil Follow Up (Grouping)'],
  ['kendala', 'Catatan Tambahan (Kendala)'],
]
const officeFields = ['kendala', 'kondisiMotor', 'grouping', 'jumlahPersonil', 'namaPejabat']
// Sheet row numbers change when the source is sorted; they are never an identity.
export const workRowKey = row => JSON.stringify([row.source, row.pic, row.shipment].map(normalized))
export const workRowSignature = row => JSON.stringify(officeFields.map(field => normalized(row[field])))
export const isWorkCollected = (row, checks = {}) => checks[workRowKey(row)] === workRowSignature(row)
export function setWorkCollected(checks, rows, collected) {
  const next = { ...checks }
  for (const row of rows) {
    if (collected) next[workRowKey(row)] = workRowSignature(row)
    else delete next[workRowKey(row)]
  }
  return next
}
const motorRank = group => normalized(group.fields.kondisiMotor) === 'baik' ? 0 : normalized(group.fields.kondisiMotor) === 'rusak' ? 1 : 2
const personil = value => /^\d+(?:[.,]\d+)?$/.test(clean(value)) ? Number(clean(value).replace(',', '.')) : -1
export function groupWorkResults(rows = [], { pic = 'ALL', source = 'ALL', checks = {} } = {}) {
  const groups = new Map()
  const seen = new Set()
  for (const row of rows) {
    if (!isDoneOrder(row) || !clean(row.shipment) || (pic !== 'ALL' && normalized(row.pic) !== normalized(pic)) || (source !== 'ALL' && row.source !== source)) continue
    const collected = isWorkCollected(row, checks)
    const signature = workRowSignature(row)
    const identity = JSON.stringify([workRowKey(row), signature])
    if (seen.has(identity)) continue
    seen.add(identity)
    // Empty office fields can merge only with other empty fields. Different
    // values (including blank vs filled) must never produce an ambiguous report.
    const key = JSON.stringify([signature, collected])
    if (!groups.has(key)) groups.set(key, { key, collected, rows: [] })
    groups.get(key).rows.push(row)
  }
  return [...groups.values()].map(group => {
    const fields = Object.fromEntries(WORK_FIELDS.map(([key]) => [key, key === 'shipment' ? unique(group.rows.map(row => row.shipment)).join(', ') : clean(group.rows[0][key])]))
    return {
      ...group, fields, shipments: unique(group.rows.map(row => row.shipment)),
      sources: unique(group.rows.map(row => row.source)), stores: unique(group.rows.map(row => row.kodeToko)),
      // A modified previously collected row needs to be reviewed again.
      updated: !group.collected && group.rows.some(row => Object.hasOwn(checks, workRowKey(row))),
    }
  }).sort((a, b) => Number(a.collected) - Number(b.collected)
    || motorRank(a) - motorRank(b)
    || compare(normalized(a.fields.grouping), normalized(b.fields.grouping))
    || personil(b.fields.jumlahPersonil) - personil(a.fields.jumlahPersonil)
    || compare(normalized(a.fields.kendala), normalized(b.fields.kendala))
    || compare(a.key, b.key))
}
export function workProgress(groups) {
  const completed = groups.filter(group => group.collected)
  return { completed: completed.length, total: groups.length, percent: groups.length ? Math.round(completed.length / groups.length * 100) : 0, shipments: unique(groups.flatMap(g => g.shipments)).length, completedShipments: unique(completed.flatMap(g => g.shipments)).length }
}
export function allWorkNotes(groups) { return unique(groups.map(group => group.fields.kendala)).join(', ') }
const readObject = (storage, key) => {
  try { const saved = JSON.parse(storage.getItem(key) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {} } catch { return {} }
}
export const workStorageKey = (scope, date) => `sapa_work_results_v2:${scope}:${date}`
export function loadWorkChecks(storage, scope, date, rows) {
  const storageKey = workStorageKey(scope, date)
  // Presence of v2 (even {}) prevents unchecked rows from being restored by v1.
  try { if (storage.getItem(storageKey) !== null) return readObject(storage, storageKey) } catch { return {} }
  let checks = {}
  const pics = unique(['ALL', ...rows.map(row => row.pic)])
  // Import the exact row snapshots in old group checkmarks. Never mark current
  // additions complete merely because the previous group had been checked.
  for (const batch of ['1', '2']) for (const pic of pics) for (const source of ['ALL', 'DS', 'REG']) {
    const saved = readObject(storage, `sapa_work_results_v1:${scope}:${date}:${batch}:${pic}:${source}`)
    for (const signature of Object.values(saved)) {
      try {
        const oldRows = JSON.parse(signature)
        if (!Array.isArray(oldRows)) continue
        for (const values of oldRows) {
          if (!Array.isArray(values) || values.length !== 8 || values.some(value => typeof value !== 'string')) continue
          const [rowSource, rowPic, ...fields] = values
          const row = { source: rowSource, pic: rowPic, ...Object.fromEntries(WORK_FIELDS.map(([field], i) => [field, fields[i]])) }
          if (clean(row.shipment)) checks = setWorkCollected(checks, [row], true)
        }
      } catch { /* Ignore malformed historic checkmarks. */ }
    }
  }
  return checks
}
