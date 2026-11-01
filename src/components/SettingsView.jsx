import { usePicEditing } from '../profiles/ProfileContext'
import React, { useState } from 'react'
import { Palette, Tag } from 'lucide-react'
import { AppearanceSettings } from './AppearanceSettings'
import { TableImageSettings } from './TableImageSettings'
import { StatusSettingsTab } from './StatusSettingsTab'

export function SettingsView({
  appearance,
  onSaveAppearance,
  tableSettings,
  onSaveTableSettings,
  statuses,
  onUpdateStatuses,
  showToast,
  initialSubTab = 'appearance'
}) {
  usePicEditing()
  const [subTab, setSubTab] = useState(initialSubTab) // 'statuses' | 'image'

  return (
    <div className="secondary-page space-y-6">
      <div className="settings-tabs" aria-label="Bagian pengaturan">{[['appearance','Tampilan',Palette],['statuses','Status antrean',Tag],['image','Desain tabel',Palette]].map(([id,label,Icon]) => <button key={id} className={`settings-tab ${subTab === id ? 'active' : ''}`} onClick={() => setSubTab(id)}><Icon size={15}/><span>{label}</span></button>)}</div>
      {subTab === 'appearance' && <AppearanceSettings appearance={appearance} onSave={onSaveAppearance} showToast={showToast}/>}

      {/* Tab 1: Kustomisasi Status */}
      {subTab === 'statuses' && (
        <StatusSettingsTab
          statuses={statuses}
          onUpdateStatuses={onUpdateStatuses}
          showToast={showToast}
        />
      )}

      {/* Tab 2: Pengaturan Gambar */}
      {subTab === 'image' && (
        <TableImageSettings
          tableSettings={tableSettings}
          onSaveTableSettings={onSaveTableSettings}
          showToast={showToast}
        />
      )}
    </div>
  )
}
