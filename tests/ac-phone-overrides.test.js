import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanAcPhoneInput, acPhoneIdentity, applyAcPhoneOverrides } from '../src/utils/acPhoneOverrides.js'
import { createAcPhoneOverrides } from '../server/acPhoneOverrides.js'
import { createGoogleApplication } from '../server/googleApplication.js'
import { groupRowsByAc } from '../src/utils/matcher.js'
function fixture() {
  const cache = new Map()
  const database = async (path, options = {}) => {
    const [table, search] = path.split('?'), q = new URLSearchParams(search)
    if (table==='sapa_pic_profiles') return q.get('name')==='eq.QA' ? [{name:'QA'}] : []
    if (table==='sapa_source_settings') return [{id:'main',allow_pic_edits:true}]
    assert.equal(table,'sapa_source_cache')
    if(options.method==='POST') {
      const previous=cache.get(options.body.cache_key)
      if(previous && options.prefer?.includes('ignore-duplicates'))return []
      cache.set(options.body.cache_key,structuredClone(options.body));return [structuredClone(options.body)]
    }
    let rows=[...cache.values()].filter(row=> !q.has('cache_key') || q.get('cache_key').startsWith('like.') ? !q.has('cache_key') || row.cache_key.startsWith(q.get('cache_key').slice(5,-1)) : `eq.${row.cache_key}`===q.get('cache_key'))
    if(q.has('snapshot->>version'))rows=rows.filter(row=>`eq.${row.snapshot.version}`===q.get('snapshot->>version'))
    if(options.method==='PATCH')rows.forEach(row=>Object.assign(row,structuredClone(options.body)))
    if(options.method==='DELETE')rows.forEach(row=>cache.delete(row.cache_key))
    return structuredClone(rows.slice(Number(q.get('offset')||0), Number(q.get('offset')||0)+Number(q.get('limit')||10000)))
  }
  return {cache,database,service:createAcPhoneOverrides({database,now:()=>Date.parse('2026-11-22T02:00:00Z')})}
}
const input={acName:'AC CONTOH',cabang:'DC CONTOH',phone:'081234567890',pic:'QA',expectedVersion:''}
test('manual phone input is normalized strictly and scoped by stable name and branch',()=>{
  const a=cleanAcPhoneInput({...input,phone:'+62 (812) 3456-7890'})
  assert.equal(a.phone,'6281234567890')
  assert.equal(a.identity,acPhoneIdentity(' ac   contoh ','dc contoh'))
  assert.notEqual(a.identity,acPhoneIdentity('AC CONTOH','DC LAIN'))
  for(const changes of [{phone:'abc081234567890'},{phone:'0812'},{phone:''},{acName:'AC Tanpa Nama'},{acName:''},{cabang:'x'.repeat(161)}])assert.throws(()=>cleanAcPhoneInput({...input,...changes}))
})
test('saved phone survives a cold instance and another day, covers REG/DS, and never affects another branch',async()=>{
  const {service,database}=fixture()
  const {record}=await service.save(input)
  const nextDay=createAcPhoneOverrides({database,now:()=>Date.parse('2026-11-23T02:00:00Z')})
  const records=(await nextDay.list()).records
  assert.equal(records.length,1);assert.equal(records[0].phone,record.phone)
  const rows=['DS','REG'].map(source=>({source,shipment:`${source}-1`,resolvedAcName:'AC CONTOH',resolvedPhone:'',cabang:'DC CONTOH',kodeToko:source}))
  rows.push({...rows[0],shipment:'OTHER',cabang:'DC LAIN',resolvedPhone:'6281234567891'})
  const corrected=applyAcPhoneOverrides(rows,records)
  assert.equal(corrected[0].resolvedPhone,record.phone);assert.equal(corrected[1].resolvedPhone,record.phone)
  assert.equal(corrected[2].resolvedPhone,'6281234567891')
  const grouped=groupRowsByAc(corrected,{}, {mergeContacts:true})
  assert.equal(grouped.find(group=>group.phone===record.phone).totalShipments,2)
  // A fresh source phone does not silently erase an explicit correction.
  assert.equal(applyAcPhoneOverrides([{...rows[0],resolvedPhone:'6281234567899'}],records)[0].resolvedPhone,record.phone)
})
test('optimistic versions prevent simultaneous first saves and stale edits from overwriting corrections',async()=>{
  const {service}=fixture()
  const first=(await service.save(input)).record
  await assert.rejects(service.save({...input,phone:'081234567891'}),{status:409})
  const second=(await service.save({...input,phone:'081234567891',expectedVersion:first.version})).record
  assert.notEqual(first.version,second.version)
  await assert.rejects(service.save({...input,phone:'081234567892',expectedVersion:first.version}),{status:409})
  assert.equal((await service.list()).records[0].phone,second.phone)
  await assert.rejects(service.save({...input,pic:'UNKNOWN'}),{status:403})
})
test('API requires registered PIC and same origin, works without Google authorization and preserves cache settings',async()=>{
  const {database,cache}=fixture()
  cache.set('settings:followup-design',{cache_key:'settings:followup-design',snapshot:{design:'preserved'}})
  const app=createGoogleApplication({env:{SAPA_GOOGLE_ENABLED:'false',APP_ORIGIN:'https://sapa.example'},database})
  const request=(body,origin='https://sapa.example')=>new Request('https://sapa.example/api/contacts',{method:'PATCH',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body)})
  assert.equal((await app.handle(request(input,'https://evil.example'))).status,403)
  assert.equal((await app.handle(request({...input,pic:'UNKNOWN'}))).status,403)
  assert.equal((await app.handle(request({...input,phone:'bad'}))).status,400)
  const response=await app.handle(request(input));assert.equal(response.status,200)
  const result=await (await app.handle(new Request('https://sapa.example/api/contacts?mode=phone-overrides'))).json()
  assert.equal(result.records.length,1);assert.equal(result.records[0].phone,'6281234567890')
  assert.equal(cache.get('settings:followup-design').snapshot.design,'preserved')
})
