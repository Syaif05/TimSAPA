import { cleanActivity, activityRange } from './activity.js'
import { createTarikUpdater } from './tarikUpdate.js'
import { cleanReportDesign } from '../src/utils/reportDesign.js'
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
  const bodyOf = async (request, limit = 20000) => {
    if (Number(request.headers.get('content-length')) > limit) throw httpError(413, 'Permintaan terlalu besar.')
    const text = await request.text()
    if (Buffer.byteLength(text) > limit) throw httpError(413, 'Permintaan terlalu besar.')
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
  const excelContacts = settings => !settings.contacts_spreadsheet_id || settings.contacts_spreadsheet_id === CONTACTS_SOURCE.id
  async function connection() { return (await database('sapa_google_connection?id=eq.main&select=email,encrypted_tokens,updated_at'))[0] }
  let access = null; let refreshing
  async function accessToken() {
    const saved = await connection()
    if (!saved) throw httpError(503, 'Akun Google pengelola belum terhubung. Hubungi super admin.')
    if (access?.version === saved.updated_at && access.until > now() + 60000) return access.token
    const tokens = cipher().open(saved.encrypted_tokens, 'google-connection')
    if (tokens.access_token && Number(tokens.access_until) > now() + 60000) {
      access = { token: tokens.access_token, until: tokens.access_until, version: saved.updated_at }
      return access.token
    }
    if (!refreshing) refreshing = (async () => {
      const fresh = await googleOAuth().refresh(tokens.refresh_token)
      if (!fresh.access_token) throw Object.assign(httpError(502, 'Google belum mengirim access token. Coba Periksa ulang.'), { code: 'GOOGLE_TEMPORARY', retryable: true })
      const until = now() + Number(fresh.expires_in || 3600) * 1000
      const version = new Date(now()).toISOString()
      const next = { ...tokens, refresh_token: fresh.refresh_token || tokens.refresh_token, access_token: fresh.access_token, access_until: until, granted_at: tokens.granted_at || saved.updated_at }
      // Compare ciphertext as well as timestamp so a new admin grant always wins.
      const stored = await database(queryPath('sapa_google_connection', { id: 'eq.main', updated_at: `eq.${saved.updated_at}`, encrypted_tokens: `eq.${saved.encrypted_tokens}` }), { method: 'PATCH', body: { encrypted_tokens: cipher().seal(next, 'google-connection'), updated_at: version } })
      if (stored.length) {
        access = { token: fresh.access_token, until, version: stored[0].updated_at }
        return access.token
      }
      const latest = await connection()
      if (!latest) throw httpError(503, 'Koneksi Google berubah. Periksa ulang.')
      const newer = cipher().open(latest.encrypted_tokens, 'google-connection')
      if (newer.access_token && Number(newer.access_until) > now() + 60000) {
        access = { token: newer.access_token, until: newer.access_until, version: latest.updated_at }
        return access.token
      }
      throw httpError(503, 'Koneksi Google baru saja berubah. Coba Periksa ulang.')
    })().finally(() => { refreshing = null })
    return refreshing
  }
  async function googleRequest(id, suffix, options = {}) {
    const settings = await sourceSettings()
    if (![SPREADSHEET_ID, CONTACTS_SOURCE.id, settings.contacts_spreadsheet_id].filter(Boolean).includes(id)) throw httpError(403, 'Spreadsheet tidak diizinkan.')
    let token = await accessToken()
    let response
    for (let attempt = 0; attempt < 2; attempt++) {
      try { response = await fetchImpl(`https://sheets.googleapis.com/v4/spreadsheets/${id}${suffix}`, { method: options.method || 'GET', signal: AbortSignal.timeout(25000), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }) }
      catch { throw httpError(502, options.method ? 'Respons perubahan belum diterima. Sinkronkan dan periksa hasil sebelum mencoba lagi.' : 'Sheets API belum merespons. Data terakhir tetap tersedia.') }
      if (response.status !== 401 || attempt === 1) break
      if (access?.token === token) access = null
      // Only an explicit rejection is safe to retry, including for writes.
      const saved = await connection()
      if (saved) {
        const tokens = cipher().open(saved.encrypted_tokens, 'google-connection')
        if (tokens.access_token === token) await database(queryPath('sapa_google_connection', { id: 'eq.main', updated_at: `eq.${saved.updated_at}`, encrypted_tokens: `eq.${saved.encrypted_tokens}` }), { method: 'PATCH', body: { encrypted_tokens: cipher().seal({ ...tokens, access_token: null, access_until: 0 }, 'google-connection') } })
      }
      token = await accessToken()
    }
    const data = await response.json()
    if (!response.ok) {
      if (response.status === 401) {
        access = null
        throw Object.assign(httpError(401, 'Google tetap menolak token setelah diperbarui. Super admin perlu memeriksa koneksi Google.'), { code: 'GOOGLE_AUTH_FAILED' })
      }
      if (response.status === 403) throw httpError(403, 'Akun pengelola belum memiliki izin file, atau Google Sheets API belum diaktifkan.')
      if (response.status === 429) throw httpError(429, 'Batas permintaan Google tercapai. Pembaruan akan dicoba kembali.')
      throw httpError(502, 'Google tidak dapat membaca file/range. Pastikan file Google Sheets asli dan nama tab sesuai.')
    }
    return data
  }
  const sheets = createGoogleSheetsApi({ database, googleRequest, now, contactsSource: async () => { const settings = await sourceSettings(); return settings.contacts_spreadsheet_id ? { id: settings.contacts_spreadsheet_id, sheet: settings.contacts_sheet } : CONTACTS_SOURCE } })
  const updateTarik = createTarikUpdater({ database, googleRequest, now })
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
      await database('sapa_google_connection?on_conflict=id', { method: 'POST', body: { id: 'main', email: identity.email, encrypted_tokens: cipher().seal({ refresh_token:tokens.refresh_token,access_token:tokens.access_token,access_until:now()+Number(tokens.expires_in||3600)*1000,granted_at:new Date(now()).toISOString() }, 'google-connection'), updated_at: new Date(now()).toISOString() }, prefer: 'resolution=merge-duplicates,return=minimal' })
      access = null
      await database(queryPath('sapa_source_cache',{cache_key:'like.monitoring:*'}), { method: 'DELETE' })
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
        if (path === '/api/report-design') {
          if (request.method === 'GET') {
            const record = (await database(queryPath('sapa_source_cache', { cache_key: 'eq.settings:followup-design', select: 'snapshot' })))[0]
            return json(record?.snapshot || { design: null })
          }
          if (request.method !== 'PUT') throw httpError(405, 'Metode tidak tersedia.')
          sameOrigin(request)
          const body = await bodyOf(request)
          const pic = String(body.pic || '').trim().replace(/\s+/g, ' ').toUpperCase()
          if (!pic || !(await database(queryPath('sapa_pic_profiles', { name: `eq.${pic}`, select: 'name' }))).length) throw httpError(403, 'Pilih PIC terdaftar sebelum menyimpan desain.')
          let design
          try { design = cleanReportDesign(body.design) } catch (error) { throw httpError(400, error.message) }
          const snapshot = { design, savedBy: pic, savedAt: new Date(now()).toISOString() }
          await database('sapa_source_cache?on_conflict=cache_key', { method: 'POST', body: { cache_key: 'settings:followup-design', snapshot, expires_at: '9999-12-31T00:00:00Z' }, prefer: 'resolution=merge-duplicates,return=minimal' })
          return json(snapshot)
        }
        if (!path.startsWith('/api/auth/') && !path.startsWith('/api/admin/') && path !== '/api/orders' && path !== '/api/tarik-update' && path !== '/api/activity' && !(enabled && ['/api/sheets', '/api/contacts'].includes(path))) return null
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
        if (path === '/api/activity' && request.method === 'POST') {
          sameOrigin(request)
          const {pic,events}=cleanActivity(await bodyOf(request))
          if (!(await database(queryPath('sapa_pic_profiles',{name:`eq.${pic}`,select:'name'}))).length) throw httpError(403,'PIC tidak terdaftar.')
          await database('sapa_pic_activity?on_conflict=id',{method:'POST',body:events,prefer:'resolution=ignore-duplicates,return=minimal'})
          return json({saved:true})
        }
        if (path === '/api/admin/analytics' && request.method === 'GET') {
          await requireAdmin(request)
          return json(await database('rpc/sapa_activity_summary',{method:'POST',body:activityRange(url,now())}))
        }
        if(path==='/api/admin/google-health' && request.method==='GET') {
          await requireAdmin(request)
          try {await accessToken();return json({status:'healthy',checkedAt:new Date(now()).toISOString()})}
          catch(error){return json({status:error.code==='GOOGLE_RECONNECT_REQUIRED'?'reconnect_required':error.code==='GOOGLE_CLIENT_CONFIG'?'configuration_error':'temporary_error',code:error.code||'',message:error.message,checkedAt:new Date(now()).toISOString()})}
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
        if (path === '/api/admin/contacts/refresh' && request.method === 'POST') {
          sameOrigin(request); await requireAdmin(request)
          const settings = await sourceSettings()
          const data = await sheets.contacts(excelContacts(settings) ? readContacts : undefined, { force: true })
          if (data.stale) throw httpError(503, data.error || 'Kontak belum berhasil diperbarui. Data lama tetap tersedia.')
          return json({ count: data.contacts.length, fetchedAt: data.fetchedAt, sourceId: data.sourceId })
        }
        if (path === '/api/tarik-update' && request.method === 'POST') {
          sameOrigin(request)
          const settings = await sourceSettings()
          if (!settings.allow_pic_edits) throw httpError(403, 'Update oleh PIC sedang dinonaktifkan super admin.')
          const body = await bodyOf(request, 4000000)
          const pic = String(body.pic || '').trim().toUpperCase()
          if (!pic || !(await database(queryPath('sapa_pic_profiles', { name:`eq.${pic}`,select:'name' }))).length) throw httpError(403, 'Pilih PIC terdaftar sebelum update.')
          return json(await updateTarik(body, `PIC:${pic}`))
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
          const data = await sheets.contacts(excelContacts(settings) ? readContacts : undefined)
          const etag = `"${data.revision}:${!!data.stale}"`
          const headers = { ETag: etag, 'X-SAPA-Fetched-At': data.fetchedAt }
          if (!data.stale && request.headers.get('if-none-match') === etag) return new Response(null, { status: 304, headers: { ...headers, 'Cache-Control': 'no-store' } })
          return json(data, 200, headers)
        }
        return json({ error: 'Metode tidak tersedia.' }, 405)
      } catch (error) {
        const status = error.status || 502
        const message = error.status ? error.message : 'Koneksi server belum merespons. Data terakhir tetap dipertahankan.'
        if (path === '/api/auth/callback' && env.APP_ORIGIN) return new Response(null, { status: 302, headers: { 'Cache-Control': 'no-store', Location: `${origin()}/admin?error=${encodeURIComponent(message)}`, 'Set-Cookie': cookie('sapa_oauth', '', 0) } })
        return json({ error:message,...(error.code?.startsWith('GOOGLE_')?{code:error.code,retryable:!!error.retryable}:{}) }, status)
      }
    },
  }
}
