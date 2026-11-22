import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { transformWithOxc } from 'vite'
const file = new URL('../src/components/HasilKerjaView.jsx', import.meta.url)
let { code } = await transformWithOxc(await readFile(file, 'utf8'), file.pathname, { jsx: { runtime: 'classic' } })
for (const [, specifier] of [...code.matchAll(/from\s+"([^"]+)"/g)]) {
  const target = specifier.startsWith('.') ? new URL(`${specifier}.js`, file).href : import.meta.resolve(specifier)
  code = code.replaceAll(`from "${specifier}"`, `from ${JSON.stringify(target)}`)
}
const { HasilKerjaView } = await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)
import {setWorkCollected,workStorageKey} from '../src/utils/hasilKerja.js'
const row = (n, values = {}) => ({ shipment:`S${n}`,pic:'ANA',source:'REG',sheetStatus:'DONE',kendala:`Kendala ${n}`,kondisiMotor:'RUSAK',grouping:'Follow up',...values })
const render = (rows,checks=null) => renderToStaticMarkup(React.createElement(HasilKerjaView, { rows,date:'2026-11-03',scope:'daily',storage:{getItem:key=>key===workStorageKey('daily','2026-11-03') && checks ? JSON.stringify(checks) : null},showToast:()=>{} }))
test('all groups appear on a single page with floating progress and full recap', () => {
  const html = render(Array.from({length:10},(_,i)=>row(i)))
  assert.equal((html.match(/class="work-result-card /g)||[]).length,10)
  assert.doesNotMatch(html,/Halaman berikutnya|per halaman/)
  assert.match(html,/work-progress-floating/)
  assert.match(html,/0\/10 kelompok/)
  assert.match(html,/Kendala 9/,'all notes recap contains all groups')
})
test('copy controls exclude radio/dropdown fields and warn only for empty notes', () => {
  const html = render([row(1),row(2,{kendala:''})])
  assert.match(html,/work-badge is-broken/)
  assert.doesNotMatch(html,/Salin Status Equipment Motor|Salin Hasil Follow Up/)
  assert.match(html,/Salin Nomor Shipment/)
  assert.match(html,/Kendala kosong/)
  assert.doesNotMatch(html,/Ada data kosong/)
})

test('office fields follow report order with notes placed last', () => {
  const html = render([row(1,{jumlahPersonil:'2',namaPejabat:'TEST'})])
  const fields = ['shipment','jumlahPersonil','namaPejabat','kondisiMotor','grouping','kendala']
  const positions = fields.map(field => html.indexOf(`work-field-${field}`))
  assert.ok(positions.every((position,index) => position >= 0 && (!index || position > positions[index-1])))
})

test('new shipments and modified office fields stay above previously collected rows in actual UI', () => {
  const previous = row(1,{sheetStatus:'Done (Sudah dihubungi)'})
  const addition = {...previous,shipment:'S-NEW'}
  const html=render([previous,addition],setWorkCollected({},[previous],true))
  assert.match(html,/1<\/strong> Shipment belum dikumpulkan/)
  assert.match(html,/1<\/strong> sudah dikumpulkan/)
  assert.ok(html.indexOf('S-NEW') < html.indexOf('is-collected'))
  const updated=render([{...previous,jumlahPersonil:'5'}],setWorkCollected({},[previous],true))
  assert.match(updated,/Data berubah · cek ulang/)
  assert.doesNotMatch(updated,/work-result-card is-collected/)
  assert.doesNotMatch(html,/Penyerahan 1|Penyerahan 2/)
})
