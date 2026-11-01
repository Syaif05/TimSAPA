import React, { useState } from 'react'
import { Check, Palette, RotateCcw, Save } from 'lucide-react'
import { APPEARANCE_THEMES, DEFAULT_APPEARANCE, appearanceVariables, normalizeAppearance } from '../utils/appearance'
import { usePicEditing, usePicProfile } from '../profiles/ProfileContext'
export function AppearanceSettings({ appearance, onSave, showToast }) {
  const { name } = usePicProfile()
  const [current, setCurrent] = useState(() => normalizeAppearance(appearance))
  const [saving, setSaving] = useState(false)
  usePicEditing(JSON.stringify(current) !== JSON.stringify(normalizeAppearance(appearance)))
  const save = async () => {
    setSaving(true)
    try { await onSave(current); showToast('Tampilan tersimpan untuk ' + name + '.', 'success') }
    catch (error) { showToast(error.message, 'error') }
    finally { setSaving(false) }
  }
  return <section className="appearance-settings">
    <div className="appearance-heading"><div><span className="appearance-eyebrow">PERSONALISASI · {name}</span><h2>Warna pilihan Anda.</h2></div><button className="icon-button" aria-label="Reset warna" title="Reset warna" onClick={() => setCurrent({ ...DEFAULT_APPEARANCE })}><RotateCcw size={16}/></button></div>
    <div className="appearance-layout">
      <div className="appearance-controls">
        <div className="theme-presets" role="group" aria-label="Pilihan tema warna">{APPEARANCE_THEMES.map(theme => <button type="button" key={theme.id} className={`theme-preset ${current.theme === theme.id && current.accent === theme.accent ? 'selected' : ''}`} aria-pressed={current.theme === theme.id && current.accent === theme.accent} onClick={() => setCurrent(prev => ({ ...prev, theme: theme.id, accent: theme.accent }))}><span className="theme-swatch" style={{ background: theme.accent }}>{current.theme === theme.id && current.accent === theme.accent && <Check size={16}/>}</span>{theme.name}</button>)}</div>
        <div className="appearance-colors">{[['accent','Aksen aplikasi'], ['dsColor','Tepi DS'], ['regColor','Tepi REG']].map(([key, label]) => <label key={key} className="color-setting"><span>{label}</span><span className="color-setting-value"><input type="color" aria-label={label} value={current[key]} onChange={e => setCurrent(prev => ({ ...prev, [key]: e.target.value }))}/><span>{current[key].toUpperCase()}</span></span></label>)}</div>
        <div className="appearance-save"><span>Disimpan bersama per PIC.</span><button className="primary-button" onClick={save} disabled={saving}><Save size={15}/>{saving ? 'Menyimpan…' : 'Simpan tampilan'}</button></div>
      </div>
      <div className="theme-preview" style={appearanceVariables(current)} aria-label="Pratinjau tema">
        <div className="theme-preview-top"><span><Palette size={14}/> Monitoring</span><span className="theme-preview-live"/> Live</div>
        <div className="theme-preview-stats"><strong>24 <span>Belum</span></strong><strong>18 <span>DONE</span></strong></div>
        {['DS', 'REG'].map((source, index) => <div className={`theme-preview-order source-${source.toLowerCase()}`} key={source}><span className="source-badge">{source}</span><span><strong>Area Coordinator {index + 1}</strong><small>{index ? '3' : '5'} pesanan aktif</small></span><Check size={15}/></div>)}
        <div className="theme-preview-action">Buka chat <span>↗</span></div>
      </div>
    </div>
  </section>
}
