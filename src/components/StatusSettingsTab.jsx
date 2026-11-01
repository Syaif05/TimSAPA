import { usePicEditing } from '../profiles/ProfileContext'
import React, { useState } from 'react'
import {
  CheckCircle2,
  Clock,
  Plus,
  Trash2,
  Edit2,
  RotateCcw,
  Save,
  Tag,
  AlertCircle,
  HelpCircle,
  ShieldCheck,
  Check
} from 'lucide-react'
import {
  DEFAULT_STATUSES,
  AVAILABLE_STATUS_COLORS,
  getStatusBadgeStyles
} from '../utils/statusConfig'

export function StatusSettingsTab({ statuses, onUpdateStatuses, showToast }) {
  const [statusList, setStatusList] = useState(statuses)
  const [editingId, setEditingId] = useState(null)
  const [isAddingNew, setIsAddingNew] = useState(false)
  usePicEditing(Boolean(editingId || isAddingNew))

  // Form State
  const [formData, setFormData] = useState({
    id: '',
    label: '',
    shortLabel: '',
    color: 'emerald',
    countsAsCompleted: false,
    description: '',
  })

  // Start Edit
  const handleStartEdit = (status) => {
    setEditingId(status.id)
    setIsAddingNew(false)
    setFormData({
      id: status.id,
      label: status.label,
      shortLabel: status.shortLabel || status.label,
      color: status.color || 'emerald',
      countsAsCompleted: Boolean(status.countsAsCompleted),
      description: status.description || '',
    })
  }

  // Start Add
  const handleStartAdd = () => {
    setIsAddingNew(true)
    setEditingId(null)
    setFormData({
      id: `custom_${Date.now()}`,
      label: '',
      shortLabel: '',
      color: 'purple',
      countsAsCompleted: false,
      description: '',
    })
  }

  // Save Form
  const handleSaveForm = async (e) => {
    e.preventDefault()
    if (!formData.label.trim()) {
      showToast?.('Nama label status wajib diisi!', 'error')
      return
    }

    let updatedList
    if (isAddingNew) {
      const newStatus = {
        ...formData,
        id: formData.id || `custom_${Date.now()}`,
        shortLabel: formData.shortLabel.trim() || formData.label.trim(),
      }
      updatedList = [...statusList, newStatus]
    } else {
      updatedList = statusList.map((s) => {
        if (s.id === editingId) {
          return {
            ...s,
            label: formData.label.trim(),
            shortLabel: formData.shortLabel.trim() || formData.label.trim(),
            color: formData.color,
            countsAsCompleted: formData.countsAsCompleted,
            description: formData.description.trim(),
          }
        }
        return s
      })
    }

    setStatusList(updatedList)
    try { await onUpdateStatuses(updatedList) } catch (error) { showToast?.(error.message, 'error'); return }
    setEditingId(null)
    setIsAddingNew(false)
    showToast?.('Status pengerjaan berhasil disimpan!', 'success')
  }

  // Delete Status
  const handleDeleteStatus = async (id, label) => {
    if (statusList.length <= 1) {
      showToast?.('Minimal harus ada 1 status aktif!', 'error')
      return
    }
    if (window.confirm(`Hapus status "${label}"?`)) {
      const updatedList = statusList.filter((s) => s.id !== id)
      setStatusList(updatedList)
        try { await onUpdateStatuses(updatedList) } catch (error) { showToast?.(error.message, 'error'); return }
      showToast?.(`Status "${label}" berhasil dihapus!`, 'info')
    }
  }

  // Reset to Default
  const handleResetToDefault = async () => {
    if (window.confirm('Kembalikan semua status ke konfigurasi default bawaan sistem?')) {
      setStatusList(DEFAULT_STATUSES)
        try { await onUpdateStatuses(DEFAULT_STATUSES) } catch (error) { showToast?.(error.message, 'error'); return }
      setEditingId(null)
      setIsAddingNew(false)
      showToast?.('Daftar status berhasil direset ke default!', 'info')
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Penjelasan */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-8 h-8 rounded-xl bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 flex items-center justify-center font-bold">
              <Tag size={16} />
            </span>
            <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
              Pengaturan Status Pengerjaan Antrean AC
            </h3>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Atur status pengerjaan yang tersedia di Workspace Monitoring (misal: Sudah Dikerjakan, Sedang Menunggu Respon, Belum Dikerjakan, Kendala Selesai). Anda dapat menambah status baru, mengganti warna badge, atau menentukan status mana yang dihitung sebagai selesai.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-all"
            title="Kembalikan ke status default"
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>
          <button
            onClick={handleStartAdd}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full bg-zinc-900 hover:bg-zinc-800 text-white dark:bg-zinc-100 dark:hover:bg-white dark:text-zinc-900 text-xs font-bold cursor-pointer transition-all shadow-xs"
          >
            <Plus size={15} />
            <span>+ Tambah Status Baru</span>
          </button>
        </div>
      </div>

      {/* Form Tambah / Edit Status Modal Inline */}
      {(isAddingNew || editingId) && (
        <form
          onSubmit={handleSaveForm}
          className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border-2 border-purple-500/40 dark:border-purple-500/30 shadow-md space-y-4 animate-in fade-in duration-200"
        >
          <div className="flex items-center justify-between pb-3 border-b border-zinc-100 dark:border-zinc-800">
            <h4 className="font-bold text-sm text-zinc-900 dark:text-white flex items-center gap-2">
              <Tag size={15} className="text-purple-600" />
              {isAddingNew ? 'Tambah Status Pengerjaan Baru' : 'Edit Status Pengerjaan'}
            </h4>
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false)
                setEditingId(null)
              }}
              className="text-xs text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            >
              Batal
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Nama Lengkap Status *
              </label>
              <input
                type="text"
                required
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="Contoh: Sudah Dihubungi &amp; Menunggu Toko"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
                Label Singkat Badge (Tampil di Kartu AC)
              </label>
              <input
                type="text"
                value={formData.shortLabel}
                onChange={(e) => setFormData({ ...formData, shortLabel: e.target.value })}
                placeholder="Contoh: Sudah Dihubungi"
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          </div>

          {/* Pemilih Warna Badge */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-2">
              Pilihan Warna Badge:
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_STATUS_COLORS.map((col) => {
                const isSelected = formData.color === col.id
                return (
                  <button
                    key={col.id}
                    type="button"
                    onClick={() => setFormData({ ...formData, color: col.id })}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all cursor-pointer ${
                      col.lightBg
                    } ${col.darkBg} ${
                      isSelected ? 'ring-2 ring-purple-500 ring-offset-2 dark:ring-offset-zinc-900 font-bold scale-105' : 'opacity-70 hover:opacity-100'
                    }`}
                  >
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <span>{col.label}</span>
                    {isSelected && <Check size={12} className="ml-1" />}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Opsi Dihitung Sebagai Selesai */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="countsAsCompleted"
              checked={formData.countsAsCompleted}
              onChange={(e) => setFormData({ ...formData, countsAsCompleted: e.target.checked })}
              className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 border-zinc-300 cursor-pointer"
            />
            <label htmlFor="countsAsCompleted" className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 cursor-pointer">
              Hitung status ini sebagai <b>"Selesai / Terkirim"</b> pada bilah progress bar pengerjaan
            </label>
          </div>

          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1">
              Keterangan Tambahan (Opsional)
            </label>
            <input
              type="text"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Keterangan singkat alur kerja saat status ini dipilih"
              className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setIsAddingNew(false)
                setEditingId(null)
              }}
              className="px-4 py-2 text-xs font-semibold text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white"
            >
              Batal
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 px-5 py-2 rounded-full bg-purple-600 hover:bg-purple-700 text-white text-xs font-bold shadow-xs cursor-pointer transition-all"
            >
              <Save size={14} />
              <span>Simpan Status</span>
            </button>
          </div>
        </form>
      )}

      {/* Tabel Daftar Status yang Ada */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] dark:bg-zinc-800/80 border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500 text-[11px] font-bold">
                <th className="py-3 px-5">Tampilan Badge Status</th>
                <th className="py-3 px-5">Label Lengkap</th>
                <th className="py-3 px-5">Keterangan</th>
                <th className="py-3 px-5 text-center">Tipe Progress</th>
                <th className="py-3 px-5 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {statusList.map((status) => {
                const styles = getStatusBadgeStyles(status.id, statusList)
                return (
                  <tr key={status.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors">
                    {/* Badge Preview */}
                    <td className="py-3.5 px-5 whitespace-nowrap">
                      <span className={styles.className}>
                        <span className={`w-2 h-2 rounded-full ${styles.dotClass}`} />
                        <span>{status.shortLabel || status.label}</span>
                      </span>
                    </td>

                    {/* Label Lengkap */}
                    <td className="py-3.5 px-5 font-bold text-zinc-900 dark:text-white">
                      {status.label}
                    </td>

                    {/* Description */}
                    <td className="py-3.5 px-5 text-zinc-500 dark:text-zinc-400 text-[11px]">
                      {status.description || '-'}
                    </td>

                    {/* Progress Type */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      {status.countsAsCompleted ? (
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/60 px-2.5 py-1 rounded-full border border-emerald-200 dark:border-emerald-800/60 inline-flex items-center gap-1">
                          <CheckCircle2 size={12} /> Selesai / Terkirim
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-zinc-500 bg-zinc-100 dark:bg-zinc-800 px-2.5 py-1 rounded-full inline-flex items-center gap-1">
                          <Clock size={12} /> Dalam Antrean
                        </span>
                      )}
                    </td>

                    {/* Action Buttons */}
                    <td className="py-3.5 px-5 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleStartEdit(status)}
                          className="p-1.5 text-zinc-400 hover:text-purple-600 dark:hover:text-purple-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Edit Status"
                        >
                          <Edit2 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteStatus(status.id, status.label)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                          title="Hapus Status"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
