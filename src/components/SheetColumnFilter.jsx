import React, { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Filter, Search, X } from 'lucide-react'
import { sheetFilterValue, filterSpreadsheetEntries } from '../utils/monitoringView.js'

export function SheetColumnFilter({ column, entries, excluded, onApply, onSort, onClose }) {
  const dialog = useRef(null)
  const [draft, setDraft] = useState(() => new Set(excluded[column.key] || []))
  const [search, setSearch] = useState('')
  useEffect(() => { if (dialog.current && !dialog.current.open) dialog.current.showModal() }, [])
  const available = useMemo(() => {
    const otherFilters = { ...excluded, [column.key]: [] }
    const values = filterSpreadsheetEntries(entries, otherFilters).map(entry => sheetFilterValue(entry, column))
    return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'id', { numeric: true, sensitivity: 'base' }))
  }, [column, entries, excluded])
  const visible = available.filter(value => value.toLowerCase().includes(search.trim().toLowerCase()))
  const updateMany = checked => setDraft(previous => {
    const next = new Set(previous)
    visible.forEach(value => checked ? next.delete(value) : next.add(value))
    return next
  })
  const updateOne = (value, checked) => setDraft(previous => {
    const next = new Set(previous)
    checked ? next.delete(value) : next.add(value)
    return next
  })
  return createPortal(<dialog ref={dialog} className="sheet-filter-dialog" aria-label={`Filter kolom ${column.label}`} onClose={onClose} onCancel={event => { event.preventDefault(); onClose() }}>
    <div className="sheet-filter-heading"><strong><Filter size={15}/> {column.label}</strong><button className="icon-button" aria-label="Tutup filter kolom" onClick={onClose}><X size={16}/></button></div>
    <div className="sheet-filter-sort"><button onClick={() => onSort(column.key, 'asc')}>Urutkan A ke Z</button><button onClick={() => onSort(column.key, 'desc')}>Urutkan Z ke A</button></div>
    <div className="sheet-filter-actions"><button onClick={() => updateMany(true)}>Pilih semua</button><button onClick={() => updateMany(false)}>Kosongkan</button><span>{available.length} nilai</span></div>
    <label className="sheet-filter-search"><Search size={15}/><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Cari nilai…" aria-label={`Cari nilai ${column.label}`}/></label>
    <div className="sheet-filter-values">{visible.map(value => <label key={value} className="sheet-filter-value"><input type="checkbox" checked={!draft.has(value)} onChange={event => updateOne(value, event.target.checked)}/><span>{value || '(Kosong)'}</span></label>)}{!visible.length && <p>Tidak ada nilai</p>}</div>
    <div className="sheet-filter-footer"><button className="secondary-button" onClick={onClose}>Batal</button><button className="primary-button" onClick={() => onApply(column.key, [...draft])}>Oke</button></div>
  </dialog>, document.body)
}
