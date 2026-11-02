const SAPA_URLS = ['https://timsapa.vercel.app/*', 'http://localhost:5173/*', 'http://localhost:4173/*', 'http://127.0.0.1:5173/*', 'http://127.0.0.1:4173/*']

async function hasBridge(chromeApi, tabId) {
  try {
    const reply = await chromeApi.tabs.sendMessage(tabId, { type: 'SAPA_WA_HEALTH' })
    return reply?.source === 'sapa-wa-extension' && reply.ok === true
  } catch { return false }
}

export async function checkConnection(chromeApi, { repair = true } = {}) {
  const [waTabs, sapaTabs] = await Promise.all([
    chromeApi.tabs.query({ url: 'https://web.whatsapp.com/*' }),
    chromeApi.tabs.query({ url: SAPA_URLS }),
  ])
  let sapaCount = 0
  let repaired = 0
  let repairFailed = 0
  for (const tab of sapaTabs.filter(tab => Number.isInteger(tab.id))) {
    if (await hasBridge(chromeApi, tab.id)) { sapaCount++; continue }
    if (!repair) continue
    try {
      await chromeApi.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      if (await hasBridge(chromeApi, tab.id)) { sapaCount++; repaired++ }
      else repairFailed++
    } catch { repairFailed++ }
  }
  return { sapaCount, sapaTabCount: sapaTabs.length, waCount: waTabs.length, ready: sapaCount > 0 && waTabs.length > 0, repaired, repairFailed }
}
