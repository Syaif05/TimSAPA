import { ACTIVITY_ACTIONS, ACTIVITY_FEATURES } from '../src/utils/activityCatalog.js'
import { httpError } from './googleOAuth.js'
import { dailySheetTitle, jakartaDate } from '../src/utils/sheetsConfig.js'
const uuid = value => typeof value==='string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
export function cleanActivity(body) {
 const pic=String(body.pic||'').trim().replace(/\s+/g,' ').toUpperCase()
 if(!pic||pic.length>80||!Array.isArray(body.events)||!body.events.length||body.events.length>20)throw httpError(400,'Aktivitas tidak valid.')
 return {pic,events:body.events.map(event=>{
  if(!event || !uuid(event.id)||!uuid(event.session)||!Object.hasOwn(ACTIVITY_ACTIONS,event.action)||!Object.hasOwn(ACTIVITY_FEATURES,event.feature))throw httpError(400,'Jenis aktivitas tidak valid.')
  return {id:event.id,session_id:event.session,pic,action:event.action,feature:event.feature,units:Math.min(50000,Math.max(0,Math.floor(Number(event.units)||0))),active_seconds:event.action==='heartbeat'?Math.min(60,Math.max(0,Math.floor(Number(event.activeSeconds)||0))):0}
 })}
}
export function activityRange(url,now=Date.now()) {
 const today=jakartaDate(new Date(now)),from=url.searchParams.get('from')||today,to=url.searchParams.get('to')||today
 try {dailySheetTitle('REG',from);dailySheetTitle('REG',to)} catch {throw httpError(400,'Tanggal tidak valid.')}
 const start=new Date(`${from}T00:00:00+07:00`),end=new Date(new Date(`${to}T00:00:00+07:00`).getTime()+86400000)
 if(end<=start||end-start>93*86400000)throw httpError(400,'Rentang tanggal maksimal 93 hari.')
 const pic=url.searchParams.get('pic')||'',feature=url.searchParams.get('feature')||''
 if(pic.length>80||(feature&&!Object.hasOwn(ACTIVITY_FEATURES,feature)))throw httpError(400,'Filter tidak valid.')
 return {p_from:start.toISOString(),p_to:end.toISOString(),p_pic:pic||null,p_feature:feature||null}
}
