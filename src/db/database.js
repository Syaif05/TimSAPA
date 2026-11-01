import Dexie from 'dexie'
import { DEFAULT_CONTACTS } from './defaultContacts'

export const db = new Dexie('SapaAssistantDB')

db.version(1).stores({
  contacts: '++id, store, storeName, acName, cugAc, cabang, regional',
  settings: 'key',
  history: '++id, date, acName, cugAc, status, timestamp',
})

db.version(2).stores({
  contacts: '++id, store, storeName, acName, cugAc, cabang, regional',
  settings: 'key',
  history: '++id, date, acName, cugAc, status, timestamp',
  daily_sessions: 'date, updatedAt, totalRows, totalAc',
})

// Inisialisasi data master kontak default jika kosong
export async function initializeDatabase() {
  const count = await db.contacts.count()
  if (count === 0) {
    await db.contacts.bulkAdd(DEFAULT_CONTACTS)
  }
}

// Reset kontak ke default
export async function resetContactsToDefault() {
  await db.contacts.clear()
  await db.contacts.bulkAdd(DEFAULT_CONTACTS)
}

// Tambah / Timpa banyak kontak (misal dari file Excel)
export async function bulkImportContacts(contactsList, mode = 'append') {
  if (mode === 'replace') {
    await db.contacts.clear()
  }
  return await db.contacts.bulkAdd(contactsList)
}

// Cari kontak berdasarkan kata kunci (Store, Nama Toko, atau Nama AC)
export async function searchContacts(query = '') {
  const q = query.trim().toLowerCase()
  if (!q) {
    return await db.contacts.toArray()
  }
  return await db.contacts
    .filter((c) => {
      return (
        (c.store && c.store.toLowerCase().includes(q)) ||
        (c.storeName && c.storeName.toLowerCase().includes(q)) ||
        (c.acName && c.acName.toLowerCase().includes(q)) ||
        (c.cugAc && c.cugAc.includes(q)) ||
        (c.cabang && c.cabang.toLowerCase().includes(q))
      )
    })
    .toArray()
}
