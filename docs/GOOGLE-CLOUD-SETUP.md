# Menghubungkan SAPA ke Google Cloud

SAPA memakai satu akun pengelola untuk membaca dan mengubah dua spreadsheet yang sudah ditentukan. PIC tetap memilih nama tanpa login Google. Halaman admin berada di `/admin`, tanpa tombol di navbar. Identitas admin diverifikasi oleh Google dan dibandingkan dengan daftar email di server.

Super admin pertama: **syaifullohrohmat05@gmail.com**.

## 1. Aktifkan Google Sheets API

1. Buka [Google Cloud Console](https://console.cloud.google.com/) dengan akun pengelola.
2. Pilih proyek **TimSAPA**, Project ID **timsapa**, seperti pada tangkapan layar Anda.
3. Buka **APIs & Services → Library**.
4. Cari **Google Sheets API**, lalu pilih **Enable**. Jika sudah aktif, tidak perlu mengaktifkan ulang.

Tidak perlu membuat service account atau memberi akses seluruh Google Drive untuk alur ini.

## 2. Atur Google Auth Platform

1. Buka [Google Auth Platform](https://console.cloud.google.com/auth/overview?project=timsapa). Jika muncul **Get started**, lanjutkan penyiapan.
2. Pada **Branding**, isi nama aplikasi **SAPA**, email dukungan, dan email kontak pengembang dengan email Anda. Lengkapi URL aplikasi/kebijakan privasi saat memakai domain produksi.
3. Pada **Audience**, pilih **External** jika memakai akun Gmail pribadi. Dalam mode **Testing**, tambahkan `syaifullohrohmat05@gmail.com` sebagai **Test user**.
4. Pada **Data Access**, tambahkan scope `https://www.googleapis.com/auth/spreadsheets`. Login dasar menggunakan `openid`, `email`, dan `profile`.

Izin spreadsheets mencakup spreadsheet yang dapat diakses akun tersebut. Server SAPA membatasi permintaan ke dua ID file yang sudah dikonfigurasi. Gunakan akun pengelola yang sesuai.

**Untuk pemakaian berkelanjutan:** refresh token aplikasi External yang masih Testing umumnya berakhir setelah 7 hari ketika meminta scope Sheets. Sebelum digunakan banyak orang, lengkapi persyaratan **Publish app / In production** dan verifikasi Google bila diminta. Mode Testing cocok untuk penyiapan awal; menghubungkan OAuth saja tidak menghapus batas ini.

## 3. Buat OAuth Client

1. Buka **Google Auth Platform → Clients → Create client**.
2. Pilih **Web application**, nama misalnya **SAPA Web**.
3. Pada **Authorized redirect URIs**, tambahkan:

   ```text
   http://127.0.0.1:5173/api/auth/callback
   http://localhost:5173/api/auth/callback
   ```

4. Ketika alamat Vercel sudah tersedia, tambahkan alamat persisnya, misalnya:

   ```text
   https://ALAMAT-SAPA-ANDA.vercel.app/api/auth/callback
   ```

   Ganti contoh tersebut dengan alamat sebenarnya. `APP_ORIGIN` dan redirect URI harus cocok, termasuk `localhost` versus `127.0.0.1`, port, dan HTTPS. Jangan memakai URL preview Vercel yang berubah-ubah untuk koneksi utama.

5. Simpan **Client ID** dan **Client secret** ke konfigurasi server pada langkah berikut. Jangan mengirim client secret melalui chat atau memasukkannya ke kode frontend. Alur ini memakai server OAuth; **Authorized JavaScript origins** tidak diperlukan.

## 4. Isi konfigurasi lokal

File `.env.local` telah disiapkan di folder proyek, dengan kunci enkripsi acak lokal dan email admin Anda. Isi Client ID, Client Secret, dan service_role key, kemudian ubah `SAPA_GOOGLE_ENABLED` menjadi `true`. File ini diabaikan Git dan diblokir dari akses file Vite. Pada checkout/perangkat baru yang belum mempunyai file ini, salin `.env.example` menjadi `.env.local` terlebih dahulu.

```dotenv
SAPA_GOOGLE_ENABLED=true
SAPA_CONTACTS_MODE=excel
APP_ORIGIN=http://127.0.0.1:5173
GOOGLE_CLIENT_ID=ISI_CLIENT_ID_DARI_GOOGLE
GOOGLE_CLIENT_SECRET=ISI_CLIENT_SECRET_DARI_GOOGLE
SAPA_SUPER_ADMIN_EMAILS=syaifullohrohmat05@gmail.com
SAPA_TOKEN_ENCRYPTION_KEY=ISI_KUNCI_YANG_DIBUAT_LOKAL
SUPABASE_URL=https://tsbbgeodukscvzixivjf.supabase.co
SUPABASE_SERVICE_ROLE_KEY=ISI_KUNCI_SERVER_SUPABASE
```

Kunci enkripsi lokal sudah dibuat tanpa dicetak ke log/chat. Pertahankan nilai tersebut. Jika menyiapkan checkout baru, buat kunci enkripsi dengan menjalankan ini di Terminal lokal, lalu salin hasilnya ke `SAPA_TOKEN_ENCRYPTION_KEY`:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Ambil kunci server dari **Supabase → TimSAPA → Project Settings → API Keys**. Gunakan kunci **service_role** server yang tersedia di proyek. Kunci ini memberi akses istimewa; simpan hanya sebagai environment variable server, tanpa awalan `VITE_`. Publishable key yang sudah ada di frontend bukan penggantinya.

Pertahankan kunci enkripsi yang sama saat pindah dari lokal ke Vercel jika ingin memakai koneksi Google yang sama. Mengganti kunci mengharuskan akun Google dihubungkan ulang; jangan menghapus kunci lama tanpa rencana rotasi.

Database memerlukan schema additive `supabase/schema/google-connection.sql`. Ini tidak menghapus data PIC atau data lama. Jangan menjalankan `reset-timsapa.sql` untuk penyiapan ini.

## 5. Masuk dan hubungkan akun

1. Jalankan ulang `npm run dev` setelah `.env.local` terisi. Buka `http://127.0.0.1:5173` agar sesuai `APP_ORIGIN`.
2. Buka alamat tersembunyi dari navbar: `http://127.0.0.1:5173/admin`.
3. Pilih **Masuk dengan Google**, lalu gunakan `syaifullohrohmat05@gmail.com`. Akun lain ditolak server walaupun mengetahui URL admin.
4. Setelah masuk, klik **Hubungkan Google Sheets**. Pilih akun yang sama dan berikan izin spreadsheet yang diminta. Login admin dan izin Sheets adalah dua langkah berbeda.
5. Pastikan akun pengelola mempunyai akses **Editor** ke spreadsheet monitoring. File kontak saat ini telah diverifikasi masih **KONTAK PEGAWAI ALFA (OKTOBER).xlsx**. Sementara belum dipindahkan, kontak tetap dibaca dari Excel asli; `SAPA_CONTACTS_MODE=excel` mempertahankan cara ini.
6. Setelah sumber kontak utama dipindahkan ke Google Sheets, buka kolom **Tautan kontak Google Sheets** pada halaman admin, tempel tautan baru, isi nama tab kontak, lalu **Simpan sumber kontak**. Berikan akun pengelola akses ke file baru. Memindahkan sumber utama berarti pembaruan selanjutnya dilakukan di file baru; salinan konversi tidak otomatis mengikuti file Excel lama.
7. Setelah muncul **Google terhubung**, kembali ke Monitoring. Semua PIC memakai koneksi pengelola yang sama.
8. Sakelar **Edit oleh PIC** mengaktifkan/menonaktifkan perubahan Status dan Kendala untuk seluruh PIC. Nilai awal aktif; tombol edit baru muncul sesudah koneksi Google aktif.

Nama PIC tetap merupakan profil bersama tanpa autentikasi pribadi. Karena pilihan Anda mengizinkan siapa saja memakai PIC, siapa saja yang dapat mengakses situs dan memilih PIC dapat mengubah kolom yang diizinkan saat sakelar aktif. Riwayat mencatat PIC yang dipilih, bukan bukti identitas orang. Login super admin hanya melindungi pengaturan khusus admin dan koneksi Google.

## 6. Edit dari Monitoring

Pada detail AC, klik ikon **pensil** → pilih pesanan → ubah **Status** atau **Kendala** → **Simpan perubahan**. Penulisan memakai nilai RAW, sehingga teks tidak dijalankan sebagai formula. DONE akan keluar dari antrean setelah sinkronisasi dan tidak ikut pesan/gambar.

Server memeriksa ulang shipment, kode toko, posisi baris, header, dan nilai lama sebelum menulis. Jika sudah berubah, aplikasi meminta sinkronisasi. Google Sheets tidak menyediakan transaksi compare-and-swap untuk sel; perubahan bersamaan di sel yang sama masih mungkin bertabrakan setelah pemeriksaan. Saat ada pesan respons perubahan belum diterima, sinkronkan dan periksa hasil sebelum mencoba lagi; server tidak mengulang penulisan otomatis.

## 7. Hosting Vercel

Proyek sudah memiliki endpoint Node pada folder `api/` serta rewrite `/admin` pada `vercel.json`. Endpoint ini ikut di-deploy bersama frontend; jangan mengunggah folder `dist` saja.

Di **Vercel → Project → Settings → Environment Variables**, masukkan semua variabel dari langkah 4. Ubah `APP_ORIGIN` menjadi alamat produksi HTTPS, tambahkan redirect URI produksinya di Google, lalu redeploy. Isi secrets langsung di Vercel, bukan di chat. Jangan mengaktifkan preview deployment publik memakai secrets produksi secara sembarang.

## Mengatasi masalah

Hasil pengujian lokal 1 November 2026: data monitoring Google dan profil PIC di browser berhasil dibaca. Permintaan Node langsung ke Supabase masih mengalami `UNABLE_TO_VERIFY_LEAF_SIGNATURE`. Setelah kredensial diisi, koneksi server ini tetap perlu diperbaiki agar OAuth/cache/audit berjalan di laptop; penyiapan OAuth tidak memperbaiki trust certificate. Konfigurasi Vercel memakai environment server sendiri dan perlu diverifikasi sesudah deploy.

| Pesan / gejala | Tindakan |
| --- | --- |
| Konfigurasi belum lengkap | Lengkapi seluruh variabel `.env.local`/Vercel dan restart/redeploy. |
| Koneksi Google belum diaktifkan | Walaupun kredensial sudah terisi, ubah `SAPA_GOOGLE_ENABLED=false` menjadi `true`, lalu restart server. |
| Koneksi Supabase perlu diperbaiki | Konfigurasi sudah terisi, tetapi server belum bisa mengakses database. Untuk error sertifikat Fortinet, coba jaringan lain/hotspot atau hubungi administrator jaringan untuk memperbaiki CA. Jangan mengimpor CA yang tidak diketahui atau menonaktifkan HTTPS. |
| `redirect_uri_mismatch` | Samakan callback Google dan `APP_ORIGIN`; pastikan port dev benar-benar 5173. |
| `access_denied` saat Testing | Tambahkan email pengelola ke Test users dan gunakan akun itu. |
| Akun tidak terdaftar sebagai super admin | Periksa `SAPA_SUPER_ADMIN_EMAILS`; server memeriksa email Google yang sudah diverifikasi. |
| Izin file / API belum aktif | Aktifkan Sheets API di proyek client OAuth dan berikan akun pengelola akses Editor pada file. |
| Tab tanggal belum tersedia | Buat/periksa nama REG dan DS tanggal hari ini. Aplikasi tidak mengambil tanggal lain diam-diam. |
| File/range tidak dapat dibaca | Periksa nama tab dan pastikan file native Google Sheets, bukan Office `.xlsx`. |
| Izin Google kedaluwarsa/dicabut | Buka `/admin` dan Hubungkan ulang Google. Perhatikan batas 7 hari mode Testing. |
| Sertifikat HTTPS server tidak valid | Perbaiki CA/jaringan server. Jangan memakai `NODE_TLS_REJECT_UNAUTHORIZED=0` atau menonaktifkan TLS. OAuth tidak memperbaiki masalah sertifikat server. |
| Data lama masih terlihat | Periksa waktu baca/peringatan. Cache server 30 detik untuk monitoring, 5 menit untuk kontak. Sinkronisasi gagal mempertahankan cache tanggal/sumber yang sama. |

## Referensi resmi

- [Google OAuth untuk aplikasi web server](https://developers.google.com/identity/protocols/oauth2/web-server)
- [Validasi identitas OpenID Connect Google](https://developers.google.com/identity/openid-connect/openid-connect)
- [Scope Google Sheets](https://developers.google.com/workspace/sheets/api/scopes)
- [Masa berlaku refresh token](https://developers.google.com/identity/protocols/oauth2#expiration)
- [Vercel Functions untuk Vite](https://vercel.com/docs/frameworks/frontend/vite)
