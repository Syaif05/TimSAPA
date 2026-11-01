import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { matchSapaWithContacts, groupRowsByAc } from '../src/utils/matcher.js'
const contacts = [{ store: 'T001', acName: 'TEST AC', cugAc: '081234567891', amName: 'OLD AM', cugAm: '081234567892' }]
const row = { source: 'REG', namaAc: 'TEST AC', kodeToko: 'T001', shipment: 'S-TEST', noAc: '081234567890', noAm: '081234567893', amName: 'LIVE AM', sheetStatus: 'Done' }
test('live sheet phone and AM take precedence over sample contacts', () => {
  const [enriched] = matchSapaWithContacts([row], contacts)
  assert.equal(enriched.resolvedPhone, '6281234567890')
  assert.equal(enriched.amName, 'LIVE AM')
  assert.equal(enriched.cugAm, '6281234567893')
  assert.equal(enriched.matchSource, 'sheet_data')
})
test('invalid live phone falls back to contact database; manual behavior is retained', () => {
  assert.equal(matchSapaWithContacts([{ ...row, noAc: '0' }], contacts)[0].resolvedPhone, '6281234567891')
  assert.equal(matchSapaWithContacts([{ ...row, source: undefined }], contacts)[0].resolvedPhone, '6281234567891')
})
test('Google order status remains separate from local chat status', () => {
  const enriched = matchSapaWithContacts([row], contacts)
  const [group] = groupRowsByAc(enriched, { 'TEST AC': 'sudah_dihubungi' })
  assert.equal(group.status, 'sudah_dihubungi')
  assert.equal(group.rows[0].sheetStatus, 'Done')
})

test('new contact spreadsheet is authoritative for current store assignment and AC number', () => {
  const current = [{ ...contacts[0], contactSource: 'spreadsheet', acName: 'CURRENT AC' }]
  const [enriched] = matchSapaWithContacts([row], current, { preferMasterContacts: true })
  assert.equal(enriched.resolvedAcName, 'CURRENT AC')
  assert.equal(enriched.resolvedPhone, '6281234567891')
  assert.equal(enriched.matchSource, 'contacts_sheet')
  assert.equal(enriched.amName, 'OLD AM')
})

let podSource = await readFile(new URL('../src/utils/podManager.js', import.meta.url), 'utf8')
podSource = podSource.replace("'./phoneUtils'", JSON.stringify(new URL('../src/utils/phoneUtils.js', import.meta.url).href))
const { matchPodWithContacts } = await import(`data:text/javascript;base64,${Buffer.from(podSource).toString('base64')}`)
test('POD does not fall back to sample phone numbers after removing the local contact menu', () => {
  const [item] = matchPodWithContacts([{ namaAc: 'ANDI SUPRIYADI', acKey: 'ANDI_SUPRIYADI' }], [])
  assert.equal(item.phone, '')
  assert.equal(item.hasPhone, false)
})
test('POD uses current contact sheet values by AC name', () => {
  const [item] = matchPodWithContacts([{ namaAc: 'TEST AC', acKey: 'TEST_AC' }], contacts)
  assert.equal(item.phone, '6281234567891')
  assert.equal(item.hasPhone, true)
})
