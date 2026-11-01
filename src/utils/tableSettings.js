/**
 * Konfigurasi Pengaturan Desain & Teks Gambar Hasil MONITORING SAPA 3
 */

export const DEFAULT_TABLE_SETTINGS = {
  // 1. Teks & Header
  showTitleBar: true,
  titleBadgeText: 'MONITORING SAPA 3',
  showTitleBadge: true,
  showAcName: true,
  acNamePrefix: 'AC: ',
  showCabangRegion: true,
  showMetaJam: true,
  showMetaTotal: true,
  showMetaPic: true,

  // Pesan Banner Atas Tambahan (Opsional)
  showTopBanner: false,
  topBannerText: '⚠️ MOHON DITINDAKLANJUTI SEGERA KE PERSONIL TOKO',
  topBannerBg: '#FEF08A',
  topBannerColor: '#854D0E',

  // Catatan Footer Bawah Tambahan (Opsional)
  showFooterNote: false,
  footerNoteText: 'Catatan: Mohon prioritaskan pesanan dengan SLA > 2 Jam & konfirmasi segera setelah pesanan dikirim.',
  footerAlign: 'left', // 'left' | 'center' | 'right'

  // Watermark
  showWatermark: false,
  watermarkText: 'ALFAGIFT OPERATIONAL • SAPA 3',

  // 2. Kolom Tabel (Visibilitas & Nama Label Kustom)
  columns: {
    kodeToko: { visible: true, label: 'Kode Toko' },
    namaToko: { visible: true, label: 'Nama Toko' },
    cabang: { visible: true, label: 'Cabang' },
    region: { visible: true, label: 'Region' },
    shipment: { visible: true, label: 'Shipment' },
    namaKonsumen: { visible: true, label: 'Nama Konsumen' },
    sla: { visible: true, label: 'SLA' },
    jam: { visible: false, label: 'Jam' },
    pic: { visible: false, label: 'PIC' },
  },

  // 3. Tema Warna & Desain
  preset: 'excel_classic', // 'excel_classic' | 'alfamart' | 'modern_light' | 'dark_obsidian' | 'navy_corporate' | 'custom'
  colors: {
    tableBg: '#ffffff',
    headerBg: '#f3f4f6',
    headerText: '#111827',
    titleBadgeBg: '#dc2626',
    titleBadgeText: '#ffffff',
    borderColor: '#d1d5db',
    innerBorderColor: '#e5e7eb',
    rowEvenBg: '#ffffff',
    rowOddBg: '#fafafa',
    rowTextColor: '#111827',
    shipmentColor: '#1e40af',
  },

  // 4. Gaya SLA Urgency
  sla: {
    mode: 'full_cell', // 'full_cell' | 'badge_pill' | 'colored_text'
    highlightEnabled: true,
    color12h: '#cc0000', // > 12 Jam (Merah Tua)
    color6h: '#ef4444',  // > 6 Jam (Merah Coral)
    color2h: '#ea580c',  // > 2 Jam (Oranye Tua)
    color1h: '#f59e0b',  // > 1 Jam (Oranye Amber)
    color45m: '#facc15', // > 45 Menit (Kuning)
    color30m: '#fef08a', // > 30 Menit (Kuning Muda)
  },

  // 5. Tipografi & Spacing
  typography: {
    fontFamily: 'system', // 'system' | 'jakarta' | 'arial' | 'mono'
    fontSize: 'normal',    // 'compact' | 'normal' | 'large'
    paddingDensity: 'normal', // 'dense' | 'normal' | 'spacious'
    borderStyle: 'excel',  // 'excel' | 'modern' | 'horizontal' | 'none'
    borderRadius: 0,       // 0, 8, 14, 20
    shadow: false,
  },

  // Skala resolusi tangkapan gambar
  exportScale: 2.5,
}

