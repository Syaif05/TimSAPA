import Papa from 'papaparse'

/**
 * Normalisasi nama header agar mudah dicocokkan
 */
function cleanHeader(h) {
  if (!h) return ''
  return String(h).toLowerCase().replace(/[\r\n\t_ -]/g, '')
}

/**
 * Deteksi apakah baris pertama merupakan header
 */
function isHeaderRow(row) {
  const text = row.map((cell) => cleanHeader(cell)).join(' ')
  const keywords = ['jam', 'ac', 'toko', 'store', 'cabang', 'dc', 'shipment', 'sla', 'pic', 'konsumen']
  let matchCount = 0
  for (const kw of keywords) {
    if (text.includes(kw)) matchCount++
  }
  return matchCount >= 3
}

/**
 * Petakan indeks kolom berdasarkan nama header
 */
function mapHeaderIndices(headers) {
  const map = {
    jam: -1,
    noAc: -1,
    namaAc: -1,
    kodeToko: -1,
    namaToko: -1,
    cabang: -1,
    region: -1,
    shipment: -1,
    namaKonsumen: -1,
    sla: -1,
    pic: -1,
    sheetStatus: -1,
    source: -1,
  }

  headers.forEach((h, idx) => {
    const ch = cleanHeader(h)
    if (map.jam === -1 && (ch === 'jam' || ch.includes('time') || ch === 'waktu')) {
      map.jam = idx
    } else if (map.noAc === -1 && (ch.includes('noac') || ch.includes('cugac') || ch.includes('hpac') || ch.includes('telpac'))) {
      map.noAc = idx
    } else if (map.namaAc === -1 && (ch.includes('namaac') || ch.includes('acname') || ch === 'ac')) {
      map.namaAc = idx
    } else if (map.kodeToko === -1 && (ch.includes('kodetoko') || ch === 'store' || ch.includes('storecode') || ch === 'kdtoko')) {
      map.kodeToko = idx
    } else if (map.namaToko === -1 && (ch.includes('namatoko') || ch.includes('storename') || ch === 'toko')) {
      map.namaToko = idx
    } else if (map.cabang === -1 && (ch.includes('cabang') || ch === 'dc' || ch.includes('branch'))) {
      map.cabang = idx
    } else if (map.region === -1 && (ch.includes('region') || ch === 'reg')) {
      map.region = idx
    } else if (map.shipment === -1 && (ch.includes('shipment') || ch.includes('noshipment'))) {
      map.shipment = idx
    } else if (map.namaKonsumen === -1 && (ch.includes('konsumen') || ch.includes('customer'))) {
      map.namaKonsumen = idx
    } else if (map.sla === -1 && ch.includes('sla')) {
      map.sla = idx
    } else if (map.sheetStatus === -1 && ['status', 'statuspesanan', 'sheetstatus'].includes(ch)) {
      map.sheetStatus = idx
    } else if (map.source === -1 && ['source', 'sumber'].includes(ch)) {
      map.source = idx
    } else if (map.pic === -1 && ch.includes('pic')) {
      map.pic = idx
    }
  })

  return map
}

/**
 * Heuristik pendeteksian kolom jika dicopy TANPA baris header
 */
function inferColumnIndices(rows) {
  // Standar urutan kolom Gambar 1 (MONITORING SAPA 3):
  // 0: Jam, 1: No AC, 2: Nama AC, 3: Kode Toko, 4: Nama Toko, 5: Cabang, 6: Region, 7: Shipment, 8: Nama Konsumen, 9: SLA, 10: PIC
  const map = {
    jam: 0,
    noAc: 1,
    namaAc: 2,
    kodeToko: 3,
    namaToko: 4,
    cabang: 5,
    region: 6,
    shipment: 7,
    namaKonsumen: 8,
    sla: 9,
    pic: 10,
  }

  // Jika jumlah kolom >= 11, periksa sampel baris untuk konfirmasi shipment & SLA
  if (rows.length > 0 && rows[0].length >= 8) {
    const sample = rows.slice(0, 5)
    for (let c = 0; c < rows[0].length; c++) {
      const colValues = sample.map(r => String(r[c] || '').trim())
      // Cek apakah kolom ini Shipment (format diawali S- atau s-)
      if (colValues.some(v => /^s-\d+/i.test(v))) {
        map.shipment = c
      }
      // Cek apakah kolom ini Cabang (diawali DC )
      if (colValues.some(v => /^dc\s+/i.test(v))) {
        map.cabang = c
      }
      // Cek apakah kolom ini Region (diawali Reg )
      if (colValues.some(v => /^reg\s+/i.test(v))) {
        map.region = c
      }
      // Cek apakah kolom ini SLA (ada kata Jam atau Menit)
      if (colValues.some(v => /jam|menit/i.test(v))) {
        map.sla = c
      }
      // Cek apakah kolom ini Jam (format 08.00, 09:00 dsb)
      if (colValues.some(v => /^\d{2}[.:]\d{2}$/.test(v))) {
        map.jam = c
      }
    }
  }

  return map
}

