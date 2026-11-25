import { recordActivity } from '../utils/activityTracker'
import { FileUpload } from './FileUpload'
import React, { useMemo, useState } from 'react'
import { sourceRequest } from '../cloud/GoogleAdmin'
import { usePicProfile } from '../profiles/ProfileContext'
import { ClipboardCopy, UploadCloud } from 'lucide-react'
import { parseTarikCsv, TARIK_COLUMNS, tarikHtml, tarikTsv } from '../utils/tarikData.js'
import { jakartaDate } from '../utils/sheetsConfig.js'

export function TarikDataView({ contacts = [], contactsReady = false, monitoringMode = 'daily', showToast }) {
  const profile = usePicProfile()
  const [updating, setUpdating] = useState(false)
  const [loading, setLoading] = useState(false)
  const [copying, setCopying] = useState(false)
  const [updateReport, setUpdateReport] = useState(null)
  const [rows, setRows] = useState([])
  const [copyReport, setCopyReport] = useState(null)
  const [filename, setFilename] = useState('')
  const [source, setSource] = useState('REG')
  const [error, setError] = useState('')
  const busy = loading || updating || copying
  const shown = useMemo(() => rows.filter(row => row.source === source), [rows, source])
  const counts = useMemo(() => ({ REG: rows.filter(row => row.source === 'REG').length, DS: rows.filter(row => row.source === 'DS').length }), [rows])
  const load = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setLoading(true)
    setRows([]); setCopyReport(null); setUpdateReport(null); setError(''); setFilename('')
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Pilih file mentah berformat .csv.')
      if (file.size > 20_000_000) throw new Error('Ukuran CSV maksimal 20 MB.')
      const result = parseTarikCsv(await file.text(), contacts)
      if (!result.length) throw new Error('CSV tidak berisi pesanan.')
      recordActivity('tarik_upload', result.length, 'tarik-data')
      setRows(result); setFilename(file.name); setSource('REG')
    } catch (cause) { setError(cause.message) }
    finally { setLoading(false); event.target.value = '' }
  }
  const copy = async () => {
    if (busy || !shown.length) return
    setCopying(true)
    try {
      const plain = tarikTsv(shown)
      if (navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], {type:'text/plain'}), 'text/html': new Blob([tarikHtml(shown)], {type:'text/html'}) })])
      } else await navigator.clipboard.writeText(plain)
      recordActivity('tarik_copy', shown.length, 'tarik-data')
      setCopyReport({ source, copied: shown.length })
      showToast?.(`${shown.length} baris ${source} disalin, termasuk Shipment berulang.`, 'success')
    } catch (cause) { showToast?.(cause.message || 'Gagal menyalin. Periksa izin clipboard browser.', 'error') }
    finally { setCopying(false) }
  }
  const updateDirect = async () => {
    if (busy || !shown.length) return
    setUpdating(true); setUpdateReport(null); setError('')
    try {
      const result = await sourceRequest('/api/tarik-update', {method:'POST',body:{pic:profile.name,date:jakartaDate(),source,rows:shown}})
      recordActivity('tarik_update', result.inserted, 'tarik-data')
      setUpdateReport(result)
      showToast?.(`${result.inserted} baris ${source} ditambahkan, termasuk Shipment berulang.`, 'success')
      window.dispatchEvent(new Event('sapa:sheets-changed'))
    } catch(cause) { setError(cause.message); showToast?.(cause.message,'error') }
    finally { setUpdating(false) }
  }
  return <section className="tarik-data-page">
    <div className="page-heading"><div><p className="eyebrow">SAPA / OPERASIONAL</p><h1>Tarik Data</h1><p>Unggah CSV mentah dari Data Studio, periksa hasil REG dan DS, lalu salin ke spreadsheet masing-masing.</p></div></div>
    <div className="tarik-upload-panel">
      <FileUpload accept=".csv" onChange={load} filename={filename} busy={busy} disabled={busy} title="Unggah CSV Data Studio" hint="Seret CSV mentah ke sini untuk menyiapkan seluruh baris REG dan DS."/>
      <p>Semua baris CSV yang memiliki Shipment dipertahankan, termasuk Shipment berulang dan yang sudah ada di Monitoring. Salin manual dan Update Langsung tidak menyaring duplikat. Salinan tanpa header, berformat Calibri 11 pt.</p>
      {!contactsReady && <p className="tarik-warning">Sumber kontak belum siap. No AC dan No AM akan kosong sampai data kontak tersedia; unggah ulang CSV setelah kontak terhubung.</p>}
      {error && <p className="tarik-error" role="alert">{error}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="tarik-results-head"><div><strong>Hasil {filename}</strong><span>REG: {counts.REG} baris · DS: {counts.DS} baris · Semua baris dipertahankan</span><span>{rows.filter(row => !row.noAc).length} tanpa No AC · {rows.filter(row => !row.noAm).length} tanpa No AM</span></div><div className="tarik-source-tabs" role="group" aria-label="Jenis hasil"><button disabled={busy} aria-pressed={source === 'REG'} onClick={() => setSource('REG')}>REG</button><button disabled={busy} aria-pressed={source === 'DS'} onClick={() => setSource('DS')}>DS</button></div><button className="primary-button" disabled={!shown.length || busy} onClick={copy}><ClipboardCopy size={15}/>{copying ? 'Menyalin…' : `Salin ${source} (${shown.length})`}</button></div>
      <div className="tarik-upload-panel"><button className="primary-button" disabled={busy || !shown.length || shown.length > 5000 || monitoringMode !== 'daily'} onClick={updateDirect}><UploadCloud size={16}/>{updating ? 'Memperbarui spreadsheet…' : `Update Langsung ${source} (${shown.length})`}</button><p>Tujuan: {source} {jakartaDate()} (tab hari ini). Setiap klik menambahkan seluruh baris {source}, termasuk Shipment yang sudah ada. Hanya menulis nilai B:L, sama dengan Salin manual. Tidak mengubah kolom lain, format, dropdown, rumus, atau urutan baris. Jika tab hari ini belum ada, duplikat REG dan DS kemarin dan sisakan baris 1–3 pada tab baru. Maksimal 5.000 baris per update. Hanya berjalan saat tombol ditekan.</p>{shown.length > 5000 && <p className="tarik-warning">Hasil {source} melebihi 5.000 baris. Gunakan Salin manual atau unggah CSV dengan maksimal 5.000 baris per kategori untuk Update Langsung.</p>}{monitoringMode !== 'daily' && <p className="tarik-warning">Pilih sumber Monitoring harian untuk Update Langsung.</p>}</div>
      {updateReport && <p className="tarik-copy-report" role="status">Update {updateReport.source}: <strong>{updateReport.inserted} baris ditambahkan</strong> · {updateReport.sheet}.{updateReport.createdSheets?.length > 0 && ` Tab baru: ${updateReport.createdSheets.join(', ')}; baris 1–3 dipertahankan.`}</p>}
      <div className="tarik-table-wrap"><table className="tarik-table"><thead><tr>{TARIK_COLUMNS.map(([field,label]) => <th key={field}>{label}</th>)}</tr></thead><tbody>{shown.slice(0,100).map((row,index) => <tr key={`${row.shipment}-${index}`}>{TARIK_COLUMNS.map(([field]) => <td key={field} title={row[field]}>{row[field] || '—'}</td>)}</tr>)}</tbody></table></div>
      <p className="tarik-result-note">{shown.length} baris {source} siap disalin atau ditambahkan, termasuk Shipment berulang. Pratinjau menampilkan maksimal 100 baris; Salin memuat seluruh baris sesuai urutan CSV tanpa nama kolom.</p>
      {copyReport && <p className="tarik-copy-report" role="status">Penyalinan terakhir {copyReport.source}: <strong>{copyReport.copied} baris berhasil disalin</strong>, termasuk Shipment berulang.</p>}
    </>}
  </section>
}
