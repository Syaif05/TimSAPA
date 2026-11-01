import React, { useState } from 'react'
import {
  X,
  ClipboardPaste,
  UploadCloud,
  FileSpreadsheet,
  Sparkles,
  Check,
  AlertTriangle,
  ArrowRight,
  Database,
  Trash2,
  RefreshCw
} from 'lucide-react'
import { parseContactsRawText, parseContactsExcel } from '../utils/contactParser'
import { formatPhoneDisplay } from '../utils/phoneUtils'

const SAMPLE_CONTACTS_TSV = `NO CUG TOKO\tNO CUG AC\tStore\tStore Name\tCug Toko\tAC name\tCUG AC\tCabang\tRegional\tAM Name
CugToko W177\tCugAC W177\tW177\tULAKMA SINAGA\t81294671853\tABDIKUSUMA WARDANA ARITONANG\t81294671491\tDC MEDAN\tReg.5 HSS\tTRI UTOYO
CugToko W183\tCugAC W183\tW183\tAHMAD YANI\t81294671865\tABDIKUSUMA WARDANA ARITONANG\t81294671491\tDC MEDAN\tReg.5 HSS\tTRI UTOYO
CugToko W189\tCugAC W189\tW189\tPATUAN ANGGI\t81294671875\tABDIKUSUMA WARDANA ARITONANG\t81294671491\tDC MEDAN\tReg.5 HSS\tTRI UTOYO
CugToko W222\tCugAC W222\tW222\tAKASIA RAYA\t81294671915\tABDIKUSUMA WARDANA ARITONANG\t81294671491\tDC MEDAN\tReg.5 HSS\tTRI UTOYO
CugToko C568\tCugAC C568\tC568\tSUPRAPTO SETU 2\t82175893216\tABDUL LATIF\t81294673136\tDC CILEUNGSI_2\tReg.1 YSI\tJAENAL MUTAKIN
CugToko C676\tCugAC C676\tC676\tMT. HARYONO BKS\t81294660493\tABDUL LATIF\t81294673136\tDC CILEUNGSI_2\tReg.1 YSI\tJAENAL MUTAKIN
CugToko 1S52\tCugAC 1S52\t1S52\tRAYA UNTER IWES\t81380761047\tABDUL MANAP\t81219219604\tDC LOMBOK\tReg.3 MAO\tNOVIS DWI NUGROHO
CugToko 1P8A\tCugAC 1P8A\t1P8A\tSIMPANG DEDAI\t8115701440\tADE KOSWARA\t82111202602\tDC PONTIANAK\tReg.4 IPA\tRUSMANTO
CugToko 1V36\tCugAC 1V36\t1V36\tAIR PAOH\t81294679001\tABDUL RAHMAN\t81294665237\tDC LAMPUNG\tReg 5 HSS\tFAISAL
CugToko W486\tCugAC W486\tW486\tTANAH JAWA\t81294679002\tAL DHONI AKBAR\t82274454242\tDC MEDAN\tReg 5 HSS\tTRI UTOYO
CugToko L015\tCugAC L015\tL015\tHASANUDIN - LPG\t81294679003\tANDI SUPRIYADI\t81294668140\tDC LAMPUNG\tReg 5 HSS\tFAISAL`

