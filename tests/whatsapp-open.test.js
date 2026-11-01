import test from 'node:test'
import assert from 'node:assert/strict'
import { openChatWithImage } from '../src/utils/whatsappOpen.js'

test('opens an existing WA tab before a slow image finishes', async () => {
  const calls = []
  const result = await openChatWithImage({
    copyImage: () => { calls.push('copy-started'); return new Promise(() => {}) },
    openTab: () => { calls.push('open-requested'); return Promise.resolve({ ok: true }) },
    imageWaitMs: 5,
  })
  assert.deepEqual(calls, ['copy-started', 'open-requested'])
  assert.equal(result.result.ok, true)
  assert.equal(result.image.pending, true)
})

test('reports clipboard failure separately from successful tab reuse', async () => {
  const result = await openChatWithImage({
    copyImage: () => Promise.resolve({ success: false, error: 'Clipboard unavailable' }),
    openTab: () => Promise.resolve({ ok: true }),
  })
  assert.equal(result.result.ok, true)
  assert.equal(result.image.success, false)
})
