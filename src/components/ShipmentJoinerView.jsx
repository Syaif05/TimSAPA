import { InfoButton } from './InfoButton'
import React, { useState, useMemo } from 'react'
import {
  Combine,
  Copy,
  Check,
  Trash2,
  Download,
  ClipboardPaste,
  FileSpreadsheet,
  X,
  Search,
  Hash,
} from 'lucide-react'
import {
  extractShipments,
  formatJoinedShipments,
  SAMPLE_GLUED_SHIPMENTS,
  SAMPLE_SHEET_COLUMN_SHIPMENTS
} from '../utils/shipmentUtils'

export function ShipmentJoinerView({ showToast }) {
  // Input text
  const [inputText, setInputText] = useState(SAMPLE_GLUED_SHIPMENTS)

  // Separator option
  // 'comma_no_space' | 'comma_space' | 'sql_single_quotes' | 'sql_single_quotes_space' | 'double_quotes' | 'newline' | 'semicolon' | 'custom'
  const [separatorType, setSeparatorType] = useState('comma_no_space')
  const [customSeparator, setCustomSeparator] = useState(',')

  // Parser options
  const [autoUngluing, setAutoUngluing] = useState(true)
  const [removeDuplicates, setRemoveDuplicates] = useState(true)
  const [filterAlfagiftOnly, setFilterAlfagiftOnly] = useState(true)
  const [toUpperCase, setToUpperCase] = useState(true)

  // Manual exclusions (item yang dihapus user dari chip list)
  const [excludedItems, setExcludedItems] = useState(new Set())

  // Search filter dalam chip preview
  const [chipSearch, setChipSearch] = useState('')

  // Copy feedback state
  const [isCopied, setIsCopied] = useState(false)

  // 1. Ekstrak shipment dari inputText
  const extractionResult = useMemo(() => {
    return extractShipments(inputText, {
      autoUngluing,
      filterAlfagiftOnly,
      removeDuplicates,
      toUpperCase,
    })
  }, [inputText, autoUngluing, filterAlfagiftOnly, removeDuplicates, toUpperCase])

  // 2. Filter item yang tidak di-exclude secara manual
  const activeItems = useMemo(() => {
    return extractionResult.items.filter((item) => !excludedItems.has(item))
  }, [extractionResult.items, excludedItems])

  // 3. Format hasil string gabungan
  const joinedResult = useMemo(() => {
    return formatJoinedShipments(activeItems, separatorType, customSeparator)
  }, [activeItems, separatorType, customSeparator])

  // 4. Chip list yang difilter oleh input search kecil
  const filteredChips = useMemo(() => {
    if (!chipSearch.trim()) return activeItems
    const q = chipSearch.trim().toUpperCase()
    return activeItems.filter((item) => item.toUpperCase().includes(q))
  }, [activeItems, chipSearch])

  // Handler: Salin Hasil
  const handleCopyResult = async () => {
    if (!joinedResult) {
      showToast?.('Tidak ada data shipment untuk disalin!', 'error')
      return
    }

    try {
      await navigator.clipboard.writeText(joinedResult)
      setIsCopied(true)
      showToast?.(`Berhasil menyalin ${activeItems.length} nomor shipment ke clipboard!`, 'success')
      setTimeout(() => setIsCopied(false), 2000)
    } catch (err) {
      // Fallback
      showToast?.('Gagal menyalin secara otomatis, silakan pilih teks dan tekan Cmd+C', 'error')
    }
  }

  // Handler: Tempel dari Clipboard
  const handlePasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText()
      if (text) {
        setInputText(text)
        setExcludedItems(new Set())
        showToast?.('Teks dari clipboard berhasil ditempel!', 'success')
      } else {
        showToast?.('Clipboard kosong atau browser tidak mengizinkan akses!', 'error')
      }
    } catch (err) {
      showToast?.('Izin akses clipboard ditolak browser. Silakan tekan Cmd+V di kolom input.', 'error')
    }
  }

  // Handler: Unduh file .txt
  const handleDownloadTxt = () => {
    if (!joinedResult) return
    const blob = new Blob([joinedResult], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Shipments_Joined_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
    showToast?.('File .txt berhasil diunduh!', 'success')
  }

  // Handler: Unduh file .csv
  const handleDownloadCsv = () => {
    if (activeItems.length === 0) return
    const csvContent = 'No,Shipment\n' + activeItems.map((s, idx) => `${idx + 1},"${s}"`).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `Shipments_List_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast?.('File .csv berhasil diunduh!', 'success')
  }

  // Hapus item individual dari chip
  const handleRemoveItem = (item) => {
    setExcludedItems((prev) => {
      const next = new Set(prev)
      next.add(item)
      return next
    })
  }

  // Reset exclusion
  const handleResetExclusions = () => {
    setExcludedItems(new Set())
  }

  return (
    <div className="secondary-page space-y-6">
      {/* Header Panel */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-purple-50 dark:bg-purple-950/50 text-zinc-600 dark:text-purple-400 flex items-center justify-center font-bold text-xl border border-purple-100 dark:border-purple-800/60 shadow-2xs shrink-0">
            <Combine size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Gabung shipment
              </h1>
              
            </div>
            <InfoButton title="Informasi halaman">
              Pisahkan nomor shipment yang menempel otomatis dan gabungkan dengan tanda koma untuk filter OMS, query portal, atau pencarian massal.
            </InfoButton>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="px-3.5 py-2 rounded-2xl bg-[#FCFBF9] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 font-medium">Terdeteksi:</span>
            <span className="text-xs font-extrabold text-zinc-900 dark:text-white">
              {activeItems.length}
            </span>
          </div>

          {extractionResult.duplicatesRemoved > 0 && (
            <div className="px-3.5 py-2 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-center gap-2">
              <span className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">Duplikat Terfilter:</span>
              <span className="text-xs font-extrabold text-amber-700 dark:text-amber-300">
                {extractionResult.duplicatesRemoved}
              </span>
            </div>
          )}

          <div className="px-3.5 py-2 rounded-2xl bg-zinc-100 dark:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-700 flex items-center gap-2">
            <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-medium">Karakter:</span>
            <span className="text-xs font-mono font-bold text-zinc-800 dark:text-zinc-200">
              {joinedResult.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main 2-Column Work Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* Kolom Kiri: Input Data */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <FileSpreadsheet size={15} className="text-zinc-600" />
              <span>Input Data Mentah (Tempel Teks / Kolom Spreadsheet):</span>
            </label>

            {/* Tombol-tombol helper input */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={handlePasteFromClipboard}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-[11px] font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-all cursor-pointer"
                title="Tempel isi clipboard Anda langsung ke sini"
              >
                <ClipboardPaste size={12} />
                <span>Tempel Clipboard</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText(SAMPLE_GLUED_SHIPMENTS)
                  setExcludedItems(new Set())
                  showToast?.('Contoh data menempel berhasil dimuat', 'info')
                }}
                className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-zinc-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/40 transition-all cursor-pointer"
                title="Muat contoh data yang saling menempel (seperti di pesan Anda)"
              >
                Contoh Menempel
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText(SAMPLE_SHEET_COLUMN_SHIPMENTS)
                  setExcludedItems(new Set())
                  showToast?.('Contoh kolom Sheets (11 shipment) berhasil dimuat', 'info')
                }}
                className="px-2.5 py-1.5 rounded-full text-[11px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 transition-all cursor-pointer"
                title="Muat contoh 11 shipment dari tangkapan layar Kolom C"
              >
                Contoh Kolom Sheets
              </button>

              <button
                type="button"
                onClick={() => {
                  setInputText('')
                  setExcludedItems(new Set())
                }}
                className="p-1.5 rounded-full text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-all cursor-pointer"
                title="Bersihkan area teks"
              >
                <Trash2 size={13} />
              </button>
            </div>
          </div>

          {/* Textarea Input */}
          <textarea
            rows={10}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value)
              setExcludedItems(new Set())
            }}
            placeholder={`Tempelkan daftar nomor shipment di sini...\n\nBisa berupa:\n1. Teks yang menempel: S-261027-AGJGFQNS-261027-AGVZNKF\n2. Satu kolom penuh dari Google Sheets / Excel\n3. Teks campuran baris tabel monitoring`}
            className="w-full text-xs font-mono leading-relaxed p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#FCFBF9] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 shadow-2xs resize-y"
          />

          {/* Opsi Pengaturan Parser (Checkboxes) */}
          <div className="pt-2 border-t border-zinc-100 dark:border-zinc-800/80 space-y-2.5">
            <span className="text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider block">
              Pengaturan Pemrosesan Otomatis:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={autoUngluing}
                  onChange={(e) => setAutoUngluing(e.target.checked)}
                  className="rounded text-zinc-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  ⚡ Pisahkan Shipment Menempel
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={removeDuplicates}
                  onChange={(e) => setRemoveDuplicates(e.target.checked)}
                  className="rounded text-zinc-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  ✨ Hapus Duplikat (Unique Only)
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={filterAlfagiftOnly}
                  onChange={(e) => setFilterAlfagiftOnly(e.target.checked)}
                  className="rounded text-zinc-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  🎯 Hanya Pola S-xxxxxx-xxxx
                </span>
              </label>

              <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={toUpperCase}
                  onChange={(e) => setToUpperCase(e.target.checked)}
                  className="rounded text-zinc-600 focus:ring-purple-500 w-4 h-4 cursor-pointer"
                />
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  🔠 Format Huruf Kapital (UPPERCASE)
                </span>
              </label>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Hasil Gabungan & Pengaturan Separator */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
              <Combine size={15} className="text-emerald-600" />
              <span>Format &amp; Tanda Pemisah (Separator):</span>
            </label>

            <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2.5 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
              Siap Disalin ({activeItems.length} Shipment)
            </span>
          </div>

          {/* Tombol Pilihan Format Separator */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSeparatorType('comma_no_space')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'comma_no_space'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Pisahkan dengan tanda koma tanpa spasi: S-1,S-2,S-3 (Sesuai Permintaan Anda)"
            >
              Koma Rapat: S-1,S-2,S-3
            </button>

            <button
              type="button"
              onClick={() => setSeparatorType('comma_space')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'comma_space'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Pisahkan dengan tanda koma + spasi: S-1, S-2, S-3"
            >
              Koma Spasi: S-1, S-2
            </button>

            <button
              type="button"
              onClick={() => setSeparatorType('sql_single_quotes')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'sql_single_quotes'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Format petik tunggal untuk SQL IN: 'S-1','S-2'"
            >
              Petik SQL: &apos;S-1&apos;,&apos;S-2&apos;
            </button>

            <button
              type="button"
              onClick={() => setSeparatorType('newline')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'newline'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Satu nomor shipment per baris baru"
            >
              Baris Baru (Enter)
            </button>

            <button
              type="button"
              onClick={() => setSeparatorType('semicolon')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'semicolon'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Pisahkan dengan titik koma: S-1;S-2"
            >
              Titik Koma (;)
            </button>

            <button
              type="button"
              onClick={() => setSeparatorType('custom')}
              className={`px-3 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                separatorType === 'custom'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200'
              }`}
              title="Tentukan tanda pemisah Anda sendiri"
            >
              Kustom...
            </button>
          </div>

          {/* Input Kustom Separator jika dipilih */}
          {separatorType === 'custom' && (
            <div className="flex items-center gap-2 p-2.5 rounded-2xl bg-[#FCFBF9] dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800">
              <span className="text-xs font-semibold text-zinc-600 dark:text-zinc-400">
                Ketik Tanda Pemisah:
              </span>
              <input
                type="text"
                value={customSeparator}
                onChange={(e) => setCustomSeparator(e.target.value)}
                placeholder="Contoh: | atau  OR "
                className="flex-1 px-3 py-1 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-purple-500"
              />
            </div>
          )}

          {/* Area Tampilan Hasil Teks Gabungan */}
          <div className="relative">
            <textarea
              rows={9}
              readOnly
              value={joinedResult}
              onClick={(e) => e.target.select()}
              placeholder="Hasil gabungan akan muncul di sini secara otomatis..."
              className="w-full text-xs font-mono leading-relaxed p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#FAF8F5] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 shadow-inner select-all resize-y"
            />

            {/* Floating Copy Button di pojok kanan atas textarea */}
            {joinedResult && (
              <button
                type="button"
                onClick={handleCopyResult}
                className={`absolute top-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer ${
                  isCopied
                    ? 'bg-emerald-600 text-white'
                    : 'bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50'
                }`}
              >
                {isCopied ? <Check size={13} /> : <Copy size={13} />}
                <span>{isCopied ? 'Tersalin!' : 'Salin'}</span>
              </button>
            )}
          </div>

          {/* Tombol Aksi Utama (Besar) */}
          <div className="pt-2 flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={handleCopyResult}
              disabled={!joinedResult}
              className={`flex-1 w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-full text-xs font-extrabold shadow-sm active:scale-95 transition-all cursor-pointer ${
                joinedResult
                  ? isCopied
                    ? 'bg-emerald-700 text-white'
                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/20'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              }`}
            >
              {isCopied ? <Check size={16} /> : <Copy size={16} />}
              <span>{isCopied ? '✓ BERHASIL DISALIN KE CLIPBOARD!' : '📋 SALIN HASIL GABUNGAN KE CLIPBOARD'}</span>
            </button>

            {/* Download Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={handleDownloadTxt}
                disabled={!joinedResult}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Unduh sebagai file teks .txt"
              >
                <Download size={14} />
                <span>Unduh .TXT</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadCsv}
                disabled={activeItems.length === 0}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 rounded-full text-xs font-bold bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 shadow-2xs transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                title="Unduh sebagai file spreadsheet .csv"
              >
                <Download size={14} />
                <span>Unduh .CSV</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bagian Bawah: Interactive Preview Chip List */}
      {activeItems.length > 0 && (
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-6 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <h3 className="text-xs font-extrabold text-zinc-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Hash size={14} className="text-zinc-600" />
                <span>Rincian Daftar Item Shipment ({activeItems.length})</span>
              </h3>
              <span className="text-[11px] text-zinc-500">
                (Klik tombol &apos;x&apos; untuk mengecualikan shipment tertentu)
              </span>
            </div>

            <div className="flex items-center gap-2">
              {/* Filter search kecil dalam chip list */}
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
                <input
                  type="text"
                  value={chipSearch}
                  onChange={(e) => setChipSearch(e.target.value)}
                  placeholder="Cari shipment di daftar..."
                  className="pl-8 pr-3 py-1.5 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-[#FCFBF9] dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-1 focus:ring-purple-500 w-44 sm:w-56"
                />
              </div>

              {excludedItems.size > 0 && (
                <button
                  type="button"
                  onClick={handleResetExclusions}
                  className="text-xs font-bold text-zinc-600 hover:underline cursor-pointer"
                >
                  Pulihkan ({excludedItems.size})
                </button>
              )}
            </div>
          </div>

          {/* Chip Badges Container */}
          <div className="flex flex-wrap gap-2 max-h-60 overflow-y-auto p-1">
            {filteredChips.map((shipment, idx) => (
              <span
                key={shipment}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold bg-[#F5F3FF] dark:bg-purple-950/40 text-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-800/60 shadow-2xs group hover:border-purple-400 transition-colors"
              >
                <span className="text-[10px] text-purple-400 font-sans">#{idx + 1}</span>
                <span>{shipment}</span>
                <button
                  type="button"
                  onClick={() => handleRemoveItem(shipment)}
                  title="Hapus shipment ini dari gabungan"
                  className="opacity-40 group-hover:opacity-100 hover:text-rose-600 p-0.5 rounded-full transition-opacity cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}

            {filteredChips.length === 0 && (
              <span className="text-xs text-zinc-400 italic">
                Tidak ada shipment yang sesuai dengan pencarian &quot;{chipSearch}&quot;
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
