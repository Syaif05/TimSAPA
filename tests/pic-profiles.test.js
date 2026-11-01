import test from 'node:test'
import assert from 'node:assert/strict'
import { createPicStorage } from '../src/profiles/api.js'
import { ProfileStore } from '../src/profiles/ProfileStore.js'
import { createProfileHandler, csvRows } from '../supabase/functions/pic-profiles/handler.js'
const memoryStorage = () => { const data = new Map(); return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) } }
function database() {
  const profiles = new Set(['ANA', 'SYAIFUL']); const records = new Map()
  return async (path, options = {}) => {
    const [table, search] = path.split('?'); const q = new URLSearchParams(search); const match = (field, value) => !q.has(field) || q.get(field) === `eq.${value}`
    if (table === 'sapa_pic_profiles') {
      if (options.method === 'POST') { profiles.add(options.body.name); return [] }
      return [...profiles].filter(name => match('name', name)).map(name => ({ name }))
    }
    if (options.method === 'POST') {
      const record = options.body; const key = `${record.pic_name}:${record.setting_key}`
      if (records.has(key)) throw Object.assign(new Error('duplicate'), { code: '23505' })
      records.set(key, structuredClone(record)); return [structuredClone(record)]
    }
    const found = [...records.values()].filter(r => match('pic_name', r.pic_name) && match('setting_key', r.setting_key) && match('revision', r.revision))
    if (options.method === 'PATCH') { for (const record of found) Object.assign(record, structuredClone(options.body)) }
    return structuredClone(found)
  }
}
function requestWith(handler) {
  return async (name, options = {}) => {
    const response = await handler(new Request(`https://example.com/pic-profiles${name ? `?name=${encodeURIComponent(name)}` : ''}`, { method: options.method || 'GET', headers: { apikey: 'public-app-key' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) }))
    const data = await response.json()
    if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status, current: data.current })
    return data
  }
}
test('profile API validates keys, rejects unknown PICs, and separates profiles', async () => {
  const handler = createProfileHandler({ database: database(), publicKey: 'public-app-key', roster: async () => ['BARU'] })
  assert.equal((await handler(new Request('https://example.com/'))).status, 401)
  const request = requestWith(handler)
  await assert.rejects(request('UNKNOWN', { method: 'POST' }), { status: 422 })
  assert.equal((await request('BARU', { method: 'POST' })).name, 'BARU')
  await request('ANA', { method: 'PATCH', body: { key: 'darkMode', value: true, expectedRevision: 0 } })
  assert.equal((await request('ANA')).records[0].value, true)
  assert.equal((await request('SYAIFUL')).records.length, 0)
  await assert.rejects(request('ANA', { method: 'PATCH', body: { key: 'admin', value: true, expectedRevision: 0 } }), { status: 400 })
  await assert.rejects(request('ANA', { method: 'PATCH', body: { key: 'darkMode', value: 'yes', expectedRevision: 0 } }), { status: 400 })
})
test('two devices sync settings and detect stale revisions before overwriting', async () => {
  const request = requestWith(createProfileHandler({ database: database(), publicKey: 'public-app-key', roster: async () => [] }))
  const make = async () => new ProfileStore({ name: 'ANA', records: (await request('ANA')).records, defaults: { podTemplate: 'default' }, request, storage: createPicStorage('ANA', memoryStorage()), debounce: 60000 })
  const a = await make(); const b = await make()
  a.set('podTemplate', 'Device A'); await a.flush()
  b.set('podTemplate', 'Device B')
  await assert.rejects(b.flush(), { status: 409 })
  assert.equal(b.state.phase, 'conflict')
  assert.equal((await request('ANA')).records[0].value, 'Device A')
  b.resolve(true); await b.flush(); await a.refresh()
  assert.equal(a.state.values.podTemplate, 'Device B')
  a.dispose(); b.dispose()
})
test('edits made during an in-flight save are retained and flushed before switch', async () => {
  let resolveFirst; let started
  const start = new Promise(r => { started = r }); let count = 0
  const store = new ProfileStore({ name: 'ANA', defaults: { podTemplate: '' }, storage: memoryStorage(), debounce: 60000,
    request: async (_name, { body }) => { count++; if (count === 1) { started(); await new Promise(r => { resolveFirst = r }) } return { record: { setting_key: body.key, value: body.value, revision: body.expectedRevision + 1 } } } })
  store.set('podTemplate', 'first'); const flush = store.flush(); await start
  store.set('podTemplate', 'second'); resolveFirst(); await flush
  assert.equal(count, 2); assert.equal(store.records.podTemplate.value, 'second'); assert.equal(store.pendingCount, 0)
  store.dispose()
})
test('unsaved drafts survive reload and remain scoped to the chosen PIC', async () => {
  const memory = memoryStorage(); const a = createPicStorage(' ANA ', memory); const b = createPicStorage('SYAIFUL', memory)
  a.setItem('local_status', 'ANA only'); assert.equal(b.getItem('local_status'), null)
  const failed = async () => { throw new Error('offline') }
  const store = new ProfileStore({ name: 'ANA', storage: a, request: failed, debounce: 60000 })
  store.set('podTemplate', 'draft'); await assert.rejects(store.flush()); store.dispose()
  const restored = new ProfileStore({ name: 'ANA', storage: a, request: failed, debounce: 60000 })
  assert.equal(restored.state.values.podTemplate, 'draft'); assert.equal(restored.pendingCount, 1)
  assert.equal(b.getItem('shared_drafts'), null); restored.dispose()
})
test('remote version resolution discards only the conflicting setting', async () => {
  const store = new ProfileStore({ name: 'ANA', storage: memoryStorage(), debounce: 60000, request: async () => { throw Object.assign(new Error('conflict'), { status: 409, current: { setting_key: 'podTemplate', revision: 4, value: 'remote' } }) } })
  store.set('podTemplate', 'mine'); store.set('darkMode', true); await assert.rejects(store.flush())
  store.resolve(false)
  assert.equal(store.state.values.podTemplate, 'remote'); assert.equal(store.state.values.darkMode, true); assert.equal(store.pendingCount, 1)
  store.dispose()
})
test('read-only roster parser accepts quoted cells and CRLF', () => {
  assert.deepEqual(csvRows('"PIC","Shipment"\r\n"A, B","S-1"\r\n"C""D","S-2"'), [['PIC', 'Shipment'], ['A, B', 'S-1'], ['C"D', 'S-2']])
})

