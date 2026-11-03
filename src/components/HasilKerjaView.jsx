import React, { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Copy, ClipboardList, Check } from 'lucide-react'
import { allWorkNotes, groupWorkResults, workProgress, WORK_FIELDS } from '../utils/hasilKerja'

export function HasilKerjaView({ rows, date, scope, storage, defaultPic = 'ALL', defaultSource = 'ALL', showToast }) {
  const [pic, setPic] = useState(defaultPic)
  const [source, setSource] = useState(defaultSource)
  const [batch, setBatch] = useState('1')
  const groups = useMemo(() => groupWorkResults(rows, { pic, source }), [rows, pic, source])
  const pics = [...new Set(rows.map(row => row.pic).filter(Boolean))].sort()
  return <div className="work-results"><div className="work-results-heading"><div><h2><ClipboardList size={21}/>Hasil Kerja</h2><p>Pesanan DONE · {date}. Kelompok berdasarkan Kendala, siap disalin ke laporan kantor.</p></div><div className="work-results-filters"><label>PIC<select value={pic} onChange={e => setPic(e.target.value)}><option value="ALL">Semua PIC</option>{[...new Set([pic,...pics])].filter(p => p !== 'ALL').map(p => <option key={p}>{p}</option>)}</select></label><label>Sumber<select value={source} onChange={e => setSource(e.target.value)}><option value="ALL">DS + REG</option><option>DS</option><option>REG</option></select></label><label>Penyerahan<select value={batch} onChange={e => setBatch(e.target.value)}><option value="1">Penyerahan 1</option><option value="2">Penyerahan 2</option></select></label></div></div>
    <WorkChecklist key={`${scope}:${date}:${batch}:${pic}:${source}`} groups={groups} storageKey={`sapa_work_results_v1:${scope}:${date}:${batch}:${pic}:${source}`} storage={storage} showToast={showToast}/>
  </div>
}
function WorkChecklist({ groups, storageKey, storage, showToast }) {
  const [checks, setChecks] = useState(() => { try { const saved = JSON.parse(storage.getItem(storageKey) || '{}'); return saved && typeof saved === 'object' && !Array.isArray(saved) ? saved : {} } catch { return {} } })
  const progress = workProgress(groups, checks)
  const notes = allWorkNotes(groups)
  const toggle = (group, completed) => {
    const next = { ...checks }
    if (completed) next[group.key] = group.signature
    else delete next[group.key]
    setChecks(next)
    try { storage.setItem(storageKey, JSON.stringify(next)) } catch { showToast('Ceklis belum dapat disimpan. Jangan tutup halaman ini.', 'error') }
  }
  return <>
    {!groups.length && <div className="empty-panel"><CheckCircle2 size={30}/><h3>Belum ada pesanan DONE</h3><p>Periksa PIC, sumber, dan tanggal monitoring.</p></div>}
    <div className="work-card-grid">{groups.map(group => {
      const done = checks[group.key] === group.signature
      return <article key={group.key} className={`work-result-card ${done ? 'is-collected' : ''}`}>
        <header><span>{group.shipments.length} Shipment</span><label className="work-check"><input type="checkbox" checked={done} onChange={e => toggle(group,e.target.checked)}/>{done ? 'Dikumpulkan' : 'Belum dikumpulkan'}</label></header>
        <dl>{WORK_FIELDS.map(([field,label]) => <div className={`work-result-field work-field-${field}`} key={field}><dt>{field === 'kondisiMotor' ? 'Status Equipment Motor?' : label}</dt><dd>{field === 'kondisiMotor' ? <div className="work-badges">{(group.fields[field] || '').split(',').filter(Boolean).map(value => <span key={value} className={`work-badge ${/rusak/i.test(value) ? 'is-broken' : /baik/i.test(value) ? 'is-good' : ''}`}>{value.trim()}</span>)}{!group.fields[field] && <span>—</span>}</div> : field === 'grouping' ? <span className="work-grouping" title={group.fields[field]}>{group.fields[field] || '—'}</span> : group.fields[field] ? <CopyText value={group.fields[field]} label={label} showToast={showToast}/> : field === 'kendala' ? <p className="work-missing" role="alert">Kendala kosong. Lengkapi catatan pada spreadsheet.</p> : <span>—</span>}</dd></div>)}</dl>
        {group.mixed.length > 0 && <small className="work-mixed" title={`Periksa nilai berbeda: ${group.mixed.join(', ')}`}>Beberapa nilai berbeda · periksa sebelum dilaporkan</small>}
      </article>
    })}</div>
    <section className="work-notes"><div className="work-results-heading"><h3>Rekap Semua Catatan (Kendala)</h3></div><p>Semua Kendala sesuai filter, dipisahkan koma.</p>{notes ? <CopyText value={notes} label="Rekap semua Kendala" showToast={showToast}/> : <span>—</span>}</section>
    <section className="work-progress-floating" aria-label="Progres pengumpulan" title="Progres seluruh kelompok pada filter ini. Ceklis tersimpan per PIC login, tanggal, dan penyerahan."><CheckCircle2 size={18}/><div><div><strong>{progress.percent}%</strong><span>{progress.completed}/{progress.total} kelompok</span></div><progress value={progress.completed} max={Math.max(progress.total,1)} aria-label="Persentase kelompok yang sudah dikumpulkan"/></div><small>{progress.completedShipments}/{progress.shipments} Shipment</small></section>
  </>
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
    try { await navigator.clipboard.writeText(value); setCopiedValue(value) }
    catch { showToast('Gagal menyalin. Pilih teks dan salin manual.', 'error') }
  }
  return <div className="work-copy-wrap"><button type="button" className={`work-copy-text ${copied ? 'is-copied' : ''}`} onClick={copy} aria-label={`Salin ${label}`} title={value}><span className={expanded ? '' : 'work-clamped'}>{value}</span><span className="work-copy-indicator">{copied ? <Check size={15}/> : <Copy size={15}/>}<span className="sr-only" role="status">{copied ? `${label} disalin` : ''}</span></span></button>{value.length > 100 && <button type="button" className="work-expand" aria-expanded={expanded} onClick={() => setExpanded(!expanded)}>{expanded ? 'Ringkas' : 'Lihat lengkap'}</button>}</div>
}
