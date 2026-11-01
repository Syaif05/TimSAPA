import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
import { InfoButton } from './InfoButton'
import React, { useState } from 'react'
import {
  MessageSquare,
  Sparkles,
  Save,
  RotateCcw,
  Check,
  Code2,
  Copy,
  Info
} from 'lucide-react'
import { DEFAULT_TEMPLATES, renderTemplate } from '../utils/templateEngine'

export function TemplateSettings({
  templates,
  activeTemplateKey,
  onSelectActiveTemplate,
  onSaveTemplates,
  showToast,
}) {
  const { name: picName } = usePicProfile()
  const [currentTemplates, setCurrentTemplates] = useState(templates || DEFAULT_TEMPLATES)
  const [selectedKey, setSelectedKey] = useState(activeTemplateKey || 'template_1')
  usePicEditing(JSON.stringify(currentTemplates) !== JSON.stringify(templates))

  const availableVariables = [
    { tag: '{nama_ac}', desc: 'Nama Area Coordinator', bg: 'bg-[#EDE9FE] text-[#6D28D9]' },
    { tag: '{cug_ac}', desc: 'Nomor CUG AC', bg: 'bg-[#DCFCE7] text-[#15803D]' },
    { tag: '{cabang}', desc: 'Cabang / DC', bg: 'bg-[#FEF08A] text-[#854D0E]' },
    { tag: '{region}', desc: 'Regional', bg: 'bg-zinc-100 text-zinc-800' },
    { tag: '{total_shipment}', desc: 'Total pesanan kendala', bg: 'bg-rose-100 text-rose-800' },
    { tag: '{total_toko}', desc: 'Total toko binaan', bg: 'bg-blue-100 text-blue-800' },
    { tag: '{daftar_toko_dan_shipment}', desc: 'Rincian per toko & shipment', bg: 'bg-purple-100 text-purple-800' },
    { tag: '{jam}', desc: 'Jam monitoring (misal 08.00)', bg: 'bg-zinc-100 text-amber-800' },
    { tag: '{pic}', desc: 'Nama PIC', bg: 'bg-emerald-100 text-emerald-800' },
    { tag: '{rincian_sla}', desc: 'Ringkasan SLA', bg: 'bg-red-100 text-red-800' },
  ]

  const sampleAc = {
    acName: 'ALPHA ADARRANI WIBOWO',
    phone: '6281289123456',
    cabang: 'DC CIKOKOL',
    region: 'Reg 1 YSI',
    jam: '08.00',
    pic: picName,
    totalShipments: 3,
    totalStores: 1,
    storesList: ['TD46 - UBM TOWER'],
    rows: [
      { kodeToko: 'TD46', namaToko: 'UBM TOWER', shipment: 'S-261007-AGCJGZS', namaKonsumen: 'ALPHA ADARRANI WIBOWO', sla: '7. > 12 Jam' },
      { kodeToko: 'TD46', namaToko: 'UBM TOWER', shipment: 'S-260925-AGFXPKF', namaKonsumen: 'ALPHA ADARRANI WIBOWO', sla: '7. > 12 Jam' },
      { kodeToko: 'TD46', namaToko: 'UBM TOWER', shipment: 'S-261009-AGFHWFG', namaKonsumen: 'ALPHA ADARRANI WIBOWO', sla: '7. > 12 Jam' },
    ],
    slaBreakdown: { '7. > 12 Jam': 3 },
  }

  const handleContentChange = (val) => {
    setCurrentTemplates({
      ...currentTemplates,
      [selectedKey]: {
        ...currentTemplates[selectedKey],
        content: val,
      },
    })
  }

  const handleInsertVariable = (tag) => {
    const currentVal = currentTemplates[selectedKey]?.content || ''
    handleContentChange(currentVal + ' ' + tag)
  }

  const handleSaveAll = async () => {
    try {
      await onSaveTemplates(currentTemplates, selectedKey)
      showToast('Template tersimpan bersama untuk PIC ini.', 'success')
    } catch (error) { showToast(error.message, 'error') }
  }

  const handleReset = () => {
    if (window.confirm('Kembalikan template ini ke teks bawaan sistem?')) {
      setCurrentTemplates({
        ...currentTemplates,
        [selectedKey]: {
          ...currentTemplates[selectedKey],
          content: DEFAULT_TEMPLATES[selectedKey].content,
        },
      })
      showToast('Template dikembalikan ke default', 'info')
    }
  }

  const activeTemplate = currentTemplates[selectedKey] || DEFAULT_TEMPLATES.template_1
  const renderedPreview = renderTemplate(activeTemplate.content, sampleAc)

  return (
    <div className="secondary-page space-y-6">
      {/* Header Info */}
      <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-zinc-100 dark:bg-amber-950/60 text-zinc-500 dark:text-amber-400 flex items-center justify-center font-bold">
              <MessageSquare size={22} />
            </div>
            <div>
              <h2 className="text-xl font-extrabold text-zinc-900 dark:text-white tracking-tight">
                Template pesan
              </h2>
              <InfoButton title="Informasi halaman">
                Pilih dan modifikasi template pesan sesuai kategori kendala dengan variabel dinamis otomatis.
              </InfoButton>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-full text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              <RotateCcw size={14} />
              Reset
            </button>
            <button
              onClick={handleSaveAll}
              className="primary-button"
            >
              <Save size={15} />
              Simpan &amp; Terapkan
            </button>
          </div>
        </div>

        {/* 4 Cards Kategori Template (Sesuai Gaya Feature Cards di Gambar) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-6 pt-5 border-t border-zinc-100 dark:border-zinc-800">
          {Object.entries(currentTemplates).map(([key, tpl]) => {
            const isSelected = selectedKey === key
            const isMainActive = activeTemplateKey === key

            return (
              <button
                key={key}
                onClick={() => {
                  setSelectedKey(key)
                  onSelectActiveTemplate(key)
                }}
                className={`text-left p-4 rounded-2xl border transition-all relative cursor-pointer ${
                  isSelected
                    ? 'bg-[#F5F3FF] dark:bg-purple-950/40 border-purple-400 shadow-sm ring-1 ring-purple-400/40'
                    : 'bg-[#FAF9F6] dark:bg-zinc-800/40 border-zinc-200/80 dark:border-zinc-700/60 hover:border-zinc-300'
                }`}
              >
                {isMainActive && (
                  <span className="absolute top-3 right-3 w-2 h-2 rounded-full bg-emerald-500" />
                )}
                <div className="font-extrabold text-xs text-zinc-900 dark:text-white mb-1">
                  {tpl.name}
                </div>
                <div className="text-[11px] text-zinc-500 dark:text-zinc-400 line-clamp-1">
                  {tpl.description}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Editor & Live Preview Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Kolom Kiri: Editor */}
        <div className="lg:col-span-7 space-y-4">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Code2 size={15} className="text-zinc-600" />
                Editor Teks Template:
              </label>
              <span className="text-[11px] text-zinc-400 font-mono">
                {activeTemplate.content.length} karakter
              </span>
            </div>

            <textarea
              rows={13}
              value={activeTemplate.content}
              onChange={(e) => handleContentChange(e.target.value)}
              className="w-full text-xs font-mono p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-[#FCFBF9] dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-purple-500/50 leading-relaxed shadow-2xs"
            />

            {/* Variabel Pills */}
            <div>
              <div className="text-[11px] font-bold text-zinc-400 uppercase tracking-wider mb-2">
                Klik Variabel untuk Menyisipkan ke Template:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {availableVariables.map((v) => (
                  <button
                    key={v.tag}
                    onClick={() => handleInsertVariable(v.tag)}
                    title={v.desc}
                    className={`px-3 py-1 rounded-full text-[11px] font-mono font-bold transition-all cursor-pointer active:scale-95 shadow-2xs ${v.bg}`}
                  >
                    {v.tag}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Kolom Kanan: Live Preview */}
        <div className="lg:col-span-5">
          <div className="bg-white dark:bg-zinc-900 rounded-3xl border border-zinc-200/80 dark:border-zinc-800 p-6 shadow-[0_4px_24px_rgba(0,0,0,0.02)] space-y-3 sticky top-24">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                <Sparkles size={15} className="text-amber-500" />
                Live Pratinjau Teks:
              </label>
              
            </div>

            <div className="p-4 rounded-2xl bg-[#F9F7F2] dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 font-mono text-xs whitespace-pre-wrap text-zinc-800 dark:text-zinc-200 leading-relaxed max-h-[460px] overflow-y-auto shadow-inner">
              {renderedPreview}
            </div>

            <InfoButton title="Menggunakan template"><p>Template mengisi draf saat Anda membuka chat. Pesan tetap dapat disesuaikan per AC di Monitoring.</p></InfoButton>
          </div>
        </div>
      </div>
    </div>
  )
}
