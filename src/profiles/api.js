const ENDPOINT = 'https://tsbbgeodukscvzixivjf.supabase.co/functions/v1/pic-profiles'
const PUBLIC_KEY = 'sb_publishable_Js7t_mGTLdc-D6bUziKl6A_zVjHWBgu'
export const normalizePic = name => String(name || '').trim().replace(/\s+/g, ' ').toUpperCase()
export async function profileRequest(name = '', options = {}) {
  const url = new URL(ENDPOINT)
  if (name) url.searchParams.set('name', normalizePic(name))
  const response = await fetch(url, { ...options, signal: options.signal || AbortSignal.timeout(20000), cache: 'no-store', headers: { apikey: PUBLIC_KEY, 'Content-Type': 'application/json' }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
  const data = await response.json()
  if (!response.ok) throw Object.assign(new Error(data.error || 'Sinkronisasi profil gagal.'), { status: response.status, current: data.current })
  return data
}
export function createPicStorage(name, storage = localStorage) {
  const prefix = `sapa_pic:${encodeURIComponent(normalizePic(name))}:`
  return { getItem: key => storage.getItem(prefix + key), setItem: (key, value) => storage.setItem(prefix + key, value), removeItem: key => storage.removeItem(prefix + key), prefix }
}
