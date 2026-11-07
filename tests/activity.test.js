import test from 'node:test'
import assert from 'node:assert/strict'
import { cleanActivity, activityRange } from '../server/activity.js'
const event={id:'11111111-1111-4111-8111-111111111111',session:'22222222-2222-4222-8222-222222222222',action:'tarik_upload',feature:'tarik-data',units:12}
test('activity intake strips payload content and trusts only bounded fields',()=>{
 const result=cleanActivity({pic:' ana ',events:[{...event,filename:'PRIVATE.csv',message:'PRIVATE',activeSeconds:999}]})
 assert.equal(result.pic,'ANA');assert.equal(result.events[0].units,12)
 assert.equal(result.events[0].active_seconds,0)
 assert.equal(result.events[0].filename,undefined);assert.equal(result.events[0].message,undefined)
 assert.equal(cleanActivity({pic:'ANA',events:[{...event,action:'heartbeat',activeSeconds:999}]}).events[0].active_seconds,60)
 for(const input of [{pic:'',events:[event]},{pic:'ANA',events:[null]},{pic:'ANA',events:[{...event,action:'custom'}]},{pic:'ANA',events:Array(21).fill(event)}])assert.throws(()=>cleanActivity(input))
})
test('analytics date filters use complete WIB days and reject excessive or reversed ranges',()=>{
 const range=activityRange(new URL('https://sapa.example/api/admin/analytics?from=2026-11-07&to=2026-11-07&pic=ANA'))
 assert.equal(range.p_from,'2026-11-06T17:00:00.000Z');assert.equal(range.p_to,'2026-11-07T17:00:00.000Z');assert.equal(range.p_pic,'ANA')
 for(const query of ['from=2026-11-08&to=2026-11-07','from=2026-01-01&to=2026-11-07','from=2026-02-30','feature=unknown'])assert.throws(()=>activityRange(new URL(`https://sapa.example/?${query}`)))
})
