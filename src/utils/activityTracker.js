// Metrics contain action names and counts only: no file contents, shipment IDs or messages.
let current=null
let queue=[]
let sending=false
let lastPage=''
export function startActivity(pic) {
 let session
 try {
  const key=`sapa_analytics_session:${pic}`
  const saved=JSON.parse(sessionStorage.getItem(key)||'null')
  session=saved && Date.now()-saved.at<30*60000 ? saved.id : crypto.randomUUID()
  sessionStorage.setItem(key,JSON.stringify({id:session,at:Date.now()}))
 } catch {session=crypto.randomUUID()}
 const changed=current?.pic!==pic||current?.session!==session
 current={pic,session}
 if(changed){lastPage='';recordActivity('session_start',0,'workspace')}
}
export function recordActivity(action,units=0,feature='workspace',activeSeconds=0) {
 if(!current)return
 if(action==='page_view'&&lastPage===feature)return
 if(action==='page_view')lastPage=feature
 queue.push({...current,id:crypto.randomUUID(),action,feature,units,activeSeconds})
 queue=queue.slice(-100)
}
export async function flushActivity() {
 if(sending||!queue.length)return
 sending=true
 const pic=queue[0].pic,batch=queue.filter(e=>e.pic===pic).slice(0,20)
 try {
  const response=await fetch('/api/activity',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pic,events:batch}),keepalive:true})
  if(response.ok) {const ids=new Set(batch.map(e=>e.id));queue=queue.filter(e=>!ids.has(e.id))}
 } catch { /* retry the same event IDs on the next flush */ }
 finally {sending=false}
}
