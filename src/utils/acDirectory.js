import { normalizePhone, isValidIndonesianPhone } from './phoneUtils.js'

export const contactArea = value => String(value || '').trim().replace(/\s+/g, ' ').toUpperCase() || 'BELUM DIISI'

export function filterAcContacts(contacts, filters = {}) {
  return contacts.filter(contact => Object.entries(filters).every(([field, value]) => !value || contactArea(contact[field]) === value))
}

export function buildAcDirectory(contacts = []) {
  const entries = new Map()
  for (const contact of contacts) {
    const name = String(contact.acName || '').trim().toUpperCase()
    if (!name || /^(0|-|#.*)$/.test(name)) continue
    const phone = isValidIndonesianPhone(contact.cugAc) ? normalizePhone(contact.cugAc) : ''
    const key = `${name}|${phone}`
    if (!entries.has(key)) entries.set(key, { key, name, phone, stores: new Set(), regionals: new Set(), branches: new Set(), amNames: new Set(), provinces: new Set(), cities: new Set(), storeNames: new Set() })
    entries.get(key).regionals.add(contactArea(contact.regional))
    entries.get(key).branches.add(contactArea(contact.cabang))
    entries.get(key).amNames.add(contactArea(contact.amName))
    entries.get(key).provinces.add(contactArea(contact.province))
    entries.get(key).cities.add(contactArea(contact.city))
    if (contact.storeName) entries.get(key).storeNames.add(contact.storeName)
    if (contact.store) entries.get(key).stores.add(String(contact.store))
  }
  return [...entries.values()].map(entry => ({ ...entry, stores: [...entry.stores], regionals: [...entry.regionals].sort(), branches: [...entry.branches].sort(), amNames: [...entry.amNames].sort(), provinces: [...entry.provinces].sort(), cities: [...entry.cities].sort(), storeNames: [...entry.storeNames] }))
    .sort((a, b) => a.name.localeCompare(b.name, 'id') || a.phone.localeCompare(b.phone))
}
