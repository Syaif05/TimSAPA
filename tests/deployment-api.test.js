import test from 'node:test'
import assert from 'node:assert/strict'
import { gunzipSync } from 'node:zlib'
import { nodeApiHandler } from '../server/applicationApi.js'
test('large contact response uses gzip and preserves JSON for browsers within Vercel body limit', async () => {
  const data = { contacts: Array.from({ length: 22000 }, (_, index) => ({ store: `TEST${index}`, storeName: 'TOKO CONTOH '.repeat(10), acName: 'AC CONTOH', cugAc: '', region: 'REGION CONTOH '.repeat(5) })) }
  const handler = nodeApiHandler(async () => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } }))
  const headers = {}
  const res = { setHeader: (k,v) => { headers[k] = v }, end: value => { res.body = value } }
  await handler({ url: '/api/contacts', method: 'GET', headers: { 'accept-encoding': 'gzip, deflate, br' } }, res)
  assert.equal(res.statusCode, 200)
  assert.equal(headers['Content-Encoding'], 'gzip')
  assert.ok(res.body.length < 4500000)
  assert.deepEqual(JSON.parse(gunzipSync(res.body)), data)
})
test('oversized uncompressed API response is rejected clearly before platform limit', async () => {
  const handler = nodeApiHandler(async () => new Response('x'.repeat(4600000)))
  const res = { setHeader: () => {}, end: value => { res.body = value } }
  await handler({ url: '/api/contacts', method: 'GET', headers: {} }, res)
  assert.equal(res.statusCode, 413)
  assert.match(JSON.parse(res.body).error, /gzip/)
})
