import { activeOrderGroup } from '../utils/orderState'
import React, { forwardRef } from 'react'
import { DEFAULT_TABLE_SETTINGS } from '../utils/tableSettings'

/**
 * Komponen Tabel Khusus Rendering Gambar PNG (Dapat Dikustomisasi Total)
 */
export const AcTableRender = forwardRef(({ acGroup, settings: propSettings, showTitleBar: propShowTitleBar }, ref) => {
  acGroup = activeOrderGroup(acGroup)
  if (!acGroup?.rows?.length) return null
  // Merge dengan default settings
  const s = {
    ...DEFAULT_TABLE_SETTINGS,
    ...(propSettings || {}),
    columns: { ...DEFAULT_TABLE_SETTINGS.columns, ...(propSettings?.columns || {}) },
    colors: { ...DEFAULT_TABLE_SETTINGS.colors, ...(propSettings?.colors || {}) },
    sla: { ...DEFAULT_TABLE_SETTINGS.sla, ...(propSettings?.sla || {}) },
    typography: { ...DEFAULT_TABLE_SETTINGS.typography, ...(propSettings?.typography || {}) },
  }

  const rows = acGroup?.rows || []
  const showTitleBar = propShowTitleBar !== undefined ? propShowTitleBar : s.showTitleBar

  // 1. Font Family
  const getFontFamily = (font) => {
    switch (font) {
      case 'jakarta':
        return "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif"
      case 'arial':
        return 'Arial, "Helvetica Neue", Helvetica, sans-serif'
      case 'mono':
        return 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace'
      case 'system':
      default:
        return '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
    }
  }

  // 2. Font Size
  const getFontSize = (size) => {
    switch (size) {
      case 'compact':
        return { table: '11px', header: '11px', meta: '10px', title: '12px', badge: '10px' }
      case 'large':
        return { table: '14px', header: '14px', meta: '12px', title: '15px', badge: '12px' }
      case 'normal':
      default:
        return { table: '12.5px', header: '12px', meta: '11px', title: '13.5px', badge: '11px' }
    }
  }

  // 3. Cell Padding Density
  const getCellPadding = (density) => {
    switch (density) {
      case 'dense':
        return '4px 8px'
      case 'spacious':
        return '9px 14px'
      case 'normal':
      default:
        return '6px 10px'
    }
  }

  const fontStyle = getFontFamily(s.typography.fontFamily)
  const fontSizes = getFontSize(s.typography.fontSize)
  const cellPadding = getCellPadding(s.typography.paddingDensity)

  // 4. Border Styling
  const getBorderStyles = () => {
    const borderCol = s.colors.borderColor || '#d1d5db'
    const innerCol = s.colors.innerBorderColor || '#e5e7eb'

    switch (s.typography.borderStyle) {
      case 'horizontal':
        return {
          tableBorder: `1px solid ${borderCol}`,
          thBorder: `1px solid ${borderCol}`,
          tdBorderTop: `1px solid ${innerCol}`,
          tdBorderBottom: `1px solid ${innerCol}`,
          tdBorderLeft: 'none',
          tdBorderRight: 'none',
        }
      case 'none':
        return {
          tableBorder: 'none',
          thBorder: `1px solid ${borderCol}`,
          tdBorderTop: 'none',
          tdBorderBottom: 'none',
          tdBorderLeft: 'none',
          tdBorderRight: 'none',
        }
      case 'modern':
        return {
          tableBorder: `1px solid ${borderCol}`,
          thBorder: `1px solid ${borderCol}`,
          tdBorderTop: `1px solid ${innerCol}`,
          tdBorderBottom: `1px solid ${innerCol}`,
          tdBorderLeft: `1px solid ${innerCol}`,
          tdBorderRight: `1px solid ${innerCol}`,
        }
      case 'excel':
      default:
        return {
          tableBorder: `1px solid ${borderCol}`,
          thBorder: `1px solid ${borderCol}`,
          tdBorderTop: `1px solid ${borderCol}`,
          tdBorderBottom: `1px solid ${borderCol}`,
          tdBorderLeft: `1px solid ${borderCol}`,
          tdBorderRight: `1px solid ${borderCol}`,
        }
    }
  }

  const borderStyles = getBorderStyles()

  // 5. Helper SLA Color Resolver
  const getSlaColorInfo = (slaText) => {
    if (!s.sla.highlightEnabled) {
      return { bg: 'transparent', text: s.colors.rowTextColor, isHighlight: false }
    }

    const text = String(slaText || '').toLowerCase()
    const slaColors = s.sla

    if (text.includes('12 jam') || text.includes('> 12')) {
      return { bg: slaColors.color12h || '#cc0000', text: '#ffffff', isHighlight: true }
    } else if (text.includes('6 jam') || text.includes('> 6')) {
      return { bg: slaColors.color6h || '#ef4444', text: '#ffffff', isHighlight: true }
    } else if (text.includes('2 jam') || text.includes('> 2')) {
      return { bg: slaColors.color2h || '#ea580c', text: '#ffffff', isHighlight: true }
    } else if (text.includes('1 jam') || text.includes('> 1')) {
      return { bg: slaColors.color1h || '#f59e0b', text: '#111827', isHighlight: true }
    } else if (text.includes('45')) {
      return { bg: slaColors.color45m || '#facc15', text: '#111827', isHighlight: true }
    } else if (text.includes('30')) {
      return { bg: slaColors.color30m || '#fef08a', text: '#111827', isHighlight: true }
    }

    return { bg: '#f3f4f6', text: '#374151', isHighlight: false }
  }

  // Active columns filter
  const cols = s.columns

  return (
    <div
      ref={ref}
      style={{
        borderLeft: acGroup.source === 'DS' ? '3px solid var(--source-ds, #ef4444)' : acGroup.source === 'REG' ? '3px solid var(--source-reg, #3b82f6)' : undefined,
        backgroundColor: s.colors.tableBg || '#ffffff',
        fontFamily: fontStyle,
        padding: '14px 16px',
        display: 'inline-block',
        minWidth: '780px',
        maxWidth: '1150px',
        boxSizing: 'border-box',
        color: s.colors.rowTextColor || '#111827',
        borderRadius: `${s.typography.borderRadius || 0}px`,
        boxShadow: s.typography.shadow ? '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Pesan Banner Atas (Opsional Tambahan) */}
      {s.showTopBanner && s.topBannerText && (
        <div
          style={{
            backgroundColor: s.topBannerBg || '#FEF08A',
            color: s.topBannerColor || '#854D0E',
            padding: '6px 12px',
            borderRadius: s.typography.borderRadius > 0 ? '6px' : '0px',
            fontSize: fontSizes.meta,
            fontWeight: '700',
            marginBottom: '10px',
            textAlign: 'center',
            letterSpacing: '0.3px',
            border: '1px solid rgba(0,0,0,0.08)',
          }}
        >
          {s.topBannerText}
        </div>
      )}

      {/* Title Bar & Info Header */}
      {showTitleBar && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '10px',
            paddingBottom: '8px',
            borderBottom: `2px solid ${s.colors.innerBorderColor || '#e5e7eb'}`,
            fontSize: fontSizes.meta,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {s.showTitleBadge && s.titleBadgeText && (
              <span
                style={{
                  backgroundColor: s.colors.titleBadgeBg || '#dc2626',
                  color: s.colors.titleBadgeText || '#ffffff',
                  fontWeight: '800',
                  fontSize: fontSizes.badge,
                  padding: '2.5px 8px',
                  borderRadius: s.typography.borderRadius > 0 ? '6px' : '3px',
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}
              >
                {s.titleBadgeText}
              </span>
            )}

            {s.showAcName && (
              <span style={{ fontWeight: '800', fontSize: fontSizes.title, color: s.colors.rowTextColor || '#111827' }}>
                {s.acNamePrefix}{acGroup?.acName || '-'}
              </span>
            )}

            {s.showCabangRegion && (
              <span style={{ color: '#6b7280', fontSize: fontSizes.meta }}>
                • {acGroup?.cabang || ''} {acGroup?.region ? `(${acGroup.region})` : ''}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', gap: '14px', color: '#4b5563', fontSize: fontSizes.meta, fontWeight: '500' }}>
            {s.showMetaJam && <span>Jam: <b style={{ color: s.colors.rowTextColor }}>{acGroup?.jam || '-'}</b></span>}
            {s.showMetaTotal && <span>Total: <b style={{ color: s.colors.rowTextColor }}>{rows.length} Pesanan</b></span>}
            {s.showMetaPic && <span>PIC: <b style={{ color: s.colors.rowTextColor }}>{acGroup?.pic || '-'}</b></span>}
          </div>
        </div>
      )}

      {/* Tabel Spreadsheet */}
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: borderStyles.tableBorder,
          fontSize: fontSizes.table,
          lineHeight: '1.25',
          borderRadius: s.typography.borderRadius > 0 ? `${s.typography.borderRadius}px` : '0',
          overflow: 'hidden',
        }}
      >
        <thead>
          <tr style={{ backgroundColor: s.colors.headerBg || '#f3f4f6', color: s.colors.headerText || '#111827' }}>
            {cols.kodeToko?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.kodeToko.label}
              </th>
            )}
            {cols.namaToko?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.namaToko.label}
              </th>
            )}
            {cols.cabang?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.cabang.label}
              </th>
            )}
            {cols.region?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.region.label}
              </th>
            )}
            {cols.shipment?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.shipment.label}
              </th>
            )}
            {cols.namaKonsumen?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header }}>
                {cols.namaKonsumen.label}
              </th>
            )}
            {cols.jam?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header, textAlign: 'center' }}>
                {cols.jam.label}
              </th>
            )}
            {cols.pic?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header, textAlign: 'center' }}>
                {cols.pic.label}
              </th>
            )}
            {cols.sla?.visible && (
              <th style={{ ...thBaseStyle, border: borderStyles.thBorder, padding: cellPadding, fontSize: fontSizes.header, textAlign: 'center' }}>
                {cols.sla.label}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const isEven = idx % 2 === 0
            const rowBg = isEven ? (s.colors.rowEvenBg || '#ffffff') : (s.colors.rowOddBg || '#fafafa')
            const slaColor = getSlaColorInfo(row.sla)

            const tdStyle = {
              padding: cellPadding,
              borderTop: borderStyles.tdBorderTop,
              borderBottom: borderStyles.tdBorderBottom,
              borderLeft: borderStyles.tdBorderLeft,
              borderRight: borderStyles.tdBorderRight,
              verticalAlign: 'middle',
              color: s.colors.rowTextColor || '#111827',
            }

            return (
              <tr key={row.id || idx} style={{ backgroundColor: rowBg }}>
                {/* Kode Toko */}
                {cols.kodeToko?.visible && (
                  <td style={{ ...tdStyle, fontWeight: '700', whiteSpace: 'nowrap' }}>
                    {row.kodeToko || '-'}
                  </td>
                )}

                {/* Nama Toko */}
                {cols.namaToko?.visible && (
                  <td style={{ ...tdStyle, fontWeight: '500' }}>
                    {row.namaToko || '-'}
                  </td>
                )}

                {/* Cabang */}
                {cols.cabang?.visible && (
                  <td style={{ ...tdStyle, color: '#4b5563' }}>
                    {row.cabang || '-'}
                  </td>
                )}

                {/* Region */}
                {cols.region?.visible && (
                  <td style={{ ...tdStyle, color: '#6b7280', whiteSpace: 'nowrap' }}>
                    {row.region || '-'}
                  </td>
                )}

                {/* Shipment */}
                {cols.shipment?.visible && (
                  <td
                    style={{
                      ...tdStyle,
                      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                      fontWeight: '700',
                      color: s.colors.shipmentColor || '#1e40af',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {row.shipment || '-'}
                  </td>
                )}

                {/* Nama Konsumen */}
                {cols.namaKonsumen?.visible && (
                  <td style={{ ...tdStyle }}>
                    {row.namaKonsumen || '-'}
                  </td>
                )}

                {/* Jam (Opsional) */}
                {cols.jam?.visible && (
                  <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {row.jam || '-'}
                  </td>
                )}

                {/* PIC (Opsional) */}
                {cols.pic?.visible && (
                  <td style={{ ...tdStyle, textAlign: 'center', whiteSpace: 'nowrap' }}>
                    {row.pic || '-'}
                  </td>
                )}

                {/* SLA */}
                {cols.sla?.visible && (
                  <td
                    style={{
                      ...tdStyle,
                      textAlign: 'center',
                      whiteSpace: 'nowrap',
                      ...(s.sla.mode === 'full_cell' && slaColor.isHighlight
                        ? {
                            backgroundColor: slaColor.bg,
                            color: slaColor.text,
                            fontWeight: '700',
                          }
                        : {}),
                    }}
                  >
                    {s.sla.mode === 'badge_pill' ? (
                      <span
                        style={{
                          display: 'inline-block',
                          backgroundColor: slaColor.isHighlight ? slaColor.bg : '#f3f4f6',
                          color: slaColor.isHighlight ? slaColor.text : '#374151',
                          padding: '3px 10px',
                          borderRadius: '9999px',
                          fontWeight: '700',
                          fontSize: '11px',
                          letterSpacing: '0.2px',
                        }}
                      >
                        {row.sla || '-'}
                      </span>
                    ) : s.sla.mode === 'colored_text' ? (
                      <span
                        style={{
                          color: slaColor.isHighlight ? slaColor.bg : s.colors.rowTextColor,
                          fontWeight: '800',
                        }}
                      >
                        ● {row.sla || '-'}
                      </span>
                    ) : (
                      row.sla || '-'
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>

      {/* Catatan Footer Bawah (Opsional Tambahan) */}
      {s.showFooterNote && s.footerNoteText && (
        <div
          style={{
            marginTop: '10px',
            paddingTop: '6px',
            borderTop: `1px dashed ${s.colors.innerBorderColor || '#e5e7eb'}`,
            fontSize: fontSizes.meta,
            color: '#6b7280',
            textAlign: s.footerAlign || 'left',
            fontStyle: 'italic',
          }}
        >
          {s.footerNoteText}
        </div>
      )}

      {/* Watermark (Opsional Tambahan) */}
      {s.showWatermark && s.watermarkText && (
        <div
          style={{
            marginTop: '8px',
            textAlign: 'right',
            fontSize: '9px',
            color: '#9ca3af',
            letterSpacing: '1px',
            textTransform: 'uppercase',
            fontWeight: '600',
          }}
        >
          {s.watermarkText}
        </div>
      )}
    </div>
  )
})

const thBaseStyle = {
  textAlign: 'left',
  fontWeight: '700',
  letterSpacing: '0.2px',
}
