export async function sourceRequest(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(45000), headers: { 'Content-Type': 'application/json', ...options.headers }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Layanan server belum tersedia.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.')
  return data
}
