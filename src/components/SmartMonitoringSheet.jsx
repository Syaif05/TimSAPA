import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ArrowDownUp, CheckCircle2, ChevronLeft, ChevronRight, Copy, FileSpreadsheet, History, Pencil, RefreshCw, Save, Search, X } from 'lucide-react'
import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
import { useSourceAccess } from '../cloud/GoogleAdmin'
import { sourceRequest } from '../cloud/sourceRequest'
import { FOLLOW_UP_FIELDS, hourRank, planFollowUpCarry, smartSheetEntries, smartSheetEntriesAtHour, textValue } from '../utils/smartSheet'
import { normalizeMonitoringHour } from '../utils/monitoringView'
import { isDoneOrder } from '../utils/orderState'
import { jakartaDate } from '../utils/sheetsConfig'

const norm = value => textValue(value).toUpperCase()
const BASE_COLUMNS = [
  { key: 'shipment', label: 'Shipment' }, { key: 'jam', label: 'JAM' },
  { key: 'kodeToko', label: 'Kode Toko' }, { key: 'namaToko', label: 'Nama Toko' },
  ...FOLLOW_UP_FIELDS,
]
const EXTRA_COLUMNS = [{ key: 'namaAc', label: 'Nama AC' }, { key: 'pic', label: 'PIC' }, { key: 'cabang', label: 'Cabang' }]
const AUTO_KEY = 'sapa_smart_sheet_auto_v1'

