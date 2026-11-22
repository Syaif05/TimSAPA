// Shared by the browser and Edge Function so a library saved by the UI stays valid remotely.
export const MAX_TEMPLATES = 20
export const MAX_TEMPLATE_CONTENT = 20000
export const MAX_LIBRARY_BYTES = 160000
export const TEMPLATE_PERIODS = ['auto', 'Pagi', 'Siang', 'Sore', 'Malam']
export const validTemplateKey = key => typeof key === 'string' && /^template_([1-9]|1\d|20)$/.test(key)
export function templateLibraryError(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'Daftar template tidak valid.'
  const entries = Object.entries(value)
  if (!entries.length || entries.length > MAX_TEMPLATES) return 'Simpan antara 1 sampai 20 template per PIC.'
  for (const [key, tpl] of entries) {
    if (!validTemplateKey(key) || !tpl || typeof tpl !== 'object' || Array.isArray(tpl)) return 'Identitas template tidak valid.'
    if (typeof tpl.name !== 'string' || !tpl.name.trim() || tpl.name.length > 120) return 'Nama template wajib diisi, maksimal 120 karakter.'
    if (typeof tpl.content !== 'string' || tpl.content.length > MAX_TEMPLATE_CONTENT) return 'Isi setiap template maksimal 20.000 karakter.'
    if (tpl.description !== undefined && (typeof tpl.description !== 'string' || tpl.description.length > 500)) return 'Deskripsi maksimal 500 karakter.'
    if (tpl.period !== undefined && !TEMPLATE_PERIODS.includes(tpl.period)) return 'Pilihan waktu template tidak valid.'
    if (tpl.customVariables !== undefined) {
      if (!tpl.customVariables || typeof tpl.customVariables !== 'object' || Array.isArray(tpl.customVariables) || Object.keys(tpl.customVariables).length > 10) return 'Maksimal 10 variabel khusus per template.'
      if (!Object.entries(tpl.customVariables).every(([name, text]) => /^[a-z][a-z0-9_]{1,39}$/.test(name) && typeof text === 'string' && text.length <= 1000)) return 'Variabel khusus: nama 2–40 huruf/angka/garis bawah, nilai maksimal 1.000 karakter.'
    }
  }
  if (new TextEncoder().encode(JSON.stringify(value)).length > MAX_LIBRARY_BYTES) return 'Total isi semua template terlalu besar. Ringkas teks template sebelum menyimpan.'
  return ''
}
