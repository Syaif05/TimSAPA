import { recordActivity } from '../utils/activityTracker'
import { orderSetKey, reconcileOrderDraft } from '../utils/orderState'
import { urgentOrderCount } from '../utils/monitoringView'
import { OrderSheetEditor } from '../cloud/OrderSheetEditor'
import React, { useState, useRef, useEffect, useMemo } from 'react'
import { MessageSquare, Copy, Check, CheckCircle2, Clock3, Phone, Maximize2, RotateCcw, Save, ExternalLink, ChevronLeft, ChevronRight, Palette, Flame } from 'lucide-react'
import { InfoButton } from './InfoButton'
import { AcTableRender } from './AcTableRender'
import { copyTableImageToClipboard, generateTableDataUrl } from '../utils/imageGenerator'
import { formatPhoneDisplay, isValidIndonesianPhone } from '../utils/phoneUtils'
import { useWhatsAppChat } from '../hooks/useWhatsAppChat'
import { acPhoneIdentity } from '../utils/acPhoneOverrides'
import { renderTemplate } from '../utils/templateEngine'
import { getStatusBadgeStyles, DEFAULT_STATUSES } from '../utils/statusConfig'

export function AcDetailPanel({
  acGroup,
  renderedMessage,
  templates,
  activeTemplateKey,
  onSelectTemplateKey,
  onManageTemplates,
  templateNow,
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
  const [selectedTemplateKey, setSelectedTemplateKey] = useState(() => templates?.[activeTemplateKey] ? activeTemplateKey : Object.keys(templates || {})[0])
  const resolvedTemplateKey = templates?.[selectedTemplateKey] ? selectedTemplateKey : templates?.[activeTemplateKey] ? activeTemplateKey : Object.keys(templates || {})[0]
  const selectedTemplate = templates?.[resolvedTemplateKey]
  const templateText = useMemo(() => selectedTemplate ? renderTemplate(selectedTemplate.content, acGroup, {now:templateNow,period:selectedTemplate.period,customVariables:selectedTemplate.customVariables}) : renderedMessage, [selectedTemplate, acGroup, templateNow, renderedMessage])
  const [phone, setPhone] = useState(acGroup?.phone || '')
  const [isSavingPhone, setIsSavingPhone] = useState(false)
  const [phoneError, setPhoneError] = useState('')
  const previousPhone = useRef(acGroup?.phone || '')
  const editingPhoneVersion = useRef(undefined)
  const [message, setMessage] = useState(templateText || '')
  const [pendingTemplateKey, setPendingTemplateKey] = useState(null)
  const [isCopiedImage, setIsCopiedImage] = useState(false)
  const [isCopiedText, setIsCopiedText] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)

  const tableRef = useRef(null)

  const previousTemplate = useRef(templateText)
  const ordersKey = orderSetKey(acGroup?.rows)
  const previousOrders = useRef(ordersKey)
  useEffect(() => {
    const previous = previousTemplate.current
    const previousOrderKey = previousOrders.current
    setMessage(current => reconcileOrderDraft({ currentMessage: current, previousMessage: previous, nextMessage: templateText, previousOrders: previousOrderKey, nextOrders: ordersKey }))
    previousOrders.current = ordersKey
    previousTemplate.current = templateText
  }, [templateText, ordersKey])

  useEffect(() => {
    const previous = previousPhone.current
    const next = acGroup?.phone || ''
    setPhone(current => current === previous ? next : current)
    previousPhone.current = next
  }, [acGroup?.phone])

  const { handleOpenWhatsApp, isOpeningWhatsApp } = useWhatsAppChat({
    phone, message, tableRef, tableSettings, showToast,
    onOpened: () => { recordActivity('monitoring_chat',acGroup.totalShipments,'workspace'); onStatusChange(acGroup.acKey, 'sudah_dihubungi') },
  })

  if (!acGroup) {
    return (
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-12 text-center text-zinc-400">
        Pilih salah satu Area Coordinator di daftar sebelah kiri untuk melihat detail kendala.
      </div>
    )
  }

  const isValidPhone = isValidIndonesianPhone(phone) && /^[+\d\s().-]+$/.test(phone) && phone.length <= 40
  const phoneIsDirty = String(phone).trim() !== String(acGroup.phone || '').trim()
  const phoneRecord = acGroup.rows.map(row => row.phoneOverride).find(record => record?.identity === acPhoneIdentity(acGroup.acName, acGroup.cabang))
  const savePhone = async () => {
    setIsSavingPhone(true); setPhoneError('')
    try {
      const record = await onPhoneChange(acGroup, phone, editingPhoneVersion.current ?? phoneRecord?.version ?? '')
      setPhone(record.phone); previousPhone.current=record.phone; editingPhoneVersion.current=undefined
      showToast?.('Nomor AC tersimpan. Nomor ini akan dipakai saat menghubungi kembali.', 'success')
    } catch(error) { setPhoneError(error.message || 'Nomor belum tersimpan. Coba lagi.'); }
    finally { setIsSavingPhone(false) }
  }

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

  const applyTemplate = key => {
    const next = templates[key]
    if (!next) return
    const text = renderTemplate(next.content,acGroup,{now:templateNow,period:next.period,customVariables:next.customVariables})
    setSelectedTemplateKey(key);setMessage(text);previousTemplate.current=text
    onSelectTemplateKey?.(key);setPendingTemplateKey(null)
  }
  const chooseTemplate = key => {
    if(key === resolvedTemplateKey)return
    if(message !== templateText){setPendingTemplateKey(key);return}
    applyTemplate(key)
  }
  const statusStyles = getStatusBadgeStyles(acGroup.status, statuses)
  const urgentCount = urgentOrderCount(acGroup.rows)
  return (
    <section className={`chat-panel ${statusStyles.countsAsCompleted ? 'is-contacted' : statusStyles.id !== 'belum_dikerjakan' ? 'is-in-progress' : ''} ${acGroup.source ? `source-${acGroup.source.toLowerCase()}` : ''}`} data-source={acGroup.source || undefined} data-chat-color={statusStyles.color} aria-label={`Detail ${acGroup.acName}`}>
      <div className="chat-heading">
        <div className="flex items-center gap-3 min-w-0">
          <span className="detail-avatar">{acGroup.acName.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>
          <div className="min-w-0"><div className="chat-source-name">{acGroup.source && <span className="source-badge">{acGroup.sources?.join(' + ') || acGroup.source}</span>}<h2 className="text-sm font-semibold truncate">{acGroup.acName}</h2></div><p className="text-[11px] text-zinc-400 mt-1">{acGroup.cabang || '—'} · {acGroup.region || '—'}</p></div>
        </div>
        {!compact && <div className="flex items-center gap-1">
          <span className="text-[11px] text-zinc-400 mr-1">{currentIndex + 1} / {totalCount}</span>
          <button className="icon-button" onClick={onPrevAc} disabled={!hasPrev} title="AC sebelumnya" aria-label="AC sebelumnya"><ChevronLeft size={16}/></button>
          <button className="icon-button" onClick={onNextAc} disabled={!hasNext} title="AC berikutnya" aria-label="AC berikutnya"><ChevronRight size={16}/></button>
        </div>}
      </div>
      {urgentCount > 0 && <div className="chat-priority-notice"><Flame size={32} className="sla-flame"/><div><strong>PRIORITAS UTAMA · SLA &gt; 12 JAM</strong><span>{urgentCount} pesanan harus segera ditangani. Hubungi AC dan percepat tindak lanjut.</span></div></div>}
      <div className="chat-status-banner" role="status">
        {statusStyles.countsAsCompleted ? <CheckCircle2 size={21}/> : <Clock3 size={21}/>}
        <div><strong>{statusStyles.shortLabel}</strong><span>{statusStyles.countsAsCompleted ? 'Ditandai sudah ditindaklanjuti · status chat lokal' : statusStyles.id === 'belum_dikerjakan' ? 'Siapkan draf dan hubungi AC melalui WhatsApp.' : 'Pantau respons AC dan lanjutkan follow up sesuai kebutuhan.'}</span></div>
        <span className="chat-status-pic">PIC {acGroup.pic || '—'}</span>
      </div>
      <div className="chat-meta">
        <select className="clean-select status-select" aria-label="Status chat lokal" title="Status chat lokal; tidak mengubah Google Sheets" value={acGroup.status || 'belum_dikerjakan'} onChange={e => onStatusChange(acGroup.acKey, e.target.value)}>{statuses.map(status => <option key={status.id} value={status.id}>{status.shortLabel || status.label}</option>)}</select>
        <span className="text-[11px] text-zinc-400">{acGroup.totalStores} toko · {acGroup.totalShipments} pesanan</span>
        <OrderSheetEditor rows={acGroup.rows} showToast={showToast}/>
        <InfoButton title="Detail kontak dan monitoring"><p>Cabang: {acGroup.cabang || '—'}<br/>Region: {acGroup.region || '—'}<br/>PIC: {acGroup.pic || '—'}<br/>Jam: {acGroup.jam || '—'}</p><p>Nomor WA: {formatPhoneDisplay(phone)}<br/>CUG toko: {formatPhoneDisplay(acGroup.cugToko)}</p><p>Sumber: {['contacts_sheet', 'contacts_sheet_ac'].includes(acGroup.rows[0]?.matchSource) ? 'Spreadsheet kontak' : acGroup.rows[0]?.matchSource === 'manual_contact' ? 'Koreksi nomor tersimpan' : acGroup.rows[0]?.matchSource === 'master_db' ? 'Database kontak' : acGroup.rows[0]?.matchSource === 'sheet_data' ? 'Lembar SAPA' : 'Input manual'}</p><p>Status chat lokal: {statusStyles.label}</p>{acGroup.rows.filter(row => row.source).map(row => <p key={row.id} className="text-xs">{row.source} · {row.shipment}<br/>Sheet: {row.sheetStatus || 'Belum diisi'} · PIC: {row.pic}<br/>{row.kendala || ''}{row.grouping ? ` · ${row.grouping}` : ''}</p>)}{Object.entries(acGroup.slaBreakdown || {}).map(([sla, count]) => <p key={sla}>{sla}: {count}</p>)}</InfoButton>
      </div>
      {acGroup.rows.some(row => row.source) && <div className="sheet-order-summary"><span>{[...new Set(acGroup.rows.map(row => row.source).filter(Boolean))].join(' + ')}</span><span>Status sheet: {[...new Set(acGroup.rows.map(row => row.sheetStatus || 'Belum diisi'))].join(' · ')}</span></div>}
      <div className="chat-body">
        <div className="phone-editor">
          <div className="phone-editor-line"><div className={`phone-field ${!isValidPhone ? 'invalid' : ''}`}>
            <Phone size={16}/><input aria-label="Nomor WhatsApp AC" type="tel" inputMode="tel" value={phone} disabled={isSavingPhone} placeholder="Nomor WhatsApp" onChange={e => {if(!phoneIsDirty)editingPhoneVersion.current=phoneRecord?.version || '';setPhone(e.target.value);setPhoneError('')}}/>
            {isValidPhone ? <Check size={15} className="text-emerald-600" aria-label="Format nomor valid"/> : <span className="text-[11px] text-rose-500 whitespace-nowrap">{phone ? 'Tidak valid' : 'Isi nomor'}</span>}
          </div><button className="secondary-button phone-save-button" onClick={savePhone} disabled={!isValidPhone || isSavingPhone || !onPhoneChange || (!!phoneRecord && !phoneIsDirty)}>{phoneRecord && !phoneIsDirty ? <Check size={14}/> : <Save size={14}/>}<span>{isSavingPhone ? 'Menyimpan…' : phoneRecord && !phoneIsDirty ? 'Tersimpan' : 'Update nomor'}</span></button>{phoneIsDirty && <button className="secondary-button" disabled={isSavingPhone} onClick={()=>{setPhone(acGroup.phone || '');editingPhoneVersion.current=undefined;setPhoneError('')}}>Batal</button>}</div>
          <p className={`phone-editor-note ${phoneRecord && !phoneIsDirty ? 'saved' : ''}`}>{phoneIsDirty ? 'Nomor belum disimpan. Klik Update nomor sebelum membuka chat.' : phoneRecord ? `Koreksi tersimpan untuk AC ini di ${acGroup.cabang || 'cabang ini'}. Berlaku untuk semua PIC, termasuk saat berganti hari atau perangkat.` : 'Nomor kosong atau salah? Ubah nomor lalu klik Update nomor untuk menyimpannya.'}</p>
          {phoneError && <p className="phone-editor-error" role="alert">{phoneError}</p>}
        </div>
        {!contactsReady && isValidPhone && <p className="text-[11px] text-amber-600">Kontak belum tersinkron. Periksa nomor sebelum membuka chat.</p>}
        {selectedTemplate && <div className="template-quick-picker">
          <div className="template-quick-heading"><label htmlFor={`quick-template-${acGroup.acKey}`}><MessageSquare size={14}/>Template untuk AC ini</label>{onManageTemplates && <button className="template-manage-link" onClick={onManageTemplates}>Kelola {Object.keys(templates).length}/20</button>}</div>
          <select id={`quick-template-${acGroup.acKey}`} aria-label="Pilih template pesan untuk AC" value={resolvedTemplateKey} onChange={e=>chooseTemplate(e.target.value)}>{Object.entries(templates).map(([key,tpl])=><option key={key} value={key}>{tpl.name}</option>)}</select>
          {selectedTemplate.description && <p>{selectedTemplate.description}</p>}
        </div>}
        {pendingTemplateKey && <div className="template-warning" role="alert"><strong>Ganti draf dengan template lain?</strong><p>Draf AC ini sudah Anda edit. Memilih Ganti template akan menggantikan isi draf.</p><div className="template-confirm-actions"><button className="secondary-button" onClick={()=>setPendingTemplateKey(null)}>Batal</button><button className="primary-button" onClick={()=>applyTemplate(pendingTemplateKey)}>Ganti template</button></div></div>}
        <div>
          <div className="field-heading"><label htmlFor={`message-${acGroup.acKey}`}>Draf pesan</label><div className="flex items-center gap-1"><button className="icon-button" title="Reset pesan" aria-label="Reset pesan" onClick={() => setMessage(templateText)}><RotateCcw size={14}/></button><button className="icon-button" title="Salin teks" aria-label="Salin teks" onClick={handleCopyText}>{isCopiedText ? <Check size={14}/> : <Copy size={14}/>}</button></div></div>
          <textarea id={`message-${acGroup.acKey}`} className="message-editor" rows={7} value={message} onChange={e => setMessage(e.target.value)}/>
        </div>
        <div className="min-w-0">
          <div className="field-heading"><span>Lampiran tabel</span><div className="flex items-center gap-1">{onNavigateToSettings && <button className="icon-button" title="Desain gambar" aria-label="Desain gambar" onClick={onNavigateToSettings}><Palette size={15}/></button>}<button className="icon-button" title="Pratinjau dan unduh PNG" aria-label="Pratinjau dan unduh PNG" onClick={handleOpenZoomModal}><Maximize2 size={15}/></button></div></div>
          <div className="table-preview" style={{backgroundColor: tableSettings?.colors?.tableBg || '#fff'}}><AcTableRender ref={tableRef} acGroup={acGroup} settings={tableSettings} showTitleBar={tableSettings?.showTitleBar ?? true}/></div>
        </div>
      </div>
      <div className="chat-actions">
        <InfoButton title="Cara mengirim pesan"><p>Klik Buka chat. Pesan akan terisi di tab WhatsApp dan gambar tabel disalin ke clipboard.</p><p>Tempel gambar dengan Cmd/Ctrl + V, lalu tekan Kirim. Jika penyalinan gagal, gunakan Salin gambar atau unduh PNG lewat ikon pratinjau.</p></InfoButton>
        <div className="flex items-center gap-2 flex-wrap"><button className="secondary-button" disabled={isGenerating || isOpeningWhatsApp} onClick={handleCopyImage}>{isCopiedImage ? <Check size={15}/> : <Copy size={15}/>}<span>{isGenerating ? 'Menyalin…' : isCopiedImage ? 'Tersalin' : 'Salin gambar'}</span></button><button className="primary-button chat-open-button" onClick={handleOpenWhatsApp} disabled={!isValidPhone || phoneIsDirty || isSavingPhone || isOpeningWhatsApp || isGenerating} title={phoneIsDirty ? 'Simpan nomor dengan tombol Update nomor terlebih dahulu' : !isValidPhone ? 'Isi nomor WhatsApp Indonesia yang valid' : 'Buka chat di tab WhatsApp Web yang sudah ada'}><MessageSquare size={16}/><span>{isOpeningWhatsApp ? 'Menyiapkan…' : 'Buka chat'}</span><ExternalLink size={13}/></button></div>
      </div>
    </section>
  )
}
