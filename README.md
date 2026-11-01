# TimSAPA

Dashboard monitoring REG dan DS, profil PIC bersama, serta draf WhatsApp dan lampiran tabel.

## Menjalankan lokal

Gunakan Node.js 24. Jalankan `npm ci`, salin `.env.example` ke `.env.local` pada checkout baru, lengkapi konfigurasi server, lalu jalankan `npm run dev`.

Halaman utama: `http://localhost:5173/`. Halaman pengelola: `/admin`, terpisah dari navbar PIC.

## Perilaku aplikasi

- Monitoring menyediakan pilihan **Antrean** dan **Spreadsheet**. Mode Spreadsheet mengikuti kolom A–V sumber, memiliki header tetap, navigasi sel, salin TSV, pagination, serta akses pesan/lampiran. Pilihan tampilan diingat per PIC pada browser ini.
- PIC memilih nama tanpa akun pribadi. Preferensi template, tema, dan desain lampiran disimpan bersama per PIC di Supabase.
- REG dan DS mengikuti tab tanggal Asia/Jakarta. DS tampil lebih dahulu. Pesanan DONE hanya dihitung dalam rekap dan tidak masuk antrean, pesan, atau gambar.
- Akun Google pengelola dapat dihubungkan oleh super admin untuk membaca sumber melalui Sheets API. Status dan Kendala dapat diubah sesuai pengaturan admin.
- Login admin menggunakan Google OIDC, PKCE, state sekali pakai, nonce, cookie HttpOnly, dan daftar email tepercaya di server.
- Pilihan PIC bukan autentikasi pribadi. Ketika edit PIC aktif, pengguna situs dapat memilih PIC terdaftar dan mengubah kolom yang diizinkan. Audit mencatat PIC yang dipilih.
- Pesan WhatsApp tetap dikirim manual. Gambar tabel dibuat di browser.

## Deployment Vercel

Deploy seluruh repository agar endpoint Node dalam `api/` ikut berjalan. `vercel.json` mengatur build Vite dan rewrite `/admin`.

Masukkan variabel server dari `.env.example` ke Environment Variables produksi Vercel. Simpan Google client secret, service_role key Supabase, dan kunci enkripsi sebagai Secret. `APP_ORIGIN` harus sama dengan domain produksi HTTPS. Jangan memasukkan secret ke Git, public assets, atau variabel `VITE_*`.

Tambahkan `${APP_ORIGIN}/api/auth/callback` sebagai Authorized redirect URI pada OAuth Client Google Cloud yang dipakai. [Tutorial lengkap](docs/GOOGLE-CLOUD-SETUP.md).

Schema additive tersedia pada `supabase/schema/`. Proyek Supabase yang sudah dikonfigurasi tidak perlu di-reset. File cache, environment lokal, screenshot pengujian, dan aplikasi desktop tidak diunggah ke repository.

## Gunakan tab WhatsApp yang sudah terbuka

1. Unduh/clone repository ini.
2. Buka Extensions Chrome/Edge, aktifkan Developer mode, lalu Load unpacked folder `extensions/sapa-whatsapp-tab`.
3. Jika ekstensi sebelumnya sudah terpasang, klik Reload setelah memperbarui file.
4. Buka WhatsApp Web dalam browser dan profil yang sama. Ekstensi mendukung localhost dan domain produksi `https://timsapa.vercel.app`.

Jika tidak ada tab WhatsApp, aplikasi meminta pengguna membukanya. Ekstensi tidak membuat tab WhatsApp baru secara otomatis.

## Verifikasi

`npm test` menjalankan pengujian parser, status DONE, rekap PIC, preferensi, OAuth/admin, API, dan penggunaan ulang tab WhatsApp. `npm run build` menghasilkan frontend dan tutorial. OAuth Google asli tetap memerlukan konfigurasi serta persetujuan pemilik akun.

Data contoh di source bersifat fiktif. Data operasional dibaca dari sumber yang dikonfigurasi pada server, bukan disimpan dalam Git.
