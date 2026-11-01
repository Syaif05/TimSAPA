import { InfoButton } from './InfoButton'
import React, { useState, useMemo } from 'react'
import {
  X,
  ClipboardPaste,
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  Check,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  RotateCcw,
  Layers,
  CopyCheck
} from 'lucide-react'
import { parseSapaRawText, parseSapaExcel } from '../utils/sapaParser'
import { SAMPLE_SAPA_TSV } from '../utils/sampleSapaData'
import { mergeSapaRowsWithDeduplication, getOrderUniqueKey } from '../utils/sessionManager'

export function PasteInputModal({ isOpen, onClose, onImportData, existingRows = [], showToast }) {
  const [inputText, setInputText] = useState('')
  const [parsedPreview, setParsedPreview] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('paste') // 'paste' | 'file'
  const [importMode, setImportMode] = useState('merge_skip_duplicates') // 'merge_skip_duplicates' | 'replace' | 'append_all'




  // Handler paste text
  const handleTextChange = (text) => {
    setInputText(text)
    if (!text.trim()) {
      setParsedPreview([])
      return
    }

    try {
      const rows = parseSapaRawText(text)
      setParsedPreview(rows)
    } catch (err) {
      console.error(err)
    }
  }

  // Load sample demo data
  const handleLoadSample = () => {
    setInputText(SAMPLE_SAPA_TSV)
    const rows = parseSapaRawText(SAMPLE_SAPA_TSV)
    setParsedPreview(rows)
    showToast?.('Data sampel Gambar 1 berhasil dimuat!', 'success')
  }

  // Handle File Upload (.xlsx / .csv)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    const reader = new FileReader()

    if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
      reader.onload = async (evt) => {
        try {
          const buffer = evt.target.result
          const rows = await parseSapaExcel(buffer)
          setParsedPreview(rows)
          showToast?.(`Berhasil membaca ${rows.length} baris dari ${file.name}`, 'success')
        } catch (err) {
          showToast?.('Gagal memproses file Excel: ' + err.message, 'error')
        } finally {
          setIsProcessing(false)
        }
      }
      reader.readAsArrayBuffer(file)
    } else {
      reader.onload = (evt) => {
        try {
          const content = evt.target.result
          setInputText(content)
          const rows = parseSapaRawText(content)
          setParsedPreview(rows)
          showToast?.(`Berhasil membaca ${rows.length} baris dari ${file.name}`, 'success')
        } catch (err) {
          showToast?.('Gagal memproses file CSV: ' + err.message, 'error')
        } finally {
          setIsProcessing(false)
        }
      }
      reader.readAsText(file)
    }
  }

  // Analisis Duplikasi Real-Time terhadap Data yang Sedang Berjalan
  const duplicateStats = useMemo(() => {
    if (!parsedPreview || parsedPreview.length === 0 || !existingRows || existingRows.length === 0) {
      return { newCount: parsedPreview.length, duplicateCount: 0, updatedCount: 0 }
    }

    const existingKeys = new Set(existingRows.map(getOrderUniqueKey).filter(Boolean))
    let dups = 0
    let news = 0

    parsedPreview.forEach((r) => {
      const k = getOrderUniqueKey(r)
      if (k && existingKeys.has(k)) {
        dups++
      } else {
        news++
      }
    })

    return {
      newCount: news,
      duplicateCount: dups,
    }
  }, [parsedPreview, existingRows])

  // Submit Import
  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) {
      showToast?.('Tidak ada data yang valid untuk diimpor!', 'error')
      return
    }

    const { mergedRows, newCount, duplicateCount, updatedCount } = mergeSapaRowsWithDeduplication(
      existingRows,
      parsedPreview,
      importMode
    )

    onImportData(mergedRows, {
      newCount,
      duplicateCount,
      updatedCount,
      mode: importMode,
    })

    onClose()

    if (importMode === 'merge_skip_duplicates') {
      if (duplicateCount > 0) {
        showToast?.(
          `✅ Berhasil update! ${newCount} pesanan baru ditambahkan, ${duplicateCount} pesanan lama dilewati (anti-duplikat). Status AC tetap aman!`,
          'success'
        )
      } else {
        showToast?.(`✅ Berhasil mengimpor ${newCount} pesanan baru ke antrean!`, 'success')
      }
    } else if (importMode === 'replace') {
      showToast?.(`🔄 Data monitoring berhasil ditimpa bersih (${mergedRows.length} pesanan).`, 'info')
    } else {
      showToast?.(`✅ Berhasil menambahkan ${parsedPreview.length} pesanan ke antrean!`, 'success')
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-zinc-50 dark:bg-zinc-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 flex items-center justify-center font-bold">
              <ClipboardPaste size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-zinc-900 dark:text-white">
                Input data
              </h2>
              <InfoButton title="Cara input data"><p>Salin tabel dari spreadsheet, lalu tempel dengan Cmd/Ctrl + V. Header kolom akan dikenali otomatis. Anda juga dapat mengunggah file Excel atau CSV.</p></InfoButton>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] transition-all cursor-pointer shadow-2xs"
            >
              <Sparkles size={13} />
              Contoh
            </button>
            <button
              onClick={onClose}
              aria-label="Tutup input data"
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Paste vs Upload File */}
        <div className="flex border-b border-zinc-200/80 dark:border-zinc-800 px-6 bg-zinc-100/60 dark:bg-zinc-900/40 text-xs font-bold">
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'paste'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-zinc-50 dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <ClipboardPaste size={15} />
            Tempel tabel
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 transition-colors cursor-pointer ${
              activeTab === 'file'
                ? 'border-purple-600 text-purple-700 dark:text-purple-400 bg-zinc-50 dark:bg-zinc-900'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
          >
            <UploadCloud size={15} />
            Unggah file
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-4 flex-1">
          {activeTab === 'paste' ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Data SAPA
                </label>
                
              </div>
              <textarea
                rows={7}
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Tempel tabel SAPA di sini…"
                className="w-full text-xs font-mono p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 leading-relaxed shadow-2xs"
              />
            </div>
          ) : (
            <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-8 text-center bg-white dark:bg-zinc-950/40 hover:bg-zinc-50 transition-colors">
              <UploadCloud size={40} className="mx-auto text-purple-500 mb-2" />
              <p className="text-sm font-extrabold text-zinc-800 dark:text-zinc-200 mb-1">
                Pilih atau seret file MONITORING SAPA 3 ke sini
              </p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-4">
                Mendukung spreadsheet Excel (.xlsx, .xls) atau Comma/Tab Separated (.csv, .tsv)
              </p>
              <label className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-full bg-zinc-900 hover:bg-zinc-800 text-white cursor-pointer shadow-sm transition-all">
                <FileSpreadsheet size={15} />
                <span>Pilih File Spreadsheet</span>
                <input
                  type="file"
                  accept=".xlsx,.xls,.csv,.tsv,.txt"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>
          )}

          {/* Opsi Anti-Duplikat & Mode Penggabungan Data */}
          <div className="p-4 rounded-2xl bg-white dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <ShieldCheck size={15} className="text-emerald-600" />
                <span>Duplikasi</span>
              </span>
              {existingRows.length > 0 && (
                <span className="text-[11px] font-semibold text-zinc-500">
                  Saat ini: <b className="text-zinc-800 dark:text-zinc-200">{existingRows.length} pesanan</b>
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
              {/* Option 1: Anti-Duplicate Merge (Default) */}
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  importMode === 'merge_skip_duplicates'
                    ? 'border-emerald-500 bg-emerald-50/60 dark:bg-emerald-950/20 text-emerald-900 dark:text-emerald-200 font-semibold ring-1 ring-emerald-500/30'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    value="merge_skip_duplicates"
                    checked={importMode === 'merge_skip_duplicates'}
                    onChange={() => setImportMode('merge_skip_duplicates')}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <div className="font-bold text-xs flex items-center gap-1">
                      <span>Lewati duplikat</span>
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-200 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300 rounded font-black">
                        Rekomendasi
                      </span>
                    </div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-normal leading-snug">
                      Tambah pesanan baru; lewati duplikat.
                    </div>
                  </div>
                </div>
              </label>

              {/* Option 2: Clean Replace */}
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  importMode === 'replace'
                    ? 'border-blue-500 bg-blue-50/60 dark:bg-blue-950/20 text-blue-900 dark:text-blue-200 font-semibold ring-1 ring-blue-500/30'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500"
                  />
                  <div>
                    <div className="font-bold text-xs">Ganti data</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-normal leading-snug">
                      Ganti seluruh data hari ini.
                    </div>
                  </div>
                </div>
              </label>

              {/* Option 3: Append All */}
              <label
                className={`p-3 rounded-xl border text-xs cursor-pointer transition-all flex flex-col justify-between ${
                  importMode === 'append_all'
                    ? 'border-purple-500 bg-purple-50/60 dark:bg-purple-950/20 text-purple-900 dark:text-purple-200 font-semibold ring-1 ring-purple-500/30'
                    : 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                }`}
              >
                <div className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="importMode"
                    value="append_all"
                    checked={importMode === 'append_all'}
                    onChange={() => setImportMode('append_all')}
                    className="mt-0.5 text-purple-600 focus:ring-purple-500"
                  />
                  <div>
                    <div className="font-bold text-xs">Tambah semua</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 font-normal leading-snug">
                      Tambah semua, termasuk duplikat.
                    </div>
                  </div>
                </div>
              </label>
            </div>
          </div>

          {/* Pratinjau Deteksi Kolom & Baris */}
          {parsedPreview.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 space-y-3 shadow-2xs">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xs font-bold">
                    <Check size={12} />
                  </span>
                  <span className="text-xs font-extrabold text-zinc-800 dark:text-zinc-200">
                    Terdeteksi {parsedPreview.length} Baris Data Kendala
                  </span>
                </div>

                {/* Badge Analisis Duplikasi */}
                {existingRows.length > 0 && (
                  <div className="flex items-center gap-2 text-xs">
                    <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 px-2.5 py-0.5 rounded-full font-bold border border-emerald-300 dark:border-emerald-800">
                      ✨ {duplicateStats.newCount} Pesanan Baru
                    </span>
                    {duplicateStats.duplicateCount > 0 && (
                      <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/70 dark:text-amber-300 px-2.5 py-0.5 rounded-full font-bold border border-amber-300 dark:border-amber-800">
                        🛡️ {duplicateStats.duplicateCount} Duplikat (Akan Dilewati)
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Mini Table Preview */}
              <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
                <table className="w-full text-[11px] text-left">
                  <thead className="bg-[#FAF9F6] dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-bold">
                    <tr>
                      <th className="p-2">Jam</th>
                      <th className="p-2">Nama AC</th>
                      <th className="p-2">Kode Toko</th>
                      <th className="p-2">Nama Toko</th>
                      <th className="p-2">Shipment</th>
                      <th className="p-2">SLA</th>
                      <th className="p-2">PIC</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                    {parsedPreview.slice(0, 3).map((r, i) => (
                      <tr key={i} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                        <td className="p-2 font-mono">{r.jam}</td>
                        <td className="p-2 font-bold">{r.namaAc || '-'}</td>
                        <td className="p-2 font-mono text-purple-600 dark:text-purple-400 font-semibold">{r.kodeToko}</td>
                        <td className="p-2">{r.namaToko}</td>
                        <td className="p-2 font-mono text-blue-600 dark:text-blue-400 font-semibold">{r.shipment}</td>
                        <td className="p-2">
                          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 text-[10px] font-bold">
                            {r.sla}
                          </span>
                        </td>
                        <td className="p-2 font-medium">{r.pic}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <div className="text-xs text-zinc-500">
            {parsedPreview.length > 0 ? (
              <span>
                {importMode === 'merge_skip_duplicates' && duplicateStats.duplicateCount > 0 ? (
                  <>
                    Menambahkan <b className="text-emerald-600">{duplicateStats.newCount} pesanan baru</b>, mengabaikan{' '}
                    <b className="text-amber-600">{duplicateStats.duplicateCount} duplikat</b>
                  </>
                ) : (
                  <>Siap memasukkan <b>{parsedPreview.length} baris</b> ke antrean</>
                )}
              </span>
            ) : (
              <span>Tempel data atau pilih file untuk melihat pratinjau</span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full text-zinc-600 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-white transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={parsedPreview.length === 0}
              className={`flex items-center gap-2 px-6 py-2.5 text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm ${
                parsedPreview.length > 0
                  ? 'bg-[#FEE500] hover:bg-[#FDD800] text-zinc-950 hover:shadow-md'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed'
              }`}
            >
              <span>Impor {parsedPreview.length > 0 ? `${parsedPreview.length} Data` : 'Sekarang'}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
