import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFile } from 'node:fs/promises'
import { transformWithOxc } from 'vite'
import { activeOrderGroup, activeOrders, isDoneOrder, orderSetKey, reconcileOrderDraft, summarizeOrders } from '../src/utils/orderState.js'
import { workingSheetRows } from '../src/utils/sheetsParser.js'
import { groupRowsByAc } from '../src/utils/matcher.js'
import { renderTemplate } from '../src/utils/templateEngine.js'
import { APPEARANCE_THEMES, DEFAULT_APPEARANCE, appearanceVariables, foregroundColor, normalizeAppearance } from '../src/utils/appearance.js'
import { parseSapaRawText } from '../src/utils/sapaParser.js'
import { validSetting } from '../supabase/functions/pic-profiles/handler.js'
const rows = [
  { id:'1', source:'REG', pic:'ANA', sheetStatus:'Proses', shipment:'S-REG-ACTIVE', kodeToko:'R1', namaToko:'REG ACTIVE', namaKonsumen:'Konsumen REG', resolvedAcName:'AC ONE', sla:'1 Jam' },
  { id:'2', source:'DS', pic:'ANA', sheetStatus:' DONE ', shipment:'S-DS-FINISHED', kodeToko:'D1', namaToko:'FINISHED STORE', namaKonsumen:'Finished customer', resolvedAcName:'AC ONE', sla:'12 Jam' },
  { id:'3', source:'DS', pic:'ANA', sheetStatus:'', shipment:'S-DS-ACTIVE', kodeToko:'D2', namaToko:'DS ACTIVE', namaKonsumen:'Konsumen DS', resolvedAcName:'AC ONE', sla:'2 Jam' },
  { id:'4', source:'REG', pic:'SYAIFUL', sheetStatus:'dOnE', shipment:'S-REG-FINISHED', kodeToko:'R2', namaToko:'OTHER FINISHED', resolvedAcName:'AC TWO', sla:'6 Jam' },
  { id:'5', source:'DS', pic:'SYAIFUL', sheetStatus:'Tidak dapat dihubungi', shipment:'S-DS-UNREACHED', kodeToko:'D3', namaToko:'DS UNREACHED', resolvedAcName:'AC TWO', sla:'1 Jam' },
]
test('working queue never admits DONE, including old ALL/Done preferences', () => {
  for (const orderStatus of ['ALL','ACTIVE','Done','DONE',' done ','EMPTY','Proses']) {
    const actual = workingSheetRows(rows, {orderStatus})
    assert.ok(actual.every(row => !isDoneOrder(row)), orderStatus)
    assert.ok(!actual.some(row => row.shipment.includes('FINISHED')))
  }
  const sorted = workingSheetRows(rows, { orderStatus:'ALL' })
  assert.deepEqual(sorted.map(row => row.source), ['DS','DS','REG'])
  assert.equal(rows[0].source, 'REG', 'sorting does not mutate the snapshot')
  assert.deepEqual(workingSheetRows(rows, {pic:'ANA',source:'REG'}).map(row=>row.shipment), ['S-REG-ACTIVE'])
})
test('same AC is separated into DS and REG, with source-specific work statuses', () => {
  const groups = groupRowsByAc(rows, {'DS::AC ONE':'sudah_dihubungi','REG::AC ONE':'sedang_menunggu'}, {workingOnly:true,splitSources:true})
  assert.deepEqual(groups.map(group=>group.source), ['DS','DS','REG'])
  assert.equal(groups.find(group=>group.acKey==='DS::AC ONE').status,'sudah_dihubungi')
  assert.equal(groups.find(group=>group.acKey==='REG::AC ONE').status,'sedang_menunggu')
  assert.ok(groups.every(group=>group.rows.every(row=>!isDoneOrder(row))))
  assert.equal(groups.reduce((sum,g)=>sum+g.totalShipments,0),3)
})
test('PIC progress counts source DONE status separately from chat status and working filters', () => {
  const summary = summarizeOrders(rows,{pic:'ANA',source:'ALL',orderStatus:'Proses'})
  assert.deepEqual({total:summary.total,done:summary.done,pending:summary.pending},{total:3,done:1,pending:2})
  assert.deepEqual(summary.byPic.map(p=>[p.pic,p.done,p.pending]),[['ANA',1,2],['SYAIFUL',1,1]])
  assert.equal(summarizeOrders(rows,{source:'DS',pic:'ANA'}).pending,1)
  assert.equal(summarizeOrders(rows,{source:'DS',pic:'ALL'}).done,1)
  assert.equal(summarizeOrders(rows.map(row=>({...row,status:'sudah_dihubungi'})),{pic:'ANA'}).done,1)
})
test('message generation removes DONE shipments, store names, counts, and SLA summaries', () => {
  const group = { acName:'AC ONE', rows:rows.slice(0,3), totalShipments:3,totalStores:3,storesList:['FINISHED STORE'],slaBreakdown:{'12 Jam':1,'1 Jam':1,'2 Jam':1} }
  const template = '{total_shipment}|{total_toko}|{daftar_toko}|{daftar_shipment}|{daftar_toko_dan_shipment}|{rincian_sla}'
  const message = renderTemplate(template,group)
  assert.ok(message.startsWith('2|2|'))
  for (const forbidden of ['S-DS-FINISHED','FINISHED STORE','Finished customer','12 Jam']) assert.ok(!message.includes(forbidden),forbidden)
  assert.ok(message.includes('S-DS-ACTIVE'))
  assert.equal(renderTemplate(template,{...group,rows:[rows[1]]}),'')
})
async function tableComponent() {
  const input = await readFile(new URL('../src/components/AcTableRender.jsx',import.meta.url),'utf8')
  let {code} = await transformWithOxc(input,'AcTableRender.jsx',{jsx:{runtime:'classic'}})
  code = code.replace('"react"',JSON.stringify(import.meta.resolve('react')))
  for (const file of ['orderState','tableSettings']) code = code.replace(`"../utils/${file}"`,JSON.stringify(new URL(`../src/utils/${file}.js`,import.meta.url).href))
  return (await import(`data:text/javascript;base64,${Buffer.from(code).toString('base64')}`)).AcTableRender
}
test('the actual PNG table DOM omits completed orders, including stale group totals', async () => {
  const Table = await tableComponent()
  const group = {acName:'AC ONE',source:'DS',rows:[rows[1],rows[2]],totalShipments:2,totalStores:2,storesList:['FINISHED STORE']}
  const html = renderToStaticMarkup(React.createElement(Table,{acGroup:group}))
  assert.ok(html.includes('S-DS-ACTIVE'))
  for (const forbidden of ['S-DS-FINISHED','FINISHED STORE','Finished customer']) assert.ok(!html.includes(forbidden),forbidden)
  assert.equal(activeOrderGroup(group).totalShipments,1)
  assert.equal(renderToStaticMarkup(React.createElement(Table,{acGroup:{...group,rows:[rows[1]]}})),'')
})
test('a source update removes finished orders from an edited draft while keeping unrelated edits', () => {
  const previousOrders = orderSetKey(rows.slice(0,3))
  const nextOrders = orderSetKey(activeOrders(rows.slice(0,3)))
  const nextMessage = 'Only S-DS-ACTIVE and S-REG-ACTIVE'
  assert.equal(reconcileOrderDraft({currentMessage:'Edited S-DS-FINISHED',previousMessage:'Old',nextMessage,previousOrders,nextOrders}),nextMessage)
  assert.equal(reconcileOrderDraft({currentMessage:'Personal note',previousMessage:'Old',nextMessage,previousOrders,nextOrders:previousOrders}),'Personal note')
  assert.equal(orderSetKey([...rows].reverse()),orderSetKey(rows),'row reordering alone does not discard edits')
})
test('themes validate colors, support light and dark, and select readable text', () => {
  for (const theme of APPEARANCE_THEMES) {
    const appearance = {...DEFAULT_APPEARANCE,theme:theme.id,accent:theme.accent}
    assert.deepEqual(normalizeAppearance(appearance),appearance)
    for (const dark of [false,true]) {
      const css = appearanceVariables(appearance,dark)
      assert.equal(css['--solid'],theme.accent)
      assert.equal(css['--source-ds'],'#ef4444')
      assert.equal(css['--source-reg'],'#3b82f6')
      assert.ok(Object.values(css).every(color=>/^#[a-f0-9]{6}$/i.test(color)))
    }
  }
  assert.equal(foregroundColor('#ffffff'),'#141518')
  assert.equal(foregroundColor('#000000'),'#ffffff')
  assert.equal(normalizeAppearance({accent:'url(https://invalid)',dsColor:null}).accent,DEFAULT_APPEARANCE.accent)
  assert.equal(normalizeAppearance({...DEFAULT_APPEARANCE,regColor:'red'}).regColor,DEFAULT_APPEARANCE.regColor)
  assert.equal(normalizeAppearance({...DEFAULT_APPEARANCE,theme:'unknown'}).theme,DEFAULT_APPEARANCE.theme)
})

test('manual paste preserves the source order status so DONE cannot bypass the queue', () => {
  const parsed = parseSapaRawText('Jam\tNama AC\tKode Toko\tNama Toko\tCabang\tShipment\tSLA\tPIC\tStatus\tSumber\n08.00\tTEST AC\tT1\tToko 1\tDC TEST\tS-1\t1 Jam\tANA\tDONE\tDS\n08.00\tTEST AC\tT2\tToko 2\tDC TEST\tS-2\t1 Jam\tANA\tProses\tREG')
  assert.equal(parsed[0].sheetStatus, 'DONE')
  assert.equal(parsed[0].source, 'DS')
  assert.deepEqual(workingSheetRows(parsed).map(row => row.shipment), ['S-2'])
})

test('saving or resetting image designs preserves the PIC workspace palette', async () => {
  const {workspaceAppearance,imageSettingsOnly,saveImageSettings} = await import('../src/utils/appearance.js')
  const {DEFAULT_TABLE_SETTINGS} = await import('../src/utils/tableSettings.js')
  const palette = {...DEFAULT_APPEARANCE,theme:'rose',accent:'#be185d',dsColor:'#cc2255'}
  const shared = {...DEFAULT_TABLE_SETTINGS,workspaceAppearance:palette}
  assert.deepEqual(workspaceAppearance(shared),palette)
  assert.deepEqual(imageSettingsOnly(shared),DEFAULT_TABLE_SETTINGS)
  assert.deepEqual(saveImageSettings(DEFAULT_TABLE_SETTINGS,shared).workspaceAppearance,palette)
  assert.deepEqual(workspaceAppearance(undefined,undefined),DEFAULT_APPEARANCE)
  assert.equal(validSetting('tableSettings',shared),true,'existing preference API can store palette alongside image preferences')
})
