import React, { memo } from 'react'
import { ChevronRight } from 'lucide-react'
import { getStatusBadgeStyles } from '../utils/statusConfig'
export const AcListItem = memo(function AcListItem({ acGroup, isSelected, onClick, statuses }) {
  const status = getStatusBadgeStyles(acGroup.status, statuses)
  const critical = Object.keys(acGroup.slaBreakdown || {}).some((sla) => sla.includes('12') || sla.includes('6'))
  return <button type="button" onClick={onClick} aria-pressed={isSelected} className={`ac-list-row ${acGroup.source ? `source-${acGroup.source.toLowerCase()}` : ''} ${isSelected ? 'selected' : ''}`} data-source={acGroup.source || undefined}>
    <span className={`ac-avatar ${status.countsAsCompleted ? 'complete' : ''}`}>{acGroup.acName.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-xs font-semibold">{acGroup.acName}</span>
      <span className="block truncate text-[11px] text-zinc-400 mt-1">{acGroup.source && <span className="source-badge">{acGroup.source}</span>}{acGroup.cabang || '—'} · {acGroup.totalShipments} pesanan</span>
    </span>
    <span className={`queue-dot ${status.countsAsCompleted ? 'complete' : critical ? 'critical' : ''}`} title={status.label} />
    <ChevronRight size={13} className="text-zinc-300" />
  </button>
})
