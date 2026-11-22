import test from 'node:test'
import assert from 'node:assert/strict'
import { groupWorkResults, allWorkNotes, workProgress, setWorkCollected, loadWorkChecks, workStorageKey } from '../src/utils/hasilKerja.js'
const row = (shipment, extra = {}) => ({ shipment, sheetStatus:'DONE', pic:'ANA', source:'REG', kendala:'Pembatalan - Request Pelanggan', jumlahPersonil:'3', namaPejabat:'ANI', kondisiMotor:'Baik', grouping:'Pembatalan', ...extra })
const group = (rows, checks = {}, filters = {}) => groupWorkResults(rows, { checks, ...filters })
test('DONE dropdown explanations are included; pending, other PIC/source and empty shipments are excluded', () => {
  const groups = group([row('S2',{sheetStatus:'Done (Selesai)'}),row('S1',{source:'DS'}),row('S1'),row('PENDING',{sheetStatus:''}),row('OTHER',{pic:'BUDI'})],{}, {pic:'ANA'})
  assert.equal(groups.length,1)
  assert.equal(groups[0].fields.shipment,'S1, S2')
  assert.equal(groups[0].fields.jumlahPersonil,'3')
  assert.equal(groups[0].fields.grouping,'Pembatalan')
  assert.equal(group([row('S1'),row('S2',{source:'DS'})],{}, {source:'DS'})[0].fields.shipment,'S2')
  assert.equal(group([row('')]).length,0)
})
test('same notes split when any report field differs, including blank versus filled', () => {
  for (const values of [{jumlahPersonil:'4'}, {namaPejabat:'BUDI'}, {kondisiMotor:'RUSAK'}, {grouping:'Motor Bermasalah'}, {jumlahPersonil:''}]) {
    assert.equal(group([row('S1'),row('S2',values)]).length,2,JSON.stringify(values))
  }
  const blank = {jumlahPersonil:'', namaPejabat:'', kondisiMotor:'', grouping:''}
  const groups = group([row('S1',blank),row('S2',{...blank,kendala:'  pembatalan - Request  Pelanggan '})])
  assert.equal(groups.length,1)
  assert.equal(groups[0].fields.shipment,'S1, S2')
  assert.equal(groups[0].fields.namaPejabat,'')
  assert.equal(group([row('S3',{kendala:''})])[0].fields.kendala,'')
})
test('a new shipment splits from collected rows and only the new shipment is copied next', () => {
  const previous = [row('S1'),row('S2')]
  const checks = setWorkCollected({}, previous, true)
  const groups = group([...previous, row('S3')], checks)
  assert.deepEqual(groups.map(g => [g.fields.shipment,g.collected]), [['S3',false],['S1, S2',true]])
  assert.equal(workProgress(groups).completedShipments,2)
  const finished = setWorkCollected(checks,groups[0].rows,true)
  assert.equal(group([...previous,row('S3')],finished).length,1)
  assert.equal(workProgress(group([...previous,row('S3')],finished)).percent,100)
})
test('checkmarks survive sorting, source filtering and duplicate rows; field edits need a recheck', () => {
  const rows = [row('S1'),row('S2',{source:'DS'})]
  const checks = setWorkCollected({},rows,true)
  assert.equal(workProgress(group([...rows].reverse().map(r=>({...r,sheetRow:999,id:'CHANGED'})),checks)).percent,100)
  assert.equal(workProgress(group(rows,checks,{source:'DS'})).percent,100)
  const groups = group([row('S1',{namaPejabat:'EDIT'}),rows[1]],checks)
  assert.equal(groups[0].collected,false)
  assert.equal(groups[0].updated,true)
  assert.equal(groups[0].fields.namaPejabat,'EDIT')
  assert.equal(group([rows[0],rows[0]]).length,1)
  assert.equal(group([rows[0],rows[0]])[0].rows.length,1)
  assert.equal(workProgress(group(rows,setWorkCollected(checks,rows,false))).completed,0)
})
test('ordering prioritizes unfinished, BAIK motor, grouping A-Z and largest personnel count', () => {
  const rows = [row('DONE'), row('BAD',{kondisiMotor:'Rusak',grouping:'A'}),row('EMPTY',{kondisiMotor:'',grouping:'A'}),row('B',{grouping:'B',jumlahPersonil:'99'}),row('A3',{grouping:'A',jumlahPersonil:'3'}),row('A10',{grouping:'A',jumlahPersonil:'10'}),row('A0',{grouping:'A',jumlahPersonil:''})]
  const groups = group(rows, setWorkCollected({}, [rows[0]], true))
  assert.deepEqual(groups.map(g=>g.fields.shipment), ['A10','A3','A0','B','BAD','EMPTY','DONE'])
})
test('recap and progress use current groups and distinct shipments', () => {
  const rows = [row('S1'),row('S2',{kendala:'Motor rusak'}),row('S3',{kendala:''})]
  const groups=group(rows,setWorkCollected({},[rows[0]],true))
  assert.equal(allWorkNotes(groups),'Motor rusak, Pembatalan - Request Pelanggan')
  assert.equal(workProgress(groups).percent,33)
  assert.equal(workProgress(groups).shipments,3)
  assert.equal(workProgress([]).percent,0)
})
test('legacy migration imports only historical shipments across both handovers; v2 empty means deliberately unchecked', () => {
  const old = row('S1')
  const snapshot = JSON.stringify([[old.source,old.pic,old.shipment,old.jumlahPersonil,old.namaPejabat,old.kondisiMotor,old.grouping,old.kendala]])
  const saved = new Map([['sapa_work_results_v1:daily:2026-11-22:2:ANA:ALL',JSON.stringify({oldGroup:snapshot})]])
  const storage = {getItem:key=>saved.get(key) ?? null}
  const checks = loadWorkChecks(storage,'daily','2026-11-22',[old,row('S2')])
  assert.deepEqual(group([old,row('S2')],checks).map(g=>[g.fields.shipment,g.collected]),[['S2',false],['S1',true]])
  assert.deepEqual(loadWorkChecks(storage,'daily','2026-11-23',[old]),{})
  saved.set(workStorageKey('daily','2026-11-22'),'{}')
  assert.deepEqual(loadWorkChecks(storage,'daily','2026-11-22',[old]),{})
})
