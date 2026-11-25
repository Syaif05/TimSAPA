import test from 'node:test'
import assert from 'node:assert/strict'
import { parseTarikCsv, tarikHtml, tarikTsv } from '../src/utils/tarikData.js'

test('Data Studio CSV produces the required output order and REG/DS split', () => {
  const csv = 'store_code;store_name;am_name;ac_name;branch;regional;shipment_id;customer_name;sla_category\n1D92;TEMBESI 2;SAMUD;ANDI GUNAWAN;DC JAMBI;Reg 5 HSS;S-261101-AGVXZBH;FIRDHA;7. > 12 Jam\n2ABC;DS CIBODAS;DIKA;BUDI;DC JAKARTA;Reg 1;S-2;ANI;6. > 6 Jam'
  const rows = parseTarikCsv(csv)
  assert.equal(rows.length, 2)
  assert.equal(rows.filter(row => row.source === 'REG').length, 1)
  assert.equal(rows.filter(row => row.source === 'DS').length, 1)
  assert.deepEqual(rows[0], { source:'REG', noAc:'', namaAc:'ANDI GUNAWAN', kodeToko:'1D92', namaToko:'TEMBESI 2', cabang:'DC JAMBI', region:'Reg 5 HSS', shipment:'S-261101-AGVXZBH', namaKonsumen:'FIRDHA', sla:'7. > 12 Jam', namaAm:'SAMUD', noAm:'' })
  assert.equal(tarikTsv(rows.slice(0,1)).split('\n')[0], '\tANDI GUNAWAN\t1D92\tTEMBESI 2\tDC JAMBI\tReg 5 HSS\tS-261101-AGVXZBH\tFIRDHA\t7. > 12 Jam\tSAMUD\t')
  assert.ok(!tarikHtml(rows.slice(0,1)).includes('<thead>'))
  assert.ok(tarikHtml(rows.slice(0,1)).includes('font-size:11pt'))
})

test('contact lookup fills phone columns without changing raw AC and AM names', () => {
  const csv = 'store_code;store_name;am_name;ac_name;branch;regional;shipment_id;customer_name;sla_category\n1D92;TEMBESI 2;SAMUD;ANDI GUNAWAN;DC JAMBI;Reg 5 HSS;S-1;FIRDHA;7. > 12 Jam'
  const rows = parseTarikCsv(csv, [{store:'1D92',acName:'ANDI GUNAWAN',cugAc:'081234567890',cugAm:'081234567891'}])
  assert.equal(rows[0].noAc, '081234567890')
  assert.equal(rows[0].noAm, '081234567891')
  assert.equal(rows[0].namaAm, 'SAMUD')
  assert.equal(parseTarikCsv(csv.replaceAll(';', ','))[0].shipment, 'S-1')
  assert.throws(() => parseTarikCsv('wrong;header\na;b'), /Kolom CSV tidak sesuai/)
})

test('repeated shipments are retained in CSV order, in each category, and in both clipboard formats', () => {
  const header='store_code;store_name;am_name;ac_name;branch;regional;shipment_id;customer_name;sla_category'
  const lines=[
    'A1;TOKO SATU;AM;AC;DC;REG;S-OLD;PERTAMA;1 Jam',
    'A1;TOKO SATU;AM;AC;DC;REG;S-OLD;KEDUA;2 Jam',
    'D1;DS CONTOH;AM;AC;DC;REG;S-OLD;KETIGA;3 Jam',
  ]
  const rows=parseTarikCsv([header,...lines].join('\n'))
  assert.deepEqual(rows.map(r=>[r.source,r.shipment,r.namaKonsumen]),[['REG','S-OLD','PERTAMA'],['REG','S-OLD','KEDUA'],['DS','S-OLD','KETIGA']])
  const reg=rows.filter(r=>r.source==='REG')
  assert.equal(tarikTsv(reg).split('\n').length,2)
  assert.equal((tarikHtml(reg).match(/<tr>/g)||[]).length,2)
  assert.equal((tarikTsv(reg).match(/S-OLD/g)||[]).length,2)
  assert.ok(tarikTsv(reg).indexOf('PERTAMA') < tarikTsv(reg).indexOf('KEDUA'))
  assert.ok(!tarikHtml(reg).includes('<thead>'))
})
