import test from 'node:test'
import assert from 'node:assert/strict'
import { groupWorkResults, allWorkNotes, workProgress } from '../src/utils/hasilKerja.js'
const row = (shipment, extra = {}) => ({ shipment, sheetStatus:'DONE', pic:'ANA', source:'REG', kendala:'Pembatalan - Request Pelanggan', jumlahPersonil:'3', namaPejabat:'ANI', kondisiMotor:'Baik', grouping:'Pembatalan', ...extra })
test('groups only DONE rows by normalized kendala with unique comma separated shipments', () => {
  const groups = groupWorkResults([row('S2'),row('S1',{source:'DS'}),row('S1'),row('PENDING',{sheetStatus:''}),row('OTHER',{pic:'BUDI'})],{pic:'ANA'})
  assert.equal(groups.length,1)
  assert.equal(groups[0].fields.shipment,'S1, S2')
  assert.equal(groups[0].fields.jumlahPersonil,'3')
  assert.equal(groups[0].fields.grouping,'Pembatalan')
  assert.equal(groupWorkResults([row('S1'),row('S2',{source:'DS'})],{source:'DS'})[0].fields.shipment,'S2')
  assert.equal(groupWorkResults([row('')]).length,0)
})
test('retains differing office values and warns for missing fields without inventing defaults', () => {
  const [group] = groupWorkResults([row('S1'),row('S2',{kendala:'  pembatalan - Request  Pelanggan ',jumlahPersonil:'4',namaPejabat:''})])
  assert.equal(group.fields.jumlahPersonil,'3, 4')
  assert.ok(group.mixed.includes('Jumlah Personil Toko'))
  assert.ok(group.missing.includes('Nama Pejabat Toko'))
  const [missing] = groupWorkResults([row('S3',{kendala:''})])
  assert.equal(missing.fields.kendala,'')
})
test('checks survive row order changes but invalidate when shipments or office fields change', () => {
  const rows=[row('S1'),row('S2')]
  const groups=groupWorkResults(rows)
  const checks={[groups[0].key]:groups[0].signature}
  assert.equal(workProgress(groupWorkResults([...rows].reverse()),checks).percent,100)
  assert.equal(workProgress(groupWorkResults([...rows,row('S3')]),checks).completed,0)
  assert.equal(workProgress(groupWorkResults([row('S1',{namaPejabat:'EDIT'}),rows[1]]),checks).completed,0)
  assert.equal(workProgress([],checks).percent,0)
})
test('note recap includes every distinct note in the selected results and progress counts groups', () => {
  const groups=groupWorkResults([row('S1'),row('S2',{kendala:'Motor rusak'}),row('S3',{kendala:''})])
  assert.equal(allWorkNotes(groups),'Motor rusak, Pembatalan - Request Pelanggan')
  const progress=workProgress(groups,{[groups[0].key]:groups[0].signature})
  assert.equal(progress.percent,33)
  assert.equal(progress.shipments,3)
  assert.equal(progress.completedShipments,1)
})
