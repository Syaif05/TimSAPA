/**
 * Normalisasi nomor HP ke format standar WhatsApp internasional (contoh: 62812xxxx)
 * @param {string|number} phone
 * @returns {string} Nomor yang sudah dinormalisasi (hanya digit, diawali 62) atau '' jika tidak valid
 */
export function normalizePhone(phone) {
  if (!phone) return ''

  // Konversi ke string dan buang semua karakter selain digit
  let str = String(phone).trim()

  // Abaikan teks formula, hyperlink, atau indikator invalid Excel
  if (
    str.toLowerCase().includes('cugac') ||
    str.toLowerCase().includes('cugtoko') ||
    str.toLowerCase().includes('invalid') ||
    str.includes('#N/A') ||
    str === '0' ||
    str === '-'
  ) {
    return ''
  }

  let clean = str.replace(/\D/g, '')

  // Nomor telepon asli minimal memiliki 8 digit sebelum country code
  // Nilai seperti "136", "16", "0" pasti bukan nomor telepon!
  if (!clean || clean.length < 8 || clean.length > 16) {
    return ''
  }

  // Jika diawali 08... -> ganti 0 di depan jadi 62
  if (clean.startsWith('08') || clean.startsWith('02')) {
    clean = '62' + clean.slice(1)
  }
  // Jika diawali 8... (format umum di Excel tanpa 0) -> tambahkan 62 di depan
  else if (clean.startsWith('8')) {
    clean = '62' + clean
  }
  // Jika diawali 62... -> sudah ada kode negara
  else if (clean.startsWith('62')) {
    // tetap
  }
  // Format nomor dengan 0 di depan lainnya (misal 0812...)
  else if (clean.startsWith('0')) {
    clean = '62' + clean.slice(1)
  }

  // Nomor standar WhatsApp Indonesia harus minimal 10 digit (628xxxxxxx)
  if (clean.length < 10) {
    return ''
  }

  return clean
}

/**
 * Format nomor untuk tampilan visual yang rapi (contoh: +62 812-9466-5237)
 * @param {string} phone
 * @returns {string}
 */
export function formatPhoneDisplay(phone) {
  const norm = normalizePhone(phone)
  if (!norm) return '-'
  if (norm.startsWith('62') && norm.length >= 10) {
    const p1 = norm.slice(0, 2)
    const p2 = norm.slice(2, 5)
    const p3 = norm.slice(5, 9)
    const p4 = norm.slice(9)
    return `+${p1} ${p2}-${p3}${p4 ? '-' + p4 : ''}`
  }
  return norm
}

/**
 * Validasi apakah nomor HP valid untuk WhatsApp Indonesia
 * @param {string} phone
 * @returns {boolean}
 */
export function isValidIndonesianPhone(phone) {
  const norm = normalizePhone(phone)
  // Nomor HP Indonesia minimal 10 digit (628...), maksimal 15 digit
  return /^628\d{8,12}$/.test(norm)
}

/**
 * Buat URL WhatsApp Web
 * @param {string} phone
 * @param {string} message
 * @returns {string}
 */
export function createWhatsAppWebUrl(phone, message) {
  const norm = normalizePhone(phone)
  const encodedText = encodeURIComponent(message || '')
  return `https://web.whatsapp.com/send?phone=${norm}&text=${encodedText}`
}

/**
 * Target window name standar agar WhatsApp Web selalu terbuka di tab yang sama (tidak membuka tab baru terus-menerus)
 */
export const WA_TAB_NAME = 'whatsapp_web'

// Menyimpan referensi window WhatsApp Web yang sedang aktif di browser
let waWindowRef = null

/**
 * Buka URL WhatsApp Web dengan mempertahankan tab yang sudah ada (reuse existing tab)
 * @param {string} url - URL lengkap WhatsApp Web
 * @param {string} targetName - Nama target window (default: 'whatsapp_web')
 * @returns {Window|null}
 */
export function openWhatsAppUrl(url, targetName = WA_TAB_NAME) {
  let win = null
  try {
    // 1. Jika kita sudah memiliki referensi window dan window belum ditutup oleh pengguna
    if (waWindowRef && !waWindowRef.closed && targetName === WA_TAB_NAME) {
      try {
        waWindowRef.location.href = url
        waWindowRef.focus()
        return waWindowRef
      } catch (err) {
        // Fallback jika browser membatasi direct location assignment
      }
    }

    // 2. Buka dengan named target (bukan '_blank' yang selalu membuat tab baru)
    // Named target akan mencari tab yang sudah memiliki nama tersebut di browser
    win = window.open(url, targetName)
    if (win) {
      if (targetName === WA_TAB_NAME) {
        waWindowRef = win
      }
      try {
        win.focus()
      } catch (err) {
        // ignore
      }
    }
  } catch (err) {
    console.error('Gagal membuka WhatsApp Web:', err)
  }
  return win
}

/**
 * Buka Chat WA untuk nomor dan pesan tertentu dengan reuse tab yang sudah ada
 * @param {string} phone
 * @param {string} message
 * @param {string} targetName
 * @returns {Window|null}
 */
export function openWhatsAppWeb(phone, message, targetName = WA_TAB_NAME) {
  const url = createWhatsAppWebUrl(phone, message)
  return openWhatsAppUrl(url, targetName)
}

