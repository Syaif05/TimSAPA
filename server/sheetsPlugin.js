import { createContactsReader } from './contactsData.js'
import { createHash } from 'node:crypto'
import { createSheetsReader } from './sheetsData.js'
export function sheetsPlugin({ read = createSheetsReader(), readContacts = createContactsReader() } = {}) {
  const install = server => {
    server.middlewares.use('/api/contacts', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Content-Type', 'application/json; charset=utf-8')
      if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Sumber kontak hanya dapat dibaca.' })); return }
      try {
        const data = await readContacts()
        const etag = '"' + createHash('sha256').update(`${data.revision}:${data.stale}:${data.error}`).digest('hex') + '"'
        res.setHeader('ETag', etag)
        res.setHeader('X-SAPA-Fetched-At', data.fetchedAt)
        if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return }
        res.end(JSON.stringify(data))
      } catch (error) { res.statusCode = 502; res.end(JSON.stringify({ error: error.message || 'Gagal membaca kontak spreadsheet.' })) }
    })
    server.middlewares.use('/api/sheets', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store')
    res.setHeader('Content-Type', 'application/json; charset=utf-8')
    if (req.method !== 'GET') { res.statusCode = 405; res.setHeader('Allow', 'GET'); res.end(JSON.stringify({ error: 'Sumber ini hanya dapat dibaca.' })); return }
    // This endpoint only targets the configured workbook; it is not a generic proxy.
    try {
      const url = new URL(req.url, 'http://localhost')
      const data = await read({ mode: url.searchParams.get('mode') || 'linked', date: url.searchParams.get('date') || undefined })
      const etag = `"${data.revision}"`
      res.setHeader('ETag', etag)
      res.setHeader('X-SAPA-Fetched-At', data.fetchedAt)
      if (req.headers['if-none-match'] === etag) { res.statusCode = 304; res.end(); return }
      res.end(JSON.stringify(data))
    } catch (error) {
      res.statusCode = 502
      res.end(JSON.stringify({ error: error.name === 'TimeoutError' ? 'Google Sheets belum merespons. Data terakhir tetap tersedia; coba sinkronkan lagi.' : error.message || 'Gagal membaca Google Sheets.' }))
    }
  }) }
  return { name: 'sapa-read-only-sheets', configureServer: install, configurePreviewServer: install }
}
