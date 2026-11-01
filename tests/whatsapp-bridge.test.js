import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requestWhatsAppTab } from '../src/utils/whatsappBridge.js'

test('bridge correlates replies, rejects foreign responses, cleans listeners and never opens a tab', async () => {
  const listeners = new Set()
  let request
  globalThis.location = { origin: 'http://localhost:5173' }
  globalThis.window = {
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    postMessage: (data) => { request = data },
    open: () => assert.fail('must never open a tab'),
  }
  const resultPromise = requestWhatsAppTab('SAPA_WA_OPEN', 'https://web.whatsapp.com/')
  const receive = [...listeners][0]
  const data = { source: 'sapa-wa-extension', id: request.id, ok: true }
  receive({ source: {}, origin: location.origin, data })
  receive({ source: window, origin: 'https://example.com', data })
  receive({ source: window, origin: location.origin, data: { ...data, id: 'other-request' } })
  assert.equal(listeners.size, 1)
  receive({ source: window, origin: location.origin, data })
  assert.equal((await resultPromise).ok, true)
  assert.equal(listeners.size, 0)
})

test('missing extension times out without opening another tab', async () => {
  const listeners = new Set()
  globalThis.location = { origin: 'http://localhost:5173' }
  globalThis.window = {
    addEventListener: (_, fn) => listeners.add(fn),
    removeEventListener: (_, fn) => listeners.delete(fn),
    postMessage: () => {},
    open: () => assert.fail('must never open a tab'),
  }
  const result = await requestWhatsAppTab('SAPA_WA_PING', undefined, 5)
  assert.equal(result.ok, false)
  assert.match(result.error, /belum terhubung/)
  assert.equal(listeners.size, 0)
})
