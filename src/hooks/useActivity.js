import { useEffect, useRef } from 'react'
import { flushActivity, recordActivity, startActivity } from '../utils/activityTracker.js'
export function useActivity(pic,feature) {
 const latest=useRef(feature)
 useEffect(()=>{startActivity(pic);recordActivity('page_view',0,feature);latest.current=feature;flushActivity()},[pic,feature])
 useEffect(()=>{
  let lastInput=Date.now(),lastTick=Date.now()
  const touch=()=>{lastInput=Date.now()}
  const heartbeat=()=>{
   const now=Date.now(),seconds=Math.min(60,Math.floor((now-lastTick)/1000));lastTick=now
   if(!document.hidden && document.hasFocus() && now-lastInput<120000)recordActivity('heartbeat',0,latest.current,seconds)
   flushActivity()
  }
  const exit=()=>flushActivity()
  for(const event of ['pointerdown','keydown','wheel'])window.addEventListener(event,touch,{passive:true})
  document.addEventListener('visibilitychange',exit);window.addEventListener('pagehide',exit)
  const timer=setInterval(heartbeat,60000),flush=setInterval(flushActivity,10000)
  return ()=>{clearInterval(timer);clearInterval(flush);exit();for(const event of ['pointerdown','keydown','wheel'])window.removeEventListener(event,touch);document.removeEventListener('visibilitychange',exit);window.removeEventListener('pagehide',exit)}
 },[pic])
}
