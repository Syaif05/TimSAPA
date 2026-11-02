import React, { useMemo, useState } from 'react'
import { ClipboardCopy, FileUp } from 'lucide-react'
import { parseTarikCsv, TARIK_COLUMNS, tarikHtml, tarikTsv } from '../utils/tarikData.js'

export function TarikDataView({ contacts = [], contactsReady = false, showToast }) {
  const [rows, setRows] = useState([])
  const [filename, setFilename] = useState('')
  const [source, setSource] = useState('REG')
  const [error, setError] = useState('')
  const shown = useMemo(() => rows.filter(row => row.source === source), [rows, source])
  const load = async event => {
    const file = event.target.files?.[0]
    if (!file) return
    setRows([]); setError(''); setFilename('')
    try {
      if (!/\.csv$/i.test(file.name)) throw new Error('Pilih file mentah berformat .csv.')
      if (file.size > 20_000_000) throw new Error('Ukuran CSV maksimal 20 MB.')
      const result = parseTarikCsv(await file.text(), contacts)
      if (!result.length) throw new Error('CSV tidak berisi pesanan.')
      setRows(result); setFilename(file.name); setSource('REG')
    } catch (cause) { setError(cause.message) }
    event.target.value = ''
  }
  const copy = async () => {
    try {
      const plain = tarikTsv(shown)
      if (navigator.clipboard.write && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'text/plain': new Blob([plain], {type:'text/plain'}), 'text/html': new Blob([tarikHtml(shown)], {type:'text/html'}) })])
      } else await navigator.clipboard.writeText(plain)
      showToast?.(`${shown.length} baris ${source} disalin. Tempel di sel A1 spreadsheet tujuan.`, 'success')
    } catch { showToast?.('Gagal menyalin. Periksa izin clipboard browser.', 'error') }
  }
  return <section className="tarik-data-page">
    <div className="page-heading"><div><p className="eyebrow">SAPA / OPERASIONAL</p><h1>Tarik Data</h1><p>Unggah CSV mentah dari Data Studio, periksa hasil REG dan DS, lalu salin ke spreadsheet masing-masing.</p></div></div>
    <div className="tarik-upload-panel">
      <label className="tarik-upload"><FileUp size={20}/><span><strong>Pilih file CSV mentah</strong><small>{filename || 'Format data dari Data Studio (.csv)'}</small></span><input type="file" accept=".csv,text/csv" onChange={load} aria-label="Unggah CSV mentah"/></label>
      <p>Hasil memakai urutan 11 kolom pada contoh. Tampilan dan salinan berformat Calibri 11 pt. Jika Google Sheets tidak membawa format saat ditempel, pilih sel hasil lalu atur font Calibri ukuran 11 di Sheets.</p>
      {!contactsReady && <p className="tarik-warning">Sumber kontak belum siap. No AC dan No AM akan kosong sampai data kontak tersedia; unggah ulang CSV setelah kontak terhubung.</p>}
      {error && <p className="tarik-error" role="alert">{error}</p>}
    </div>
    {rows.length > 0 && <>
      <div className="tarik-results-head"><div><strong>Hasil {filename}</strong><span>{rows.length} pesanan · {rows.filter(row => row.source === 'REG').length} REG · {rows.filter(row => row.source === 'DS').length} DS · {rows.filter(row => !row.noAc).length} tanpa No AC · {rows.filter(row => !row.noAm).length} tanpa No AM</span></div><div className="tarik-source-tabs" role="group" aria-label="Jenis hasil"><button aria-pressed={source === 'REG'} onClick={() => setSource('REG')}>REG</button><button aria-pressed={source === 'DS'} onClick={() => setSource('DS')}>DS</button></div><button className="primary-button" disabled={!shown.length} onClick={copy}><ClipboardCopy size={15}/> Salin {source}</button></div>
      <div className="tarik-table-wrap"><table className="tarik-table"><thead><tr>{TARIK_COLUMNS.map(([field,label]) => <th key={field}>{label}</th>)}</tr></thead><tbody>{shown.slice(0,100).map((row,index) => <tr key={`${row.shipment}-${index}`}>{TARIK_COLUMNS.map(([field]) => <td key={field} title={row[field]}>{row[field] || '—'}</td>)}</tr>)}</tbody></table></div>
      <p className="tarik-result-note">Pratinjau menampilkan maksimal 100 baris. Tombol Salin hanya menyalin seluruh {shown.length} baris data {source}, tanpa nama kolom.</p>
    </>}
  </section>
}
