import { randomUUID } from 'node:crypto'
import { filterNewTarikRows, TARIK_COLUMNS } from '../src/utils/tarikData.js'
import { dailySheetTitle, jakartaDate, SPREADSHEET_ID } from '../src/utils/sheetsConfig.js'
import { parseMonitoringValues } from '../src/utils/sheetsParser.js'
import { httpError } from './googleOAuth.js'
import { queryPath } from './cloudDatabase.js'
export const FOLLOW_UP_OPTIONS = [...new Set(['Antrian Pengiriman < 5 Order','Antrian Pengiriman > 5 Order','Antrian Pengiriman > 10 Order','Barang Kosong (MAT)','Barang sudah diterima, Belum di POD APO','Barang Tag I Baru datang dari DC','Customer tidak bisa dihubungi','Dalam Pengiriman','Indikasi Fiktif','Jaringan Offline','Kendala Pengiriman','Konsumen COD','Kurang Personil (Personil ada yg tidak masuk)','Motor Bermasalah','No CUG Toko tidak aktif','Overload','Pembatalan Order','Pending Pengiriman (karena Request konsumen)','Sudah Telpon 3x Tidak Diangkat','Tag-I Belum dikirim DC','Tidak ada nomor CUG','Tidak bisa POD APO','Tidak bisa struk','Kendala Pengiriman Macet','Kendala Pengiriman Hujan','Jarak pengiriman jauh','Pengiriman barang dari DC belum datang','Motor ASET Belum terdaftar di APO'])]
const validation = values => ({ condition:{type:'ONE_OF_LIST',values:values.map(userEnteredValue=>({userEnteredValue}))},strict:true,showCustomUi:true })
export function appendRequests({ sheetId, gridRows, start, rows, hour, template, templateIndex=2, hourValidation }) {
 const end=start+rows.length, range={sheetId,startRowIndex:start,endRowIndex:end,startColumnIndex:0,endColumnIndex:22}
 const requests=[]
 if(end>gridRows) requests.push({appendDimension:{sheetId,dimension:'ROWS',length:end-gridRows}})
 if(template) for(const pasteType of ['PASTE_FORMAT','PASTE_DATA_VALIDATION'])requests.push({copyPaste:{source:{sheetId,startRowIndex:templateIndex,endRowIndex:templateIndex+1,startColumnIndex:0,endColumnIndex:22},destination:range,pasteType}})
 if(hourValidation?.condition?.type==='ONE_OF_LIST' && !hourValidation.condition.values?.some(v=>String(v.userEnteredValue).replace('.',':').replace(/^0/,'')===hour.replace(/^0/,'')))throw httpError(400,`Jam ${hour} belum tersedia pada dropdown sheet. Sesuaikan jam atau dropdown di spreadsheet.`)
 const sourceHour=hourValidation?.condition?.values?.map(v=>v.userEnteredValue).find(v=>String(v).replace('.',':').replace(/^0/,'')===hour.replace(/^0/,'')) || hour
 requests.push({updateCells:{range,rows:rows.map((row,index)=>({values:Array.from({length:22},(_,col)=>{
  let value=''
  if(col===0)value=sourceHour
  else if(col>=1&&col<=11)value=row[TARIK_COLUMNS[col-1][0]] || ''
  if(col===14)return {userEnteredValue:{formulaValue:`=XLOOKUP(F${start+index+1},'NEW PIC 2026'!C:C,'NEW PIC 2026'!I:I,0,0)`}}
  return {userEnteredValue:{stringValue:value}}
 })})),fields:'userEnteredValue'}})
 for(const [col,rule] of [[0,hourValidation||validation(Array.from({length:24},(_,i)=>`${String(i).padStart(2,'0')}:00`))],[15,validation(['Proses','Done','Tidak dapat dihubungi'])],[20,validation(FOLLOW_UP_OPTIONS)]])if(col!==0 || !hourValidation) requests.push({setDataValidation:{range:{...range,startColumnIndex:col,endColumnIndex:col+1},rule}})
 if(['07:00','08:00','09:00'].includes(hour)) { const colors={'07:00':[230,230,230],'08:00':[191,225,246],'09:00':[10,83,168]};const [r,g,b]=colors[hour];requests.push({repeatCell:{range:{...range,endColumnIndex:1},cell:{userEnteredFormat:{backgroundColor:{red:r/255,green:g/255,blue:b/255},textFormat:{foregroundColor:{red:hour==='09:00'?1:0,green:hour==='09:00'?1:0,blue:hour==='09:00'?1:0}}}},fields:'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat.foregroundColor'}}) }
 requests.push({repeatCell:{range,cell:{userEnteredFormat:{textFormat:{fontFamily:'Calibri',fontSize:11}}},fields:'userEnteredFormat.textFormat.fontFamily,userEnteredFormat.textFormat.fontSize'}})
 requests.push({sortRange:{range:{...range,startRowIndex:2},sortSpecs:[3,2,14].map(dimensionIndex=>({dimensionIndex,sortOrder:'ASCENDING'}))}})
 return requests
}
export function createTarikUpdater({database,googleRequest,now=()=>Date.now()}) {
 return async (body,actor) => {
  const {source,hour,rows}=body
  const date=jakartaDate(new Date(now()))
  if(!['REG','DS'].includes(source)||body.date!==date||!/^([01]\d|2[0-3]):00$/.test(hour)||!Array.isArray(rows)||!rows.length||rows.length>5000)throw httpError(400,'Pilih REG/DS, jam, dan data hari ini (maksimal 5.000 baris per update).')
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
   const tabs=['REG','DS'].map(key=>{const title=dailySheetTitle(key,date);const tab=metadata.sheets?.find(s=>s.properties.title===title)?.properties;if(!tab)throw httpError(422,`Tab ${title} belum tersedia.`);return {...tab,key}})
   const q=new URLSearchParams({valueRenderOption:'FORMATTED_VALUE'});tabs.forEach(t=>q.append('ranges',`'${t.title.replaceAll("'","''")}'!A:V`))
   const data=await googleRequest(SPREADSHEET_ID,`/values:batchGet?${q}`)
   if(data.valueRanges?.length!==2)throw httpError(502,'Data REG/DS belum lengkap. Update dibatalkan.')
   const existing=tabs.flatMap((t,i)=>parseMonitoringValues(data.valueRanges[i].values||[],t.key))
   const {fresh,duplicate}=filterNewTarikRows(safe,existing)
   if(!fresh.length)return {inserted:0,ignored:duplicate.length,source,date}
   const index=tabs.findIndex(t=>t.key===source),tab=tabs[index],values=data.valueRanges[index].values||[]
   const normalize=v=>String(v||'').toLowerCase().replace(/[\s_-]/g,'')
   const h=(values[1]||[]).map(normalize)
   if(!['jam','noac','namaac','kodetoko','namatoko','cabang','region','shipment','namakonsumen','sla','namaam','noam','podac','apvam'].every((name,i)=>h[i]===name)||!['','pic'].includes(h[14]||'')||h[15]!=='status'||h[20]!=='grouping')throw httpError(409,'Susunan kolom baris 2 berbeda dari A:V yang diharapkan. Update dibatalkan.')
   const last=Math.max(2,...existing.filter(r=>r.source===source).map(r=>r.sheetRow))
   if(values.slice(last,last+fresh.length).some(row=>row.some((v,c)=>c!==0&&c!==14&&String(v||'').trim())))throw httpError(409,'Area tujuan berisi data tanpa Shipment. Periksa baris terakhir sheet terlebih dahulu.')
   const hourMatch=values.findIndex((row,i)=>i>=2 && String(row[0]||'').replace('.',':').replace(/^0/,'')===hour.replace(/^0/,''))
   const templateIndex=hourMatch>=2 ? hourMatch : Math.max(2,last-1)
   const grid=await googleRequest(SPREADSHEET_ID,`?ranges=${encodeURIComponent(`'${tab.title}'!A${templateIndex+1}:V${templateIndex+1}`)}&includeGridData=true&fields=sheets(data(rowData(values(dataValidation,userEnteredFormat))))`)
   const template=grid.sheets?.flatMap(s=>s.data||[]).find(d=>d.rowData?.length)?.rowData?.[0]
   const requests=appendRequests({sheetId:tab.sheetId,gridRows:tab.gridProperties.rowCount,start:last,rows:fresh,hour,template,templateIndex,hourValidation:template?.values?.[0]?.dataValidation})
   const audit=(await database('sapa_sheet_audit',{method:'POST',body:{actor,source,sheet_date:date,shipment:`IMPORT:${token}`,sheet_row:last+1,before_value:{count:existing.length},after_value:{count:fresh.length,hour},outcome:'pending'}}))[0]
   if(!audit?.id)throw httpError(503,'Riwayat update belum tersimpan. Update dibatalkan.')
   uncertain=true
   await googleRequest(SPREADSHEET_ID,':batchUpdate',{method:'POST',body:{requests}})
   await database(queryPath('sapa_sheet_audit',{id:`eq.${audit.id}`}),{method:'PATCH',body:{outcome:'completed'}}).catch(()=>{})
   uncertain=false
   await database(queryPath('sapa_source_cache',{cache_key:`eq.monitoring:daily:${date}`}),{method:'DELETE'}).catch(()=>{})
   return {inserted:fresh.length,ignored:duplicate.length,source,date,sheet:tab.title}
  } catch(error) { if(uncertain)throw httpError(409,'Status update belum dapat dipastikan. Periksa spreadsheet dan Periksa ulang; jangan kirim ulang sebelum hasil dipastikan. Update dikunci sementara.');throw error }
  finally {if(!uncertain)await database(queryPath('sapa_source_cache',{cache_key:`eq.${lockKey}`,'snapshot->>token':`eq.${token}`}),{method:'DELETE'}).catch(()=>{})}
 }
}
