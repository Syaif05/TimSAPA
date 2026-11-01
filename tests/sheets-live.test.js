import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseMonitoringSheet, filterSheetRows } from '../src/utils/sheetsParser.js'
import { dailySheetTitle, jakartaDate } from '../src/utils/sheetsConfig.js'
import { createSheetsReader } from '../server/sheetsData.js'
import { sheetsPlugin } from '../server/sheetsPlugin.js'
const csv = 'ABRAR,0,SYAIFUL,0\r\nJam,No AC,Nama AC,Kode Toko,Nama Toko,Cabang,Region,Shipment,Nama Konsumen,SLA,Nama AM,No AM,POD AC,APV AM,PIC,Status,Kondisi Motor,Jumlah Personil,Nama Pejabat,Kendala,Grouping,GLI\r\n13.00,081234567890,TEST AC,T001,"Toko, Satu",DC TEST,REG TEST,S-TEST-001,CONSUMER,4. > 1 Jam,TEST AM,081234567891,,,SYAIFUL,Proses,,,,"Catatan\nbaris kedua",Group,FALSE\r\n14.00,081234567890,TEST AC,T001,Toko Satu,DC TEST,REG TEST,S-TEST-002,CONSUMER,5. > 2 Jam,,,,,ANA,Done\r\n15.00,081234567890,TEST AC,T001,Toko Satu,DC TEST,REG TEST,S-TEST-003,CONSUMER,5. > 2 Jam,,,,,SYAIFUL,\r\n,,,,,,,'
const response = text => ({ ok: true, status: 200, headers: new Headers({ 'content-type': 'text/csv' }), text: async () => text })

test('parses real two-header layout, leading zeroes, commas and multiline cells', () => {
  const rows = parseMonitoringSheet(csv, 'REG')
  assert.equal(rows.length, 3)
  assert.equal(rows[0].sheetRow, 3)
  assert.equal(rows[0].noAc, '081234567890')
  assert.equal(rows[0].namaToko, 'Toko, Satu')
  assert.equal(rows[0].kendala, 'Catatan\nbaris kedua')
  assert.equal(rows[0].sheetStatus, 'Proses')
  assert.equal(rows[0].source, 'REG')
  assert.equal(rows[0].pic, 'SYAIFUL')
  assert.equal(rows[0].status, undefined, 'source status must not become local chat status')
  assert.deepEqual(rows.map(row => row.id), parseMonitoringSheet(csv, 'REG').map(row => row.id))
})
test('rejects login pages, malformed CSV and unrelated sheets rather than guessing columns', () => {
  for (const text of ['<html>Sign in</html>', 'Region,Cabang\nTest,DC', '"Unclosed']) assert.throws(() => parseMonitoringSheet(text, 'DS'))
})
test('combines sources, defaults can filter SYAIFUL and hide Done, while Done remains selectable', () => {
  const reg = parseMonitoringSheet(csv, 'REG')
  const ds = parseMonitoringSheet(csv, 'DS')
  assert.equal(filterSheetRows([...reg, ...ds], { pic: 'SYAIFUL', orderStatus: 'ACTIVE' }).length, 4)
  assert.equal(filterSheetRows([...reg, ...ds], { source: 'DS', pic: 'SYAIFUL' }).length, 2)
  assert.equal(filterSheetRows(reg, { orderStatus: 'Done' }).length, 1)
  assert.equal(filterSheetRows(reg, { orderStatus: 'EMPTY' }).length, 1)
  assert.equal(filterSheetRows(reg, { orderStatus: 'ALL' }).length, 3)
})
test('Jakarta date rollover and valid daily tab selection', () => {
  assert.equal(jakartaDate(new Date('2026-10-31T18:00:00Z')), '2026-11-01')
  assert.equal(dailySheetTitle('REG', '2026-11-01'), 'REG 01/11')
  assert.throws(() => dailySheetTitle('REG', '2026-02-31'))
  assert.throws(() => dailySheetTitle('REG', 'invalid'))
})
test('read-only requests use fixed workbook, cache and coalesce, then refresh after 30 seconds', async () => {
  let time = 100000
  const calls = []
  const read = createSheetsReader(async (url, options) => { calls.push({ url: new URL(url), options }); return response(csv) }, () => time)
  const [a, b] = await Promise.all([read({ mode: 'daily', date: '2026-10-31' }), read({ mode: 'daily', date: '2026-10-31' })])
  assert.strictEqual(a, b)
  assert.equal(a.rows.length, 6)
  assert.equal(calls.length, 2)
  assert.ok(calls.every(c => c.options.method === 'GET' && c.options.credentials === 'omit'))
  assert.equal(calls[0].url.searchParams.get('sheet'), 'REG 31/10')
  assert.equal(calls[1].url.searchParams.get('sheet'), 'DS 31/10')
  assert.strictEqual(await read({ mode: 'daily', date: '2026-10-31' }), a)
  time += 31000
  const updated = await read({ mode: 'daily', date: '2026-10-31' })
  assert.equal(calls.length, 4)
  assert.equal(updated.revision, a.revision)
  assert.notEqual(updated.fetchedAt, a.fetchedAt)
  const nextDay = await read({ mode: 'daily', date: '2026-11-01' })
  assert.notEqual(nextDay.revision, a.revision)
  assert.equal(calls[4].url.searchParams.get('sheet'), 'REG 01/11')
})
test('one failed source rejects the whole new snapshot and can recover', async () => {
  let fail = true
  const read = createSheetsReader(async url => {
    if (new URL(url).searchParams.get('gid') === '960401050' && fail) throw new Error('Network offline')
    return response(csv)
  })
  await assert.rejects(read(), /offline/)
  fail = false
  const snapshot = await read()
  assert.equal(snapshot.sources.length, 2)
  assert.equal(snapshot.rows.length, 6)
})
test('method guard refuses writes and uses ETag to avoid retransmitting unchanged rows', async () => {
  let handler
  let reads = 0
  const configured = sheetsPlugin({ read: async () => { reads++; return { revision: 'test', fetchedAt: '2026-10-31T10:00:00Z', rows: [] } } }).configureServer({ middlewares: { use: (_path, callback) => { handler = callback; return () => assert.fail('must not register connect as a Vite post hook') } } })
  assert.equal(configured, undefined)
  const run = async (method, headers = {}) => {
    const values = {}
    const res = { statusCode: 200, setHeader: (key, value) => { values[key] = value }, end: body => { res.body = body } }
    await handler({ method, headers, url: '?mode=daily&date=2026-10-31' }, res)
    return { ...res, headers: values }
  }
  assert.equal((await run('POST')).statusCode, 405)
  assert.equal(reads, 0)
  assert.equal((await run('GET')).statusCode, 200)
  const unchanged = await run('GET', { 'if-none-match': '"test"' })
  assert.equal(unchanged.statusCode, 304)
  assert.equal(unchanged.body, undefined)
  assert.equal(unchanged.headers['Cache-Control'], 'no-store')
})
