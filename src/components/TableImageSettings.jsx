import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
import React, { useState, useRef } from 'react'
import {
  Palette,
  Sliders,
  Type,
  Columns,
  Eye,
  EyeOff,
  Sparkles,
  RotateCcw,
  Download,
  Copy,
  Check,
  Image,
  AlignLeft,
  AlignCenter,
  AlignRight,
  ShieldAlert,
  Layers,
  ChevronRight,
  Maximize2
} from 'lucide-react'
import { AcTableRender } from './AcTableRender'
import {
  DEFAULT_TABLE_SETTINGS,
  TABLE_PRESETS
} from '../utils/tableSettings'
import { copyTableImageToClipboard, downloadTableImage } from '../utils/imageGenerator'

const SAMPLE_PREVIEW_AC = {
  acKey: 'ABDUL RAHMAN__DC LAMPUNG',
  acName: 'ABDUL RAHMAN',
  cabang: 'DC LAMPUNG',
  region: 'Reg 5 HSS',
  jam: '08.00',
  pic: 'SYAIFUL',
  rows: [
    {
      id: 'demo-1',
      jam: '08.00',
      kodeToko: '1V36',
      namaToko: 'AIR PAOH',
      cabang: 'DC LAMPUNG',
      region: 'Reg 5 HSS',
      shipment: '261008-AG6HQ6',
      namaKonsumen: 'SRI WAHYUNI',
      sla: '7. > 12 Jam',
      pic: 'SYAIFUL',
    },
    {
      id: 'demo-2',
      jam: '08.00',
      kodeToko: '1V36',
      namaToko: 'AIR PAOH',
      cabang: 'DC LAMPUNG',
      region: 'Reg 5 HSS',
      shipment: '261008-AG6J9A',
      namaKonsumen: 'AHMAD FAUZI',
      sla: '6. > 6 Jam',
      pic: 'SYAIFUL',
    },
    {
      id: 'demo-3',
      jam: '08.00',
      kodeToko: '2K11',
      namaToko: 'KEMILING RAYA',
      cabang: 'DC LAMPUNG',
      region: 'Reg 5 HSS',
      shipment: '261008-AG7K2X',
      namaKonsumen: 'DEWI LESTARI',
      sla: '5. > 2 Jam',
      pic: 'SYAIFUL',
    },
    {
      id: 'demo-4',
      jam: '08.00',
      kodeToko: '2K11',
      namaToko: 'KEMILING RAYA',
      cabang: 'DC LAMPUNG',
      region: 'Reg 5 HSS',
      shipment: '261008-AG7M4B',
      namaKonsumen: 'BUDI SANTOSO',
      sla: '4. > 1 Jam',
      pic: 'SYAIFUL',
    },
    {
      id: 'demo-5',
      jam: '08.00',
      kodeToko: '3L09',
      namaToko: 'WAY HALIM',
      cabang: 'DC LAMPUNG',
      region: 'Reg 5 HSS',
      shipment: '261008-AG8P1L',
      namaKonsumen: 'RINA ANGGRAENI',
      sla: '3. > 45 Menit',
      pic: 'SYAIFUL',
    },
  ],
}

