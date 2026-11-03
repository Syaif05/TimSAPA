import { normalizePhone, isValidIndonesianPhone } from './phoneUtils.js'

export function buildAcDirectory(contacts = []) {
  const entries = new Map()
  for (const contact of contacts) {
    const name = String(contact.acName || '').trim().toUpperCase()
    if (!name || /^(0|-|#.*)$/.test(name)) continue
    const phone = isValidIndonesianPhone(contact.cugAc) ? normalizePhone(contact.cugAc) : ''
    const key = `${name}|${phone}`
    if (!entries.has(key)) entries.set(key, { key, name, phone, stores: new Set() })
    if (contact.store) entries.get(key).stores.add(String(contact.store))
  }
  return [...entries.values()].map(entry => ({ ...entry, stores: [...entry.stores] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id') || a.phone.localeCompare(b.phone))
}
