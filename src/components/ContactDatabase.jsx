import { InfoButton } from './InfoButton'
import React, { useState, useEffect, useMemo } from 'react'
import {
  Upload,
  Search,
  Plus,
  Trash2,
  Edit2,
  Download,
  RotateCcw,
  CheckCircle2,
  Database,
  Building,
  Phone,
  UserCheck,
  AlertCircle,
  X,
  ClipboardPaste,
  ChevronLeft,
  ChevronRight,
  Filter,
  Sparkles,
  Layers
} from 'lucide-react'
import * as XLSX from 'xlsx'
import { db, searchContacts, bulkImportContacts, resetContactsToDefault } from '../db/database'
import { normalizePhone, formatPhoneDisplay } from '../utils/phoneUtils'
import { PasteContactsModal } from './PasteContactsModal'

export function ContactDatabase({ showToast, onContactsUpdated }) {
  const [allContacts, setAllContacts] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)
  const [editingContact, setEditingContact] = useState(null)

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('')
  const [filterCabang, setFilterCabang] = useState('ALL')
  const [filterPhoneStatus, setFilterPhoneStatus] = useState('ALL') // 'ALL' | 'has_phone' | 'no_phone'

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)

  // Form State untuk Tambah / Edit Manual
  const [formData, setFormData] = useState({
    store: '',
    storeName: '',
    cugToko: '',
    acName: '',
    cugAc: '',
    cabang: '',
    regional: '',
    amName: '',
    cugAm: '',
  })

  // Load Contacts dari Dexie IndexedDB
  const loadContacts = async () => {
    setIsLoading(true)
    try {
      const list = await db.contacts.toArray()
      setAllContacts(list)
    } catch (err) {
      console.error(err)
      showToast?.('Gagal memuat database kontak', 'error')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    loadContacts()
  }, [])

  // Ekstrak daftar cabang unik untuk dropdown filter
  const availableCabangs = useMemo(() => {
    const set = new Set()
    allContacts.forEach((c) => {
      if (c.cabang && c.cabang !== '-') set.add(c.cabang.toUpperCase())
    })
    return Array.from(set).sort()
  }, [allContacts])

  // Filter & Search Contacts
  const filteredContacts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()

    return allContacts.filter((c) => {
      // 1. Text Search
      if (q) {
        const matchStore = c.store && c.store.toLowerCase().includes(q)
        const matchStoreName = c.storeName && c.storeName.toLowerCase().includes(q)
        const matchAcName = c.acName && c.acName.toLowerCase().includes(q)
        const matchCugAc = c.cugAc && c.cugAc.includes(q)
        const matchCabang = c.cabang && c.cabang.toLowerCase().includes(q)
        const matchAmName = c.amName && c.amName.toLowerCase().includes(q)
        if (!matchStore && !matchStoreName && !matchAcName && !matchCugAc && !matchCabang && !matchAmName) {
          return false
        }
      }

      // 2. Filter Cabang
      if (filterCabang !== 'ALL') {
        if (!c.cabang || c.cabang.toUpperCase() !== filterCabang) {
          return false
        }
      }

      // 3. Filter Phone Status
      if (filterPhoneStatus === 'has_phone') {
        if (!c.cugAc) return false
      } else if (filterPhoneStatus === 'no_phone') {
        if (c.cugAc) return false
      }

      return true
    })
  }, [allContacts, searchQuery, filterCabang, filterPhoneStatus])

  // Reset page ke 1 saat pencarian atau filter berubah
  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, filterCabang, filterPhoneStatus, pageSize])

  // Pagination Slice
  const totalItems = filteredContacts.length
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize))
  const paginatedContacts = useMemo(() => {
    const start = (currentPage - 1) * pageSize
    return filteredContacts.slice(start, start + pageSize)
  }, [filteredContacts, currentPage, pageSize])

  // Handler Import via Paste / File Modal
  const handleImportContacts = async (contactsList, mode = 'replace') => {
    await bulkImportContacts(contactsList, mode)
    await loadContacts()
    if (onContactsUpdated) {
      await onContactsUpdated()
    }
  }

  // Export to Excel
  const handleExport = () => {
    try {
      const worksheet = XLSX.utils.json_to_sheet(allContacts)
      const workbook = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(workbook, worksheet, 'KONTAK_PEGAWAI_ALFA')
      XLSX.writeFile(workbook, `KONTAK_PEGAWAI_ALFA_${Date.now()}.xlsx`)
      showToast?.('Database berhasil diekspor ke Excel!', 'success')
    } catch (err) {
      showToast?.('Gagal mengekspor kontak: ' + err.message, 'error')
    }
  }

  // Reset Contacts
  const handleResetDefault = async () => {
    if (window.confirm('Kembalikan database kontak ke data default awal (Gambar 1 & 2)?')) {
      await resetContactsToDefault()
      await loadContacts()
      if (onContactsUpdated) await onContactsUpdated()
      showToast?.('Kontak berhasil direset ke data default awal!', 'info')
    }
  }

  // Kosongkan Database
  const handleClearAll = async () => {
    if (window.confirm('PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA data kontak master?')) {
      await db.contacts.clear()
      await loadContacts()
      if (onContactsUpdated) await onContactsUpdated()
      showToast?.('Seluruh database kontak telah dikosongkan.', 'info')
    }
  }

  // Delete Single Contact
  const handleDeleteContact = async (id, name) => {
    if (window.confirm(`Hapus kontak ${name}?`)) {
      await db.contacts.delete(id)
      await loadContacts()
      if (onContactsUpdated) await onContactsUpdated()
      showToast?.(`Kontak ${name} berhasil dihapus!`, 'info')
    }
  }

  // Open Edit Modal
  const handleEditClick = (contact) => {
    setEditingContact(contact)
    setFormData({
      store: contact.store || '',
      storeName: contact.storeName || '',
      cugToko: contact.cugToko || '',
      acName: contact.acName || '',
      cugAc: contact.cugAc || '',
      cabang: contact.cabang || '',
      regional: contact.regional || '',
      amName: contact.amName || '',
      cugAm: contact.cugAm || '',
    })
    setIsModalOpen(true)
  }

  // Save / Update Contact Modal
  const handleSaveContact = async (e) => {
    e.preventDefault()
    if (!formData.acName && !formData.store) {
      showToast?.('Nama AC atau Kode Toko wajib diisi!', 'error')
      return
    }

    try {
      const cleanData = {
        ...formData,
        store: formData.store.toUpperCase().trim(),
        storeName: formData.storeName.toUpperCase().trim(),
        acName: formData.acName.toUpperCase().trim(),
        cabang: formData.cabang.toUpperCase().trim(),
        cugAc: normalizePhone(formData.cugAc),
        cugToko: normalizePhone(formData.cugToko),
        cugAm: normalizePhone(formData.cugAm),
      }

      if (editingContact && editingContact.id) {
        await db.contacts.update(editingContact.id, cleanData)
        showToast?.(`Kontak ${cleanData.acName || cleanData.store} berhasil diperbarui!`, 'success')
      } else {
        await db.contacts.add(cleanData)
        showToast?.(`Kontak baru berhasil ditambahkan!`, 'success')
      }

      setIsModalOpen(false)
      setEditingContact(null)
      await loadContacts()
      if (onContactsUpdated) await onContactsUpdated()
    } catch (err) {
      showToast?.('Gagal menyimpan kontak: ' + err.message, 'error')
    }
  }

  // Summary Metrics
  const validAcPhoneCount = useMemo(() => {
    return allContacts.filter((c) => c.cugAc).length
  }, [allContacts])

  const uniqueAcCount = useMemo(() => {
    const s = new Set()
    allContacts.forEach((c) => {
      if (c.acName && c.acName !== '-') s.add(c.acName.toUpperCase())
    })
    return s.size
  }, [allContacts])

  return (
    <div className="secondary-page space-y-6">
      {/* Top Header Card */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-zinc-100 text-zinc-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Database size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Kontak
              </h2>
              
            </div>
            <InfoButton title="Informasi halaman">
              Penyimpanan lokal di MacBook Anda. Mendukung Copy-Paste langsung (Cmd+V) dari spreadsheet harian <b>KONTAK TOKO BARU</b> tanpa perlu repot simpan file terlebih dahulu.
            </InfoButton>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Tombol Utama: Input / Paste Kontak (MeetingAI Yellow Pill) */}
          <button
            onClick={() => setIsPasteModalOpen(true)}
            className="primary-button"
          >
            <ClipboardPaste size={15} />
            <span>Impor kontak</span>
          </button>

          {/* Tambah Kontak Manual */}
          <button
            onClick={() => {
              setEditingContact(null)
              setFormData({
                store: '',
                storeName: '',
                cugToko: '',
                acName: '',
                cugAc: '',
                cabang: '',
                regional: '',
                amName: '',
                cugAm: '',
              })
              setIsModalOpen(true)
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>Tambah kontak</span>
          </button>

          {/* Ekspor ke Excel */}
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
            title="Ekspor seluruh kontak ke file Excel"
          >
            <Download size={14} />
            <span>Ekspor</span>
          </button>

          {/* Reset ke Default */}
          <button
            onClick={handleResetDefault}
            className="p-2 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-all cursor-pointer"
            title="Reset ke kontak sampel default"
          >
            <RotateCcw size={15} />
          </button>

          {/* Kosongkan Database */}
          <button
            onClick={handleClearAll}
            className="p-2 text-rose-500 hover:text-rose-700 rounded-full hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-all cursor-pointer"
            title="Hapus semua kontak master"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Metric Stat Chips */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Total Toko Master</div>
          <div className="text-xl font-black text-zinc-900 dark:text-white mt-1">{allContacts.length.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Total Area Coordinator (AC)</div>
          <div className="text-xl font-black text-zinc-600 dark:text-purple-400 mt-1">{uniqueAcCount.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Kontak Ada No CUG AC</div>
          <div className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">{validAcPhoneCount.toLocaleString('id-ID')}</div>
        </div>

        <div className="p-4 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs">
          <div className="text-[11px] font-semibold text-zinc-500 dark:text-zinc-400">Jumlah Cabang (DC)</div>
          <div className="text-xl font-black text-blue-600 dark:text-blue-400 mt-1">{availableCabangs.length}</div>
        </div>
      </div>

      {/* Menu Pencarian & Filter Canggih (Sesuai Permintaan User) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-4 shadow-xs space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari Kode Toko, Nama Toko, Nama AC, Nomor HP WhatsApp, Cabang..."
              className="w-full pl-10 pr-9 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs text-zinc-900 dark:text-white placeholder-zinc-400 focus:outline-none focus:ring-2 focus:ring-purple-500 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Dropdown Filter Cabang */}
          <div className="flex items-center gap-2">
            <select
              value={filterCabang}
              onChange={(e) => setFilterCabang(e.target.value)}
              className="px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Cabang ({availableCabangs.length})</option>
              {availableCabangs.map((cb) => (
                <option key={cb} value={cb}>
                  {cb}
                </option>
              ))}
            </select>

            {/* Dropdown Filter Status Nomor */}
            <select
              value={filterPhoneStatus}
              onChange={(e) => setFilterPhoneStatus(e.target.value)}
              className="px-3.5 py-2 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-800 dark:text-zinc-200 focus:outline-none cursor-pointer"
            >
              <option value="ALL">Semua Nomor</option>
              <option value="has_phone">✅ Ada Nomor CUG AC</option>
              <option value="no_phone">⚠️ Nomor Kosong</option>
            </select>

            {/* Reset Filter Button */}
            {(searchQuery || filterCabang !== 'ALL' || filterPhoneStatus !== 'ALL') && (
              <button
                onClick={() => {
                  setSearchQuery('')
                  setFilterCabang('ALL')
                  setFilterPhoneStatus('ALL')
                }}
                className="px-3 py-2 text-xs font-semibold text-zinc-500 hover:text-zinc-900 dark:hover:text-white cursor-pointer"
              >
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Counter Info */}
        <div className="flex items-center justify-between text-[11px] text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800/80">
          <span>
            Ditemukan: <b className="text-zinc-800 dark:text-zinc-200">{filteredContacts.length.toLocaleString('id-ID')}</b> dari {allContacts.length.toLocaleString('id-ID')} kontak
          </span>
          <span>
            Halaman {currentPage} dari {totalPages}
          </span>
        </div>
      </div>

      {/* Tabel Kontak dengan Pagination (Super Ringan & Cepat) */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-[#FAF8F5] dark:bg-zinc-800/80 border-b border-zinc-200/80 dark:border-zinc-800 text-zinc-500 text-[11px] font-bold">
                <th className="py-3 px-4">Store</th>
                <th className="py-3 px-4">Store Name</th>
                <th className="py-3 px-4">Cug Toko</th>
                <th className="py-3 px-4">AC Name</th>
                <th className="py-3 px-4">CUG AC (WhatsApp)</th>
                <th className="py-3 px-4">Cabang</th>
                <th className="py-3 px-4">Regional</th>
                <th className="py-3 px-4">AM Name</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800/80">
              {isLoading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    Memuat data kontak master...
                  </td>
                </tr>
              ) : paginatedContacts.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    Tidak ada kontak yang cocok dengan pencarian / filter.
                  </td>
                </tr>
              ) : (
                paginatedContacts.map((c) => (
                  <tr
                    key={c.id || `${c.store}_${c.acName}`}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    {/* Store Code */}
                    <td className="py-3 px-4 font-mono font-bold text-zinc-600 dark:text-purple-400 whitespace-nowrap">
                      {c.store || '-'}
                    </td>

                    {/* Store Name */}
                    <td className="py-3 px-4 font-semibold text-zinc-900 dark:text-white">
                      {c.storeName || '-'}
                    </td>

                    {/* CUG Toko */}
                    <td className="py-3 px-4 font-mono text-zinc-500 whitespace-nowrap">
                      {formatPhoneDisplay(c.cugToko)}
                    </td>

                    {/* AC Name */}
                    <td className="py-3 px-4 font-bold text-zinc-900 dark:text-white">
                      {c.acName || '-'}
                    </td>

                    {/* CUG AC (WhatsApp) */}
                    <td className="py-3 px-4 font-mono whitespace-nowrap">
                      {c.cugAc ? (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          {formatPhoneDisplay(c.cugAc)}
                        </span>
                      ) : (
                        <span className="text-[11px] text-zinc-400 italic">
                          Belum Ada
                        </span>
                      )}
                    </td>

                    {/* Cabang */}
                    <td className="py-3 px-4 text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                      {c.cabang || '-'}
                    </td>

                    {/* Regional */}
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {c.regional || '-'}
                    </td>

                    {/* AM Name */}
                    <td className="py-3 px-4 text-zinc-500 whitespace-nowrap">
                      {c.amName || '-'}
                    </td>

                    {/* Actions */}
                    <td className="py-3 px-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          onClick={() => handleEditClick(c)}
                          className="p-1.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-purple-400 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Edit Kontak"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteContact(c.id, c.storeName || c.acName)}
                          className="p-1.5 text-zinc-400 hover:text-rose-600 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                          title="Hapus Kontak"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar (Sesuai Permintaan User: Ringan & Cepat Buka Menu) */}
        <div className="p-4 border-t border-zinc-200/80 dark:border-zinc-800 flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#FAF8F5]/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-2 text-xs text-zinc-500">
            <span>Tampilkan</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="px-2.5 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-xs font-semibold text-zinc-900 dark:text-white cursor-pointer"
            >
              <option value={25}>25 baris</option>
              <option value={50}>50 baris</option>
              <option value={100}>100 baris</option>
              <option value={200}>200 baris</option>
            </select>
            <span>
              | Menampilkan {totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1} -{' '}
              {Math.min(currentPage * pageSize, totalItems)} dari {totalItems.toLocaleString('id-ID')} kontak
            </span>
          </div>

          {/* Page Navigator */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <ChevronLeft size={14} />
              <span>Sebelumnya</span>
            </button>

            <span className="px-3 py-1.5 text-xs font-bold text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 rounded-full border border-zinc-200 dark:border-zinc-700">
              {currentPage} / {totalPages}
            </span>

            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="flex items-center gap-1 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
            >
              <span>Berikutnya</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Modal Input / Paste Master Kontak (Cmd + V) */}
      <PasteContactsModal
        isOpen={isPasteModalOpen}
        onClose={() => setIsPasteModalOpen(false)}
        onImportContacts={handleImportContacts}
        showToast={showToast}
      />

      {/* Modal Tambah / Edit Kontak Manual */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-[#FAF8F5] dark:bg-[#18191D] rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
              <h3 className="font-extrabold text-base text-zinc-900 dark:text-white">
                {editingContact ? 'Edit Kontak Master' : 'Tambah Kontak Baru'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 text-zinc-400 hover:text-zinc-600 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSaveContact} className="p-6 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Kode Toko (Store)</label>
                  <input
                    type="text"
                    required
                    value={formData.store}
                    onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                    placeholder="Contoh: 1V36"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Nama Toko</label>
                  <input
                    type="text"
                    value={formData.storeName}
                    onChange={(e) => setFormData({ ...formData, storeName: e.target.value })}
                    placeholder="Contoh: AIR PAOH"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Nama Area Coordinator (AC)</label>
                  <input
                    type="text"
                    required
                    value={formData.acName}
                    onChange={(e) => setFormData({ ...formData, acName: e.target.value })}
                    placeholder="Contoh: ABDUL RAHMAN"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-bold"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">No WhatsApp AC (CUG AC)</label>
                  <input
                    type="text"
                    value={formData.cugAc}
                    onChange={(e) => setFormData({ ...formData, cugAc: e.target.value })}
                    placeholder="Contoh: 081294665237"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Cabang (DC)</label>
                  <input
                    type="text"
                    value={formData.cabang}
                    onChange={(e) => setFormData({ ...formData, cabang: e.target.value })}
                    placeholder="Contoh: DC LAMPUNG"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Regional</label>
                  <input
                    type="text"
                    value={formData.regional}
                    onChange={(e) => setFormData({ ...formData, regional: e.target.value })}
                    placeholder="Contoh: Reg 5 HSS"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">CUG Toko</label>
                  <input
                    type="text"
                    value={formData.cugToko}
                    onChange={(e) => setFormData({ ...formData, cugToko: e.target.value })}
                    placeholder="Contoh: 081294679001"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 font-mono"
                  />
                </div>
                <div>
                  <label className="font-bold text-zinc-700 dark:text-zinc-300 block mb-1">Nama AM</label>
                  <input
                    type="text"
                    value={formData.amName}
                    onChange={(e) => setFormData({ ...formData, amName: e.target.value })}
                    placeholder="Contoh: FAISAL"
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                  />
                </div>
              </div>

              <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="primary-button"
                >
                  Simpan Kontak
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