export const TABLE_PRESETS = {
  excel_classic: {
    name: 'Excel Klasik (Gambar 3 Asli)',
    description: 'Format persis seperti gambar acuan asli dengan grid tegas dan badge merah SAPA 3.',
    settings: {
      preset: 'excel_classic',
      colors: {
        tableBg: '#ffffff',
        headerBg: '#f3f4f6',
        headerText: '#111827',
        titleBadgeBg: '#dc2626',
        titleBadgeText: '#ffffff',
        borderColor: '#d1d5db',
        innerBorderColor: '#e5e7eb',
        rowEvenBg: '#ffffff',
        rowOddBg: '#fafafa',
        rowTextColor: '#111827',
        shipmentColor: '#1e40af',
      },
      sla: {
        mode: 'full_cell',
        highlightEnabled: true,
        color12h: '#cc0000',
        color6h: '#ef4444',
        color2h: '#ea580c',
        color1h: '#f59e0b',
        color45m: '#facc15',
        color30m: '#fef08a',
      },
      typography: {
        fontFamily: 'system',
        fontSize: 'normal',
        paddingDensity: 'normal',
        borderStyle: 'excel',
        borderRadius: 0,
        shadow: false,
      },
    },
  },

  alfamart: {
    name: 'Alfamart Brand Merah',
    description: 'Identitas resmi Alfamart dengan header merah tebal, badge biru navy, dan aksen kontras.',
    settings: {
      preset: 'alfamart',
      colors: {
        tableBg: '#ffffff',
        headerBg: '#ED1C24',
        headerText: '#ffffff',
        titleBadgeBg: '#005DAA',
        titleBadgeText: '#ffffff',
        borderColor: '#ED1C24',
        innerBorderColor: '#fed7aa',
        rowEvenBg: '#ffffff',
        rowOddBg: '#fff7ed',
        rowTextColor: '#0f172a',
        shipmentColor: '#005DAA',
      },
      sla: {
        mode: 'badge_pill',
        highlightEnabled: true,
        color12h: '#cc0000',
        color6h: '#ef4444',
        color2h: '#ea580c',
        color1h: '#f59e0b',
        color45m: '#eab308',
        color30m: '#fef08a',
      },
      typography: {
        fontFamily: 'jakarta',
        fontSize: 'normal',
        paddingDensity: 'normal',
        borderStyle: 'modern',
        borderRadius: 8,
        shadow: true,
      },
    },
  },

  modern_light: {
    name: 'Modern Minimalist (MeetingAI)',
    description: 'Desain bersih kekinian dengan sudut melengkung, badge SLA kapsul, dan font Plus Jakarta Sans.',
    settings: {
      preset: 'modern_light',
      colors: {
        tableBg: '#FAF8F5',
        headerBg: '#EDE9FE',
        headerText: '#4C1D95',
        titleBadgeBg: '#7C3AED',
        titleBadgeText: '#ffffff',
        borderColor: '#DDD6FE',
        innerBorderColor: '#E2E8F0',
        rowEvenBg: '#ffffff',
        rowOddBg: '#F8FAFC',
        rowTextColor: '#0F172A',
        shipmentColor: '#6D28D9',
      },
      sla: {
        mode: 'badge_pill',
        highlightEnabled: true,
        color12h: '#DC2626',
        color6h: '#EA580C',
        color2h: '#D97706',
        color1h: '#CA8A04',
        color45m: '#EAB308',
        color30m: '#FEF08A',
      },
      typography: {
        fontFamily: 'jakarta',
        fontSize: 'normal',
        paddingDensity: 'spacious',
        borderStyle: 'horizontal',
        borderRadius: 14,
        shadow: true,
      },
    },
  },

  dark_obsidian: {
    name: 'Executive Dark Mode',
    description: 'Latar gelap elegan kontras tinggi, sangat nyaman dan mencolok saat dibuka di WhatsApp Dark Mode.',
    settings: {
      preset: 'dark_obsidian',
      colors: {
        tableBg: '#0F172A',
        headerBg: '#1E293B',
        headerText: '#F8FAFC',
        titleBadgeBg: '#EF4444',
        titleBadgeText: '#ffffff',
        borderColor: '#334155',
        innerBorderColor: '#1E293B',
        rowEvenBg: '#0F172A',
        rowOddBg: '#172236',
        rowTextColor: '#F1F5F9',
        shipmentColor: '#60A5FA',
      },
      sla: {
        mode: 'badge_pill',
        highlightEnabled: true,
        color12h: '#EF4444',
        color6h: '#F97316',
        color2h: '#FB923C',
        color1h: '#FBBF24',
        color45m: '#FACC15',
        color30m: '#FEF08A',
      },
      typography: {
        fontFamily: 'jakarta',
        fontSize: 'normal',
        paddingDensity: 'normal',
        borderStyle: 'modern',
        borderRadius: 10,
        shadow: true,
      },
    },
  },

  navy_corporate: {
    name: 'Corporate Deep Navy',
    description: 'Tampilan formal profesional bergaya korporat dengan biru tua dan garis grid rapi.',
    settings: {
      preset: 'navy_corporate',
      colors: {
        tableBg: '#ffffff',
        headerBg: '#1E3A8A',
        headerText: '#ffffff',
        titleBadgeBg: '#2563EB',
        titleBadgeText: '#ffffff',
        borderColor: '#1E3A8A',
        innerBorderColor: '#BFDBFE',
        rowEvenBg: '#ffffff',
        rowOddBg: '#EFF6FF',
        rowTextColor: '#0F172A',
        shipmentColor: '#1D4ED8',
      },
      sla: {
        mode: 'full_cell',
        highlightEnabled: true,
        color12h: '#cc0000',
        color6h: '#ef4444',
        color2h: '#ea580c',
        color1h: '#f59e0b',
        color45m: '#facc15',
        color30m: '#fef08a',
      },
      typography: {
        fontFamily: 'system',
        fontSize: 'normal',
        paddingDensity: 'normal',
        borderStyle: 'excel',
        borderRadius: 0,
        shadow: false,
      },
    },
  },
}

/**
 * Muat konfigurasi dari localStorage dengan fallback default
 */
export function loadTableSettings() {
  try {
    const saved = localStorage.getItem('sapa_table_settings')
    if (saved) {
      const parsed = JSON.parse(saved)
      return {
        ...DEFAULT_TABLE_SETTINGS,
        ...parsed,
        columns: { ...DEFAULT_TABLE_SETTINGS.columns, ...(parsed.columns || {}) },
        colors: { ...DEFAULT_TABLE_SETTINGS.colors, ...(parsed.colors || {}) },
        sla: { ...DEFAULT_TABLE_SETTINGS.sla, ...(parsed.sla || {}) },
        typography: { ...DEFAULT_TABLE_SETTINGS.typography, ...(parsed.typography || {}) },
      }
    }
  } catch (e) {
    console.error('Failed to load table settings:', e)
  }
  return DEFAULT_TABLE_SETTINGS
}

/**
 * Simpan konfigurasi ke localStorage
 */
export function saveTableSettings(settings) {
  try {
    localStorage.setItem('sapa_table_settings', JSON.stringify(settings))
  } catch (e) {
    console.error('Failed to save table settings:', e)
  }
}
