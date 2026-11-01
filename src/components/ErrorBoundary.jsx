import React from 'react'

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isCopied: false,
    }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo })
    console.error('Unhandled React Error caught by ErrorBoundary:', error, errorInfo)
  }

  handleReload = () => {
    window.location.reload()
  }

  handleResetStorage = () => {
    if (window.confirm('Reset data sesi sementara di browser dan muat ulang aplikasi? Pengaturan bersama dan draf setiap PIC tetap disimpan.')) {
      try {
        // Hapus session key yang mungkin corrupt tanpa menghapus seluruh DB
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && !key.startsWith('sapa_pic:') && (key.startsWith('sapa_') || key.startsWith('dexie_'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k))
      } catch (e) {
        console.error(e)
      }
      window.location.reload()
    }
  }

  handleCopyError = () => {
    const errorDetails = `Error: ${this.state.error?.message || 'Unknown Error'}\n\nStack:\n${this.state.error?.stack || ''}\n\nComponent Stack:\n${this.state.errorInfo?.componentStack || ''}`
    navigator.clipboard.writeText(errorDetails).then(() => {
      this.setState({ isCopied: true })
      setTimeout(() => this.setState({ isCopied: false }), 2000)
    })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#FAF8F5] text-zinc-900 flex items-center justify-center p-6 font-sans">
          <div className="max-w-xl w-full bg-white rounded-3xl p-8 border border-zinc-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.06)] space-y-6">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xl border border-rose-100 shrink-0">
                ⚠️
              </div>
              <div>
                <h1 className="text-lg font-extrabold text-zinc-900">
                  Aplikasi Mengalami Kendala
                </h1>
                <p className="text-xs text-zinc-500">
                  Terjadi kendala saat merender komponen antarmuka. Silakan coba langkah pemulihan di bawah.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-rose-50/70 border border-rose-100 text-xs font-mono text-rose-800 break-words leading-relaxed">
              <strong>Pesan Error:</strong> {this.state.error?.message || 'Unknown error occurred'}
            </div>

            {this.state.errorInfo?.componentStack && (
              <details className="text-xs text-zinc-500 bg-zinc-50 rounded-2xl p-3 border border-zinc-200">
                <summary className="font-semibold text-zinc-700 cursor-pointer select-none">
                  Lihat Detail Stack Trace Teknis
                </summary>
                <pre className="mt-2 text-[10px] overflow-auto max-h-40 font-mono text-zinc-600 whitespace-pre-wrap">
                  {this.state.error?.stack}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={this.handleReload}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-900 hover:bg-zinc-800 text-white shadow-sm active:scale-95 transition-all cursor-pointer"
              >
                🔄 Muat Ulang Halaman
              </button>

              <button
                onClick={this.handleResetStorage}
                className="px-5 py-2.5 rounded-full text-xs font-bold bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border border-zinc-200 transition-all cursor-pointer"
              >
                🧹 Bersihkan Cache Sesi &amp; Muat Ulang
              </button>

              <button
                onClick={this.handleCopyError}
                className="px-4 py-2.5 rounded-full text-xs font-semibold text-zinc-600 hover:text-zinc-900 transition-all cursor-pointer ml-auto"
              >
                {this.state.isCopied ? '✓ Tersalin ke Clipboard' : '📋 Salin Info Error'}
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
