import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { checkConnection } from '../extensions/sapa-whatsapp-tab/popupStatus.js'

test('popup reports ready only when a SAPA bridge and an existing WA tab are found', async () => {
  const calls = []
  const chrome = { tabs: {
    query: async options => { calls.push(options); return options.url ? [{ id: 9 }] : [{ id: 1 }, { id: 2 }, { id: 9 }] },
    sendMessage: async id => { if (id === 2) return { source: 'sapa-wa-extension', ok: true }; throw new Error('No content script') },
    create: () => assert.fail('status must never create a tab'),
  } }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 1, waCount: 1, ready: true })
  assert.equal(calls[0].url, 'https://web.whatsapp.com/*')
})

test('popup reports disconnected when SAPA or WA is missing', async () => {
  const chrome = { tabs: {
    query: async options => options.url ? [] : [{ id: 1 }],
    sendMessage: async () => ({ source: 'sapa-wa-extension', ok: true }),
  } }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 1, waCount: 0, ready: false })
  chrome.tabs.sendMessage = async () => { throw new Error('No receiver') }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 0, waCount: 0, ready: false })
})

test('SAPA content script answers popup health checks on the authorized top frame', async () => {
  const source = await readFile(new URL('../extensions/sapa-whatsapp-tab/content.js', import.meta.url), 'utf8')
  let health
  const window = { top: null, addEventListener: () => {} }
  window.top = window
  const chrome = { runtime: { onMessage: { addListener: listener => { health = listener } } } }
  const location = { protocol: 'https:', hostname: 'timsapa.vercel.app', port: '', origin: 'https://timsapa.vercel.app' }
  vm.runInNewContext(source, { window, chrome, location })
  let response
  assert.equal(health({ type: 'SAPA_WA_HEALTH' }, {}, value => { response = value }), false)
  assert.deepEqual(JSON.parse(JSON.stringify(response)), { source: 'sapa-wa-extension', ok: true })
})
