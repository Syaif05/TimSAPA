/**
 * Utilitas untuk Parsing, Pemisahan Otomatis (Anti-Glued), dan Penggabungan Nomor Shipment Alfagift
 */

export const SAMPLE_GLUED_SHIPMENTS = `S-261027-AGJGFQNS-261027-AGVZNKF
S-261027-AGFCDCWS-261027-AGTLLXSS-261027-AGLFHXT
S-261027-AGMRGFK`

export const SAMPLE_SHEET_COLUMN_SHIPMENTS = `Shipment No
S-261027-AGMKYVH
S-261027-AGZSQMQ
S-261027-AGFXDHG
S-261027-AGNJBKJ
S-261027-AGSYWKX
S-261027-AGJGFQN
S-261027-AGVZNKF
S-261027-AGFCDCW
S-261027-AGTLLXS
S-261027-AGLFHXT
S-261027-AGMRGFK`

/**
 * Ekstrak daftar nomor shipment dari teks mentah
 * @param {string} rawText
 * @param {Object} options
 * @returns {{ items: string[], rawCount: number, duplicatesRemoved: number }}
 */
export function extractShipments(rawText, options = {}) {
  const {
    autoUngluing = true,
    filterAlfagiftOnly = true,
    removeDuplicates = true,
    toUpperCase = true,
  } = options

  if (!rawText || typeof rawText !== 'string') {
    return { items: [], rawCount: 0, duplicatesRemoved: 0 }
  }

  let text = rawText

  // 1. Auto unglue: pisahkan jika ada nomor shipment yang menempel tanpa spasi/koma
  // Contoh: AGJGFQNS-261027-AGVZNKF -> AGJGFQN \n S-261027-AGVZNKF
  if (autoUngluing) {
    text = text.replace(/([A-Za-z0-9])(?=[A-Za-z]-\d{4,8}-[A-Za-z0-9])/g, '$1\n')
  }

  let items = []

  if (filterAlfagiftOnly) {
    // Pola format shipment Alfagift (Awalan huruf, tanggal YYMMDD, dash, kode unik)
    const regex = /[A-Za-z]-\d{4,8}-[A-Za-z0-9]+/g
    const matches = text.match(regex) || []
    items = matches
  } else {
    // Mode umum (ambil per token baris / spasi / koma)
    const tokens = text.split(/[\r\n,\t;]+/)
    items = tokens
      .map((t) => t.trim())
      .filter((t) => {
        if (!t) return false
        const lower = t.toLowerCase()
        return !['shipment', 'shipment no', 'no shipment', 'no', 'resi', 'no resi'].includes(lower)
      })
  }

  if (toUpperCase) {
    items = items.map((s) => s.toUpperCase().trim())
  } else {
    items = items.map((s) => s.trim())
  }

  const rawCount = items.length

  let finalItems = items
  let duplicatesRemoved = 0

  if (removeDuplicates) {
    finalItems = Array.from(new Set(items))
    duplicatesRemoved = rawCount - finalItems.length
  }

  return {
    items: finalItems,
    rawCount,
    duplicatesRemoved,
  }
}

/**
 * Format array nomor shipment menjadi string gabungan
 * @param {string[]} items
 * @param {string} separatorType
 * @param {string} customSeparator
 * @returns {string}
 */
export function formatJoinedShipments(items, separatorType = 'comma_no_space', customSeparator = '') {
  if (!items || items.length === 0) return ''

  switch (separatorType) {
    case 'comma_no_space': // S-1,S-2,S-3 (Persis kebutuhan user)
      return items.join(',')

    case 'comma_space': // S-1, S-2, S-3
      return items.join(', ')

    case 'sql_single_quotes': // 'S-1','S-2','S-3'
      return items.map((s) => `'${s}'`).join(',')

    case 'sql_single_quotes_space': // 'S-1', 'S-2', 'S-3'
      return items.map((s) => `'${s}'`).join(', ')

    case 'double_quotes': // "S-1","S-2","S-3"
      return items.map((s) => `"${s}"`).join(',')

    case 'newline': // 1 per baris
      return items.join('\n')

    case 'semicolon': // S-1;S-2;S-3
      return items.join(';')

    case 'custom':
      return items.join(customSeparator !== undefined ? customSeparator : ',')

    default:
      return items.join(',')
  }
}
