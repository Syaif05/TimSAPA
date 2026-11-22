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

export { MAX_TEMPLATES, MAX_TEMPLATE_CONTENT, TEMPLATE_PERIODS, templateLibraryError } from '../../supabase/functions/pic-profiles/templateRules.js'

// One catalogue feeds both the variable picker and unknown-variable diagnostics.
export const TEMPLATE_VARIABLES = [
  ['salam','Waktu','Sapaan lengkap, misalnya Selamat pagi'], ['waktu','Waktu','Pagi / Siang / Sore / Malam'],
  ['jam_sekarang','Waktu','Jam sekarang WIB (HH.mm)'], ['tanggal','Waktu','Tanggal lengkap hari ini WIB'],
  ['tanggal_singkat','Waktu','Tanggal hari ini (DD/MM/YYYY)'], ['hari','Waktu','Nama hari WIB'],
  ['tanggal_data','Waktu','Tanggal sumber Monitoring'], ['jam','Waktu','Jam monitoring'], ['daftar_jam','Waktu','Semua jam monitoring pada pesanan aktif'],
  ['nama_ac','Identitas','Nama AC'], ['cug_ac','Identitas','Nomor WhatsApp AC'], ['pic','Identitas','PIC pada pesanan aktif'],
  ['cabang','Identitas','Cabang / DC pada pesanan aktif'], ['region','Identitas','Regional pada pesanan aktif'],
  ['nama_am','Identitas','Nama AM pada data aktif'], ['cug_am','Identitas','Nomor AM pada data aktif'], ['cug_toko','Identitas','Nomor toko pada data aktif'],
  ['total_toko','Toko','Jumlah toko unik'], ['daftar_toko','Toko','Daftar kode dan nama toko bernomor'],
  ['daftar_nama_toko','Toko','Nama toko saja, satu per baris'], ['nama_toko_koma','Toko','Nama toko dipisah koma'],
  ['daftar_kode_toko','Toko','Kode toko saja, satu per baris'], ['kode_toko_koma','Toko','Kode toko dipisah koma'],
  ['rincian_toko','Toko','Jumlah pesanan per toko'], ['daftar_toko_dan_shipment','Toko','Rincian toko, shipment, konsumen dan SLA'],
  ['total_shipment','Pesanan','Jumlah pesanan aktif'], ['daftar_shipment','Pesanan','Shipment dan SLA per baris'],
  ['shipment_koma','Pesanan','Nomor shipment unik dipisah koma'], ['total_ds','Pesanan','Jumlah pesanan DS'], ['total_reg','Pesanan','Jumlah pesanan REG'],
  ['shipment_ds','Pesanan','Shipment DS dipisah koma'], ['shipment_reg','Pesanan','Shipment REG dipisah koma'],
  ['sumber','Pesanan','Sumber aktif: DS / REG / DS + REG'], ['daftar_konsumen','Pesanan','Nama konsumen unik'],
  ['status_pesanan','Pesanan','Status pesanan dari spreadsheet'], ['rincian_sla','Pesanan','Jumlah pesanan per SLA'],
  ['daftar_kendala','Follow up','Catatan kendala unik'], ['daftar_grouping','Follow up','Kategori grouping unik'],
  ['daftar_pejabat','Follow up','Nama pejabat toko unik'], ['kondisi_motor','Follow up','Kondisi motor pada data aktif'],
  ['personil_per_toko','Follow up','Jumlah personil per toko (tidak dijumlah berulang)'],
].map(([key, group, description]) => ({key, tag:`{${key}}`, group, description}))

