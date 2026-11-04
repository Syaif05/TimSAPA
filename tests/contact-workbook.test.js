import { test } from 'node:test'
import assert from 'node:assert/strict'
import * as XLSX from 'xlsx'
import { parseContactWorkbook } from '../server/contactWorkbook.js'
import { createContactsReader } from '../server/contactsData.js'
import { CONTACTS_SOURCE } from '../src/utils/sheetsConfig.js'
import { sheetsPlugin } from '../server/sheetsPlugin.js'
const header = ['NO CUG TOKO', 'NO CUG AC', 'Store', 'Store Name', 'Cug Toko', 'AC name', 'CUG AC', 'Perbaikan', 'Cabang', 'Regional', 'AM Name', 'CUG AM']
function workbook(rows, name = CONTACTS_SOURCE.sheet) {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), name)
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
}
const fixture = workbook([header, ['CugToko T001', 'CugAC T001', 'T001', 'TEST STORE', 81234567891, 'TEST AC', 81234567890, 81234567899, 'DC TEST', 'REG TEST', 'TEST AM', 81234567892]])
const contact = parseContactWorkbook(fixture)[0]
const emptyCache = () => ({ load: async () => null, save: async () => {} })
const response = bytes => ({ ok: true, status: 200, arrayBuffer: async () => bytes })

test('maps exact contact fields, excluding hyperlink helpers and Perbaikan', () => {
  assert.equal(contact.store, 'T001')
  assert.equal(contact.acName, 'TEST AC')
  assert.equal(contact.cugAc, '6281234567890')
  assert.equal(contact.cugAm, '6281234567892')
  assert.equal(contact.cugToko, '6281234567891')
  assert.equal(contact.contactSource, 'spreadsheet')
})
test('rejects wrong sheet, missing required headers, empty workbook, and HTML login response', () => {
  for (const bytes of [workbook([header], 'Other'), workbook([['store', 'name'], ['T001','Test']]), workbook([header]), Buffer.from('<html>login</html>')]) assert.throws(() => parseContactWorkbook(bytes))
})
test('invalid source phones and placeholder AC names remain empty', () => {
  const result = parseContactWorkbook(workbook([header, ['', '', 'T001', 'Test', '', '-', 'CugAC T001', '', '', '', '', '']]))
  assert.equal(result[0].cugAc, '')
  assert.equal(result[0].acName, '')
})
test('coalesces downloads, caches source data, and performs only credential-free GET', async () => {
  let requests = 0
  let saves = 0
  const reader = createContactsReader({ cache: { load: async () => null, save: async () => { saves++ } }, fetchImpl: async (url, options) => {
    requests++
    assert.equal(url.hostname, 'drive.usercontent.google.com')
    assert.equal(url.searchParams.get('id'), CONTACTS_SOURCE.id)
    assert.equal(options.method, 'GET')
    assert.equal(options.credentials, 'omit')
    return response(fixture)
  } })
  const [first, second] = await Promise.all([reader(), reader()])
  assert.equal(requests, 1)
  assert.equal(saves, 1)
  assert.equal(first.contacts[0].cugAc, contact.cugAc)
  assert.equal(first.revision, second.revision)
  assert.equal((await reader()).stale, false)
  assert.equal(requests, 1)
})
test('keeps verified cached contacts on network failure and reports stale data', async () => {
  const saved = { sourceId: CONTACTS_SOURCE.id, fetchedAt: new Date(0).toISOString(), revision: 'old', contacts: [contact] }
  const reader = createContactsReader({ now: () => 600000, cache: { load: async () => saved, save: async () => assert.fail('must not overwrite cache on error') }, fetchImpl: async () => { throw new Error('offline') } })
  const result = await reader()
  assert.equal(result.contacts[0].store, 'T001')
  assert.equal(result.stale, true)
  await new Promise(resolve => setImmediate(resolve))
  assert.match((await reader()).error, /offline/)
})
test('does not substitute sample contacts when initial source read fails', async () => {
  const reader = createContactsReader({ cache: emptyCache(), fetchImpl: async () => response(Buffer.from('<html>login</html>')) })
  await assert.rejects(reader(), /Excel/)
})
test('contacts endpoint refuses writes and returns conditional GET without retransmitting contacts', async () => {
  const routes = {}
  let reads = 0
  sheetsPlugin({ readContacts: async () => { reads++; return { revision: 'test', fetchedAt: new Date(0).toISOString(), contacts: [contact], stale: false, error: '' } } }).configureServer({ middlewares: { use: (path, handler) => { routes[path] = handler } } })
  const run = async (method, headers = {}) => {
    const result = { statusCode: 200, headers: {}, setHeader(key, value) { this.headers[key] = value }, end(body) { this.body = body } }
    await routes['/api/contacts']({ method, headers }, result)
    return result
  }
  assert.equal((await run('POST')).statusCode, 405)
  assert.equal(reads, 0)
  const first = await run('GET')
  assert.equal(JSON.parse(first.body).contacts.length, 1)
  assert.equal((await run('GET', { 'if-none-match': first.headers.ETag })).statusCode, 304)
})

test('maps November SQL export without inventing missing phone or regional values', async () => {
  const { parseContactRows } = await import('../server/contactRows.js')
  const rows = parseContactRows([
    ['KD_BRANCH', 'NAMA_BRANCH', 'KD_STORE', 'NAMA_STORE', 'NIK AC', 'AC', 'NIK AM', 'AM'],
    ['2JZ1', 'CIANJUR', 'X030', 'TEST STORE', 12075085, 'TEST AC', 13031219, 'TEST AM'],
  ])
  assert.equal(rows[0].store, 'X030')
  assert.equal(rows[0].cabang, 'CIANJUR')
  assert.equal(rows[0].acName, 'TEST AC')
  assert.equal(rows[0].amName, 'TEST AM')
  assert.equal(rows[0].cugAc, '')
  assert.equal(rows[0].cugAm, '')
  assert.equal(rows[0].regional, '')
})

test('reads the eight-column November SAPA tab and ignores the full export tab', () => {
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['KD_STORE'], ['WRONG']]), 'Other export')
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
    ['NAMA_BRANCH','KD_STORE','NAMA_STORE','No AC','AC','NO AM','AM','REG'],
    ['CIANJUR','X030','TEST STORE',81234567890,'TEST AC',81234567891,'TEST AM','REG 1'],
  ]), CONTACTS_SOURCE.sheet)
  const rows = parseContactWorkbook(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }))
  assert.equal(rows.length, 1)
  assert.equal(rows[0].store, 'X030')
  assert.equal(rows[0].cugAc, '6281234567890')
  assert.equal(rows[0].cugAm, '6281234567891')
  assert.equal(rows[0].regional, 'REG 1')
})

test('supervisor structure maps store, AC and AM phones independently without inventing regions', () => {
  const result = parseContactWorkbook(workbook([
    ['Store','Store Name','CUG Toko','AM Name','CUG AM','AC name','CUG AC'],
    ['T001','TEST STORE','0812-3456-7890','TEST AM',81234567891,'TEST AC','0812-3456-7892'],
    ['T002','OTHER STORE',0,'OTHER AM',0,'OTHER AC',0],
  ]))
  assert.equal(result[0].cugToko,'6281234567890')
  assert.equal(result[0].cugAm,'6281234567891')
  assert.equal(result[0].cugAc,'6281234567892')
  assert.equal(result[0].regional,'')
  assert.equal(result[0].cabang,'')
  assert.equal(result[1].cugAc,'')
  assert.equal(result[1].cugAm,'')
})
