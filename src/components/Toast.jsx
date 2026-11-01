import React from 'react'
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react'

export function Toast({ toast, onClose }) {
  if (!toast) return null

  const icons = {
    success: <CheckCircle2 size={18} className="text-emerald-500" />,
    error: <AlertCircle size={18} className="text-rose-500" />,
    info: <Info size={18} className="text-blue-500" />,
  }

  const borderColors = {
    success: 'border-emerald-300 dark:border-emerald-800 bg-white dark:bg-slate-900',
    error: 'border-rose-300 dark:border-rose-800 bg-white dark:bg-slate-900',
    info: 'border-blue-300 dark:border-blue-800 bg-white dark:bg-slate-900',
  }

  return (
    <div className="fixed bottom-4 left-4 right-4 sm:left-auto sm:bottom-6 sm:right-6 z-50 animate-in slide-in-from-bottom-5 duration-200">
      <div
        role={toast.type === 'error' ? 'alert' : 'status'}
        aria-live={toast.type === 'error' ? 'assertive' : 'polite'}
        className={`flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border ${
          borderColors[toast.type] || borderColors.info
        } max-w-md`}
      >
        {icons[toast.type] || icons.info}
        <span className="text-xs font-semibold text-slate-800 dark:text-slate-100 flex-1">
          {toast.message}
        </span>
        <button
          onClick={onClose}
          aria-label="Tutup pemberitahuan"
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1 rounded-lg"
        >
          <X size={14} />
        </button>
      </div>
    </div>
  )
}
