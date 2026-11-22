import { normalizePhone, isValidIndonesianPhone } from './phoneUtils.js'
const hasControl = value => [...value].some(char => char.charCodeAt(0) < 32)
const clean = value => String(value ?? '').trim().replace(/\s+/g, ' ')
export const acPhoneIdentity = (name, cabang) => JSON.stringify([clean(name).toUpperCase(), clean(cabang).replace(/^-$/, '').toUpperCase()])
export function cleanAcPhoneInput(value) {
  const acName = clean(value?.acName), cabang = clean(value?.cabang).replace(/^-$/, '')
  if (!acName || acName.length > 160 || hasControl(acName) || /^(AC TANPA NAMA|TANPA_NAMA|-)$/i.test(acName)) throw new Error('Nama AC belum valid. Periksa nama sebelum menyimpan nomor.')
  if (cabang.length > 160 || hasControl(cabang)) throw new Error('Nama cabang tidak valid.')
  const rawPhone = String(value?.phone ?? '').trim()
  const phone = normalizePhone(rawPhone)
  if (!/^[+\d\s().-]+$/.test(rawPhone) || rawPhone.length > 40 || !isValidIndonesianPhone(phone)) throw new Error('Isi nomor WhatsApp Indonesia yang valid, misalnya 0812… atau 62812….')
  return { acName, cabang, phone, identity: acPhoneIdentity(acName, cabang) }
}
export function applyAcPhoneOverrides(rows, records = []) {
  const index = new Map(records.map(record => [acPhoneIdentity(record.acName, record.cabang), record]))
  return rows.map(row => {
    const record = index.get(acPhoneIdentity(row.resolvedAcName || row.namaAc, row.cabang))
    return record && isValidIndonesianPhone(record.phone) ? {...row, resolvedPhone:normalizePhone(record.phone), phoneOverride:record, matchSource:'manual_contact'} : row
  })
}
