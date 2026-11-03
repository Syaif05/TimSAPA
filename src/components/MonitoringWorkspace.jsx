import { OrderProgress } from './OrderProgress'
import { isDoneOrder, orderSetKey } from '../utils/orderState'
import { filterMonitoringGroups } from '../utils/monitoringView'
import { filterSheetRows } from '../utils/sheetsParser'
import { usePicProfile } from '../profiles/ProfileContext'
import { MonitoringSheet } from './MonitoringSheet'
import { createPortal } from 'react-dom'
import React, { useState, useMemo, lazy, Suspense, useDeferredValue, useEffect, useRef, useId } from 'react'
import { Plus, FileSpreadsheet, LayoutGrid, Columns, Search, RotateCcw, Palette, Calendar, Trash2, X } from 'lucide-react'
import { WhatsAppConnection } from './WhatsAppConnection'
import { AcDetailPanel } from './AcDetailPanel'
import { AcListItem } from './AcListItem'
import { AcCard } from './AcCard'
const PasteInputModal = lazy(() => import('./PasteInputModal').then(m => ({ default: m.PasteInputModal })))
const ImagePreviewModal = lazy(() => import('./ImagePreviewModal').then(m => ({ default: m.ImagePreviewModal })))
import { MonitoringTools } from './MonitoringTools'
import { SheetsConnection } from './SheetsConnection'
import { renderTemplate } from '../utils/templateEngine'
import { SAMPLE_SAPA_TSV } from '../utils/sampleSapaData'
import { parseSapaRawText } from '../utils/sapaParser'
import {
  formatDateDisplay,
  getTodayDateString,
  getYesterdayDateString
} from '../utils/sessionManager'
import { DEFAULT_STATUSES } from '../utils/statusConfig'

