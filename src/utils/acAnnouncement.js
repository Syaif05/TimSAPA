export const EQUIPMENT_ANNOUNCEMENT = `Selamat siang, Bapak/Ibu {nama_ac}.

Sehubungan dengan adanya pendataan equipment SAPA toko, mohon bantuannya untuk mengisi formulir pada tautan berikut:

👉 https://forms.gle/1LvjcNgSGBC5pruS9

{info_wilayah}

Mohon bantuannya untuk membagikan formulir ini kepada pejabat toko yang bertugas di toko binaan Bapak/Ibu. Mohon dapat diselesaikan sebelum *Rabu, 4 November 2026 pukul 10.00 WIB*.
Terima kasih banyak atas perhatian dan kerja samanya. 🙏`

export const ANNOUNCEMENT_FIELDS = ['nama_ac', 'cabang', 'regional', 'am', 'provinsi', 'total_toko', 'kode_toko', 'info_wilayah']
const known = values => (values || []).filter(value => value && value !== 'BELUM DIISI').join(', ')
export function renderAcAnnouncement(template, ac) {
  if (!ac) return ''
  const branches = known(ac.branches)
  const regions = known(ac.regionals)
  const stores = ac.stores || []
  const scope = [branches && `Cabang: ${branches}`, regions && `Regional: ${regions}`, stores.length && `Toko dalam daftar ini: ${stores.length}`].filter(Boolean).join('\n')
  const values = { nama_ac: ac.name, cabang: branches || 'belum tersedia', regional: regions || 'belum tersedia', am: known(ac.amNames) || 'belum tersedia', provinsi: known(ac.provinces) || 'belum tersedia', total_toko: String(stores.length), kode_toko: stores.join(', '), info_wilayah: scope }
  return String(template).replace(/\{([a-z_]+)\}/g, (match, field) => Object.hasOwn(values, field) ? values[field] : match).replace(/\n{3,}/g, '\n\n').trim()
}
