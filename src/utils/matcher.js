import { activeOrders, sourcePriority } from './orderState.js'
import { normalizePhone, isValidIndonesianPhone } from './phoneUtils.js'

/**
 * Mencocokkan data baris SAPA 3 dengan Master Kontak
 * @param {Array<Object>} sapaRows
 * @param {Array<Object>} masterContacts
 * @returns {Array<Object>} Baris data yang sudah diperkaya dengan CUG AC
 */
export function matchSapaWithContacts(sapaRows, masterContacts = [], { preferMasterContacts = false } = {}) {
  // Buat lookup maps untuk performa instan O(1)
  const storeMap = new Map()
  const storeNameMap = new Map()
  const acNameMap = new Map()
  const acPhoneMap = new Map() // Peta Nama AC -> Nomor HP valid yang terverifikasi

  masterContacts.forEach((c) => {
    if (c.store) {
      storeMap.set(String(c.store).trim().toUpperCase(), c)
    }
    if (c.storeName) {
      storeNameMap.set(String(c.storeName).trim().toUpperCase(), c)
    }
    if (c.acName) {
      const cleanAcName = String(c.acName).trim().toUpperCase()
      acNameMap.set(cleanAcName, c)

      // Simpan nomor CUG AC valid jika belum ada di map
      if (c.cugAc && isValidIndonesianPhone(c.cugAc) && !acPhoneMap.has(cleanAcName)) {
        acPhoneMap.set(cleanAcName, normalizePhone(c.cugAc))
      }
    }
  })

  return sapaRows.map((row) => {
    const rawNoAc = String(row.noAc || '').trim()
    const cleanRawPhone = normalizePhone(rawNoAc)

    // Lookup kontak master berdasarkan Kode Toko, Nama Toko, atau Nama AC
    let matched = null
    let matchedStore = false
    const storeKey = String(row.kodeToko || '').trim().toUpperCase()
    const storeNameKey = String(row.namaToko || '').trim().toUpperCase()
    const acNameKey = String(row.namaAc || '').trim().toUpperCase()

    if (storeKey && storeMap.has(storeKey)) {
      matched = storeMap.get(storeKey)
      matchedStore = true
    } else if (storeNameKey && storeNameMap.has(storeNameKey)) {
      matched = storeNameMap.get(storeNameKey)
      matchedStore = true
    } else if (acNameKey && acNameMap.has(acNameKey)) {
      matched = acNameMap.get(acNameKey)
    }

    // Tentukan Nama AC terbaik
    const resolvedAcName =
      (preferMasterContacts && matchedStore && matched?.acName?.trim()) ||
      (row.namaAc && row.namaAc !== '-' && row.namaAc.trim()) ||
      (matched && matched.acName) ||
      'AC Tanpa Nama'

    const cleanResolvedAcKey = resolvedAcName.trim().toUpperCase()

    // Tentukan nomor CUG AC terbaik dengan validasi ketat
    let resolvedPhone = ''
    let matchSource = 'unmatched'

    // 1. Coba dari toko yang cocok di master database (jika nomornya valid)
    if (preferMasterContacts && matched && isValidIndonesianPhone(matched.cugAc)) {
      resolvedPhone = normalizePhone(matched.cugAc)
      matchSource = matched.contactSource === 'spreadsheet' ? 'contacts_sheet' : 'master_db'
    }
    else if (row.source && cleanRawPhone && isValidIndonesianPhone(cleanRawPhone)) {
      resolvedPhone = cleanRawPhone
      matchSource = 'sheet_data'
    }
    else if (matched && matched.cugAc && isValidIndonesianPhone(matched.cugAc)) {
      resolvedPhone = normalizePhone(matched.cugAc)
      matchSource = 'master_db'
    }
    // 2. Jika toko ini tidak ada nomornya, cari dari nomor AC yang sama di toko binaan lainnya
    else if (cleanResolvedAcKey && acPhoneMap.has(cleanResolvedAcKey)) {
      resolvedPhone = acPhoneMap.get(cleanResolvedAcKey)
      matchSource = preferMasterContacts ? 'contacts_sheet_ac' : 'master_db_ac'
    }
    // 3. Jika AC di input sheet memiliki nomor valid
    else if (cleanRawPhone && isValidIndonesianPhone(cleanRawPhone)) {
      resolvedPhone = cleanRawPhone
      matchSource = 'sheet_data'
    }

    // Cabang & Region
    const resolvedCabang = row.cabang || (matched && matched.cabang) || '-'
    const resolvedRegion = row.region || (matched && matched.regional) || '-'

    return {
      ...row,
      resolvedAcName,
      resolvedPhone,
      cugToko: matched?.cugToko ? normalizePhone(matched.cugToko) : '',
      cugAm: preferMasterContacts && matched?.cugAm ? normalizePhone(matched.cugAm) : row.noAm ? normalizePhone(row.noAm) : matched?.cugAm ? normalizePhone(matched.cugAm) : '',
      amName: (preferMasterContacts && matched?.amName) || row.amName || matched?.amName || '',
      matchSource,
      cabang: resolvedCabang,
      region: resolvedRegion,
    }
  })
}

