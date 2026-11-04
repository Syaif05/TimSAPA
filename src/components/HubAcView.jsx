import React, { useMemo, useState } from 'react'
import { Copy, Download, MessageCircle, Search } from 'lucide-react'
import { buildAcDirectory, contactArea, filterAcContacts } from '../utils/acDirectory'
import { createWhatsAppWebUrl, formatPhoneDisplay } from '../utils/phoneUtils'
import { requestWhatsAppTab, EXTENSION_STORE_URL } from '../utils/whatsappBridge'
import { usePicProfile } from '../profiles/ProfileContext'
import { EQUIPMENT_ANNOUNCEMENT, ANNOUNCEMENT_FIELDS, renderAcAnnouncement } from '../utils/acAnnouncement'
import { WhatsAppConnection } from './WhatsAppConnection'

export function HubAcView({ contacts = [], ready, showToast }) {
  const { storage } = usePicProfile()
  const [search, setSearch] = useState('')
  const [regional, setRegional] = useState('')
  const [cabang, setCabang] = useState('')
  const [extraFilters, setExtraFilters] = useState({})
  const [phoneFilter, setPhoneFilter] = useState('')
  const [sort, setSort] = useState('regional')
  const [limit, setLimit] = useState(50)
  const [message, setMessage] = useState(() => { try { return storage.getItem('sapa_ac_announcement') ?? EQUIPMENT_ANNOUNCEMENT } catch { return EQUIPMENT_ANNOUNCEMENT } })
  const [previewKey, setPreviewKey] = useState(null)
  const [onlyUnopened, setOnlyUnopened] = useState(false)
  const [opening, setOpening] = useState(null)
  const [opened, setOpened] = useState(new Set())
  const availableFields = useMemo(() => new Set(['regional','cabang','amName','province','city','storeStatus','sapa'].filter(field => contacts.some(contact => String(contact[field] || '').trim()))), [contacts])
  const hasValues = field => availableFields.has(field)
  const directory = useMemo(() => buildAcDirectory(contacts), [contacts])
  const regionals = useMemo(() => [...new Set(contacts.map(c => contactArea(c.regional)))].sort(), [contacts])
  const branches = useMemo(() => [...new Set(filterAcContacts(contacts, { regional }).map(c => contactArea(c.cabang)))].sort(), [contacts, regional])
  const scopedDirectory = useMemo(() => buildAcDirectory(filterAcContacts(contacts, { regional, cabang, ...extraFilters })), [contacts, regional, cabang, extraFilters])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return scopedDirectory.filter(ac => (!onlyUnopened || !opened.has(ac.key)) && (!phoneFilter || (phoneFilter === 'valid' ? !!ac.phone : !ac.phone)) && `${ac.name} ${ac.phone} ${ac.stores.join(' ')} ${ac.regionals.join(' ')} ${ac.branches.join(' ')} ${ac.amNames.join(' ')} ${ac.provinces.join(' ')} ${ac.cities.join(' ')} ${ac.storeNames.join(' ')}`.toLowerCase().includes(query))
      .sort((a, b) => (sort === 'regional' ? a.regionals.join(', ').localeCompare(b.regionals.join(', '), 'id', { numeric: true }) : 0) || (sort === 'za' ? b.name.localeCompare(a.name, 'id') : a.name.localeCompare(b.name, 'id')))
  }, [scopedDirectory, search, phoneFilter, sort, onlyUnopened, opened])
  const previewAc = filtered.find(ac => ac.key === previewKey) || filtered[0]
  const previewMessage = renderAcAnnouncement(message, previewAc)
  const updateMessage = value => {
    setMessage(value)
    try { storage.setItem('sapa_ac_announcement', value) } catch {}
  }
  const openChat = async ac => {
    setOpening(ac.key)
    try {
      const result = await requestWhatsAppTab('SAPA_WA_OPEN', createWhatsAppWebUrl(ac.phone, renderAcAnnouncement(message, ac)))
      if (!result.ok) throw new Error(result.error || 'WhatsApp belum terhubung.')
      setOpened(previous => new Set([...previous, ac.key]))
      showToast('Draf dibuka. Tekan Kirim di WhatsApp.', 'success')
    } catch (error) { showToast(error.message, 'error') }
    finally { setOpening(null) }
  }
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(previewMessage); showToast('Pengumuman disalin.', 'success') }
    catch { showToast('Tidak dapat menyalin. Pilih teks pengumuman lalu salin manual.', 'error') }
  }
  return <section className="hub-ac">
    <div className="hub-ac-intro"><div><h3>Hubungi AC</h3><p>Cari kontak AC dan siapkan pengumuman untuk tim. Kontak mengikuti database kontak website.</p></div><a className="secondary-button" href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer"><Download size={16}/>Download Extension</a></div>
    <WhatsAppConnection/>
    {!hasValues('regional') && <p>Sumber kontak: struktur November. Cari berdasarkan AC, AM, nomor, nama atau kode toko.</p>}
    <div className="hub-ac-compose">
      <div className="hub-ac-intro"><label htmlFor="ac-announcement">Template pengumuman</label><button className="secondary-button" onClick={() => updateMessage(EQUIPMENT_ANNOUNCEMENT)}>Gunakan template equipment SAPA</button></div>
      <textarea id="ac-announcement" rows={11} value={message} onChange={e => updateMessage(e.target.value)} placeholder="Tulis pengumuman untuk AC di sini…"/>
      <p>Personalisasi otomatis: {ANNOUNCEMENT_FIELDS.map(field => `{${field}}`).join(' · ')}</p>
      <p>Jumlah dan kode toko mengikuti filter daftar saat ini. Periksa wilayah dan tenggat sebelum mengirim.</p>
      <div className="hub-ac-intro"><p>Pesan relevan dan personal tetap dapat terkena pembatasan. Kirim kepada rekan yang mengharapkan pengumuman ini; hindari pengiriman beruntun dan hentikan jika penerima keberatan.</p></div>
      <div className="hub-ac-compose" style={{ marginTop: 12 }}><strong>Pratinjau: {previewAc?.name || 'pilih kontak pada daftar'}</strong><pre style={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', font: 'inherit', margin: '12px 0' }}>{previewMessage || 'Tidak ada kontak yang cocok.'}</pre><button className="secondary-button" disabled={!previewMessage.trim()} onClick={copyMessage}><Copy size={15}/>Salin pesan untuk AC ini</button></div>
      <p>Draf tersimpan untuk PIC ini. Setiap tombol Buka chat mengisi pesan sesuai AC yang dipilih. Tekan Kirim secara manual di WhatsApp.</p>
    </div>
    <label className="hub-ac-search"><Search size={18}/><span className="sr-only">Cari AC, AM, nomor, nama/kode toko atau wilayah</span><input value={search} onChange={e => { setSearch(e.target.value); setLimit(50) }} placeholder="Cari AC, AM, nomor, nama/kode toko atau wilayah…"/></label>
    <div className="hub-ac-filters">
      {hasValues('regional') && <label>Regional<select value={regional} onChange={e => { setRegional(e.target.value); setCabang(''); setExtraFilters({}); setLimit(50) }}><option value="">Semua Regional</option>{regionals.map(value => <option key={value}>{value}</option>)}</select></label>}
      {hasValues('cabang') && <label>Cabang<select value={cabang} onChange={e => { setCabang(e.target.value); setExtraFilters({}); setLimit(50) }}><option value="">Semua Cabang</option>{branches.map(value => <option key={value}>{value}</option>)}</select></label>}
      {[['amName', 'AM'], ['province', 'Provinsi'], ['city', 'Kota'], ['storeStatus', 'Status toko'], ['sapa', 'Layanan SAPA']].filter(([field]) => hasValues(field)).map(([field, label]) => <label key={field}>{label}<select value={extraFilters[field] || ''} onChange={e => { setExtraFilters(previous => ({ ...previous, [field]: e.target.value })); setLimit(50) }}><option value="">Semua {label}</option>{[...new Set(filterAcContacts(contacts, { regional, cabang }).map(c => contactArea(c[field])))].sort().map(value => <option key={value}>{value}</option>)}</select></label>)}
      <label>Nomor WhatsApp<select value={phoneFilter} onChange={e => { setPhoneFilter(e.target.value); setLimit(50) }}><option value="">Semua nomor</option><option value="valid">Nomor valid</option><option value="missing">Tanpa nomor valid</option></select></label>
      <label>Urutan<select value={sort} onChange={e => { setSort(e.target.value); setLimit(50) }}><option value="regional">Regional, lalu nama A–Z</option><option value="az">Nama A–Z</option><option value="za">Nama Z–A</option></select></label>
      <button className="secondary-button" onClick={() => { setRegional(''); setCabang(''); setExtraFilters({}); setPhoneFilter(''); setSort('regional'); setOnlyUnopened(false); setSearch(''); setLimit(50) }}>Reset filter</button>
    </div>
    <label><input type="checkbox" checked={onlyUnopened} onChange={e => { setOnlyUnopened(e.target.checked); setLimit(50) }}/> Tampilkan hanya kontak yang drafnya belum dibuka pada sesi ini</label>
    <p role="status">{!ready && !directory.length ? 'Memuat kontak…' : `${filtered.length} dari ${directory.length} kontak • ${filtered.filter(ac => !ac.phone).length} tanpa nomor valid`}</p>
    {ready && !directory.length && <p>Kontak AC belum tersedia. Perbarui sumber kontak melalui admin.</p>}
    {!!directory.length && !filtered.length && <p>Tidak ada kontak yang cocok dengan pencarian.</p>}
    <div className="hub-ac-list">{filtered.slice(0, limit).map(ac => <article className="hub-ac-contact" key={ac.key}><div><strong>{ac.name}</strong>{(hasValues('regional') || hasValues('cabang')) && <p>{hasValues('regional') && `Regional: ${ac.regionals.join(', ')}`}{hasValues('cabang') && ` Cabang: ${ac.branches.join(', ')}`}</p>}<p>AM: {ac.amNames.join(', ')}{hasValues('province') && ` · Provinsi: ${ac.provinces.join(', ')}`}</p><p>{ac.phone ? formatPhoneDisplay(ac.phone) : 'Nomor belum tersedia'} · {ac.stores.length} toko</p>{opened.has(ac.key) && <small>Draf pernah dibuka pada sesi ini</small>}</div><div className="hub-ac-intro"><button className="secondary-button" onClick={() => setPreviewKey(ac.key)}>Pratinjau pesan</button><button className="secondary-button" disabled={!ac.phone || !message.trim() || opening !== null} onClick={() => openChat(ac)} aria-label={`Buka chat ${ac.name} ${ac.phone}`}><MessageCircle size={16}/>{opening === ac.key ? 'Membuka…' : opened.has(ac.key) ? 'Buka ulang draf' : 'Buka chat'}</button></div></article>)}</div>
    {filtered.length > limit && <button className="secondary-button" onClick={() => setLimit(value => value + 50)}>Tampilkan lebih banyak ({filtered.length - limit})</button>}
  </section>
}
