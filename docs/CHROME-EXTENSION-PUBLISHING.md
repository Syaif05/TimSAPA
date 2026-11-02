# Distribusi ekstensi SAPA WhatsApp

## Untuk tim sebelum tersedia di Chrome Web Store

1. Unduh `releases/SAPA-WhatsApp-v1.4.0.zip`, lalu ekstrak ke folder tetap.
2. Buka `chrome://extensions`, aktifkan **Developer mode**, pilih **Load unpacked**, lalu pilih folder hasil ekstrak yang berisi `manifest.json`.
3. Buka SAPA dan WhatsApp Web pada profil Chrome yang sama. Klik ikon ekstensi untuk melihat status dan menyambungkan ulang tab SAPA bila perlu.
4. Untuk versi berikutnya, ganti isi folder dengan versi baru, klik **Reload** pada kartu ekstensi, lalu muat ulang SAPA. Jangan hapus folder yang sedang dipakai Chrome.

ZIP ini adalah paket untuk diunggah ke Chrome Web Store atau diekstrak untuk Load unpacked. Chrome tidak memasang ZIP ini langsung dengan satu klik.

## Publikasi Chrome Web Store

1. Masuk dengan akun Google yang sudah membayar biaya pendaftaran di [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/devconsole). Selesaikan verifikasi akun serta email kontak pengembang yang diminta dashboard.
2. Pilih **Add new item** → unggah [SAPA-WhatsApp-v1.4.0.zip](../releases/SAPA-WhatsApp-v1.4.0.zip). Jika item lama sudah dibuat, unggah sebagai versi baru pada item yang sama. Jangan ekstrak ZIP untuk upload. `manifest.json` sudah berada di root ZIP.
3. Di **Store listing**, isi nama dan deskripsi di bawah, bahasa **Indonesia**, kategori **Productivity**, ikon dari [icon-128.png](../extensions/sapa-whatsapp-tab/icons/icon-128.png), dan [screenshot UI extension 640×400](../releases/SAPA-WhatsApp-store-screenshot-640x400.png). Screenshot ini memperlihatkan kondisi belum terhubung; bila memungkinkan, ganti atau tambahkan screenshot asli saat SAPA dan WhatsApp Web sudah terbuka untuk menunjukkan kondisi siap.
4. Di **Privacy practices**, masukkan URL **https://github.com/Syaif05/TimSAPA/blob/main/docs/EXTENSION-PRIVACY.md** pada kolom **URL kebijakan privasi**. Halaman GitHub ini publik dan tidak bergantung pada pengaturan login Vercel. Halaman dengan isi setara juga tersedia di `https://timsapa.vercel.app/privasi-ekstensi.html` bila domain produksi dapat diakses tanpa login. Isi tujuan tunggal dan alasan izin dengan teks di bawah. Tandai penggunaan data secara jujur: nomor tujuan termasuk informasi identitas pribadi; teks draf dapat termasuk komunikasi pribadi; URL/tab yang diperiksa termasuk aktivitas web. Data ini hanya diproses untuk fitur yang diminta, tanpa server atau analitik ekstensi. Jangan memilih “tidak ada data” jika formulir menanyakan data yang *ditangani* ekstensi, bukan hanya data yang disimpan.
5. Di **Distribution**, pilih **Unlisted** untuk tim: siapa pun yang menerima link Store dapat memasang, tetapi item tidak tampil dalam pencarian umum. Gunakan **Private** hanya jika semua akun pemasang ditambahkan sebagai trusted testers. Semua pilihan tetap ditinjau Google.
6. Di **Test instructions**, jelaskan cara menguji di bawah. Jika reviewer perlu akun SAPA yang tidak bisa diakses publik, sediakan akun uji melalui kolom resmi dashboard, jangan masukkan kredensial pribadi ke deskripsi publik.
7. Klik **Submit for review**. Setelah disetujui dan terbit, salin tautan Store untuk tim. Untuk pembaruan berikutnya, naikkan versi `manifest.json`, buat ZIP baru dengan `python3 scripts/package-extension.py`, lalu unggah di item Store yang sama. Chrome mengelola pembaruan instalasi Store.

### Teks listing yang dapat dipakai

**Nama:** SAPA • Gunakan Tab WhatsApp

**Deskripsi singkat:** Membuka draf dari SAPA di tab WhatsApp Web yang sudah terbuka tanpa membuat tab baru. Pengiriman pesan tetap manual.

**Tujuan tunggal:** Menghubungkan tombol Buka chat SAPA ke tab WhatsApp Web yang sudah dibuka pengguna, serta menampilkan status koneksi kedua tab.

**Alasan izin:** Akses `web.whatsapp.com` dipakai untuk menemukan dan memfokuskan tab yang sudah ada. Akses `timsapa.vercel.app` dan localhost serta izin `scripting` dipakai untuk memasang ulang penghubung di tab SAPA yang sudah terbuka saat ekstensi dipasang atau diperbarui. Ekstensi tidak membaca isi percakapan WhatsApp.

**Instruksi pengujian untuk reviewer:** Buka `https://timsapa.vercel.app/` dan `https://web.whatsapp.com/` pada profil Chrome yang sama, lalu klik ikon ekstensi. Popup menunjukkan status tab SAPA dan WhatsApp Web. Di SAPA, pilih profil PIC, buka pesanan yang memiliki nomor tujuan, dan tekan **Buka chat**. Ekstensi mengarahkan tab WhatsApp Web yang sudah ada ke draf nomor tersebut. Pesan tidak dikirim otomatis. Bila akses data SAPA membutuhkan akun, gunakan kredensial uji yang diberikan secara privat di dashboard.

**URL kebijakan privasi yang direkomendasikan:** `https://github.com/Syaif05/TimSAPA/blob/main/docs/EXTENSION-PRIVACY.md` (sumber: [`docs/EXTENSION-PRIVACY.md`](EXTENSION-PRIVACY.md)).

**Kontak dukungan:** Gunakan halaman Issues proyek atau alamat dukungan tim yang aktif. Pastikan informasi kontak publisher di dashboard sesuai dengan pihak yang akan menanggapi pengguna.
