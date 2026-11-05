import test from 'node:test'
import assert from 'node:assert/strict'
import { appendRequests, createTarikUpdater, FOLLOW_UP_OPTIONS } from '../server/tarikUpdate.js'
const time=Date.parse('2026-11-05T01:00:00Z')
const headers=['Jam','No AC','Nama AC','Kode Toko','Nama Toko','Cabang','Region','Shipment','Nama Konsumen','SLA','Nama AM','No AM','POD AC','APV AM','PIC','Status','Kondisi Motor','Jumlah Personil','Nama Pejabat','Kendala','Grouping','GLI']
const row=(shipment='NEW')=>({source:'REG',noAc:'6281234567890',namaAc:'AC',kodeToko:'A01',namaToko:'TOKO',cabang:'CABANG',region:'REG 1',shipment,namaKonsumen:'CUSTOMER',sla:'1 Jam',namaAm:'AM',noAm:''})
function fixture({locked=false,fail=false,badHeader=false}={}){
 let batch=null;let released=false
 const values=[[],[...headers],['07:00','','AC','A00','Toko','Cabang','','OLD','','','','','','','PIC','Done']]
 if(badHeader)values[1][3]='Salah'
 const database=async(path,options={})=>{
  if(options.method==='POST'&&path.startsWith('sapa_source_cache'))return locked?[]:[options.body]
  if(options.method==='POST'&&path==='sapa_sheet_audit')return [{id:'AUDIT'}]
  if(options.method==='DELETE'&&path.includes('snapshot'))released=true
  return []
 }
 const googleRequest=async(id,suffix,options)=>{
  if(suffix===':batchUpdate'){batch=options.body;if(fail)throw Error('timeout');return {}}
  if(suffix.startsWith('/values:batchGet'))return {valueRanges:[{values},{values:[[],headers]}]}
  if(suffix.includes('includeGridData'))return {sheets:[{data:[{rowData:[{values:[{dataValidation:{condition:{type:'ONE_OF_LIST',values:[{userEnteredValue:'08.00'}]},showCustomUi:true}}]}]}]}]}
  return {sheets:['REG','DS'].map((key,i)=>({properties:{title:`${key} 05/11`,sheetId:i+1,gridProperties:{rowCount:100}}}))}
 }
 return {update:createTarikUpdater({database,googleRequest,now:()=>time}),batch:()=>batch,released:()=>released}
}
const body=(rows=[row()])=>({source:'REG',date:'2026-11-05',hour:'08:00',rows})
test('append plans preserve the header, map B:L, formula O, blank follow ups, validate and sort complete rows D C O',()=>{
 const requests=appendRequests({sheetId:1,gridRows:3,start:3,rows:[row(),row('=LITERAL')],hour:'09:00',template:{}})
 const cells=requests.find(r=>r.updateCells).updateCells
 assert.equal(cells.range.startRowIndex,3)
 assert.equal(cells.rows[0].values[7].userEnteredValue.stringValue,'NEW')
 assert.match(cells.rows[0].values[14].userEnteredValue.formulaValue,/XLOOKUP\(F4/)
 for(const index of [12,13,15,16,17,18,19,20,21])assert.equal(cells.rows[0].values[index].userEnteredValue.stringValue,'')
 assert.equal(cells.rows[1].values[7].userEnteredValue.stringValue,'=LITERAL')
 assert.equal(requests[0].appendDimension.length,2)
 const sort=requests.at(-1).sortRange
 assert.equal(sort.range.startRowIndex,2)
 assert.equal(sort.range.endColumnIndex,22)
 assert.deepEqual(sort.sortSpecs.map(s=>s.dimensionIndex),[3,2,14])
 assert.equal(requests.filter(r=>r.setDataValidation).length,3)
 assert.equal(new Set(FOLLOW_UP_OPTIONS).size,FOLLOW_UP_OPTIONS.length)
})
test('server checks all statuses and sources for duplicate shipments and appends after last shipment',async()=>{
 const f=fixture();const result=await f.update(body([row('OLD'),row('NEW'),row('NEW')]),'PIC:TEST')
 assert.equal(result.inserted,1);assert.equal(result.ignored,2)
 const cells=f.batch().requests.find(r=>r.updateCells).updateCells
 assert.equal(cells.range.startRowIndex,3)
 assert.equal(cells.rows[0].values[0].userEnteredValue.stringValue,'08.00')
 assert.equal(f.released(),true)
})
test('duplicates-only update never writes Sheets',async()=>{
 const f=fixture();assert.equal((await f.update(body([row('OLD')]),'PIC:TEST')).inserted,0);assert.equal(f.batch(),null)
})
test('concurrent import, wrong header, and historical date are rejected before writing',async()=>{
 for(const config of [{locked:true},{badHeader:true}]){const f=fixture(config);await assert.rejects(()=>f.update(body(),'PIC:TEST'));assert.equal(f.batch(),null)}
 const f=fixture();await assert.rejects(()=>f.update({...body(),date:'2026-11-04'},'PIC:TEST'));assert.equal(f.batch(),null)
})
test('uncertain write is not automatically retried and retains lock',async()=>{
 const f=fixture({fail:true});await assert.rejects(()=>f.update(body(),'PIC:TEST'),/belum dapat dipastikan/);assert.equal(f.released(),false)
})