export function TableImageSettings({ tableSettings, onSaveTableSettings, showToast }) {
  const { name: picName } = usePicProfile()
  const previewAc = { ...SAMPLE_PREVIEW_AC, pic: picName, rows: SAMPLE_PREVIEW_AC.rows.map(row => ({ ...row, pic: picName })) }
  // Local state for interactive editing before permanent save
  const [current, setCurrent] = useState(() => ({ ...tableSettings }))
  const [activeTab, setActiveTab] = useState('text') // 'text' | 'columns' | 'colors' | 'sla_type'
  const [isCopied, setIsCopied] = useState(false)
  const previewRef = useRef(null)
  usePicEditing(JSON.stringify(current) !== JSON.stringify(tableSettings))

  // Handler update field
  const updateField = (key, val) => {
    setCurrent((prev) => {
      const updated = { ...prev, [key]: val, preset: 'custom' }
      return updated
    })
  }

  // Handler nested update
  const updateNested = (section, key, val) => {
    setCurrent((prev) => {
      const updated = {
        ...prev,
        preset: 'custom',
        [section]: {
          ...prev[section],
          [key]: val,
        },
      }
      return updated
    })
  }

  // Handler update column property
  const updateColumn = (colKey, prop, val) => {
    setCurrent((prev) => ({
      ...prev,
      preset: 'custom',
      columns: {
        ...prev.columns,
        [colKey]: {
          ...prev.columns[colKey],
          [prop]: val,
        },
      },
    }))
  }

  // Handler apply preset
  const handleApplyPreset = (presetKey) => {
    const p = TABLE_PRESETS[presetKey]
    if (!p) return
    setCurrent((prev) => ({
      ...prev,
      ...p.settings,
      preset: presetKey,
    }))
    showToast?.(`Tema "${p.name}" diterapkan!`, 'info')
  }

  // Handler Reset to default
  const handleResetToDefault = async () => {
    if (window.confirm('Kembalikan seluruh pengaturan gambar ke format Excel Asli (Gambar 3)?')) {
      setCurrent(DEFAULT_TABLE_SETTINGS)
      try { await onSaveTableSettings(DEFAULT_TABLE_SETTINGS) } catch (error) { showToast?.(error.message, 'error'); return }
      showToast?.('Pengaturan gambar berhasil direset ke Excel Klasik Asli!', 'info')
    }
  }

  // Handler Save & Apply
  const handleSave = async () => {
    try {
      await onSaveTableSettings(current)
      showToast?.('Desain tabel tersimpan bersama untuk PIC ini.', 'success')
    } catch (error) { showToast?.(error.message, 'error') }
  }

  // Handler Copy Preview Image
  const handleCopyPreview = async () => {
    if (!previewRef.current) return
    const res = await copyTableImageToClipboard(previewRef.current, {
      backgroundColor: current.colors.tableBg,
      pixelRatio: current.exportScale || 2.5,
    })
    if (res.success) {
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2500)
      showToast?.('Gambar tabel berhasil disalin ke Clipboard! Siap Cmd+V di WhatsApp.', 'success')
    } else {
      showToast?.('Gagal menyalin gambar tabel: ' + (res.error || 'Terjadi kesalahan'), 'error')
    }
  }

  // Handler Download Preview PNG
  const handleDownloadPreview = () => {
    if (!previewRef.current) return
    downloadTableImage(previewRef.current, `preview-tabel-${current.preset || 'custom'}.png`, {
      backgroundColor: current.colors.tableBg,
      pixelRatio: current.exportScale || 2.5,
    })
    showToast?.('Gambar tabel diunduh sebagai PNG!', 'success')
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Title Header */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Palette size={26} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Pengaturan Desain &amp; Gambar Hasil MONITORING SAPA 3
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300">
                Gambar 3 Output
              </span>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
              Ubah tampilan gambar tabel yang dikirimkan ke WhatsApp AC sesuka Anda. Tambahkan atau hilangkan teks header, atur visibilitas kolom, pilih palet warna, dan lihat pratinjau langsung secara real-time.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleResetToDefault}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-full border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
            title="Kembalikan ke format Gambar 3 asli"
          >
            <RotateCcw size={14} />
            <span>Reset Default</span>
          </button>

          <button
            onClick={handleSave}
            className="flex items-center gap-1.5 px-5 py-2 text-xs font-bold rounded-full bg-[#FDE047] hover:bg-[#FACC15] text-zinc-900 shadow-xs active:scale-95 transition-all cursor-pointer"
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Simpan &amp; Terapkan</span>
          </button>
        </div>
      </div>

      {/* Preset Cards Selection Bar */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Pilihan Tema Siap Pakai (Preset Instan)
            </span>
          </div>
          {current.preset === 'custom' && (
            <span className="text-[11px] font-semibold text-purple-600 dark:text-purple-400">
              * Mode Kustom Aktif
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {Object.entries(TABLE_PRESETS).map(([key, p]) => {
            const isSelected = current.preset === key
            return (
              <button
                key={key}
                onClick={() => handleApplyPreset(key)}
                className={`p-3.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'border-purple-500 bg-purple-50/50 dark:bg-purple-950/20 shadow-xs ring-2 ring-purple-500/20'
                    : 'border-zinc-200/80 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30'
                }`}
              >
                <div className="space-y-1.5">
                  {/* Color Swatch Preview Pill */}
                  <div className="flex items-center gap-1.5 mb-2">
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: p.settings.colors.titleBadgeBg }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: p.settings.colors.headerBg }}
                    />
                    <span
                      className="w-4 h-4 rounded-full border border-black/10 shadow-2xs"
                      style={{ backgroundColor: p.settings.sla.color12h }}
                    />
                  </div>

                  <div className="text-xs font-bold text-zinc-900 dark:text-white flex items-center justify-between">
                    <span>{p.name}</span>
                    {isSelected && <Check size={13} className="text-purple-600 dark:text-purple-400" />}
                  </div>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                    {p.description}
                  </p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Main Grid: Left Controls (Tabs) & Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Settings Tabs & Inputs (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 shadow-xs overflow-hidden flex flex-col">
          {/* Internal Tab Header */}
          <div className="flex items-center border-b border-zinc-200/80 dark:border-zinc-800 p-1.5 bg-zinc-50/80 dark:bg-zinc-800/40 gap-1 overflow-x-auto">
            <button
              onClick={() => setActiveTab('text')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'text'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Type size={13} />
              <span>Teks &amp; Header</span>
            </button>

            <button
              onClick={() => setActiveTab('columns')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'columns'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Columns size={13} />
              <span>Pilihan Kolom</span>
            </button>

            <button
              onClick={() => setActiveTab('colors')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'colors'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Palette size={13} />
              <span>Warna &amp; Tema</span>
            </button>

            <button
              onClick={() => setActiveTab('sla_type')}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'sla_type'
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-white shadow-2xs'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
            >
              <Sliders size={13} />
              <span>SLA &amp; Format</span>
            </button>
          </div>

          {/* Tab 1: Teks & Header */}
          {activeTab === 'text' && (
            <div className="p-5 space-y-5 text-xs">
              {/* Header Bar Visibility */}
              <div className="space-y-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Tampilkan Bar Judul Atas</div>
                    <div className="text-[11px] text-zinc-500">Header ringkasan AC, cabang, total, &amp; jam di atas tabel.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.showTitleBar}
                    onChange={(e) => updateField('showTitleBar', e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 focus:ring-purple-500 cursor-pointer"
                  />
                </div>

                {current.showTitleBar && (
                  <div className="space-y-3 pl-3 border-l-2 border-purple-500/30 pt-1">
                    {/* Badge Judul Teks */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                          Teks Badge Judul
                        </label>
                        <label className="flex items-center gap-1 text-[11px] text-zinc-500 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={current.showTitleBadge}
                            onChange={(e) => updateField('showTitleBadge', e.target.checked)}
                            className="rounded text-purple-600"
                          />
                          <span>Tampilkan Badge</span>
                        </label>
                      </div>
                      <input
                        type="text"
                        value={current.titleBadgeText}
                        onChange={(e) => updateField('titleBadgeText', e.target.value)}
                        placeholder="Contoh: MONITORING SAPA 3"
                        disabled={!current.showTitleBadge}
                        className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-semibold disabled:opacity-50"
                      />
                    </div>

                    {/* Informasi AC & Cabang */}
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={current.showAcName}
                          onChange={(e) => updateField('showAcName', e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">Nama AC</span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={current.showCabangRegion}
                          onChange={(e) => updateField('showCabangRegion', e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">Cabang &amp; Region</span>
                      </label>
                    </div>

                    {/* Meta Bar: Jam, Total, PIC */}
                    <div className="grid grid-cols-3 gap-2">
                      <label className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={current.showMetaJam}
                          onChange={(e) => updateField('showMetaJam', e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>Jam</span>
                      </label>

                      <label className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={current.showMetaTotal}
                          onChange={(e) => updateField('showMetaTotal', e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>Total Pesanan</span>
                      </label>

                      <label className="flex items-center gap-1.5 p-2 rounded-xl bg-zinc-50 dark:bg-zinc-800/50 border border-zinc-200/60 dark:border-zinc-700/60 cursor-pointer text-[11px]">
                        <input
                          type="checkbox"
                          checked={current.showMetaPic}
                          onChange={(e) => updateField('showMetaPic', e.target.checked)}
                          className="rounded text-purple-600"
                        />
                        <span>PIC</span>
                      </label>
                    </div>
                  </div>
                )}
              </div>

              {/* Tambahan: Pesan Banner Atas */}
              <div className="space-y-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Tambahkan Banner Peringatan Atas</div>
                    <div className="text-[11px] text-zinc-500">Pesan tegas berwarna di bagian paling atas gambar tabel.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.showTopBanner}
                    onChange={(e) => updateField('showTopBanner', e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                  />
                </div>

                {current.showTopBanner && (
                  <div className="space-y-2 pt-1 pl-3 border-l-2 border-amber-500/40">
                    <input
                      type="text"
                      value={current.topBannerText}
                      onChange={(e) => updateField('topBannerText', e.target.value)}
                      placeholder="Contoh: ⚠️ MOHON DITINDAKLANJUTI SEGERA KE PERSONIL TOKO"
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Gaya Warna:</span>
                      <button
                        onClick={() => {
                          updateField('topBannerBg', '#FEF08A')
                          updateField('topBannerColor', '#854D0E')
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEF08A] text-[#854D0E] border border-amber-300 cursor-pointer"
                      >
                        Kuning Peringatan
                      </button>
                      <button
                        onClick={() => {
                          updateField('topBannerBg', '#FEE2E2')
                          updateField('topBannerColor', '#991B1B')
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FEE2E2] text-[#991B1B] border border-red-300 cursor-pointer"
                      >
                        Merah Urgent
                      </button>
                      <button
                        onClick={() => {
                          updateField('topBannerBg', '#DBEAFE')
                          updateField('topBannerColor', '#1E40AF')
                        }}
                        className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DBEAFE] text-[#1E40AF] border border-blue-300 cursor-pointer"
                      >
                        Biru Info
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Tambahan: Catatan Footer Bawah */}
              <div className="space-y-2 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Tambahkan Catatan / Catatan Kaki (Footer)</div>
                    <div className="text-[11px] text-zinc-500">Pesan instruksi atau ucapan terima kasih di bagian bawah tabel.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.showFooterNote}
                    onChange={(e) => updateField('showFooterNote', e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                  />
                </div>

                {current.showFooterNote && (
                  <div className="space-y-2 pt-1 pl-3 border-l-2 border-blue-500/40">
                    <textarea
                      rows={2}
                      value={current.footerNoteText}
                      onChange={(e) => updateField('footerNoteText', e.target.value)}
                      placeholder="Tuliskan catatan tambahan..."
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-zinc-500">Posisi:</span>
                      {['left', 'center', 'right'].map((align) => (
                        <button
                          key={align}
                          onClick={() => updateField('footerAlign', align)}
                          className={`px-2 py-0.5 rounded-md text-[10px] font-semibold cursor-pointer ${
                            current.footerAlign === align
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                          }`}
                        >
                          {align === 'left' ? 'Kiri' : align === 'center' ? 'Tengah' : 'Kanan'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Tambahan: Watermark */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Watermark Resmi</div>
                    <div className="text-[11px] text-zinc-500">Teks penanda internal di pojok bawah tabel.</div>
                  </div>
                  <input
                    type="checkbox"
                    checked={current.showWatermark}
                    onChange={(e) => updateField('showWatermark', e.target.checked)}
                    className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                  />
                </div>

                {current.showWatermark && (
                  <div className="pt-1 pl-3 border-l-2 border-zinc-400">
                    <input
                      type="text"
                      value={current.watermarkText}
                      onChange={(e) => updateField('watermarkText', e.target.value)}
                      placeholder="Contoh: ALFAGIFT OPERATIONAL • SAPA 3"
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tab 2: Pilihan Kolom Tabel */}
          {activeTab === 'columns' && (
            <div className="p-5 space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white">Atur Kolom yang Ditampilkan</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Centang untuk menampilkan kolom pada gambar, hilangkan centang untuk menyembunyikan kolom, dan Anda bisa mengganti nama label kolom sesuai keinginan.
                </p>
              </div>

              <div className="space-y-2 divide-y divide-zinc-100 dark:divide-zinc-800">
                {Object.entries(current.columns).map(([colKey, col]) => (
                  <div key={colKey} className="pt-2.5 flex items-center justify-between gap-3">
                    <label className="flex items-center gap-2 cursor-pointer shrink-0">
                      <input
                        type="checkbox"
                        checked={col.visible}
                        onChange={(e) => updateColumn(colKey, 'visible', e.target.checked)}
                        className="w-4 h-4 rounded text-purple-600 cursor-pointer"
                      />
                      <span className={`font-semibold ${col.visible ? 'text-zinc-900 dark:text-white' : 'text-zinc-400'}`}>
                        {colKey.toUpperCase()}
                      </span>
                    </label>

                    <div className="flex items-center gap-1.5 flex-1 max-w-[220px]">
                      <span className="text-[10px] text-zinc-400">Label:</span>
                      <input
                        type="text"
                        value={col.label}
                        onChange={(e) => updateColumn(colKey, 'label', e.target.value)}
                        disabled={!col.visible}
                        className="w-full px-2.5 py-1 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white font-medium text-xs disabled:opacity-40"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: Warna & Tema */}
          {activeTab === 'colors' && (
            <div className="p-5 space-y-4 text-xs">
              <div>
                <h4 className="font-bold text-zinc-900 dark:text-white">Kustomisasi Palet Warna Bebas</h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Ubah warna latar tabel, header, garis tepi, hingga warna baris selang-seling.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Latar Belakang Tabel */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Latar Tabel (BG)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.tableBg}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.tableBg}
                    onChange={(e) => updateNested('colors', 'tableBg', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Header Tabel BG */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Header Tabel (BG)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.headerBg}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.headerBg}
                    onChange={(e) => updateNested('colors', 'headerBg', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Teks Header */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Teks Header</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.headerText}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.headerText}
                    onChange={(e) => updateNested('colors', 'headerText', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Badge Judul BG */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Badge Judul (BG)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.titleBadgeBg}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.titleBadgeBg}
                    onChange={(e) => updateNested('colors', 'titleBadgeBg', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Garis Border Luar */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Garis Tepi (Border)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.borderColor}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.borderColor}
                    onChange={(e) => updateNested('colors', 'borderColor', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Garis Border Sel Dalam */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Grid Sel Dalam</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.innerBorderColor}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.innerBorderColor}
                    onChange={(e) => updateNested('colors', 'innerBorderColor', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Baris Genap (Even) */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Baris Genap (Putih)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.rowEvenBg}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.rowEvenBg}
                    onChange={(e) => updateNested('colors', 'rowEvenBg', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Baris Ganjil (Odd Stripe) */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Baris Ganjil (Stripe)</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.rowOddBg}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.rowOddBg}
                    onChange={(e) => updateNested('colors', 'rowOddBg', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Warna Teks Tabel */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Warna Teks Tabel</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.rowTextColor}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.rowTextColor}
                    onChange={(e) => updateNested('colors', 'rowTextColor', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>

                {/* Warna Shipment / Order ID */}
                <div className="p-2.5 rounded-xl border border-zinc-200/80 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/30 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white text-[11px]">Warna No Shipment</div>
                    <div className="text-[10px] text-zinc-500">{current.colors.shipmentColor}</div>
                  </div>
                  <input
                    type="color"
                    value={current.colors.shipmentColor}
                    onChange={(e) => updateNested('colors', 'shipmentColor', e.target.value)}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-600 cursor-pointer p-0"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: SLA & Format */}
          {activeTab === 'sla_type' && (
            <div className="p-5 space-y-5 text-xs">
              {/* Gaya Tampilan SLA */}
              <div className="space-y-3 pb-4 border-b border-zinc-100 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-bold text-zinc-900 dark:text-white">Gaya Pewarnaan SLA</div>
                    <div className="text-[11px] text-zinc-500">Pilih format blok sel atau kapsul badge modern.</div>
                  </div>
                  <label className="flex items-center gap-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={current.sla.highlightEnabled}
                      onChange={(e) => updateNested('sla', 'highlightEnabled', e.target.checked)}
                      className="rounded text-purple-600"
                    />
                    <span>Aktifkan Warna</span>
                  </label>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'full_cell', label: 'Blok Sel Penuh', desc: 'Sesuai Gambar 3 Excel' },
                    { id: 'badge_pill', label: 'Badge Kapsul', desc: 'Modern Rounded Pill' },
                    { id: 'colored_text', label: 'Teks Berwarna', desc: 'Minimalis Elegan' },
                  ].map((m) => (
                    <button
                      key={m.id}
                      onClick={() => updateNested('sla', 'mode', m.id)}
                      className={`p-2.5 rounded-xl border text-left cursor-pointer transition-all ${
                        current.sla.mode === m.id
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/40 text-purple-900 dark:text-purple-200'
                          : 'border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="font-bold text-xs">{m.label}</div>
                      <div className="text-[10px] opacity-75">{m.desc}</div>
                    </button>
                  ))}
                </div>

                {/* Pengaturan Warna per Kategori SLA */}
                <div className="pt-2 space-y-2">
                  <div className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300">
                    Warna Indikator SLA Urgency:
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 12 Jam</span>
                      <input
                        type="color"
                        value={current.sla.color12h}
                        onChange={(e) => updateNested('sla', 'color12h', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 6 Jam</span>
                      <input
                        type="color"
                        value={current.sla.color6h}
                        onChange={(e) => updateNested('sla', 'color6h', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 2 Jam</span>
                      <input
                        type="color"
                        value={current.sla.color2h}
                        onChange={(e) => updateNested('sla', 'color2h', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 1 Jam</span>
                      <input
                        type="color"
                        value={current.sla.color1h}
                        onChange={(e) => updateNested('sla', 'color1h', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 45 Mnt</span>
                      <input
                        type="color"
                        value={current.sla.color45m}
                        onChange={(e) => updateNested('sla', 'color45m', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                    <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-200/60 dark:border-zinc-700/60">
                      <span className="text-[11px] font-bold">&gt; 30 Mnt</span>
                      <input
                        type="color"
                        value={current.sla.color30m}
                        onChange={(e) => updateNested('sla', 'color30m', e.target.value)}
                        className="w-5 h-5 rounded cursor-pointer p-0"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Tipografi, Kerapatan, & Sudut Melengkung */}
              <div className="space-y-3">
                {/* Font Family */}
                <div>
                  <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                    Jenis Font
                  </label>
                  <select
                    value={current.typography.fontFamily}
                    onChange={(e) => updateNested('typography', 'fontFamily', e.target.value)}
                    className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                  >
                    <option value="system">SF Pro / System Default (macOS Native)</option>
                    <option value="jakarta">Plus Jakarta Sans (Modern Clean)</option>
                    <option value="arial">Arial / Calibri (Standar Excel Asli)</option>
                    <option value="mono">Roboto Mono (Monospace Presisi)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Ukuran Font */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Ukuran Teks
                    </label>
                    <select
                      value={current.typography.fontSize}
                      onChange={(e) => updateNested('typography', 'fontSize', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="compact">Kompak (11px)</option>
                      <option value="normal">Normal (12.5px)</option>
                      <option value="large">Besar (14px)</option>
                    </select>
                  </div>

                  {/* Kerapatan Baris */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Kerapatan Baris
                    </label>
                    <select
                      value={current.typography.paddingDensity}
                      onChange={(e) => updateNested('typography', 'paddingDensity', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="dense">Rapat (Dense)</option>
                      <option value="normal">Normal</option>
                      <option value="spacious">Lega (Spacious)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  {/* Gaya Border Garis */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Gaya Garis Grid
                    </label>
                    <select
                      value={current.typography.borderStyle}
                      onChange={(e) => updateNested('typography', 'borderStyle', e.target.value)}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="excel">Excel Grid Tegas (1px Kuat)</option>
                      <option value="modern">Modern Halus</option>
                      <option value="horizontal">Horizontal Saja</option>
                      <option value="none">Tanpa Garis</option>
                    </select>
                  </div>

                  {/* Sudut Melengkung */}
                  <div>
                    <label className="text-[11px] font-bold text-zinc-700 dark:text-zinc-300 block mb-1">
                      Sudut Melengkung
                    </label>
                    <select
                      value={current.typography.borderRadius}
                      onChange={(e) => updateNested('typography', 'borderRadius', Number(e.target.value))}
                      className="w-full px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-white"
                    >
                      <option value="0">0px (Kotak Tegas Gambar 3)</option>
                      <option value="8">8px (Sedang)</option>
                      <option value="14">14px (Modern Rounded)</option>
                      <option value="20">20px (Extra Rounded)</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Side: Live Real-Time Interactive Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-5 shadow-xs">
            {/* Live Preview Header Toolbar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 mb-4 border-b border-zinc-100 dark:border-zinc-800">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <h3 className="text-sm font-extrabold text-zinc-900 dark:text-white">
                    Live Real-Time Preview Gambar
                  </h3>
                </div>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Tampilan persis yang akan dihasilkan saat diekspor / disalin ke WhatsApp Web.
                </p>
              </div>

              {/* Action Buttons: Copy & Download */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopyPreview}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-full transition-all cursor-pointer shadow-xs ${
                    isCopied
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 hover:bg-zinc-800'
                  }`}
                >
                  {isCopied ? <Check size={14} /> : <Copy size={14} />}
                  <span>{isCopied ? 'Tersalin!' : 'Salin Gambar'}</span>
                </button>

                <button
                  onClick={handleDownloadPreview}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-all cursor-pointer"
                  title="Unduh contoh gambar PNG"
                >
                  <Download size={14} />
                  <span>Unduh PNG</span>
                </button>
              </div>
            </div>

            {/* Container Rendering Preview */}
            <div className="p-3 sm:p-4 rounded-2xl bg-zinc-100/70 dark:bg-zinc-950/70 border border-zinc-200/80 dark:border-zinc-800/80 overflow-x-auto flex justify-center">
              <div className="inline-block shadow-sm">
                <AcTableRender
                  ref={previewRef}
                  acGroup={previewAc}
                  settings={current}
                  showTitleBar={current.showTitleBar}
                />
              </div>
            </div>

            {/* Footer Notice */}
            <div className="mt-3 pt-3 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between text-[11px] text-zinc-500">
              <span>Resolusi Ekspor: <b>{current.exportScale || 2.5}x HD Retina (Sangat Tajam)</b></span>
              <span>Kategori SLA Aktif: <b>{current.sla.highlightEnabled ? 'Berwarna' : 'Polos'}</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
