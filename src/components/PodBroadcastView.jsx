import { usePicProfile, usePicSetting } from '../profiles/ProfileContext'
import { InfoButton } from './InfoButton'
import React, { useState, useEffect, useMemo, useRef } from 'react'
import {
  Package,
  Sparkles,
  Play,
  Pause,
  Square,
  SkipForward,
  RotateCcw,
  Send,
  Copy,
  Check,
  Search,
  Filter,
  Sliders,
  Volume2,
  VolumeX,
  ExternalLink,
  Phone,
  AlertTriangle,
  Clock,
  CheckCircle2,
  HelpCircle,
  FileText,
  UserCheck,
  UserX,
  Plus,
  Trash2,
  Layers,
  ChevronRight,
  ShieldCheck,
  Edit3,
  X
} from 'lucide-react'
import {
  DEFAULT_POD_TEMPLATE,
  parsePodText,
  matchPodWithContacts,
  renderPodMessage,
  playChimeSound
} from '../utils/podManager'
import { createWhatsAppWebUrl, formatPhoneDisplay, normalizePhone, isValidIndonesianPhone, openWhatsAppUrl, WA_TAB_NAME } from '../utils/phoneUtils'
import { PodInputModal } from './PodInputModal'

export function PodBroadcastView({ masterContacts = [], contactsReady = true, showToast }) {
  const { storage } = usePicProfile()
  // 1. Data POD Rows (Tersimpan di localStorage)
  const [podRows, setPodRows] = useState(() => {
    try {
      const saved = storage.getItem('sapa_pod_rows')
      if (saved) return JSON.parse(saved)
    } catch {}
    return []
  })

  // 2. Status Pengiriman Map: { [acKey]: { status: 'sent'|'skipped', sentAt: timestamp } }
  const [statusMap, setStatusMap] = useState(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      const saved = storage.getItem(`sapa_pod_status_${today}`)
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // 3. Manual Phone Overrides: { [acKey]: string }
  const [phoneOverrides, setPhoneOverrides] = useState(() => {
    try {
      const saved = storage.getItem('sapa_pod_phone_overrides')
      if (saved) return JSON.parse(saved)
    } catch {}
    return {}
  })

  // 4. Template Pesan POD
  const [template, setTemplate] = usePicSetting('podTemplate', DEFAULT_POD_TEMPLATE)
  const [delaySeconds, setDelaySeconds] = usePicSetting('podDelay', 8)
  const [useSameTab, setUseSameTab] = usePicSetting('podUseSameTab', true)
  const [soundEnabled, setSoundEnabled] = usePicSetting('podSoundEnabled', true)
  const [isPopupBlocked, setIsPopupBlocked] = useState(false)
  const [isEditingTemplate, setIsEditingTemplate] = useState(false)
  const [isInputModalOpen, setIsInputModalOpen] = useState(false)
  const [editingPhoneAcKey, setEditingPhoneAcKey] = useState(null)
  const [tempPhoneInput, setTempPhoneInput] = useState('')

  // 6. State Auto-Sequence Engine
  const [isAutoRunning, setIsAutoRunning] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [countdown, setCountdown] = useState(delaySeconds)
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0)

  // 7. Filter & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [filterTab, setFilterTab] = useState('all') // 'all' | 'ready' | 'sent' | 'no_phone'
  const [selectedAcKey, setSelectedAcKey] = useState(null)

  // Simpan data rows ke localStorage
  useEffect(() => {
    try {
      storage.setItem('sapa_pod_rows', JSON.stringify(podRows))
    } catch {}
  }, [podRows, storage])

  // Simpan statusMap ke localStorage
  useEffect(() => {
    try {
      const today = new Date().toISOString().slice(0, 10)
      storage.setItem(`sapa_pod_status_${today}`, JSON.stringify(statusMap))
    } catch {}
  }, [statusMap, storage])

  // Simpan phoneOverrides ke localStorage
  useEffect(() => {
    try {
      storage.setItem('sapa_pod_phone_overrides', JSON.stringify(phoneOverrides))
    } catch {}
  }, [phoneOverrides, storage])

  // Enriched Items (Mencocokkan AC dengan Master Contacts)
  const enrichedItems = useMemo(() => {
    return matchPodWithContacts(podRows, masterContacts, phoneOverrides)
  }, [podRows, masterContacts, phoneOverrides])

  // Pilih item pertama jika belum ada yang dipilih
  useEffect(() => {
    if (enrichedItems.length > 0 && !selectedAcKey) {
      setSelectedAcKey(enrichedItems[0].acKey)
    }
  }, [enrichedItems, selectedAcKey])

  // Item yang sedang aktif dipilih untuk preview
  const activeSelectedItem = useMemo(() => {
    return enrichedItems.find((item) => item.acKey === selectedAcKey) || enrichedItems[0] || null
  }, [enrichedItems, selectedAcKey])

  // Antrean yang valid untuk dikirim otomatis (Hanya AC yang terdaftar nomornya dan belum terkirim)
  const eligibleQueue = useMemo(() => {
    return enrichedItems.filter(
      (item) => item.hasPhone && statusMap[item.acKey]?.status !== 'sent'
    )
  }, [enrichedItems, statusMap])

  // Statistik Ringkasan
  const totalAc = enrichedItems.length
  const totalShipments = enrichedItems.reduce((sum, item) => sum + (item.shipmentCount || 0), 0)
  const readyToSendCount = enrichedItems.filter((item) => item.hasPhone).length
  const noPhoneCount = enrichedItems.filter((item) => !item.hasPhone).length
  const sentCount = enrichedItems.filter((item) => statusMap[item.acKey]?.status === 'sent').length
  const progressPercent = readyToSendCount > 0 ? Math.round((sentCount / readyToSendCount) * 100) : 0

  // Filtered List untuk Tampilan Tabel
  const filteredItems = useMemo(() => {
    return enrichedItems.filter((item) => {
      // 1. Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim()
        const matchName = item.namaAc.toLowerCase().includes(q)
        const matchPhone = item.phone.includes(q)
        if (!matchName && !matchPhone) return false
      }

      // 2. Filter Tab
      const isSent = statusMap[item.acKey]?.status === 'sent'
      if (filterTab === 'ready') return item.hasPhone && !isSent
      if (filterTab === 'sent') return isSent
      if (filterTab === 'no_phone') return !item.hasPhone

      return true
    })
  }, [enrichedItems, searchQuery, filterTab, statusMap])

  // -------------------------------------------------------------
  // HANDLERS PENGIRIMAN WHATSAPP
  // -------------------------------------------------------------

  // Dispatch single AC
  const dispatchWhatsApp = (item) => {
    if (!contactsReady) { showToast?.('Sumber kontak spreadsheet belum siap. Tunggu sinkronisasi kontak.', 'info'); return false }
    if (!item.hasPhone) {
      showToast?.(`Nomor WhatsApp untuk ${item.namaAc} belum terdaftar!`, 'error')
      return false
    }

    const message = renderPodMessage(template, item)
    const url = createWhatsAppWebUrl(item.phone, message)
    const targetName = useSameTab ? WA_TAB_NAME : '_blank'

    try {
      const win = openWhatsAppUrl(url, targetName)
      if (!win || win.closed || typeof win.closed === 'undefined') {
        setIsPopupBlocked(true)
        return false
      } else {
        setIsPopupBlocked(false)
      }
    } catch (e) {
      setIsPopupBlocked(true)
      return false
    }

    // Update status ke 'sent'
    setStatusMap((prev) => ({
      ...prev,
      [item.acKey]: { status: 'sent', sentAt: Date.now() },
    }))

    if (soundEnabled) {
      playChimeSound('dispatch')
    }

    showToast?.(`Membuka WhatsApp untuk ${item.namaAc} (${item.shipmentCount} Shipment)`, 'success')
    return true
  }

  // -------------------------------------------------------------
  // AUTO SEQUENCE ENGINE (KIRIM OTOMATIS BERGANTIAN DENGAN JEDA)
  // -------------------------------------------------------------
  const autoRunningRef = useRef(isAutoRunning)
  autoRunningRef.current = isAutoRunning
  const isPausedRef = useRef(isPaused)
  isPausedRef.current = isPaused

  const handleStartAuto = () => {
    if (eligibleQueue.length === 0) {
      showToast?.('Semua AC yang memiliki nomor terdaftar sudah terkirim!', 'info')
      return
    }

    const firstItem = eligibleQueue[0]
    setIsAutoRunning(true)
    setIsPaused(false)
    setCountdown(delaySeconds)

    // Langsung buka AC pertama saat tombol ditekan (User Gesture - Terhindar dari blokir popup)
    if (firstItem) {
      setSelectedAcKey(firstItem.acKey)
      dispatchWhatsApp(firstItem)
    }

    if (eligibleQueue.length <= 1) {
      setIsAutoRunning(false)
      if (soundEnabled) {
        setTimeout(() => playChimeSound('complete'), 500)
      }
      showToast?.('🎉 Selesai! Semua AC yang terdaftar berhasil dikirimkan pesan POD.', 'success')
      return
    }

    showToast?.(`Kirim otomatis dimulai! AC berikutnya akan dibuka dalam ${delaySeconds} detik...`, 'info')
  }

  const handlePauseAuto = () => {
    setIsPaused(true)
    showToast?.('Pengiriman otomatis dijeda.', 'info')
  }

  const handleResumeAuto = () => {
    setIsPaused(false)
    showToast?.('Melanjutkan pengiriman otomatis...', 'info')
  }

  const handleStopAuto = () => {
    setIsAutoRunning(false)
    setIsPaused(false)
    setCountdown(delaySeconds)
    setCurrentQueueIndex(0)
    showToast?.('Pengiriman otomatis dihentikan.', 'info')
  }

  const handleSkipCurrent = () => {
    if (!isAutoRunning || eligibleQueue.length === 0) return
    const currentItem = eligibleQueue[currentQueueIndex]
    if (currentItem) {
      setStatusMap((prev) => ({
        ...prev,
        [currentItem.acKey]: { status: 'skipped', skippedAt: Date.now() },
      }))
      showToast?.(`Melewati pengiriman untuk ${currentItem.namaAc}`, 'info')
    }
    setCountdown(delaySeconds)
  }

  // Efek Timer Countdown Pengiriman Otomatis
  useEffect(() => {
    if (!isAutoRunning || isPaused) return

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev > 1) {
          return prev - 1
        }

        // Countdown mencapai 1 -> waktu dispatch!
        if (eligibleQueue.length > 0) {
          const targetItem = eligibleQueue[0] // Selalu ambil antrean pertama yang belum terkirim
          if (targetItem) {
            setSelectedAcKey(targetItem.acKey)
            dispatchWhatsApp(targetItem)
          }

          // Cek apakah antrean sudah selesai
          if (eligibleQueue.length <= 1) {
            setIsAutoRunning(false)
            if (soundEnabled) {
              playChimeSound('complete')
            }
            showToast?.('🎉 Selesai! Semua AC yang terdaftar berhasil dikirimkan pesan POD.', 'success')
            return delaySeconds
          }
        } else {
          setIsAutoRunning(false)
          return delaySeconds
        }

        // Reset countdown untuk AC berikutnya
        return delaySeconds
      })
    }, 1000)

    return () => clearInterval(timer)
  }, [isAutoRunning, isPaused, eligibleQueue, delaySeconds, soundEnabled, template, useSameTab])

  // Shortcut Keyboard: Tekan Spasi atau Enter untuk langsung kirim AC berikutnya
  useEffect(() => {
    const handleKeyDown = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      if (e.code === 'Space' || e.code === 'Enter') {
        if (eligibleQueue.length > 0) {
          e.preventDefault()
          const nextItem = eligibleQueue[0]
          setSelectedAcKey(nextItem.acKey)
          dispatchWhatsApp(nextItem)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [eligibleQueue, template, useSameTab, soundEnabled])

  // Reset Semua Status Pengiriman Menjadi Belum Dikirim
  const handleResetStatus = () => {
    if (window.confirm('Reset status pengiriman semua AC menjadi Belum Dikirim?')) {
      setStatusMap({})
      showToast?.('Status antrean pengiriman berhasil direset!', 'info')
    }
  }

  // Reset Bersih Data Antrean
  const handleClearAllData = () => {
    if (window.confirm('Hapus seluruh daftar antrean POD? Anda dapat mengimpor data baru setelah ini.')) {
      setPodRows([])
      setStatusMap({})
      showToast?.('Data antrean POD berhasil dikosongkan.', 'info')
    }
  }

  // Simpan Nomor HP Manual
  const handleSaveManualPhone = (acKey) => {
    const norm = normalizePhone(tempPhoneInput)
    if (!norm || !isValidIndonesianPhone(norm)) {
      showToast?.('Nomor WhatsApp tidak valid! Pastikan format 08xx / 628xx (minimal 10 digit).', 'error')
      return
    }

    setPhoneOverrides((prev) => ({ ...prev, [acKey]: norm }))
    setEditingPhoneAcKey(null)
    setTempPhoneInput('')
    showToast?.('Nomor WhatsApp berhasil disimpan untuk AC ini!', 'success')
  }

  // Salin Teks Pesan ke Clipboard
  const handleCopyText = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      showToast?.('Teks pesan berhasil disalin ke clipboard!', 'success')
    } catch {
      showToast?.('Teks gagal disalin. Periksa izin clipboard browser.', 'error')
    }
  }

  const currentAutoItem = isAutoRunning && eligibleQueue.length > 0 ? eligibleQueue[0] : null

  return (
    <div className="secondary-page space-y-6">
      {/* 1. Header Bar: Title & Primary Actions */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-zinc-100 text-amber-700 dark:bg-amber-950/70 dark:text-amber-300 flex items-center justify-center font-bold shadow-xs">
            <Package size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black text-zinc-900 dark:text-white tracking-tight">
                Broadcast POD
              </h1>
              
            </div>
            <InfoButton title="Informasi halaman">
              Kirim pengingat jumlah pesanan yang belum di-POD ke Area Coordinator (AC) secara berurutan dengan jeda waktu otomatis
            </InfoButton>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {podRows.length === 0 && (
            <button
              onClick={() => {
                const sample = parsePodText(SAMPLE_POD_TSV)
                setPodRows(sample)
                showToast?.('Berhasil memuat 34 data contoh sesuai gambar!', 'success')
              }}
              className="primary-button"
            >
              <Sparkles size={13} />
              <span>Contoh Data Gambar (34 AC)</span>
            </button>
          )}

          {podRows.length > 0 && (
            <button
              onClick={handleClearAllData}
              className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-rose-600 hover:text-rose-700 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 transition-all cursor-pointer"
              title="Kosongkan antrean data POD"
            >
              <Trash2 size={13} />
              <span>Reset Antrean</span>
            </button>
          )}

          <button
            onClick={() => setIsInputModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-full bg-[#FEE500] hover:bg-[#FDD800] text-zinc-950 shadow-2xs transition-all cursor-pointer"
          >
            <Plus size={14} />
            <span>+ Input / Paste Data POD</span>
          </button>
        </div>
      </div>

      {/* 2. Top Metric Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
        {/* Card 1: Total AC POD */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Total AC Antrean</span>
            <span className="w-8 h-8 rounded-full bg-blue-50 dark:bg-blue-950/50 text-blue-600 flex items-center justify-center font-bold">
              <Layers size={16} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
              {totalAc}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Area Coordinator</p>
          </div>
        </div>

        {/* Card 2: Total Pesanan Belum POD */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Total Pesanan POD</span>
            <span className="w-8 h-8 rounded-full bg-amber-50 dark:bg-amber-950/50 text-zinc-500 flex items-center justify-center font-bold">
              <Package size={16} />
            </span>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black text-zinc-500 dark:text-amber-400 tracking-tight">
              {totalShipments}
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">Shipment Belum POD</p>
          </div>
        </div>

        {/* Card 3: Status Nomor Kontak */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Kesiapan Kontak</span>
            <span className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 flex items-center justify-center font-bold">
              <Phone size={16} />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                {readyToSendCount}
              </span>
              <span className="text-xs text-zinc-400">/ {totalAc} Ada Nomor</span>
            </div>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
              {noPhoneCount > 0 ? `${noPhoneCount} AC belum ada nomor` : 'Semua nomor terverifikasi'}
            </p>
          </div>
        </div>

        {/* Card 4: Progress Pengiriman */}
        <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between text-zinc-400">
            <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400">Progress Pengiriman</span>
            <span className="w-8 h-8 rounded-full bg-purple-50 dark:bg-purple-950/50 text-zinc-600 flex items-center justify-center font-bold">
              <CheckCircle2 size={16} />
            </span>
          </div>
          <div className="mt-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">
                {progressPercent}%
              </span>
              <span className="text-xs text-zinc-400">({sentCount}/{readyToSendCount} Terkirim)</span>
            </div>
            {/* Progress bar */}
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full mt-2 overflow-hidden">
              <div
                className="bg-emerald-500 h-full rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Content: 2 Columns (Left: AC Queue Table, Right: Dispatcher Control & Preview) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN (7 COLS): Daftar Antrean AC & Shipment POD  */}
        {/* ======================================================== */}
        <div className="lg:col-span-7 bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
          {/* Filter Bar & Search */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/70 p-1 rounded-full text-xs font-bold overflow-x-auto">
              <button
                onClick={() => setFilterTab('all')}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === 'all'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Semua ({totalAc})
              </button>
              <button
                onClick={() => setFilterTab('ready')}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === 'ready'
                    ? 'bg-white dark:bg-zinc-900 text-emerald-600 dark:text-emerald-400 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Siap Kirim ({readyToSendCount - sentCount})
              </button>
              <button
                onClick={() => setFilterTab('sent')}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === 'sent'
                    ? 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-purple-400 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Terkirim ({sentCount})
              </button>
              <button
                onClick={() => setFilterTab('no_phone')}
                className={`px-3 py-1.5 rounded-full transition-all cursor-pointer whitespace-nowrap ${
                  filterTab === 'no_phone'
                    ? 'bg-white dark:bg-zinc-900 text-rose-600 dark:text-rose-400 shadow-2xs'
                    : 'text-zinc-500 hover:text-zinc-900 dark:hover:text-white'
                }`}
              >
                Tanpa Nomor ({noPhoneCount})
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama AC..."
                className="w-full sm:w-48 pl-8 pr-3 py-1.5 text-xs rounded-full border border-zinc-200 dark:border-zinc-700 bg-[#FAF8F5] dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
              />
            </div>
          </div>

          {/* Table Container */}
          <div className="border border-zinc-200/80 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="max-h-[560px] overflow-y-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-[#FAF8F5] dark:bg-zinc-800/80 text-zinc-500 font-bold sticky top-0 z-10 border-b border-zinc-200 dark:border-zinc-700">
                  <tr>
                    <th className="px-3.5 py-2.5 w-10 text-center">No</th>
                    <th className="px-3.5 py-2.5">Nama AC</th>
                    <th className="px-3.5 py-2.5 text-center">Shipment</th>
                    <th className="px-3.5 py-2.5">Nomor WhatsApp</th>
                    <th className="px-3.5 py-2.5 text-center">Status</th>
                    <th className="px-3.5 py-2.5 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-12 text-zinc-400">
                        Tidak ada AC yang cocok dengan filter atau data masih kosong.
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item, idx) => {
                      const isSelected = item.acKey === selectedAcKey
                      const isCurrentAuto = isAutoRunning && currentAutoItem?.acKey === item.acKey
                      const isSent = statusMap[item.acKey]?.status === 'sent'
                      const isSkipped = statusMap[item.acKey]?.status === 'skipped'
                      const isEditingPhone = editingPhoneAcKey === item.acKey

                      return (
                        <tr
                          key={item.id}
                          onClick={() => setSelectedAcKey(item.acKey)}
                          className={`transition-colors cursor-pointer ${
                            isCurrentAuto
                              ? 'bg-zinc-100/70 dark:bg-amber-950/50 ring-2 ring-amber-500 ring-inset'
                              : isSelected
                              ? 'bg-zinc-100/80 dark:bg-zinc-800/80'
                              : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/40'
                          }`}
                        >
                          {/* 1. Index */}
                          <td className="px-3.5 py-2.5 text-center text-zinc-400 font-mono">
                            {idx + 1}
                          </td>

                          {/* 2. Nama AC */}
                          <td className="px-3.5 py-2.5">
                            <div className="font-bold text-zinc-900 dark:text-white flex items-center gap-1.5">
                              {item.namaAc}
                              {isCurrentAuto && (
                                <span className="inline-flex w-2 h-2 rounded-full bg-amber-500 animate-ping" />
                              )}
                            </div>
                            {item.branch && item.branch !== '-' && (
                              <div className="text-[10px] text-zinc-400 font-normal">
                                {item.branch} • {item.regional}
                              </div>
                            )}
                          </td>

                          {/* 3. Shipment Count Badge */}
                          <td className="px-3.5 py-2.5 text-center">
                            <span
                              className={`inline-flex items-center justify-center px-2.5 py-0.5 rounded-full text-xs font-black shadow-2xs ${
                                item.shipmentCount >= 20
                                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800'
                                  : item.shipmentCount >= 5
                                  ? 'bg-zinc-100 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'
                                  : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700'
                              }`}
                            >
                              {item.shipmentCount}
                            </span>
                          </td>

                          {/* 4. Nomor WhatsApp */}
                          <td className="px-3.5 py-2.5">
                            {isEditingPhone ? (
                              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  type="text"
                                  value={tempPhoneInput}
                                  onChange={(e) => setTempPhoneInput(e.target.value)}
                                  placeholder="0812xxxx"
                                  className="w-28 px-2 py-1 text-xs rounded border border-amber-500 bg-white dark:bg-zinc-900"
                                  autoFocus
                                />
                                <button
                                  onClick={() => handleSaveManualPhone(item.acKey)}
                                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700"
                                  title="Simpan"
                                >
                                  <Check size={12} />
                                </button>
                                <button
                                  onClick={() => setEditingPhoneAcKey(null)}
                                  className="p-1 rounded bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"
                                  title="Batal"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ) : item.hasPhone ? (
                              <div className="flex items-center gap-1.5">
                                <span className="font-mono text-xs text-zinc-700 dark:text-zinc-300 font-semibold">
                                  {item.formattedPhone}
                                </span>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setEditingPhoneAcKey(item.acKey)
                                    setTempPhoneInput(item.phone)
                                  }}
                                  className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 opacity-60 hover:opacity-100 transition-opacity"
                                  title="Ubah nomor"
                                >
                                  <Edit3 size={11} />
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setEditingPhoneAcKey(item.acKey)
                                  setTempPhoneInput('')
                                }}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-900 hover:bg-rose-100 cursor-pointer"
                              >
                                <Plus size={10} />
                                <span>Input Nomor</span>
                              </button>
                            )}
                          </td>

                          {/* 5. Status Pengiriman */}
                          <td className="px-3.5 py-2.5 text-center whitespace-nowrap">
                            {isCurrentAuto ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-900 animate-pulse">
                                <Clock size={11} />
                                <span>{countdown}s</span>
                              </span>
                            ) : isSent ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                                <Check size={11} />
                                <span>Terkirim</span>
                              </span>
                            ) : isSkipped ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                                <span>Dilewati</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold text-zinc-500">
                                <span>Belum</span>
                              </span>
                            )}
                          </td>

                          {/* 6. Aksi Cepat */}
                          <td className="px-3.5 py-2.5 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-end gap-1.5">
                              {item.hasPhone && (
                                <button
                                  onClick={() => dispatchWhatsApp(item)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer"
                                  title="Kirim Pesan WhatsApp Manual"
                                >
                                  <Send size={11} />
                                  <span>Kirim</span>
                                </button>
                              )}
                              <button
                                onClick={() => handleCopyText(renderPodMessage(template, item))}
                                className="p-1 rounded-full text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
                                title="Salin Teks Pesan"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table Footer Summary */}
          <div className="flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 pt-1">
            <span>
              Menampilkan {filteredItems.length} dari {totalAc} AC
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleResetStatus}
                className="text-xs text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 underline cursor-pointer"
              >
                Reset Status Pengiriman
              </button>
            </div>
          </div>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN (5 COLS): Auto-Dispatcher Control & Preview */}
        {/* ======================================================== */}
        <div className="lg:col-span-5 space-y-6">
          {/* Card 1: PUSAT KONTROL AUTO-DISPATCHER (Kirim Bergantian Otomatis) */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className={`w-9 h-9 rounded-2xl flex items-center justify-center font-bold ${
                  isAutoRunning
                    ? 'bg-amber-500 text-white animate-pulse'
                    : 'bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300'
                }`}>
                  <Play size={16} />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                    Sistem Kirim Otomatis (Auto Sequence)
                  </h3>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Kirim pesan bergantian dengan jeda waktu anti-banned
                  </p>
                </div>
              </div>

              {/* Status Badge */}
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                isAutoRunning
                  ? isPaused
                    ? 'bg-zinc-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 animate-pulse'
                  : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400'
              }`}>
                {isAutoRunning ? (isPaused ? 'Dijeda' : 'Sedang Berjalan') : 'Siap'}
              </span>
            </div>

            {/* Countdown Banner saat Berjalan */}
            {isAutoRunning && currentAutoItem && (
              <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 space-y-2">
                <div className="flex items-center justify-between text-xs font-bold text-amber-800 dark:text-amber-300">
                  <span>Target AC Berikutnya:</span>
                  <span className="text-xl font-black text-zinc-500 dark:text-amber-400 font-mono">
                    {countdown} Detik
                  </span>
                </div>
                <div className="font-extrabold text-base text-zinc-900 dark:text-white flex items-center justify-between">
                  <span>{currentAutoItem.namaAc}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                    {currentAutoItem.shipmentCount} Pesanan POD
                  </span>
                </div>
                <div className="w-full bg-amber-200/60 dark:bg-amber-900/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-amber-500 h-full transition-all duration-1000 ease-linear rounded-full"
                    style={{ width: `${((delaySeconds - countdown) / delaySeconds) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Slider Pengaturan Waktu Jeda */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between text-xs font-bold text-zinc-700 dark:text-zinc-300">
                <span className="flex items-center gap-1.5">
                  <Clock size={13} className="text-zinc-400" />
                  Waktu Jeda Antar Pengiriman:
                </span>
                <span className="text-zinc-500 dark:text-amber-400 font-black">
                  {delaySeconds} Detik
                </span>
              </div>
              <input
                type="range"
                min="3"
                max="20"
                step="1"
                disabled={isAutoRunning}
                value={delaySeconds}
                onChange={(e) => setDelaySeconds(Number(e.target.value))}
                className="w-full accent-amber-500 cursor-pointer disabled:opacity-50"
              />
              <div className="flex justify-between text-[10px] text-zinc-400">
                <span>3s (Cepat)</span>
                <span className="text-zinc-500 font-semibold">8s (Aman &amp; Direkomendasikan)</span>
                <span>20s (Sangat Santai)</span>
              </div>
            </div>

            {/* Pengaturan Ekstra (Checkboxes) */}
            <div className="space-y-2 pt-2 border-t border-zinc-100 dark:border-zinc-800 text-xs">
              <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={useSameTab}
                  onChange={(e) => setUseSameTab(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span>Gunakan 1 tab WhatsApp Web yang sama (Rekomendasi agar browser tidak penuh 30 tab)</span>
              </label>

              <label className="flex items-center gap-2 cursor-pointer text-zinc-700 dark:text-zinc-300">
                <input
                  type="checkbox"
                  checked={soundEnabled}
                  onChange={(e) => setSoundEnabled(e.target.checked)}
                  className="rounded text-amber-500 focus:ring-amber-500"
                />
                <span className="flex items-center gap-1.5">
                  {soundEnabled ? <Volume2 size={13} className="text-emerald-500" /> : <VolumeX size={13} className="text-zinc-400" />}
                  Putar notifikasi suara saat pesan terkirim &amp; selesai
                </span>
              </label>
            </div>

            {/* Tombol Kontrol Auto Dispatcher */}
            <div className="pt-2 flex flex-wrap items-center gap-2">
              {!isAutoRunning ? (
                <button
                  onClick={handleStartAuto}
                  disabled={eligibleQueue.length === 0}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 px-4 rounded-full text-xs font-bold transition-all shadow-sm ${
                    eligibleQueue.length > 0
                      ? 'bg-[#FEE500] hover:bg-[#FDD800] text-zinc-950 cursor-pointer'
                      : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none'
                  }`}
                >
                  <Play size={15} className="fill-current" />
                  <span>Mulai Kirim Otomatis ({eligibleQueue.length} AC)</span>
                </button>
              ) : (
                <>
                  {isPaused ? (
                    <button
                      onClick={handleResumeAuto}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer shadow-sm"
                    >
                      <Play size={14} className="fill-current" />
                      <span>Lanjutkan</span>
                    </button>
                  ) : (
                    <button
                      onClick={handlePauseAuto}
                      className="flex-1 flex items-center justify-center gap-1.5 py-3 px-3 rounded-full text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white cursor-pointer shadow-sm"
                    >
                      <Pause size={14} className="fill-current" />
                      <span>Jeda</span>
                    </button>
                  )}

                  <button
                    onClick={handleSkipCurrent}
                    className="flex items-center gap-1 py-3 px-3.5 rounded-full text-xs font-semibold bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 cursor-pointer"
                    title="Lewati AC ini dan lanjut ke berikutnya"
                  >
                    <SkipForward size={14} />
                    <span>Lewati</span>
                  </button>

                  <button
                    onClick={handleStopAuto}
                    className="flex items-center gap-1 py-3 px-3.5 rounded-full text-xs font-semibold bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-900 cursor-pointer"
                    title="Hentikan pengiriman otomatis"
                  >
                    <Square size={13} className="fill-current" />
                    <span>Stop</span>
                  </button>
                </>
              )}
            </div>

            {/* Banner Peringatan Pop-up Blocker */}
            {isPopupBlocked && (
              <div className="p-3.5 rounded-2xl bg-amber-50 dark:bg-amber-950/60 border border-amber-300 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-800 dark:text-amber-300">
                  <AlertTriangle size={16} className="text-zinc-500 shrink-0" />
                  <span>Jendela Pop-Up WhatsApp Diblokir oleh Browser!</span>
                </div>
                <p className="text-[11px] leading-relaxed">
                  Browser mendeteksi pembukaan tab otomatis dan mencegatnya. Cara mengizinkannya:
                  <br />• Klik ikon gembok / popup di samping kolom URL browser ➔ Pilih <b>"Izinkan Pop-up"</b>.
                  <br />• <b>Atau cara lebih cepat &amp; pasti:</b> Cukup tekan tombol <b>[Spasi]</b> atau <b>[Enter]</b> di bawah untuk membuka chat WA tiap AC secara bergantian!
                </p>
              </div>
            )}

            {/* Tombol Alternatif Cepat 1-Klik / Tekan Spasi */}
            {eligibleQueue.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => {
                    const nextItem = eligibleQueue[0]
                    if (nextItem) {
                      setSelectedAcKey(nextItem.acKey)
                      dispatchWhatsApp(nextItem)
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2.5 py-3 px-4 rounded-2xl text-xs font-black bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white shadow-md hover:shadow-lg transition-all cursor-pointer"
                >
                  <Send size={15} />
                  <span>🚀 Buka WA: {eligibleQueue[0]?.namaAc} ({eligibleQueue[0]?.shipmentCount} POD) • [Spasi / Enter]</span>
                </button>
              </div>
            )}

            <InfoButton title="Cara kerja antrean POD"><p>Antrean membuka draf WhatsApp secara bergantian. Anda tetap menekan Kirim pada setiap chat.</p><p>Jeda antar-AC: {delaySeconds} detik. Izinkan pop-up untuk alur ini. Jeda tidak menjamin nomor terhindar dari pemblokiran.</p></InfoButton>
          </div>

          {/* Card 2: LIVE PREVIEW PESAN WHATSAPP & EDIT TEMPLATE */}
          <div className="bg-white dark:bg-zinc-900 rounded-3xl p-5 border border-zinc-200/80 dark:border-zinc-800 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText size={16} className="text-zinc-500" />
                <h3 className="font-extrabold text-sm text-zinc-900 dark:text-white">
                  Pratinjau Pesan WhatsApp
                </h3>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setIsEditingTemplate(!isEditingTemplate)}
                  className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 cursor-pointer"
                >
                  <Edit3 size={12} />
                  <span>{isEditingTemplate ? 'Tutup Editor' : 'Atur Template'}</span>
                </button>

                {activeSelectedItem && (
                  <button
                    onClick={() => handleCopyText(renderPodMessage(template, activeSelectedItem))}
                    className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 cursor-pointer"
                  >
                    <Copy size={12} />
                    <span>Salin</span>
                  </button>
                )}
              </div>
            </div>

            {/* Template Editor Drawer (Jika Aktif) */}
            {isEditingTemplate && (
              <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-zinc-700 dark:text-zinc-300">
                    Edit Template Pesan POD:
                  </span>
                  <button
                    onClick={() => {
                      setTemplate(DEFAULT_POD_TEMPLATE)
                      showToast?.('Template berhasil dikembalikan ke default!', 'info')
                    }}
                    className="text-[11px] text-zinc-500 dark:text-amber-400 hover:underline font-semibold cursor-pointer"
                  >
                    Reset ke Default
                  </button>
                </div>
                <textarea
                  value={template}
                  onChange={(e) => setTemplate(e.target.value)}
                  rows={6}
                  className="w-full px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                />
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 space-y-1">
                  <span className="font-semibold">Variabel Dinamis:</span>
                  <div className="flex flex-wrap gap-1 font-mono text-[10px]">
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{`{nama_ac}`}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{`{jumlah_shipment}`}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{`{waktu_salam}`}</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-200 dark:bg-zinc-700">{`{tanggal}`}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Live Message Preview Box */}
            {activeSelectedItem ? (
              <div className="space-y-3">
                {/* Target AC Header */}
                <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-zinc-900 dark:text-white">
                      Penerima: {activeSelectedItem.namaAc}
                    </span>
                    <span className="px-2 py-0.5 rounded-full bg-zinc-100 text-amber-800 font-extrabold text-[10px]">
                      {activeSelectedItem.shipmentCount} Shipment
                    </span>
                  </div>
                  <span className="text-zinc-500 font-mono text-[11px]">
                    {activeSelectedItem.hasPhone ? activeSelectedItem.formattedPhone : 'Nomor Belum Ada'}
                  </span>
                </div>

                {/* Chat Bubble Style */}
                <div className="p-4 rounded-2xl bg-[#EFEAE2] dark:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-700/80 shadow-2xs">
                  <div className="bg-white dark:bg-zinc-900 p-3.5 rounded-2xl rounded-tl-none shadow-xs text-xs text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans leading-relaxed border border-emerald-100 dark:border-zinc-800">
                    {renderPodMessage(template, activeSelectedItem)}
                  </div>
                </div>

                {/* Direct Action */}
                {activeSelectedItem.hasPhone ? (
                  <button
                    onClick={() => dispatchWhatsApp(activeSelectedItem)}
                    className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-full text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-2xs transition-all cursor-pointer"
                  >
                    <Send size={14} />
                    <span>Kirim Pesan ke {activeSelectedItem.namaAc} Sekarang</span>
                  </button>
                ) : (
                  <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-center text-xs text-rose-600 dark:text-rose-400 font-bold">
                    Nomor WhatsApp belum terdaftar. Silakan klik tombol "Input Nomor" di tabel untuk menambahkan.
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-10 text-zinc-400 text-xs">
                Pilih salah satu AC pada tabel di sebelah kiri untuk melihat pratinjau pesan.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal Input Paste POD 2 Kolom */}
      <PodInputModal
        isOpen={isInputModalOpen}
        onClose={() => setIsInputModalOpen(false)}
        onImportData={(newRows) => {
          setPodRows(newRows)
          setStatusMap({})
        }}
        showToast={showToast}
      />
    </div>
  )
}