/**
 * Parsing data teks mentah (TSV dari clipboard Google Sheets atau CSV)
 * @param {string} rawText
 * @returns {Array<Object>} Daftar baris data Monitoring SAPA 3
 */
export function parseSapaRawText(rawText) {
  if (!rawText || !rawText.trim()) return []

  const parsed = Papa.parse(rawText.trim(), {
    delimiter: rawText.includes('\t') ? '\t' : undefined,
    skipEmptyLines: true,
  })

  const rows = parsed.data
  if (!rows || rows.length === 0) return []

  let colMap
  let dataRows = rows

  if (isHeaderRow(rows[0])) {
    colMap = mapHeaderIndices(rows[0])
    dataRows = rows.slice(1)
  } else {
    colMap = inferColumnIndices(rows)
  }

  return transformRowsToObjects(dataRows, colMap)
}

/**
 * Parsing file Excel (.xlsx / .xls)
 * @param {ArrayBuffer} buffer
 * @returns {Array<Object>}
 */
export async function parseSapaExcel(buffer) {
  const XLSX = await import('xlsx')
  const workbook = XLSX.read(buffer, { type: 'array' })
  const firstSheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[firstSheetName]
  const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

  if (!rows || rows.length === 0) return []

  // Filter baris kosong
  const cleanRows = rows.filter(r => r && r.length > 0 && r.some(c => c !== null && c !== undefined && String(c).trim() !== ''))

  let colMap
  let dataRows = cleanRows

  if (cleanRows.length > 0 && isHeaderRow(cleanRows[0])) {
    colMap = mapHeaderIndices(cleanRows[0])
    dataRows = cleanRows.slice(1)
  } else {
    colMap = inferColumnIndices(cleanRows)
  }

  return transformRowsToObjects(dataRows, colMap)
}

function getVal(row, idx) {
  if (idx < 0 || idx >= row.length) return ''
  const v = row[idx]
  if (v === null || v === undefined) return ''
  return String(v).trim()
}

function transformRowsToObjects(rows, colMap) {
  const results = []

  rows.forEach((r, idx) => {
    // Lewati baris kosong
    if (!r || r.length === 0 || !r.some(cell => cell && String(cell).trim() !== '')) {
      return
    }

    const kodeToko = getVal(r, colMap.kodeToko)
    const namaToko = getVal(r, colMap.namaToko)
    const shipment = getVal(r, colMap.shipment)

    // Jika kode toko dan shipment kosong sama sekali, abaikan baris
    if (!kodeToko && !shipment && !namaToko) return

    results.push({
      id: `sapa-${idx + 1}-${Date.now()}`,
      jam: getVal(r, colMap.jam) || '08.00',
      noAc: getVal(r, colMap.noAc),
      namaAc: getVal(r, colMap.namaAc),
      kodeToko: kodeToko,
      namaToko: namaToko,
      cabang: getVal(r, colMap.cabang),
      region: getVal(r, colMap.region),
      shipment: shipment,
      namaKonsumen: getVal(r, colMap.namaKonsumen),
      sla: getVal(r, colMap.sla) || '4. > 1 Jam',
      pic: getVal(r, colMap.pic) || 'SEMUA',
      sheetStatus: getVal(r, colMap.sheetStatus ?? -1),
      source: getVal(r, colMap.source ?? -1).toUpperCase(),
    })
  })

  return results
}
