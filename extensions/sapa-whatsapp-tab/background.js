const allowedSender = (raw) => {
  try {
    const url = new URL(raw)
    return url.origin === 'https://timsapa.vercel.app' || (url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname) && ['5173', '4173'].includes(url.port))
  } catch { return false }
}

// Serialize requests so two quick clicks cannot race to select different tabs.
let pending = Promise.resolve()
chrome.runtime.onMessage.addListener((message, sender, reply) => {
  if (!allowedSender(sender.url) || sender.frameId !== 0) return false
  if (message?.type === 'SAPA_WA_PING') {
    reply({ ok: true })
    return false
  }
  if (message?.type !== 'SAPA_WA_OPEN') return false
  pending = pending.catch(() => {}).then(async () => {
    try {
      const url = new URL(message.url)
      if (url.origin !== 'https://web.whatsapp.com' || !['/', '/send'].includes(url.pathname)) throw new Error('Alamat WhatsApp tidak valid.')
      if (url.pathname === '/send' && !/^628\d{8,12}$/.test(url.searchParams.get('phone') || '')) throw new Error('Nomor WhatsApp tidak valid.')
      const tabs = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
      tabs.sort((a, b) => Number(b.windowId === sender.tab?.windowId) - Number(a.windowId === sender.tab?.windowId) || Number(b.active) - Number(a.active) || (b.lastAccessed || 0) - (a.lastAccessed || 0))
      const target = tabs[0]
      if (!target) throw new Error('Buka dan login WhatsApp Web terlebih dahulu di browser serta profil yang sama, lalu coba lagi.')
      await chrome.tabs.update(target.id, { ...(url.pathname === '/send' ? { url: url.href } : {}), active: true })
      await chrome.windows.update(target.windowId, { focused: true })
      reply({ ok: true })
    } catch (error) {
      reply({ ok: false, error: error.message })
    }
  })
  return true
})
