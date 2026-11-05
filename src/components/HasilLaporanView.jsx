import { REPORT_DESIGN, cleanReportDesign, reportPeriodAt } from '../utils/reportDesign'
import { sourceRequest } from '../cloud/GoogleAdmin'
import { FileUpload } from './FileUpload'
import React, { useMemo, useRef, useState, useEffect } from 'react'
import { ClipboardCopy, Download, Settings2, Check } from 'lucide-react'
import { REPORT_DEFAULTS, REPORT_FIELDS, parseReportRows, reportOptions, buildReport, reportTsv } from '../utils/hasilLaporan.js'
import { copyTableImageToClipboard, downloadTableImage } from '../utils/imageGenerator.js'
import './hasilLaporan.css'

function NameFilter({ title, names, selected, onChange }) {
  const [search, setSearch] = useState('')
  const visible = names.filter(name => name.toLowerCase().includes(search.toLowerCase()))
  return <fieldset className="report-names"><legend>{title} <span>{selected.length}/{names.length}</span></legend><input aria-label={`Cari ${title}`} placeholder="Cari nama…" value={search} onChange={event => setSearch(event.target.value)}/><div className="report-name-actions"><button type="button" onClick={() => onChange([...new Set([...selected, ...visible])])}>Pilih semua</button><button type="button" onClick={() => onChange(selected.filter(name => !visible.includes(name)))}>Kosongkan</button></div><div className="report-name-list">{visible.map(name => <label key={name}><input type="checkbox" checked={selected.includes(name)} onChange={event => onChange(event.target.checked ? [...selected, name] : selected.filter(item => item !== name))}/>{name}</label>)}{!visible.length && <p>Nama tidak ditemukan.</p>}</div></fieldset>
}
export function ReportTables({ report, options, summaryRef, detailRef }) {
  return <div className="report-tables">
    <div hidden={options.showSummary === false} ref={summaryRef} className="report-table-capture"><table><thead><tr><th>Row Labels</th><th>Distinct Count of store_id</th><th>Count of nomor_shipment</th></tr></thead><tbody>{report.summary.map(row => <tr key={row.name}><td>{row.name}</td><td>{row.stores}</td><td>{row.shipments}</td></tr>)}</tbody><tfoot><tr><th>Grand Total</th><td>{report.stores}</td><td>{report.shipments}</td></tr></tfoot></table></div>
    <div hidden={options.showDetail === false} ref={detailRef} className="report-table-capture"><table><thead><tr><th>Count of nomor_shipment</th><th colSpan={Math.max(1, report.names.length + 1)}>Column Labels</th></tr><tr><th>Row Labels</th>{report.names.map(name => <th key={name}>{name}</th>)}<th>Grand Total</th></tr></thead><tbody>{report.detail.map(row => <tr key={row.label}><td>{row.label}</td>{report.names.map(name => <td key={name}>{row.counts[name] || (options.showZero ? 0 : '')}</td>)}<td>{row.total}</td></tr>)}</tbody><tfoot><tr><th>Grand Total</th>{report.names.map(name => <td key={name}>{report.columnTotals[name]}</td>)}<td>{report.detailTotal}</td></tr></tfoot></table></div>
  </div>
}
export function ResponsiveReportPreview({ captureRef, children }) {
  const stage = useRef(null)
  const [size, setSize] = useState({ scale:1, height:0 })
  useEffect(() => {
    const content = captureRef.current
    if (!content || !stage.current) return
    const measure = () => {
      const scale = Math.min(1, stage.current.clientWidth / Math.max(1, content.offsetWidth))
      setSize({ scale, height: Math.ceil(content.offsetHeight * scale) })
    }
    const observer = new ResizeObserver(measure)
    observer.observe(stage.current); observer.observe(content); measure()
    return () => observer.disconnect()
  }, [captureRef])
  return <div className="report-preview-scroll"><div ref={stage} className="report-preview-stage" style={{ height:size.height }}><div className="report-preview-scale" style={{ transform:`scale(${size.scale})` }}>{children}</div></div></div>
}
export function HasilLaporanView({ storage, pic, showToast }) {
  const [clock, setClock] = useState(() => new Date())
  useEffect(() => {
    let timer
    const tick = () => { clearTimeout(timer); setClock(new Date()); timer = setTimeout(tick, 60000 - Date.now() % 60000) }
    tick(); document.addEventListener('visibilitychange', tick)
    return () => { clearTimeout(timer); document.removeEventListener('visibilitychange', tick) }
  }, [])
  const [shared, setShared] = useState(null)
  const [savingDesign, setSavingDesign] = useState(false)
  const dirtyDesign = useRef(false)
  const loadDesign = async (force = false) => {
    try { const record = await sourceRequest('/api/report-design'); setShared(record); if (record.design && (!dirtyDesign.current || force)) { setOptions(previous => ({ ...previous, ...cleanReportDesign(record.design) })); dirtyDesign.current = false } }
    catch (cause) { if (force) showToast?.(cause.message, 'error') }
  }
  useEffect(() => { loadDesign(); const timer = setInterval(() => { if (!document.hidden) loadDesign() }, 30000); return () => clearInterval(timer) }, [])
  const saveDesign = async () => {
    setSavingDesign(true)
    try { const design = cleanReportDesign(options); const record = await sourceRequest('/api/report-design', { method:'PUT', body:{pic,design} }); setShared(record); dirtyDesign.current=false; showToast?.('Desain disimpan untuk semua PIC.', 'success') }
    catch (cause) { showToast?.(cause.message,'error') } finally { setSavingDesign(false) }
  }
  const [imported, setImported] = useState(null)
  const [book, setBook] = useState(null)
  const [sheet, setSheet] = useState('')
  const [filename, setFilename] = useState('')
  const [busy, setBusy] = useState('')
  const [error, setError] = useState('')
  const [options, setOptions] = useState(() => { try { return { ...REPORT_DEFAULTS, ...REPORT_DESIGN, ...JSON.parse(storage?.getItem('sapa_report_preferences') || '{}'), names: [], detailNames: [] } } catch { return { ...REPORT_DEFAULTS, ...REPORT_DESIGN } } })
  const period = options.periodAutomatic !== false ? reportPeriodAt(clock) : options.period
  const capture = useRef(null), summary = useRef(null), detail = useRef(null)
  const [target, setTarget] = useState('both')
  const [copied, setCopied] = useState(false)
  const available = useMemo(() => reportOptions(imported?.rows || []), [imported])
  const report = useMemo(() => buildReport(imported?.rows || [], options), [imported, options])
  const update = (key, value) => { if (key in REPORT_DESIGN) dirtyDesign.current = true; setOptions(previous => ({ ...previous, [key]: value })); setCopied(false) }
  useEffect(() => { try { const { names: _names, detailNames: _detailNames, start: _start, end: _end, ...saved } = options; storage?.setItem('sapa_report_preferences', JSON.stringify(saved)) } catch {} }, [options, storage])
  const loadSheet = async (workbook, name) => {
    const XLSX = await import('xlsx')
    const data = parseReportRows(XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: '', raw: true }), XLSX.SSF.parse_date_code)
    const choices = reportOptions(data.rows)
    setImported(data); setSheet(name)
    setOptions(previous => ({ ...previous, names: choices.names, detailNames: choices.names, start: choices.dates.at(-1) || '', end: choices.dates.at(-1) || '' }))
  }
  const upload = async event => {
    const file = event.target.files?.[0]; event.target.value = ''
    if (!file) return
    setBusy('upload'); setError(''); setCopied(false)
    try {
      if (!/\.(xlsx|xls|csv)$/i.test(file.name)) throw new Error('Pilih file .xlsx, .xls, atau .csv hasil follow up.')
      if (file.size > 20_000_000) throw new Error('Ukuran file maksimal 20 MB.')
      const XLSX = await import('xlsx')
      const workbook = XLSX.read(await file.arrayBuffer(), { type: 'array' })
      if (!workbook.SheetNames.length) throw new Error('File tidak memiliki worksheet.')
      const name = workbook.SheetNames.find(item => item.toLowerCase() === 'history') || workbook.SheetNames[0]
      await loadSheet(workbook, name)
      setBook(workbook); setFilename(file.name)
    } catch (cause) { setImported(null); setBook(null); setFilename(''); setError(cause.message) }
    finally { setBusy('') }
  }
  const imageAction = async mode => {
    setBusy(mode); setCopied(false)
    try {
      const node = target === 'summary' && options.showSummary === false ? null : target === 'detail' && options.showDetail === false ? null : target === 'summary' ? summary.current : target === 'detail' ? detail.current : capture.current
      if (!node) throw new Error('Tabel yang dipilih sedang disembunyikan. Pilih Kedua tabel atau aktifkan tabelnya.')
      if (mode === 'copy') {
        const result = await copyTableImageToClipboard(node, { pixelRatio:4 })
        if (!result.success) throw new Error(result.error)
        setCopied(true); showToast?.('Gambar laporan disalin.', 'success')
      } else await downloadTableImage(node, `hasil-laporan-${options.start || 'semua-tanggal'}-${target}.png`, { pixelRatio:4 })
    } catch (cause) { showToast?.(cause.message || 'Gagal membuat gambar laporan.', 'error') }
    finally { setBusy('') }
  }
  const invalidRange = options.start && options.end && options.start > options.end
  const empty = !report.shipments && !report.detailTotal
  return <section className="hasil-laporan-page">
    <div className="page-heading"><p className="eyebrow">SAPA / OPERASIONAL</p><h1>Hasil Laporan</h1><p>Unggah hasil follow up, pilih tanggal dan nama, lalu salin laporan sebagai gambar.</p></div>
    <div className="report-upload-panel"><FileUpload accept=".xlsx,.xls,.csv" onChange={upload} filename={filename} busy={busy === 'upload'} disabled={!!busy} title="Unggah hasil follow up" hint="Seret ekspor pending_delivery_follow_up. Laporan dihitung otomatis di browser."/><div><strong>{filename || 'Gunakan ekspor pending_delivery_follow_up'}</strong><p>File diproses di browser. Data mentah tersedia selama halaman aplikasi ini tetap terbuka.</p></div>{book && book.SheetNames.length > 1 && <label>Worksheet<select value={sheet} disabled={!!busy} onChange={async event => { setBusy('upload'); setError(''); try { await loadSheet(book, event.target.value) } catch (cause) { setImported(null); setError(cause.message) } finally { setBusy('') } }}>{book.SheetNames.map(name => <option key={name}>{name}</option>)}</select></label>}</div>
    {error && <p className="report-error" role="alert">{error}</p>}
    {!imported && <div className="report-empty"><Settings2 size={28}/><h2>Laporan otomatis dari data mentah</h2><p>Ringkasan menghitung toko unik dan jumlah shipment per nama. Rincian mengelompokkan kendala atau kategori pilihan, seperti PivotTable pada contoh.</p></div>}
    {imported && <>
      <div className="report-import-note">{imported.rows.length.toLocaleString('id-ID')} baris dibaca · {available.names.length} nama · {available.dates.length} tanggal. Tanggal terbaru dipilih otomatis. {imported.ignored > 0 && `${imported.ignored} baris tanpa shipment diabaikan.`}</div>
      {(imported.undated > 0 || imported.duplicates > 0) && <p className="report-warning">{imported.undated > 0 && `${imported.undated} baris tidak memiliki tanggal yang terbaca; baris tersebut hanya masuk jika filter tanggal dikosongkan. `}{imported.duplicates > 0 && `${imported.duplicates} kemunculan shipment berulang tetap dihitung sebagai riwayat follow up, sesuai Count pada PivotTable.`}</p>}
      <div className="report-workspace"><aside className="report-settings"><h2><Settings2 size={17}/> Pengaturan laporan</h2><div className="report-shared"><strong>Desain bersama tim</strong><p>{shared?.savedBy ? `Terakhir: ${shared.savedBy} · ${new Date(shared.savedAt).toLocaleString('id-ID')}` : 'Belum ada desain bersama tersimpan.'}</p><button className="primary-button" disabled={savingDesign} onClick={saveDesign}>{savingDesign?'Menyimpan…':'Simpan untuk semua PIC'}</button><button className="report-text-button" onClick={() => loadDesign(true)}>Gunakan desain terbaru</button></div><label>Desain gambar<select value={options.theme} onChange={event=>update('theme',event.target.value)}><option value="blue">Spreadsheet Biru</option><option value="green">Hijau Operasional</option><option value="slate">Profesional Gelap</option><option value="minimal">Minimal Monokrom</option></select></label><label>Waktu laporan<select value={options.periodAutomatic !== false ? 'auto' : options.period} onChange={event=>{update('periodAutomatic',event.target.value === 'auto');if(event.target.value !== 'auto')update('period',event.target.value)}}><option value="auto">Otomatis WIB · {reportPeriodAt(clock)}</option>{['Pagi','Sore','Malam'].map(value=><option key={value}>{value}</option>)}</select><small>07:00–14:00 Pagi · 14:01–18:00 Sore · 18:01–06:59 Malam</small></label>{[['showTitle','Judul laporan'],['showPeriod','Tulisan waktu laporan'],['showDate','Tanggal laporan'],['showSummary','Tabel ringkasan'],['showDetail','Tabel rincian'],['showTotals','Grand Total']].map(([key,label])=><label className="report-checkbox" key={key}><input type="checkbox" checked={options[key]} onChange={event=>{if(['showSummary','showDetail'].includes(key)&&!event.target.checked&&!options[key==='showSummary'?'showDetail':'showSummary'])return;update(key,event.target.checked)}}/>{label}</label>)}<label>Catatan di bawah gambar<input value={options.footer} maxLength={200} onChange={event=>update('footer',event.target.value)}/></label><label>Judul laporan<input value={options.title} maxLength={150} onChange={event => update('title', event.target.value)}/></label><div className="report-date-fields"><label>Dari<input type="date" value={options.start} onChange={event => update('start', event.target.value)}/></label><label>Sampai<input type="date" value={options.end} onChange={event => update('end', event.target.value)}/></label></div><button className="report-text-button" onClick={() => setOptions(previous => ({ ...previous, start: '', end: '' }))}>Semua tanggal</button>
      <label>Kategori data<select value={options.category} onChange={event => update('category', event.target.value)}><option value="">Semua kategori</option>{available.categories.map(item => <option key={item} value={item || '__EMPTY__'}>{item || '(Kosong)'}</option>)}</select></label><label>Sudah follow up<select value={options.followed} onChange={event => update('followed', event.target.value)}><option value="">Semua</option><option value="Y">Y — Sudah</option><option value="N">N — Belum</option></select></label>
      <NameFilter title="Nama pada ringkasan" names={available.names} selected={options.names} onChange={value => update('names', value)}/><label className="report-checkbox"><input type="checkbox" checked={options.separateNames} onChange={event => update('separateNames', event.target.checked)}/> Pilih nama rincian secara terpisah</label>{options.separateNames && <NameFilter title="Nama pada rincian" names={available.names} selected={options.detailNames} onChange={value => update('detailNames', value)}/>}
      <label>Urutan ringkasan<select value={options.summarySort} onChange={event => update('summarySort', event.target.value)}><option value="stores-desc">Jumlah toko terbanyak</option><option value="shipments-desc">Jumlah shipment terbanyak</option><option value="name">Nama A ke Z</option></select></label><label>Baris rincian<select value={options.field} onChange={event => update('field', event.target.value)}>{Object.entries(REPORT_FIELDS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label>Urutan rincian<select value={options.detailSort} onChange={event => update('detailSort', event.target.value)}><option value="count-desc">Jumlah shipment terbanyak</option><option value="name">Abjad A ke Z</option></select></label><label>Ukuran font<select value={options.fontSize} onChange={event => update('fontSize', Number(event.target.value))}>{[10,11,12,14].map(size => <option key={size} value={size}>{size} pt</option>)}</select></label><label className="report-checkbox"><input type="checkbox" checked={options.countBlankStores} onChange={event => update('countBlankStores', event.target.checked)}/> Hitung toko kosong sebagai satu nilai</label><label className="report-checkbox"><input type="checkbox" checked={options.showZero} onChange={event => update('showZero', event.target.checked)}/> Tampilkan angka nol</label><label className="report-checkbox"><input type="checkbox" checked={options.grid} onChange={event => update('grid', event.target.checked)}/> Tampilkan garis sel</label></aside>
      <div className="report-result"><div className="report-result-toolbar"><div><strong>Pratinjau laporan</strong><span>{report.shipments.toLocaleString('id-ID')} shipment · {report.stores.toLocaleString('id-ID')} toko unik</span></div><select aria-label="Bagian gambar" value={target} onChange={event => setTarget(event.target.value)}><option value="both">Kedua tabel</option><option value="summary">Ringkasan saja</option><option value="detail">Rincian saja</option></select><button className="secondary-button" disabled={!!busy || empty || invalidRange} onClick={() => imageAction('download')}><Download size={15}/> PNG</button><button className="primary-button" disabled={!!busy || empty || invalidRange} onClick={() => imageAction('copy')}>{copied ? <Check size={15}/> : <ClipboardCopy size={15}/>} {busy === 'copy' ? 'Menyalin…' : copied ? 'Tersalin' : 'Salin gambar'}</button><button className="report-text-button" disabled={empty || invalidRange} onClick={async () => { try { await navigator.clipboard.writeText(reportTsv(report)); showToast?.('Data laporan disalin untuk Excel / Sheets.', 'success') } catch { showToast?.('Gagal menyalin data. Periksa izin clipboard.', 'error') } }}>Salin data</button></div>
      {invalidRange ? <p className="report-error" role="alert">Tanggal akhir harus sama atau setelah tanggal awal.</p> : empty ? <div className="report-empty"><h2>Tidak ada data sesuai filter</h2><p>Pilih nama, tanggal, atau kategori lain untuk menampilkan laporan.</p></div> : <ResponsiveReportPreview captureRef={capture}><div ref={capture} className={`report-capture ${options.grid ? 'report-grid' : ''} report-theme-${options.theme} ${options.showTotals === false ? 'report-no-totals' : ''}`} style={{ fontSize: `${options.fontSize}pt` }}>{options.showTitle && options.title && <h2>{options.title}</h2>}{options.showPeriod && <div className="report-period-badge">Laporan Follow Up · {period}</div>}{options.showDate && <p className="report-period">{options.start || options.end ? `${options.start || 'Awal data'} — ${options.end || 'Akhir data'}` : 'Semua tanggal'}</p>}<ReportTables report={report} options={options} summaryRef={summary} detailRef={detail}/>{options.footer && <p className="report-image-footer">{options.footer}</p>}</div></ResponsiveReportPreview>}
      <p className="report-calculation-note">Shipment = jumlah baris dengan nomor shipment. Toko unik = kode toko berbeda; {options.countBlankStores ? 'kode kosong dihitung satu nilai, seperti DISTINCTCOUNT Excel.' : 'kode kosong tidak dihitung.'} Grand Total toko dihitung dari gabungan toko terpilih, sehingga bisa berbeda dari penjumlahan tiap nama. Kolom nama rincian diurutkan A ke Z.{options.separateNames && ' Pilihan nama kedua tabel berbeda; totalnya dapat berbeda.'}</p></div></div>
    </>}
  </section>
}
