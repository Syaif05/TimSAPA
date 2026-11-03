import React, { lazy, Suspense, useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { EXTENSION_STORE_URL } from '../utils/whatsappBridge'
import { Combine, CircleHelp, MessageCircle, Download, X } from 'lucide-react'
const ShipmentJoinerView = lazy(() => import('./ShipmentJoinerView').then(m => ({ default: m.ShipmentJoinerView })))
const HistoryAndGuide = lazy(() => import('./HistoryAndGuide').then(m => ({ default: m.HistoryAndGuide })))

const HubAcView = lazy(() => import('./HubAcView').then(m => ({ default: m.HubAcView })))

function ToolDialog({ tool, contactsConnection, showToast, onClose }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => { ref.current.showModal() }, [])
  const close = () => { ref.current.close(); onClose() }
  return createPortal(<dialog ref={ref} className="monitoring-tool-dialog" aria-labelledby={id} onClose={onClose} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }}>
    <div className="tool-dialog-header"><h2 id={id}>{tool === 'shipment' ? 'Shipment' : tool === 'ac' ? 'Hub AC' : 'Panduan SAPA'}</h2><button className="icon-button" aria-label="Tutup alat monitoring" onClick={close}><X size={19}/></button></div>
    <div className="tool-dialog-content"><Suspense fallback={<div className="loading-panel" role="status">Memuat…</div>}>{tool === 'shipment' ? <ShipmentJoinerView showToast={showToast}/> : tool === 'ac' ? <HubAcView contacts={contactsConnection?.snapshot?.contacts} ready={contactsConnection?.ready} showToast={showToast}/> : <HistoryAndGuide/>}</Suspense></div>
  </dialog>, document.body)
}
export function MonitoringTools({ showToast, contactsConnection }) {
  const [tool, setTool] = useState(null)
  return <div className="monitoring-tools">
    <button className="secondary-button" aria-haspopup="dialog" onClick={() => setTool('shipment')}><Combine size={16}/>Shipment</button>
    <button className="secondary-button" aria-haspopup="dialog" onClick={() => setTool('guide')}><CircleHelp size={16}/>Panduan</button>
    <button className="secondary-button" aria-haspopup="dialog" onClick={() => setTool('ac')}><MessageCircle size={16}/>Hub AC</button>
    <a className="secondary-button" href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer"><Download size={16}/>Download Extension</a>
    {tool && <ToolDialog key={tool} tool={tool} contactsConnection={contactsConnection} showToast={showToast} onClose={() => setTool(null)}/>}
  </div>
}