/**
 * Mengelompokkan data per AC
 * @param {Array<Object>} enrichedRows
 * @param {Object} sentStatusMap - Map status pengiriman yang tersimpan { [acKey]: 'sent' | 'pending' }
 * @returns {Array<Object>}
 */
export function groupRowsByAc(enrichedRows, sentStatusMap = {}, { workingOnly = false, splitSources = false, mergeContacts = false } = {}) {
  const groups = new Map()

  const rows = workingOnly ? activeOrders(enrichedRows) : enrichedRows
  const phonesByName = new Map()
  if (mergeContacts) for (const row of rows) {
    const name=String(row.resolvedAcName||'TANPA_NAMA').trim().toUpperCase()
    const phone=normalizePhone(row.resolvedPhone)
    if(isValidIndonesianPhone(phone)){if(!phonesByName.has(name))phonesByName.set(name,new Set());phonesByName.get(name).add(phone)}
  }
  rows.forEach((row) => {
    // Kunci grouping berdasarkan Nama AC
    const acNameKey = (row.resolvedAcName || 'TANPA_NAMA').toUpperCase().trim()
    const source = ['DS', 'REG'].includes(row.source) ? row.source : ''
    const candidates=phonesByName.get(acNameKey)
    const ownPhone=isValidIndonesianPhone(row.resolvedPhone) ? normalizePhone(row.resolvedPhone) : ''
    const groupPhone=ownPhone || (candidates?.size===1 ? [...candidates][0] : '')
    const acKey = mergeContacts ? (groupPhone ? `WA:${groupPhone}` : `NAME:${acNameKey}`) : splitSources && source ? `${source}::${acNameKey}` : acNameKey

    if (!groups.has(acKey)) {
      groups.set(acKey, {
        acKey,
        source,
        acName: row.resolvedAcName || 'AC Tanpa Nama',
        phone: mergeContacts ? groupPhone : row.resolvedPhone || '',
        cugToko: row.cugToko || '',
        cabang: row.cabang || '',
        region: row.region || '',
        jam: row.jam || '',
        pic: row.pic || '',
        status: sentStatusMap[acKey] || sentStatusMap[acNameKey] || 'belum_dikerjakan',
        rows: [],
      })
    }

    const g = groups.get(acKey)
    // Jika group belum punya nomor valid tapi baris ini punya nomor valid, perbarui nomor
    if (!g.phone && row.resolvedPhone) {
      g.phone = row.resolvedPhone
    }
    if ((!g.cabang || g.cabang === '-') && row.cabang) g.cabang = row.cabang
    if ((!g.region || g.region === '-') && row.region) g.region = row.region
    if ((!g.pic || g.pic === '-') && row.pic) g.pic = row.pic
    if ((!g.jam || g.jam === '-') && row.jam) g.jam = row.jam

    g.rows.push(row)
  })

  // Hitung totalStores, totalShipments, dan slaBreakdown untuk setiap AC group
  groups.forEach((g) => {
    g.sources=[...new Set(g.rows.map(row=>row.source).filter(Boolean))].sort((a,b)=>sourcePriority(a)-sourcePriority(b))
    if(mergeContacts) {g.source=g.sources.length>1?'MIXED':g.sources[0]||'';g.rows.sort((a,b)=>sourcePriority(a.source)-sourcePriority(b.source))}
    g.totalShipments = g.rows.length
    const uniqueStores = new Set(g.rows.map((r) => r.kodeToko).filter(Boolean))
    g.totalStores = uniqueStores.size || (g.rows.length > 0 ? 1 : 0)
    g.storesList = [...new Map(g.rows.map(row => [row.kodeToko, `${row.kodeToko} - ${row.namaToko || ''}`])).values()]

    const breakdown = {}
    g.rows.forEach((r) => {
      const sla = r.sla || 'Lainnya'
      breakdown[sla] = (breakdown[sla] || 0) + 1
    })
    g.slaBreakdown = breakdown
  })

  return Array.from(groups.values()).sort((a, b) => sourcePriority(a.source) - sourcePriority(b.source))
}