export function messagePeriodAt(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat('en-GB', {timeZone:'Asia/Jakarta',hour:'2-digit',hourCycle:'h23'}).format(date))
  return hour >= 5 && hour < 11 ? 'Pagi' : hour >= 11 && hour < 15 ? 'Siang' : hour >= 15 && hour < 18 ? 'Sore' : 'Malam'
}
const unique = values => [...new Set(values.map(value => String(value ?? '').trim()).filter(value => value && value !== '-'))]
const textList = values => unique(values).map(value => `• ${value}`).join('\n') || '-'
const commaList = values => unique(values).join(', ') || '-'
export function templateValues(acGroup, {now = new Date(), period = 'auto', customVariables = {}} = {}) {
  const group = activeOrderGroup(acGroup)
  const rows = group?.rows || []
  const stores = new Map()
  rows.forEach(row => {
    const key = row.kodeToko || row.namaToko || 'Tanpa toko'
    if (!stores.has(key)) stores.set(key, {code:row.kodeToko, name:row.namaToko, rows:[]})
    stores.get(key).rows.push(row)
  })
  const storeList = [...stores.values()]
  const storeTitle = store => [store.code,store.name].filter(Boolean).join(' - ') || 'Tanpa toko'
  const sla = new Map()
  rows.forEach(row => sla.set(row.sla || 'Lainnya', (sla.get(row.sla || 'Lainnya') || 0) + 1))
  const chosenPeriod = ['Pagi','Siang','Sore','Malam'].includes(period) ? period : messagePeriodAt(now)
  const format = options => new Intl.DateTimeFormat('id-ID', {timeZone:'Asia/Jakarta',...options}).format(now)
  const sources = ['DS','REG'].filter(source => rows.some(row => row.source === source))
  const fromRows = (key, fallback) => commaList(rows.map(row => row[key]).filter(Boolean).concat(rows.some(row=>row[key]) ? [] : [fallback]))
  // Built-ins win over custom keys; values are substituted literally in a single pass.
  return {
    ...customVariables,
    nama_ac:group?.acName || 'Bapak/Ibu AC', cug_ac:group?.phone || '-',
    cabang:fromRows('cabang',group?.cabang), region:fromRows('region',group?.region), pic:fromRows('pic',group?.pic || 'PIC SAPA'),
    nama_am:fromRows('amName'), cug_am:commaList(rows.map(row=>row.resolvedAmPhone || row.noAm)),
    cug_toko:commaList(rows.map(row=>row.cugToko).concat(group?.cugToko || [])),
    salam:`Selamat ${chosenPeriod.toLowerCase()}`, waktu:chosenPeriod,
    jam_sekarang:format({hour:'2-digit',minute:'2-digit',hourCycle:'h23'}), tanggal:format({day:'numeric',month:'long',year:'numeric'}),
    tanggal_singkat:format({day:'2-digit',month:'2-digit',year:'numeric'}), hari:format({weekday:'long'}),
    tanggal_data:commaList(rows.map(row=>row.sheetDate)), jam:group?.jam || '-', daftar_jam:textList(rows.map(row=>row.jam)),
    total_shipment:String(rows.length), total_toko:String(storeList.length),
    daftar_toko:storeList.map((store,index)=>`${index+1}. ${storeTitle(store)}`).join('\n') || '-',
    daftar_nama_toko:textList(storeList.map(store=>store.name)), nama_toko_koma:commaList(storeList.map(store=>store.name)),
    daftar_kode_toko:textList(storeList.map(store=>store.code)), kode_toko_koma:commaList(storeList.map(store=>store.code)),
    rincian_toko:storeList.map(store=>`• ${storeTitle(store)}: ${store.rows.length} pesanan`).join('\n') || '-',
    daftar_toko_dan_shipment:storeList.map(store=>`📍 *${storeTitle(store)}* (${store.rows.length} pesanan):\n${store.rows.map(row=>`   • ${row.shipment || '-'} | ${row.namaKonsumen || 'Konsumen'} | ${row.sla || '-'}`).join('\n')}`).join('\n') || '-',
    daftar_shipment:rows.map(row=>`• ${row.shipment || '-'} (${row.sla || '-'})`).join('\n') || '-', shipment_koma:commaList(rows.map(row=>row.shipment)),
    total_ds:String(rows.filter(row=>row.source==='DS').length), total_reg:String(rows.filter(row=>row.source==='REG').length),
    shipment_ds:commaList(rows.filter(row=>row.source==='DS').map(row=>row.shipment)), shipment_reg:commaList(rows.filter(row=>row.source==='REG').map(row=>row.shipment)),
    sumber:sources.join(' + ') || '-', daftar_konsumen:textList(rows.map(row=>row.namaKonsumen)), status_pesanan:commaList(rows.map(row=>row.sheetStatus)),
    rincian_sla:[...sla].map(([label,count])=>`${count} pesanan ${label}`).join(', ') || '-',
    daftar_kendala:textList(rows.map(row=>row.kendala)), daftar_grouping:textList(rows.map(row=>row.grouping)), daftar_pejabat:textList(rows.map(row=>row.namaPejabat)),
    kondisi_motor:commaList(rows.map(row=>row.kondisiMotor)),
    personil_per_toko:storeList.filter(store=>unique(store.rows.map(row=>row.jumlahPersonil)).length).map(store=>`• ${storeTitle(store)}: ${commaList(store.rows.map(row=>row.jumlahPersonil))} personil`).join('\n') || '-',
  }
}
export function unknownTemplateVariables(content, customVariables = {}) {
  const known = new Set([...TEMPLATE_VARIABLES.map(v=>v.key),...Object.keys(customVariables)])
  return unique([...String(content || '').matchAll(/\{([a-z][a-z0-9_]*)\}/gi)].map(match=>match[1].toLowerCase())).filter(key=>!known.has(key))
}
export function renderTemplate(templateString, acGroup, options = {}) {
  if (!templateString || !acGroup || !activeOrderGroup(acGroup).rows?.length) return ''
  const values = templateValues(acGroup, options)
  return String(templateString).replace(/\{([a-z][a-z0-9_]*)\}/gi, (match,key) => Object.hasOwn(values,key.toLowerCase()) ? String(values[key.toLowerCase()]) : match)
}
