import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile, access } from 'node:fs/promises'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import Papa from 'papaparse'
import { transformWithOxc } from 'vite'
import { filterMonitoringGroups, filterSpreadsheetEntries, matchesSla, SHEET_COLUMNS, VISIBLE_SHEET_COLUMNS, sortSpreadsheetColumn, spreadsheetEntries, spreadsheetRows, spreadsheetTsv } from '../src/utils/monitoringView.js'
import { renderTemplate } from '../src/utils/templateEngine.js'
const rows = [
  { id:'a',sheetRow:8,source:'DS',pic:'ANA',jam:'08.00',shipment:'TEST-DS-8',kodeToko:'D8',namaToko:'CONTOH 8',sla:'7. > 12 Jam',sheetStatus:'Proses' },
  { id:'b',sheetRow:3,source:'DS',pic:'ANA',jam:'09.00',shipment:'TEST-DS-3',kodeToko:'D3',namaToko:'CONTOH 3',sla:'4. > 1 Jam',sheetStatus:'' },
  { id:'c',sheetRow:6,source:'DS',pic:'ANA',jam:'09.00',shipment:'TEST-DONE',kodeToko:'DONE-STORE',namaToko:'DONE STORE',sla:'5. > 2 Jam',sheetStatus:' DONE ' },
  { id:'d',sheetRow:2,source:'REG',pic:'SYAIFUL',jam:'08.00',shipment:'TEST-REG-2',kodeToko:'R2',namaToko:'CONTOH REG',sla:'5. > 2 Jam',sheetStatus:'Proses' },
]
const groups = [{ acKey:'DS::A',source:'DS',acName:'AC CONTOH A',phone:'',rows:rows.slice(0,3),totalShipments:3,totalStores:3,storesList:['DONE STORE'] }, {acKey:'REG::B',source:'REG',acName:'AC CONTOH B',phone:'',rows:[rows[3]],totalShipments:1,totalStores:1}]
test('both monitoring views filter individual orders and regenerate message/table totals', () => {
  const filtered = filterMonitoringGroups(groups, {pic:'ANA',jam:'09.00',sla:'1_JAM'}, '')
  assert.equal(filtered.length,1)
  assert.deepEqual(filtered[0].rows.map(row=>row.shipment),['TEST-DS-3'])
  assert.equal(filtered[0].totalShipments,1);assert.equal(filtered[0].totalStores,1)
  const text=renderTemplate('{total_shipment}|{total_toko}|{daftar_shipment}',filtered[0])
  assert.ok(text.startsWith('1|1|'));assert.ok(!text.includes('TEST-DONE'));assert.ok(!text.includes('TEST-DS-8'))
  assert.equal(filterMonitoringGroups(groups,{},'TEST-DS-8')[0].rows.length,1)
  assert.equal(filterMonitoringGroups(groups,{status:'sudah_dihubungi'},'',{'DS::A':'sudah_dihubungi'})[0].acKey,'DS::A')
  assert.equal(groups[0].rows.length,3,'source group remains immutable')
})
test('SLA 1 and 2 hours never accidentally match 12 hours', () => {
  assert.equal(matchesSla('7. > 12 Jam','1_JAM'),false)
  assert.equal(matchesSla('7. > 12 Jam','2_JAM'),false)
  assert.equal(matchesSla('7. > 12 Jam','CRITICAL'),true)
  assert.equal(matchesSla('4. > 1 Jam','1_JAM'),true)
  assert.equal(matchesSla('2. > 30 Menit','UNDER_1'),true)
})
test('spreadsheet sorts by store, AC, then PIC and hides source columns K–M', () => {
  const actual=spreadsheetEntries([...groups].reverse())
  assert.deepEqual(actual.map(entry=>entry.row.shipment),['TEST-DS-3','TEST-DS-8','TEST-REG-2'])
  assert.equal(new Set(actual.map(entry=>entry.key)).size,3)
  assert.equal(SHEET_COLUMNS.length,22)
  assert.deepEqual(VISIBLE_SHEET_COLUMNS.map(column=>column.letter).filter(letter=>['K','L','M'].includes(letter)),[])
  assert.ok(VISIBLE_SHEET_COLUMNS.some(column=>column.letter==='N'))
  const ordered=spreadsheetRows([{...rows[0],kodeToko:'B',namaAc:'Z',pic:'ANA'},{...rows[1],kodeToko:'A',namaAc:'Z',pic:'ANA'},{...rows[3],kodeToko:'A',namaAc:'A',pic:'SYAIFUL'}],[])
  assert.deepEqual(ordered.map(entry=>entry.row.shipment),['TEST-REG-2','TEST-DS-3','TEST-DS-8'])
  assert.equal(SHEET_COLUMNS[0].letter,'A');assert.equal(SHEET_COLUMNS.at(-1).letter,'V')
  assert.equal(SHEET_COLUMNS.find(column=>column.key==='sheetStatus').letter,'P')
})
test('copying the filtered table preserves tabs/newlines/quotes and excludes DONE', () => {
  const special={...rows[1],kendala:'Catatan\t"petugas"\nbaris kedua'}
  const entries=spreadsheetEntries([{...groups[0],rows:[special,rows[2]]}])
  const tsv=spreadsheetTsv(entries)
  const parsed=Papa.parse(tsv,{delimiter:'\t'}).data
  assert.equal(parsed.length,2)
  assert.equal(parsed[1][parsed[0].indexOf('Kendala')],special.kendala)
  assert.ok(!tsv.includes('TEST-DONE'))
})
test('column checkboxes filter DONE and combine with other columns without changing source rows', () => {
  const entries=spreadsheetRows(rows, groups)
  const withoutDone=filterSpreadsheetEntries(entries,{sheetStatus:['DONE']})
  assert.equal(withoutDone.length,3)
  assert.ok(!withoutDone.some(entry=>entry.row.shipment==='TEST-DONE'))
  const onlyAna=filterSpreadsheetEntries(withoutDone,{sheetStatus:['DONE'],pic:['SYAIFUL']})
  assert.deepEqual(onlyAna.map(entry=>entry.row.shipment),['TEST-DS-3','TEST-DS-8'])
  assert.equal(rows.length,4)
  assert.ok(!spreadsheetTsv(withoutDone,{includeDone:true}).includes('TEST-DONE'))
  assert.equal(sortSpreadsheetColumn(entries,'kodeToko','desc')[0].row.kodeToko,'R2')
})

