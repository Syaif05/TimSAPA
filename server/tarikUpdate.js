import { randomUUID, randomInt } from 'node:crypto'
import { filterNewTarikRows, TARIK_COLUMNS } from '../src/utils/tarikData.js'
import { dailySheetTitle, jakartaDate, SPREADSHEET_ID } from '../src/utils/sheetsConfig.js'
import { parseMonitoringValues } from '../src/utils/sheetsParser.js'
import { httpError } from './googleOAuth.js'
import { queryPath } from './cloudDatabase.js'
// Only values in B:L are written. Formatting, formulas and other columns stay intact.
export function appendRequests({ sheetId, gridRows, start, rows }) {
 const end=start+rows.length, requests=[]
 if(!rows.length)return requests
 if(end>gridRows)requests.push({appendDimension:{sheetId,dimension:'ROWS',length:end-gridRows}})
 requests.push({updateCells:{range:{sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:1,endColumnIndex:12},rows:rows.map(row=>({values:TARIK_COLUMNS.map(([field])=>({userEnteredValue:{stringValue:row[field]||''}}))})),fields:'userEnteredValue'}})
 return requests
}
export function planDailyTabs(sheets, date, yesterday) {
 const used=new Set(sheets.map(s=>s.properties.sheetId))
 return ['REG','DS'].map(key=>{
  const title=dailySheetTitle(key,date)
  const existing=sheets.find(s=>s.properties.title===title)?.properties
  if(existing)return {...existing,key,readTitle:title,requests:[]}
  const priorTitle=dailySheetTitle(key,yesterday)
  const prior=sheets.find(s=>s.properties.title===priorTitle)?.properties
  if(!prior)throw httpError(422,`Tab ${title} dan tab kemarin ${priorTitle} belum tersedia. Buat template terlebih dahulu.`)
  if(prior.gridProperties.rowCount<3)throw httpError(422,`Template ${priorTitle} harus memiliki setidaknya 3 baris.`)
  let sheetId;do {sheetId=randomInt(1,2147483647)}while(used.has(sheetId));used.add(sheetId)
  const requests=[{duplicateSheet:{sourceSheetId:prior.sheetId,newSheetId:sheetId,newSheetName:title}}]
  if(prior.gridProperties.rowCount>3)requests.push({deleteDimension:{range:{sheetId,dimension:'ROWS',startIndex:3,endIndex:prior.gridProperties.rowCount}}})
  return {key,title,sheetId,gridProperties:{rowCount:3},readTitle:priorTitle,created:true,requests}
 })
}
function checkHeaders(values) {
 const h=(values[1]||[]).map(v=>String(v||'').toLowerCase().replace(/[\s_-]/g,''))
 if(!['noac','namaac','kodetoko','namatoko','cabang','region','shipment','namakonsumen','sla','namaam','noam'].every((name,i)=>h[i+1]===name))throw httpError(409,'Susunan kolom B:L pada baris 2 berbeda dari hasil Salin manual. Update dibatalkan.')
}
export function createTarikUpdater({database,googleRequest,now=()=>Date.now()}) {
 return async (body,actor) => {
  const {source,rows}=body
  const date=jakartaDate(new Date(now()))
  if(!['REG','DS'].includes(source)||body.date!==date||!Array.isArray(rows)||!rows.length||rows.length>5000)throw httpError(400,'Pilih REG/DS dan data hari ini (maksimal 5.000 baris per update).')
  const safe=rows.map(row=>{
   if(!row || typeof row!=='object' || row.source!==source||!row.shipment||!row.kodeToko)throw httpError(400,'Identitas shipment/sumber tidak valid.')
   return Object.fromEntries([['source',source],...TARIK_COLUMNS.map(([key])=>{if(typeof row[key]!=='string'||row[key].length>1000)throw httpError(400,'Isi data tarikan tidak valid.');return [key,row[key].trim()]})])
  })
  const lockKey=`lock:tarik:${SPREADSHEET_ID}`, token=randomUUID()
  await database(queryPath('sapa_source_cache',{cache_key:`eq.${lockKey}`,expires_at:`lt.${new Date(now()).toISOString()}`}),{method:'DELETE'})
  const lock=await database('sapa_source_cache?on_conflict=cache_key',{method:'POST',body:{cache_key:lockKey,snapshot:{token},expires_at:new Date(now()+600000).toISOString()},prefer:'resolution=ignore-duplicates,return=representation'})
  if(!lock?.length)throw httpError(409,'Update lain sedang diproses. Periksa ulang beberapa saat lagi.')
  let uncertain=false
  try {
   const metadata=await googleRequest(SPREADSHEET_ID,'?fields=sheets(properties(sheetId,title,gridProperties(rowCount)))')
   const yesterday=jakartaDate(new Date(now()-86400000))
   const tabs=planDailyTabs(metadata.sheets||[],date,yesterday)
   const q=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE'});tabs.forEach(t=>q.append('ranges',`'${t.readTitle.replaceAll("'","''")}'!${t.created?'A1:V3':'A:V'}`))
   const data=await googleRequest(SPREADSHEET_ID,`/values:batchGet?${q}`)
   if(data.valueRanges?.length!==2)throw httpError(502,'Data REG/DS belum lengkap. Update dibatalkan.')
   const valuesByTab=tabs.map((t,i)=>{const values=data.valueRanges[i].values||[];return t.created?values.slice(0,3):values})
   valuesByTab.forEach(checkHeaders)
   const existing=tabs.flatMap((t,i)=>parseMonitoringValues(valuesByTab[i],t.key))
   const {fresh,duplicate}=filterNewTarikRows(safe,existing)
   const createdSheets=tabs.filter(t=>t.created).map(t=>t.title)
   if(!fresh.length && !createdSheets.length)return {inserted:0,ignored:duplicate.length,source,date,createdSheets}
   const index=tabs.findIndex(t=>t.key===source),tab=tabs[index],values=valuesByTab[index]
   const last=Math.max(tab.created?3:2,...existing.filter(r=>r.source===source).map(r=>r.sheetRow))
   if(values.slice(last,last+fresh.length).some(row=>row.slice(1,12).some(v=>String(v||'').trim())))throw httpError(409,'Area tujuan B:L berisi data tanpa Shipment. Periksa baris terakhir sheet terlebih dahulu.')
   const requests=[...tabs.flatMap(t=>t.requests),...appendRequests({sheetId:tab.sheetId,gridRows:tab.gridProperties.rowCount,start:last,rows:fresh})]
   const audit=(await database('sapa_sheet_audit',{method:'POST',body:{actor,source,sheet_date:date,shipment:`IMPORT:${token}`,sheet_row:last+1,before_value:{count:existing.length},after_value:{count:fresh.length,range:'B:L',createdSheets},outcome:'pending'}}))[0]
   if(!audit?.id)throw httpError(503,'Riwayat update belum tersimpan. Update dibatalkan.')
   uncertain=true
   await googleRequest(SPREADSHEET_ID,':batchUpdate',{method:'POST',body:{requests}})
   await database(queryPath('sapa_sheet_audit',{id:`eq.${audit.id}`}),{method:'PATCH',body:{outcome:'completed'}}).catch(()=>{})
   uncertain=false
   await database(queryPath('sapa_source_cache',{cache_key:`eq.monitoring:daily:${date}`}),{method:'DELETE'}).catch(()=>{})
   return {inserted:fresh.length,ignored:duplicate.length,source,date,sheet:tab.title,createdSheets}
  } catch(error) { if(uncertain)throw httpError(409,'Status update belum dapat dipastikan. Periksa spreadsheet dan Periksa ulang; jangan kirim ulang sebelum hasil dipastikan. Update dikunci sementara.');throw error }
  finally {if(!uncertain)await database(queryPath('sapa_source_cache',{cache_key:`eq.${lockKey}`,'snapshot->>token':`eq.${token}`}),{method:'DELETE'}).catch(()=>{})}
 }
}
