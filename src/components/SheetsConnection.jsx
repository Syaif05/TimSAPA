import React from 'react'
import { useSourceAccess } from '../cloud/GoogleAdmin'
import { Cloud, RefreshCw, ExternalLink, Database, Settings2, Users } from 'lucide-react'
import { InfoButton } from './InfoButton'
import { SHEET_SOURCES, spreadsheetLink, CONTACTS_SOURCE } from '../utils/sheetsConfig'
export function SheetsConnection({ connection, preferences, onPreferencesChange, contactsConnection, compact = false }) {
  const sourceAccess = useSourceAccess()
  const accessLabel = sourceAccess.canEdit ? 'Edit aktif' : 'Baca saja'
  const { enabled, setEnabled, mode, setMode, snapshot, phase, error, checkedAt, refresh } = connection
  const loading = ['loading', 'syncing'].includes(phase)
  const time = checkedAt ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(checkedAt)) : '—'
  const label = enabled ? 'Google Sheets' : 'Data manual'
  const statusLabel = loading ? 'Sinkronisasi…' : phase === 'error' ? 'Sinkronisasi terhenti' : `Diperbarui ${time}`
  return <section className={`sheets-connection ${compact ? 'sheets-connection-compact' : ''}`} aria-label="Sumber data Google Sheets">
    {compact ? <div className="compact-source-label" title={`${label} · ${statusLabel} · ${accessLabel}`}>
      {enabled ? <Cloud size={14}/> : <Database size={14}/>}
      <span className="compact-source-name">{enabled ? 'Sheets' : 'Manual'}</span>
      <span className={`status-dot ${phase === 'live' ? 'connected' : ''}`}/>
      <span className="compact-sync-time" role="status">{loading ? '…' : phase === 'error' ? 'Gagal' : time}</span>
    </div> : <div className="flex flex-wrap items-center gap-2 min-w-0">
      {enabled ? <Cloud size={16} /> : <Database size={16} />}
      <select aria-label="Sumber data aplikasi" className="clean-select" value={enabled ? 'sheets' : 'manual'} onChange={e => setEnabled(e.target.value === 'sheets')}><option value="sheets">Google Sheets</option><option value="manual">Input manual / arsip lokal</option></select>
      {enabled && <><span className={`status-dot ${phase === 'live' ? 'connected' : ''}`} /><span className="text-[10px] text-zinc-400" role="status">{statusLabel}</span><span className="tiny-badge">{accessLabel}</span></>}
    </div>}
    <div className="flex items-center gap-1">
      {enabled && <button className="icon-button" aria-label="Sinkronkan sekarang" title="Sinkronkan sekarang" disabled={loading} onClick={refresh}><RefreshCw size={15} className={loading ? 'sync-spinning' : ''}/></button>}
      {contactsConnection && <InfoButton title="Kontak spreadsheet" icon={Users}>
        <p>Nomor AC dicocokkan dari Store, Store Name, AC name, dan CUG AC pada sheet KONTAK TOKO BARU. Sumber kontak dibaca saja.</p>
        <p>{contactsConnection.ready ? `${contactsConnection.snapshot.contacts.length.toLocaleString('id-ID')} kontak toko tersedia.` : 'Memuat kontak…'}</p>
        {contactsConnection.checkedAt && <p className="text-xs">Terakhir dibaca: {new Date(contactsConnection.checkedAt).toLocaleString('id-ID', {timeZone: 'Asia/Jakarta'})} WIB.</p>}
        {contactsConnection.snapshot?.stale && <p className="text-xs">Memakai salinan terakhir; pembaruan sedang dicoba.</p>}
        {contactsConnection.error && <p className="text-xs text-rose-500" role="alert">{contactsConnection.error}</p>}
        <a href={contactsConnection.snapshot?.sourceId ? `https://docs.google.com/spreadsheets/d/${contactsConnection.snapshot.sourceId}/edit` : CONTACTS_SOURCE.url} target="_blank" rel="noreferrer" className="flex items-center gap-1 underline">Buka file kontak<ExternalLink size={12}/></a>
        <button className="secondary-button" onClick={contactsConnection.refresh}><RefreshCw size={14}/>Periksa kontak</button>
      </InfoButton>}
      <InfoButton title="Pengaturan sumber data" icon={Settings2}>
        <label className="block">Sumber data<select aria-label="Sumber data aplikasi" className="clean-select block w-full" value={enabled ? 'sheets' : 'manual'} onChange={e => setEnabled(e.target.value === 'sheets')}><option value="sheets">Google Sheets</option><option value="manual">Input manual / arsip lokal</option></select></label>
        <p className="text-xs">{label} · {statusLabel} · {sourceAccess.connected ? 'Akun pengelola terhubung' : 'Sumber publik'} · {accessLabel}</p>
        {error && <p className="text-xs text-rose-500">{error}</p>}
        <p>REG dan DS diperiksa setiap 30 detik saat halaman terlihat. {sourceAccess.canEdit ? 'Gunakan ikon pensil pada detail AC untuk mengubah Status atau Kendala.' : 'Perubahan spreadsheet belum diaktifkan.'}</p>
        <label className="block">Tab sumber<select aria-label="Pilihan tab harian" className="clean-select block w-full" value={mode} onChange={e => setMode(e.target.value)}><option value="linked">Dua tab dari tautan (31/10)</option><option value="daily">Ikuti tab hari ini (Asia/Jakarta)</option></select></label>
        <label className="block">PIC awal<input className="phone-field w-full" placeholder="Semua PIC" value={preferences.pic === 'ALL' ? '' : preferences.pic} onChange={e => onPreferencesChange(prev => ({ ...prev, pic: e.target.value.trim().toUpperCase() || 'ALL' }))}/></label>
        <p className="text-xs">Status chat disimpan lokal per tanggal dan terpisah dari status pesanan di spreadsheet. Bila sinkronisasi gagal, salinan terakhir ditampilkan dengan waktu pembacaannya.</p>
        {snapshot?.sources.map(s => <p key={s.key} className="text-xs">{s.title}: {s.count.toLocaleString('id-ID')} baris</p>)}
        {SHEET_SOURCES.map(s => <a key={s.key} href={spreadsheetLink(s.gid)} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs underline">Buka sumber {s.key}<ExternalLink size={12}/></a>)}
      </InfoButton>
    </div>
    {contactsConnection && !contactsConnection.ready && <div className="contacts-loading" role="status">{contactsConnection.error ? 'Kontak belum siap; periksa ikon kontak.' : compact ? 'Memuat kontak…' : 'Memuat sumber kontak spreadsheet…'}</div>}
    {contactsConnection?.ready && contactsConnection.error && <div className="sheets-error" role="alert">{compact ? 'Kontak: memakai salinan terakhir. Detail di ikon kontak.' : `${contactsConnection.error} Memakai kontak terakhir.`}</div>}
    {enabled && error && <div className="sheets-error" role="alert">{compact ? (snapshot ? 'Sinkronisasi gagal; memakai data terakhir.' : 'Sumber belum terhubung.') : `${error} ${snapshot ? 'Menampilkan data terakhir.' : 'Belum ada data yang berhasil dibaca.'}`} Detail di pengaturan sumber.</div>}
  </section>
}
