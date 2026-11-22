import { useCallback, useEffect, useRef, useState } from 'react'
import { sourceRequest } from '../cloud/sourceRequest'
import { acPhoneIdentity } from '../utils/acPhoneOverrides'
export function useAcPhoneOverrides(storage) {
  const [records,setRecords]=useState(()=>{
    try{const cached=JSON.parse(storage?.getItem('sapa_ac_phone_corrections')||'[]');return Array.isArray(cached)?cached.filter(record=>record && typeof record.acName==='string' && typeof record.phone==='string' && typeof record.cabang==='string'):[]}catch{return []}
  })
  useEffect(()=>{try{storage?.setItem('sapa_ac_phone_corrections',JSON.stringify(records))}catch{}},[records,storage])
  const mounted=useRef(false)
  const generation=useRef(0)
  const readSequence=useRef(0)
  const refresh=useCallback(async()=>{
    const epoch=generation.current, sequence=++readSequence.current
    const result=await sourceRequest('/api/contacts?mode=phone-overrides')
    if(!Array.isArray(result.records))throw new Error('Daftar koreksi nomor belum tersedia.')
    if(mounted.current && epoch===generation.current && sequence===readSequence.current)setRecords(result.records)
    return result.records
  },[])
  useEffect(()=>{
    mounted.current=true
    const update=()=>{if(!document.hidden)refresh().catch(()=>{})}
    update();const timer=setInterval(update,60000)
    document.addEventListener('visibilitychange',update)
    return()=>{mounted.current=false;clearInterval(timer);document.removeEventListener('visibilitychange',update)}
  },[refresh])
  const save=useCallback(async(body)=>{
    generation.current++
    try{
      const {record}=await sourceRequest('/api/contacts',{method:'PATCH',body})
      if(!record?.phone || !record?.version)throw new Error('Nomor belum dikonfirmasi server. Periksa kembali sebelum membuka chat.')
      generation.current++
      if(mounted.current)setRecords(prev=>[...prev.filter(item=>acPhoneIdentity(item.acName,item.cabang)!==record.identity),record])
      return record
    }catch(error){generation.current++;refresh().catch(()=>{});throw error}
  },[refresh])
  return {records,save,refresh}
}
