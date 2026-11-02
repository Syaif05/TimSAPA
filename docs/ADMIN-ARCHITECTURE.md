# Struktur halaman admin SAPA

Halaman admin tetap berada di `/admin`. Menu menggunakan parameter `?page=` agar setiap bagian dapat dibuka langsung dan tombol Back/Forward browser tetap bekerja. Navigasi dan metadata halaman didefinisikan oleh `adminSections` di `src/cloud/GoogleAdmin.jsx`.

Menu saat ini: Ringkasan, Sumber data, Kontak, Akses PIC, dan Riwayat. Setiap menu memiliki area konten sendiri di komponen `GoogleAdmin`. Tata letak desktop dan seluler berada di `src/cloud/admin.css`; CSS umum aplikasi tetap di `src/index.css`.

Untuk menambah fitur admin:

1. Tambahkan `id`, `label`, ikon, dan deskripsi ke `adminSections`.
2. Tambahkan konten untuk `page === '<id>'` di area `.admin-content`. Untuk halaman yang besar, buat komponen tersendiri di `src/cloud/` lalu render dari area tersebut.
3. Jika fitur membutuhkan data atau perubahan server, tambahkan endpoint di `server/googleApplication.js`. Terapkan `requireAdmin(request)` pada semua endpoint admin; untuk perubahan data, panggil juga `sameOrigin(request)`.
4. Panggil endpoint melalui `sourceRequest`, lalu tampilkan kondisi memuat, sukses, dan gagal. Jangan menaruh token atau kunci layanan di frontend.
5. Periksa tampilan desktop dan seluler, jalankan `npm test` dan `npm run build`.

`/api/session` menentukan apakah pengguna dapat melihat dashboard. Menu frontend hanya navigasi; otorisasi tetap dilakukan oleh server.
