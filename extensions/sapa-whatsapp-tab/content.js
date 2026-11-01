const localSapa = location.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(location.hostname) && ['5173', '4173'].includes(location.port)
if (window.top === window && (localSapa || location.origin === 'https://timsapa.vercel.app')) {
  window.addEventListener('message', async (event) => {
    const data = event.data
    if (event.source !== window || event.origin !== location.origin || data?.source !== 'sapa-wa-page' || !['SAPA_WA_PING', 'SAPA_WA_OPEN'].includes(data.type) || typeof data.id !== 'string') return
    let result
    try {
      result = await chrome.runtime.sendMessage({ type: data.type, url: data.url })
    } catch {
      result = { ok: false, error: 'Koneksi ekstensi terputus. Muat ulang halaman SAPA.' }
    }
    window.postMessage({ source: 'sapa-wa-extension', id: data.id, ...result }, location.origin)
  })
}
