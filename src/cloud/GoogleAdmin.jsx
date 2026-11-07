import { AdminAnalytics } from './AdminAnalytics'
import React, { createContext, useContext, useEffect, useState } from 'react'
import { ArrowLeft, ArrowUpRight, Check, ChevronRight, Cloud, ContactRound, Database, History, LayoutDashboard, LockKeyhole, LogOut, RefreshCw, ShieldCheck } from 'lucide-react'
const SourceContext = createContext({ canEdit: false })
export const useSourceAccess = () => useContext(SourceContext)
import { sourceRequest } from './sourceRequest'
export { sourceRequest } from './sourceRequest'
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
const adminSections = [
  { id: 'overview', label: 'Ringkasan', icon: LayoutDashboard, description: 'Aktivitas tim, penggunaan fitur dan perbandingan PIC' },
  { id:'system',label:'Status sistem',icon:Cloud,description:'Koneksi dan pintasan pengelolaan' },
  { id: 'source', label: 'Sumber data', icon: Database, description: 'Koneksi Google untuk Monitoring' },
  { id: 'contacts', label: 'Kontak', icon: ContactRound, description: 'Sumber kontak dan pembaruan cache' },
  { id: 'access', label: 'Akses PIC', icon: ShieldCheck, description: 'Izin perubahan data Monitoring' },
  { id: 'audit', label: 'Riwayat', icon: History, description: 'Aktivitas perubahan pesanan' },
]
const initialPage = () => adminSections.some(section => section.id === new URLSearchParams(location.search).get('page')) ? new URLSearchParams(location.search).get('page') : 'overview'

