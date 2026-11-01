import React, { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Copy, MessageSquare } from 'lucide-react'
import { InfoButton } from './InfoButton'
import { OrderSheetEditor } from '../cloud/OrderSheetEditor'
import { SHEET_COLUMNS, sheetCellValue, slaBucket, spreadsheetEntries, spreadsheetTsv } from '../utils/monitoringView.js'
import { foregroundColor } from '../utils/appearance.js'

export function MonitoringSheet({ groups, filterKey, onOpenGroup, tableSettings, showToast }) {
  const entries = useMemo(() => spreadsheetEntries(groups), [groups])
  const [page, setPage] = useState(0)
  const [pageSize, setPageSize] = useState(100)
  const [cell, setCell] = useState(null)
  const scroller = useRef(null)
  const pages = Math.max(1, Math.ceil(entries.length / pageSize))
  const currentPage = Math.min(page, pages - 1)
  const start = currentPage * pageSize
  const visible = entries.slice(start, start + pageSize)
  const selected = visible.find(entry => entry.key === cell?.key)
  const column = SHEET_COLUMNS[cell?.column ?? 0]
  const selectedValue = selected ? sheetCellValue(selected, column) : ''
  useEffect(() => { setPage(0); setCell(null) }, [filterKey])
  useEffect(() => { if (scroller.current) scroller.current.scrollTop = 0 }, [currentPage, pageSize])
  const copy = async () => {
    try { await navigator.clipboard.writeText(spreadsheetTsv(entries)); showToast?.('Tabel sesuai filter berhasil disalin.', 'success') }
    catch { showToast?.('Gagal menyalin tabel. Pilih sel lalu salin teksnya.', 'error') }
  }
  const keydown = (event, rowIndex, columnIndex) => {
    const movement = { ArrowDown: [1, 0], ArrowUp: [-1, 0], ArrowRight: [0, 1], ArrowLeft: [0, -1] }[event.key]
    if (movement) {
      event.preventDefault()
      const nextRow = Math.max(0, Math.min(visible.length - 1, rowIndex + movement[0]))
      const nextColumn = Math.max(0, Math.min(SHEET_COLUMNS.length - 1, columnIndex + movement[1]))
      scroller.current?.querySelector(`[data-cell-row="${nextRow}"][data-cell-column="${nextColumn}"]`)?.focus()
    } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'c' && !window.getSelection()?.toString()) {
      event.preventDefault()
      navigator.clipboard.writeText(sheetCellValue(visible[rowIndex], SHEET_COLUMNS[columnIndex])).catch(() => showToast?.('Gagal menyalin sel.', 'error'))
    }
  }
  return <section className="monitoring-sheet" aria-label="Tampilan spreadsheet">
    <div className="sheet-formula-bar">
      <span className="sheet-cell-address" title={selected ? `${selected.row.source || selected.group.source} · baris sumber` : 'Pilih sel'}>{selected ? `${column.letter}${selected.row.sheetRow || start + visible.indexOf(selected) + 1}` : '—'}</span>
      <span className="sheet-fx" aria-hidden="true">fx</span>
      <input aria-label="Isi sel terpilih" readOnly value={selectedValue} placeholder="Pilih sel untuk melihat isinya"/>
      <button className="icon-button" aria-label="Salin tabel sesuai filter" title="Salin tabel sesuai filter" onClick={copy}><Copy size={14}/></button>
      <InfoButton title="Cara memakai tampilan spreadsheet"><p>Kolom A–V mengikuti spreadsheet sumber. Pilih sel lalu gunakan tombol panah; Ctrl/Cmd + C menyalin sel. Ikon salin menyalin semua baris sesuai filter.</p><p>Ikon chat membuka draf pesan dan lampiran AC. Ikon pensil muncul bila izin edit tersedia. Pesanan DONE tidak masuk tabel atau salinan.</p></InfoButton>
    </div>
    <div ref={scroller} className="sheet-scroller" role="region" aria-label="Tabel pesanan, geser untuk melihat kolom lainnya" tabIndex={0}>
      <table className="monitoring-sheet-table" aria-label="Monitoring seperti spreadsheet">
        <colgroup><col style={{width:42}}/><col style={{width:65}}/>{SHEET_COLUMNS.map(col => <col key={col.key} style={{width:col.width}}/>)}<col style={{width:78}}/></colgroup>
        <thead>
          <tr className="sheet-letters" aria-hidden="true"><th className="sheet-row-number"/><th className="sheet-source-column"/>{SHEET_COLUMNS.map(col => <th key={col.key}>{col.letter}</th>)}<th className="sheet-actions-column"/></tr>
          <tr className="sheet-column-headings"><th scope="col" className="sheet-row-number" title="Nomor baris pada spreadsheet sumber">#</th><th scope="col" className="sheet-source-column">Sumber</th>{SHEET_COLUMNS.map(col => <th scope="col" key={col.key}>{col.label}</th>)}<th scope="col" className="sheet-actions-column">Aksi</th></tr>
        </thead>
        <tbody>{visible.map((entry, rowIndex) => {
          const source = entry.row.source || entry.group.source
          const isSelectedRow = selected?.key === entry.key
          return <tr key={entry.key} data-source={source} className={isSelectedRow ? 'sheet-selected-row' : ''}>
            <th scope="row" className="sheet-row-number" title="Baris sumber">{entry.row.sheetRow || start + rowIndex + 1}</th>
            <td className="sheet-source-column"><span className={`sheet-source-badge ${source === 'DS' ? 'ds' : source === 'REG' ? 'reg' : ''}`}>{source || '—'}</span></td>
            {SHEET_COLUMNS.map((col, columnIndex) => {
              const value = sheetCellValue(entry, col)
              const bucket = col.key === 'sla' && slaBucket(value)
              const color = bucket && (tableSettings?.sla?.[`color${bucket}`] || ({'12h':'#cc0000','6h':'#ef4444','2h':'#ea580c','1h':'#f59e0b','45m':'#facc15','30m':'#fef08a'}[bucket]))
              const isSelected = selected?.key === entry.key && cell?.column === columnIndex
              return <td key={col.key} className={`sheet-data-cell ${isSelected ? 'sheet-selected-cell' : ''} ${col.key === 'shipment' ? 'sheet-shipment' : ''}`} style={color ? {backgroundColor:color,color:foregroundColor(color)} : undefined} title={value || undefined} tabIndex={isSelected || (!selected && rowIndex === 0 && columnIndex === 0) ? 0 : -1} data-cell-row={rowIndex} data-cell-column={columnIndex} onFocus={() => setCell({key:entry.key,column:columnIndex})} onClick={e => e.currentTarget.focus()} onKeyDown={event => keydown(event,rowIndex,columnIndex)}>{value || <span className="sheet-empty-cell">—</span>}</td>
            })}
            <td className="sheet-actions-column"><div className="sheet-row-actions"><button className="icon-button" aria-label={`Buka pesan AC untuk ${entry.row.shipment}`} title={`Pesan & lampiran · ${entry.group.acName}`} onClick={() => onOpenGroup(entry.group.acKey)}><MessageSquare size={14}/></button><OrderSheetEditor rows={[entry.row]} showToast={showToast}/></div></td>
          </tr>
        })}</tbody>
      </table>
    </div>
    <div className="sheet-footer"><span role="status">{entries.length ? start + 1 : 0}–{Math.min(start + pageSize, entries.length)} dari {entries.length.toLocaleString('id-ID')} pesanan</span><div><select className="clean-select" aria-label="Baris per halaman" value={pageSize} onChange={e => {setPageSize(Number(e.target.value));setPage(0)}}>{[50,100,250].map(size => <option key={size} value={size}>{size} baris</option>)}</select><button className="icon-button" aria-label="Halaman tabel sebelumnya" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><ChevronLeft size={15}/></button><span>{currentPage + 1}/{pages}</span><button className="icon-button" aria-label="Halaman tabel berikutnya" disabled={currentPage >= pages - 1} onClick={() => setPage(currentPage + 1)}><ChevronRight size={15}/></button></div></div>
  </section>
}
