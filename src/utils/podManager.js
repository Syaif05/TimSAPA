import { normalizePhone, formatPhoneDisplay, isValidIndonesianPhone, createWhatsAppWebUrl } from './phoneUtils'

/**
 * Data Sampel POD 2 Kolom (Persis Sesuai Gambar Lampiran User: 34 AC)
 */
export const SAMPLE_POD_TSV = `Nama AC	Shipment
ANDI SUPRIYADI	46
HENDRA WADI	36
TRI ARISETIAWAN	23
RULI SETIYAWAN	19
SYAMSUL AMRI	18
AZRIZAL	18
SUHAIDI	13
MUHAMMAD SYAIFUL	10
AL REDHO	9
ABDUL MUTHOLIB	5
TRIONO ARDIANTO	3
FEBRI ANGRIAWAN	3
DAMAN	3
SELVIA AFRIANI	2
RIBUT IRIYANTO	2
RAHMAN PULUNG	2
MURISKI ALEKSI PUTRA	2
MULYADI	2
FATRIANA RELINDA	2
DASRIL	2
ANDI GUNAWAN	2
AGIT BAHARI	2
AGA GUMANTARA	2
RION ANDIKA	1
NURWAN SAPUTRA	1
NOVIAN SAPUTRA	1
MUYA SAROH	1
M. TAMSIL	1
LEO AGUNG WAHYU KRISTI	1
KIES KARYA KANDRA	1
HADIRAT ZALUKHU	1
FIRMANDIANSYAH	1
DAPIT ANDINATA	1
ARIS SANDRA	1`

/**
 * Peta Nomor CUG AC Contoh untuk 34 AC pada data sampel gambar
 * Memastikan semua 34 AC memiliki nomor siap uji kirim otomatis
 */
export const SAMPLE_POD_PHONE_MAP = {
  'ANDI SUPRIYADI': '081294668140',
  'HENDRA WADI': '081294665201',
  'TRI ARISETIAWAN': '081294665202',
  'RULI SETIYAWAN': '081294665203',
  'SYAMSUL AMRI': '081294665204',
  'AZRIZAL': '081294665205',
  'SUHAIDI': '081294665206',
  'MUHAMMAD SYAIFUL': '081294665207',
  'AL REDHO': '081294665208',
  'ABDUL MUTHOLIB': '081294665209',
  'TRIONO ARDIANTO': '081294665210',
  'FEBRI ANGRIAWAN': '081294665211',
  'DAMAN': '081294665212',
  'SELVIA AFRIANI': '081294665213',
  'RIBUT IRIYANTO': '081294665214',
  'RAHMAN PULUNG': '081294665215',
  'MURISKI ALEKSI PUTRA': '081294665216',
  'MULYADI': '081294665217',
  'FATRIANA RELINDA': '081294665218',
  'DASRIL': '081294665219',
  'ANDI GUNAWAN': '081294665220',
  'AGIT BAHARI': '081294665221',
  'AGA GUMANTARA': '081294665222',
  'RION ANDIKA': '081294665223',
  'NURWAN SAPUTRA': '081294665224',
  'NOVIAN SAPUTRA': '081294665225',
  'MUYA SAROH': '081294665226',
  'M. TAMSIL': '081294665227',
  'LEO AGUNG WAHYU KRISTI': '081294665228',
  'KIES KARYA KANDRA': '081294665229',
  'HADIRAT ZALUKHU': '081294665230',
  'FIRMANDIANSYAH': '081294665231',
  'DAPIT ANDINATA': '081294665232',
  'ARIS SANDRA': '081294665233',
}

/**
 * Template Pesan Default untuk Pengingat POD
 */
export const DEFAULT_POD_TEMPLATE = `Halo Selamat {waktu_salam} Pak/Bu {nama_ac},

Izin menginfokan dan mengingatkan untuk operasional toko binaan Bapak/Ibu saat ini terdapat *{jumlah_shipment} pesanan* Alfagift yang masih perlu diselesaikan proses *POD (Proof of Delivery)*.

Mohon bantuannya untuk dikoordinasikan ke tim toko agar segera diselesaikan konfirmasi POD-nya hari ini ya Pak/Bu, agar pesanan tidak menggantung.

Terima kasih banyak atas perhatian dan kerja samanya! 🙏`

/**
 * Helper untuk menentukan salam berdasarkan jam komputer
 */
export function getWaktuSalam() {
  const hour = new Date().getHours()
  if (hour >= 4 && hour < 11) return 'Pagi'
  if (hour >= 11 && hour < 15) return 'Siang'
  if (hour >= 15 && hour < 18) return 'Sore'
  return 'Malam'
}

/**
 * Parsing teks 2 kolom (Nama AC [tab/koma/spasi] Shipment)
 * @param {string} rawText
 * @returns {Array<Object>} List of { namaAc, shipmentCount, acKey, id }
 */
