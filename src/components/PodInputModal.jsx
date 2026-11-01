import React, { useState } from 'react'
import {
  X,
  ClipboardPaste,
  Sparkles,
  FileCheck2,
  AlertCircle,
  Package,
  Layers
} from 'lucide-react'
import { parsePodText, SAMPLE_POD_TSV } from '../utils/podManager'

export function PodInputModal({ isOpen, onClose, onImportData, showToast }) {
  const [rawText, setRawText] = useState('')
  const [parsedPreview, setParsedPreview] = useState([])

  const handleTextChange = (text) => {
    setRawText(text)
    if (!text.trim()) {
      setParsedPreview([])
      return
    }
    const parsed = parsePodText(text)
    setParsedPreview(parsed)
  }

  const handleLoadSample = () => {
    setRawText(SAMPLE_POD_TSV)
    const parsed = parsePodText(SAMPLE_POD_TSV)
    setParsedPreview(parsed)
    showToast?.('Berhasil memuat 34 data AC contoh sesuai gambar!', 'success')
  }

  const handleConfirmImport = () => {
    if (parsedPreview.length === 0) {
      showToast?.('Tidak ada data valid yang terdeteksi untuk diimpor!', 'error')
      return
    }

    onImportData(parsedPreview)
    onClose()
    showToast?.(`✅ Berhasil mengimpor ${parsedPreview.length} AC ke antrean pengingat POD!`, 'success')
  }

  if (!isOpen) return null

  const totalShipments = parsedPreview.reduce((sum, item) => sum + (item.shipmentCount || 0), 0)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#FAF8F5] dark:bg-zinc-900 rounded-3xl max-w-3xl w-full max-h-[90vh] flex flex-col shadow-2xl border border-zinc-200/80 dark:border-zinc-800 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 flex items-center justify-center font-bold">
              <Package size={20} />
            </div>
            <div>
              <h2 className="font-extrabold text-base text-zinc-900 dark:text-white">
                Input Data POD (Nama AC &amp; Shipment)
              </h2>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Copy 2 kolom langsung dari Excel / Google Sheets lalu Paste (Cmd + V) di sini
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleLoadSample}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full bg-[#FEF08A] hover:bg-[#FDE047] text-[#854D0E] transition-all cursor-pointer shadow-2xs"
            >
              <Sparkles size={13} />
              Contoh Data Gambar (34 AC)
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-4 overflow-y-auto flex-1">
          {/* Petunjuk Format */}
          <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/70 dark:border-amber-900/50 text-xs text-amber-800 dark:text-amber-300">
            <FileCheck2 size={16} className="mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <span className="font-bold">Format Sederhana 2 Kolom:</span> Salin kolom <b>Nama AC</b> dan kolom <b>Shipment</b>. Sistem secara otomatis memisahkan baris judul dan mengekstrak jumlah pesanan tiap AC.
            </div>
          </div>

          {/* Textarea Paste */}
          <div>
            <label className="block text-xs font-bold text-zinc-700 dark:text-zinc-300 mb-1.5">
              Area Paste (Cmd + V / Ctrl + V):
            </label>
            <textarea
              value={rawText}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Contoh format:&#10;ANDI SUPRIYADI    46&#10;HENDRA WADI       36&#10;TRI ARISETIAWAN   23"
              rows={8}
              className="w-full px-4 py-3 text-xs font-mono rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30 focus:border-amber-500 transition-all resize-none shadow-2xs"
            />
          </div>

          {/* Real-time Preview Table */}
          {parsedPreview.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300 flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  Pratinjau Data Terbaca ({parsedPreview.length} AC)
                </span>
                <span className="text-xs font-extrabold text-amber-700 dark:text-amber-400 bg-amber-100/70 dark:bg-amber-950/60 px-2.5 py-0.5 rounded-full border border-amber-200 dark:border-amber-800">
                  Total: {totalShipments} Pesanan POD
                </span>
              </div>

              <div className="max-h-48 overflow-y-auto rounded-2xl border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-800/60 shadow-2xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-zinc-100/80 dark:bg-zinc-800 text-zinc-500 font-bold sticky top-0 border-b border-zinc-200 dark:border-zinc-700">
                    <tr>
                      <th className="px-4 py-2 w-12 text-center">No</th>
                      <th className="px-4 py-2">Nama AC</th>
                      <th className="px-4 py-2 text-right">Jumlah Shipment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100 dark:divide-zinc-700/50">
                    {parsedPreview.map((item, idx) => (
                      <tr key={item.id} className="hover:bg-zinc-50 dark:hover:bg-zinc-700/30">
                        <td className="px-4 py-1.5 text-center text-zinc-400 font-mono">{idx + 1}</td>
                        <td className="px-4 py-1.5 font-bold text-zinc-900 dark:text-zinc-100">{item.namaAc}</td>
                        <td className="px-4 py-1.5 text-right font-extrabold text-amber-600 dark:text-amber-400">
                          {item.shipmentCount}
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
        <div className="flex items-center justify-between px-6 py-4 border-t border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900/60">
          <span className="text-xs text-zinc-500 dark:text-zinc-400">
            {parsedPreview.length > 0
              ? `${parsedPreview.length} AC siap diproses`
              : 'Paste data untuk melihat pratinjau'}
          </span>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-full text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={handleConfirmImport}
              disabled={parsedPreview.length === 0}
              className={`flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-full transition-all cursor-pointer shadow-sm ${
                parsedPreview.length > 0
                  ? 'bg-[#FEE500] hover:bg-[#FDD800] text-zinc-950'
                  : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none'
              }`}
            >
              <Package size={14} />
              <span>Impor {parsedPreview.length} Data ke Antrean</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
