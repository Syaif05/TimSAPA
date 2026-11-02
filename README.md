# TimSAPA

Dashboard monitoring REG dan DS, profil PIC bersama, serta draf WhatsApp dan lampiran tabel.

## Menjalankan lokal

Gunakan Node.js 24. Jalankan `npm ci`, salin `.env.example` ke `.env.local` pada checkout baru, lengkapi konfigurasi server, lalu jalankan `npm run dev`.

Halaman utama: `http://localhost:5173/`. Halaman pengelola: `/admin`, terpisah dari navbar PIC.

## Perilaku aplikasi

- Monitoring menyediakan pilihan **Antrean** dan **Spreadsheet**. Mode Spreadsheet memiliki tombol **Atur kolom** untuk menampilkan atau menyembunyikan kolom A–V; pengaturan awal menyembunyikan K–M dan pilihan disimpan per PIC di browser. Urutan awal adalah Kode Toko → Nama AC → PIC (A–Z). Setiap kolom yang tampil memiliki filter nilai dan urutan, termasuk untuk menyembunyikan DONE. Tabel memiliki header tetap, navigasi sel, salin TSV sesuai kolom tampil, pagination, dan akses pesan/lampiran untuk pesanan aktif.
- PIC memilih nama tanpa akun pribadi. Preferensi template, tema, dan desain lampiran disimpan bersama per PIC di Supabase.
- REG dan DS mengikuti tab tanggal Asia/Jakarta. Antrean mendahulukan DS. Pesanan DONE dapat dilihat melalui filter mode Spreadsheet, tetapi tidak masuk antrean, pesan, atau gambar.
- Akun Google pengelola dapat dihubungkan oleh super admin untuk membaca sumber melalui Sheets API. Status dan Kendala dapat diubah sesuai pengaturan admin.
- Login admin menggunakan Google OIDC, PKCE, state sekali pakai, nonce, cookie HttpOnly, dan daftar email tepercaya di server.
- Pilihan PIC bukan autentikasi pribadi. Ketika edit PIC aktif, pengguna situs dapat memilih PIC terdaftar dan mengubah kolom yang diizinkan. Audit mencatat PIC yang dipilih.
- Pesan WhatsApp tetap dikirim manual. Gambar tabel dibuat di browser.
- Menu **Tarik Data** menerima CSV mentah dari Data Studio, memisahkan REG dan DS menurut awalan nama toko `DS`, menyusun 11 kolom sesuai contoh `TarikData/Hasil_Narik_Data.xlsx`, dan menyediakan salin tabel ke spreadsheet. No AC dan No AM dicocokkan dari sumber kontak SAPA; yang tidak ditemukan dibiarkan kosong untuk diperiksa. Tabel dan clipboard HTML memakai Calibri 11 pt.
- Tombol **Buka chat** segera meminta ekstensi memakai tab WhatsApp Web yang sudah terbuka; pembuatan PNG tidak menahan pembukaan chat. Jika clipboard gagal, pengguna dapat menyalin atau mengunduh gambar secara terpisah.

## Deployment Vercel

Deploy seluruh repository agar endpoint Node dalam `api/` ikut berjalan. `vercel.json` mengatur build Vite dan rewrite `/admin`.

Masukkan variabel server dari `.env.example` ke Environment Variables produksi Vercel. Simpan Google client secret, service_role key Supabase, dan kunci enkripsi sebagai Secret. `APP_ORIGIN` harus sama dengan domain produksi HTTPS. Jangan memasukkan secret ke Git, public assets, atau variabel `VITE_*`.

Tambahkan `${APP_ORIGIN}/api/auth/callback` sebagai Authorized redirect URI pada OAuth Client Google Cloud yang dipakai. [Tutorial lengkap](docs/GOOGLE-CLOUD-SETUP.md).

Schema additive tersedia pada `supabase/schema/`. Proyek Supabase yang sudah dikonfigurasi tidak perlu di-reset. File cache, environment lokal, screenshot pengujian, dan aplikasi desktop tidak diunggah ke repository.

## Gunakan tab WhatsApp yang sudah terbuka

1. Unduh [paket ekstensi ZIP](releases/SAPA-WhatsApp-v1.3.0.zip), lalu ekstrak; atau clone repository ini.
2. Buka Extensions Chrome/Edge, aktifkan Developer mode, lalu Load unpacked folder `extensions/sapa-whatsapp-tab`.
3. Jika ekstensi sebelumnya sudah terpasang, klik Reload setelah memperbarui file.
4. Buka WhatsApp Web dalam browser dan profil yang sama. Ekstensi mendukung localhost dan domain produksi `https://timsapa.vercel.app`.

Jika tidak ada tab WhatsApp, aplikasi meminta pengguna membukanya. Ekstensi tidak membuat tab WhatsApp baru secara otomatis.
Klik ikon ekstensi **SAPA • Gunakan Tab WhatsApp** untuk melihat status tab SAPA dan WhatsApp Web. Setelah memperbarui ekstensi lokal, klik **Reload** di halaman Extensions dan muat ulang SAPA agar popup status dan penghubung baru aktif.

[Panduan distribusi dan publikasi Chrome Web Store](docs/CHROME-EXTENSION-PUBLISHING.md).

## Verifikasi

`npm test` menjalankan pengujian parser, status DONE, rekap PIC, preferensi, OAuth/admin, API, dan penggunaan ulang tab WhatsApp. `npm run build` menghasilkan frontend dan tutorial. OAuth Google asli tetap memerlukan konfigurasi serta persetujuan pemilik akun.

Data contoh di source bersifat fiktif. Data operasional dibaca dari sumber yang dikonfigurasi pada server, bukan disimpan dalam Git.
