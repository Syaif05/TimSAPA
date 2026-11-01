import * as XLSX from 'xlsx'
import { parseContactRows } from './contactRows.js'
import { CONTACTS_SOURCE } from '../src/utils/sheetsConfig.js'
export function parseContactWorkbook(buffer) {
  if (buffer[0] !== 80 || buffer[1] !== 75) throw new Error('Sumber kontak tidak mengirim file Excel. Periksa akses baca file.')
  const workbook = XLSX.read(buffer, { type: 'buffer', sheets: [CONTACTS_SOURCE.sheet], cellHTML: false, cellFormula: false })
  const sheet = workbook.Sheets[CONTACTS_SOURCE.sheet]
  if (!sheet) throw new Error(`Sheet kontak ${CONTACTS_SOURCE.sheet} tidak ditemukan.`)
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true })
  return parseContactRows(rows)
}
