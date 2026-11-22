import { recordActivity } from '../utils/activityTracker'
import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, ClipboardList, Check, RefreshCw, AlertCircle } from 'lucide-react'
import { allWorkNotes, groupWorkResults, workProgress, WORK_FIELDS, loadWorkChecks, setWorkCollected, workStorageKey } from '../utils/hasilKerja'

export function HasilKerjaView({ rows = [], date, scope, storage, defaultPic = 'ALL', defaultSource = 'ALL', showToast, connection }) {
  return <WorkChecklist key={`${scope}:${date}:${defaultPic}:${defaultSource}:${rows.length > 0}`} {...{ rows, date, scope, storage, defaultPic, defaultSource, showToast, connection }}/>
}
function WorkChecklist({ rows, date, scope, storage, defaultPic, defaultSource, showToast, connection }) {
  const [pic, setPic] = useState(defaultPic || 'ALL')
  const [source, setSource] = useState(defaultSource || 'ALL')
  const [status, setStatus] = useState('ALL')
  const storageKey = workStorageKey(scope, date)
  const [checks, setChecks] = useState(() => loadWorkChecks(storage, scope, date, rows))
  const [notice, setNotice] = useState('')
  // A source snapshot may arrive after mount; load legacy checkmarks only once
  // data is available, and freeze the migrated ledger before any new additions.
  useEffect(() => {
    if (!rows.length) return
    try {
      if (storage.getItem(storageKey) === null) {
        const migrated = loadWorkChecks(storage, scope, date, rows)
        storage.setItem(storageKey, JSON.stringify(migrated))
      }
    } catch { showToast?.('Ceklis belum dapat disimpan di perangkat ini.', 'error') }
  }, [rows, storage, storageKey, scope, date, showToast])
  useEffect(() => {
    const sync = event => {
      if (event.key === null || event.key?.endsWith(storageKey)) setChecks(loadWorkChecks(storage, scope, date, rows))
    }
    window.addEventListener('storage', sync)
    return () => window.removeEventListener('storage', sync)
  }, [storage, storageKey, scope, date, rows])
  const groups = useMemo(() => groupWorkResults(rows, { pic, source, checks }), [rows, pic, source, checks])
  const visible = groups.filter(group => status === 'ALL' || group.collected === (status === 'COLLECTED'))
  const progress = workProgress(groups)
  const notes = allWorkNotes(visible)
  const pics = [...new Set(rows.map(row => String(row.pic || '').trim().toUpperCase()).filter(Boolean))].sort()
  const busy = connection?.phase === 'loading' || connection?.phase === 'syncing'
  const error = connection?.error || (connection?.snapshot?.stale ? 'Data terakhir belum berhasil diperbarui.' : '')
  const checkedAt = connection?.checkedAt && !Number.isNaN(Date.parse(connection.checkedAt)) ? new Date(connection.checkedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' }) : ''
  const toggle = (group, collected) => {
    const latest = loadWorkChecks(storage, scope, date, rows)
    const next = setWorkCollected(latest, group.rows, collected)
    // Persist before showing success. A failed save leaves the previous state.
    try { storage.setItem(storageKey, JSON.stringify(next)) }
    catch { showToast?.('Ceklis gagal disimpan. Coba lagi sebelum berpindah halaman.', 'error'); return }
    setChecks(next)
    setNotice(`${group.shipments.length} Shipment ${collected ? 'ditandai dikumpulkan' : 'dikembalikan ke belum dikumpulkan'}.`)
    if (collected) recordActivity('work_check', group.shipments.length, 'hasil-kerja')
  }
  return <div className="work-results">
    <div className="work-results-heading">
      <div><h2><ClipboardList size={21}/>Hasil Kerja</h2><p>Pesanan DONE · {date}. Data baru dan perubahan laporan selalu perlu dicek kembali.</p></div>
      <div className="work-results-filters">
        <label>PIC<select aria-label="PIC Hasil Kerja" value={pic} onChange={e => setPic(e.target.value)}><option value="ALL">Semua PIC</option>{[...new Set([pic, ...pics])].filter(p => p !== 'ALL').map(p => <option key={p}>{p}</option>)}</select></label>
        <label>Sumber<select aria-label="Sumber Hasil Kerja" value={source} onChange={e => setSource(e.target.value)}><option value="ALL">DS + REG</option><option>DS</option><option>REG</option></select></label>
        <label>Pengumpulan<select aria-label="Status pengumpulan" value={status} onChange={e => setStatus(e.target.value)}><option value="ALL">Semua status</option><option value="PENDING">Belum dikumpulkan</option><option value="COLLECTED">Sudah dikumpulkan</option></select></label>
        {connection?.refresh && <button className="secondary-button work-refresh" type="button" onClick={connection.refresh} disabled={busy}><RefreshCw size={15} className={busy ? 'animate-spin' : ''}/>{busy ? 'Memperbarui…' : 'Perbarui data'}</button>}
      </div>
    </div>
    <div className="work-summary" aria-label="Ringkasan Hasil Kerja"><span><strong>{progress.shipments - progress.completedShipments}</strong> Shipment belum dikumpulkan</span><span><strong>{progress.completedShipments}</strong> sudah dikumpulkan</span><span>{groups.length} kelompok{checkedAt ? ` · Diperiksa ${checkedAt} WIB` : ''}</span></div>
    <p className="work-sort-hint">Urutan: belum dikumpulkan → motor BAIK → Grouping A–Z → personil terbanyak. Ceklis berlaku sepanjang hari di perangkat ini, termasuk saat berganti filter.</p>
    {error && <div className="work-sync-warning" role="alert"><AlertCircle size={18}/><div><strong>Data terbaru belum terverifikasi</strong><p>{error} Gunakan Perbarui data untuk mencoba kembali.</p></div></div>}
    <span className="sr-only" role="status">{notice}</span>
    {!visible.length && <div className="empty-panel work-empty"><CheckCircle2 size={30}/><h3>{busy && !groups.length ? 'Memeriksa pesanan DONE…' : error && !groups.length ? 'Data belum dapat dipastikan' : !groups.length ? 'Belum ada pesanan DONE untuk filter ini' : status === 'PENDING' ? 'Semua data sudah dikumpulkan' : 'Belum ada data yang dikumpulkan'}</h3><p>{!groups.length ? 'Periksa PIC, sumber, dan tanggal. Jika baru mengubah spreadsheet, tekan Perbarui data.' : 'Data baru akan muncul di bagian belum dikumpulkan.'}</p></div>}
    <div className="work-card-grid">{visible.map(group => <article key={group.key} className={`work-result-card ${group.collected ? 'is-collected' : ''}`}>
      <header><div className="work-card-meta"><strong>{group.shipments.length} Shipment</strong><small>{group.sources.join(' + ')}{group.stores.length ? ` · ${group.stores.length} toko` : ''}</small>{group.updated && <span className="work-updated">Data berubah · cek ulang</span>}</div><label className="work-check"><input type="checkbox" checked={group.collected} onChange={e => toggle(group, e.target.checked)} aria-label={`${group.collected ? 'Dikumpulkan' : 'Belum dikumpulkan'}: ${group.fields.shipment}`}/>{group.collected ? 'Dikumpulkan' : 'Belum dikumpulkan'}</label></header>
      <dl>{WORK_FIELDS.map(([field, label]) => <div className={`work-result-field work-field-${field}`} key={field}><dt>{field === 'kondisiMotor' ? 'Status Equipment Motor?' : label}</dt><dd>{field === 'kondisiMotor' ? group.fields[field] ? <div className="work-badges"><span className={`work-badge ${/rusak/i.test(group.fields[field]) ? 'is-broken' : /^baik$/i.test(group.fields[field]) ? 'is-good' : ''}`}>{group.fields[field]}</span></div> : <span>—</span> : field === 'grouping' ? <span className="work-grouping" title={group.fields[field]}>{group.fields[field] || '—'}</span> : group.fields[field] ? <CopyText value={group.fields[field]} label={label} showToast={showToast}/> : field === 'kendala' ? <p className="work-missing" role="alert">Kendala kosong. Lengkapi catatan pada spreadsheet.</p> : <span>—</span>}</dd></div>)}</dl>
    </article>)}</div>
    <section className="work-notes"><div className="work-results-heading"><h3>Rekap Semua Catatan (Kendala)</h3></div><p>Kendala pada status pengumpulan dan filter yang sedang ditampilkan, dipisahkan koma.</p>{notes ? <CopyText value={notes} label="Rekap semua Kendala" showToast={showToast}/> : <span>—</span>}</section>
    <section className="work-progress-floating" aria-label="Progres pengumpulan" title="Progres seluruh kelompok pada PIC dan sumber ini. Ceklis disimpan per PIC login, tanggal, dan perangkat."><CheckCircle2 size={18}/><div><div><strong>{progress.percent}%</strong><span>{progress.completed}/{progress.total} kelompok</span></div><progress value={progress.completed} max={Math.max(progress.total, 1)} aria-label="Persentase kelompok yang sudah dikumpulkan"/></div><small>{progress.completedShipments}/{progress.shipments} Shipment</small></section>
  </div>
}
function CopyText({ value, label, showToast }) {
  const [copiedValue, setCopiedValue] = useState(null)
  const [expanded, setExpanded] = useState(false)
  const copied = copiedValue === value
  useEffect(() => {
    if (copiedValue === null) return
    const timer = setTimeout(() => setCopiedValue(null), 1800)
    return () => clearTimeout(timer)
  }, [copiedValue])
  const copy = async () => {
    try { await navigator.clipboard.writeText(value); recordActivity('work_copy',1,'hasil-kerja'); setCopiedValue(value) }
    catch { showToast('Gagal menyalin. Pilih teks dan salin manual.', 'error') }
  }
  return <div className="work-copy-wrap"><button type="button" className={`work-copy-text ${copied ? 'is-copied' : ''}`} onClick={copy} aria-label={`Salin ${label}`} title={value}><span className={expanded ? '' : 'work-clamped'}>{value}</span><span className="work-copy-indicator">{copied ? <Check size={15}/> : <Copy size={15}/>}<span className="sr-only" role="status">{copied ? `${label} disalin` : ''}</span></span></button>{value.length > 100 && <button type="button" className="work-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ringkas' : 'Lihat lengkap'}</button>}</div>
}
