import test from 'node:test'
import assert from 'node:assert/strict'
import { appendRequests, createTarikUpdater, planDailyTabs } from '../server/tarikUpdate.js'
const time=Date.parse('2026-11-05T01:00:00Z')
const headers=['Jam','No AC','Nama AC','Kode Toko','Nama Toko','Cabang','Region','Shipment','Nama Konsumen','SLA','Nama AM','No AM','POD AC','APV AM','PIC','Status','Kondisi Motor','Jumlah Personil','Nama Pejabat','Kendala','Grouping','GLI']
const row=(shipment='NEW')=>({source:'REG',noAc:'6281234567890',namaAc:'AC',kodeToko:'A01',namaToko:'TOKO',cabang:'CABANG',region:'REG 1',shipment,namaKonsumen:'CUSTOMER',sla:'1 Jam',namaAm:'AM',noAm:''})
function fixture({locked=false,fail=false,badHeader=false,missingToday=false}={}){
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
  return {sheets:['REG','DS'].map((key,i)=>({properties:{title:`${key} ${missingToday ? '04' : '05'}/11`,sheetId:i+1,gridProperties:{rowCount:100}}}))}
 }
 return {update:createTarikUpdater({database,googleRequest,now:()=>time}),batch:()=>batch,released:()=>released}
}
const body=(rows=[row()])=>({source:'REG',date:'2026-11-05',hour:'08:00',rows})
test('append writes only B:L values, preserving all other columns, formats and ordering',()=>{
 const requests=appendRequests({sheetId:1,gridRows:3,start:3,rows:[row(),row('=LITERAL')]})
 assert.equal(requests[0].appendDimension.length,2)
 const cells=requests[1].updateCells
 assert.equal(cells.range.startRowIndex,3)
 assert.equal(cells.range.startColumnIndex,1)
 assert.equal(cells.range.endColumnIndex,12)
 assert.equal(cells.fields,'userEnteredValue')
 assert.equal(cells.rows[0].values.length,11)
 assert.equal(cells.rows[0].values[6].userEnteredValue.stringValue,'NEW')
 assert.equal(cells.rows[1].values[6].userEnteredValue.stringValue,'=LITERAL')
 assert.equal(requests.length,2)
})
test('duplicate only missing daily tabs and delete rows 4 onward only in new copies',()=>{
 const sheets=['REG','DS'].map((key,i)=>({properties:{title:`${key} 04/11`,sheetId:i+1,gridProperties:{rowCount:100}}}))
 const tabs=planDailyTabs(sheets,'2026-11-05','2026-11-04')
 for(const tab of tabs){
  assert.equal(tab.gridProperties.rowCount,3)
  assert.equal(tab.requests[0].duplicateSheet.newSheetId,tab.sheetId)
  const del=tab.requests[1].deleteDimension.range
  assert.equal(del.sheetId,tab.sheetId);assert.equal(del.startIndex,3);assert.equal(del.endIndex,100)
  assert.ok(![1,2].includes(del.sheetId))
 }
 const withReg=[...sheets,{properties:{title:'REG 05/11',sheetId:20,gridProperties:{rowCount:500}}}]
 assert.equal(planDailyTabs(withReg,'2026-11-05','2026-11-04')[0].requests.length,0)
 assert.throws(()=>planDailyTabs([],'2026-11-05','2026-11-04'),/kemarin/)
})
test('server checks all statuses and sources for duplicate shipments and appends after last shipment',async()=>{
 const f=fixture();const result=await f.update(body([row('OLD'),row('NEW'),row('NEW')]),'PIC:TEST')
 assert.equal(result.inserted,1);assert.equal(result.ignored,2)
 const cells=f.batch().requests.find(r=>r.updateCells).updateCells
 assert.equal(cells.range.startRowIndex,3)
 assert.equal(cells.rows[0].values[0].userEnteredValue.stringValue,'6281234567890')
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

test('missing daily sheets are created atomically with paste, retaining seed row 3',async()=>{
 const f=fixture({missingToday:true});const result=await f.update(body(),'PIC:TEST')
 assert.deepEqual(result.createdSheets,['REG 05/11','DS 05/11'])
 const requests=f.batch().requests
 assert.equal(requests.filter(r=>r.duplicateSheet).length,2)
 assert.equal(requests.filter(r=>r.deleteDimension).length,2)
 const cells=requests.find(r=>r.updateCells).updateCells
 assert.equal(cells.range.startRowIndex,3)
 assert.equal(cells.range.startColumnIndex,1)
 assert.equal(cells.range.endColumnIndex,12)
 assert.ok(!requests.some(r=>r.sortRange||r.copyPaste||r.repeatCell||r.setDataValidation))
})
