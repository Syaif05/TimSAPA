import { randomUUID } from 'node:crypto'
import { digest, httpError } from './googleOAuth.js'
import { queryPath } from './cloudDatabase.js'
import { cleanAcPhoneInput } from '../src/utils/acPhoneOverrides.js'
const prefix = 'contact-phone:'
export function createAcPhoneOverrides({ database, now = () => Date.now() }) {
  async function list() {
    const records = []
    for (let offset = 0; offset < 10000; offset += 250) {
      const rows = await database(queryPath('sapa_source_cache', {cache_key:`like.${prefix}*`,select:'snapshot',order:'cache_key.asc',limit:'250',offset:String(offset)}))
      records.push(...rows.map(row=>row.snapshot))
      if (rows.length < 250) return {records}
    }
    throw httpError(503, 'Daftar koreksi kontak terlalu besar. Hubungi admin.')
  }
  async function save(body) {
    let input
    try { input=cleanAcPhoneInput(body) } catch(error) { throw httpError(400,error.message) }
    const expectedVersion=body.expectedVersion ?? ''
    if(typeof expectedVersion!=='string' || (expectedVersion && !/^[a-f\d-]{36}$/i.test(expectedVersion)))throw httpError(400,'Versi nomor tidak valid. Muat ulang kontak.')
    const pic=String(body.pic||'').trim().replace(/\s+/g,' ').toUpperCase()
    if(!pic || pic.length>80 || !(await database(queryPath('sapa_pic_profiles',{name:`eq.${pic}`,select:'name'}))).length)throw httpError(403,'Pilih PIC terdaftar sebelum memperbarui nomor.')
    const settings=(await database('sapa_source_settings?id=eq.main&select=allow_pic_edits'))[0]
    if(settings?.allow_pic_edits===false)throw httpError(403,'Perubahan oleh PIC sedang dinonaktifkan admin.')
    const key=prefix+digest(input.identity)
    const record={...input,updatedBy:pic,updatedAt:new Date(now()).toISOString(),version:randomUUID()}
    const value={cache_key:key,snapshot:record,expires_at:'9999-12-31T00:00:00Z'}
    const result=expectedVersion
      ? await database(queryPath('sapa_source_cache',{cache_key:`eq.${key}`,'snapshot->>version':`eq.${expectedVersion}`}),{method:'PATCH',body:value})
      : await database('sapa_source_cache?on_conflict=cache_key',{method:'POST',body:value,prefer:'resolution=ignore-duplicates,return=representation'})
    if(!result.length)throw httpError(409,'Nomor AC sudah berubah di perangkat lain. Tekan Batal untuk memakai nomor terbaru, lalu edit kembali bila diperlukan.')
    return {record}
  }
  return {list,save}
}