// Compile the real JSX and dependencies, preserving shared module identity.
const compiled=new Map()
async function moduleUrl(file) {
  if(!file.endsWith('.jsx'))return new URL(file,import.meta.url).href
  if(compiled.has(file))return compiled.get(file)
  const promise=(async()=>{
    const source=await readFile(new URL(file,import.meta.url),'utf8')
    let {code}=await transformWithOxc(source,file,{jsx:{runtime:'classic'}})
    const specifiers=[...code.matchAll(/from\s+"([^"]+)"/g)].map(match=>match[1])
    for(const specifier of new Set(specifiers)) {
      let target
      if(specifier.startsWith('.')) {
        const base=new URL(specifier,new URL(file,import.meta.url))
        let resolved=base.href
        if(!/\.(jsx|js)$/.test(resolved)) {
          for(const extension of ['.jsx','.js']) {try{await access(new URL(resolved+extension));resolved+=extension;break}catch{}}
        }
        target=await moduleUrl(resolved)
      } else target=import.meta.resolve(specifier)
      code=code.replaceAll(`from "${specifier}"`,`from ${JSON.stringify(target)}`)
    }
    return `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  })()
  compiled.set(file,promise)
  return promise
}
test('actual spreadsheet DOM caps rows per page, hides K–M and can render DONE', async () => {
  const {MonitoringSheet}=await import(await moduleUrl('../src/components/MonitoringSheet.jsx'))
  const many=Array.from({length:251},(_,i)=>({...rows[1],id:`test-${i}`,sheetRow:i+3,shipment:`VISIBLE-TEST-${i}`}))
  const html=renderToStaticMarkup(React.createElement(MonitoringSheet,{rows:[...many,rows[2]],groups:[],filterKey:'test'}))
  const tbody=html.split('<tbody>')[1].split('</tbody>')[0]
  assert.equal((tbody.match(/<tr /g)||[]).length,100)
  assert.ok(html.includes('Nama Konsumen'));assert.ok(html.includes('Kondisi Motor'))
  assert.ok(html.includes('Filter kolom Status'));assert.ok(html.includes('Filter kolom Kode Toko'))
  assert.ok(!html.includes('Nama AM'));assert.ok(!html.includes('POD AC'));assert.ok(html.includes('APV AM'))
  assert.ok(html.includes('Isi sel terpilih'));assert.ok(html.includes('1–100 dari 252 pesanan'))
  assert.ok(html.includes('VISIBLE-TEST-99'));assert.ok(!html.includes('VISIBLE-TEST-100'))
  const doneHtml=renderToStaticMarkup(React.createElement(MonitoringSheet,{rows:[...many,rows[2]],groups:[],orderStatus:'DONE',filterKey:'done'}))
  assert.ok(doneHtml.includes('TEST-DONE'))
  const done=spreadsheetRows([...many,rows[2]],[],{},'','DONE')
  assert.deepEqual(done.map(entry=>entry.row.shipment),['TEST-DONE'])
})
test('Buka chat stays clickable with a valid number while contacts are syncing', async () => {
  const {AcDetailPanel}=await import(await moduleUrl('../src/components/AcDetailPanel.jsx'))
  const group={...groups[0],rows:[rows[0]],phone:'081234567890',cabang:'',region:'',jam:'08.00',pic:'ANA',status:'belum_dikerjakan',slaBreakdown:{}}
  const html=renderToStaticMarkup(React.createElement(AcDetailPanel,{acGroup:group,renderedMessage:'Pesan uji',contactsReady:false,onStatusChange:()=>{},onPhoneChange:()=>{},showToast:()=>{},currentIndex:0,totalCount:1}))
  const button=html.match(/<button[^>]*class="[^"]*chat-open-button[^"]*"[^>]*>/)?.[0]
  assert.ok(button)
  assert.ok(!button.includes('disabled'))
  assert.ok(html.includes('Kontak belum tersinkron'))
})
