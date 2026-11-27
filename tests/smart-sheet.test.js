import test from 'node:test'
import assert from 'node:assert/strict'
import { smartSheetEntries, smartSheetEntriesAtHour, planFollowUpCarry, FOLLOW_UP_FIELDS } from '../src/utils/smartSheet.js'
import { createFollowUpSync } from '../server/followUpSync.js'

const date = '2026-11-26'
const row = (extra = {}) => ({ source: 'REG', sheetMode: 'daily', sheetDate: date, sheetTitle: 'REG 26/11', pic: 'PIC TEST', shipment: 'SHIP-1', kodeToko: 'T001', jam: '10.00', sheetRow: 3, ...Object.fromEntries(FOLLOW_UP_FIELDS.map(f => [f.key, ''])), ...extra })
const filled = row({ sheetStatus: 'Done (Sudah dihubungi)', kondisiMotor: 'Baik', jumlahPersonil: '4', namaPejabat: 'Pejabat Contoh', kendala: '=teks literal', grouping: 'Motor Bermasalah' })
const latest = row({ jam: '11:00', sheetRow: 8 })
test('one row per shipment uses latest hour; inherits six fields without mutating or dropping source history', () => {
  const input = [latest, filled]
  const before = structuredClone(input)
  const [entry] = smartSheetEntries(input)
  assert.equal(entry.row.sheetRow, 8)
  assert.equal(entry.history.length, 2)
  for (const f of FOLLOW_UP_FIELDS) assert.equal(entry.effective[f.key], filled[f.key])
  assert.equal(Object.keys(entry.inherited).length, 6)
  assert.deepEqual(input, before)
  const plan = planFollowUpCarry(input, { pic: 'pic test' })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].row.sheetRow, 8)
  assert.equal(Object.keys(plan[0].changes).length, 6)
})
test('filled newer values win; previous day, store, PIC, source, blank and invalid hours never leak', () => {
  const newer = { ...latest, sheetStatus: 'Proses', jumlahPersonil: '0', kendala: 'Kendala baru' }
  const plan = planFollowUpCarry([filled, newer], { pic: 'PIC TEST' })
  assert.deepEqual(Object.keys(plan[0].changes), ['kondisiMotor', 'namaPejabat', 'grouping'])
  for (const different of [{ source: 'DS' }, { pic: 'OTHER' }, { kodeToko: 'OTHER' }, { sheetDate: '2026-11-25' }, { shipment: 'OTHER' }, { jam: '' }, { jam: 'bad' }]) {
    assert.equal(planFollowUpCarry([{ ...filled, ...different }, latest], { pic: 'PIC TEST' }).length, 0)
  }
  assert.equal(planFollowUpCarry([filled, { ...latest, jam: '' }], { pic: 'PIC TEST' }).length, 0)
})
test('repeated same-hour data stays one display row; ambiguous peers do not auto-overwrite; future never copies backward', () => {
  const same = { ...latest, sheetRow: 9 }
  assert.equal(smartSheetEntries([filled, latest, same]).length, 1)
  assert.equal(planFollowUpCarry([filled, latest, same], { pic: 'PIC TEST' }).length, 2)
  const conflict = { ...same, sheetStatus: 'Proses' }
  const plan = planFollowUpCarry([filled, latest, conflict], { pic: 'PIC TEST' })
  assert.ok(plan.every(p => !('sheetStatus' in p.changes)))
  assert.ok(smartSheetEntries([filled, latest, conflict])[0].conflicts.includes('sheetStatus'))
  assert.equal(planFollowUpCarry([row(), { ...filled, jam: '12.00', sheetRow: 9 }], { pic: 'PIC TEST' }).length, 0)
})
test('a historical JAM shows its recorded DONE status even when the latest status differs', () => {
  const entries = smartSheetEntries([filled, { ...latest, sheetStatus: 'Proses' }])
  assert.equal(entries[0].effective.sheetStatus, 'Proses')
  const [morning] = smartSheetEntriesAtHour(entries, '10.00')
  assert.equal(morning.row.sheetRow, filled.sheetRow)
  assert.equal(morning.effective.sheetStatus, filled.sheetStatus)
  assert.equal(morning.history.length, 2)
  assert.deepEqual(smartSheetEntriesAtHour(entries, '09.00'), [])
})
test('a blank duplicate at the same JAM does not hide a recorded DONE status or trigger a write', () => {
  const rows = [{ ...latest, sheetStatus: filled.sheetStatus }, { ...latest, sheetRow: 9 }]
  const [entry] = smartSheetEntries(rows)
  assert.equal(entry.effective.sheetStatus, filled.sheetStatus)
  assert.ok(entry.conflicts.includes('sheetStatus'))
  assert.deepEqual(planFollowUpCarry(rows, { pic: 'PIC TEST' }), [])
})
test('carry is idempotent and picks the nearest preceding nonblank field, not the first row', () => {
  const middle = row({ jam: '10:30', sheetRow: 5, kendala: 'Catatan terbaru' })
  const plan = planFollowUpCarry([latest, middle, filled], { pic: 'PIC TEST' })
  assert.equal(plan[0].changes.kendala, 'Catatan terbaru')
  const updated = { ...latest, ...plan[0].changes }
  assert.equal(planFollowUpCarry([filled, middle, updated], { pic: 'PIC TEST' }).length, 0)
})

