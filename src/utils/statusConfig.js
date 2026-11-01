/**
 * Konfigurasi & Pengelolaan Status Pengerjaan Antrean AC / Kendala Pesanan
 * Mendukung kustomisasi penuh melalui menu Pengaturan
 */

export const AVAILABLE_STATUS_COLORS = [
  { id: 'amber', label: 'Kuning / Amber', lightBg: 'bg-amber-100 text-amber-800 border-amber-300', darkBg: 'dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800', dot: 'bg-amber-500' },
  { id: 'blue', label: 'Biru / Blue', lightBg: 'bg-blue-100 text-blue-800 border-blue-300', darkBg: 'dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800', dot: 'bg-blue-500' },
  { id: 'emerald', label: 'Hijau / Emerald', lightBg: 'bg-emerald-100 text-emerald-800 border-emerald-300', darkBg: 'dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800', dot: 'bg-emerald-500' },
  { id: 'teal', label: 'Teal / Hijau Toska', lightBg: 'bg-teal-100 text-teal-800 border-teal-300', darkBg: 'dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800', dot: 'bg-teal-500' },
  { id: 'purple', label: 'Ungu / Purple', lightBg: 'bg-purple-100 text-purple-800 border-purple-300', darkBg: 'dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800', dot: 'bg-purple-500' },
  { id: 'rose', label: 'Merah / Rose', lightBg: 'bg-rose-100 text-rose-800 border-rose-300', darkBg: 'dark:bg-rose-950/60 dark:text-rose-300 dark:border-rose-800', dot: 'bg-rose-500' },
  { id: 'indigo', label: 'Indigo / Nila', lightBg: 'bg-indigo-100 text-indigo-800 border-indigo-300', darkBg: 'dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800', dot: 'bg-indigo-500' },
  { id: 'zinc', label: 'Abu-Abu / Slate', lightBg: 'bg-zinc-100 text-zinc-800 border-zinc-300', darkBg: 'dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700', dot: 'bg-zinc-400' },
]

export const DEFAULT_STATUSES = [
  {
    id: 'belum_dikerjakan',
    label: 'Belum Dikerjakan / Belum Dihubungi',
    shortLabel: 'Belum Dikerjakan',
    color: 'amber',
    countsAsCompleted: false,
    isDefault: true,
    description: 'Antrean pesanan baru masuk dan belum dihubungi sama sekali.',
  },
  {
    id: 'sedang_menunggu',
    label: 'Sedang Menunggu Respon',
    shortLabel: 'Menunggu Respon',
    color: 'blue',
    countsAsCompleted: false,
    isDefault: false,
    description: 'Pesan sudah dikirim ke AC / Toko, sedang menunggu konfirmasi penanganan.',
  },
  {
    id: 'sudah_dihubungi',
    label: 'Sudah Dikerjakan / Dihubungi',
    shortLabel: 'Sudah Dihubungi',
    color: 'emerald',
    countsAsCompleted: true,
    isDefault: false,
    description: 'AC sudah dihubungi melalui WhatsApp dan kendala pesanan sedang ditindaklanjuti.',
  },
  {
    id: 'kendala_selesai',
    label: 'Kendala Selesai / Terkirim',
    shortLabel: 'Selesai Terkirim',
    color: 'teal',
    countsAsCompleted: true,
    isDefault: false,
    description: 'Pesanan Alfagift sudah berhasil dikirimkan atau kendala SLA terselesaikan.',
  },
  {
    id: 'tidak_merespon',
    label: 'Tidak Merespon / Butuh Follow-Up',
    shortLabel: 'Perlu Follow-Up',
    color: 'rose',
    countsAsCompleted: false,
    isDefault: false,
    description: 'AC atau personil toko belum merespon setelah dihubungi dan butuh telepon/tindak lanjut.',
  },
]

const STORAGE_KEY = 'sapa_custom_statuses_v1'

/**
 * Memuat daftar status pengerjaan dari localStorage
 * @returns {Array<Object>}
 */
export function loadCustomStatuses() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed
      }
    }
  } catch (err) {
    console.error('Failed to load custom statuses:', err)
  }
  return DEFAULT_STATUSES
}

/**
 * Menyimpan daftar status pengerjaan ke localStorage
 * @param {Array<Object>} statuses
 */
export function saveCustomStatuses(statuses) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(statuses))
  } catch (err) {
    console.error('Failed to save custom statuses:', err)
  }
}

/**
 * Mengambil detail status berdasarkan ID
 * @param {string} statusId
 * @param {Array<Object>} statuses
 * @returns {Object}
 */
export function getStatusById(statusId, statuses = DEFAULT_STATUSES) {
  // Kompatibilitas dengan status lama 'sent' & 'pending'
  let targetId = statusId
  if (statusId === 'sent') targetId = 'sudah_dihubungi'
  if (statusId === 'pending') targetId = 'belum_dikerjakan'

  const found = statuses.find((s) => s.id === targetId)
  if (found) return found

  // Fallback ke default status pertama
  return statuses.find((s) => s.isDefault) || statuses[0] || DEFAULT_STATUSES[0]
}

/**
 * Mengambil style Tailwind badge untuk status tertentu
 * @param {string} statusId
 * @param {Array<Object>} statuses
 * @returns {Object}
 */
export function getStatusBadgeStyles(statusId, statuses = DEFAULT_STATUSES) {
  const status = getStatusById(statusId, statuses)
  const colorDef = AVAILABLE_STATUS_COLORS.find((c) => c.id === status.color) || AVAILABLE_STATUS_COLORS[0]

  return {
    className: `border px-2.5 py-0.5 rounded-full text-xs font-bold inline-flex items-center gap-1.5 shadow-2xs ${colorDef.lightBg} ${colorDef.darkBg}`,
    dotClass: colorDef.dot,
    label: status.label,
    shortLabel: status.shortLabel || status.label,
    countsAsCompleted: Boolean(status.countsAsCompleted),
  }
}
