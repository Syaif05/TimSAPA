import test from 'node:test'
import assert from 'node:assert/strict'
import { EQUIPMENT_ANNOUNCEMENT, renderAcAnnouncement } from '../src/utils/acAnnouncement.js'
const ac = { name: 'TEST AC', stores: ['A001', 'B002'], branches: ['JAKARTA'], regionals: ['REG 1'], amNames: ['TEST AM'] }
test('equipment announcement preserves form and deadline and personalizes recipient scope', () => {
  const text = renderAcAnnouncement(EQUIPMENT_ANNOUNCEMENT, ac)
  assert.match(text, /Bapak\/Ibu TEST AC/)
  assert.match(text, /Cabang: JAKARTA\nRegional: REG 1\nToko dalam daftar ini: 2/)
  assert.match(text, /https:\/\/forms.gle\/1LvjcNgSGBC5pruS9/)
  assert.match(text, /Rabu, 4 November 2026 pukul 10.00 WIB/)
  assert.notEqual(text, renderAcAnnouncement(EQUIPMENT_ANNOUNCEMENT, { ...ac, name: 'OTHER AC' }))
})
test('missing regional is omitted from default scope; custom and empty messages are preserved', () => {
  const text = renderAcAnnouncement(EQUIPMENT_ANNOUNCEMENT, { ...ac, regionals: ['BELUM DIISI'] })
  assert.doesNotMatch(text, /Regional:|BELUM DIISI/)
  assert.equal(renderAcAnnouncement('{nama_ac}: {total_toko} {kode_toko} {am}', ac), 'TEST AC: 2 A001, B002 TEST AM')
  assert.equal(renderAcAnnouncement('', ac), '')
  assert.equal(renderAcAnnouncement('custom', ac), 'custom')
  assert.equal(renderAcAnnouncement(EQUIPMENT_ANNOUNCEMENT, null), '')
})
