import { createGoogleOAuth, tokenCipher, randomToken, digest, httpError, normalizeEmail, SHEETS_SCOPE } from './googleOAuth.js'
import { createCloudDatabase, queryPath } from './cloudDatabase.js'
import { createGoogleSheetsApi } from './googleSheetsApi.js'
import { SPREADSHEET_ID, CONTACTS_SOURCE } from '../src/utils/sheetsConfig.js'
import { createContactsReader } from './contactsData.js'
const json = (value, status = 200, headers = {}) => new Response(JSON.stringify(value), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers } })
const cookies = request => Object.fromEntries((request.headers.get('cookie') || '').split(';').map(p => { const i = p.indexOf('='); return i < 0 ? [] : [p.slice(0, i).trim(), p.slice(i + 1)] }).filter(p => p.length))
const REQUIRED = ['APP_ORIGIN', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'SAPA_TOKEN_ENCRYPTION_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'SAPA_SUPER_ADMIN_EMAILS']
export function createGoogleApplication({ env = process.env, fetchImpl = fetch, database = createCloudDatabase(env, fetchImpl), now = () => Date.now(), oauth: injectedOAuth, readContacts = createContactsReader({ fetchImpl }) } = {}) {
  const enabled = env.SAPA_GOOGLE_ENABLED === 'true'
  const missing = () => REQUIRED.filter(key => !env[key])
  const origin = () => new URL(env.APP_ORIGIN).origin
  const isTrusted = email => (env.SAPA_SUPER_ADMIN_EMAILS || '').split(',').map(normalizeEmail).filter(Boolean).includes(normalizeEmail(email))
  const requireConfig = () => {
    if (!enabled || missing().length) throw httpError(503, 'Koneksi Google belum diaktifkan. Ikuti panduan konfigurasi server.')
    const appUrl = new URL(env.APP_ORIGIN)
    if (appUrl.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(appUrl.hostname)) throw httpError(503, 'Alamat aplikasi harus menggunakan HTTPS.')
  }
  const cipher = () => tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY)
  const oauth = () => injectedOAuth || createGoogleOAuth({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET, redirectUri: `${origin()}/api/auth/callback`, fetchImpl, now })
  // Keep JWKS cache alive for this application instance.
  let google; const googleOAuth = () => google ||= oauth()
  const cookie = (name, value, seconds) => `${name}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${origin().startsWith('https:') ? '; Secure' : ''}`
  const sameOrigin = request => {
    if (request.headers.get('origin') !== origin()) throw httpError(403, 'Permintaan harus berasal dari aplikasi SAPA.')
    if (!request.headers.get('content-type')?.startsWith('application/json')) throw httpError(415, 'Gunakan format JSON.')
  }
  const bodyOf = async request => {
    if (Number(request.headers.get('content-length')) > 20000) throw httpError(413, 'Permintaan terlalu besar.')
    const text = await request.text()
    if (Buffer.byteLength(text) > 20000) throw httpError(413, 'Permintaan terlalu besar.')
    try { return JSON.parse(text) } catch { throw httpError(400, 'Format permintaan tidak valid.') }
  }
  async function adminSession(request) {
    const token = cookies(request).sapa_admin
    if (!token || !/^[\w-]{43}$/.test(token)) return null
    const session = (await database(queryPath('sapa_admin_sessions', { token_hash: `eq.${digest(token)}`, expires_at: `gt.${new Date(now()).toISOString()}`, select: 'email,token_hash' })))[0]
    return session && isTrusted(session.email) ? session : null
  }
  const requireAdmin = async request => { const admin = await adminSession(request); if (!admin) throw httpError(401, 'Masuk dengan email super admin untuk melanjutkan.'); return admin }
  async function sourceSettings() { return (await database('sapa_source_settings?id=eq.main&select=allow_pic_edits,contacts_spreadsheet_id,contacts_sheet'))[0] || { allow_pic_edits: true } }
  async function connection() { return (await database('sapa_google_connection?id=eq.main&select=email,encrypted_tokens,updated_at'))[0] }
  let access = null; let refreshing
  async function accessToken() {
    const saved = await connection()
    if (!saved) throw httpError(503, 'Akun Google pengelola belum terhubung. Hubungi super admin.')
    if (access?.version === saved.updated_at && access.until > now() + 60000) return access.token
    if (!refreshing) refreshing = (async () => {
      const tokens = cipher().open(saved.encrypted_tokens, 'google-connection')
      const fresh = await googleOAuth().refresh(tokens.refresh_token)
      if (!fresh.access_token) throw httpError(401, 'Izin akun Google perlu dihubungkan kembali oleh super admin.')
      access = { token: fresh.access_token, until: now() + Number(fresh.expires_in || 3600) * 1000, version: saved.updated_at }
      return access.token
    })().finally(() => { refreshing = null })
    return refreshing
  }
  async function googleRequest(id, suffix, options = {}) {
    const settings = await sourceSettings()
    if (![SPREADSHEET_ID, CONTACTS_SOURCE.id, settings.contacts_spreadsheet_id].filter(Boolean).includes(id)) throw httpError(403, 'Spreadsheet tidak diizinkan.')
    const token = await accessToken()
    let response
    try { response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${id}${suffix}`, { method: options.method || 'GET', signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }) }
    catch { throw httpError(502, options.method ? 'Respons perubahan belum diterima. Sinkronkan dan periksa hasil sebelum mencoba lagi.' : 'Sheets API belum merespons. Data terakhir tetap tersedia.') }
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401) { access = null; throw httpError(401, 'Izin Google kedaluwarsa atau dicabut. Super admin perlu menghubungkan ulang akun.') }
      if (response.status === 403) throw httpError(403, 'Akun pengelola belum memiliki izin file, atau Google Sheets API belum diaktifkan.')
      if (response.status === 429) throw httpError(429, 'Batas permintaan Google tercapai. Pembaruan akan dicoba kembali.')
      throw httpError(502, 'Google tidak dapat membaca file/range. Pastikan file Google Sheets asli dan nama tab sesuai.')
    }
    return data
  }
  const sheets = createGoogleSheetsApi({ database, googleRequest, now, contactsSource: async () => { const settings = await sourceSettings(); return settings.contacts_spreadsheet_id ? { id: settings.contacts_spreadsheet_id, sheet: settings.contacts_sheet } : CONTACTS_SOURCE } })
  async function begin(request, purpose) {
    const admin = purpose === 'connect' ? await requireAdmin(request) : null
    const flow = { state: randomToken(), nonce: randomToken(), verifier: randomToken(), purpose, email: admin?.email, sessionHash: admin?.token_hash, expires: now() + 600000 }
    await database(queryPath('sapa_oauth_states', { expires_at: `lt.${new Date(now()).toISOString()}` }), { method: 'DELETE' })
    await database('sapa_oauth_states', { method: 'POST', body: { state_hash: digest(flow.state), expires_at: new Date(flow.expires).toISOString() } })
    return new Response(null, { status: 302, headers: { 'Cache-Control': 'no-store', 'Set-Cookie': cookie('sapa_oauth', cipher().seal(flow, 'oauth-flow'), 600), Location: googleOAuth().authorization({ ...flow, connect: purpose === 'connect' }) } })
  }
  async function callback(request, url) {
    const raw = cookies(request).sapa_oauth
    if (!raw) throw httpError(401, 'Sesi login berakhir. Mulai login kembali.')
    const flow = cipher().open(raw, 'oauth-flow')
    if (!flow.state || flow.state !== url.searchParams.get('state') || flow.expires <= now()) throw httpError(401, 'Sesi login tidak cocok atau kedaluwarsa.')
    const consumed = await database(queryPath('sapa_oauth_states', { state_hash: `eq.${digest(flow.state)}`, expires_at: `gt.${new Date(now()).toISOString()}` }), { method: 'DELETE' })
    if (!consumed.length) throw httpError(401, 'Permintaan login sudah dipakai. Mulai kembali.')
    if (url.searchParams.has('error') || !url.searchParams.get('code')) throw httpError(401, 'Akses Google dibatalkan. Anda dapat mencoba kembali.')
    const { identity, tokens } = await googleOAuth().exchange(url.searchParams.get('code'), flow.verifier, flow.nonce)
    if (!isTrusted(identity.email)) throw httpError(403, 'Email ini tidak terdaftar sebagai super admin.')
    const headers = new Headers({ 'Cache-Control': 'no-store', Location: `${origin()}/admin` })
    headers.append('Set-Cookie', cookie('sapa_oauth', '', 0))
    if (flow.purpose === 'connect') {
      const admin = await requireAdmin(request)
      if (admin.email !== flow.email || admin.token_hash !== flow.sessionHash || identity.email !== admin.email) throw httpError(403, 'Gunakan akun Google super admin yang sedang masuk.')
      if (!String(tokens.scope || '').split(' ').includes(SHEETS_SCOPE) || !tokens.refresh_token) throw httpError(422, 'Izin spreadsheet/offline belum diberikan. Ulangi Hubungkan Google dan berikan izin yang diminta.')
      await database('sapa_google_connection?on_conflict=id', { method: 'POST', body: { id: 'main', email: identity.email, encrypted_tokens: cipher().seal({ refresh_token: tokens.refresh_token }, 'google-connection'), updated_at: new Date(now()).toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' })
      access = null
      await database('sapa_source_cache?cache_key=not.is.null', { method: 'DELETE' })
    } else {
      const token = randomToken()
      await database(queryPath('sapa_admin_sessions', { expires_at: `lt.${new Date(now()).toISOString()}` }), { method: 'DELETE' })
      await database('sapa_admin_sessions', { method: 'POST', body: { token_hash: digest(token), email: identity.email, expires_at: new Date(now() + 86400000).toISOString() } })
      headers.append('Set-Cookie', cookie('sapa_admin', token, 86400))
    }
    return new Response(null, { status: 302, headers })
  }
  return {
    enabled, sheets,
    async handle(request) {
      const url = new URL(request.url); const path = url.pathname
      try {
        if (path === '/api/session' && request.method === 'GET') {
          if (!enabled || missing().length) return json({ enabled, configured: !missing().length, admin: false, connected: false, canEdit: false, missing: missing() })
          requireConfig()
          try {
            const [admin, saved, settings] = await Promise.all([adminSession(request), connection(), sourceSettings()])
            return json({ enabled: true, configured: true, backendReady: true, admin: !!admin, ...(admin ? { email: admin.email, connectedEmail: saved?.email, connectedAt: saved?.updated_at, contactsSpreadsheetId: settings.contacts_spreadsheet_id || '', contactsSheet: settings.contacts_sheet || CONTACTS_SOURCE.sheet } : {}), connected: !!saved, canEdit: !!saved && settings.allow_pic_edits, allowPicEdits: settings.allow_pic_edits })
          } catch (error) {
            return json({ enabled: true, configured: true, backendReady: false, admin: false, connected: false, canEdit: false, backendError: error.status ? error.message : 'Penyimpanan Supabase belum dapat diperiksa. Coba lagi setelah jaringan pulih.' })
          }
        }
        if (!path.startsWith('/api/auth/') && !path.startsWith('/api/admin/') && path !== '/api/orders' && !(enabled && ['/api/sheets', '/api/contacts'].includes(path))) return null
        requireConfig()
        // Enabling admin login must not interrupt the existing public monitoring
        // while the manager has yet to connect their Google account. Both readers
        // target the same fixed monitoring workbook; writes never use this fallback.
        if (path === '/api/sheets' && request.method === 'GET' && !(await connection().catch(() => null))) return null
        if (path === '/api/contacts' && request.method === 'GET' && !(await connection())) return null
        if (path === '/api/auth/login' && request.method === 'GET') return await begin(request, 'login')
        if (path === '/api/auth/connect' && request.method === 'GET') return await begin(request, 'connect')
        if (path === '/api/auth/callback' && request.method === 'GET') return await callback(request, url)
        if (path === '/api/auth/logout' && request.method === 'POST') {
          sameOrigin(request)
          const token = cookies(request).sapa_admin
          if (token) await database(queryPath('sapa_admin_sessions', { token_hash: `eq.${digest(token)}` }), { method: 'DELETE' })
          return json({ signedOut: true }, 200, { 'Set-Cookie': cookie('sapa_admin', '', 0) })
        }
        if (path === '/api/admin/settings' && request.method === 'PUT') {
          sameOrigin(request); await requireAdmin(request)
          const body = await bodyOf(request)
          const update = { updated_at: new Date(now()).toISOString() }
          if (Object.hasOwn(body, 'allowPicEdits')) {
            if (typeof body.allowPicEdits !== 'boolean') throw httpError(400, 'Pengaturan tidak valid.')
            update.allow_pic_edits = body.allowPicEdits
          }
          if (Object.hasOwn(body, 'contactsSpreadsheetId')) {
            if (typeof body.contactsSpreadsheetId !== 'string' || (body.contactsSpreadsheetId && !/^[A-Za-z0-9_-]{20,120}$/.test(body.contactsSpreadsheetId)) || typeof body.contactsSheet !== 'string' || !body.contactsSheet.trim() || body.contactsSheet.length > 150 || /[\u0000-\u001f]/.test(body.contactsSheet)) throw httpError(400, 'ID/nama tab kontak tidak valid.')
            update.contacts_spreadsheet_id = body.contactsSpreadsheetId || null; update.contacts_sheet = body.contactsSheet.trim()
          }
          if (Object.keys(update).length === 1) throw httpError(400, 'Pengaturan tidak valid.')
          await database('sapa_source_settings?id=eq.main', { method: 'PATCH', body: update })
          return json({ saved: true })
        }
        if (path === '/api/admin/audit' && request.method === 'GET') {
          await requireAdmin(request)
          return json({ changes: await database('sapa_sheet_audit?select=id,actor,source,sheet_date,shipment,outcome,created_at&order=created_at.desc&limit=20') })
        }
        if (path === '/api/orders' && request.method === 'PATCH') {
          sameOrigin(request)
          const settings = await sourceSettings()
          if (!settings.allow_pic_edits) throw httpError(403, 'Perubahan oleh PIC sedang dinonaktifkan super admin.')
          const body = await bodyOf(request)
          const pic = String(body.pic || '').trim().replace(/\s+/g, ' ').toUpperCase()
          if (!pic || pic.length > 80 || !(await database(queryPath('sapa_pic_profiles', { name: `eq.${pic}`, select: 'name' }))).length) throw httpError(403, 'Pilih PIC yang terdaftar sebelum mengubah pesanan.')
          return json(await sheets.updateOrder(body, `PIC:${pic}`))
        }
        if (path === '/api/sheets' && request.method === 'GET') {
          const data = await sheets.monitoring({ mode: url.searchParams.get('mode') || 'daily', date: url.searchParams.get('date') || undefined, force: url.searchParams.get('fresh') === '1' })
          const etag = `"${data.revision}:${!!data.stale}"`
          const headers = { ETag: etag, 'X-SAPA-Fetched-At': data.fetchedAt }
          if (!data.stale && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ...headers, 'Cache-Control': 'no-store' } })
          return json(data, 200, headers)
        }
        if (path === '/api/contacts' && request.method === 'GET') {
          const settings = await sourceSettings()
          // The original contacts file is an XLSX opened in the Sheets UI, not a native Sheet.
          const useExcel = !settings.contacts_spreadsheet_id || settings.contacts_spreadsheet_id === CONTACTS_SOURCE.id
          return json(await sheets.contacts(useExcel ? readContacts : undefined))
        }
        return json({ error: 'Metode tidak tersedia.' }, 405)
      } catch (error) {
        const status = error.status || 502
        const message = error.status ? error.message : 'Koneksi server belum merespons. Data terakhir tetap dipertahankan.'
        if (path === '/api/auth/callback' && env.APP_ORIGIN) return new Response(null, { status: 302, headers: { 'Cache-Control': 'no-store', Location: `${origin()}/admin?error=${encodeURIComponent(message)}`, 'Set-Cookie': cookie('sapa_oauth', '', 0) } })
        return json({ error: message }, status)
      }
    },
  }
}
