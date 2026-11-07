import test from 'node:test'
import assert from 'node:assert/strict'
import { groupRowsByAc } from '../src/utils/matcher.js'
import { renderTemplate } from '../src/utils/templateEngine.js'
import { podStorageKeys } from '../src/utils/podSession.js'
import { createPicStorage } from '../src/profiles/api.js'
import { jakartaDate } from '../src/utils/sheetsConfig.js'
const row=(source,shipment,extra={})=>({source,shipment,kodeToko:shipment,namaToko:`TOKO ${shipment}`,resolvedAcName:'TEST AC',resolvedPhone:'081234567890',sheetStatus:'Proses',...extra})
test('DS and REG share a complete queue, message and image row set for the same normalized AC phone',()=>{
 const groups=groupRowsByAc([row('REG','R1'),row('DS','D1'),row('REG','DONE',{sheetStatus:'Done'})],{}, {workingOnly:true,mergeContacts:true})
 assert.equal(groups.length,1)
 const group=groups[0]
 assert.deepEqual(group.rows.map(r=>r.shipment),['D1','R1'])
 assert.deepEqual(group.sources,['DS','REG'])
 assert.equal(group.phone,'6281234567890')
 assert.equal(group.totalShipments,2);assert.equal(group.totalStores,2)
 const message=renderTemplate('{total_shipment}|{daftar_shipment}',group)
 assert.match(message,/D1/);assert.match(message,/R1/);assert.doesNotMatch(message,/DONE/)
})
test('same phone with different AC spellings merges, while one name with different valid phones stays separate',()=>{
 const groups=groupRowsByAc([row('REG','R1'),row('DS','D1',{resolvedAcName:'OTHER SPELLING',resolvedPhone:'6281234567890'}),row('REG','R2',{resolvedPhone:'081234567891'})],{}, {mergeContacts:true})
 assert.equal(groups.length,2)
 assert.deepEqual(groups.find(g=>g.phone==='6281234567890').rows.map(r=>r.shipment),['D1','R1'])
})
test('a missing phone joins the same name only when that name has exactly one known phone',()=>{
 const groups=groupRowsByAc([row('REG','R1'),row('DS','D1',{resolvedPhone:''})],{}, {mergeContacts:true})
 assert.equal(groups.length,1)
 assert.equal(groupRowsByAc([row('REG','R1'),row('DS','D1',{resolvedPhone:''}),row('REG','R2',{resolvedPhone:'081234567891'})],{}, {mergeContacts:true}).length,3)
})
test('POD rows and statuses are isolated by PIC and date using WIB midnight',()=>{
 const map=new Map();const storage={getItem:key=>map.get(key)||null,setItem:(key,value)=>map.set(key,value),removeItem:key=>map.delete(key)}
 const ana=createPicStorage('ANA',storage),budi=createPicStorage('BUDI',storage)
 const today=podStorageKeys(jakartaDate(new Date('2026-11-07T16:59:59Z')))
 const tomorrow=podStorageKeys(jakartaDate(new Date('2026-11-07T17:00:00Z')))
 ana.setItem(today.rows,JSON.stringify([{namaAc:'TEST AC',shipmentCount:4}]))
 ana.setItem(today.status,JSON.stringify({TEST:'opened'}))
 assert.notEqual(ana.getItem(today.rows),null)
 assert.equal(budi.getItem(today.rows),null)
 assert.equal(ana.getItem(tomorrow.rows),null)
 assert.equal(ana.getItem(tomorrow.status),null)
 assert.notEqual(today.phones,tomorrow.phones)
})
