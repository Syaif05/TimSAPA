import { test } from 'node:test'
import assert from 'node:assert/strict'
import vm from 'node:vm'
import { readFile } from 'node:fs/promises'
import { createWhatsAppWebUrl, isValidIndonesianPhone } from '../src/utils/phoneUtils.js'
const source = await readFile(new URL('../extensions/sapa-whatsapp-tab/background.js', import.meta.url), 'utf8')
function setup(tabs = [], fail = false) {
  let listener
  const calls = []
  const chrome = {
    runtime: { onMessage: { addListener: (fn) => { listener = fn } }, onInstalled: { addListener: () => {} }, onStartup: { addListener: () => {} } },
    tabs: {
      query: async () => tabs,
      update: async (id, options) => { if (fail) throw new Error('Tab sudah ditutup'); calls.push({ id, ...options }) },
    },
    windows: { update: async (id, options) => calls.push({ windowId: id, ...options }) },
  }
  vm.runInNewContext(source, { chrome, URL, Promise })
  const sender = { url: 'http://localhost:5173/', frameId: 0, tab: { windowId: 1 } }
  return { calls, sender, listener, open: (url) => new Promise((resolve) => listener({ type: 'SAPA_WA_OPEN', url }, sender, resolve)) }
}
const url = createWhatsAppWebUrl('081234567890', 'Halo & selamat siang\n🙏')
test('normalizes phone and preserves multiline text and emoji', () => {
  const parsed = new URL(url)
  assert.equal(parsed.searchParams.get('phone'), '6281234567890')
  assert.equal(parsed.searchParams.get('text'), 'Halo & selamat siang\n🙏')
  assert.equal(isValidIndonesianPhone('1234567890'), false)
})
test('reuses existing tab from the same window, never creates a tab', async () => {
  const s = setup([{ id: 10, windowId: 2, active: true }, { id: 20, windowId: 1, active: false }])
  assert.equal((await s.open(url)).ok, true)
  assert.equal(s.calls[0].id, 20)
  assert.equal(s.calls[0].url, url)
  assert.equal(s.calls[1].windowId, 1)
})
test('uses the most recently accessed tab in another window', async () => {
  const s = setup([{ id: 10, windowId: 2, lastAccessed: 1 }, { id: 20, windowId: 3, lastAccessed: 2 }])
  await s.open(url)
  assert.equal(s.calls[0].id, 20)
})
test('missing tab returns actionable error without mutations', async () => {
  const s = setup()
  const result = await s.open(url)
  assert.equal(result.ok, false)
  assert.match(result.error, /login WhatsApp/)
  assert.equal(s.calls.length, 0)
})
test('header focuses WA without navigating away from a chat', async () => {
  const s = setup([{ id: 10, windowId: 1 }])
  await s.open('https://web.whatsapp.com/')
  assert.equal(s.calls[0].url, undefined)
  assert.equal(s.calls[0].active, true)
})
test('rejects other destinations and invalid phones', async () => {
  const s = setup([{ id: 10, windowId: 1 }])
  for (const bad of ['https://example.com/', 'https://web.whatsapp.com/settings', 'https://web.whatsapp.com/send?phone=123']) assert.equal((await s.open(bad)).ok, false)
  assert.equal(s.calls.length, 0)
})
test('rejects other origins, ports, and frames', () => {
  const s = setup()
  for (const sender of [{ ...s.sender, url: 'https://example.com/' }, { ...s.sender, url: 'http://localhost:9999/' }, { ...s.sender, frameId: 1 }]) {
    assert.equal(s.listener({ type: 'SAPA_WA_OPEN', url }, sender, () => assert.fail('must not reply')), false)
  }
})
test('reports closed-tab failure without reporting success', async () => {
  const s = setup([{ id: 10, windowId: 1 }], true)
  assert.equal((await s.open(url)).ok, false)
  assert.equal(s.calls.length, 0)
})
test('sequential requests reuse the same tab', async () => {
  const s = setup([{ id: 10, windowId: 1 }])
  await Promise.all([s.open(url), s.open(url)])
  assert.equal(s.calls.filter((call) => call.id === 10).length, 2)
})
test('production site reuses WA while lookalike domains are rejected', async () => {
  const s = setup([{ id: 10, windowId: 1 }])
  s.sender.url = 'https://timsapa.vercel.app/'
  assert.equal((await s.open(url)).ok, true)
  for (const origin of ['https://timsapa.vercel.app.evil.example/', 'https://evil.timsapa.vercel.app/', 'http://timsapa.vercel.app/']) assert.equal(s.listener({ type: 'SAPA_WA_OPEN', url }, { ...s.sender, url: origin }, () => assert.fail('must not reply')), false)
})