const header = ['JAM','No AC','Nama AC','Kode Toko','Nama Toko','Cabang','Region','Shipment','Nama Konsumen','SLA','Nama AM','No AM','POD AC','APV AM','PIC','Status','Kondisi Motor','Jumlah Personil','Nama Pejabat','KENDALA','Grouping','Other']
function fixture({ busy = false, fail = false, stale = false, formula = false, moved = false, headerBad = false } = {}) {
  let rows = [filled, latest], writes = [], audits = [], released = false
  const database = async (path, options = {}) => {
    if (path.startsWith('sapa_source_cache?on_conflict')) return busy ? [] : [{ id: 'lock' }]
    if (path === 'sapa_sheet_audit') { assert.ok(['REG', 'DS'].includes(options.body.source)); audits.push(options.body); return [{ id: 'audit' }] }
    if (options.method === 'DELETE' && path.includes('snapshot')) released = true
    return []
  }
  const googleRequest = async (_id, suffix, options = {}) => {
    if (options.method === 'POST') {
      writes.push(options.body)
      if (fail) throw Error('Ambiguous timeout')
      rows = rows.map(r => r.sheetRow === 8 ? { ...r, ...planFollowUpCarry(rows, { pic: 'PIC TEST' })[0].changes } : r)
      return {}
    }
    const cells = ['11:00', '', '', 'T001', '', '', '', moved ? 'ANOTHER' : 'SHIP-1', '', '', '', '', '', '', '=XLOOKUP()', formula ? '=IF(TRUE,"","")' : '']
    return { valueRanges: [{ values: [[...header.slice(0, 20), headerBad ? 'Status' : 'Grouping', 'Other']] }, { values: [cells] }] }
  }
  return { sync: createFollowUpSync({ monitoring: async () => ({ rows, stale, date }), database, googleRequest, now: () => Date.parse('2026-11-26T05:00:00Z'), invalidate: async () => {} }), writes, audits, released: () => released }
}
const body = { date, mode: 'daily', targetPic: 'PIC TEST', source: 'ALL' }
test('carry API writes exactly six RAW cells P:U, preserves formula PIC and old rows, audits and does not repeat', async () => {
  const f = fixture()
  const result = await f.sync(body, 'PIC:PIC TEST')
  assert.equal(result.updatedRows, 1); assert.equal(result.updatedCells, 6)
  assert.equal(f.writes[0].valueInputOption, 'RAW')
  assert.deepEqual(f.writes[0].data.map(d => d.range), ['P','Q','R','S','T','U'].map(c => `'REG 26/11'!${c}8`))
  assert.equal(f.writes[0].data[4].values[0][0], '=teks literal')
  assert.equal(f.released(), true)
  assert.equal((await f.sync(body, 'PIC:PIC TEST')).updatedRows, 0)
  assert.equal(f.writes.length, 1)
})
test('carry blocks changed positions, destination formulas, stale source, bad headers and concurrent imports before any write', async () => {
  for (const options of [{ busy: true }, { stale: true }, { formula: true }, { moved: true }, { headerBad: true }]) {
    const f = fixture(options)
    await assert.rejects(f.sync(body, 'PIC:PIC TEST'))
    assert.equal(f.writes.length, 0)
  }
  for (const overrides of [{ date: '2026-11-25' }, { targetPic: 'ALL' }, { mode: 'linked' }, { source: 'BAD' }]) await assert.rejects(fixture().sync({ ...body, ...overrides }, 'PIC:PIC TEST'), { status: 400 })
})
test('an uncertain Google write stays locked and is not automatically retried', async () => {
  const f = fixture({ fail: true })
  await assert.rejects(f.sync(body, 'PIC:PIC TEST'), /belum dapat dipastikan/)
  assert.equal(f.writes.length, 1)
  assert.equal(f.released(), false)
})