export function SmartMonitoringSheet({ rows, connection, date, defaultSource = 'ALL', showToast }) {
  const profile = usePicProfile()
  const { canEdit } = useSourceAccess()
  const [pic, setPic] = useState(profile.name)
  const [source, setSource] = useState(defaultSource)
  const [jam, setJam] = useState('ALL')
  const [status, setStatus] = useState('ALL')
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState({ key: 'kodeToko', desc: false })
  const [extra, setExtra] = useState(false)
  const [page, setPage] = useState(0)
  const [editor, setEditor] = useState(null)
  const [auto, setAuto] = useState(() => { try { return profile.storage.getItem(AUTO_KEY) !== 'false' } catch { return true } })
  const [sync, setSync] = useState({ busy: false, error: '', message: '' })
  const writing = useRef(false)
  const attempted = useRef('')
  const entries = useMemo(() => smartSheetEntries(rows), [rows])
  const scoped = useMemo(() => entries.filter(e => (pic === 'ALL' || norm(e.row.pic) === norm(pic)) && (source === 'ALL' || e.row.source === source)), [entries, pic, source])
  const pending = useMemo(() => pic === 'ALL' ? [] : planFollowUpCarry(rows, { pic, source }), [rows, pic, source])
  const hourOptions = useMemo(() => [...new Set(scoped.flatMap(entry => entry.hours).filter(hour => hourRank(hour) >= 0))].sort((a, b) => hourRank(b) - hourRank(a)), [scoped])
  const latestHour = hourOptions.find(h => hourRank(h) >= 0)
  const selectedHour = jam === 'LATEST' ? latestHour : jam
  const groupingOptions = useMemo(() => [...new Set(rows.map(row => textValue(row.grouping)).filter(Boolean))].sort(), [rows])
  const columns = extra ? [...BASE_COLUMNS, ...EXTRA_COLUMNS] : BASE_COLUMNS
  const matching = useMemo(() => {
    const atHour = jam === 'ALL' ? scoped : smartSheetEntriesAtHour(scoped, selectedHour)
    const query = norm(search)
    return atHour.filter(({ effective: row }) => !query ||
      [row.shipment, row.kodeToko, row.namaToko, row.namaAc, row.kendala, row.grouping, row.pic].some(value => norm(value).includes(query)))
  }, [scoped, jam, selectedHour, search])
  const doneCount = matching.filter(entry => isDoneOrder(entry.effective)).length
  const visible = useMemo(() => matching.filter(({ effective: row }) => {
    if (status === 'DONE') return isDoneOrder(row)
    if (status === 'ACTIVE') return !isDoneOrder(row)
    if (status === 'EMPTY') return !textValue(row.sheetStatus)
    return true
  }).sort((a, b) => {
    const av = a.effective[sort.key], bv = b.effective[sort.key]
    const order = sort.key === 'jam' ? hourRank(av) - hourRank(bv) : textValue(av).localeCompare(textValue(bv), 'id', { numeric: true, sensitivity: 'base' })
    return (sort.desc ? -order : order) || a.key.localeCompare(b.key)
  }), [matching, status, sort])
  const pageCount = Math.max(1, Math.ceil(visible.length / 50))
  const currentPage = Math.min(page, pageCount - 1)
  const shown = visible.slice(currentPage * 50, (currentPage + 1) * 50)
  const writable = !!canEdit && !!connection && connection.mode === 'daily' && date === jakartaDate() && !!connection.snapshot && !connection.snapshot.stale && !connection.error
  const canSync = writable && pic !== 'ALL' && !editor && !sync.busy
  const carry = useCallback(async () => {
    if (writing.current || !writable || pic === 'ALL') return
    writing.current = true
    setSync({ busy: true, error: '', message: '' })
    try {
      const result = await sourceRequest('/api/orders', { method: 'PATCH', body: { action: 'carry-forward', pic: profile.name, targetPic: pic, source, mode: 'daily', date } })
      setSync({ busy: false, error: '', message: `${result.updatedRows} baris / ${result.updatedCells} sel diteruskan ke spreadsheet.${result.remaining ? ` Masih ${result.remaining} baris; dilanjutkan setelah data diperbarui.` : ''}` })
      connection.refresh()
      window.dispatchEvent(new Event('sapa:sheets-changed'))
    } catch (error) {
      // Pause across reloads too: never retry an ambiguous write automatically.
      setAuto(false)
      try { profile.storage.setItem(AUTO_KEY, 'false') } catch { /* UI remains paused. */ }
      setSync({ busy: false, error: error.message, message: '' })
    } finally { writing.current = false }
  }, [writable, pic, source, profile.name, profile.storage, date, connection])
  const attemptKey = `${connection?.snapshot?.revision}:${pic}:${source}:${date}`
  useEffect(() => {
    if (!auto || !canSync || !pending.length || document.hidden || attempted.current === attemptKey) return
    const timer = setTimeout(() => { attempted.current = attemptKey; void carry() }, 1200)
    return () => clearTimeout(timer)
  }, [auto, canSync, pending.length, attemptKey, carry])
  const toggleAuto = value => {
    setAuto(value); attempted.current = ''
    try { profile.storage.setItem(AUTO_KEY, String(value)) } catch { showToast?.('Pengaturan otomatis hanya berlaku selama halaman ini terbuka.', 'error') }
  }
  const updateFilter = setter => value => { setter(value); setPage(0) }
  const copy = async () => {
    const escape = value => /[\t\r\n"]/.test(textValue(value)) ? `"${textValue(value).replaceAll('"', '""')}"` : textValue(value)
    try { await navigator.clipboard.writeText(visible.map(e => columns.map(c => escape(e.effective[c.key])).join('\t')).join('\n')); showToast?.(`${visible.length} baris tampilan disalin tanpa header.`, 'success') }
    catch { showToast?.('Gagal menyalin. Silakan pilih dan salin teks pada tabel.', 'error') }
  }
  return <section className="smart-sheet" aria-label="Spreadsheet Pintar">
    <header className="smart-sheet-heading"><div><span className="smart-eyebrow">MONITORING PER JAM</span><h2><FileSpreadsheet size={22}/>Spreadsheet Pintar</h2><p>Satu baris per Shipment pada sumber, toko, dan PIC yang sama. Isian jam sebelumnya pada hari yang sama mengikuti data terbaru.</p></div><button className="secondary-button" onClick={connection?.refresh} disabled={!connection || sync.busy}><RefreshCw size={15}/>Perbarui data</button></header>
    <div className="smart-summary"><span><strong>{scoped.length}</strong> Shipment unik</span><span><strong>{scoped.reduce((n, e) => n + e.history.length - 1, 0)}</strong> pengulangan diringkas</span><span><strong>{pending.length}</strong> baris menunggu diteruskan</span><span>{date}</span></div>
    <div className="smart-sync-panel"><div><label><input type="checkbox" checked={auto} onChange={e => toggleAuto(e.target.checked)} disabled={sync.busy}/>Teruskan isian otomatis</label><p>Aktif selama menu ini terbuka, untuk PIC dan sumber terpilih hari ini. Hanya sel kosong di JAM terakhir yang diisi. Riwayat lama tetap utuh.</p></div><button className="primary-button" onClick={carry} disabled={!canSync || !pending.length}><RefreshCw size={15} className={sync.busy ? 'animate-spin' : ''}/>{sync.busy ? 'Meneruskan…' : 'Teruskan sekarang'}</button></div>
    {!writable && <p className="smart-notice">{!connection ? 'Aktifkan sumber Google Sheets untuk menyimpan isian.' : connection.error || connection.snapshot?.stale ? 'Data belum terverifikasi. Penyimpanan dijeda; perbarui data terlebih dahulu.' : !canEdit ? 'Mode baca. Admin perlu mengaktifkan izin edit PIC agar isian dapat disimpan.' : 'Penyimpanan tersedia pada data harian tanggal hari ini.'}</p>}
    {pic === 'ALL' && <p className="smart-notice">Pilih satu PIC untuk meneruskan isian. Semua PIC hanya untuk melihat data.</p>}
    {sync.error && <div className="profile-error" role="alert">{sync.error}</div>}
    {sync.message && <div className="smart-success" role="status"><CheckCircle2 size={16}/>{sync.message}</div>}
    <div className="smart-filters"><label className="search-field"><Search size={16}/><input aria-label="Cari Spreadsheet Pintar" placeholder="Shipment, toko, AC, kendala…" value={search} onChange={e => updateFilter(setSearch)(e.target.value)}/></label>
      <label>PIC<select aria-label="PIC Spreadsheet Pintar" value={pic} onChange={e => updateFilter(setPic)(e.target.value)} disabled={sync.busy}><option value="ALL">Semua PIC</option>{[...new Set([pic, profile.name, ...rows.map(r => norm(r.pic))])].filter(p => p && p !== 'ALL').sort().map(p => <option key={p}>{p}</option>)}</select></label>
      <label>Sumber<select aria-label="Sumber Spreadsheet Pintar" value={source} onChange={e => updateFilter(setSource)(e.target.value)} disabled={sync.busy}><option value="ALL">DS + REG</option><option>DS</option><option>REG</option></select></label>
      <label>JAM<select aria-label="JAM Spreadsheet Pintar" value={jam} onChange={e => updateFilter(setJam)(e.target.value)}><option value="ALL">Semua JAM</option><option value="LATEST">JAM terbaru{latestHour ? ` (${latestHour})` : ''}</option>{hourOptions.map(h => <option key={h}>{h}</option>)}{!['ALL', 'LATEST'].includes(jam) && !hourOptions.includes(jam) && <option value={jam}>{jam} · tidak ada data</option>}</select></label>
      <label>Status<select aria-label="Status Spreadsheet Pintar" value={status} onChange={e => updateFilter(setStatus)(e.target.value)}><option value="ALL">Semua status ({matching.length})</option><option value="ACTIVE">Belum DONE ({matching.length - doneCount})</option><option value="DONE">DONE ({doneCount})</option><option value="EMPTY">Belum diisi</option></select></label>
    </div>
    <div className="smart-table-tools"><span>Klik isian untuk mengedit · biru menandai isian dari jam sebelumnya</span><label><input type="checkbox" checked={extra} onChange={e => setExtra(e.target.checked)}/>Detail AC / PIC</label><button className="secondary-button" disabled={!visible.length} onClick={copy}><Copy size={14}/>Salin tampilan</button></div>
    <div className="smart-table-scroll" role="region" aria-label="Tabel Spreadsheet Pintar, geser untuk kolom lain" tabIndex={0}><table className="smart-table"><thead><tr>{columns.map(col => <th key={col.key} scope="col" aria-sort={sort.key === col.key ? sort.desc ? 'descending' : 'ascending' : 'none'}><button onClick={() => { setSort({ key: col.key, desc: sort.key === col.key && !sort.desc }); setPage(0) }}>{col.label}<ArrowDownUp size={12}/></button></th>)}<th scope="col">Riwayat</th></tr></thead><tbody>{shown.map(entry => <tr key={entry.key} className={isDoneOrder(entry.effective) ? 'smart-done' : ''}>{columns.map(col => {
      const editable = FOLLOW_UP_FIELDS.some(f => f.key === col.key)
      const value = entry.effective[col.key]
      const inherited = entry.inherited[col.key]
      const label = textValue(value)
      const tooltip = inherited ? `${label} · Dari JAM ${inherited.jam}, belum tersimpan` : label
      return <td key={col.key} className={`${inherited ? 'smart-inherited' : ''} ${col.key === 'kendala' ? 'smart-note-cell' : ''} ${col.key === 'kondisiMotor' && norm(value) === 'RUSAK' ? 'smart-broken' : ''}`}>
        {col.key === 'shipment' ? <strong>{value}</strong> : editable ?
          <button className="smart-edit-cell" title={tooltip} disabled={!writable || sync.busy} onClick={() => setEditor({ entry, focus: col.key })} aria-label={`Edit ${col.label} ${entry.row.shipment}`}><span>{label || '—'}</span><Pencil size={11}/></button> :
          <span className="smart-cell-text" title={label}>{label || '—'}</span>}
      </td>
    })}<td><button className="smart-history-button" title={entry.conflicts.length ? 'Isian sumber berbeda · periksa riwayat' : entry.hours.join(' → ')} aria-label={`Riwayat ${entry.row.shipment}${entry.conflicts.length ? ', isian sumber berbeda' : ''}`} onClick={() => setEditor({ entry, history: true })}><History size={14}/>{entry.conflicts.length ? 'Periksa' : 'Lihat'}</button></td></tr>)}</tbody></table></div>
    {!visible.length && <div className="smart-empty">{connection?.phase === 'loading' ? 'Memuat data spreadsheet…' : 'Tidak ada Shipment yang cocok. Sesuaikan PIC, JAM, atau status.'}</div>}
    <footer className="smart-footer"><span>{visible.length ? currentPage * 50 + 1 : 0}–{Math.min((currentPage + 1) * 50, visible.length)} dari {visible.length} Shipment · 50 baris per halaman</span><div><button className="icon-button" aria-label="Halaman sebelumnya" disabled={!currentPage} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={17}/></button><span>{currentPage + 1} / {pageCount}</span><button className="icon-button" aria-label="Halaman berikutnya" disabled={currentPage + 1 >= pageCount} onClick={() => setPage(currentPage + 1)}><ChevronRight size={17}/></button></div></footer>
    {editor && <FollowUpEditor key={`${editor.entry.row.id || editor.entry.row.sheetRow}:${editor.history ? 'history' : 'edit'}`} {...editor} onEditRow={row => setEditor({entry:{...editor.entry,row,effective:row,inherited:{}},focus:'sheetStatus'})} groupingOptions={groupingOptions} pic={profile.name} writable={writable} onClose={() => setEditor(null)} onSaved={() => { setEditor(null); connection?.refresh(); window.dispatchEvent(new Event('sapa:sheets-changed')); showToast?.('Isian follow up tersimpan di baris terpilih.', 'success') }}/>} 
  </section>
}

function FollowUpEditor({ entry, focus, history, pic, writable, onClose, onSaved, groupingOptions, onEditRow }) {
  const dialog = useRef(null)
  const [draft, setDraft] = useState(() => Object.fromEntries(FOLLOW_UP_FIELDS.map(f => [f.key, textValue(entry.effective[f.key])])) )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = FOLLOW_UP_FIELDS.some(f => draft[f.key] !== textValue(entry.row[f.key]))
  usePicEditing(!history && (dirty || busy))
  useEffect(() => { dialog.current.showModal(); if (focus) dialog.current.querySelector(`[name="${focus}"]`)?.focus() }, [focus])
  const save = async event => {
    event.preventDefault(); if (!writable || busy) return
    const changes = {}, expected = {}
    for (const field of FOLLOW_UP_FIELDS) if (draft[field.key] !== textValue(entry.row[field.key])) { changes[field.key] = draft[field.key]; expected[field.key] = textValue(entry.row[field.key]) }
    setBusy(true); setError('')
    try {
      const row = entry.row
      await sourceRequest('/api/orders', { method: 'PATCH', body: { pic, source: row.source, mode: row.sheetMode, date: row.sheetDate, sheetRow: row.sheetRow, shipment: row.shipment, store: row.kodeToko, changes, expected } })
      onSaved()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }
  return createPortal(<dialog ref={dialog} className="help-dialog smart-editor" aria-labelledby="smart-editor-title" onCancel={e => { e.preventDefault(); if (!busy) onClose() }}><div className="help-content"><header className="field-heading"><div><h2 id="smart-editor-title">{history ? 'Riwayat per JAM' : 'Isian follow up'}</h2><p>{entry.row.shipment} · {entry.row.source} · {entry.row.kodeToko}</p></div><button className="icon-button" aria-label="Tutup isian" disabled={busy} onClick={onClose}><X size={20}/></button></header>
    {history ? <div className="smart-history">{entry.history.toReversed().map(row => <article key={row.id || row.sheetRow}><h3>JAM {normalizeMonitoringHour(row.jam) || 'belum diisi'} <small>Baris {row.sheetRow}</small></h3><dl>{FOLLOW_UP_FIELDS.map(f => <div key={f.key}><dt>{f.label}</dt><dd>{textValue(row[f.key]) || '—'}</dd></div>)}</dl>{writable && <button type="button" className="secondary-button" onClick={() => onEditRow(row)}><Pencil size={13}/>Edit baris {row.sheetRow}</button>}</article>)}</div> : <form onSubmit={save}><p className="smart-notice">Disimpan ke baris {entry.row.sheetRow}, JAM {normalizeMonitoringHour(entry.row.jam) || 'belum diisi'}. Kolom berwarna menunjukkan isian dari JAM sebelumnya. Periksa sebelum menyimpan.</p><div className="smart-editor-fields">{FOLLOW_UP_FIELDS.map(field => <label key={field.key}>{field.label}{entry.inherited[field.key] && <small>Dari JAM {entry.inherited[field.key].jam}</small>}{field.key === 'kendala' ? <textarea name={field.key} aria-label={field.label} value={draft[field.key]} maxLength={field.max} rows={3} disabled={busy} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}/> : <input name={field.key} aria-label={field.label} value={draft[field.key]} maxLength={field.max} inputMode={field.key === 'jumlahPersonil' ? 'numeric' : undefined} list={field.key === 'sheetStatus' ? 'smart-status-options' : field.key === 'kondisiMotor' ? 'smart-motor-options' : field.key === 'grouping' ? 'smart-grouping-options' : undefined} disabled={busy} onChange={e => setDraft({ ...draft, [field.key]: e.target.value })}/>}</label>)}</div><datalist id="smart-status-options"><option value="Proses"/><option value="Done (Sudah dihubungi)"/><option value="Tidak dapat dihubungi"/></datalist><datalist id="smart-grouping-options">{groupingOptions.map(value => <option key={value} value={value}/>)}</datalist><datalist id="smart-motor-options"><option value="Baik"/><option value="Rusak"/></datalist>{error && <div className="profile-error" role="alert">{error}</div>}<div className="smart-editor-actions"><button className="secondary-button" type="button" disabled={busy} onClick={onClose}>Batal</button><button className="primary-button" type="submit" disabled={!dirty || busy || !writable}><Save size={16}/>{busy ? 'Menyimpan…' : 'Simpan ke spreadsheet'}</button></div></form>}
  </div></dialog>, document.body)
}
