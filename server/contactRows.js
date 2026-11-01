import { normalizePhone, isValidIndonesianPhone } from '../src/utils/phoneUtils.js'
const key = value => String(value ?? '').toLowerCase().replace(/[\s_-]/g, '')
export function parseContactRows(rows) {
  const headerIndex = rows.slice(0, 20).findIndex(row => ['store', 'storename', 'acname', 'cugac'].every(name => row.map(key).includes(name)))
  if (headerIndex < 0) throw new Error('Kolom Store, Store Name, AC name, dan CUG AC tidak ditemukan pada sumber kontak.')
  const headers = rows[headerIndex].map(key)
  const columns = { store: 'store', storeName: 'storename', acName: 'acname', cugAc: 'cugac', cugToko: 'cugtoko', cabang: 'cabang', regional: 'regional', amName: 'amname', cugAm: 'cugam' }
  const index = Object.fromEntries(Object.entries(columns).map(([field, name]) => [field, headers.indexOf(name)]))
  const contacts = []
  for (let i = headerIndex + 1; i < rows.length; i++) {
    const row = Object.fromEntries(Object.entries(index).map(([field, col]) => [field, col < 0 ? '' : String(rows[i][col] ?? '').trim()]))
    if (!row.store || key(row.store) === 'store') continue
    row.store = row.store.toUpperCase()
    row.acName = /^(?:0|-|#.*)$/.test(row.acName) ? '' : row.acName.toUpperCase()
    row.cugAc = isValidIndonesianPhone(row.cugAc) ? normalizePhone(row.cugAc) : ''
    row.cugToko = normalizePhone(row.cugToko); row.cugAm = normalizePhone(row.cugAm)
    row.contactSource = 'spreadsheet'; contacts.push(row)
  }
  if (!contacts.length) throw new Error('Sumber kontak tidak berisi data toko. Kontak sebelumnya tetap dipertahankan.')
  return contacts
}
