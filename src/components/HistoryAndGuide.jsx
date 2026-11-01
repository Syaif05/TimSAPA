import React from 'react'
import { Cloud, ListFilter, MessageCircle, Clipboard, Users, Combine } from 'lucide-react'
export function HistoryAndGuide() {
  const steps = [
    [Cloud, '01', 'Pilih sumber', 'REG + DS mengikuti tab harian. Pilih PIC, sumber, dan status pesanan. SYAIFUL dan Belum Done menjadi pilihan awal.'],
    [Users, '02', 'Periksa AC', 'Pilih AC dari antrean. Nama serta nomor AC dicocokkan dengan Store pada spreadsheet kontak. Ikon kontak menampilkan waktu pembacaan dan tautan sumber.'],
    [MessageCircle, '03', 'Buka chat', 'Periksa draf, lalu klik Buka chat. Penghubung browser memakai tab WhatsApp yang sudah terbuka. Pesan tetap dikirim manual.'],
    [Clipboard, '04', 'Tempel lampiran', 'Gambar tabel disalin otomatis. Tempel dengan Cmd/Ctrl + V di WhatsApp. Jika gagal, kembali dan gunakan Salin gambar atau unduh PNG.'],
  ]
  return <div className="guide-content">
    <div className="guide-steps">{steps.map(([Icon, number, title, text]) => <section key={number} className="guide-step"><div className="flex items-center justify-between"><Icon size={20} strokeWidth={1.5}/><span>{number}</span></div><h3>{title}</h3><p>{text}</p></section>)}</div>
    <section className="guide-note"><ListFilter size={18}/><div><h3>Status sheet dan chat</h3><p>Status pesanan dari spreadsheet hanya dibaca. Status chat dicatat lokal per tanggal. Membuka chat bukan bukti pesan telah dikirim.</p></div></section>
    <section className="guide-note"><Combine size={18}/><div><h3>Shipment dan data manual</h3><p>Gunakan tombol Shipment di Monitoring untuk menggabungkan nomor pesanan. Input data membuka mode manual; data manual dan arsip tetap terpisah dari sumber live.</p></div></section>
    <section className="guide-note"><Cloud size={18}/><div><h3>Ketika koneksi terputus</h3><p>Data monitoring dicek tiap 30 detik saat halaman terlihat. Kontak dibaca ulang berkala dan salinan terakhir disimpan lokal. Periksa ikon sumber jika ada peringatan. Jika tab hari baru belum ada, aplikasi tidak menggantinya dengan data demo.</p></div></section>
  </div>
}
