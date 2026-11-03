import React, { useMemo, useState } from 'react'
import { CheckCircle2, Copy, ClipboardList } from 'lucide-react'
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
  const copy = async value => { try { await navigator.clipboard.writeText(value); showToast('Data disalin.', 'success') } catch { showToast('Gagal menyalin. Pilih teks dan salin manual.', 'error') } }
  const toggle = (group, completed) => {
    const next = { ...checks }
    if (completed) next[group.key] = group.signature
    else delete next[group.key]
    setChecks(next)
    try { storage.setItem(storageKey, JSON.stringify(next)) } catch { showToast('Ceklis belum dapat disimpan. Jangan tutup halaman ini.', 'error') }
  }
  return <><section className="work-progress" aria-label="Progres pengumpulan"><div><strong>{progress.percent}% dikumpulkan</strong><span>{progress.completed} / {progress.total} kelompok · {progress.completedShipments} / {progress.shipments} Shipment</span></div><progress value={progress.completed} max={Math.max(progress.total,1)} aria-label="Persentase kelompok yang sudah dikumpulkan"/><p>Ceklis tersimpan untuk PIC login, tanggal dan penyerahan ini. Jika isi kelompok berubah, ceklisnya perlu diperiksa ulang.</p></section>
    {!groups.length && <div className="empty-panel"><CheckCircle2 size={30}/><h3>Belum ada pesanan DONE</h3><p>Periksa PIC, sumber, dan tanggal monitoring.</p></div>}
    {groups.map(group => { const done = checks[group.key] === group.signature; return <article key={group.key} className={`work-result-card ${done ? 'is-collected' : ''}`}><header><div><h3>{group.fields.kendala || 'Kendala belum diisi'}</h3><p>{group.shipments.length} Shipment</p></div><label className="work-check"><input type="checkbox" checked={done} onChange={e => toggle(group,e.target.checked)}/><CheckCircle2 size={18}/>{done ? 'Sudah dikumpulkan' : 'Tandai dikumpulkan'}</label></header>
      {group.mixed.length > 0 && <p className="work-warning">Nilai berbeda pada {group.mixed.join(', ')} digabung dengan koma. Periksa kesesuaiannya sebelum mengisi laporan kantor.</p>}
      {group.missing.length > 0 && <p className="work-warning">Ada data kosong: {group.missing.join(', ')}.</p>}
      <dl>{WORK_FIELDS.map(([field,label]) => <div className="work-result-field" key={field}><dt>{label}</dt><dd><span>{group.fields[field] || 'Belum diisi'}</span><button className="icon-button" disabled={!group.fields[field]} aria-label={`Salin ${label} untuk ${group.fields.kendala || 'kendala kosong'}`} onClick={() => copy(group.fields[field])}><Copy size={16}/></button></dd></div>)}</dl>
    </article>})}
    <section className="work-notes"><div className="work-results-heading"><h3>Rekap Semua Catatan (Kendala)</h3><button className="secondary-button" disabled={!notes} onClick={() => copy(notes)}><Copy size={16}/>Salin rekap Kendala</button></div><p>Seluruh Kendala unik dari pesanan DONE sesuai PIC dan sumber di atas, dipisahkan koma.</p><textarea readOnly rows={4} aria-label="Rekap semua Kendala" value={notes} placeholder="Belum ada Kendala."/></section>
  </>
}
