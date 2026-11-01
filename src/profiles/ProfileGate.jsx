import { DEFAULT_APPEARANCE } from '../utils/appearance'
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowRight, Check, ChevronDown, Cloud, RefreshCw, Search, Users } from 'lucide-react'
import { useLiveSheets } from '../hooks/useLiveSheets'
import { profileRequest, normalizePic, createPicStorage } from './api'
import { ProfileStore } from './ProfileStore'
import { ProfileProvider, usePicProfile } from './ProfileContext'
import { DEFAULT_TEMPLATES } from '../utils/templateEngine'
import { DEFAULT_TABLE_SETTINGS } from '../utils/tableSettings'
import { DEFAULT_STATUSES } from '../utils/statusConfig'
const DEFAULTS = { appearance: DEFAULT_APPEARANCE, templates: DEFAULT_TEMPLATES, activeTemplateKey: 'template_1', tableSettings: DEFAULT_TABLE_SETTINGS, statuses: DEFAULT_STATUSES, darkMode: false }
export function ProfileGate({ children }) {
  const [store, setStore] = useState(null)
  const [profiles, setProfiles] = useState([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(() => { try { return localStorage.getItem('sapa_last_pic') || '' } catch { return '' } })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [retry, setRetry] = useState(0)
  const discovery = useLiveSheets({ active: !store, forceEnabled: true })
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    const abort = new AbortController()
    profileRequest('', { signal: abort.signal }).then(data => { setProfiles(data.profiles); setError('') }).catch(error => { if (!abort.signal.aborted) setError(error.message) })
    return () => abort.abort()
  }, [retry])
  const names = useMemo(() => [...new Set([...profiles, ...(discovery.snapshot?.rows || []).map(row => normalizePic(row.pic))].filter(Boolean))].sort(), [profiles, discovery.snapshot])
  const visible = names.filter(name => name.toLowerCase().includes(search.toLowerCase()))
  const enter = async () => {
    if (!selected || busy) return
    setBusy(true); setError('')
    try {
      const data = await profileRequest(selected, { method: 'POST' })
      if (!alive.current) return
      const next = new ProfileStore({ name: data.name, records: data.records, defaults: DEFAULTS, request: profileRequest, storage: createPicStorage(data.name) })
      try { localStorage.setItem('sapa_last_pic', data.name) } catch {}
      setStore(next)
    } catch (error) { if (alive.current) setError(error.message) }
    finally { if (alive.current) setBusy(false) }
  }
  const switchProfile = async () => {
    if (store.hasUnsavedForms) throw new Error('Simpan atau batalkan perubahan formulir sebelum berganti PIC.')
    await store.flush()
    store.dispose(); setStore(null); setSearch('')
  }
  useEffect(() => {
    if (!store) return
    const refresh = () => { if (!document.hidden) { if (store.pendingCount) store.flush().catch(() => {}); else store.refresh().catch(() => {}) } }
    const timer = setInterval(refresh, 15000)
    window.addEventListener('online', refresh); document.addEventListener('visibilitychange', refresh)
    const warn = event => { if (store.pendingCount || store.hasUnsavedForms) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => { clearInterval(timer); window.removeEventListener('online', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('beforeunload', warn) }
  }, [store])
  if (store) return <ProfileProvider store={store}><ProfileSession key={store.name} onSwitch={switchProfile}>{children}</ProfileSession></ProfileProvider>
  return <main className="profile-entry">
    <div className="profile-entry-brand">s<span>.</span></div>
    <section className="profile-picker" aria-labelledby="profile-title">
      <div className="profile-eyebrow"><Cloud size={14} /> SAPA WORKSPACE</div>
      <h1 id="profile-title">Siapa yang bertugas?</h1>
      <p>Pilih PIC untuk melanjutkan.</p>
      <label className="profile-search"><Search size={17} /><input aria-label="Cari PIC" placeholder="Cari nama PIC…" value={search} onChange={e => setSearch(e.target.value)} /></label>
      <div className="profile-options" role="group" aria-label="Daftar PIC">
        {visible.map((name, index) => <button className={`profile-option ${selected === name ? 'selected' : ''}`} key={name} onClick={() => setSelected(name)} aria-pressed={selected === name}><span className={`profile-avatar color-${index % 4}`}>{name.slice(0, 2)}</span><span>{name}</span>{selected === name ? <Check size={17} /> : <ArrowRight size={15} />}</button>)}
        {!visible.length && <div className="profile-empty">{names.length ? 'PIC tidak ditemukan.' : discovery.phase === 'loading' ? 'Memuat daftar PIC…' : 'Daftar PIC belum tersedia.'}</div>}
      </div>
      {(error || (!names.length && discovery.error)) && <div className="profile-error" role="alert">{error || discovery.error}<button onClick={() => { setRetry(n => n + 1); discovery.refresh() }}><RefreshCw size={13} /> Coba lagi</button></div>}
      <button className="profile-enter" disabled={!selected || busy || !names.includes(selected)} onClick={enter}>{busy ? 'Membuka profil…' : `Masuk${selected ? ` sebagai ${selected}` : ''}`}<ArrowRight size={17} /></button>
      <div className="profile-footnote"><Users size={14} /><span>Profil bersama, tanpa kata sandi. Pengaturan mengikuti PIC di semua perangkat.</span></div>
    </section>
    <span className="profile-entry-footer">SAPA · Fokus pada pekerjaan Anda.</span>
  </main>
}
const SwitchContext = React.createContext(null)
export function useSwitchPic() { return React.useContext(SwitchContext) }
function ProfileSession({ onSwitch, children }) {
  const profile = usePicProfile()
  return <SwitchContext.Provider value={onSwitch}>
    {profile.conflict && <div className="profile-sync-alert" role="alert"><span>Pengaturan {profile.conflict.key} berubah di perangkat lain.</span><button onClick={() => profile.resolve(false)}>Pakai versi bersama</button><button onClick={() => profile.resolve(true)}>Simpan perubahan saya</button></div>}
    {profile.phase === 'error' && <div className="profile-sync-alert" role="alert"><span>{profile.error} Perubahan tersimpan sebagai draf perangkat ini.</span><button onClick={() => profile.flush().catch(() => {})}>Coba simpan lagi</button></div>}
    {children}
  </SwitchContext.Provider>
}
export function PicBadge({ showToast }) {
  const profile = usePicProfile(); const switchPic = useSwitchPic()
  const [busy, setBusy] = useState(false)
  const status = profile.phase === 'synced' ? 'Tersimpan bersama' : profile.phase === 'saving' || profile.phase === 'pending' ? 'Menyimpan…' : 'Perlu disinkronkan'
  return <button className="pic-badge" disabled={busy} title={`${profile.name} · ${status} · Ganti PIC`} aria-label={`Ganti PIC, aktif ${profile.name}`} onClick={async () => { setBusy(true); try { await switchPic() } catch (error) { showToast?.(error.message, 'error'); setBusy(false) } }}><span className={`pic-sync-dot ${profile.phase === 'synced' ? 'synced' : 'pending'}`} /><span>{profile.name}</span><ChevronDown size={12} /></button>
}
