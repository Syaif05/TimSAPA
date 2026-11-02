import Papa from 'papaparse'

export const TARIK_COLUMNS = [
  ['noAc', 'No AC'], ['namaAc', 'Nama AC'], ['kodeToko', 'Kode Toko'],
  ['namaToko', 'Nama Toko'], ['cabang', 'Cabang'], ['region', 'Region'],
  ['shipment', 'Shipment'], ['namaKonsumen', 'Nama Konsumen'], ['sla', 'SLA'],
  ['namaAm', 'Nama AM'], ['noAm', 'No AM'],
]
const REQUIRED = ['store_code', 'store_name', 'am_name', 'ac_name', 'branch', 'regional', 'shipment_id', 'customer_name', 'sla_category']
const key = value => String(value ?? '').trim().replace(/^\uFEFF/, '').toLowerCase()
const nameKey = value => String(value ?? '').trim().replace(/\s+/g, ' ').toUpperCase()
const text = value => String(value ?? '').trim()

export function parseTarikCsv(csv, contacts = []) {
  const input = String(csv ?? '').replace(/^\uFEFF/, '')
  const delimiter = input.split(/\r?\n/, 1)[0].includes(';') ? ';' : ','
  const parsed = Papa.parse(input, { header: true, skipEmptyLines: 'greedy', delimiter, transformHeader: key })
  const missing = REQUIRED.filter(field => !parsed.meta.fields?.includes(field))
  if (missing.length) throw new Error(`Kolom CSV tidak sesuai. Tidak ditemukan: ${missing.join(', ')}.`)
  if (parsed.errors.length) throw new Error(`CSV tidak dapat dibaca pada baris ${parsed.errors[0].row + 2}: ${parsed.errors[0].message}`)
  const byStore = new Map(), byName = new Map(), byAc = new Map()
  for (const contact of contacts) {
    if (contact.store) byStore.set(nameKey(contact.store), contact)
    if (contact.storeName) byName.set(nameKey(contact.storeName), contact)
    if (contact.acName && !byAc.has(nameKey(contact.acName))) byAc.set(nameKey(contact.acName), contact)
  }
  return parsed.data.filter(row => text(row.shipment_id)).map(row => {
    const contact = byStore.get(nameKey(row.store_code)) || byName.get(nameKey(row.store_name)) || byAc.get(nameKey(row.ac_name))
    return {
      source: nameKey(row.store_name).startsWith('DS') ? 'DS' : 'REG',
      noAc: text(contact?.cugAc), namaAc: text(row.ac_name), kodeToko: text(row.store_code),
      namaToko: text(row.store_name), cabang: text(row.branch), region: text(row.regional),
      shipment: text(row.shipment_id), namaKonsumen: text(row.customer_name), sla: text(row.sla_category),
      namaAm: text(row.am_name), noAm: text(contact?.cugAm),
    }
  })
}

const escapeTsv = value => /[\t\n\r"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value
export function tarikTsv(rows) {
  return [TARIK_COLUMNS.map(([, label]) => label), ...rows.map(row => TARIK_COLUMNS.map(([field]) => row[field] || ''))]
    .map(row => row.map(value => escapeTsv(String(value))).join('\t')).join('\n')
}
const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;')
export function tarikHtml(rows) {
  const cell = (tag, value) => `<${tag} style="font-family:Calibri,Arial,sans-serif;font-size:11pt">${escapeHtml(value)}</${tag}>`
  return `<table><thead><tr>${TARIK_COLUMNS.map(([, label]) => cell('th', label)).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${TARIK_COLUMNS.map(([field]) => cell('td', row[field] || '')).join('')}</tr>`).join('')}</tbody></table>`
}
