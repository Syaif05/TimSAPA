// Spreadsheet order status is independent from the local chat workflow status.
export const normalizeOrderStatus = value => String(value ?? '').trim().toUpperCase()
export const isDoneOrder = row => normalizeOrderStatus(row?.sheetStatus) === 'DONE'
export const activeOrders = rows => (rows || []).filter(row => !isDoneOrder(row))
export const sourcePriority = source => source === 'DS' ? 0 : source === 'REG' ? 1 : 2
export const sortOrdersBySource = rows => [...rows].sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source))
export function orderSetKey(rows = []) {
  return JSON.stringify(rows.map(row => [row.source || '', row.id || row.shipment || '', row.shipment || '']).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))))
}
export function activeOrderGroup(group) {
  if (!group) return group
  const rows = activeOrders(group.rows)
  // Reuse safe groups to keep memoization and interactive edits stable.
  if (rows.length === (group.rows || []).length) return group
  const stores = [...new Map(rows.map(row => [row.kodeToko, `${row.kodeToko} - ${row.namaToko}`])).values()]
  const slaBreakdown = {}
  rows.forEach(row => { const key = row.sla || 'Lainnya'; slaBreakdown[key] = (slaBreakdown[key] || 0) + 1 })
  return { ...group, rows, totalShipments: rows.length, totalStores: new Set(rows.map(row => row.kodeToko).filter(Boolean)).size, storesList: stores, slaBreakdown }
}
export function reconcileOrderDraft({ currentMessage, previousMessage, nextMessage, previousOrders, nextOrders }) {
  return previousOrders !== nextOrders || currentMessage === previousMessage ? nextMessage : currentMessage
}
// Counts ignore the working-status filter, so DONE remains measurable without entering the queue.
export function summarizeOrders(rows = [], { source = 'ALL', pic = 'ALL' } = {}) {
  const byPic = new Map()
  const total = { total: 0, done: 0, pending: 0 }
  for (const row of rows) {
    if (source !== 'ALL' && row.source !== source) continue
    const name = String(row.pic || 'Tanpa PIC').trim().toUpperCase()
    let item = byPic.get(name)
    if (!item) { item = { pic: name, total: 0, done: 0, pending: 0 }; byPic.set(name, item) }
    const status = isDoneOrder(row) ? 'done' : 'pending'
    item.total++; item[status]++
    if (pic === 'ALL' || name === String(pic).trim().toUpperCase()) { total.total++; total[status]++ }
  }
  return { ...total, pic, source, byPic: [...byPic.values()].sort((a, b) => a.pic.localeCompare(b.pic)) }
}
