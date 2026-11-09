import test from 'node:test'
import assert from 'node:assert/strict'
import { generateKeyPairSync, sign } from 'node:crypto'
import { createGoogleOAuth, tokenCipher, SHEETS_SCOPE } from '../server/googleOAuth.js'
import { createGoogleApplication } from '../server/googleApplication.js'
import { createGoogleSheetsApi } from '../server/googleSheetsApi.js'
import { createCloudDatabase } from '../server/cloudDatabase.js'
import { createApplicationApi } from '../server/applicationApi.js'
import { parseMonitoringValues } from '../src/utils/sheetsParser.js'
import { createRosterReader } from '../supabase/functions/pic-profiles/handler.js'
import { CONTACTS_SOURCE } from '../src/utils/sheetsConfig.js'

const time = Date.parse('2026-11-01T04:00:00Z')
const env = { SAPA_GOOGLE_ENABLED: 'true', APP_ORIGIN: 'https://sapa.example', GOOGLE_CLIENT_ID: 'test-client', GOOGLE_CLIENT_SECRET: 'test-only', SAPA_TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 7).toString('base64'), SAPA_SUPER_ADMIN_EMAILS: 'admin@example.com', SUPABASE_URL: 'https://db.example', SUPABASE_SERVICE_ROLE_KEY: 'test-only-server' }
function memoryDatabase() {
  const tables = new Map([
    ['sapa_source_settings', [{ id: 'main', allow_pic_edits: true }]],
    ['sapa_pic_profiles', [{ name: 'PIC TEST' }]],
  ])
  let id = 0
  const keys = { sapa_source_cache: 'cache_key', sapa_source_settings: 'id', sapa_google_connection: 'id' }
  const database = async (path, options = {}) => {
    const [table, search] = path.split('?'); const q = new URLSearchParams(search)
    const rows = tables.get(table) || []; tables.set(table, rows)
    const matches = row => [...q.entries()].every(([key, match]) => {
      if (['select', 'order', 'limit', 'on_conflict'].includes(key)) return true
      if (match === 'not.is.null') return row[key] != null
      const i = match.indexOf('.'); const op = match.slice(0, i); const value = match.slice(i + 1)
      return op === 'like' ? String(row[key]).startsWith(value.replace(/\*$/, '')) : op === 'eq' ? String(row[key]) === value : op === 'gt' ? row[key] > value : op === 'lt' ? row[key] < value : false
    })
    if (options.method === 'POST') {
      const previous = keys[table] && rows.find(r => r[keys[table]] === options.body[keys[table]])
      if (previous) { Object.assign(previous, structuredClone(options.body)); return [structuredClone(previous)] }
      const row = { id: ++id, ...structuredClone(options.body) }; rows.push(row); return [structuredClone(row)]
    }
    const found = rows.filter(matches)
    if (options.method === 'PATCH') found.forEach(row => Object.assign(row, structuredClone(options.body)))
    if (options.method === 'DELETE') tables.set(table, rows.filter(row => !matches(row)))
    return structuredClone(found)
  }
  database.tables = tables
  return database
}
const req = (path, { method = 'GET', cookie, body, origin = env.APP_ORIGIN } = {}) => new Request(`${env.APP_ORIGIN}${path}`, { method, headers: { ...(cookie ? { Cookie: cookie } : {}), ...(body ? { Origin: origin, 'Content-Type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) })
function appFixture(overrides = {}, options = {}) {
  const database = memoryDatabase()
  const actual = createGoogleOAuth({ clientId: env.GOOGLE_CLIENT_ID, clientSecret: '', redirectUri: `${env.APP_ORIGIN}/api/auth/callback` })
  const oauth = { authorization: actual.authorization, exchange: async () => ({ identity: { sub: 'google-test', email: 'admin@example.com' }, tokens: { refresh_token: 'test-refresh-token', scope: `openid email ${SHEETS_SCOPE}` } }), refresh: async () => ({ access_token: 'test-access', expires_in: 3600 }), ...overrides }
  const app = createGoogleApplication({ env, database, oauth, now: () => time, ...options })
  return { app, database, oauth }
}
async function login(app) {
  const start = await app.handle(req('/api/auth/login'))
  const state = new URL(start.headers.get('location')).searchParams.get('state')
  const flowCookie = start.headers.get('set-cookie').split(';')[0]
  const response = await app.handle(req(`/api/auth/callback?state=${state}&code=test-code`, { cookie: flowCookie }))
  return { response, cookie: response.headers.getSetCookie().find(c => c.startsWith('sapa_admin='))?.split(';')[0], state, flowCookie }
}

test('Google ID token verifies signature, issuer, audience, expiry, nonce and verified email', async () => {
  const { publicKey, privateKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig' }
  const oauth = createGoogleOAuth({ clientId: 'test-client', now: () => time, fetchImpl: async () => ({ ok: true, json: async () => ({ keys: [jwk] }) }) })
  const base = { iss: 'https://accounts.google.com', aud: 'test-client', sub: '123456', email: 'Admin@Example.com', email_verified: true, iat: time / 1000, exp: time / 1000 + 300, nonce: 'test-nonce' }
  const jwt = (changes = {}, header = {}) => {
    const first = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key', ...header })).toString('base64url')
    const second = Buffer.from(JSON.stringify({ ...base, ...changes })).toString('base64url')
    return `${first}.${second}.${sign('RSA-SHA256', Buffer.from(`${first}.${second}`), privateKey).toString('base64url')}`
  }
  assert.equal((await oauth.verifyIdToken(jwt(), 'test-nonce')).email, 'admin@example.com')
  for (const invalid of [{ iss: 'https://attacker.example' }, { aud: 'wrong-client' }, { azp: 'other' }, { exp: time / 1000 - 1 }, { iat: time / 1000 + 600 }, { nonce: 'wrong' }, { email_verified: false }, { email: '' }, { sub: '' }]) await assert.rejects(oauth.verifyIdToken(jwt(invalid), 'test-nonce'), { status: 401 })
  await assert.rejects(oauth.verifyIdToken(jwt({}, { alg: 'none' }), 'test-nonce'), { status: 401 })
  await assert.rejects(oauth.verifyIdToken(jwt().slice(0, -8) + 'fakefake', 'test-nonce'), { status: 401 })
})
test('refresh tokens are encrypted with purpose binding and authenticated ciphertext', () => {
  const cipher = tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY)
  const sealed = cipher.seal({ refresh_token: 'private-google-refresh' }, 'google-connection')
  assert.ok(!sealed.includes('private-google-refresh'))
  assert.equal(cipher.open(sealed, 'google-connection').refresh_token, 'private-google-refresh')
  assert.throws(() => cipher.open(sealed, 'oauth-flow'), { status: 401 })
  const corrupted = Buffer.from(sealed, 'base64url'); corrupted[30] ^= 1
  assert.throws(() => cipher.open(corrupted.toString('base64url'), 'google-connection'), { status: 401 })
  assert.throws(() => tokenCipher('short'), { status: 503 })
})
test('configuration fails closed and does not expose secret values', async () => {
  const app = createGoogleApplication({ env: { SAPA_GOOGLE_ENABLED: 'true', GOOGLE_CLIENT_SECRET: 'secret-marker' } })
  const status = await app.handle(req('/api/session'))
  const text = await status.text(); assert.ok(!text.includes('secret-marker'))
  assert.equal(JSON.parse(text).configured, false)
  assert.equal((await app.handle(req('/api/auth/login'))).status, 503)
  assert.equal((await app.handle(req('/api/sheets'))).status, 503)
})
test('complete configuration and disabled switch are reported as separate states', async () => {
  const app = createGoogleApplication({ env: { ...env, SAPA_GOOGLE_ENABLED: 'false' }, database: async () => assert.fail('disabled integration must not call database') })
  const status = await (await app.handle(req('/api/session'))).json()
  assert.equal(status.configured, true)
  assert.equal(status.enabled, false)
  assert.deepEqual(status.missing, [])
  assert.equal((await app.handle(req('/api/auth/login'))).status, 503)
})
test('TLS failure reports backend connection error without mislabeling credentials or granting admin', async () => {
  const fetchImpl = async () => { throw Object.assign(new Error('fetch failed with secret marker'), { cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' } }) }
  const database = createCloudDatabase(env, fetchImpl)
  const app = createGoogleApplication({ env, database })
  const response = await app.handle(req('/api/session'))
  const status = await response.json()
  assert.equal(response.status, 200)
  assert.equal(status.configured, true)
  assert.equal(status.enabled, true)
  assert.equal(status.backendReady, false)
  assert.equal(status.admin, false)
  assert.equal(status.canEdit, false)
  assert.match(status.backendError, /Sertifikat HTTPS/)
  assert.ok(!JSON.stringify(status).includes('secret marker'))
  assert.equal((await app.handle(req('/api/auth/login'))).status, 502)
})
test('enabling admin before Google connection preserves public monitoring but never enables public writes', async () => {
  for (const database of [memoryDatabase(), async () => { throw new Error('offline') }]) {
    const cloud = createGoogleApplication({ env, database })
    const api = createApplicationApi({ env, cloud, read: async () => ({ revision: 'public-test', rows: [], sources: [], fetchedAt: new Date(time).toISOString() }) })
    const response = await api(req('/api/sheets?mode=daily'))
    assert.equal(response.status, 200)
    assert.equal((await response.json()).revision, 'public-test')
    const write = await api(req('/api/orders', { method: 'PATCH', body: { pic: 'UNKNOWN' } }))
    assert.notEqual(write.status, 200)
  }
})
test('login uses state cookie, PKCE and nonce; state mismatch and replay cannot create sessions', async () => {
  const { app, database } = appFixture()
  const start = await app.handle(req('/api/auth/login'))
  const url = new URL(start.headers.get('location'))
  assert.equal(url.searchParams.get('code_challenge_method'), 'S256')
  assert.ok(url.searchParams.get('nonce')); assert.ok(!url.searchParams.get('scope').includes(SHEETS_SCOPE))
  assert.match(start.headers.get('set-cookie'), /HttpOnly; SameSite=Lax; Max-Age=600; Secure/)
  const { response, state, flowCookie } = await login(app)
  assert.ok(response.headers.getSetCookie().some(c => c.startsWith('sapa_admin=')))
  const count = database.tables.get('sapa_admin_sessions').length
  const replay = await app.handle(req(`/api/auth/callback?state=${state}&code=test`, { cookie: flowCookie }))
  assert.match(replay.headers.get('location'), /error=/)
  const mismatch = await app.handle(req('/api/auth/callback?state=wrong&code=test', { cookie: start.headers.get('set-cookie').split(';')[0] }))
  assert.match(mismatch.headers.get('location'), /error=/)
  assert.equal(database.tables.get('sapa_admin_sessions').length, count)
})
test('only trusted verified Google email becomes admin; browser email and role claims do not grant access', async () => {
  const { app } = appFixture({ exchange: async () => ({ identity: { email: 'stranger@example.com' }, tokens: {} }) })
  const stranger = await login(app)
  assert.equal(stranger.cookie, undefined)
  assert.match(stranger.response.headers.get('location'), /error=/)
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', body: { email: 'admin@example.com', role: 'admin', allowPicEdits: true } }))).status, 401)
  assert.equal((await app.handle(req('/api/admin/audit'))).status, 401)
})
test('admin settings require same-origin authenticated session; logout revokes that session', async () => {
  const { app } = appFixture(); const { cookie } = await login(app)
  assert.equal((await (await app.handle(req('/api/session', { cookie }))).json()).admin, true)
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', cookie, origin: 'https://evil.example', body: { allowPicEdits: false } }))).status, 403)
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', cookie, body: { allowPicEdits: false } }))).status, 200)
  assert.equal((await (await app.handle(req('/api/session'))).json()).allowPicEdits, false)
  assert.equal((await app.handle(req('/api/auth/logout', { method: 'POST', cookie, body: {} }))).status, 200)
  assert.equal((await app.handle(req('/api/admin/audit', { cookie }))).status, 401)
})
test('Google connection requires admin consent and offline Sheets scope; token never reaches public status', async () => {
  const { app, database, oauth } = appFixture(); const { cookie } = await login(app)
  assert.equal((await app.handle(req('/api/auth/connect'))).status, 401)
  const start = await app.handle(req('/api/auth/connect', { cookie }))
  const url = new URL(start.headers.get('location'))
  assert.ok(url.searchParams.get('scope').includes(SHEETS_SCOPE)); assert.equal(url.searchParams.get('access_type'), 'offline')
  const flowCookie = start.headers.get('set-cookie').split(';')[0]
  const response = await app.handle(req(`/api/auth/callback?state=${url.searchParams.get('state')}&code=test`, { cookie: `${cookie}; ${flowCookie}` }))
  assert.equal(response.headers.get('location'), `${env.APP_ORIGIN}/admin`)
  const stored = database.tables.get('sapa_google_connection')[0]
  assert.ok(!JSON.stringify(stored).includes('test-refresh-token'))
  const status = await (await app.handle(req('/api/session'))).json()
  assert.equal(status.connected, true); assert.equal(status.canEdit, true)
  assert.equal(status.connectedEmail, undefined); assert.ok(!JSON.stringify(status).includes('encrypted_tokens'))
  oauth.exchange = async () => ({ identity: { email: 'admin@example.com' }, tokens: { scope: 'openid email' } })
  const next = await app.handle(req('/api/auth/connect', { cookie })); const state = new URL(next.headers.get('location')).searchParams.get('state')
  const denied = await app.handle(req(`/api/auth/callback?state=${state}&code=test`, { cookie: `${cookie}; ${next.headers.get('set-cookie').split(';')[0]}` }))
  assert.match(denied.headers.get('location'), /error=/)
})
test('public PIC writes honor server toggle, origin, and registered PIC before calling Google', async () => {
  const { app, database } = appFixture()
  assert.equal((await app.handle(req('/api/orders', { method: 'PATCH', origin: 'https://evil.example', body: { pic: 'PIC TEST' } }))).status, 403)
  assert.equal((await app.handle(req('/api/orders', { method: 'PATCH', body: { pic: 'UNKNOWN' } }))).status, 403)
  database.tables.get('sapa_source_settings')[0].allow_pic_edits = false
  assert.equal((await app.handle(req('/api/orders', { method: 'PATCH', body: { pic: 'PIC TEST' } }))).status, 403)
})
test('native contact source can only be changed by admin with valid ID and tab name', async () => {
  const { app } = appFixture(); const { cookie } = await login(app)
  const body = { contactsSpreadsheetId: 'test-native-contacts-spreadsheet-id', contactsSheet: 'KONTAK TOKO BARU' }
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', body }))).status, 401)
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', cookie, body: { ...body, contactsSpreadsheetId: 'https://evil.example' } }))).status, 400)
  assert.equal((await app.handle(req('/api/admin/settings', { method: 'PUT', cookie, body }))).status, 200)
  const status = await (await app.handle(req('/api/session', { cookie }))).json()
  assert.equal(status.contactsSpreadsheetId, body.contactsSpreadsheetId)
  assert.equal((await (await app.handle(req('/api/session'))).json()).contactsSpreadsheetId, undefined)
})
test('configured legacy contacts file uses Excel reader even when its ID is saved', async () => {
  const database = memoryDatabase()
  Object.assign(database.tables.get('sapa_source_settings')[0], { contacts_spreadsheet_id: CONTACTS_SOURCE.id, contacts_sheet: CONTACTS_SOURCE.sheet })
  database.tables.set('sapa_google_connection', [{ id:'main', email:'admin@example.com', encrypted_tokens:'unused', updated_at:new Date(time).toISOString() }])
  const contact = { store:'1D92', acName:'ANDI GUNAWAN', cugAc:'6281234567890', cugAm:'6281234567891' }
  const app = createGoogleApplication({ env, database, readContacts: async () => ({ sourceId: CONTACTS_SOURCE.id, sheet: CONTACTS_SOURCE.sheet, contacts:[contact], fetchedAt:new Date(time).toISOString(), revision:'contact-test' }) })
  const response = await app.handle(req('/api/contacts'))
  assert.equal(response.status, 200)
  assert.deepEqual((await response.json()).contacts, [contact])
})
test('contacts use a 24-hour database snapshot and admin refresh bypasses it', async () => {
  const database = memoryDatabase()
  let clock = time
  let reads = 0
  const api = createGoogleSheetsApi({ database, googleRequest: async () => assert.fail('Excel source should not call Sheets API'), now: () => clock })
  const reader = async () => ({ contacts: [{ name: `Contact ${++reads}` }], fetchedAt: new Date(clock).toISOString(), revision: String(reads) })
  assert.equal((await api.contacts(reader)).contacts[0].name, 'Contact 1')
  clock += 23 * 3600000
  assert.equal((await api.contacts(reader)).contacts[0].name, 'Contact 1')
  assert.equal((await api.contacts(reader, { force: true })).contacts[0].name, 'Contact 2')
  assert.equal(reads, 2)
  clock += 25 * 3600000
  assert.equal((await api.contacts(reader)).contacts[0].name, 'Contact 3')
})

const header = ['Jam', 'No AC', 'Nama AC', 'Kode Toko', 'Nama Toko', 'Cabang', 'Region', 'Shipment', 'Nama Konsumen', 'SLA', 'Nama AM', 'No AM', 'POD AC', 'APV AM', 'PIC', 'Status', 'Kondisi Motor', 'Jumlah Personil', 'Nama Pejabat', 'Kendala', 'Grouping', 'GLI']
const cells = ['13:00', '081234567890', 'TEST AC', 'TEST1', 'Test Store', 'Test Branch', '', 'TEST-SHIP', '', '>1 jam', '', '', '', '', 'PIC TEST', 'Proses', '', '', '', 'Catatan awal']
test('verified live layout with blank PIC header uses O; unrelated layouts remain rejected', async () => {
  const blank = [...header]; blank[14] = ' '
  const rows = parseMonitoringValues([blank, cells], 'DS')
  assert.equal(rows[0].pic, 'PIC TEST')
  assert.equal(rows[0].sheetRow, 2)
  const unknown = [...blank]; unknown[13] = 'Other field'
  assert.throws(() => parseMonitoringValues([unknown, cells], 'DS'))
  const namedOther = [...blank]; namedOther[14] = 'Another field'
  assert.throws(() => parseMonitoringValues([namedOther, cells], 'DS'))
  const csv = [blank, cells].map(row => row.join(',')).join('\n')
  const roster = createRosterReader(async () => ({ ok: true, headers: new Headers({ 'content-type': 'text/csv' }), text: async () => csv }), () => new Date(time))
  assert.deepEqual(await roster(), ['PIC TEST'])
})
function sheetsFixture() {
  const database = memoryDatabase(); const writes = []; let clock = time; let calls = 0; let offline = false
  const googleRequest = async (_id, suffix, options = {}) => {
    calls++
    if (offline) throw new Error('Test offline')
    if (options.method === 'POST') { writes.push(options.body); return { totalUpdatedCells: 2 } }
    if (suffix.startsWith('?fields=')) return { sheets: ['REG', 'DS'].map((key, i) => ({ properties: { sheetId: i + 1, title: `${key} 01/11` } })) }
    if (suffix.startsWith('/values:batchGet')) return { valueRanges: [{ values: [header, cells] }, { values: [header, cells] }] }
    return { values: [header] }
  }
  const api = createGoogleSheetsApi({ database, googleRequest, now: () => clock })
  return { database, api, writes, googleRequest, calls: () => calls, advance: () => { clock += 31000 }, offline: () => { offline = true } }
}
test('Sheets API coalesces requests and reuses durable same-day snapshot across server instances', async () => {
  const f = sheetsFixture()
  const [a, b] = await Promise.all([f.api.monitoring({ date: '2026-11-01' }), f.api.monitoring({ date: '2026-11-01' })])
  assert.equal(a.rows.length, 2); assert.equal(b.revision, a.revision); assert.equal(f.calls(), 2)
  const another = createGoogleSheetsApi({ database: f.database, googleRequest: async () => assert.fail('durable cache should be reused'), now: () => time })
  assert.equal((await another.monitoring({ date: '2026-11-01' })).revision, a.revision)
  assert.equal(a.rows[0].sheetDate, '2026-11-01'); assert.equal(a.transport, 'google-api')
})
test('failed refresh retains prior snapshot with warning, never leaks previous day into new day', async () => {
  const f = sheetsFixture(); const first = await f.api.monitoring({ date: '2026-11-01' })
  f.advance(); f.offline()
  const stale = await f.api.monitoring({ date: '2026-11-01' })
  assert.equal(stale.stale, true); assert.equal(stale.error, 'Test offline'); assert.equal(stale.fetchedAt, first.fetchedAt)
  await assert.rejects(f.api.monitoring({ mode: 'daily', date: '2026-11-02' }), /offline/)
})
test('order edit checks row identity, expected values and column whitelist; sends RAW and records audit', async () => {
  const f = sheetsFixture()
  const body = { source: 'DS', date: '2026-11-01', mode: 'daily', sheetRow: 2, shipment: 'TEST-SHIP', store: 'TEST1', expected: { sheetStatus: 'Proses', kendala: 'Catatan awal' }, changes: { sheetStatus: 'Done', kendala: '=not-a-formula' } }
  await assert.rejects(f.api.updateOrder({ ...body, shipment: 'wrong-order' }, 'PIC:PIC TEST'), { status: 409 })
  await assert.rejects(f.api.updateOrder({ ...body, expected: { sheetStatus: 'old' } }, 'PIC:PIC TEST'), { status: 400 })
  await assert.rejects(f.api.updateOrder({ ...body, expected: { sheetStatus: 'old', kendala: 'Catatan awal' } }, 'PIC:PIC TEST'), { status: 409 })
  await assert.rejects(f.api.updateOrder({ ...body, changes: { shipment: 'overwrite' } }, 'PIC:PIC TEST'), { status: 400 })
  assert.equal(f.writes.length, 0)
  assert.deepEqual(await f.api.updateOrder(body, 'PIC:PIC TEST'), { saved: true })
  assert.equal(f.writes[0].valueInputOption, 'RAW')
  assert.deepEqual(f.writes[0].data.map(item => item.range), ["'DS 01/11'!P2", "'DS 01/11'!T2"])
  const audit = f.database.tables.get('sapa_sheet_audit')[0]
  assert.equal(audit.outcome, 'completed'); assert.equal(audit.actor, 'PIC:PIC TEST')
  assert.equal(f.database.tables.get('sapa_source_cache').length, 0)
})

test('report designs are shared across PICs and latest explicit save wins', async () => {
 const {app,database}=appFixture()
 database.tables.get('sapa_pic_profiles').push({name:'SECOND PIC'})
 const save=(pic,title)=>app.handle(req('/api/report-design',{method:'PUT',body:{pic,design:{title,theme:'green'}}}))
 assert.equal((await save('UNKNOWN','X')).status,403)
 assert.equal((await app.handle(req('/api/report-design',{method:'PUT',origin:'https://evil.example',body:{pic:'PIC TEST',design:{}}}))).status,403)
 assert.equal((await save('PIC TEST','First')).status,200)
 assert.equal((await save('SECOND PIC','Latest')).status,200)
 const record=await (await app.handle(req('/api/report-design'))).json()
 assert.equal(record.design.title,'Latest');assert.equal(record.savedBy,'SECOND PIC')
 assert.equal(record.design.theme,'green')
 assert.equal((await app.handle(req('/api/report-design',{method:'PUT',body:{pic:'PIC TEST',design:{showSummary:false,showDetail:false}}}))).status,400)
})

test('direct tarik update requires same origin, registered PIC and enabled edits', async () => {
 const {app,database}=appFixture()
 const payload={pic:'NOT REGISTERED',date:'2026-11-05',source:'REG',hour:'08:00',rows:[]}
 assert.equal((await app.handle(req('/api/tarik-update',{method:'POST',origin:'https://evil.example',body:payload}))).status,403)
 assert.equal((await app.handle(req('/api/tarik-update',{method:'POST',body:payload}))).status,403)
 database.tables.get('sapa_source_settings')[0].allow_pic_edits=false
 assert.equal((await app.handle(req('/api/tarik-update',{method:'POST',body:{...payload,pic:'PIC TEST'}}))).status,403)
})

test('analytics is admin-only and activity ingestion requires same-origin registered PIC',async()=>{
 const {app,database}=appFixture()
 assert.equal((await app.handle(req('/api/admin/analytics'))).status,401)
 const body={pic:'PIC TEST',events:[{id:'11111111-1111-4111-8111-111111111111',session:'22222222-2222-4222-8222-222222222222',action:'report_copy',feature:'hasil-laporan',units:5}]}
 assert.equal((await app.handle(req('/api/activity',{method:'POST',origin:'https://evil.example',body}))).status,403)
 assert.equal((await app.handle(req('/api/activity',{method:'POST',body:{...body,pic:'UNKNOWN'}}))).status,403)
 assert.equal((await app.handle(req('/api/activity',{method:'POST',body}))).status,200)
 const stored=database.tables.get('sapa_pic_activity')[0]
 assert.equal(stored[0].pic,'PIC TEST')
 assert.equal(stored[0].feature,'hasil-laporan')
})


test('OAuth refresh retries temporary failures once without disguising revoked grants or invalid clients', async () => {
  for (const failure of ['network', 429, 503]) {
    let calls = 0
    const oauth = createGoogleOAuth({ clientId:'test', clientSecret:'secret', fetchImpl:async () => {
      calls++
      if (calls === 1) {
        if (failure === 'network') throw new Error('network')
        return Response.json({error:'temporarily_unavailable'}, {status:failure})
      }
      return Response.json({access_token:'refreshed', expires_in:3600})
    } })
    assert.equal((await oauth.refresh('refresh')).access_token, 'refreshed')
    assert.equal(calls, 2)
  }
  for (const [error,code,status] of [['invalid_grant','GOOGLE_RECONNECT_REQUIRED',401],['invalid_client','GOOGLE_CLIENT_CONFIG',503],['temporarily_unavailable','GOOGLE_TEMPORARY',502]]) {
    let calls = 0
    const oauth = createGoogleOAuth({clientId:'test',fetchImpl:async () => {calls++;return Response.json({error,error_description:'secret diagnostic marker'},{status:error==='temporarily_unavailable'?503:400})}})
    await assert.rejects(oauth.refresh('refresh'), e => e.code===code && e.status===status && !e.message.includes('secret diagnostic marker'))
    assert.equal(calls, error==='temporarily_unavailable'?2:1)
  }
})

function seedGoogleConnection(database, tokens) {
  const row = {id:'main',email:'admin@example.com',updated_at:new Date(time-86400000).toISOString(),encrypted_tokens:tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY).seal(tokens,'google-connection')}
  database.tables.set('sapa_google_connection',[row])
  return row
}
const fakeSheetsResponse = url => Response.json(url.includes('?fields=')
  ? {sheets:['REG','DS'].map((key,i)=>({properties:{sheetId:i+1,title:`${key} 01/11`}}))}
  : url.includes('/values:batchGet') ? {valueRanges:[{values:[header,cells]},{values:[header,cells]}]}
  : {values:[header]})

test('overnight refresh is coalesced, encrypted and reused across cold server instances; rotated refresh token survives', async () => {
  let clock = time, refreshes = 0
  const {app,database,oauth} = appFixture({refresh:async token => {
    assert.equal(token,refreshes?'rotated-refresh':'original-refresh')
    refreshes++;return {access_token:`access-${refreshes}`,refresh_token:'rotated-refresh',expires_in:3600}
  }},{now:()=>clock})
  seedGoogleConnection(database,{refresh_token:'original-refresh'})
  const {cookie} = await login(app)
  const check = a => a.handle(req('/api/admin/settings?check=google',{cookie}))
  assert.equal((await check(app)).status,200)
  assert.equal((await (await check(app)).json()).status,'healthy')
  const saved=database.tables.get('sapa_google_connection')[0]
  assert.ok(!saved.encrypted_tokens.includes('rotated-refresh'))
  const decoded=tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY).open(saved.encrypted_tokens,'google-connection')
  assert.equal(decoded.refresh_token,'rotated-refresh')
  const cold=createGoogleApplication({env,database,oauth,now:()=>clock})
  assert.equal((await (await check(cold)).json()).status,'healthy')
  assert.equal(refreshes,1)
  clock+=12*3600000
  const results=await Promise.all([check(cold),check(cold),check(cold)])
  for(const response of results){const body=await response.text();assert.equal(JSON.parse(body).status,'healthy');assert.ok(!body.includes('access-'));assert.ok(!body.includes('refresh'))}
  assert.equal(refreshes,2)
})

test('Sheets 401 discards rejected cached access token and refreshes only once', async () => {
  let refreshes=0, rejectedCalls=0
  const {app,database}=appFixture({refresh:async()=>{refreshes++;return {access_token:'recovered-access',expires_in:3600}}},{fetchImpl:async(url,options)=>{
    if(options.headers.Authorization==='Bearer rejected-access'){rejectedCalls++;return Response.json({error:{}},{status:401})}
    assert.equal(options.headers.Authorization,'Bearer recovered-access')
    return fakeSheetsResponse(url)
  }})
  seedGoogleConnection(database,{refresh_token:'refresh',access_token:'rejected-access',access_until:time+3600000})
  const result=await app.sheets.monitoring({date:'2026-11-01'})
  assert.equal(result.rows.length,2);assert.equal(refreshes,1);assert.equal(rejectedCalls,1)
})

test('a second Sheets 401 stops recovery; uncertain write timeout is never sent twice', async () => {
  for(const scenario of ['rejected','write-timeout']){
    let refreshes=0, calls=0, writes=0
    const {app,database}=appFixture({refresh:async()=>{refreshes++;return {access_token:'fresh',expires_in:3600}}},{fetchImpl:async(url,options)=>{
      calls++
      if(scenario==='rejected')return Response.json({error:{}},{status:401})
      if(options.method==='POST'){writes++;throw new Error('network timeout')}
      return fakeSheetsResponse(url)
    }})
    seedGoogleConnection(database,{refresh_token:'refresh',access_token:'cached',access_until:time+3600000})
    if(scenario==='rejected'){
      await assert.rejects(app.sheets.monitoring({date:'2026-11-01'}),{code:'GOOGLE_AUTH_FAILED'})
      assert.equal(calls,2);assert.equal(refreshes,1)
    }else{
      await assert.rejects(app.sheets.updateOrder({source:'DS',date:'2026-11-01',mode:'daily',sheetRow:2,shipment:'TEST-SHIP',store:'TEST1',expected:{sheetStatus:'Proses'},changes:{sheetStatus:'Done'}},'PIC:PIC TEST'),{status:502})
      assert.equal(writes,1);assert.equal(refreshes,0)
      assert.equal(database.tables.get('sapa_sheet_audit')[0].outcome,'uncertain')
    }
  }
})

test('refresh cannot overwrite a newer admin connection even if the timestamp is unchanged', async () => {
  const database=memoryDatabase()
  const saved=seedGoogleConnection(database,{refresh_token:'old'})
  const oauth={refresh:async()=>{
    Object.assign(saved,{encrypted_tokens:tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY).seal({refresh_token:'new',access_token:'admin-access',access_until:time+3600000},'google-connection')})
    return {access_token:'stale-result',expires_in:3600}
  }}
  const app=createGoogleApplication({env,database,oauth,now:()=>time,fetchImpl:async(url,options)=>{assert.equal(options.headers.Authorization,'Bearer admin-access');return fakeSheetsResponse(url)}})
  assert.equal((await app.sheets.monitoring({date:'2026-11-01'})).rows.length,2)
  const stored=tokenCipher(env.SAPA_TOKEN_ENCRYPTION_KEY).open(saved.encrypted_tokens,'google-connection')
  assert.equal(stored.refresh_token,'new');assert.equal(stored.access_token,'admin-access')
})

test('Google health diagnosis requires admin, separates revoked grants and temporary failure without leaking tokens', async () => {
  for(const code of ['GOOGLE_RECONNECT_REQUIRED','GOOGLE_TEMPORARY']){
    const {app,database}=appFixture({refresh:async()=>{throw Object.assign(new Error('Safe recovery message'),{status:code==='GOOGLE_TEMPORARY'?502:401,code})}})
    seedGoogleConnection(database,{refresh_token:'private-marker'})
    assert.equal((await app.handle(req('/api/admin/settings?check=google'))).status,401)
    const {cookie}=await login(app)
    const response=await app.handle(req('/api/admin/settings?check=google',{cookie}))
    const text=await response.text(),body=JSON.parse(text)
    assert.equal(response.status,200);assert.equal(body.code,code)
    assert.equal(body.status,code==='GOOGLE_TEMPORARY'?'temporary_error':'reconnect_required')
    assert.ok(!text.includes('private-marker'));assert.ok(!text.includes('encrypted_tokens'))
  }
})

test('reconnecting Google preserves shared report design and contacts while invalidating monitoring cache', async () => {
  const {app,database}=appFixture()
  database.tables.set('sapa_source_cache',[
    {cache_key:'settings:followup-design',snapshot:{design:{title:'Saved team design'}}},
    {cache_key:'contacts:test:tab',snapshot:{contacts:[]}},
    {cache_key:'monitoring:daily:2026-11-01',snapshot:{rows:[]}},
  ])
  const {cookie}=await login(app)
  const start=await app.handle(req('/api/auth/connect',{cookie}))
  const state=new URL(start.headers.get('location')).searchParams.get('state')
  const response=await app.handle(req(`/api/auth/callback?state=${state}&code=test`,{cookie:`${cookie}; ${start.headers.get('set-cookie').split(';')[0]}`}))
  assert.equal(response.headers.get('location'),`${env.APP_ORIGIN}/admin`)
  assert.deepEqual(database.tables.get('sapa_source_cache').map(r=>r.cache_key),['settings:followup-design','contacts:test:tab'])
})