test('daily sessions in both browser storage and IndexedDB stay isolated per PIC', async () => {
  const { readFile } = await import('node:fs/promises')
  let source = await readFile(new URL('../src/utils/sessionManager.js', import.meta.url), 'utf8')
  source = source.replace("import { db } from '../db/database'", `const entries = new Map(); const db = { daily_sessions: { put: async row => entries.set(row.date, structuredClone(row)), get: async key => entries.get(key), delete: async key => entries.delete(key) } };`)
  const { saveDailySession, loadDailySession, clearDailySession } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`)
  const memory = memoryStorage()
  const a = { pic: 'ANA', storage: createPicStorage('ANA', memory) }
  const b = { pic: 'SYAIFUL', storage: createPicStorage('SYAIFUL', memory) }
  await saveDailySession('2026-10-31', [{ shipment: 'ANA-order' }], { ac: 'sent' }, a)
  await saveDailySession('2026-10-31', [{ shipment: 'SYAIFUL-order' }], {}, b)
  a.storage.removeItem('sapa_session_2026-10-31'); b.storage.removeItem('sapa_session_2026-10-31')
  assert.equal((await loadDailySession('2026-10-31', a)).rawRows[0].shipment, 'ANA-order')
  assert.equal((await loadDailySession('2026-10-31', b)).rawRows[0].shipment, 'SYAIFUL-order')
  await clearDailySession('2026-10-31', a)
  assert.equal((await loadDailySession('2026-10-31', a)).rawRows.length, 0)
  assert.equal((await loadDailySession('2026-10-31', b)).rawRows[0].shipment, 'SYAIFUL-order')
})
