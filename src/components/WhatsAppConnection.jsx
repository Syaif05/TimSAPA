import React, { useEffect, useState } from 'react'
import { RefreshCw, MessageCircle } from 'lucide-react'
import { InfoButton } from './InfoButton'
import { requestWhatsAppTab } from '../utils/whatsappBridge'
export function WhatsAppConnection({ compact = false }) {
  const [state, setState] = useState('checking')
  const check = async () => {
    setState('checking')
    const result = await requestWhatsAppTab('SAPA_WA_PING', undefined, 1200)
    setState(result.ok ? 'connected' : 'disconnected')
  }
  useEffect(() => { check() }, [])
  const label = state === 'connected' ? 'WA terhubung' : state === 'checking' ? 'Memeriksa WA' : 'WA belum terhubung'
  return <div className={`connection-status ${compact ? 'connection-status-compact' : ''}`} title={label}>
    <span className={`status-dot ${state === 'connected' ? 'connected' : ''}`} />
    <span className={compact ? 'sr-only' : undefined}>{label}</span>
    <InfoButton title={compact ? label : "Hubungkan WhatsApp Web"} icon={compact ? MessageCircle : undefined}>
      <p>Tombol chat menggunakan tab WA yang sudah terbuka. Pesan terisi sebagai draf; tekan Kirim di WhatsApp.</p>
      <ol className="list-decimal pl-5 space-y-2">
        <li>Di Chrome / Edge, buka Extensions dan aktifkan Developer mode.</li>
        <li>Pilih Load unpacked, lalu folder <code className="break-all text-xs">ChatOtoV1/extensions/sapa-whatsapp-tab</code>.</li>
        <li>Muat ulang SAPA dan login WhatsApp Web di browser serta profil yang sama.</li>
      </ol>
      <p>Tanpa ekstensi, salin pesan dan gambar lalu pindah ke tab WA secara manual.</p>
      <button onClick={check} disabled={state === 'checking'} className="secondary-button"><RefreshCw size={14} />{state === 'checking' ? 'Memeriksa…' : 'Periksa koneksi'}</button>
      <p className="text-xs">{state === 'connected' ? 'Penghubung aktif.' : 'Penghubung belum aktif.'} Berlaku untuk SAPA lokal port 5173 / 4173.</p>
    </InfoButton>
  </div>
}
