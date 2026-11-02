import React from 'react'
import { PicBadge } from '../profiles/ProfileGate'
import { Layers, PackageCheck, SlidersHorizontal, Settings2, Sun, Moon, Plus, MessageCircle, ArrowUpRight, FileInput } from 'lucide-react'
import { requestWhatsAppTab } from '../utils/whatsappBridge'
const items = [
  ['workspace', 'Monitoring', Layers], ['tarik-data', 'Tarik Data', FileInput], ['pod', 'Broadcast POD', PackageCheck],
  ['templates', 'Template', SlidersHorizontal], ['settings', 'Pengaturan', Settings2],
]
export function Header({ activeTab, onTabChange, darkMode, onToggleDarkMode, onOpenPasteModal, showToast }) {
  return <>
    <aside className="app-sidebar" aria-label="Navigasi utama">
      <button className="brand-mark" onClick={() => onTabChange('workspace')} aria-label="SAPA beranda">s<span>.</span></button>
      <nav className="rail-nav">
        {items.map(([id, label, Icon]) => <button key={id} title={label} aria-label={label} aria-current={activeTab === id ? 'page' : undefined} onClick={() => onTabChange(id)} className={`rail-item ${activeTab === id ? 'active' : ''}`}><Icon size={20} strokeWidth={1.65} /><span className="rail-tooltip">{label}</span></button>)}
      </nav>
      <button className="rail-item theme-toggle" onClick={onToggleDarkMode} title={darkMode ? 'Mode terang' : 'Mode gelap'} aria-label={darkMode ? 'Mode terang' : 'Mode gelap'}>{darkMode ? <Sun size={20} /> : <Moon size={20} />}</button>
    </aside>
    <header className="app-header">
      <div className="flex items-center gap-3"><span className="text-sm font-semibold tracking-tight">SAPA<span className="text-zinc-400 font-normal ml-2 hidden sm:inline">/ {items.find(([id]) => id === activeTab)?.[1]}</span></span><PicBadge showToast={showToast} /></div>
      <div className="flex items-center gap-2">
        <button className="icon-button" title="Fokuskan tab WhatsApp" aria-label="Fokuskan tab WhatsApp" onClick={async () => { const result = await requestWhatsAppTab('SAPA_WA_OPEN', 'https://web.whatsapp.com/'); if (!result.ok) showToast?.(result.error, 'error') }}><MessageCircle size={19} /></button>
        <button className="primary-button" onClick={onOpenPasteModal}><Plus size={16} /><span>Input data</span><ArrowUpRight size={14} className="hidden sm:block opacity-50" /></button>
      </div>
    </header>
  </>
}