export function MonitoringWorkspace({
  acGroups,
  orderSummary,
  dataConnection,
  sheetPreferences,
  onSheetPreferencesChange,
  rawRows = [],
  sheetRows = [],
  contactsConnection,
  activeTemplate,
  activeTemplateKey,
  onSelectTemplateKey,
  templates,
  onImportData,
  onStatusChange,
  onPhoneChange,
  onResetSentStatus,
  sentStatusMap,
  showToast,
  isPasteModalOpen: externalPasteOpen,
  setIsPasteModalOpen: externalSetPasteOpen,
  tableSettings,
  onNavigateToSettings,
  selectedDate,
  onSelectDate,
  onResetDayData,
  savedDates = [],
  statuses = DEFAULT_STATUSES,
}) {
  const [internalPasteOpen, setInternalPasteOpen] = useState(false)
  const isPasteModalOpen = externalPasteOpen !== undefined ? externalPasteOpen : internalPasteOpen
  const setIsPasteModalOpen = externalSetPasteOpen || setInternalPasteOpen
  const { storage } = usePicProfile()
  const [viewMode, setViewMode] = useState(() => { try { const saved = storage.getItem('sapa_monitoring_view'); return ['split','grid','sheet'].includes(saved) ? saved : 'split' } catch { return 'split' } })
  const [sheetDetailKey, setSheetDetailKey] = useState(null)
  const [sheetOrderStatus, setSheetOrderStatus] = useState('ALL')
  useEffect(() => { try { storage.setItem('sapa_monitoring_view', viewMode) } catch {} }, [viewMode, storage])
  const [selectedAcKey, setSelectedAcKey] = useState(null)

  const todayDate = getTodayDateString()
  const yesterdayDate = getYesterdayDateString()
  const isArchiveMode = selectedDate && selectedDate !== todayDate

  const [previewModalData, setPreviewModalData] = useState({
    isOpen: false,
    dataUrl: '',
    acName: '',
  })

  useEffect(() => { setPreviewModalData(prev => prev.isOpen ? { ...prev, isOpen: false, dataUrl: '' } : prev) }, [rawRows])

  // Filter State
  const [filters, setFilters] = useState({
    search: '',
    pic: 'ALL',
    jam: 'ALL',
    sla: 'ALL',
    status: 'ALL', // 'ALL' atau statusId
  })

  const deferredSearch = useDeferredValue(filters.search)

  const isLive = Boolean(dataConnection?.enabled)
  const sourcePics = [...new Set((dataConnection?.snapshot?.rows || []).map(row => row.pic).filter(Boolean))].sort()
  const sourceStatuses = [...new Set((dataConnection?.snapshot?.rows || []).filter(row => !isDoneOrder(row)).map(row => row.sheetStatus).filter(Boolean))].sort()

  // Unique PICs & Jams
  const availablePics = useMemo(() => {
    const set = new Set()
    sheetRows.forEach(row => { if (row.pic && row.pic !== '-') set.add(row.pic) })
    acGroups.forEach((g) => {
      if (g.pic && g.pic !== '-') set.add(g.pic)
      g.rows.forEach((r) => {
        if (r.pic && r.pic !== '-') set.add(r.pic)
      })
    })
    return Array.from(set).sort()
  }, [acGroups, sheetRows])

  const availableJams = useMemo(() => {
    const set = new Set()
    sheetRows.forEach(row => { if (row.jam && row.jam !== '-') set.add(row.jam) })
    acGroups.forEach((g) => {
      if (g.jam && g.jam !== '-') set.add(g.jam)
      g.rows.forEach((r) => {
        if (r.jam && r.jam !== '-') set.add(r.jam)
      })
    })
    return Array.from(set).sort()
  }, [acGroups, sheetRows])

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value }))
    setSelectedAcKey(null)
  }

  // Hitung jumlah AC per status
  const statusCounts = useMemo(() => {
    const counts = { ALL: acGroups.length }
    statuses.forEach((s) => {
      counts[s.id] = 0
    })
    acGroups.forEach((g) => {
      const sId = sentStatusMap[g.acKey] || g.status || 'belum_dikerjakan'
      counts[sId] = (counts[sId] || 0) + 1
    })
    return counts
  }, [acGroups, sentStatusMap, statuses])

  // Both views operate on the same matching orders and regenerate group totals.
  const filteredAcGroups = useMemo(() => filterMonitoringGroups(acGroups, filters, deferredSearch, sentStatusMap), [acGroups, filters, deferredSearch, sentStatusMap])
  const sheetSourceRows = useMemo(() => filterSheetRows(sheetRows, { source: isLive ? sheetPreferences?.source : 'ALL', pic: isLive ? sheetPreferences?.pic : 'ALL' }), [sheetRows, isLive, sheetPreferences?.source, sheetPreferences?.pic])
  const sheetFilterKey = JSON.stringify([filters.pic, filters.jam, filters.sla, filters.status, deferredSearch, sheetPreferences?.source, sheetPreferences?.pic, sheetPreferences?.orderStatus])
  const sheetDetailAc = filteredAcGroups.find(group => group.acKey === sheetDetailKey)
  useEffect(() => { if (sheetDetailKey && (!sheetDetailAc || viewMode !== 'sheet')) setSheetDetailKey(null) }, [sheetDetailAc, sheetDetailKey, viewMode])

  const totalStoresCount = useMemo(() => {
    const stores = new Set()
    acGroups.forEach((g) => {
      g.rows.forEach((r) => {
        if (r.kodeToko) stores.add(r.kodeToko)
      })
    })
    return stores.size
  }, [acGroups])


  // Selected AC for Master-Detail view
  const visibleAcIndex = Math.max(0, filteredAcGroups.findIndex(group => group.acKey === selectedAcKey))
  const currentAc = filteredAcGroups[visibleAcIndex]
  useEffect(() => {
    if (currentAc && currentAc.acKey !== selectedAcKey) setSelectedAcKey(currentAc.acKey)
  }, [currentAc?.acKey, selectedAcKey])

  // Muat Demo
  const handleLoadDemo = () => {
    const rows = parseSapaRawText(SAMPLE_SAPA_TSV)
    onImportData(rows, { newCount: rows.length, duplicateCount: 0, mode: 'replace' })
    showToast?.('Data sampel Gambar 1 berhasil dimuat!', 'success')
  }

  // Handler Reset Data Hari Ini
  const handleConfirmResetDate = () => {
    const formatted = formatDateDisplay(selectedDate)
    if (window.confirm(`⚠️ PERINGATAN:\nApakah Anda yakin ingin MENGHAPUS SEMUA data kendala pesanan untuk tanggal ${formatted}?\n\nData antrean dan status pada tanggal ini akan dikosongkan bersih.`)) {
      onResetDayData(selectedDate)
      showToast?.(`Data monitoring untuk ${formatted} berhasil direset bersih.`, 'info')
    }
  }

  return (
    <div className="monitoring-page">
      <h1 className="sr-only">Monitoring</h1>
      <div className="monitoring-compact-bar">
        <MonitoringTools showToast={showToast} contactsConnection={contactsConnection}/>
        <div className="monitoring-status-controls">
          <WhatsAppConnection compact />
          {dataConnection && <SheetsConnection compact connection={dataConnection} contactsConnection={contactsConnection} preferences={sheetPreferences} onPreferencesChange={onSheetPreferencesChange}/>}
        </div>
      </div>
      <OrderProgress summary={!isLive && filters.pic !== 'ALL' ? {...orderSummary, ...(orderSummary.byPic.find(item => item.pic === filters.pic) || {total:0,done:0,pending:0}), pic:filters.pic} : orderSummary} acCount={new Set(acGroups.map(group => group.acName)).size} storeCount={totalStoresCount} live={isLive} ready={!isLive || Boolean(dataConnection?.snapshot)} phase={dataConnection?.phase} checkedAt={dataConnection?.checkedAt}/>


      <section className="workspace-panel">
        <div className="workspace-toolbar">
          <div className="workspace-date-views">
            <div className="flex items-center gap-2 min-w-0"><Calendar size={16} className="text-zinc-400 shrink-0" />
            {isLive ? <span className="text-xs text-zinc-500">{dataConnection.snapshot?.date || (dataConnection.mode === 'daily' ? todayDate : '2026-10-31')} · DS + REG</span> : <>
            <select className="clean-select date-select" aria-label="Tanggal monitoring" value={selectedDate} onChange={e => onSelectDate(e.target.value)}>
              {Array.from(new Set([todayDate, yesterdayDate, ...savedDates, selectedDate])).filter(Boolean).sort().reverse().map(d => <option key={d} value={d}>{d === todayDate ? 'Hari ini' : d === yesterdayDate ? 'Kemarin' : formatDateDisplay(d)}</option>)}
            </select>
            {isArchiveMode && <span className="tiny-badge">Arsip</span>}</>}</div>
            <div className="monitoring-view-toggle" role="group" aria-label="Pilihan tampilan monitoring">
              <button className={viewMode !== 'sheet' ? 'active' : ''} aria-pressed={viewMode !== 'sheet'} onClick={() => setViewMode('split')}><Columns size={14}/>Antrean</button>
              <button className={viewMode === 'sheet' ? 'active' : ''} aria-pressed={viewMode === 'sheet'} onClick={() => setViewMode('sheet')}><FileSpreadsheet size={14}/>Spreadsheet</button>
            </div>
          </div>
          <div className="flex items-center gap-1 min-w-0">
            <select className="clean-select template-select" aria-label="Template pesan" value={activeTemplateKey} onChange={e => onSelectTemplateKey(e.target.value)}>{Object.entries(templates).map(([key, t], i) => <option value={key} key={key}>{t.name.replace(/^Template \d+:?\s*/, '') || `Template ${i + 1}`}</option>)}</select>
            <button className="icon-button" aria-label="Pengaturan desain" title="Pengaturan desain" onClick={onNavigateToSettings}><Palette size={16}/></button>
            <span className="toolbar-divider" />
            {viewMode !== 'sheet' && <button className={`icon-button ${viewMode === 'grid' ? 'is-active' : ''}`} aria-pressed={viewMode === 'grid'} aria-label="Tampilan kartu" title={viewMode === 'grid' ? 'Kembali ke daftar antrean' : 'Tampilan kartu'} onClick={() => setViewMode(viewMode === 'grid' ? 'split' : 'grid')}><LayoutGrid size={16}/></button>}
            <button className="icon-button danger-icon" title="Reset data tanggal ini" aria-label="Reset data tanggal ini" onClick={handleConfirmResetDate} disabled={isLive || !acGroups.length}><Trash2 size={16}/></button>
          </div>
        </div>

        <div className="filter-bar">
          <label className="search-field"><Search size={16}/><input aria-label="Cari AC, toko, atau shipment" placeholder="Cari AC, toko, shipment…" value={filters.search} onChange={e => handleFilterChange('search', e.target.value)}/></label>
          <div className="filter-selects">
            {viewMode === 'sheet' && <select className="clean-select" aria-label="Filter status pesanan spreadsheet" value={sheetOrderStatus} onChange={event => setSheetOrderStatus(event.target.value)}><option value="ALL">Semua status pesanan</option><option value="ACTIVE">Belum DONE</option><option value="DONE">DONE</option><option value="EMPTY">Belum diisi</option>{[...new Set(sheetSourceRows.map(row => String(row.sheetStatus || '').trim()).filter(status => status && status.toUpperCase() !== 'DONE'))].sort().map(status => <option key={status} value={status}>{status}</option>)}</select>}
            {isLive && <>
              <select className="clean-select" aria-label="Filter sumber" value={sheetPreferences.source} onChange={e => {onSheetPreferencesChange(prev => ({...prev, source: e.target.value})); setSelectedAcKey(null)}}><option value="ALL">DS + REG</option><option value="DS">DS</option><option value="REG">REG</option></select>
              <select className="clean-select" aria-label="Filter PIC spreadsheet" value={sheetPreferences.pic} onChange={e => {onSheetPreferencesChange(prev => ({...prev, pic: e.target.value})); setSelectedAcKey(null)}}><option value="ALL">Semua PIC</option>{[...new Set([sheetPreferences.pic, ...sourcePics])].filter(p => p && p !== 'ALL').map(pic => <option key={pic}>{pic}</option>)}</select>
              {viewMode !== 'sheet' && <select className="clean-select" aria-label="Status pesanan di sheet" value={sheetPreferences.orderStatus} onChange={e => {onSheetPreferencesChange(prev => ({...prev, orderStatus: e.target.value})); setSelectedAcKey(null)}}><option value="ACTIVE">Belum DONE</option><option value="ALL">Semua yang belum DONE</option><option value="EMPTY">Belum diisi</option>{sourceStatuses.map(status => <option key={status}>{status}</option>)}</select>}
            </>}
            {viewMode !== 'sheet' && <select className="clean-select" aria-label="Filter status" value={filters.status} onChange={e => handleFilterChange('status', e.target.value)}><option value="ALL">Status chat</option>{statuses.map(s => <option key={s.id} value={s.id}>{s.shortLabel || s.label} ({statusCounts[s.id] || 0})</option>)}</select>}
            {!isLive && <select className="clean-select" aria-label="Filter PIC" value={filters.pic} onChange={e => handleFilterChange('pic', e.target.value)}><option value="ALL">PIC</option>{availablePics.map(p => <option key={p}>{p}</option>)}</select>}
            <select className="clean-select" aria-label="Filter jam" value={filters.jam} onChange={e => handleFilterChange('jam', e.target.value)}><option value="ALL">Jam</option>{availableJams.map(j => <option key={j}>{j}</option>)}</select>
            <select className="clean-select" aria-label="Filter SLA" value={filters.sla} onChange={e => handleFilterChange('sla', e.target.value)}><option value="ALL">SLA</option><option value="CRITICAL">Kritis</option><option value="OVER_1_2">&gt; 1–2 jam</option><option value="12_JAM">&gt; 12 jam</option><option value="6_JAM">&gt; 6 jam</option><option value="2_JAM">&gt; 2 jam</option><option value="1_JAM">&gt; 1 jam</option></select>
            {(Object.values(filters).some(v => v !== 'ALL' && v !== '') || (viewMode === 'sheet' && sheetOrderStatus !== 'ALL')) && <button className="icon-button" aria-label="Hapus filter" title="Hapus filter" onClick={() => { setFilters({search: '', pic: 'ALL', jam: 'ALL', sla: 'ALL', status: 'ALL'}); setSheetOrderStatus('ALL'); setSelectedAcKey(null) }}><RotateCcw size={14}/></button>}
          </div>
        </div>

        {viewMode !== 'sheet' && acGroups.length === 0 ? <div className="empty-panel"><FileSpreadsheet size={30} strokeWidth={1}/><h2>{isLive ? (dataConnection.snapshot ? 'Tidak ada pesanan untuk filter ini' : dataConnection.phase === 'error' ? 'Sumber belum bisa dibaca' : 'Menghubungkan Google Sheets…') : 'Belum ada data'}</h2>{isLive ? <span className="text-xs text-zinc-400">{dataConnection.snapshot ? 'Ubah PIC, sumber, atau status pesanan.' : 'Data manual tetap tersimpan terpisah.'}</span> : <div className="flex gap-2 flex-wrap justify-center"><button className="primary-button" onClick={() => setIsPasteModalOpen(true)}><Plus size={15}/>Input data</button><button className="secondary-button" onClick={handleLoadDemo}>Muat demo</button></div>}</div> : viewMode !== 'sheet' && filteredAcGroups.length === 0 ? <div className="empty-panel"><Search size={28}/><h2>Tidak ada hasil</h2><span className="text-xs text-zinc-400">Sesuaikan pencarian atau filter.</span></div> : viewMode === 'sheet' ? <MonitoringSheet rows={sheetSourceRows} groups={filteredAcGroups} filters={filters} search={deferredSearch} orderStatus={sheetOrderStatus} filterKey={`${sheetFilterKey}:${sheetOrderStatus}`} onOpenGroup={key => {setSelectedAcKey(key);setSheetDetailKey(key)}} tableSettings={tableSettings} showToast={showToast} storage={storage}/> : viewMode === 'split' ? (
          <div className="workspace-split">
            <section className="queue-panel" aria-label="Antrean AC">
              <div className="queue-heading"><h2>Antrean AC</h2><span className="tiny-badge">{filteredAcGroups.length}</span></div>
              <div className="queue-list">{filteredAcGroups.map((group, index) => <AcListItem key={group.acKey} acGroup={group} isSelected={currentAc?.acKey === group.acKey} statuses={statuses} onClick={() => setSelectedAcKey(group.acKey)}/>)}</div>
            </section>
            <div className="detail-wrapper">{currentAc && <AcDetailPanel key={`${currentAc.acKey}:${orderSetKey(currentAc.rows)}`} acGroup={currentAc} contactsReady={contactsConnection?.ready ?? true} renderedMessage={renderTemplate(activeTemplate.content, currentAc)} statuses={statuses} onStatusChange={onStatusChange} onPhoneChange={onPhoneChange} onPreviewImage={(url, name) => setPreviewModalData({isOpen: true, dataUrl: url, acName: name})} showToast={showToast} onPrevAc={() => setSelectedAcKey(filteredAcGroups[Math.max(0, visibleAcIndex - 1)]?.acKey)} onNextAc={() => setSelectedAcKey(filteredAcGroups[Math.min(filteredAcGroups.length - 1, visibleAcIndex + 1)]?.acKey)} hasPrev={visibleAcIndex > 0} hasNext={visibleAcIndex < filteredAcGroups.length - 1} currentIndex={visibleAcIndex} totalCount={filteredAcGroups.length} tableSettings={tableSettings} onNavigateToSettings={onNavigateToSettings}/>}</div>
          </div>
        ) : <div className="workspace-grid">{filteredAcGroups.map(group => <AcCard key={`${group.acKey}:${orderSetKey(group.rows)}`} acGroup={group} contactsReady={contactsConnection?.ready ?? true} renderedMessage={renderTemplate(activeTemplate.content, group)} statuses={statuses} onStatusChange={onStatusChange} onPhoneChange={onPhoneChange} onPreviewImage={(url, name) => setPreviewModalData({isOpen: true, dataUrl: url, acName: name})} showToast={showToast} tableSettings={tableSettings}/>)}</div>}
      </section>
      {viewMode === 'sheet' && sheetDetailAc && <SheetDetailDialog onClose={() => setSheetDetailKey(null)}><AcDetailPanel key={`${sheetDetailAc.acKey}:${orderSetKey(sheetDetailAc.rows)}`} compact acGroup={sheetDetailAc} contactsReady={contactsConnection?.ready ?? true} renderedMessage={renderTemplate(activeTemplate.content, sheetDetailAc)} statuses={statuses} onStatusChange={onStatusChange} onPhoneChange={onPhoneChange} onPreviewImage={(url,name) => setPreviewModalData({isOpen:true,dataUrl:url,acName:name})} showToast={showToast} tableSettings={tableSettings}/></SheetDetailDialog>}
      <Suspense fallback={null}>
        {isPasteModalOpen && <PasteInputModal isOpen onClose={() => setIsPasteModalOpen(false)} onImportData={onImportData} existingRows={rawRows} showToast={showToast}/>}
        {previewModalData.isOpen && <ImagePreviewModal isOpen dataUrl={previewModalData.dataUrl} acName={previewModalData.acName} onClose={() => setPreviewModalData({isOpen: false, dataUrl: '', acName: ''})} showToast={showToast}/>}
      </Suspense>
    </div>
  )
}

function SheetDetailDialog({ children, onClose }) {
  const ref = useRef(null)
  const id = useId()
  useEffect(() => { if (!ref.current.open) ref.current.showModal() }, [])
  const close = () => { ref.current.close(); onClose() }
  return createPortal(<dialog ref={ref} className="sheet-detail-dialog" aria-labelledby={id} onClose={onClose} onCancel={event => {event.preventDefault();close()}} onClick={event => {if(event.target === event.currentTarget) close()}}><div className="sheet-detail-heading"><h2 id={id}>Pesan &amp; lampiran</h2><button className="icon-button" aria-label="Tutup detail spreadsheet" onClick={close}><X size={18}/></button></div>{children}</dialog>, document.body)
}
