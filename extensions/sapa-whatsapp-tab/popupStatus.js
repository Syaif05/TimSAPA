export async function checkConnection(chromeApi) {
  const [waTabs, tabs] = await Promise.all([
    chromeApi.tabs.query({ url: 'https://web.whatsapp.com/*' }),
    chromeApi.tabs.query({}),
  ])
  const replies = await Promise.allSettled(tabs.filter(tab => Number.isInteger(tab.id)).map(tab =>
    chromeApi.tabs.sendMessage(tab.id, { type: 'SAPA_WA_HEALTH' })))
  const sapaCount = replies.filter(reply => reply.status === 'fulfilled' && reply.value?.source === 'sapa-wa-extension' && reply.value?.ok === true).length
  return { sapaCount, waCount: waTabs.length, ready: sapaCount > 0 && waTabs.length > 0 }
}
