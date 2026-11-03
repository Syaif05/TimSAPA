import React, { useMemo, useState } from 'react'
import { Copy, Download, MessageCircle, Search } from 'lucide-react'
import { buildAcDirectory } from '../utils/acDirectory'
import { createWhatsAppWebUrl, formatPhoneDisplay } from '../utils/phoneUtils'
import { requestWhatsAppTab, EXTENSION_STORE_URL } from '../utils/whatsappBridge'
import { usePicProfile } from '../profiles/ProfileContext'
import { WhatsAppConnection } from './WhatsAppConnection'

export function HubAcView({ contacts = [], ready, showToast }) {
  const { storage } = usePicProfile()
  const [search, setSearch] = useState('')
  const [limit, setLimit] = useState(50)
  const [message, setMessage] = useState(() => { try { return storage.getItem('sapa_ac_announcement') || '' } catch { return '' } })
  const [opening, setOpening] = useState(null)
  const [opened, setOpened] = useState(new Set())
  const directory = useMemo(() => buildAcDirectory(contacts), [contacts])
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return directory.filter(ac => `${ac.name} ${ac.phone} ${ac.stores.join(' ')}`.toLowerCase().includes(query))
  }, [directory, search])
  const updateMessage = value => {
    setMessage(value)
    try { storage.setItem('sapa_ac_announcement', value) } catch {}
  }
  const openChat = async ac => {
    setOpening(ac.key)
    try {
      const result = await requestWhatsAppTab('SAPA_WA_OPEN', createWhatsAppWebUrl(ac.phone, message))
      if (!result.ok) throw new Error(result.error || 'WhatsApp belum terhubung.')
      setOpened(previous => new Set([...previous, ac.key]))
      showToast('Draf dibuka. Tekan Kirim di WhatsApp.', 'success')
    } catch (error) { showToast(error.message, 'error') }
    finally { setOpening(null) }
  }
  const copyMessage = async () => {
    try { await navigator.clipboard.writeText(message); showToast('Pengumuman disalin.', 'success') }
    catch { showToast('Tidak dapat menyalin. Pilih teks pengumuman lalu salin manual.', 'error') }
  }
  return <section className="hub-ac">
    <div className="hub-ac-intro"><div><h3>Hubungi AC</h3><p>Cari kontak AC dan siapkan pengumuman untuk tim. Kontak mengikuti database kontak website.</p></div><a className="secondary-button" href={EXTENSION_STORE_URL} target="_blank" rel="noopener noreferrer"><Download size={16}/>Download Extension</a></div>
    <WhatsAppConnection/>
    <div className="hub-ac-compose"><label htmlFor="ac-announcement">Draf pengumuman</label><textarea id="ac-announcement" rows={5} value={message} onChange={e => updateMessage(e.target.value)} placeholder="Tulis pengumuman untuk AC di sini…"/><div className="hub-ac-intro"><p>Draf tersimpan untuk PIC ini. Buka chat satu per satu, lalu kirim manual di WhatsApp.</p><button className="secondary-button" disabled={!message.trim()} onClick={copyMessage}><Copy size={15}/>Salin pengumuman</button></div></div>
    <label className="hub-ac-search"><Search size={18}/><span className="sr-only">Cari nama AC, nomor, atau kode toko</span><input value={search} onChange={e => { setSearch(e.target.value); setLimit(50) }} placeholder="Cari nama AC, nomor, atau kode toko…"/></label>
    <p role="status">{!ready && !directory.length ? 'Memuat kontak…' : `${filtered.length} kontak • ${directory.filter(ac => !ac.phone).length} tanpa nomor valid`}</p>
    {ready && !directory.length && <p>Kontak AC belum tersedia. Perbarui sumber kontak melalui admin.</p>}
    {!!directory.length && !filtered.length && <p>Tidak ada kontak yang cocok dengan pencarian.</p>}
    <div className="hub-ac-list">{filtered.slice(0, limit).map(ac => <article className="hub-ac-contact" key={ac.key}><div><strong>{ac.name}</strong><p>{ac.phone ? formatPhoneDisplay(ac.phone) : 'Nomor belum tersedia'} · {ac.stores.length} toko</p>{opened.has(ac.key) && <small>Draf pernah dibuka pada sesi ini</small>}</div><button className="secondary-button" disabled={!ac.phone || opening !== null} onClick={() => openChat(ac)} aria-label={`Buka chat ${ac.name} ${ac.phone}`}><MessageCircle size={16}/>{opening === ac.key ? 'Membuka…' : 'Buka chat'}</button></article>)}</div>
    {filtered.length > limit && <button className="secondary-button" onClick={() => setLimit(value => value + 50)}>Tampilkan lebih banyak ({filtered.length - limit})</button>}
  </section>
}
