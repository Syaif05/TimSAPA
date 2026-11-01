import { createGoogleApplication } from './googleApplication.js'
import { createSheetsReader } from './sheetsData.js'
import { createContactsReader } from './contactsData.js'
import { gzip } from 'node:zlib'
import { promisify } from 'node:util'
const compress = promisify(gzip)

// Same handler in Vite and Vercel. Credentials are read exclusively by server code.
export function createApplicationApi({ env = process.env, cloud = createGoogleApplication({ env }), read = createSheetsReader(), readContacts = createContactsReader() } = {}) {
  return async request => {
    const response = await cloud.handle(request)
    if (response) return response
    const url = new URL(request.url)
    if (!['/api/sheets', '/api/contacts'].includes(url.pathname)) return new Response(JSON.stringify({ error: 'Endpoint tidak ditemukan.' }), { status: 404, headers: { 'Content-Type': 'application/json' } })
    const headers = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }
    if (request.method !== 'GET') return new Response(JSON.stringify({ error: 'Sumber publik hanya dapat dibaca.' }), { status: 405, headers: { ...headers, Allow: 'GET' } })
    try {
      const data = url.pathname === '/api/contacts' ? await readContacts() : await read({ mode: url.searchParams.get('mode') || 'daily', date: url.searchParams.get('date') || undefined })
      const etag = `"${data.revision}:${!!data.stale}"`
      const resultHeaders = { ...headers, ETag: etag, 'X-SAPA-Fetched-At': data.fetchedAt }
      if (!data.stale && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: resultHeaders })
      return new Response(JSON.stringify(data), { headers: resultHeaders })
    } catch (error) {
      const certificate = ['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'CERT_HAS_EXPIRED'].includes(error.cause?.code || error.code)
      return new Response(JSON.stringify({ error: certificate ? 'Sertifikat HTTPS di server tidak dapat diverifikasi. Perbaiki CA server; jangan menonaktifkan verifikasi TLS.' : error.message === 'fetch failed' ? 'Server belum dapat menjangkau Google. Periksa jaringan atau hubungkan akun pengelola.' : error.message || 'Sumber belum merespons.' }), { status: 502, headers })
    }
  }
}

export function nodeApiHandler(handler) {
  return async (req, res) => {
    try {
      const base = 'http://localhost'
      let body
      if (!['GET', 'HEAD'].includes(req.method)) {
        if (req.body !== undefined) body = typeof req.body === 'string' ? req.body : JSON.stringify(req.body)
        else {
          const chunks = []; let length = 0
          for await (const chunk of req) { length += chunk.length; if (length > 20000) { res.statusCode = 413; res.end(); return } chunks.push(chunk) }
          body = Buffer.concat(chunks)
        }
      }
      const headers = new Headers()
      for (const [key, value] of Object.entries(req.headers)) if (value !== undefined) headers.set(key, Array.isArray(value) ? value.join(', ') : value)
      const response = await handler(new Request(new URL(req.url, base), { method: req.method, headers, ...(body !== undefined ? { body } : {}) }))
      let payload = Buffer.from(await response.arrayBuffer())
      const compressed = payload.length > 512000 && /\bgzip\b/i.test(req.headers['accept-encoding'] || '')
      if (compressed) payload = await compress(payload)
      if (payload.length > 4500000) { res.statusCode = 413; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Respons data terlalu besar. Gunakan browser dengan dukungan gzip.' })); return }
      res.statusCode = response.status
      for (const [key, value] of response.headers) if (key !== 'set-cookie') res.setHeader(key, value)
      const cookieHeaders = response.headers.getSetCookie()
      if (cookieHeaders.length) res.setHeader('Set-Cookie', cookieHeaders)
      if (compressed) { res.setHeader('Content-Encoding', 'gzip'); res.setHeader('Vary', 'Accept-Encoding'); res.removeHeader?.('Content-Length') }
      res.end(payload)
    } catch { res.statusCode = 502; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ error: 'Layanan server belum tersedia.' })) }
  }
}
let singleton
export default async function api(req, res) {
  singleton ||= nodeApiHandler(createApplicationApi())
  return singleton(req, res)
}
