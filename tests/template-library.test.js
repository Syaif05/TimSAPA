import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_TEMPLATES, TEMPLATE_VARIABLES, renderTemplate, templateValues, messagePeriodAt, templateLibraryError, unknownTemplateVariables } from '../src/utils/templateEngine.js'
import { validSetting } from '../supabase/functions/pic-profiles/handler.js'
const library = count => Object.fromEntries(Array.from({length:count},(_,i)=>[`template_${i+1}`,{id:`template_${i+1}`,name:`Pesan ${i+1}`,content:'{salam} {nama_ac}',period:'auto',customVariables:{link_formulir:'https://example.com/form'}}]))
test('legacy templates survive; 1–20 templates and all 20 active keys are accepted with strict limits', () => {
  assert.equal(templateLibraryError(DEFAULT_TEMPLATES),'')
  for (const count of [1,4,20]) assert.equal(validSetting('templates',library(count)),true)
  for (let i=1;i<=20;i++) assert.equal(validSetting('activeTemplateKey',`template_${i}`),true)
  for (const key of ['template_0','template_21','template_01','other',1]) assert.equal(validSetting('activeTemplateKey',key),false)
  for (const value of [{},library(21),{'template_21':library(1).template_1},{'template_1':{name:' ',content:''}},{'template_1':{name:'A',content:'a'.repeat(20001)}}]) assert.equal(validSetting('templates',value),false)
  assert.equal(validSetting('templates',{'template_20':library(20).template_20}),true,'deleting templates does not require renumbering')
})
test('template settings reject invalid period, oversized UTF-8 libraries and malformed custom variables', () => {
  for (const changes of [{period:'Dini hari'}, {customVariables:{_invalid:'x'}}, {customVariables:[]}, {customVariables:{ab:'x'.repeat(1001)}}, {customVariables:Object.fromEntries(Array.from({length:11},(_,i)=>[`key_${i}`,'x']))}]) {
    const value=library(1);Object.assign(value.template_1,changes);assert.notEqual(templateLibraryError(value),'')
  }
  const value=library(20);Object.values(value).forEach(t=>t.content='🌞'.repeat(3000))
  assert.match(templateLibraryError(value),/Total isi/)
})
test('all four greeting periods use Jakarta boundaries independently of device timezone', () => {
  for(const [time,period] of [['04:59','Malam'],['05:00','Pagi'],['10:59','Pagi'],['11:00','Siang'],['14:59','Siang'],['15:00','Sore'],['17:59','Sore'],['18:00','Malam'],['23:59','Malam']]) assert.equal(messagePeriodAt(new Date(`2026-11-22T${time}:00+07:00`)),period,time)
})
const group={acName:'AC $& {pic}',phone:'6281111111111',pic:'STALE PIC',cabang:'DC',region:'Regional',jam:'09.00',totalShipments:999,totalStores:999,rows:[
 {kodeToko:'A1',namaToko:'TOKO SATU',shipment:'DS-1',source:'DS',sheetStatus:'Proses',pic:'PIC AKTIF',sla:'2 Jam',jumlahPersonil:'3',kendala:'Dalam pengiriman',grouping:'Dalam Pengiriman',namaPejabat:'Pejabat Aktif',kondisiMotor:'BAIK',sheetDate:'2026-11-22'},
 {kodeToko:'A1',namaToko:'TOKO SATU',shipment:'DS-2',source:'DS',pic:'PIC AKTIF',sla:'2 Jam',jumlahPersonil:'3'},
 {kodeToko:'A2',namaToko:'TOKO DUA',shipment:'REG-1',source:'REG',pic:'PIC AKTIF',sla:'1 Jam'},
 {kodeToko:'DONE',namaToko:'DONE STORE',shipment:'DONE-SHIP',source:'REG',pic:'DONE PIC',sheetStatus:'Done',sla:'12 Jam',kendala:'DONE NOTE',grouping:'DONE GROUP',namaKonsumen:'DONE CUSTOMER',namaPejabat:'DONE OFFICER'},
]}
test('expanded variables use the exact active DS + REG orders, unique stores and personil per store', () => {
  const values=templateValues(group,{now:new Date('2026-11-22T02:30:00Z')})
  assert.equal(values.total_shipment,'3');assert.equal(values.total_toko,'2')
  assert.equal(values.total_ds,'2');assert.equal(values.total_reg,'1');assert.equal(values.sumber,'DS + REG')
  assert.equal(values.shipment_koma,'DS-1, DS-2, REG-1')
  assert.equal(values.nama_toko_koma,'TOKO SATU, TOKO DUA')
  assert.equal(values.personil_per_toko,'• A1 - TOKO SATU: 3 personil')
  assert.equal(values.pic,'PIC AKTIF');assert.equal(values.salam,'Selamat pagi');assert.equal(values.jam_sekarang,'09.30')
  assert.equal(values.tanggal,'22 November 2026');assert.equal(values.hari,'Minggu')
  const result=renderTemplate(TEMPLATE_VARIABLES.map(v=>v.tag).join('\n'),group)
  for(const forbidden of ['DONE STORE','DONE-SHIP','DONE PIC','DONE NOTE','DONE GROUP','DONE CUSTOMER','DONE OFFICER','12 Jam','999'])assert.ok(!result.includes(forbidden),forbidden)
  assert.equal(renderTemplate('{total_shipment}',{...group,rows:[group.rows[3]]}),'')
})
test('replacement values remain literal, manual periods and custom values work without recursive execution', () => {
  const result=renderTemplate('{NAMA_AC}|{pic}|{salam}|{waktu}|{link_formulir}|{catatan_tambahan}|{unknown}',group,{period:'Malam',customVariables:{link_formulir:'https://example.com/$&',catatan_tambahan:'',pic:'SHOULD NOT OVERRIDE'}})
  assert.equal(result,'AC $& {pic}|PIC AKTIF|Selamat malam|Malam|https://example.com/$&||{unknown}')
  assert.deepEqual(unknownTemplateVariables('{nama_ac} {link_formulir} {typo} {TYPO}',{link_formulir:'url'}),['typo'])
})