export function GoogleAdmin() {
  const [state, setState] = useState(null)
  const [error, setError] = useState(() => new URLSearchParams(location.search).get('error') || '')
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState(false)
  const [audit, setAudit] = useState(null)
  const [contactsUrl, setContactsUrl] = useState('')
  const [contactsSheet, setContactsSheet] = useState('KONTAK TOKO BARU')
  const [contactsRefresh, setContactsRefresh] = useState(null)
  const [page, setPage] = useState(initialPage)
  const refresh = async () => {
    setBusy(true)
    try { setState(await sourceRequest('/api/session')) } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  useEffect(() => {
    refresh()
    const params = new URLSearchParams(location.search)
    if (params.has('error')) { params.delete('error'); history.replaceState(null, '', `/admin${params.size ? `?${params}` : ''}`) }
    const syncPage = () => setPage(initialPage())
    window.addEventListener('popstate', syncPage)
    return () => window.removeEventListener('popstate', syncPage)
  }, [])
  useEffect(() => { setContactsUrl(state?.contactsSpreadsheetId ? `https://docs.google.com/spreadsheets/d/${state.contactsSpreadsheetId}/edit` : ''); setContactsSheet(state?.contactsSheet || 'KONTAK TOKO BARU') }, [state?.contactsSpreadsheetId, state?.contactsSheet])
  const navigate = next => {
    setPage(next); setError(''); setSaved(false)
    const params = new URLSearchParams(location.search)
    params.delete('error')
    if (next === 'overview') params.delete('page'); else params.set('page', next)
    history.pushState(null, '', `/admin${params.size ? `?${params}` : ''}`)
  }
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
  const refreshContacts = async () => {
    setBusy(true); setError(''); setContactsRefresh(null)
    try { setContactsRefresh(await sourceRequest('/api/admin/contacts/refresh', { method: 'POST', body: {} })) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const loadAudit = async () => {
    setBusy(true); setError('')
    try { setAudit((await sourceRequest('/api/admin/audit')).changes) }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const signOut = async () => {
    setBusy(true); setError('')
    try { await sourceRequest('/api/auth/logout', { method: 'POST', body: {} }); setState(null); navigate('overview'); await refresh() }
    catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  const section = adminSections.find(item => item.id === page) || adminSections[0]
  if (!state?.admin) return <main className="admin-login"><div className="admin-login-card">
    <div className="admin-brand-mark">S</div><div className="admin-eyebrow">SAPA · ADMIN CONSOLE</div>
    <h1>Kelola SAPA dari satu tempat.</h1><p>Masuk dengan akun admin untuk mengatur sumber data, kontak, izin PIC, dan melihat riwayat perubahan.</p>
    {state?.configured && state.enabled && state.backendReady ? <a className="admin-button admin-button-primary" href="/api/auth/login"><LockKeyhole size={17}/> Masuk dengan Google <ArrowUpRight size={16}/></a> : <div className="admin-setup" role="status"><strong>{!state ? 'Memeriksa koneksi…' : !state.configured ? 'Konfigurasi Google belum lengkap' : !state.enabled ? 'Koneksi Google belum diaktifkan' : 'Koneksi Supabase perlu diperbaiki'}</strong>{state && <><p>{!state.configured ? `Belum terisi: ${(state.missing || []).join(', ') || 'periksa konfigurasi server'}.` : !state.enabled ? 'Ubah SAPA_GOOGLE_ENABLED=true di .env.local, lalu jalankan ulang server.' : state.backendError || 'Periksa koneksi server ke Supabase, lalu tekan tombol periksa koneksi.'}</p><a href="/panduan-google.html" target="_blank" rel="noreferrer">Buka tutorial Google Cloud ↗</a></>}</div>}
    {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
    <div className="admin-login-footer"><a href="/"><ArrowLeft size={15}/> Kembali ke Monitoring</a><button type="button" onClick={refresh} disabled={busy}><RefreshCw size={15}/> Periksa ulang</button></div>
  </div></main>
  return <main className="admin-shell">
    <aside className="admin-sidebar" aria-label="Navigasi admin">
      <div className="admin-sidebar-brand"><div className="admin-brand-mark">S</div><div><strong>SAPA</strong><span>Admin Console</span></div></div>
      <div className="admin-sidebar-label">WORKSPACE</div>
      <nav className="admin-nav" aria-label="Halaman admin">{adminSections.map(item => { const Icon = item.icon; return <button key={item.id} type="button" className={page === item.id ? 'active' : ''} aria-current={page === item.id ? 'page' : undefined} onClick={() => navigate(item.id)}><Icon size={18}/><span>{item.label}</span><ChevronRight className="admin-nav-chevron" size={15}/></button> })}</nav>
      <div className="admin-sidebar-bottom"><div className="admin-user-avatar">{(state.email || 'A').slice(0, 1).toUpperCase()}</div><div className="admin-user-meta"><strong>Super admin</strong><span title={state.email}>{state.email}</span></div></div>
    </aside>
    <div className="admin-main">
      <header className="admin-topbar"><div className="admin-mobile-brand"><div className="admin-brand-mark">S</div><strong>SAPA Admin</strong></div><span className="admin-breadcrumb">Admin <ChevronRight size={14}/> {section.label}</span><div className="admin-top-actions"><a href="/" className="admin-top-link"><ArrowLeft size={15}/> Monitoring</a><button type="button" className="admin-icon-button" aria-label="Periksa status admin" title="Periksa status admin" disabled={busy} onClick={() => { setError(''); refresh() }}><RefreshCw size={17}/></button><button type="button" className="admin-icon-button" aria-label="Keluar admin" title="Keluar admin" disabled={busy} onClick={signOut}><LogOut size={17}/></button></div></header>
      <div className="admin-content"><div className="admin-page-heading"><div><div className="admin-eyebrow">PENGELOLAAN SAPA</div><h1>{section.label}</h1><p>{section.description}</p></div><span className="admin-role-badge"><LockKeyhole size={13}/> Super admin</span></div>
        {error && <div className="admin-alert admin-alert-error" role="alert">{error}</div>}
        {saved && <div className="admin-alert admin-alert-success" role="status"><Check size={16}/> Pengaturan tersimpan.</div>}
        {page === 'overview' && <AdminAnalytics/>}
        {page === 'system' && <><div className="admin-stat-grid">
          <button className="admin-stat-card" onClick={() => navigate('source')}><div className="admin-stat-icon blue"><Cloud size={20}/></div><span>Sumber Google</span><strong>{state.connected ? 'Terhubung' : 'Perlu dihubungkan'}</strong><small>{state.connectedEmail || 'Hubungkan akun Google sumber'}</small><ChevronRight size={16}/></button>
          <button className="admin-stat-card" onClick={() => navigate('contacts')}><div className="admin-stat-icon green"><ContactRound size={20}/></div><span>Kontak</span><strong>{state.contactsSpreadsheetId ? 'Google Sheets' : 'Excel sumber lama'}</strong><small>Cache database diperbarui setiap 24 jam</small><ChevronRight size={16}/></button>
          <button className="admin-stat-card" onClick={() => navigate('access')}><div className="admin-stat-icon amber"><ShieldCheck size={20}/></div><span>Edit oleh PIC</span><strong>{state.allowPicEdits ? 'Diizinkan' : 'Dinonaktifkan'}</strong><small>Status dan Kendala Monitoring</small><ChevronRight size={16}/></button>
        </div><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Pengelolaan cepat</h2><p>Pilih area yang ingin diperbarui.</p></div></div><div className="admin-shortcuts">{adminSections.slice(1).map(item => { const Icon = item.icon; return <button key={item.id} onClick={() => navigate(item.id)}><Icon size={19}/><span><strong>{item.label}</strong><small>{item.description}</small></span><ChevronRight size={16}/></button> })}</div></section></>}
        {page === 'source' && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Koneksi Google</h2><p>Akun ini dipakai server untuk membaca spreadsheet Monitoring.</p></div><span className={`admin-status-pill ${state.connected ? 'positive' : 'warning'}`}>{state.connected ? 'Terhubung' : 'Perlu koneksi'}</span></div><div className="admin-source-detail"><div className="admin-stat-icon blue"><Cloud size={23}/></div><div><strong>{state.connectedEmail || 'Belum ada akun Google terhubung'}</strong><span>{state.connected ? 'Sumber data siap digunakan oleh SAPA.' : 'Hubungkan akun Google sebelum mengelola data sumber.'}</span></div></div><a className="admin-button admin-button-primary" href="/api/auth/connect">{state.connected ? 'Hubungkan ulang Google' : 'Hubungkan Google Sheets'} <ArrowUpRight size={16}/></a></section>}
        {page === 'contacts' && <div className="admin-page-stack"><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Sumber kontak</h2><p>Atur sumber utama nomor AC dan AM.</p></div><div className="admin-stat-icon green"><ContactRound size={19}/></div></div><form className="admin-form" onSubmit={saveContacts}><label>Tautan Google Sheets<input type="url" value={contactsUrl} placeholder="https://docs.google.com/spreadsheets/d/…" disabled={busy} onChange={e => setContactsUrl(e.target.value)}/></label><label>Nama tab kontak<input value={contactsSheet} maxLength={150} required disabled={busy} onChange={e => setContactsSheet(e.target.value)}/></label><p>Kosongkan tautan untuk memakai file Excel sumber lama.</p><button className="admin-button admin-button-primary" disabled={busy} type="submit">Simpan sumber kontak</button></form></section><section className="admin-panel"><div className="admin-panel-heading"><div><h2>Cache kontak</h2><p>Data tersimpan di database selama 24 jam dan diperbarui saat ada kunjungan berikutnya.</p></div><RefreshCw size={19}/></div><button className="admin-button admin-button-secondary" disabled={busy} onClick={refreshContacts}><RefreshCw size={16}/> {busy ? 'Memperbarui…' : 'Perbarui kontak sekarang'}</button>{contactsRefresh && <div className="admin-alert admin-alert-success" role="status"><Check size={16}/>{contactsRefresh.count.toLocaleString('id-ID')} kontak diperbarui · {new Date(contactsRefresh.fetchedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB.</div>}</section></div>}
        {page === 'access' && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Izin edit oleh PIC</h2><p>Kendalikan apakah PIC dapat mengubah Status dan Kendala di Monitoring.</p></div><div className="admin-stat-icon amber"><ShieldCheck size={20}/></div></div><label className="admin-toggle-row"><span><strong>Izinkan perubahan oleh PIC</strong><small>{state.allowPicEdits ? 'PIC dapat menyimpan perubahan pada kolom yang diizinkan.' : 'Perubahan oleh PIC sedang dinonaktifkan.'}</small></span><input type="checkbox" role="switch" checked={!!state.allowPicEdits} disabled={busy} onChange={toggle}/></label><p className="admin-panel-note">Hanya Status dan Kendala yang dapat diubah melalui aplikasi. Setiap perubahan tercatat pada Riwayat.</p></section>}
        {page === 'audit' && <section className="admin-panel"><div className="admin-panel-heading"><div><h2>Riwayat perubahan</h2><p>Aktivitas terbaru pada data pesanan Monitoring.</p></div><button className="admin-button admin-button-secondary" disabled={busy} onClick={loadAudit}><RefreshCw size={15}/>{busy ? 'Memuat…' : audit ? 'Muat ulang' : 'Tampilkan riwayat'}</button></div>{audit === null ? <div className="admin-empty"><History size={25}/><strong>Riwayat siap ditampilkan</strong><p>Klik Tampilkan riwayat untuk mengambil aktivitas terbaru.</p></div> : audit.length ? <div className="admin-audit-list">{audit.map(item => <div key={item.id} className="admin-audit-item"><div><strong>{item.source} · {item.shipment}</strong><span>{item.actor}</span></div><div><span className={`admin-status-pill ${item.outcome === 'completed' ? 'positive' : 'warning'}`}>{item.outcome}</span><time>{new Date(item.created_at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB</time></div></div>)}</div> : <div className="admin-empty"><History size={25}/><strong>Belum ada perubahan</strong><p>Aktivitas edit akan muncul di sini.</p></div>}</section>}
      </div>
    </div>
  </main>
}
