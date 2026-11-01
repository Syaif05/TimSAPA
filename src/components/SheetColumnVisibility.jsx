import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Columns, X } from 'lucide-react'
import { DEFAULT_HIDDEN_SHEET_COLUMNS, SHEET_COLUMNS } from '../utils/monitoringView.js'

export function SheetColumnVisibility({ hidden, onApply, onClose }) {
  const dialog = useRef(null)
  const [draft, setDraft] = useState(() => new Set(hidden))
  const shown = SHEET_COLUMNS.length - draft.size
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  const toggle = (key, checked) => setDraft(previous => {
    const next = new Set(previous)
    if (checked) next.delete(key)
    else if (next.size < SHEET_COLUMNS.length - 1) next.add(key)
    return next
  })
  return createPortal(<dialog ref={dialog} className="sheet-visibility-dialog" aria-label="Atur kolom spreadsheet" onClose={onClose} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="sheet-filter-heading"><strong><Columns size={16}/> Atur kolom</strong><button className="icon-button" aria-label="Tutup pengaturan kolom" onClick={onClose}><X size={16}/></button></div>
    <p className="sheet-visibility-intro">Centang kolom yang ingin ditampilkan. Huruf mengikuti kolom sumber Google Sheets.</p>
    <div className="sheet-visibility-actions"><button type="button" onClick={() => setDraft(new Set())}>Tampilkan semua</button><button type="button" onClick={() => setDraft(new Set(DEFAULT_HIDDEN_SHEET_COLUMNS))}>Kembalikan bawaan</button><span>{shown} dari {SHEET_COLUMNS.length} tampil</span></div>
    <div className="sheet-visibility-list">{SHEET_COLUMNS.map(column => <label key={column.key} className="sheet-visibility-item"><input type="checkbox" checked={!draft.has(column.key)} disabled={!draft.has(column.key) && shown === 1} onChange={event => toggle(column.key, event.target.checked)}/><span className="sheet-visibility-letter">{column.letter}</span><span>{column.label}</span></label>)}</div>
    <div className="sheet-filter-footer"><button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" onClick={() => onApply([...draft])}>Simpan</button></div>
  </dialog>, document.body)
}
