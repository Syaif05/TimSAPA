import { orderSetKey, reconcileOrderDraft } from '../utils/orderState'
import { OrderSheetEditor } from '../cloud/OrderSheetEditor'
import React, { useState, useRef, useEffect } from 'react'
import { MessageSquare, Copy, Check, Phone, Maximize2, RotateCcw, ExternalLink, ChevronLeft, ChevronRight, Palette } from 'lucide-react'
import { InfoButton } from './InfoButton'
import { AcTableRender } from './AcTableRender'
import { copyTableImageToClipboard, generateTableDataUrl } from '../utils/imageGenerator'
import { formatPhoneDisplay, isValidIndonesianPhone } from '../utils/phoneUtils'
import { useWhatsAppChat } from '../hooks/useWhatsAppChat'
import { getStatusBadgeStyles, DEFAULT_STATUSES } from '../utils/statusConfig'

export function AcDetailPanel({
  acGroup,
  renderedMessage,
  statuses = DEFAULT_STATUSES,
  onStatusChange,
  onPhoneChange,
  onPreviewImage,
  showToast,
  onPrevAc,
  onNextAc,
  hasPrev,
  hasNext,
  currentIndex,
  totalCount,
  compact = false,
  contactsReady = true,
  tableSettings,
  onNavigateToSettings,
}) {
  const [phone, setPhone] = useState(acGroup?.phone || '')
  const [message, setMessage] = useState(renderedMessage || '')
  const [isCopiedImage, setIsCopiedImage] = useState(false)
  const [isCopiedText, setIsCopiedText] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const tableRef = useRef(null)

  const previousTemplate = useRef(renderedMessage)
  const ordersKey = orderSetKey(acGroup?.rows)
  const previousOrders = useRef(ordersKey)
  useEffect(() => {
    const previous = previousTemplate.current
    const previousOrderKey = previousOrders.current
    setMessage(current => reconcileOrderDraft({ currentMessage: current, previousMessage: previous, nextMessage: renderedMessage, previousOrders: previousOrderKey, nextOrders: ordersKey }))
    previousOrders.current = ordersKey
    previousTemplate.current = renderedMessage
  }, [renderedMessage, ordersKey])

  useEffect(() => {
    setPhone(acGroup?.phone || '')
  }, [acGroup?.phone])

  const { handleOpenWhatsApp, isOpeningWhatsApp } = useWhatsAppChat({
    phone, message, tableRef, tableSettings, showToast,
    onOpened: () => onStatusChange(acGroup.acKey, 'sudah_dihubungi'),
  })

  if (!acGroup) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center text-zinc-400">
        Pilih salah satu Area Coordinator di daftar sebelah kiri untuk melihat detail kendala.
      </div>
    )
  }

  const isValidPhone = isValidIndonesianPhone(phone)

  // Salin Gambar Tabel ke Clipboard
  const handleCopyImage = async () => {
    if (!tableRef.current) return
    setIsGenerating(true)
    try {
      const table = tableRef.current
      const res = await copyTableImageToClipboard(table, {
        isCurrent: () => tableRef.current === table,
        backgroundColor: tableSettings?.colors?.tableBg,
        pixelRatio: tableSettings?.exportScale || 2.5,
      })
      if (res.success) {
        setIsCopiedImage(true)
        showToast(`Gambar tabel ${acGroup.acName} berhasil disalin ke clipboard!`, 'success')
        setTimeout(() => setIsCopiedImage(false), 2500)
      } else {
        showToast(res.error || 'Gagal menyalin gambar ke clipboard', 'error')
      }
    } catch (err) {
      showToast('Terjadi kesalahan saat membuat gambar: ' + err.message, 'error')
    } finally {
      setIsGenerating(false)
    }
  }

  // Salin Teks Pesan ke Clipboard
  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(message)
      setIsCopiedText(true)
      showToast('Teks pesan berhasil disalin!', 'info')
      setTimeout(() => setIsCopiedText(false), 2000)
    } catch (err) {
      showToast('Gagal menyalin teks pesan', 'error')
    }
  }

  // Preview full zoom modal
  const handleOpenZoomModal = async () => {
    if (!tableRef.current) return
    try {
      const table = tableRef.current
      const url = await generateTableDataUrl(table)
      if (tableRef.current !== table) return
      onPreviewImage(url, acGroup.acName)
    } catch (err) {
      console.error(err)
    }
  }

  const statusStyles = getStatusBadgeStyles(acGroup.status, statuses)
  return (
    <section className={`chat-panel ${acGroup.source ? `source-${acGroup.source.toLowerCase()}` : ''}`} data-source={acGroup.source || undefined} aria-label={`Detail ${acGroup.acName}`}>
      <div className="chat-heading">
        <div className="flex items-center gap-3 min-w-0">
          <span className="detail-avatar">{acGroup.acName.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>
          <div className="min-w-0"><div className="chat-source-name">{acGroup.source && <span className="source-badge">{acGroup.source}</span>}<h2 className="text-sm font-semibold truncate">{acGroup.acName}</h2></div><p className="text-[11px] text-zinc-400 mt-1">{acGroup.cabang || '—'} · {acGroup.region || '—'}</p></div>
        </div>
        {!compact && <div className="flex items-center gap-1">
          <span className="text-[11px] text-zinc-400 mr-1">{currentIndex + 1} / {totalCount}</span>
          <button className="icon-button" onClick={onPrevAc} disabled={!hasPrev} title="AC sebelumnya" aria-label="AC sebelumnya"><ChevronLeft size={16}/></button>
          <button className="icon-button" onClick={onNextAc} disabled={!hasNext} title="AC berikutnya" aria-label="AC berikutnya"><ChevronRight size={16}/></button>
        </div>}
      </div>
      <div className="chat-meta">
        <select className="clean-select status-select" aria-label="Status chat lokal" title="Status chat lokal; tidak mengubah Google Sheets" value={acGroup.status || 'belum_dikerjakan'} onChange={e => onStatusChange(acGroup.acKey, e.target.value)}>{statuses.map(status => <option key={status.id} value={status.id}>{status.shortLabel || status.label}</option>)}</select>
        <span className="text-[11px] text-zinc-400">{acGroup.totalStores} toko · {acGroup.totalShipments} pesanan</span>
        <OrderSheetEditor rows={acGroup.rows} showToast={showToast}/>
        <InfoButton title="Detail kontak dan monitoring"><p>Cabang: {acGroup.cabang || '—'}<br/>Region: {acGroup.region || '—'}<br/>PIC: {acGroup.pic || '—'}<br/>Jam: {acGroup.jam || '—'}</p><p>Nomor WA: {formatPhoneDisplay(phone)}<br/>CUG toko: {formatPhoneDisplay(acGroup.cugToko)}</p><p>Sumber: {['contacts_sheet', 'contacts_sheet_ac'].includes(acGroup.rows[0]?.matchSource) ? 'Spreadsheet kontak' : acGroup.rows[0]?.matchSource === 'master_db' ? 'Database kontak' : acGroup.rows[0]?.matchSource === 'sheet_data' ? 'Lembar SAPA' : 'Input manual'}</p><p>Status chat lokal: {statusStyles.label}</p>{acGroup.rows.filter(row => row.source).map(row => <p key={row.id} className="text-xs">{row.source} · {row.shipment}<br/>Sheet: {row.sheetStatus || 'Belum diisi'} · PIC: {row.pic}<br/>{row.kendala || ''}{row.grouping ? ` · ${row.grouping}` : ''}</p>)}{Object.entries(acGroup.slaBreakdown || {}).map(([sla, count]) => <p key={sla}>{sla}: {count}</p>)}</InfoButton>
      </div>
      {acGroup.rows.some(row => row.source) && <div className="sheet-order-summary"><span>{[...new Set(acGroup.rows.map(row => row.source).filter(Boolean))].join(' + ')}</span><span>Status sheet: {[...new Set(acGroup.rows.map(row => row.sheetStatus || 'Belum diisi'))].join(' · ')}</span></div>}
      <div className="chat-body">
        <div className={`phone-field ${!isValidPhone ? 'invalid' : ''}`}>
          <Phone size={16}/><input aria-label="Nomor WhatsApp AC" type="tel" inputMode="tel" value={phone} placeholder="Nomor WhatsApp" onChange={e => {setPhone(e.target.value); onPhoneChange(acGroup.acKey, e.target.value)}}/>
          {isValidPhone ? <Check size={15} className="text-emerald-600"/> : <span className="text-[11px] text-rose-500 whitespace-nowrap">{phone ? 'Tidak valid' : 'Isi nomor'}</span>}
        </div>
        {!contactsReady && isValidPhone && <p className="text-[11px] text-amber-600">Kontak belum tersinkron. Periksa nomor sebelum membuka chat.</p>}
        <div>
          <div className="field-heading"><label htmlFor={`message-${acGroup.acKey}`}>Draf pesan</label><div className="flex items-center gap-1"><button className="icon-button" title="Reset pesan" aria-label="Reset pesan" onClick={() => setMessage(renderedMessage)}><RotateCcw size={14}/></button><button className="icon-button" title="Salin teks" aria-label="Salin teks" onClick={handleCopyText}>{isCopiedText ? <Check size={14}/> : <Copy size={14}/>}</button></div></div>
          <textarea id={`message-${acGroup.acKey}`} className="message-editor" rows={7} value={message} onChange={e => setMessage(e.target.value)}/>
        </div>
        <div className="min-w-0">
          <div className="field-heading"><span>Lampiran tabel</span><div className="flex items-center gap-1">{onNavigateToSettings && <button className="icon-button" title="Desain gambar" aria-label="Desain gambar" onClick={onNavigateToSettings}><Palette size={15}/></button>}<button className="icon-button" title="Pratinjau dan unduh PNG" aria-label="Pratinjau dan unduh PNG" onClick={handleOpenZoomModal}><Maximize2 size={15}/></button></div></div>
          <div className="table-preview" style={{backgroundColor: tableSettings?.colors?.tableBg || '#fff'}}><AcTableRender ref={tableRef} acGroup={acGroup} settings={tableSettings} showTitleBar={tableSettings?.showTitleBar ?? true}/></div>
        </div>
      </div>
      <div className="chat-actions">
        <InfoButton title="Cara mengirim pesan"><p>Klik Buka chat. Pesan akan terisi di tab WhatsApp dan gambar tabel disalin ke clipboard.</p><p>Tempel gambar dengan Cmd/Ctrl + V, lalu tekan Kirim. Jika penyalinan gagal, gunakan Salin gambar atau unduh PNG lewat ikon pratinjau.</p></InfoButton>
        <div className="flex items-center gap-2 flex-wrap"><button className="secondary-button" disabled={isGenerating || isOpeningWhatsApp} onClick={handleCopyImage}>{isCopiedImage ? <Check size={15}/> : <Copy size={15}/>}<span>{isGenerating ? 'Menyalin…' : isCopiedImage ? 'Tersalin' : 'Salin gambar'}</span></button><button className="primary-button chat-open-button" onClick={handleOpenWhatsApp} disabled={!isValidPhone || isOpeningWhatsApp || isGenerating} title={!isValidPhone ? 'Isi nomor WhatsApp Indonesia yang valid' : 'Buka chat di tab WhatsApp Web yang sudah ada'}><MessageSquare size={16}/><span>{isOpeningWhatsApp ? 'Menyiapkan…' : 'Buka chat'}</span><ExternalLink size={13}/></button></div>
      </div>
    </section>
  )
}
