import { randomUUID } from 'node:crypto'
import { SPREADSHEET_ID } from '../src/utils/sheetsConfig.js'
import { queryPath } from './cloudDatabase.js'
import { httpError } from './googleOAuth.js'

// Cooperates with Tarik Data and carry-forward across server instances.
export async function withSheetWriteLock(database, now, work) {
  const key = `lock:tarik:${SPREADSHEET_ID}`, token = randomUUID()
  await database(queryPath('sapa_source_cache', { cache_key: `eq.${key}`, expires_at: `lt.${new Date(now()).toISOString()}` }), { method: 'DELETE' })
  const lock = await database('sapa_source_cache?on_conflict=cache_key', { method: 'POST', body: { cache_key: key, snapshot: { token }, expires_at: new Date(now() + 600000).toISOString() }, prefer: 'resolution=ignore-duplicates,return=representation' })
  if (!lock?.length) throw httpError(409, 'Update spreadsheet lain sedang berjalan. Perbarui data lalu coba kembali.')
  let uncertain = false
  try { return await work(value => { uncertain = value }) }
  finally {
    if (!uncertain) await database(queryPath('sapa_source_cache', { cache_key: `eq.${key}`, 'snapshot->>token': `eq.${token}` }), { method: 'DELETE' }).catch(() => {})
  }
}
