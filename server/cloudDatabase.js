import { httpError } from './googleOAuth.js'
export function createCloudDatabase(env, fetchImpl = fetch) {
  return async (path, { method = 'GET', body, prefer = 'return=representation' } = {}) => {
    if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw httpError(503, 'Penyimpanan server belum disiapkan.')
    let response
    try {
      response = await fetchImpl(`${env.SUPABASE_URL}/rest/v1/${path}`, { method, signal: AbortSignal.timeout(15000), headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, 'Content-Type': 'application/json', Prefer: prefer }, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) })
    } catch (error) {
      const code = error.cause?.code || error.code
      if (['UNABLE_TO_VERIFY_LEAF_SIGNATURE', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'SELF_SIGNED_CERT_IN_CHAIN', 'CERT_HAS_EXPIRED'].includes(code)) throw httpError(502, 'Sertifikat HTTPS koneksi server ke Supabase tidak dipercaya. Coba jaringan lain atau perbaiki CA jaringan bersama administrator; jangan menonaktifkan verifikasi HTTPS.')
      throw httpError(502, 'Server belum dapat menjangkau Supabase. Periksa jaringan lalu coba lagi.')
    }
    const text = await response.text(); const data = text ? JSON.parse(text) : []
    if (!response.ok) throw Object.assign(httpError(502, [401, 403].includes(response.status) ? 'Kunci server Supabase ditolak. Periksa SUPABASE_SERVICE_ROLE_KEY di konfigurasi server.' : ['42P01', 'PGRST205'].includes(data.code) ? 'Tabel koneksi Google belum tersedia di Supabase. Periksa pemasangan schema.' : 'Penyimpanan server belum merespons.'), { code: data.code })
    return data
  }
}
export const queryPath = (table, params) => `${table}?${new URLSearchParams(params)}`
