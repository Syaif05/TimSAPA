// No automatic window.open fallback: failed reuse must never create duplicate tabs.
export function requestWhatsAppTab(type, url, timeout = 5000) {
  return new Promise((resolve) => {
    const id = crypto.randomUUID()
    const finish = (result) => {
      clearTimeout(timer)
      window.removeEventListener('message', receive)
      resolve(result)
    }
    const receive = (event) => {
      if (event.source === window && event.origin === location.origin && event.data?.source === 'sapa-wa-extension' && event.data.id === id) finish(event.data)
    }
    const timer = setTimeout(() => finish({ ok: false, error: 'Ekstensi WA belum terhubung. Klik ikon informasi di samping status WA untuk panduan.' }), timeout)
    window.addEventListener('message', receive)
    window.postMessage({ source: 'sapa-wa-page', id, type, url }, location.origin)
  })
}
