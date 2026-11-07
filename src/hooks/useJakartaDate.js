import { useEffect, useState } from 'react'
import { jakartaDate } from '../utils/sheetsConfig.js'
export function useJakartaDate() {
 const [date,setDate]=useState(()=>jakartaDate())
 useEffect(()=>{
  let timer
  const tick=()=>{clearTimeout(timer);setDate(jakartaDate());timer=setTimeout(tick,60000-Date.now()%60000)}
  tick();document.addEventListener('visibilitychange',tick)
  return ()=>{clearTimeout(timer);document.removeEventListener('visibilitychange',tick)}
 },[])
 return date
}
