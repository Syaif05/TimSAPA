import React, { createContext, useContext, useEffect, useState } from 'react'
import { ArrowLeft, Check, Cloud, LockKeyhole, LogOut, RefreshCw } from 'lucide-react'
const SourceContext = createContext({ canEdit: false })
export const useSourceAccess = () => useContext(SourceContext)
export async function sourceRequest(path, options = {}) {
  const response = await fetch(path, { ...options, cache: 'no-store', signal: AbortSignal.timeout(45000), headers: { 'Content-Type': 'application/json', ...options.headers }, ...(options.body ? { body: JSON.stringify(options.body) } : {}) })
  if (!response.headers.get('content-type')?.includes('application/json')) throw new Error('Layanan server belum tersedia.')
  const data = await response.json()
  if (!response.ok) throw new Error(data.error || 'Permintaan gagal.')
  return data
}
export function GoogleSourceProvider({ children }) {
  const [state, setState] = useState({ canEdit: false })
  useEffect(() => {
    let disposed = false
    const refresh = () => { if (!document.hidden) sourceRequest('/api/session').then(data => { if (!disposed) setState(data) }).catch(() => { if (!disposed) setState({ canEdit: false }) }) }
    refresh(); const timer = setInterval(refresh, 30000)
    document.addEventListener('visibilitychange', refresh)
    return () => { disposed = true; clearInterval(timer); document.removeEventListener('visibilitychange', refresh) }
  }, [])
  return <SourceContext.Provider value={state}>{children}</SourceContext.Provider>
}
// Separate URL, deliberately absent from PIC navigation. The server is the security boundary.
export function GoogleAdmin() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('error') || '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [audit, setAudit] = useState(null)
  const [contactsUrl, setContactsUrl] = useState('')
  const [contactsSheet, setContactsSheet] = useState('KONTAK TOKO BARU')
  const refresh = async () => {
    setBusy(true)
    try { setState(await sourceRequest('/api/session')) } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  useEffect(() => { refresh(); if (location.search) history.replaceState(null, '', '/admin') }, [])
  useEffect(() => { setContactsUrl(state?.contactsSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${state.contactsSpreadsheetId}/edit` : ''); setContactsSheet(state?.contactsSheet || 'KONTAK TOKO BARU') }, [state?.contactsSpreadsheetId, state?.contactsSheet])
  const saveContacts = async event => {
    event.preventDefault(); setError(''); setBusy(true); setSaved(false)
    try {
      let sourceId = ''
      if (contactsUrl.trim()) {
        const url = new URL(contactsUrl.trim())
        const match = url.pathname.match(/^\/spreadsheets\/d\/([\w-]{20,120})(?:\/|$)/)
        if (url.protocol !== 'https:' || url.hostname !== 'docs.google.com' || !match) throw new Error('Gunakan tautan Google Sheets yang valid.')
        sourceId = match[1]
      }
      await sourceRequest('/api/admin/settings', { method: 'PUT', body: { contactsSpreadsheetId: sourceId, contactsSheet } })
      setSaved(true); await refresh()
    } catch (e) { setError(e.message === 'Invalid URL' ? 'Tautan Google Sheets tidak valid.' : e.message) }
    finally { setBusy(false) }
  }
  const toggle = async () => {
    setBusy(true); setError(''); setSaved(false)
    try { await sourceRequest('/api/admin/settings', { method: 'PUT', body: { allowPicEdits: !state.allowPicEdits } }); setSaved(true); await refresh() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return <main className="profile-entry google-admin-page">
    <section className="profile-picker google-admin-card">
      <div className="profile-eyebrow"><LockKeyhole size={15}/> SAPA ADMIN</div>
      <h1>Pengelola sumber.</h1>
      {state?.admin ? <>
        <p className="admin-email">{state.email}</p>
        <div className="admin-source-card"><Cloud size={21}/><div><strong>{state.connected ? 'Google terhubung' : 'Hubungkan spreadsheet'}</strong><p>{state.connectedEmail || 'Satu akun untuk semua PIC.'}</p></div>{state.connected && <Check size={18}/>}</div>
        <a className="profile-enter" href="/api/auth/connect">{state.connected ? 'Hubungkan ulang Google' : 'Hubungkan Google Sheets'}</a>
        <label className="admin-edit-toggle"><span><strong>Edit oleh PIC</strong><small>Status &amp; Kendala</small></span><input type="checkbox" checked={!!state.allowPicEdits} disabled={busy} onChange={toggle}/></label>
        <form className="admin-contact-source" onSubmit={saveContacts}><label>Tautan kontak Google Sheets<input type="url" value={contactsUrl} placeholder="https://docs.google.com/spreadsheets/d/…" disabled={busy} onChange={e => setContactsUrl(e.target.value)}/></label><label>Nama tab kontak<input value={contactsSheet} maxLength={150} required disabled={busy} onChange={e => setContactsSheet(e.target.value)}/></label><p>Kosongkan tautan untuk memakai Excel sumber lama.</p><button className="secondary-button" disabled={busy} type="submit">Simpan sumber kontak</button></form>
        {saved && <p role="status" className="admin-saved">Pengaturan tersimpan.</p>}
        <button className="secondary-button" disabled={busy} onClick={async () => { setBusy(true); try { setAudit((await sourceRequest('/api/admin/audit')).changes) } catch (e) { setError(e.message) } finally { setBusy(false) } }}>Riwayat perubahan</button>
        {audit && <div className="admin-audit">{audit.length ? audit.map(item => <p key={item.id}><strong>{item.source} · {item.shipment}</strong><br/>{item.actor} · {item.outcome}<br/>{new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</p>) : <p>Belum ada perubahan.</p>}</div>}
        <button className="secondary-button" disabled={busy} onClick={async () => { setBusy(true); try { await sourceRequest('/api/auth/logout', { method: 'POST', body: {} }); await refresh() } catch (e) { setError(e.message) } finally { setBusy(false) } }}><LogOut size={15}/> Keluar admin</button>
      </> : <>
        <p>Masuk dengan akun Google tepercaya.</p>
        {state?.configured && state.enabled && state.backendReady ? <a className="profile-enter" href="/api/auth/login"><LockKeyhole size={16}/> Masuk dengan Google</a> : <div className="admin-setup" role="status"><strong>{!state ? 'Memeriksa koneksi…' : !state.configured ? 'Konfigurasi Google belum lengkap' : !state.enabled ? 'Koneksi Google belum diaktifkan' : 'Koneksi Supabase perlu diperbaiki'}</strong>{state && <><p>{!state.configured ? `Belum terisi: ${(state.missing || []).join(', ') || 'periksa konfigurasi server'}.` : !state.enabled ? 'Ubah SAPA_GOOGLE_ENABLED=true di .env.local, lalu jalankan ulang server.' : state.backendError || 'Periksa koneksi server ke Supabase, lalu tekan tombol periksa koneksi.'}</p><a href="/panduan-google.html" target="_blank" rel="noreferrer">Buka tutorial Google Cloud ↗</a></>}</div>}
      </>}
      {error && <div className="profile-error" role="alert">{error}</div>}
      <div className="admin-footer"><a href="/"><ArrowLeft size={14}/> Monitoring</a><button className="icon-button" aria-label="Periksa koneksi admin" disabled={busy} onClick={() => { setError(''); refresh() }}><RefreshCw size={16}/></button></div>
    </section>
  </main>
}
