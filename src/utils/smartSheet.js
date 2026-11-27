import { normalizeMonitoringHour } from './monitoringView.js'

export const FOLLOW_UP_FIELDS = [
  { key: 'sheetStatus', label: 'Status', header: 'status', max: 80 },
  { key: 'kondisiMotor', label: 'Kondisi Motor', header: 'kondisimotor', max: 80 },
  { key: 'jumlahPersonil', label: 'Jumlah Personil', header: 'jumlahpersonil', max: 40 },
  { key: 'namaPejabat', label: 'Nama Pejabat', header: 'namapejabat', max: 200 },
  { key: 'kendala', label: 'KENDALA', header: 'kendala', max: 2000 },
  { key: 'grouping', label: 'Grouping', header: 'grouping', max: 300 },
]
export const textValue = value => String(value ?? '').trim()
const identity = value => textValue(value).toUpperCase()
export const followUpKey = row => JSON.stringify([row.sheetMode || '', row.sheetDate || '', row.source, identity(row.pic), identity(row.kodeToko), identity(row.shipment)])
export function hourRank(value) {
  const hour = normalizeMonitoringHour(value)
  return /^\d{2}\.\d{2}$/.test(hour) ? Number(hour.slice(0, 2)) * 60 + Number(hour.slice(3)) : -1
}
const chronological = (a, b) => hourRank(a.jam) - hourRank(b.jam) || a.sheetRow - b.sheetRow

// Group within one date, source, store and PIC. Original source rows are never changed.
// Unknown hours are displayed, but never used as a guess for automatic inheritance.
export function smartSheetEntries(rows) {
  const groups = new Map()
  for (const row of rows) {
    if (!textValue(row.shipment) || !textValue(row.kodeToko)) continue
    const key = followUpKey(row)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(row)
  }
  return [...groups].map(([key, history]) => {
    history.sort(chronological)
    const latest = history.at(-1)
    const peers = history.filter(row => hourRank(row.jam) === hourRank(latest.jam))
    const statuses = peers.filter(row => textValue(row.sheetStatus))
    // Prefer the recorded status over a blank duplicate at the same known hour.
    const hasAgreedStatus = new Set(statuses.map(row => textValue(row.sheetStatus))).size === 1
    const row = hourRank(latest.jam) >= 0 && !textValue(latest.sheetStatus) && hasAgreedStatus ? statuses.at(-1) : latest
    const conflicts = FOLLOW_UP_FIELDS.filter(field => {
      return new Set(peers.map(r => textValue(r[field.key]))).size > 1
    }).map(f => f.key)
    const effective = { ...row }
    const inherited = {}
    // Only earlier *hours*, never another row at the same hour.
    for (const field of FOLLOW_UP_FIELDS) {
      if (conflicts.includes(field.key) || textValue(row[field.key]) || hourRank(row.jam) < 0) continue
      const prior = history.filter(r => hourRank(r.jam) >= 0 && hourRank(r.jam) < hourRank(row.jam) && textValue(r[field.key]))
      const last = prior.at(-1)
      if (!last) continue
      // Conflicting entries at the nearest preceding hour need human review.
      const peers = prior.filter(r => hourRank(r.jam) === hourRank(last.jam))
      if (new Set(peers.map(r => textValue(r[field.key]))).size !== 1) { conflicts.push(field.key); continue }
      effective[field.key] = textValue(last[field.key])
      inherited[field.key] = { jam: normalizeMonitoringHour(last.jam), sheetRow: last.sheetRow }
    }
    return { key, row, effective, inherited, history, conflicts, hours: [...new Set(history.map(r => normalizeMonitoringHour(r.jam)).filter(Boolean))] }
  })
}

// For a specific hour, show the row as it existed then. Later hours cannot
// override its status or supply follow-up values to it.
export function smartSheetEntriesAtHour(entries, hour) {
  const rank = hourRank(hour)
  if (rank < 0) return []
  return entries.flatMap(entry => {
    if (!entry.history.some(row => hourRank(row.jam) === rank)) return []
    const [atHour] = smartSheetEntries(entry.history.filter(row => hourRank(row.jam) <= rank))
    return [{ ...atHour, history: entry.history, hours: entry.hours }]
  })
}

// Carry only into the latest occurrence(s); never rewrite earlier hourly history.
export function planFollowUpCarry(rows, { pic, source = 'ALL' }) {
  const selected = rows.filter(row => identity(row.pic) === identity(pic) && (source === 'ALL' || row.source === source))
  const entries = smartSheetEntries(selected)
  const updates = []
  for (const entry of entries) {
    if (hourRank(entry.row.jam) < 0) continue
    const latest = entry.history.filter(r => hourRank(r.jam) === hourRank(entry.row.jam))
    for (const row of latest) {
      const changes = {}
      for (const field of FOLLOW_UP_FIELDS) {
        if (!entry.conflicts.includes(field.key) && !textValue(row[field.key]) && entry.inherited[field.key]) changes[field.key] = entry.effective[field.key]
      }
      if (Object.keys(changes).length) updates.push({ row, changes })
    }
  }
  return updates
}