export function PasteContactsModal({ isOpen, onClose, onImportContacts, showToast }) {
  const [inputText, setInputText] = useState('')
  const [parsedPreview, setParsedPreview] = useState([])
  const [isProcessing, setIsProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('paste') // 'paste' | 'file'
  const [importMode, setImportMode] = useState('replace') // 'replace' | 'append'

  if (!isOpen) return null

  // Handler paste text
  const handleTextChange = (text) => {
    setInputText(text)
    if (!text.trim()) {
      setParsedPreview([])
      return
    }

    try {
      const rows = parseContactsRawText(text)
      setParsedPreview(rows)
    } catch (err) {
      console.error(err)
    }
  }

  // Load sample demo data
  const handleLoadSample = () => {
    setInputText(SAMPLE_CONTACTS_TSV)
    const rows = parseContactsRawText(SAMPLE_CONTACTS_TSV)
    setParsedPreview(rows)
    showToast?.('Data sampel kontak (Gambar 1 & 2) berhasil dimuat!', 'success')
  }

  // Handle File Upload (.xlsx / .csv)
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsProcessing(true)
    const reader = new FileReader()

    reader.onload = (evt) => {
      try {
        const buffer = evt.target.result
        const rows = parseContactsExcel(buffer)
        setParsedPreview(rows)
        if (rows.length > 0) {
          showToast?.(`File "${file.name}" berhasil diproses: ${rows.length} kontak terdeteksi!`, 'success')
        } else {
          showToast?.('File tidak memiliki data kontak yang valid!', 'error')
        }
      } catch (err) {
        console.error(err)
        showToast?.('Gagal membaca file: ' + err.message, 'error')
      } finally {
        setIsProcessing(false)
      }
    }

    reader.readAsArrayBuffer(file)
  }

  // Submit Import
  const handleImport = async () => {
    if (parsedPreview.length === 0) {
      showToast?.('Tidak ada data kontak valid untuk disimpan!', 'error')
      return
    }

    setIsProcessing(true)
    try {
      await onImportContacts(parsedPreview, importMode)
      showToast?.(`Berhasil menyimpan ${parsedPreview.length} data kontak master!`, 'success')
      onClose()
      setInputText('')
      setParsedPreview([])
    } catch (err) {
      console.error(err)
      showToast?.('Gagal menyimpan kontak: ' + err.message, 'error')
    } finally {
      setIsProcessing(false)
    }
  }

  const validPhoneCount = parsedPreview.filter((r) => r.cugAc).length

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#FAF8F5] dark:bg-[#18191D] rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header Modal */}
        <div className="p-6 border-b border-zinc-200/80 dark:border-zinc-800 flex items-center justify-between bg-white dark:bg-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-violet-500 text-white flex items-center justify-center shadow-xs">
              <Database size={20} />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Input / Paste Database Kontak Master Pegawai Alfa
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Copy sel langsung dari spreadsheet (KONTAK TOKO BARU) lalu Paste di sini (Cmd + V)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-zinc-900 transition-all cursor-pointer shadow-2xs"
              title="Muat contoh format spreadsheet Gambar 1 & 2"
            >
              <Sparkles size={13} className="text-amber-700" />
              <span>Contoh Format</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Switcher: Paste vs File */}
        <div className="flex border-b border-zinc-200/80 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/50 px-6 gap-2">
          <button
            onClick={() => setActiveTab('paste')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'paste'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <ClipboardPaste size={15} />
            <span>Paste dari Google Sheets / Excel (Cmd + V)</span>
          </button>
          <button
            onClick={() => setActiveTab('file')}
            className={`py-3 px-4 font-bold text-xs flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
              activeTab === 'file'
                ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'
            }`}
          >
            <UploadCloud size={15} />
            <span>Unggah File Excel / CSV (.xlsx, .csv)</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5">
          {activeTab === 'paste' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-zinc-800 dark:text-zinc-200">
                  Area Paste Clipboard (Tekan Cmd + V di sini):
                </span>
                <span className="text-[11px] text-zinc-500">
                  Mendukung copy dengan atau tanpa baris judul
                </span>
              </div>

              <textarea
                rows={6}
                value={inputText}
                onChange={(e) => handleTextChange(e.target.value)}
                placeholder="Klik di sini lalu tekan Cmd + V (Paste). Kolom otomatis dikenali: NO CUG TOKO, NO CUG AC, Store, Store Name, Cug Toko, AC name, CUG AC, Cabang, Regional, AM Name..."
                className="w-full text-xs font-mono p-4 rounded-2xl border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500 shadow-2xs"
                autoFocus
              />
            </div>
          ) : (
            <div className="space-y-3">
              <div className="border-2 border-dashed border-zinc-300 dark:border-zinc-700 rounded-3xl p-8 text-center bg-white dark:bg-zinc-900/50 hover:border-purple-500 transition-colors">
                <FileSpreadsheet size={36} className="mx-auto text-purple-500 mb-2 opacity-80" />
                <p className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  Pilih file Excel (.xlsx, .xls) atau CSV Master Kontak
                </p>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1">
                  Sheet 'KONTAK TOKO BARU' atau 'KONTAK PEGAWAI ALFA' akan otomatis dibaca secara akurat.
                </p>
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileUpload}
                  className="mt-4 block mx-auto text-xs text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-[#FDE047] file:text-zinc-900 hover:file:bg-[#FACC15] cursor-pointer"
                />
              </div>
            </div>
          )}

          {/* Mode Import: Timpa vs Tambahkan */}
          {parsedPreview.length > 0 && (
            <div className="p-4 rounded-2xl bg-zinc-100/70 dark:bg-zinc-800/40 border border-zinc-200/80 dark:border-zinc-700/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <span className="font-bold text-zinc-800 dark:text-zinc-200">
                Pilihan Cara Penyimpanan ke Database:
              </span>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="replace"
                    checked={importMode === 'replace'}
                    onChange={() => setImportMode('replace')}
                    className="text-purple-600"
                  />
                  <span className="font-semibold text-zinc-900 dark:text-white">
                    Timpa Bersih (Replace) - Direkomendasikan
                  </span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="radio"
                    name="importMode"
                    value="append"
                    checked={importMode === 'append'}
                    onChange={() => setImportMode('append')}
                    className="text-purple-600"
                  />
                  <span className="text-zinc-600 dark:text-zinc-400">
                    Gabungkan (Append)
                  </span>
                </label>
              </div>
            </div>
          )}

          {/* Live Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-zinc-800 dark:text-zinc-200">
                    Hasil Deteksi Kolom ({parsedPreview.length} Kontak Terdeteksi):
                  </span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#DCFCE7] text-[#15803D]">
                    {validPhoneCount} Ada Nomor WA
                  </span>
                </div>
                <span className="text-[11px] text-zinc-500">
                  Pratinjau 5 baris pertama
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xs">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 text-[11px] border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="p-2.5">Store</th>
                      <th className="p-2.5">Store Name</th>
                      <th className="p-2.5">CUG Toko</th>
                      <th className="p-2.5">Nama AC</th>
                      <th className="p-2.5">CUG AC (WhatsApp)</th>
                      <th className="p-2.5">Cabang</th>
                      <th className="p-2.5">Regional</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800 font-mono text-[11px]">
                    {parsedPreview.slice(0, 5).map((r, idx) => (
                      <tr key={idx} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                        <td className="p-2.5 font-bold text-purple-600 dark:text-purple-400">
                          {r.store || '-'}
                        </td>
                        <td className="p-2.5 font-sans font-medium text-zinc-800 dark:text-zinc-200">
                          {r.storeName || '-'}
                        </td>
                        <td className="p-2.5 text-zinc-500">
                          {formatPhoneDisplay(r.cugToko)}
                        </td>
                        <td className="p-2.5 font-sans font-bold text-zinc-900 dark:text-white">
                          {r.acName || '-'}
                        </td>
                        <td className="p-2.5 font-bold text-emerald-600 dark:text-emerald-400">
                          {r.cugAc ? formatPhoneDisplay(r.cugAc) : <span className="text-zinc-400 font-normal italic">Kosong</span>}
                        </td>
                        <td className="p-2.5 font-sans text-zinc-600 dark:text-zinc-400">
                          {r.cabang || '-'}
                        </td>
                        <td className="p-2.5 font-sans text-zinc-500">
                          {r.regional || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-5 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center justify-between">
          <div className="text-xs text-zinc-500 dark:text-zinc-400">
            {parsedPreview.length > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                <Check size={14} />
                Siap disimpan ({parsedPreview.length} kontak)
              </span>
            ) : (
              <span>Silakan paste data dari Google Sheets atau upload file Excel.</span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleImport}
              disabled={parsedPreview.length === 0 || isProcessing}
              className="flex items-center gap-2 px-6 py-2 text-xs font-bold rounded-full bg-[#FDE047] hover:bg-[#FACC15] text-zinc-900 shadow-xs active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer"
            >
              <span>{isProcessing ? 'Menyimpan...' : `Simpan ${parsedPreview.length} Kontak ke Database`}</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
