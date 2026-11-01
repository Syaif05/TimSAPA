import { db } from '../db/database'

/**
 * Format tanggal hari ini ke YYYY-MM-DD
 */
export function getTodayDateString() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format tanggal kemarin ke YYYY-MM-DD
 */
export function getYesterdayDateString() {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Format tanggal ke tampilan bahasa Indonesia yang user-friendly
 * Contoh: "Senin, 26 Okt 2026" atau "Kemarin (25 Okt)"
 */
export function formatDateDisplay(dateStr) {
  if (!dateStr) return '-'
  const today = getTodayDateString()
  const yesterday = getYesterdayDateString()

  const [y, m, d] = dateStr.split('-').map(Number)
  const dateObj = new Date(y, m - 1, d)

  const monthNames = [
    'Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun',
    'Jul', 'Agt', 'Sep', 'Okt', 'Nov', 'Des'
  ]
  const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu']

  const dayName = dayNames[dateObj.getDay()]
  const dateFormatted = `${dayName}, ${d} ${monthNames[m - 1]} ${y}`

  if (dateStr === today) {
    return `${dateFormatted} (Hari Ini)`
  } else if (dateStr === yesterday) {
    return `${dateFormatted} (Kemarin)`
  }
  return dateFormatted
}

/**
 * Buat kunci unik untuk sebuah pesanan kendala SAPA 3
 * Menjamin deteksi duplikasi akurat pada update data tiap 1 jam
 */
export function getOrderUniqueKey(row) {
  if (!row) return ''
  // 1. Shipment nomor unik pesanan (contoh: S-261024-AGTGNT)
  const shipment = String(row.shipment || '').trim().toUpperCase()
  if (shipment && shipment !== '-' && shipment !== '#N/A' && shipment.length > 3) {
    return `SHIPMENT_${shipment}`
  }

  // 2. Fallback jika shipment kosong: kombinasi Kode Toko + Nama Konsumen + Jam
  const kodeToko = String(row.kodeToko || '').trim().toUpperCase()
  const konsumen = String(row.namaKonsumen || '').trim().toUpperCase()
  const namaAc = String(row.namaAc || '').trim().toUpperCase()
  const jam = String(row.jam || '').trim()

  return `ORDER_${kodeToko}_${konsumen}_${namaAc}_${jam}`
}

/**
 * Menggabungkan data pesanan baru dengan data yang sudah ada (Anti-Duplikat Cerdas)
 * 
 * Aturan:
 * 1. Pesanan yang sudah ada TIDAK digandakan (dilewati).
 * 2. Status pengerjaan AC yang sudah dikerjakan/dihubungi TETAP DIPERTAHANKAN.
 * 3. Jika SLA pesanan lama naik (misal dari > 1 Jam menjadi > 2 Jam), SLA diperbarui.
 * 4. Pesanan baru ditambahkan ke antrean.
 */
export function mergeSapaRowsWithDeduplication(existingRows = [], incomingRows = [], mode = 'merge_skip_duplicates') {
  if (mode === 'replace') {
    // Mode Timpa Bersih
    return {
      mergedRows: incomingRows,
      newCount: incomingRows.length,
      duplicateCount: 0,
      updatedCount: 0,
    }
  }

  if (mode === 'append_all') {
    // Mode Tambah Semua Tanpa Filter
    return {
      mergedRows: [...existingRows, ...incomingRows],
      newCount: incomingRows.length,
      duplicateCount: 0,
      updatedCount: 0,
    }
  }

  // Default: Smart Anti-Duplicate Merge (Rekomendasi Update 1 Jam Sekali)
  const existingMap = new Map()
  const resultRows = [...existingRows]

  existingRows.forEach((row, idx) => {
    const key = getOrderUniqueKey(row)
    if (key) {
      existingMap.set(key, idx)
    }
  })

  let newCount = 0
  let duplicateCount = 0
  let updatedCount = 0

  incomingRows.forEach((inRow) => {
    const key = getOrderUniqueKey(inRow)

    if (key && existingMap.has(key)) {
      // Data sudah ada sebelumnya (Duplikat)
      duplicateCount++
      const existingIdx = existingMap.get(key)
      const existing = resultRows[existingIdx]

      // Perbarui SLA jika data baru memiliki SLA lebih tinggi/terbaru
      if (inRow.sla && inRow.sla !== existing.sla) {
        resultRows[existingIdx] = {
          ...existing,
          sla: inRow.sla,
          jam: inRow.jam || existing.jam,
        }
        updatedCount++
      }
    } else {
      // Data Baru (Belum pernah ada sebelumnya)
      newCount++
      if (key) {
        existingMap.set(key, resultRows.length)
      }
      resultRows.push({
        ...inRow,
        id: inRow.id || `sapa-row-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        importedAt: Date.now(),
      })
    }
  })

  return {
    mergedRows: resultRows,
    newCount,
    duplicateCount,
    updatedCount,
  }
}

/**
 * Simpan sesi harian (data rows + status pengerjaan) ke localStorage & Dexie IndexedDB
 */
export async function saveDailySession(dateStr, rawRows, statusMap = {}, scope = {}) {
  const storage = scope.storage || localStorage
  const dbKey = scope.pic ? `${encodeURIComponent(scope.pic)}:${dateStr}` : dateStr
  if (!dateStr) return

  const sessionData = {
    date: dateStr,
    updatedAt: Date.now(),
    rawRows: rawRows || [],
    statusMap: statusMap || {},
    totalRows: (rawRows || []).length,
  }

  // 1. Simpan ke localStorage untuk akses cepat instan
  try {
    storage.setItem(`sapa_session_${dateStr}`, JSON.stringify(sessionData))

    // Perbarui daftar tanggal yang tersimpan
    const savedDates = getStoredSessionDates(scope)
    if (!savedDates.includes(dateStr)) {
      savedDates.push(dateStr)
      savedDates.sort((a, b) => b.localeCompare(a))
      storage.setItem('sapa_saved_session_dates', JSON.stringify(savedDates))
    }
  } catch (err) {
    console.error('Failed to save session to localStorage:', err)
  }

  // 2. Simpan ke Dexie IndexedDB untuk penyimpanan jangka panjang tak terbatas
  try {
    await db.daily_sessions.put({ ...sessionData, date: dbKey, sessionDate: dateStr })
  } catch (err) {
    console.error('Failed to save session to IndexedDB:', err)
  }
}

/**
 * Muat sesi harian untuk tanggal tertentu dari localStorage atau Dexie
 */
export async function loadDailySession(dateStr, scope = {}) {
  const storage = scope.storage || localStorage
  const dbKey = scope.pic ? `${encodeURIComponent(scope.pic)}:${dateStr}` : dateStr
  if (!dateStr) return null

  // 1. Coba dari localStorage terlebih dahulu
  try {
    const raw = storage.getItem(`sapa_session_${dateStr}`)
    if (raw) {
      return JSON.parse(raw)
    }
  } catch (err) {
    console.error(err)
  }

  // 2. Coba dari Dexie IndexedDB
  try {
    const session = await db.daily_sessions.get(dbKey)
    if (session) {
      // Simpan kembali ke localStorage untuk cache
      try {
        storage.setItem(`sapa_session_${dateStr}`, JSON.stringify({ ...session, date: dateStr }))
      } catch {}
      return { ...session, date: dateStr }
    }
  } catch (err) {
    console.error(err)
  }

  return null
}

/**
 * Bersihkan/Reset data sesi harian untuk tanggal tertentu
 */
export async function clearDailySession(dateStr, scope = {}) {
  const storage = scope.storage || localStorage
  const dbKey = scope.pic ? `${encodeURIComponent(scope.pic)}:${dateStr}` : dateStr
  if (!dateStr) return

  // 1. Bersihkan di localStorage
  try {
    const sessionData = {
      date: dateStr,
      updatedAt: Date.now(),
      rawRows: [],
      statusMap: {},
      totalRows: 0,
    }
    storage.setItem(`sapa_session_${dateStr}`, JSON.stringify(sessionData))
  } catch (err) {
    console.error(err)
  }

  // 2. Bersihkan di Dexie
  try {
    await db.daily_sessions.delete(dbKey)
  } catch (err) {
    console.error(err)
  }
}

/**
 * Ambil daftar tanggal sesi yang pernah tersimpan
 * @returns {Array<string>} Tanggal terurut descending (terbaru di atas)
 */
export function getStoredSessionDates(scope = {}) {
  const storage = scope.storage || localStorage
  try {
    const raw = storage.getItem('sapa_saved_session_dates')
    if (raw) {
      const dates = JSON.parse(raw)
      if (Array.isArray(dates)) {
        return dates.sort((a, b) => b.localeCompare(a))
      }
    }
  } catch {}

  const today = getTodayDateString()
  return [today]
}
