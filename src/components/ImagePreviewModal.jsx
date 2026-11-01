import React, { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { X, Download, Copy, Check } from 'lucide-react'

export function ImagePreviewModal({ isOpen, onClose, dataUrl, acName, onCopy, isCopied }) {
  const dialog = useRef(null)
  useEffect(() => { if (isOpen && dataUrl && dialog.current && !dialog.current.open) dialog.current.showModal() }, [isOpen, dataUrl])
  if (!isOpen || !dataUrl) return null

  return createPortal(
    <dialog ref={dialog} className="image-preview-dialog" aria-label={`Pratinjau lampiran ${acName}`} onClose={onClose} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative bg-white dark:bg-slate-900 rounded-xl max-w-5xl max-h-[90vh] flex flex-col shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
        {/* Header Modal */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/60">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-900 dark:text-white">
              Preview Potongan Gambar Tabel - {acName}
            </span>
            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 font-medium">
              Siap Kirim WA
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                isCopied
                  ? 'bg-emerald-600 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100'
              }`}
            >
              {isCopied ? <Check size={14} /> : <Copy size={14} />}
              {isCopied ? 'Tersalin ke Clipboard!' : 'Salin Gambar (PNG)'}
            </button>

            <a
              href={dataUrl}
              download={`Tabel-SAPA-${acName.replace(/\s+/g, '-')}.png`}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-800 dark:text-slate-100 transition-colors"
            >
              <Download size={14} />
              Unduh
            </a>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Gambar Container */}
        <div className="p-4 overflow-auto flex items-center justify-center bg-slate-100 dark:bg-slate-950 min-h-[300px]">
          <img
            src={dataUrl}
            alt={`Tabel ${acName}`}
            className="rounded-md border border-slate-300 dark:border-slate-700 shadow-md max-w-full h-auto object-contain"
          />
        </div>

        {/* Footer info */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/40 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 flex items-center justify-between">
          <span>Tips: Anda cukup menekan tombol <b>[Buka Chat WA & Isi Pesan]</b> pada kartu antrean, gambar otomatis disalin dan Anda tinggal tekan <b>Cmd + V</b> di ruang chat WA Web.</span>
          <button
            onClick={onClose}
            className="px-3 py-1 text-xs font-medium bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 rounded text-slate-700 dark:text-slate-200"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
    </dialog>, document.body,
  )
}
