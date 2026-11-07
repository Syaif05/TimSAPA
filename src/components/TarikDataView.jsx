import { recordActivity } from '../utils/activityTracker'
import { FileUpload } from './FileUpload'
import React, { useMemo, useState } from 'react'
import { sourceRequest } from '../cloud/GoogleAdmin'
import { usePicProfile } from '../profiles/ProfileContext'
import { ClipboardCopy, UploadCloud } from 'lucide-react'
import { filterNewTarikRows, parseTarikCsv, TARIK_COLUMNS, tarikHtml, tarikTsv } from '../utils/tarikData.js'
import { jakartaDate } from '../utils/sheetsConfig.js'

export function TarikDataView({ contacts = [], contactsReady = false, monitoringMode = 'daily', showToast }) {
  const profile = usePicProfile()
  const [updating, setUpdating] = useState(false)
  const [updateReport, setUpdateReport] = useState(null)
  const [rows, setRows] = useState([])
  const [comparison, setComparison] = useState(null)
  const [checking, setChecking] = useState(false)
  const [copyReport, setCopyReport] = useState(null)
  const [filename, setFilename] = useState('')
  const [source, setSource] = useState('REG')
  const [error, setError] = useState('')
  const shown = useMemo(() => (comparison?.fresh || filterNewTarikRows(rows, []).fresh).filter(row => row.source === source), [comparison, source])
  const report = useMemo(() => Object.fromEntries(['REG', 'DS'].map(type => [type, {
    total: rows.filter(row => row.source === type).length,
    fresh: comparison?.fresh.filter(row => row.source === type).length || 0,
    duplicate: comparison?.duplicate.filter(row => row.source === type).length || 0,
  }])), [rows, comparison])
  const checkMonitoring = async imported => {
    setChecking(true)
    try {
      const params = new URLSearchParams({ mode: monitoringMode, fresh: '1', ...(monitoringMode === 'daily' ? { date: jakartaDate() } : {}) })
      const response = await fetch(`/api/sheets?${params}`, { cache: 'no-store' })
      if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'Data Monitoring belum dapat dibaca.') }
      const data = await response.json()
      if (!Array.isArray(data.rows) || !Array.isArray(data.sources) || !['REG', 'DS'].every(type => data.sources.some(item => item.key === type)) || data.stale) throw new Error('Data Monitoring belum lengkap atau belum terbaru. Coba periksa ulang.')
      const result = filterNewTarikRows(imported, data.rows)
      setComparison(result)
      setError('')
      return result
    } catch (cause) { setComparison(null); setError(cause.message); throw cause }
    finally { setChecking(false) }
  }
  const load = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setRows([]); setComparison(null); setCopyReport(null); setError(''); setFilename('')
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Pilih file mentah berformat .csv.')
      if (file.size > 20_000_000) throw new Error('Ukuran CSV maksimal 20 MB.')
      const result = parseTarikCsv(await file.text(), contacts)
      if (!result.length) throw new Error('CSV tidak berisi pesanan.')
      recordActivity('tarik_upload',result.length,'tarik-data'); setRows(result); setFilename(file.name); setSource('REG')
      await checkMonitoring(result)
    } catch (cause) { setError(cause.message) }
    event.target.value = ''
  }
  const copy = async () => {
    try {
      const current = await checkMonitoring(rows)
      const fresh = current.fresh.filter(row => row.source === source)
      if (!fresh.length) { showToast?.(`Tidak ada shipment baru untuk ${source}.`, 'info'); return }
      const plain = tarikTsv(fresh)
      if (navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], {type:'text/plain'}), 'text/html': new Blob([tarikHtml(fresh)], {type:'text/html'}) })])
      } else await navigator.clipboard.writeText(plain)
      recordActivity('tarik_copy',fresh.length,'tarik-data')
      const ignored = current.duplicate.filter(row => row.source === source).length
      setCopyReport({ source, copied: fresh.length, ignored })
      showToast?.(`${fresh.length} shipment baru ${source} disalin; ${ignored} duplikat diabaikan.`, 'success')
    } catch (cause) { showToast?.(cause.message || 'Gagal menyalin. Periksa izin clipboard browser.', 'error') }
  }
  const updateDirect = async () => {
    if (updating) return
    setUpdating(true); setUpdateReport(null); setError('')
    try {
      const result = await sourceRequest('/api/tarik-update', {method:'POST',body:{pic:profile.name,date:jakartaDate(),source,rows:rows.filter(row=>row.source===source)}})
      recordActivity('tarik_update',result.inserted,'tarik-data')
      setUpdateReport(result)
      showToast?.(`${result.inserted} baris ${source} ditambahkan; ${result.ignored} duplikat diabaikan.`, 'success')
      await checkMonitoring(rows)
    } catch(cause) { setError(cause.message); showToast?.(cause.message,'error') }
    finally {setUpdating(false)}
  }
  return <section className="tarik-data-page">
    <div className="page-heading"><div><p className="eyebrow">SAPA / OPERASIONAL</p><h1>Tarik Data</h1><p>Unggah CSV mentah dari Data Studio, periksa hasil REG dan DS, lalu salin ke spreadsheet masing-masing.</p></div></div>
    <div className="tarik-upload-panel">
      <FileUpload accept=".csv" onChange={load} filename={filename} busy={checking || updating} disabled={checking || updating} title="Unggah CSV Data Studio" hint="Seret CSV mentah ke sini untuk memeriksa shipment REG dan DS."/>
      <p>Shipment dibandingkan dengan semua PIC dan semua status pada Monitoring {monitoringMode === 'daily' ? 'hari ini' : 'terhubung'}, termasuk DONE. Duplikat dalam CSV juga diabaikan. Salinan hanya berisi baris baru, tanpa header, berformat Calibri 11 pt.</p>
      {!contactsReady && <p className="tarik-warning">Sumber kontak belum siap. No AC dan No AM akan kosong sampai data kontak tersedia; unggah ulang CSV setelah kontak terhubung.</p>}
      {error && <p className="tarik-error" role="alert">{error}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="tarik-results-head"><div><strong>Hasil {filename}</strong><span>{comparison ? `REG: ${report.REG.fresh} baru, ${report.REG.duplicate} duplikat · DS: ${report.DS.fresh} baru, ${report.DS.duplicate} duplikat` : 'Perbandingan Monitoring belum tersedia.'}</span><span>{rows.filter(row => !row.noAc).length} tanpa No AC · {rows.filter(row => !row.noAm).length} tanpa No AM</span></div><div className="tarik-source-tabs" role="group" aria-label="Jenis hasil"><button disabled={updating} aria-pressed={source === 'REG'} onClick={() => setSource('REG')}>REG</button><button disabled={updating} aria-pressed={source === 'DS'} onClick={() => setSource('DS')}>DS</button></div><button className="secondary-button" disabled={checking || updating} onClick={() => checkMonitoring(rows).catch(() => {})}>{checking ? 'Memeriksa…' : 'Periksa ulang'}</button><button className="primary-button" disabled={!comparison || !shown.length || checking || updating} onClick={copy}><ClipboardCopy size={15}/> Salin {source} ({shown.length})</button></div>
      <div className="tarik-upload-panel"><button className="primary-button" disabled={updating || checking || !shown.length || monitoringMode !== 'daily'} onClick={updateDirect}><UploadCloud size={16}/>{updating ? 'Memperbarui spreadsheet…' : `Update Langsung ${source} (${shown.length})`}</button><p>Tujuan: {source} {jakartaDate()} (tab hari ini). Hanya menulis nilai B:L, sama dengan Salin manual. Tidak mengubah kolom lain, format, dropdown, rumus, atau urutan baris. Jika tab hari ini belum ada, duplikat REG dan DS kemarin dan sisakan baris 1–3 pada tab baru. Maksimal 5.000 baris per update. Hanya berjalan saat tombol ditekan.</p>{monitoringMode !== 'daily' && <p className="tarik-warning">Pilih sumber Monitoring harian untuk Update Langsung.</p>}</div>
      {updateReport && <p className="tarik-copy-report" role="status">Update {updateReport.source}: <strong>{updateReport.inserted} baris ditambahkan</strong> · {updateReport.ignored} duplikat diabaikan · {updateReport.sheet || 'Tidak ada data baru'}.{updateReport.createdSheets?.length > 0 && ` Tab baru: ${updateReport.createdSheets.join(', ')}; baris 1–3 dipertahankan.`}</p>}
      <div className="tarik-table-wrap"><table className="tarik-table"><thead><tr>{TARIK_COLUMNS.map(([field,label]) => <th key={field}>{label}</th>)}</tr></thead><tbody>{shown.slice(0,100).map((row,index) => <tr key={`${row.shipment}-${index}`}>{TARIK_COLUMNS.map(([field]) => <td key={field} title={row[field]}>{row[field] || '—'}</td>)}</tr>)}</tbody></table></div>
      <p className="tarik-result-note">{!comparison && 'Perbandingan belum tersedia. Pratinjau ini hanya menghapus duplikat dalam CSV; server mengecek ulang saat Update Langsung. '}{report[source].total} baris {source} ditarik · {report[source].fresh} baru siap disalin · {report[source].duplicate} duplikat diabaikan. Pratinjau menampilkan maksimal 100 baris baru; Salin memuat seluruh baris baru tanpa nama kolom.</p>
      {copyReport && <p className="tarik-copy-report" role="status">Penyalinan terakhir {copyReport.source}: <strong>{copyReport.copied} baris berhasil disalin</strong> · {copyReport.ignored} baris duplikat diabaikan.</p>}
    </>}
  </section>
}
