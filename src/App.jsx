import { summarizeOrders } from './utils/orderState'
import { GoogleAdmin, GoogleSourceProvider } from './cloud/GoogleAdmin'
import { workspaceAppearance, imageSettingsOnly, saveImageSettings } from './utils/appearance'
import { useAppearance } from './hooks/useAppearance'
import React, { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { useContactsSheet } from './hooks/useContactsSheet'
import { useLiveSheets } from './hooks/useLiveSheets'
import { workingSheetRows } from './utils/sheetsParser'
import { LINKED_SHEET_DATE, jakartaDate } from './utils/sheetsConfig'
import { Header } from './components/Header'
import { MonitoringWorkspace } from './components/MonitoringWorkspace'
const PodBroadcastView = lazy(() => import('./components/PodBroadcastView').then(m => ({ default: m.PodBroadcastView })))
const TarikDataView = lazy(() => import('./components/TarikDataView').then(m => ({ default: m.TarikDataView })))
const TemplateSettings = lazy(() => import('./components/TemplateSettings').then(m => ({ default: m.TemplateSettings })))
const SettingsView = lazy(() => import('./components/SettingsView').then(m => ({ default: m.SettingsView })))
import { Toast } from './components/Toast'
import { matchSapaWithContacts, groupRowsByAc } from './utils/matcher'
import { DEFAULT_TEMPLATES } from './utils/templateEngine'
import { DEFAULT_TABLE_SETTINGS } from './utils/tableSettings'
import { ProfileGate } from './profiles/ProfileGate'
import { usePicProfile, usePicSetting } from './profiles/ProfileContext'
import {
  DEFAULT_STATUSES,
  getStatusById,
} from './utils/statusConfig'
import {
  getTodayDateString,
  saveDailySession as saveDailySessionForPic,
  loadDailySession as loadDailySessionForPic,
  clearDailySession as clearDailySessionForPic,
  getStoredSessionDates as getStoredSessionDatesForPic,
  formatDateDisplay,
} from './utils/sessionManager'

const EMPTY_CONTACTS = []

export function App() { return location.pathname === '/admin' ? <GoogleAdmin/> : <GoogleSourceProvider><ProfileGate><WorkspaceApp /></ProfileGate></GoogleSourceProvider> }
function WorkspaceApp() {
  const profile = usePicProfile()
  const storage = profile.storage
  const sessionScope = useMemo(() => ({ pic: profile.name, storage }), [profile.name, storage])
  const saveDailySession = (date, rows, statuses) => saveDailySessionForPic(date, rows, statuses, sessionScope)
  const loadDailySession = date => loadDailySessionForPic(date, sessionScope)
  const clearDailySession = date => clearDailySessionForPic(date, sessionScope)
  const getStoredSessionDates = () => getStoredSessionDatesForPic(sessionScope)
  const sheets = useLiveSheets({ storage })
  const contactsConnection = useContactsSheet()
  const masterContacts = contactsConnection.snapshot?.contacts || EMPTY_CONTACTS
  const [sheetPreferences, setSheetPreferences] = useState(() => {
    try { const saved = JSON.parse(storage.getItem('sapa_sheet_preferences') || '{}'); return { source: 'ALL', orderStatus: 'ACTIVE', ...saved, ...(String(saved?.orderStatus).trim().toUpperCase() === 'DONE' ? { orderStatus: 'ACTIVE' } : {}), pic: profile.name } } catch { return { source: 'ALL', pic: profile.name, orderStatus: 'ACTIVE' } }
  })
  const liveDate = sheets.snapshot?.date || (sheets.mode === 'daily' ? jakartaDate() : LINKED_SHEET_DATE)
  const [liveStatusState, setLiveStatusState] = useState({ date: '', values: {} })
  const liveStatusMap = useMemo(() => liveStatusState.date === liveDate ? liveStatusState.values : (() => { try { return JSON.parse(storage.getItem(`sapa_sheet_chat_status_${liveDate}`) || '{}') } catch { return {} } })(), [liveStatusState, liveDate])
  useEffect(() => { try { storage.setItem('sapa_sheet_preferences', JSON.stringify(sheetPreferences)) } catch {} }, [sheetPreferences])

  // 1. Dark Mode
  const [darkMode, setDarkMode] = usePicSetting('darkMode', false)
  const [sharedTableSettings, setSharedTableSettings] = usePicSetting('tableSettings', DEFAULT_TABLE_SETTINGS)
  const tableSettings = useMemo(() => imageSettingsOnly(sharedTableSettings), [sharedTableSettings])
  const appearance = useMemo(() => workspaceAppearance(sharedTableSettings, profile.values.appearance), [sharedTableSettings, profile.values.appearance])
  useAppearance(appearance, darkMode)
  const handleSaveAppearance = async value => { setSharedTableSettings(prev => ({ ...prev, workspaceAppearance: value })); await profile.flush() }

  // Modal Input SAPA (bisa dibuka dari Header di halaman mana saja)
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false)

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }, [darkMode])

  // 2. Active Tab
  const [activeTab, setActiveTab] = useState('workspace')
  const [settingsTab, setSettingsTab] = useState('appearance')

  // 3. Status Pengerjaan yang dapat dikustomisasi (Settings Tab & Workspace)
  const [statuses, setStatuses] = usePicSetting('statuses', DEFAULT_STATUSES)

  const handleUpdateStatuses = async newStatuses => { setStatuses(newStatuses); await profile.flush() }

  // 4. Multi-Day Session Management & Archiving (Kemarin / Hari-hari Sebelumnya)
  const [selectedDate, setSelectedDate] = useState(() => getTodayDateString())
  const [savedDates, setSavedDates] = useState(() => getStoredSessionDates())

  // 6. Raw SAPA 3 Rows (dari paste Google Sheets)
  const [sapaRawRows, setSapaRawRows] = useState(() => {
    try {
      const today = getTodayDateString()
      const cachedSession = storage.getItem(`sapa_session_${today}`)
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession)
        if (parsed.rawRows && parsed.rawRows.length > 0) return parsed.rawRows
      }
      const saved = storage.getItem('sapa_current_raw_data')
      if (saved) return JSON.parse(saved)
      return []
    } catch {
      return []
    }
  })

  // 7. Status Pengiriman Sent / Pending / Custom Status Map
  const [sentStatusMap, setSentStatusMap] = useState(() => {
    try {
      const today = getTodayDateString()
      const cachedSession = storage.getItem(`sapa_session_${today}`)
      if (cachedSession) {
        const parsed = JSON.parse(cachedSession)
        if (parsed.statusMap) return parsed.statusMap
      }
      const saved = storage.getItem(`sapa_sent_status_${today}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // 8. Template Pesan
  const [templates, setTemplates] = usePicSetting('templates', DEFAULT_TEMPLATES)
  const [activeTemplateKey, setActiveTemplateKey] = usePicSetting('activeTemplateKey', 'template_1')
  const handleSaveTableSettings = async settings => { setSharedTableSettings(prev => saveImageSettings(settings, prev)); await profile.flush() }

  // 10. Manual Phone Overrides
  const [phoneOverrides, setPhoneOverrides] = useState(() => {
    try {
      const saved = storage.getItem('sapa_phone_overrides')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // 11. Toast Notifications
  const [toast, setToast] = useState(null)
  const showToast = (message, type = 'info') => {
    setToast({ message, type })
    setTimeout(() => {
      setToast((curr) => (curr?.message === message ? null : curr))
    }, 3500)
  }

  // Efek Pergantian Tanggal Sesi (Muat Data Hari Ini / Kemarin / Arsip)
  useEffect(() => {
    let isMounted = true
    const loadSessionForDate = async () => {
      try {
        const session = await loadDailySession(selectedDate)
        if (!isMounted) return

        if (session) {
          setSapaRawRows(session.rawRows || [])
          setSentStatusMap(session.statusMap || {})
        } else {
          // Jika belum ada session di IndexedDB/localStorage:
          if (selectedDate === getTodayDateString()) {
            // Inisialisasi data hari ini
            const initialRows = []
            setSapaRawRows(initialRows)
            setSentStatusMap({})
            await saveDailySession(selectedDate, initialRows, {})
          } else {
            // Tanggal arsip lain yang belum memiliki riwayat
            setSapaRawRows([])
            setSentStatusMap({})
          }
        }
        setSavedDates(getStoredSessionDates())
      } catch (err) {
        console.error('Failed to load session for date:', selectedDate, err)
      }
    }

    loadSessionForDate()
    return () => {
      isMounted = false
    }
  }, [selectedDate])

  // Shared PIC settings are saved with revision checks.
  const handleSaveTemplates = async (newTemplates, selectedKey) => {
    setTemplates(newTemplates)
    if (selectedKey) setActiveTemplateKey(selectedKey)
    await profile.flush()
  }

  const handleSelectTemplateKey = (key) => {
    setActiveTemplateKey(key)
  }

  // Status Change Handler (Mendukung Multi-Status)
  const handleStatusChange = (acKey, newStatus) => {
    const updated = { ...sentStatusMap, [acKey]: newStatus }
    setSentStatusMap(updated)
    saveDailySession(selectedDate, sapaRawRows, updated)
  }

  // Reset Status Pengiriman Antrean Sesi Aktif
  const handleResetSentStatus = () => {
    if (window.confirm('Reset status semua antrean pada tanggal ini menjadi Belum Dikerjakan?')) {
      setSentStatusMap({})
      saveDailySession(selectedDate, sapaRawRows, {})
      showToast('Status pengerjaan antrean berhasil direset!', 'info')
    }
  }

  // Reset Bersih Data Hari/Tanggal Tertentu
  const handleResetDayData = async (dateToReset) => {
    const targetDate = dateToReset || selectedDate
    await clearDailySession(targetDate)
    if (targetDate === selectedDate) {
      setSapaRawRows([])
      setSentStatusMap({})
    }
    setSavedDates(getStoredSessionDates())
    showToast(`Data untuk tanggal ${formatDateDisplay(targetDate)} berhasil direset & dibersihkan!`, 'info')
  }

  // Ganti Tanggal Terpilih
  const handleSelectDate = (newDate) => {
    if (!newDate || newDate === selectedDate) return
    setSelectedDate(newDate)
  }

  // Phone Change Handler
  const handlePhoneChange = (acKey, newPhone) => {
    const updated = { ...phoneOverrides, [acKey]: newPhone }
    setPhoneOverrides(updated)
    try {
      storage.setItem('sapa_phone_overrides', JSON.stringify(updated))
    } catch {}
  }

  // Import Data Handler (dengan Dukungan Anti-Duplikat Cerdas)
  const handleImportData = (rows) => {
    sheets.setEnabled(false)
    setSapaRawRows(rows)
    saveDailySession(selectedDate, rows, sentStatusMap)
    setSavedDates(getStoredSessionDates())
    setActiveTab('workspace')
  }

  const sourceRows = sheets.enabled ? sheets.snapshot?.rows || [] : sapaRawRows
  const orderSummary = useMemo(() => summarizeOrders(sourceRows, sheets.enabled ? sheetPreferences : { pic: 'ALL', source: 'ALL' }), [sourceRows, sheets.enabled, sheetPreferences])
  // DONE never enters the working set, even with a cached ALL/Done filter.
  const monitoringRows = useMemo(() => workingSheetRows(sourceRows, sheets.enabled ? sheetPreferences : {}), [sourceRows, sheets.enabled, sheetPreferences])
  const activeStatusMap = sheets.enabled ? liveStatusMap : sentStatusMap
  const handleMonitoringStatusChange = (acKey, status) => {
    if (!sheets.enabled) return handleStatusChange(acKey, status)
    const values = { ...liveStatusMap, [acKey]: status }
    setLiveStatusState({ date: liveDate, values })
    try { storage.setItem(`sapa_sheet_chat_status_${liveDate}`, JSON.stringify(values)) } catch {}
  }

  // Enriched and Grouped ACs
  const acGroups = useMemo(() => {
    if (!monitoringRows.length) return []

    // 1. Cocokkan dengan master contacts
    const enriched = matchSapaWithContacts(monitoringRows, masterContacts, { preferMasterContacts: true })

    // 2. Kelompokkan per AC
    const groups = groupRowsByAc(enriched, activeStatusMap, { workingOnly: true, splitSources: true })

    // 3. Terapkan manual phone overrides jika ada
    return groups.map((g) => {
      if (phoneOverrides[g.acKey] || phoneOverrides[g.acName]) {
        return { ...g, phone: phoneOverrides[g.acKey] || phoneOverrides[g.acName] }
      }
      return g
    })
  }, [monitoringRows, masterContacts, activeStatusMap, phoneOverrides])

  // Hitung jumlah AC yang belum selesai (berdasarkan konfigurasi status countsAsCompleted)
  const pendingCount = useMemo(() => {
    return acGroups.filter((g) => {
      const statusId = sentStatusMap[g.acKey] || 'belum_dikerjakan'
      if (statusId === 'sent') return false
      const statusObj = getStatusById(statusId, statuses)
      return !statusObj?.countsAsCompleted
    }).length
  }, [acGroups, sentStatusMap, statuses])

  // Hitung perkiraan pending POD untuk badge navigasi
  const podPendingCount = useMemo(() => {
    try {
      const rows = JSON.parse(storage.getItem('sapa_pod_rows') || '[]')
      const today = new Date().toISOString().slice(0, 10)
      const st = JSON.parse(storage.getItem(`sapa_pod_status_${today}`) || '{}')
      return rows.filter((r) => st[r.acKey]?.status !== 'sent').length
    } catch {
      return 0
    }
  }, [activeTab])

  const activeTemplate = templates[activeTemplateKey] || DEFAULT_TEMPLATES.template_1

  return (
    <div className={`app-shell ${activeTab === 'workspace' ? 'is-monitoring' : ''}`}>
      {/* Top Header dengan Pill Nav & Tombol Input Yellow Pill (Sesuai Gambar Acuan) */}
      <Header
        showToast={showToast}
        darkMode={darkMode}
        onToggleDarkMode={() => setDarkMode(!darkMode)}
        pendingCount={pendingCount}
        podPendingCount={podPendingCount}
        activeTab={activeTab}
        onTabChange={tab => { if (tab === 'settings') setSettingsTab('appearance'); setActiveTab(tab) }}
        onOpenPasteModal={() => {
          sheets.setEnabled(false)
          setActiveTab('workspace')
          setIsPasteModalOpen(true)
        }}
      />

      {/* Main Container */}
      <main className="app-main">
        <Suspense fallback={<div className="loading-panel" role="status"><span className="loading-dot" />Memuat…</div>}>
        {/* Tab 1: Workspace Monitoring */}
        {activeTab === 'workspace' && (
          <MonitoringWorkspace
            acGroups={acGroups}
            rawRows={monitoringRows}
            sheetRows={sourceRows}
            orderSummary={orderSummary}
            dataConnection={sheets}
            sheetPreferences={sheetPreferences}
            onSheetPreferencesChange={setSheetPreferences}
            contactsConnection={contactsConnection}
            activeTemplate={activeTemplate}
            activeTemplateKey={activeTemplateKey}
            onSelectTemplateKey={handleSelectTemplateKey}
            templates={templates}
            onImportData={handleImportData}
            onStatusChange={handleMonitoringStatusChange}
            onPhoneChange={handlePhoneChange}
            onResetSentStatus={handleResetSentStatus}
            sentStatusMap={activeStatusMap}
            showToast={showToast}
            isPasteModalOpen={isPasteModalOpen}
            setIsPasteModalOpen={setIsPasteModalOpen}
            tableSettings={tableSettings}
            onNavigateToSettings={() => { setSettingsTab('image'); setActiveTab('settings') }}
            selectedDate={selectedDate}
            onSelectDate={handleSelectDate}
            onResetDayData={handleResetDayData}
            savedDates={savedDates}
            statuses={statuses}
          />
        )}

        {/* Tab 1.5: Broadcast Pengingat POD (Proof of Delivery) */}
        {activeTab === 'pod' && (
          <PodBroadcastView masterContacts={masterContacts} contactsReady={contactsConnection.ready} showToast={showToast} />
        )}

        {activeTab === 'tarik-data' && (
          <TarikDataView contacts={masterContacts} contactsReady={contactsConnection.ready} monitoringMode={sheets.mode} showToast={showToast} />
        )}

        {/* Tab 3: Template Settings */}
        {activeTab === 'templates' && (
          <TemplateSettings key={`templates-${profile.formResetKey}`}
            templates={templates}
            activeTemplateKey={activeTemplateKey}
            onSelectActiveTemplate={handleSelectTemplateKey}
            onSaveTemplates={handleSaveTemplates}
            showToast={showToast}
          />
        )}

        {/* Tab 4: Pengaturan Sistem (Kustomisasi Status Pengerjaan & Desain Gambar Tabel SAPA 3) */}
        {activeTab === 'settings' && (
          <SettingsView initialSubTab={settingsTab} appearance={appearance} onSaveAppearance={handleSaveAppearance} key={`settings-${profile.formResetKey}-${settingsTab}`}
            tableSettings={tableSettings}
            onSaveTableSettings={handleSaveTableSettings}
            statuses={statuses}
            onUpdateStatuses={handleUpdateStatuses}
            showToast={showToast}
          />
        )}

        </Suspense>
      </main>

      {/* Toast Notification */}
      <Toast toast={toast} onClose={() => setToast(null)} />
    </div>
  )
}

export default App

