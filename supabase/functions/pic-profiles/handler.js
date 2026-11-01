const KEYS = new Set(['templates', 'activeTemplateKey', 'tableSettings', 'statuses', 'darkMode', 'podTemplate', 'podDelay', 'podUseSameTab', 'podSoundEnabled'])
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, PATCH, OPTIONS', 'Cache-Control': 'no-store', 'Content-Type': 'application/json' }
const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers: CORS })
const normalize = name => typeof name === 'string' ? name.trim().replace(/\s+/g, ' ').toUpperCase() : ''
export function validSetting(key, value) {
  if (!KEYS.has(key) || value == null || JSON.stringify(value).length > 180000) return false
  if (['darkMode', 'podUseSameTab', 'podSoundEnabled'].includes(key)) return typeof value === 'boolean'
  if (key === 'podDelay') return Number.isFinite(value) && value >= 2 && value <= 300
  if (key === 'podTemplate') return typeof value === 'string' && value.length <= 20000
  if (key === 'activeTemplateKey') return /^template_[1-4]$/.test(value)
  if (key === 'statuses') return Array.isArray(value) && value.length > 0 && value.length <= 40 && value.every(s => s && /^[a-zA-Z0-9_-]{1,80}$/.test(s.id) && typeof s.label === 'string' && typeof s.shortLabel === 'string' && typeof s.countsAsCompleted === 'boolean')
  if (key === 'templates') return typeof value === 'object' && !Array.isArray(value) && ['template_1', 'template_2', 'template_3', 'template_4'].every(k => value[k] && typeof value[k].name === 'string' && typeof value[k].content === 'string' && value[k].content.length <= 20000)
  if (key === 'tableSettings') {
    if (typeof value !== 'object' || Array.isArray(value)) return false
    if (!['columns', 'colors', 'sla', 'typography'].every(k => value[k] && typeof value[k] === 'object' && !Array.isArray(value[k]))) return false
    if (!Number.isFinite(value.exportScale) || value.exportScale < 0.5 || value.exportScale > 4) return false
    if (!Object.values(value.columns).every(c => c && typeof c.visible === 'boolean' && typeof c.label === 'string' && c.label.length <= 150)) return false
    return Object.values(value.colors).every(color => typeof color === 'string' && /^#[a-f0-9]{3,8}$/i.test(color))
  }
  return false
}
import { monitoringHeader } from './sheetHeader.js'
// CSV parser for the read-only PIC roster; handles quoted commas and line breaks.
export function csvRows(text) {
  const rows = []; let row = []; let field = ''; let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (ch === '"') { if (quoted && text[i + 1] === '"') { field += '"'; i++ } else quoted = !quoted }
    else if (ch === ',' && !quoted) { row.push(field); field = '' }
    else if ((ch === '\n' || ch === '\r') && !quoted) { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(field); rows.push(row); row = []; field = '' }
    else field += ch
  }
  if (field || row.length) { row.push(field); rows.push(row) }
  return rows
}
export function createRosterReader(fetchImpl = fetch, now = () => new Date()) {
  let cached; let pending
  return async () => {
    const date = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', day: '2-digit', month: '2-digit' }).format(now())
    if (cached?.date === date && Date.now() - cached.time < 60000) return cached.names
    if (pending) return pending
    pending = Promise.all(['REG', 'DS'].map(async source => {
      const url = new URL('https://docs.google.com/spreadsheets/d/1MxYuZs7ayhRas9BvmPIP3oCeTGh4fIgtgUFmKAC4FKc/gviz/tq')
      url.search = new URLSearchParams({ tqx: 'out:csv', sheet: `${source} ${date}`, headers: '0', range: 'A:V' }).toString()
      const response = await fetchImpl(url, { signal: AbortSignal.timeout(25000) })
      if (!response.ok || !response.headers.get('content-type')?.includes('text/csv')) throw new Error('Daftar PIC dari spreadsheet belum dapat dibaca.')
      const rows = csvRows(await response.text())
      const headerIndex = rows.slice(0, 25).findIndex(row => monitoringHeader(row))
      if (headerIndex < 0) throw new Error('Kolom PIC tidak ditemukan.')
      const col = monitoringHeader(rows[headerIndex]).pic
      return rows.slice(headerIndex + 1).map(row => normalize(row[col])).filter(name => name && name.length <= 80)
    })).then(groups => { cached = { date, time: Date.now(), names: [...new Set(groups.flat())].sort() }; return cached.names })
    try { return await pending } finally { pending = null }
  }
}
export function createProfileHandler({ database, publicKey, roster }) {
  return async request => {
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
    // A publishable app key identifies the app; PIC selection is intentionally shared, without passwords.
    if (!publicKey || request.headers.get('apikey') !== publicKey) return json({ error: 'Kunci aplikasi tidak valid.' }, 401)
    if (!['GET', 'POST', 'PATCH'].includes(request.method)) return json({ error: 'Metode tidak tersedia.' }, 405)
    try {
      const url = new URL(request.url)
      const name = normalize(url.searchParams.get('name'))
      if (!name && request.method === 'GET') {
        const profiles = await database('sapa_pic_profiles?select=name&order=name.asc')
        return json({ profiles: profiles.map(p => p.name) })
      }
      if (!name || name.length > 80 || /[\u0000-\u001f]/.test(name)) return json({ error: 'Nama PIC tidak valid.' }, 400)
      const filter = new URLSearchParams({ name: `eq.${name}`, select: 'name' })
      let profiles = await database(`sapa_pic_profiles?${filter}`)
      if (!profiles.length && request.method === 'POST') {
        const available = await roster()
        if (!available.includes(name)) return json({ error: 'PIC belum terdaftar pada spreadsheet hari ini.' }, 422)
        await database('sapa_pic_profiles?on_conflict=name', { method: 'POST', body: { name }, prefer: 'resolution=ignore-duplicates' })
        profiles = [{ name }]
      }
      if (!profiles.length) return json({ error: 'Profil PIC belum tersedia.' }, 404)
      const query = new URLSearchParams({ pic_name: `eq.${name}`, select: 'setting_key,value,revision,updated_at' })
      if (request.method !== 'PATCH') return json({ name, records: await database(`sapa_pic_settings?${query}`) })
      if (Number(request.headers.get('content-length') || 0) > 200000) return json({ error: 'Pengaturan terlalu besar.' }, 413)
      const text = await request.text()
      if (new TextEncoder().encode(text).length > 200000) return json({ error: 'Pengaturan terlalu besar.' }, 413)
      let body
      try { body = JSON.parse(text) } catch { return json({ error: 'Format pengaturan tidak valid.' }, 400) }
      const { key, value, expectedRevision } = body
      if (!validSetting(key, value) || !Number.isSafeInteger(expectedRevision) || expectedRevision < 0 || expectedRevision >= 2147483647) return json({ error: 'Nilai pengaturan tidak valid.' }, 400)
      const updated_at = new Date().toISOString()
      let result
      if (expectedRevision === 0) {
        try { result = await database('sapa_pic_settings', { method: 'POST', body: { pic_name: name, setting_key: key, value, revision: 1, updated_at }, prefer: 'return=representation' }) }
        catch (error) { if (error.code !== '23505') throw error; result = [] }
      } else {
        query.set('setting_key', `eq.${key}`); query.set('revision', `eq.${expectedRevision}`)
        result = await database(`sapa_pic_settings?${query}`, { method: 'PATCH', body: { value, revision: expectedRevision + 1, updated_at }, prefer: 'return=representation' })
      }
      if (!result.length) {
        query.delete('revision'); query.set('setting_key', `eq.${key}`)
        const current = (await database(`sapa_pic_settings?${query}`))[0] || null
        return json({ error: 'Pengaturan ini berubah di perangkat lain.', current }, 409)
      }
      return json({ record: result[0] })
    } catch (error) {
      console.error('pic-profiles:', error.code || error.message)
      return json({ error: 'Penyimpanan bersama belum merespons. Coba lagi.' }, 502)
    }
  }
}
