import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import vm from 'node:vm'
import { checkConnection } from '../extensions/sapa-whatsapp-tab/popupStatus.js'

test('popup reports ready only when a SAPA bridge and an existing WA tab are found', async () => {
  const calls = []
  const chrome = { tabs: {
    query: async options => { calls.push(options); return typeof options.url === 'string' ? [{ id: 9 }] : [{ id: 2 }] },
    sendMessage: async id => { if (id === 2) return { source: 'sapa-wa-extension', ok: true }; throw new Error('No content script') },
    create: () => assert.fail('status must never create a tab'),
  } }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 1, sapaTabCount: 1, waCount: 1, ready: true, repaired: 0, repairFailed: 0 })
  assert.equal(calls[0].url, 'https://web.whatsapp.com/*')
})

test('popup reports disconnected when SAPA or WA is missing', async () => {
  const chrome = { tabs: {
    query: async options => typeof options.url === 'string' ? [] : [{ id: 1 }],
    sendMessage: async () => ({ source: 'sapa-wa-extension', ok: true }),
  } }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 1, sapaTabCount: 1, waCount: 0, ready: false, repaired: 0, repairFailed: 0 })
  chrome.tabs.sendMessage = async () => { throw new Error('No receiver') }
  chrome.scripting = { executeScript: async () => {} }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 0, sapaTabCount: 1, waCount: 0, ready: false, repaired: 0, repairFailed: 1 })
})

test('popup reconnects a SAPA tab opened before extension installation', async () => {
  let connected = false
  const chrome = {
    tabs: {
      query: async options => typeof options.url === 'string' ? [{ id: 8 }] : [{ id: 3 }],
      sendMessage: async () => { if (!connected) throw new Error('No receiver'); return { source: 'sapa-wa-extension', ok: true } },
    },
    scripting: { executeScript: async ({ target, files }) => { assert.equal(target.tabId, 3); assert.deepEqual(files, ['content.js']); connected = true } },
  }
  assert.deepEqual(await checkConnection(chrome), { sapaCount: 1, sapaTabCount: 1, waCount: 1, ready: true, repaired: 1, repairFailed: 0 })
})

test('SAPA content script answers popup health checks on the authorized top frame', async () => {
  const source = await readFile(new URL('../extensions/sapa-whatsapp-tab/content.js', import.meta.url), 'utf8')
  let health
  let listeners = 0
  const window = { top: null, addEventListener: () => { listeners++ } }
  window.top = window
  const chrome = { runtime: { onMessage: { addListener: listener => { health = listener } } } }
  const location = { protocol: 'https:', hostname: 'timsapa.vercel.app', port: '', origin: 'https://timsapa.vercel.app' }
  const context = vm.createContext({ window, chrome, location })
  vm.runInContext(source, context)
  vm.runInContext(source, context)
  let response
  assert.equal(health({ type: 'SAPA_WA_HEALTH' }, {}, value => { response = value }), false)
  assert.deepEqual(JSON.parse(JSON.stringify(response)), { source: 'sapa-wa-extension', ok: true })
  assert.equal(listeners, 1)
})
