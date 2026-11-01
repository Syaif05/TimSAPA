import { activeOrderGroup } from './orderState.js'
// Template Pesan Bawaan Sistem
export const DEFAULT_TEMPLATES = {
  template_1: {
    id: 'template_1',
    name: 'Template 1: Keterlambatan Pengiriman (SLA > 1 Jam / > 2 Jam)',
    description: 'Untuk pesanan dengan keterlambatan SLA pengiriman',
    content: `Halo Selamat Siang Pak/Bu {nama_ac},

Izin menginformasikan terkait monitoring operasional SAPA Alfagift di wilayah binaan Bapak/Ibu.
Terdapat kendala keterlambatan pesanan (SLA) pada toko berikut:

{daftar_toko_dan_shipment}

Total Kendala: {total_shipment} Pesanan ({total_toko} Toko)
Jam Monitoring: {jam} | PIC: {pic}

Mohon bantuannya untuk dikoordinasikan ke personil toko terkait agar pengiriman dapat segera diselesaikan/diproses. Detail rincian pesanan terlampir pada gambar tabel di bawah. Terima kasih atas kerjasamanya 🙏`,
  },

  template_2: {
    id: 'template_2',
    name: 'Template 2: Pesanan Belum Dikirim',
    description: 'Untuk pesanan yang belum diserahkan ke kurir / konsumen',
    content: `Yth. Pak/Bu {nama_ac},

Mohon atensinya untuk pesanan Alfagift yang berstatus *Belum Dikirim* di toko binaan Bapak/Ibu:

{daftar_toko_dan_shipment}

Total: {total_shipment} Pesanan ({total_toko} Toko)
Jam Monitoring: {jam} | PIC: {pic}

Mohon bantuannya untuk follow-up ke toko agar segera dilakukan serah terima ke kurir/konsumen dan update status di sistem SAPA.
Tabel detail terlampir. Terima kasih! 🙏`,
  },

  template_3: {
    id: 'template_3',
    name: 'Template 3: Pembatalan Belum Disetujui',
    description: 'Untuk pengajuan cancel order yang menunggu persetujuan',
    content: `Halo Pak/Bu {nama_ac},

Mohon bantuan approval/konfirmasi terkait pengajuan *Pembatalan Pesanan Alfagift* pada toko binaan Bapak/Ibu:

{daftar_toko_dan_shipment}

Total: {total_shipment} Pengajuan Pembatalan
Jam Monitoring: {jam} | PIC: {pic}

Mohon konfirmasi agar status pesanan konsumen tidak menggantung. Rincian pesanan tertera pada gambar tabel terlampir. Terima kasih banyak atas dukungannya! 🙏`,
  },

  template_4: {
    id: 'template_4',
    name: 'Template 4: Custom Template',
    description: 'Template bebas yang disesuaikan kebutuhan operasional',
    content: `Selamat bertugas Pak/Bu {nama_ac},

Berikut kami kirimkan rekap kendala pesanan Alfagift wilayah {cabang}:
{daftar_toko_dan_shipment}

Total: {total_shipment} kendala ({total_toko} toko).
Jam: {jam} | PIC: {pic}

Mohon bantuan percepatan penyelesaian. Rincian tabel terlampir di bawah. Terima kasih! 🙏`,
  },
}

/**
 * Format teks ringkasan toko dan shipment
 */
function buildStoreShipmentSummary(rows) {
  // Kelompokkan per toko
  const storeMap = new Map()
  rows.forEach((r) => {
    const key = `${r.kodeToko} - ${r.namaToko}`
    if (!storeMap.has(key)) {
      storeMap.set(key, [])
    }
    storeMap.get(key).push(r)
  })

  const lines = []
  storeMap.forEach((shipments, storeName) => {
    lines.push(`📍 *${storeName}* (${shipments.length} pesanan):`)
    shipments.forEach((s) => {
      lines.push(`   • ${s.shipment} | ${s.namaKonsumen || 'Konsumen'} | ${s.sla}`)
    })
  })

  return lines.join('\n')
}

/**
 * Render template dengan variabel dinamis
 * @param {string} templateString
 * @param {Object} acGroup
 * @returns {string}
 */
export function renderTemplate(templateString, acGroup) {
  if (!templateString || !acGroup) return ''
  acGroup = activeOrderGroup(acGroup)
  if (!acGroup.rows?.length) return ''

  const storesList = acGroup.storesList || []
  const daftarTokoFormatted = storesList.map((s, idx) => `${idx + 1}. ${s}`).join('\n')

  const daftarShipmentFormatted = (acGroup.rows || [])
    .map((r) => `• ${r.shipment} (${r.sla})`)
    .join('\n')

  const daftarTokoDanShipment = buildStoreShipmentSummary(acGroup.rows || [])

  const slaSummary = Object.entries(acGroup.slaBreakdown || {})
    .map(([sla, count]) => `${count} pesanan ${sla}`)
    .join(', ')

  return templateString
    .replace(/\{nama_ac\}/gi, acGroup.acName || 'Bapak/Ibu AC')
    .replace(/\{cug_ac\}/gi, acGroup.phone || '-')
    .replace(/\{cabang\}/gi, acGroup.cabang || '-')
    .replace(/\{region\}/gi, acGroup.region || '-')
    .replace(/\{total_shipment\}/gi, String(acGroup.totalShipments || 0))
    .replace(/\{total_toko\}/gi, String(acGroup.totalStores || 0))
    .replace(/\{daftar_toko\}/gi, daftarTokoFormatted)
    .replace(/\{daftar_shipment\}/gi, daftarShipmentFormatted)
    .replace(/\{daftar_toko_dan_shipment\}/gi, daftarTokoDanShipment)
    .replace(/\{jam\}/gi, acGroup.jam || '08.00')
    .replace(/\{pic\}/gi, acGroup.pic || 'PIC SAPA')
    .replace(/\{rincian_sla\}/gi, slaSummary || '-')
}
