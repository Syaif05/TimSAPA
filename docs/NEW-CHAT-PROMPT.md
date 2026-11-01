# Prompt pembuka percakapan baru — SAPA

Salin teks di bawah ke percakapan baru. Jika AI baru tidak dapat membaca folder lokal yang sama, lampirkan `PROJECT-HANDOFF.md` beserta source proyek, atau berikan akses ke repository. Jangan melampirkan `.env.local`, cache kontak, token, atau kunci rahasia.

---

Saya ingin melanjutkan proyek SAPA/TimSAPA yang sudah berjalan. Tolong pahami konteks yang sudah ada sebelum mengubah kode; jangan membuat ulang dari nol.

Baca dokumen serah terima lengkap:

`/Users/syaifulloh/Documents/Pemrograman/Program/ChatOtoV1/docs/PROJECT-HANDOFF.md`

Root proyek lokal:

`/Users/syaifulloh/Documents/Pemrograman/Program/ChatOtoV1`

Repository: https://github.com/Syaif05/TimSAPA

Website produksi: https://timsapa.vercel.app

Kondisi acuan 1 November 2026:

- React/Vite SPA, Node24 API di Vercel, Supabase untuk preferensi PIC dan backend Google/admin.
- Commit produksi yang terakhir diverifikasi: `0dc211bf4aeb43015d84e71404c75aa101498769`; deploy READY.
- Mode Monitoring **Antrean** dan **Spreadsheet** sudah selesai, diuji dan live. 72 tes lulus pada rilis tersebut.
- PIC dipilih saat masuk, tanpa akun/password pribadi. Template/tema/desain lampiran tersimpan bersama per PIC. Filter PIC lain tidak mengganti profil aktif.
- DS didahulukan, default tepi merah; REG biru; warna dapat diubah.
- Pesanan sumber DONE tidak boleh masuk pekerjaan aktif, pesan, TSV, atau PNG. DONE tetap dihitung pada rekap PIC.
- UI harus minimalis dan responsif; bantuan panjang di ikon/dialog; jangan kembalikan header besar atau menu Kontak lama.
- Data REG/DS mengikuti tab tanggal Asia/Jakarta dari workbook yang ID-nya ada di source/dokumen.
- Tombol WhatsApp Monitoring/header memakai ekstensi lokal untuk menggunakan tab Web yang sudah terbuka. POD masih memakai named window lama; perbedaan dan batasnya dijelaskan pada dokumen. Pengiriman tetap manual.
- Satu akun Google pengelola untuk semua PIC; super admin email `syaifullohrohmat05@gmail.com`; halaman `/admin` terpisah dari navbar.
- Secret Production Vercel sudah disiapkan, tetapi inventaris terakhir menunjukkan koneksi Google pengelola belum tersimpan. Jangan menganggap consent Sheets telah selesai. Callback produksi dan link kontak native baru masih perlu dipastikan.
- Kontak lama masih Excel; pengguna akan memberi link Google Sheets native baru.
- Reset total Supabase tidak pernah dijalankan; jangan menjalankan skrip reset. Implementasi baru additive, data lama masih ada.
- Nilai secret tidak boleh dicetak/diunggah ke chat/Git. Jangan menonaktifkan TLS untuk mengatasi masalah Fortinet lokal.

Periksa kondisi aktual dan dokumen sebelum menyimpulkan. Dokumen juga memuat peta seluruh file, API, schema, storage matrix, hasil QA, temuan kecil tombol copy modal PNG, dan langkah kelanjutan. Sebagian README historis memuat status lama; utamakan source serta pemeriksaan terbaru.

Setelah memahami, lanjutkan instruksi berikut saya. Jangan melakukan deploy, perubahan data operasional, reset, pengiriman pesan, atau migrasi sumber hanya karena tercantum sebagai pekerjaan pending di dokumen.

**Pekerjaan berikut yang ingin saya lakukan:**

[Tulis permintaan berikutnya di sini.]
