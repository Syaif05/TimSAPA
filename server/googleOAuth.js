import { createCipheriv, createDecipheriv, createHash, createPublicKey, randomBytes, verify } from 'node:crypto'

export const SHEETS_SCOPE = 'https://www.googleapis.com/auth/spreadsheets'
export const digest = value => createHash('sha256').update(value).digest('hex')
export const randomToken = () => randomBytes(32).toString('base64url')
export const normalizeEmail = value => String(value || '').trim().toLowerCase()
export const httpError = (status, message) => Object.assign(new Error(message), { status })

export function tokenCipher(secret) {
  const key = Buffer.from(secret || '', 'base64')
  if (key.length !== 32) throw httpError(503, 'Kunci enkripsi server belum disiapkan.')
  return {
    seal(value, purpose) {
      const iv = randomBytes(12)
      const cipher = createCipheriv('aes-256-gcm', key, iv)
      cipher.setAAD(Buffer.from(purpose))
      const data = Buffer.concat([cipher.update(JSON.stringify(value)), cipher.final()])
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url')
    },
    open(value, purpose) {
      try {
        const data = Buffer.from(value, 'base64url')
        const decipher = createDecipheriv('aes-256-gcm', key, data.subarray(0, 12))
        decipher.setAAD(Buffer.from(purpose)); decipher.setAuthTag(data.subarray(12, 28))
        return JSON.parse(Buffer.concat([decipher.update(data.subarray(28)), decipher.final()]).toString())
      } catch { throw httpError(401, 'Sesi tidak valid. Silakan masuk kembali.') }
    },
  }
}

// Verify the Google signature and OIDC claims locally, using Google's rotating JWKS.
// Never accept an email or role supplied by the browser as proof of identity.
export function createGoogleOAuth({ clientId, clientSecret, redirectUri, fetchImpl = fetch, now = () => Date.now() }) {
  let keys = []; let keysUntil = 0
  async function json(url, options = {}, refresh = false) {
    for(let attempt=0;attempt<(refresh?2:1);attempt++) {
      let response, data
      try { response=await fetchImpl(url,{...options,signal:AbortSignal.timeout(20000)});data=await response.json() }
      catch { if(refresh && attempt===0)continue;throw Object.assign(httpError(502,'Google belum merespons. Coba Periksa ulang; akun tidak perlu dihubungkan ulang untuk gangguan sementara.'),{code:'GOOGLE_TEMPORARY',retryable:true}) }
      if(response.ok)return data
      if(refresh && (response.status===429||response.status>=500) && attempt===0)continue
      const code=data?.error
      if(code==='invalid_grant' && !refresh)throw Object.assign(httpError(401,'Kode otorisasi Google kedaluwarsa atau sudah dipakai. Ulangi proses masuk atau Hubungkan Google.'),{code:'GOOGLE_AUTH_CODE_EXPIRED',retryable:false})
      if(code==='invalid_grant')throw Object.assign(httpError(401,'Izin Google pengelola sudah kedaluwarsa atau dicabut. Super admin perlu Hubungkan ulang Google di /admin. Jika OAuth masih Testing, ubah ke In production agar token baru tidak dibatasi 7 hari.'),{code:'GOOGLE_RECONNECT_REQUIRED',retryable:false})
      if(['invalid_client','unauthorized_client'].includes(code))throw Object.assign(httpError(503,'Konfigurasi OAuth Google server ditolak. Super admin perlu memeriksa Client ID/Secret; login ulang saja tidak menyelesaikannya.'),{code:'GOOGLE_CLIENT_CONFIG',retryable:false})
      if(response.status===429||response.status>=500)throw Object.assign(httpError(502,'Layanan Google sedang bermasalah atau dibatasi. Coba Periksa ulang beberapa saat lagi.'),{code:'GOOGLE_TEMPORARY',retryable:true})
      throw Object.assign(httpError(401,'Otorisasi Google gagal. Super admin perlu menghubungkan ulang akun Google.'),{code:'GOOGLE_AUTH_FAILED',retryable:false})
    }
  }
  async function verifyIdToken(jwt, nonce) {
    try {
      if (typeof jwt !== 'string' || jwt.length > 20000) throw new Error()
      const parts = jwt.split('.')
      if (parts.length !== 3) throw new Error()
      const header = JSON.parse(Buffer.from(parts[0], 'base64url'))
      const claims = JSON.parse(Buffer.from(parts[1], 'base64url'))
      if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error()
      if (now() >= keysUntil || !keys.some(key => key.kid === header.kid)) {
        const data = await json('https://www.googleapis.com/oauth2/v3/certs')
        keys = data.keys || []; keysUntil = now() + 300000
      }
      const jwk = keys.find(key => key.kid === header.kid && key.kty === 'RSA' && key.use === 'sig')
      if (!jwk || !verify('RSA-SHA256', Buffer.from(`${parts[0]}.${parts[1]}`), createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(parts[2], 'base64url'))) throw new Error()
      const seconds = now() / 1000
      if (!['accounts.google.com', 'https://accounts.google.com'].includes(claims.iss) || claims.aud !== clientId || (claims.azp && claims.azp !== clientId)) throw new Error()
      if (!Number.isFinite(claims.exp) || claims.exp <= seconds || !Number.isFinite(claims.iat) || claims.iat > seconds + 60 || claims.nonce !== nonce) throw new Error()
      if (claims.email_verified !== true || !claims.sub || typeof claims.sub !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(claims.email || '')) throw new Error()
      return { sub: claims.sub, email: normalizeEmail(claims.email) }
    } catch (error) {
      if (error.status === 502) throw error
      throw httpError(401, 'Identitas Google tidak dapat diverifikasi. Silakan masuk kembali.')
    }
  }
  return {
    authorization({ state, nonce, verifier, connect = false, email }) {
      const url = new URL('https://accounts.google.com/o/oauth2/v2/auth')
      url.search = new URLSearchParams({ client_id: clientId, redirect_uri: redirectUri, response_type: 'code', scope: `openid email profile${connect ? ` ${SHEETS_SCOPE}` : ''}`, state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', ...(connect ? { access_type: 'offline', prompt: 'consent', login_hint: email } : { prompt: 'select_account' }) }).toString()
      return url.toString()
    },
    async exchange(code, verifier, nonce) {
      const data = await json('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, code, code_verifier: verifier, grant_type: 'authorization_code' }) })
      return { identity: await verifyIdToken(data.id_token, nonce), tokens: data }
    },
    async refresh(refreshToken) {
      return json('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: 'refresh_token' }) }, true)
    },
    verifyIdToken,
  }
}
