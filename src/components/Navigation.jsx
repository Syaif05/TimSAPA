import React from 'react'
import {
  Layers,
  PackageCheck,
  Database,
  Sliders,
  Palette,
  HelpCircle,
  Combine,
} from 'lucide-react'

export function Navigation({ activeTab, onTabChange, pendingCount, contactCount, podPendingCount }) {
  const tabs = [
    {
      id: 'workspace',
      label: 'Workspace',
      icon: Layers,
      badge: pendingCount > 0 ? `${pendingCount}` : null,
    },
    {
      id: 'pod',
      label: 'Broadcast POD',
      icon: PackageCheck,
      badge: podPendingCount > 0 ? `${podPendingCount}` : null,
    },
    {
      id: 'shipment',
      label: 'Shipment',
      icon: Combine,
    },
    {
      id: 'database',
      label: 'Kontak',
      icon: Database,
      badge: contactCount > 0 ? `${contactCount}` : null,
    },
    {
      id: 'templates',
      label: 'Template',
      icon: Sliders,
    },
    {
      id: 'settings',
      label: 'Pengaturan',
      icon: Palette,
    },
    {
      id: 'guide',
      label: 'Panduan',
      icon: HelpCircle,
    },
  ]

  return (
    <nav className="md:hidden flex items-center justify-between gap-1 p-1.5 mb-4 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md rounded-full border border-zinc-200/80 dark:border-zinc-800 shadow-2xs overflow-x-auto">
      {tabs.map((tab) => {
        const Icon = tab.icon
        const isActive = activeTab === tab.id

        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
              isActive
                ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white'
            }`}
          >
            <Icon size={14} />
            <span>{tab.label}</span>
            {tab.badge && (
              <span
                className={`text-[10px] font-extrabold px-1.5 py-0.2 rounded-full ${
                  isActive
                    ? 'bg-purple-500 text-white'
                    : 'bg-zinc-200 dark:bg-zinc-700 text-zinc-700 dark:text-zinc-300'
                }`}
              >
                {tab.badge}
              </span>
            )}
          </button>
        )
      })}
    </nav>
  )
}
