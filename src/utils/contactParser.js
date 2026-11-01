import * as XLSX from 'xlsx'
import { normalizePhone } from './phoneUtils'

/**
 * Parser Cerdas untuk Data Master Kontak Pegawai Alfa (KONTAK TOKO BARU / KONTAK PEGAWAI ALFA)
 * Mendukung Copy-Paste langsung dari Google Sheets / Excel dan Upload File .xlsx / .csv
 */

/**
 * Parsing teks hasil Copy-Paste (TSV/CSV) dari Google Sheets / Excel
 * @param {string} rawText
 * @returns {Array<Object>}
 */
export function parseContactsRawText(rawText) {
  if (!rawText || !rawText.trim()) return []

  const lines = rawText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  // Deteksi separator (Tab untuk Google Sheets / Excel, Koma untuk CSV, Titik Koma untuk CSV Indo)
  const firstLine = lines[0]
  const tabCount = (firstLine.match(/\t/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const semicolonCount = (firstLine.match(/;/g) || []).length

  let separator = '\t'
  if (tabCount >= 2) separator = '\t'
  else if (semicolonCount >= 2) separator = ';'
  else if (commaCount >= 2) separator = ','

  // Split lines into 2D array
  const rows = lines.map((line) => {
    return line.split(separator).map((cell) => cell.trim().replace(/^["']|["']$/g, ''))
  })

  return process2DContactRows(rows)
}

/**
 * Parsing file Excel (.xlsx / .xls) atau CSV menggunakan format 2D Array
 * @param {ArrayBuffer} buffer
 * @returns {Array<Object>}
 */
export function parseContactsExcel(buffer) {
  const workbook = XLSX.read(buffer, { type: 'array' })
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) return []

  // Cari sheet yang paling relevan (misal 'KONTAK TOKO BARU', 'KONTAK PEGAWAI ALFA', atau sheet pertama)
  let targetSheetName = workbook.SheetNames[0]
  for (const name of workbook.SheetNames) {
    const lower = name.toLowerCase()
    if (lower.includes('kontak') || lower.includes('toko') || lower.includes('pegawai') || lower.includes('master')) {
      targetSheetName = name
      break
    }
  }

  const sheet = workbook.Sheets[targetSheetName]
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' })
  return process2DContactRows(rows)
}

/**
 * Helper untuk memproses 2D array baris kontak menjadi objek data standar
 * Menangani deteksi kolom dengan presisi tinggi (membedakan 'CUG AC' vs 'NO CUG AC')
 */
function process2DContactRows(rawRows) {
  if (!rawRows || rawRows.length === 0) return []

  // Filter baris kosong
  const rows = rawRows.filter((r) => Array.isArray(r) && r.some((c) => String(c).trim() !== ''))
  if (rows.length === 0) return []

  // 1. Periksa apakah baris pertama adalah Header
  const firstRow = rows[0].map((c) => String(c).trim().toLowerCase())
  const hasHeaderKeywords = firstRow.some((c) =>
    c.includes('store') ||
    c.includes('toko') ||
    c.includes('ac name') ||
    c.includes('cug') ||
    c.includes('cabang')
  )

  let colMap = {
    store: -1,
    storeName: -1,
    cugToko: -1,
    acName: -1,
    cugAc: -1,
    cabang: -1,
    regional: -1,
    amName: -1,
    cugAm: -1,
  }

  let dataStartIndex = 0

  if (hasHeaderKeywords) {
    dataStartIndex = 1

    firstRow.forEach((colName, idx) => {
      const clean = colName.trim().toLowerCase()

      // Store Code (Harus 'Store' atau 'Kode Toko', bukan 'Store Name')
      if (clean === 'store' || clean === 'kode toko' || clean === 'kode_toko' || clean === 'kdtk') {
        colMap.store = idx
      }
      // Store Name
      else if (clean === 'store name' || clean === 'nama toko' || clean === 'store_name') {
        colMap.storeName = idx
      }
      // CUG TOKO (Harus angka nomor toko, BUKAN formula 'NO CUG TOKO' yang berisi 'CugToko W177')
      else if (clean === 'cug toko' || clean === 'cug_toko' || clean === 'telepon toko' || clean === 'no hp toko') {
        colMap.cugToko = idx
      }
      // AC Name
      else if (clean === 'ac name' || clean === 'nama ac' || clean === 'ac_name' || clean === 'nama ac/am') {
        colMap.acName = idx
      }
      // CUG AC (KRUSIAL: Harus 'CUG AC' asli, BUKAN formula 'NO CUG AC' yang berisi hyperlink 'CugAC W177')
      else if (clean === 'cug ac' || clean === 'cug_ac' || clean === 'no cug ac (phone)' || clean === 'no hp ac' || clean === 'wa ac') {
        colMap.cugAc = idx
      }
      // Cabang
      else if (clean === 'cabang' || clean === 'dc' || clean === 'branch') {
        colMap.cabang = idx
      }
      // Regional
      else if (clean === 'regional' || clean === 'region' || clean === 'reg') {
        colMap.regional = idx
      }
      // AM Name
      else if (clean === 'am name' || clean === 'nama am' || clean === 'am_name') {
        colMap.amName = idx
      }
      // CUG AM
      else if (clean === 'cug am' || clean === 'cug_am' || clean === 'no cug am') {
        colMap.cugAm = idx
      }
    })

    // Fallback jika 'CUG AC' tidak ditemukan secara tepat, periksa kolom yang belum terpetakan
    if (colMap.cugAc === -1) {
      firstRow.forEach((colName, idx) => {
        const clean = colName.trim().toLowerCase()
        if (
          !clean.startsWith('no cug') &&
          clean.includes('ac') &&
          (clean.includes('cug') || clean.includes('no') || clean.includes('hp') || clean.includes('wa') || clean.includes('telepon')) &&
          !clean.includes('name') &&
          !clean.includes('nama')
        ) {
          colMap.cugAc = idx
        }
      })
    }
  } else {
    // 2. Jika TANPA HEADER (User langsung copy blok baris data dari spreadsheet Gambar 1 & 2)
    // Standar 10 Kolom Gambar 1 & 2:
    // [0] NO CUG TOKO | [1] NO CUG AC | [2] Store | [3] Store Name | [4] Cug Toko | [5] AC name | [6] CUG AC | [7] Cabang | [8] Regional | [9] AM Name
    const colCount = rows[0].length

    if (colCount >= 10) {
      colMap = {
        store: 2,
        storeName: 3,
        cugToko: 4,
        acName: 5,
        cugAc: 6,
        cabang: 7,
        regional: 8,
        amName: 9,
        cugAm: colCount > 10 ? 10 : -1,
      }
    } else if (colCount === 7 || colCount === 8) {
      // Format sederhana: Store, StoreName, CugToko, AcName, CugAc, Cabang, Regional
      colMap = {
        store: 0,
        storeName: 1,
        cugToko: 2,
        acName: 3,
        cugAc: 4,
        cabang: 5,
        regional: 6,
        amName: colCount > 7 ? 7 : -1,
        cugAm: -1,
      }
    } else {
      // Default fallback
      colMap = {
        store: 0,
        storeName: 1,
        cugToko: 2,
        acName: 3,
        cugAc: 4,
        cabang: 5,
        regional: 6,
        amName: -1,
        cugAm: -1,
      }
    }
  }

  // Helper aman ambil nilai dari baris
  const getVal = (row, index) => {
    if (index === -1 || index >= row.length) return ''
    return String(row[index] || '').trim()
  }

  const result = []

  for (let i = dataStartIndex; i < rows.length; i++) {
    const r = rows[i]
    if (!r || r.length === 0) continue

    const store = getVal(r, colMap.store)
    const storeName = getVal(r, colMap.storeName)
    const rawCugToko = getVal(r, colMap.cugToko)
    const acName = getVal(r, colMap.acName)
    const rawCugAc = getVal(r, colMap.cugAc)
    const cabang = getVal(r, colMap.cabang)
    const regional = getVal(r, colMap.regional)
    const amName = getVal(r, colMap.amName)
    const rawCugAm = getVal(r, colMap.cugAm)

    // Validasi baris: harus memiliki minimal Kode Toko atau Nama AC
    if (!store && !acName) continue

    // Abaikan jika baris berisi sisa header yang ter-copy berulang
    if (store.toLowerCase() === 'store' || acName.toLowerCase() === 'ac name') continue

    // Normalisasi nomor telepon CUG
    const cugAc = normalizePhone(rawCugAc)
    const cugToko = normalizePhone(rawCugToko)
    const cugAm = normalizePhone(rawCugAm)

    result.push({
      store: store.toUpperCase(),
      storeName: storeName.toUpperCase(),
      cugToko,
      acName: acName.toUpperCase(),
      cugAc,
      cabang: cabang.toUpperCase(),
      regional,
      amName: amName.toUpperCase(),
      cugAm,
    })
  }

  return result
}
