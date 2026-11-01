import React, { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Pencil, Save, X } from 'lucide-react'
import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
import { sourceRequest, useSourceAccess } from './GoogleAdmin'

function Editor({ rows, onClose, showToast }) {
  const profile = usePicProfile()
  const dialog = useRef(null)
  const id = useId()
  const [selected, setSelected] = useState(rows[0].id)
  const row = rows.find(r => r.id === selected) || rows[0]
  const [status, setStatus] = useState(row.sheetStatus || '')
  const [note, setNote] = useState(row.kendala || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const dirty = status !== (row.sheetStatus || '') || note !== (row.kendala || '')
  usePicEditing(dirty || busy)
  useEffect(() => { if (!dialog.current.open) dialog.current.showModal() }, [])
  const choose = value => {
    const next = rows.find(r => r.id === value)
    setSelected(value); setStatus(next.sheetStatus || ''); setNote(next.kendala || ''); setError('')
  }
  const save = async event => {
    event.preventDefault(); setBusy(true); setError('')
    const changes = {}; const expected = {}
    if (status !== (row.sheetStatus || '')) { changes.sheetStatus = status; expected.sheetStatus = row.sheetStatus || '' }
    if (note !== (row.kendala || '')) { changes.kendala = note; expected.kendala = row.kendala || '' }
    try {
      await sourceRequest('/api/orders', { method: 'PATCH', body: { pic: profile.name, source: row.source, mode: row.sheetMode, date: row.sheetDate, sheetRow: row.sheetRow, shipment: row.shipment, store: row.kodeToko, changes, expected } })
      window.dispatchEvent(new Event('sapa:sheets-changed'))
      showToast?.('Perubahan tersimpan di Google Sheets.', 'success'); onClose()
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }
  return createPortal(<dialog ref={dialog} className="help-dialog order-sheet-dialog" aria-labelledby={id} onCancel={event => { event.preventDefault(); if (!busy) onClose() }}>
    <form className="help-content" onSubmit={save}>
      <div className="field-heading"><h2 id={id}>Edit spreadsheet</h2><button type="button" className="icon-button" aria-label="Tutup editor" disabled={busy} onClick={onClose}><X size={18}/></button></div>
      <label>Pesanan<select aria-label="Pesanan yang diubah" value={selected} disabled={busy || dirty} onChange={e => choose(e.target.value)}>{rows.map(r => <option key={r.id} value={r.id}>{r.source} · {r.shipment} · {r.kodeToko}</option>)}</select></label>
      <label>Status<input list={`source-status-${id}`} aria-label="Status pesanan di spreadsheet" value={status} maxLength={80} disabled={busy} onChange={e => setStatus(e.target.value)}/><datalist id={`source-status-${id}`}><option value="Proses"/><option value="Done"/><option value="Tidak dapat dihubungi"/></datalist></label>
      <label>Kendala<textarea aria-label="Kendala pesanan di spreadsheet" value={note} rows={3} maxLength={2000} disabled={busy} onChange={e => setNote(e.target.value)}/></label>
      <p className="source-editor-note">Disimpan langsung ke spreadsheet. Pesanan DONE keluar dari antrean.</p>
      {error && <div className="profile-error" role="alert">{error}</div>}
      <button className="primary-button" disabled={!dirty || busy} type="submit"><Save size={15}/>{busy ? 'Menyimpan…' : 'Simpan perubahan'}</button>
    </form>
  </dialog>, document.body)
}
export function OrderSheetEditor({ rows = [], showToast }) {
  const { canEdit } = useSourceAccess()
  const [open, setOpen] = useState(false)
  const candidates = rows.filter(row => row.sheetDate && row.sheetMode && row.source)
  if (!canEdit || !candidates.length) return null
  return <><button className="icon-button" aria-label="Edit pesanan di spreadsheet" title="Edit spreadsheet" onClick={() => setOpen(true)}><Pencil size={14}/></button>{open && <Editor rows={candidates} onClose={() => setOpen(false)} showToast={showToast}/>}</>
}