export function parsePodText(rawText) {
  if (!rawText || !rawText.trim()) return []

  const lines = rawText.trim().split(/\r?\n/)
  const result = []

  lines.forEach((line, index) => {
    const trimmed = line.trim()
    if (!trimmed) return

    // Coba pisahkan berdasarkan Tab (\t)
    let parts = trimmed.split('\t').map((p) => p.trim()).filter(Boolean)

    // Jika bukan Tab, coba pisahkan berdasarkan titik koma (;) atau koma (,)
    if (parts.length < 2) {
      parts = trimmed.split(/[;,]/).map((p) => p.trim()).filter(Boolean)
    }

    // Jika masih gagal dan ada spasi sebelum angka di akhir baris (misal: "ANDI SUPRIYADI 46")
    if (parts.length < 2) {
      const match = trimmed.match(/^(.*?)[\s\t]+(\d+)$/)
      if (match) {
        parts = [match[1].trim(), match[2].trim()]
      }
    }

    if (parts.length >= 2) {
      let rawName = parts[0].trim()
      let rawCount = parts[1].trim()

      // Jika baris pertama adalah baris judul (header), lewati
      const lowerName = rawName.toLowerCase()
      const lowerCount = rawCount.toLowerCase()
      if (
        (lowerName.includes('nama') || lowerName.includes('ac')) &&
        (lowerCount.includes('shipment') || lowerCount.includes('jumlah') || lowerCount.includes('total') || isNaN(Number(rawCount)))
      ) {
        return
      }

      // Bersihkan angka shipment
      const cleanCountStr = rawCount.replace(/\D/g, '')
      const count = parseInt(cleanCountStr, 10) || 1

      // Format nama AC ke huruf kapital rapi
      const cleanName = rawName.replace(/["']/g, '').trim().toUpperCase()
      if (!cleanName || cleanName === '-' || cleanName === '#N/A') return

      const acKey = cleanName.replace(/[^A-Z0-9]/gi, '_')

      result.push({
        id: `pod-${index}-${acKey}`,
        acKey,
        namaAc: cleanName,
        shipmentCount: count,
      })
    }
  })

  return result
}

/**
 * Mencocokkan daftar AC POD dengan Database Master Kontak Pegawai Alfa
 * @param {Array<Object>} podList
 * @param {Array<Object>} masterContacts
 * @param {Object} phoneOverrides
 * @returns {Array<Object>}
 */
export function matchPodWithContacts(podList = [], masterContacts = [], phoneOverrides = {}) {
  // Buat indeks nama AC dari master contacts
  const exactMap = new Map()
  const simplifiedMap = new Map()

  const simplify = (str) =>
    String(str || '')
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .trim()

  masterContacts.forEach((c) => {
    if (c.acName) {
      const original = c.acName.trim().toUpperCase()
      const validPhone = normalizePhone(c.cugAc)

      if (validPhone && isValidIndonesianPhone(validPhone)) {
        if (!exactMap.has(original)) {
          exactMap.set(original, { ...c, phone: validPhone })
        }

        const simp = simplify(c.acName)
        if (simp && !simplifiedMap.has(simp)) {
          simplifiedMap.set(simp, { ...c, phone: validPhone })
        }
      }
    }
  })

  return podList.map((item) => {
    const acNameUpper = item.namaAc.toUpperCase()
    const acNameSimp = simplify(item.namaAc)

    // 1. Cek manual phone override terlebih dahulu
    let phone = ''
    let source = 'none'
    let matchedContact = null

    if (phoneOverrides && phoneOverrides[item.acKey]) {
      phone = normalizePhone(phoneOverrides[item.acKey])
      if (isValidIndonesianPhone(phone)) {
        source = 'manual_override'
      }
    }

    // 2. Cek exact match dari master kontak
    if (!phone && exactMap.has(acNameUpper)) {
      matchedContact = exactMap.get(acNameUpper)
      phone = matchedContact.phone
      source = 'master_exact'
    }

    // 3. Cek simplified match (misal ada titik atau spasi berbeda seperti "M. TAMSIL" vs "M TAMSIL")
    if (!phone && simplifiedMap.has(acNameSimp)) {
      matchedContact = simplifiedMap.get(acNameSimp)
      phone = matchedContact.phone
      source = 'master_fuzzy'
    }

    // 4. Cek partial inclusion match jika belum ketemu
    if (!phone) {
      for (const [keyName, contactData] of exactMap.entries()) {
        if (keyName.includes(acNameUpper) || acNameUpper.includes(keyName)) {
          matchedContact = contactData
          phone = contactData.phone
          source = 'master_partial'
          break
        }
      }
    }

    const hasPhone = Boolean(phone && isValidIndonesianPhone(phone))

    return {
      ...item,
      phone: phone || '',
      formattedPhone: phone ? formatPhoneDisplay(phone) : '',
      hasPhone,
      source,
      branch: matchedContact?.cabang || '-',
      regional: matchedContact?.regional || '-',
    }
  })
}

/**
 * Render template pesan POD untuk seorang AC
 */
export function renderPodMessage(template, acItem) {
  if (!template) return ''
  const waktuSalam = getWaktuSalam()
  const todayStr = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })

  return template
    .replace(/{nama_ac}/gi, acItem.namaAc || 'Bapak/Ibu AC')
    .replace(/{jumlah_shipment}/gi, String(acItem.shipmentCount || 0))
    .replace(/{waktu_salam}/gi, waktuSalam)
    .replace(/{tanggal}/gi, todayStr)
}

/**
 * Suara sintetis (Web Audio API) untuk notifikasi pengiriman & selesai
 */
export function playChimeSound(type = 'dispatch') {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext
    if (!AudioContext) return
    const ctx = new AudioContext()

    if (type === 'dispatch') {
      // Suara beep pop ceria saat 1 pesan terkirim
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, ctx.currentTime) // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15) // A5
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      osc.stop(ctx.currentTime + 0.25)
    } else if (type === 'complete') {
      // Melodi selesai (3 nada: C5 - E5 - G5)
      const notes = [523.25, 659.25, 783.99]
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'triangle'
        osc.frequency.setValueAtTime(freq, ctx.currentTime + i * 0.12)
        gain.gain.setValueAtTime(0.18, ctx.currentTime + i * 0.12)
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.3)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(ctx.currentTime + i * 0.12)
        osc.stop(ctx.currentTime + i * 0.12 + 0.35)
      })
    }
  } catch (err) {
    // Ignore audio autoplay restrictions
  }
}
