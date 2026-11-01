export const APPEARANCE_THEMES = [
  { id: 'ocean', name: 'Biru', accent: '#2563eb' },
  { id: 'rose', name: 'Pink', accent: '#be185d' },
  { id: 'lavender', name: 'Ungu', accent: '#7c3aed' },
  { id: 'sage', name: 'Hijau', accent: '#15803d' },
  { id: 'sand', name: 'Pasir', accent: '#a16207' },
  { id: 'graphite', name: 'Netral', accent: '#374151' },
]
export const DEFAULT_APPEARANCE = { theme: 'ocean', accent: '#2563eb', dsColor: '#ef4444', regColor: '#3b82f6' }
export const isHexColor = value => typeof value === 'string' && /^#[a-f0-9]{6}$/i.test(value)
export function normalizeAppearance(value = {}) {
  return { theme: APPEARANCE_THEMES.some(t => t.id === value?.theme) ? value.theme : DEFAULT_APPEARANCE.theme, ...Object.fromEntries(['accent', 'dsColor', 'regColor'].map(key => [key, isHexColor(value?.[key]) ? value[key] : DEFAULT_APPEARANCE[key]])) }
}
export function mixColor(color, base, weight) {
  return '#' + [1, 3, 5].map(offset => Math.round(parseInt(color.slice(offset, offset + 2), 16) * weight + parseInt(base.slice(offset, offset + 2), 16) * (1 - weight)).toString(16).padStart(2, '0')).join('')
}
export function foregroundColor(hex) {
  const rgb = [1, 3, 5].map(offset => { const v = parseInt(hex.slice(offset, offset + 2), 16) / 255; return v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4 })
  return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2] > .179 ? '#141518' : '#ffffff'
}
export function appearanceVariables(value, dark = false) {
  const a = normalizeAppearance(value)
  return {
    '--accent': a.accent, '--solid': a.accent, '--on-solid': foregroundColor(a.accent),
    '--canvas': mixColor(a.accent, dark ? '#141518' : '#ffffff', dark ? .07 : .055),
    '--panel': dark ? '#1d1f24' : '#ffffff', '--soft': mixColor(a.accent, dark ? '#25272e' : '#ffffff', dark ? .10 : .035),
    '--line': mixColor(a.accent, dark ? '#2c2f37' : '#e9eaee', .12),
    '--accent-soft': mixColor(a.accent, dark ? '#25272e' : '#ffffff', dark ? .23 : .09),
    '--accent-ink': dark ? mixColor(a.accent, '#ffffff', .42) : a.accent,
    '--ink': dark ? '#f0f1f4' : '#202227', '--muted': dark ? '#a0a7b4' : '#737b8a',
    '--source-ds': a.dsColor, '--source-reg': a.regColor,
  }
}

// Use the already deployed shared preference document; no new server capability is required.
export function workspaceAppearance(sharedTableSettings, legacyAppearance) {
  return normalizeAppearance(sharedTableSettings?.workspaceAppearance || legacyAppearance || DEFAULT_APPEARANCE)
}
export function imageSettingsOnly(sharedTableSettings) {
  const { workspaceAppearance: _appearance, ...image } = sharedTableSettings
  return image
}
export function saveImageSettings(image, previousShared) {
  return { ...image, ...(previousShared?.workspaceAppearance ? { workspaceAppearance: previousShared.workspaceAppearance } : {}) }
}
