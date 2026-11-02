import test from 'node:test'
import assert from 'node:assert/strict'
import { parseReportRows, buildReport, reportOptions, reportDate, reportTsv } from '../src/utils/hasilLaporan.js'
const matrix = [
 ['nomor_shipment','store_id','agent_follow_up','descp_follow_up','update_at','is_tag_i','sudah_follow_up'],
 ['S1','T1','ana','Overload','2026-10-26 15:00','REGULER','Y'],
 ['S2','T1','ANA','Motor Bermasalah','2026-10-26','REGULER','Y'],
 ['S3','T1','ABRAR','Overload','2026-10-26','TAGI','Y'],
 ['S4','T2','ABRAR','Overload','2026-10-25','REGULER','N'],
 ['S5','','ANA','','2026-10-26','','Y'],
 ['', 'T9','ANA','Overload','2026-10-26','','Y'],
]
test('report matches COUNT shipment and Excel DISTINCT COUNT, including a blank value', () => {
 const { rows, ignored } = parseReportRows(matrix)
 assert.equal(ignored,1)
 const r = buildReport(rows,{names:['ANA','ABRAR'],start:'2026-10-26',end:'2026-10-26'})
 assert.equal(r.shipments,4); assert.equal(r.stores,2)
 assert.deepEqual(r.summary.map(x=>[x.name,x.stores,x.shipments]),[['ANA',2,3],['ABRAR',1,1]])
 assert.equal(r.detailTotal,4);assert.equal(r.detail.reduce((n,x)=>n+x.total,0),r.shipments)
 assert.deepEqual(r.names,['ABRAR','ANA'])
 assert.equal(r.detail.find(x=>x.label==='Overload').total,2)
 assert.equal(r.detail.find(x=>x.label==='(Kosong)').total,1)
})
test('independent agent filters, category, follow-up and ordering stay consistent',()=>{
 const {rows}=parseReportRows(matrix)
 const r=buildReport(rows,{names:['ANA'],detailNames:['ABRAR'],separateNames:true,summarySort:'shipments-desc',category:'TAGI',followed:'Y'})
 assert.equal(r.shipments,0);assert.equal(r.detailTotal,1);assert.deepEqual(r.names,['ABRAR'])
 assert.equal(buildReport(rows,{names:[],detailNames:[]}).shipments,0)
 assert.equal(buildReport(rows,{names:['ANA'],category:'__EMPTY__'}).shipments,1)
 assert.equal(buildReport(rows,{names:['ABRAR'],start:'2026-10-25',end:'2026-10-25',followed:'N'}).shipments,1)
})
test('parsing keeps repeated follow-up records and reports source issues',()=>{
 const data=parseReportRows([...matrix,matrix[1],['S9','T9',' ANA ','X','invalid','','Y']])
 assert.equal(data.duplicates,1);assert.equal(data.undated,1)
 assert.deepEqual(reportOptions(data.rows).dates,['2026-10-25','2026-10-26'])
 assert.throws(()=>parseReportRows([['wrong']]),/nomor_shipment/)
 assert.throws(()=>parseReportRows([['nomor_shipment']]),/store_id/)
 assert.equal(reportDate(46321,()=>({y:2026,m:10,d:26})),'2026-10-26')
 assert.equal(reportDate('26/10/2026 13:00'),'2026-10-26')
})
test('TSV escapes tabs and preserves totals',()=>{
 const {rows}=parseReportRows(matrix)
 rows[0].descp_follow_up='Label\tquoted'
 const r=buildReport(rows,{names:['ANA'],countBlankStores:false})
 const text=reportTsv(r)
 assert.ok(text.includes('"Label\tquoted"'))
 assert.ok(text.includes('Grand Total\t1\t3'))
})
