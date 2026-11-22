import React, { memo } from 'react'
import { ChevronRight, CheckCircle2, Clock3, AlertCircle, Package, Store } from 'lucide-react'
import { getStatusBadgeStyles } from '../utils/statusConfig'
export const AcListItem = memo(function AcListItem({ acGroup, isSelected, onClick, statuses }) {
  const status = getStatusBadgeStyles(acGroup.status, statuses)
  const critical = Object.keys(acGroup.slaBreakdown || {}).some(sla => sla.includes('12') || sla.includes('6'))
  const StatusIcon = status.countsAsCompleted ? CheckCircle2 : status.id === 'tidak_merespon' ? AlertCircle : Clock3
  const stateClass = status.countsAsCompleted ? 'is-contacted' : status.id !== 'belum_dikerjakan' ? 'is-in-progress' : ''
  return <button type="button" onClick={onClick} aria-pressed={isSelected} className={`ac-list-row ${acGroup.source ? `source-${acGroup.source.toLowerCase()}` : ''} ${stateClass} ${isSelected ? 'selected' : ''}`} data-source={acGroup.source || undefined} data-chat-color={status.color}>
    <span className="ac-avatar">{acGroup.acName.split(/\s+/).slice(0, 2).map(n => n[0]).join('')}</span>
    <span className="queue-card-content">
      <span className="queue-card-name">{acGroup.acName}</span>
      <span className="queue-card-location">{acGroup.cabang || 'Cabang belum diisi'}{acGroup.region ? ` · ${acGroup.region}` : ''}</span>
      <span className="queue-card-metrics"><span><Package size={12}/>{acGroup.totalShipments} pesanan</span><span><Store size={12}/>{acGroup.totalStores} toko</span>{acGroup.source && <span className="source-badge">{acGroup.sources?.join(' + ') || acGroup.source}</span>}</span>
      <span className="queue-card-footer"><span className="chat-status-badge"><StatusIcon size={12}/>{status.shortLabel}</span>{critical && <span className="queue-critical" title="Ada pesanan SLA 6 atau 12 jam"><AlertCircle size={11}/>SLA kritis</span>}</span>
    </span>
    <ChevronRight size={14} className="queue-chevron" aria-hidden="true"/>
  </button>
})
