# Distribusi ekstensi SAPA WhatsApp

## Untuk tim sebelum tersedia di Chrome Web Store

1. Unduh `releases/SAPA-WhatsApp-v1.3.0.zip`, lalu ekstrak ke folder tetap.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, pilih **Load unpacked**, lalu pilih folder hasil ekstrak yang berisi `manifest.json`.
3. Buka SAPA dan WhatsApp Web pada profil Chrome yang sama. Klik ikon ekstensi untuk melihat statusnya.
4. Untuk versi berikutnya, ganti isi folder dengan versi baru, klik **Reload** pada kartu ekstensi, lalu muat ulang SAPA. Jangan hapus folder yang sedang dipakai Chrome.

ZIP ini adalah paket untuk diunggah ke Chrome Web Store atau diekstrak untuk Load unpacked. Chrome tidak memasang ZIP ini langsung dengan satu klik.

## Publikasi Chrome Web Store

1. Daftarkan akun di [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole), aktifkan verifikasi dua langkah, dan bayar biaya pendaftaran satu kali bila belum terdaftar.
2. Pilih **Add new item**, unggah ZIP. `manifest.json` sudah berada di root ZIP dan ikon 128×128 sudah disertakan.
3. Isi Store listing: deskripsi, kategori, bahasa, ikon, dan setidaknya satu screenshot aktual ekstensi berukuran 1280×800 atau 640×400.
4. Isi Privacy practices secara akurat. Ekstensi menangani nomor dan teks draf WhatsApp dari SAPA untuk mengarahkan tab WhatsApp Web yang sudah terbuka. Ekstensi tidak menyimpan draf atau mengirimnya ke server pembuat ekstensi. Pesan tetap dikirim manual oleh pengguna di WhatsApp. Siapkan kebijakan privasi publik yang menjelaskan alur ini sebelum submit.
5. Untuk tim, pilih **Unlisted** jika siapa pun yang memiliki tautan boleh memasang, atau **Private** jika hanya tester tertentu yang boleh memasang. Ketiganya, termasuk Public, tetap melalui review Google.
6. Kirim untuk review. Setelah disetujui, bagikan tautan Chrome Web Store ke tim; pembaruan versi berikutnya diunggah sebagai ZIP baru dengan nomor versi lebih tinggi.

### Teks listing yang dapat dipakai

**Nama:** SAPA • Gunakan Tab WhatsApp

**Deskripsi singkat:** Membuka draf dari SAPA di tab WhatsApp Web yang sudah terbuka tanpa membuat tab baru. Pengiriman pesan tetap manual.

**Tujuan tunggal:** Menghubungkan tombol Buka chat SAPA ke tab WhatsApp Web yang sudah dibuka pengguna, serta menampilkan status koneksi kedua tab.

**Alasan izin:** Akses `web.whatsapp.com` dipakai untuk menemukan dan memfokuskan tab yang sudah ada. Content script pada `timsapa.vercel.app` dan localhost dipakai untuk menerima permintaan pengguna dari SAPA. Ekstensi tidak membaca isi percakapan WhatsApp.
