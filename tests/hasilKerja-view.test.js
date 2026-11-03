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
const row = (n, values = {}) => ({ shipment:`S${n}`,pic:'ANA',source:'REG',sheetStatus:'DONE',kendala:`Kendala ${n}`,kondisiMotor:'RUSAK',grouping:'Follow up',...values })
const render = rows => renderToStaticMarkup(React.createElement(HasilKerjaView, { rows,date:'2026-11-03',scope:'daily',storage:{getItem:()=>null},showToast:()=>{} }))
test('compact results paginate four cards while floating progress and note recap cover all groups', () => {
  const html = render(Array.from({length:10},(_,i)=>row(i)))
  assert.equal((html.match(/class="work-result-card /g)||[]).length,4)
  assert.match(html,/work-progress-floating/)
  assert.match(html,/0\/10 kelompok/)
  assert.match(html,/Kendala 9/,'all notes recap contains groups beyond page one')
})
test('copy controls exclude radio/dropdown fields and warn only for empty notes', () => {
  const html = render([row(1),row(2,{kendala:''})])
  assert.match(html,/work-badge is-broken/)
  assert.doesNotMatch(html,/Salin Status Equipment Motor|Salin Hasil Follow Up/)
  assert.match(html,/Salin Nomor Shipment/)
  assert.match(html,/Kendala kosong/)
  assert.doesNotMatch(html,/Ada data kosong/)
})
