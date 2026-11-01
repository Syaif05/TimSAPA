import { createProfileHandler, createRosterReader } from './handler.js'
const url = Deno.env.get('SUPABASE_URL')!
const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const publicKey = 'sb_publishable_Js7t_mGTLdc-D6bUziKl6A_zVjHWBgu'
const database = async (path: string, options: { method?: string; body?: unknown; prefer?: string } = {}) => {
  const response = await fetch(`${url}/rest/v1/${path}`, {
    method: options.method || 'GET', signal: AbortSignal.timeout(15000),
    headers: { apikey: secret, Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json', Prefer: options.prefer || 'return=minimal' },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  })
  const text = await response.text()
  const data = text ? JSON.parse(text) : []
  if (!response.ok) throw Object.assign(new Error('Database request failed'), { code: data.code })
  return data
}
Deno.serve(createProfileHandler({ database, publicKey, roster: createRosterReader() }))
