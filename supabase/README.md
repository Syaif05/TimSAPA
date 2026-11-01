# SAPA — profil PIC bersama

Proyek: TimSAPA (`tsbbgeodukscvzixivjf`).

Status 31 Oktober 2026: reset permanen ditolak oleh tinjauan persetujuan otomatis, termasuk setelah konfirmasi tambahan. Tabel dan akun aplikasi lama masih ada. Implementasi baru menggunakan `public.sapa_pic_profiles` dan `public.sapa_pic_settings`, terpisah dari struktur lama. Skrip destruktif `schema/reset-timsapa.sql` belum dijalankan.

## Data aplikasi baru

- Enam PIC awal berasal dari REG + DS tanggal 31/10: ABRAR, ANA, ATHIRA, AYU, JENIFER, SYAIFUL.
- Setiap PIC memiliki template pesan, template aktif, desain tabel, daftar status, tema, template POD, jeda POD, pilihan tab WA, dan suara POD.
- PIC tambahan mengikuti daftar spreadsheet hari ini; Edge Function memeriksa nama baru ke sumber Google sebelum membuat profil.
- Memilih filter PIC lain tidak mengganti profil aktif atau pemilik pengaturannya.
- Lampiran PNG dibuat dari desain PIC dan data terkini di browser; file PNG tidak diunggah ke Storage.
- Data monitoring dan kontak tetap dibaca dari Google. Status pekerjaan lokal, impor manual, antrean POD, serta koreksi nomor disimpan di browser dengan ruang penyimpanan berbeda per PIC.

## Sinkronisasi dan akses

`functions/pic-profiles` adalah API profil bersama untuk aplikasi, tanpa kata sandi. Siapa pun yang dapat menggunakan aplikasi dapat memilih PIC mana pun; ini bukan sistem autentikasi atau penguncian kepemilikan akun. Jangan gunakan profil ini untuk menyimpan rahasia.

Database mengaktifkan RLS dan mencabut hak akses tabel bagi `anon`/`authenticated`. Edge Function memvalidasi publishable app key, nama PIC, jenis pengaturan, ukuran data, serta revisi sebelum menggunakan kredensial server bawaan Supabase. Secret/service-role tidak masuk ke bundle browser. CORS mengizinkan browser lokal dan alamat Vercel mendatang.

Pengaturan otomatis disimpan setelah jeda singkat dan dibaca ulang sekitar 15 detik ketika halaman terlihat. Formulir yang sedang dibuka mempertahankan revisi awal untuk mendeteksi konflik saat disimpan. Perangkat dengan revisi lama harus memilih versi bersama atau menyimpan perubahannya sendiri secara eksplisit. Draf gagal kirim tetap disimpan pada perangkat/PIC yang sama. Pergantian PIC menunggu antrean penyimpanan selesai; formulir yang belum disimpan harus diselesaikan dahulu.

Endpoint dan publishable app key berada di `src/profiles/api.js`; keduanya bukan kredensial rahasia. Mengganti publishable key memerlukan pembaruan konfigurasi aplikasi dan validasi app key pada Edge Function.

`schema/pic-workspaces.sql` mencatat struktur dan seed awal tanpa reset. `schema/pod-defaults.sql` menambahkan default POD yang belum ada tanpa menimpa nilai pengguna. Riwayat perubahan database tersedia di migration Supabase yang diterapkan melalui connector.

## Pemeriksaan

`npm test` menguji pemisahan PIC, draf saat offline, konflik dua perangkat, perubahan saat penyimpanan berlangsung, validasi API, dan pembacaan sumber. `npm run build` membangun aplikasi untuk distribusi. Tidak ada layanan berbayar atau proyek Supabase tambahan yang dibuat.

Sumber Sheets/kontak menggunakan endpoint Node yang sama pada Vite dan folder `api/` Vercel. Rewrite `/admin` tersedia di `vercel.json`. Website belum di-deploy; deploy seluruh proyek, bukan folder `dist` saja.

Audit akhir: RLS aktif pada kedua tabel baru; akses langsung dari publishable key ke tabel ditolak. Advisor menampilkan INFO “RLS enabled, no policy” karena jalur akses memang hanya melalui server; [penjelasan advisor](https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy). Proyek lama juga masih memiliki peringatan proteksi kata sandi bocor yang belum aktif: [remediasi Supabase Auth](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). Fitur profil PIC baru tidak menggunakan akun/password Auth.


## Warna dan antrean operasional

Warna aplikasi dan tepi sumber disimpan di `tableSettings.workspaceAppearance` melalui API preferensi PIC yang sudah aktif. Pengaturan gambar dipisahkan di sisi aplikasi, sehingga menyimpan atau mereset desain lampiran tidak mereset warna workspace. Enam preset tersedia: Biru, Pink, Ungu, Hijau, Pasir, dan Netral, dengan warna aksen/DS/REG yang bisa dipilih sendiri. Tidak diperlukan pembaruan Edge Function untuk penyimpanan warna ini.

Antrean memisahkan AC berdasarkan sumber (`DS::NAMA AC` dan `REG::NAMA AC`), dengan DS didahulukan. Status chat lama per AC tetap menjadi fallback; status pesanan sumber tidak ditimpa. Hitungan DONE dan belum DONE dihitung dari snapshot mentah berdasarkan PIC dan sumber, sebelum filter antrean, dan rekap semua PIC tersedia melalui ikon pada ringkasan.

Baris dengan status spreadsheet DONE (termasuk variasi kapital dan spasi) dikeluarkan dari antrean, pesan, dan DOM ekspor tabel. Jika daftar pesanan berubah, draf lama dan pratinjau gambar diperbarui. Pembuatan gambar/chat yang masih berlangsung dibatalkan ketika panel datanya telah berganti. Pembaruan mengikuti polling Sheets sekitar 30 detik; data yang belum pernah berhasil dibaca menampilkan tanda kosong, bukan hitungan nol.

Verifikasi terbaru: 61 pengujian lulus dan production build berhasil. Data harian asli 1 November 2026 sudah berhasil dibaca setelah mendukung header PIC kosong pada layout standar 22 kolom. Endpoint publik dan halaman Monitoring diverifikasi; alur OAuth Google baru diuji dengan token RSA serta server/database contoh karena kredensial OAuth belum tersedia. Aktivasi dan uji izin Google asli tetap menunggu konfigurasi pemilik. Tema dan penyimpanan preferensi menggunakan Supabase asli.

## Sumber Google dan admin (1 November 2026)

Panduan: [Google Cloud setup](../docs/GOOGLE-CLOUD-SETUP.md). `schema/google-connection.sql` sudah diterapkan secara additive: sesi admin berisi hash token, state OAuth sekali pakai, token Google terenkripsi AES-GCM, konfigurasi sumber, cache bersama, dan audit perubahan. RLS aktif; anon/authenticated tidak mempunyai akses langsung ke keenam tabel. Tidak ada penghapusan data lama.

Super admin memakai Google OIDC di server, PKCE, nonce, state cookie HttpOnly, pemeriksaan signature/audience/issuer/expiry/email_verified, dan allowlist email dari environment. Sesi berlaku 24 jam dan logout menghapus sesi server. Hanya admin yang boleh menghubungkan akun Google, mengganti sumber kontak, melihat audit, atau mengganti izin edit PIC. Halaman `/admin` tidak masuk navbar PIC.

PIC tetap profil bersama tanpa autentikasi pribadi sesuai pilihan pengguna. Ketika izin edit aktif dan koneksi Google tersedia, semua pengguna dapat memilih PIC terdaftar lalu mengubah Status/Kendala. Audit mencatat PIC yang dipilih, bukan identitas orang. Izin admin tidak diberikan melalui pilihan PIC atau payload frontend.

Integrasi OAuth default belum aktif (`SAPA_GOOGLE_ENABLED=false`): lengkapi `.env.local`/Vercel dengan client Google, server key Supabase, allowlist admin, origin, dan kunci enkripsi. Token refresh tidak pernah dikirim ke frontend. Kunci tidak ditanam di source/build. Cache monitoring bertahan antar-instance server, terpisah per tanggal/mode; cache kontak terpisah per sumber.

File kontak lama telah diverifikasi berformat XLSX, sehingga pembacaan Excel dipertahankan sementara. Pemilik akan memindahkan sumber utama ke native Google Sheets; tautan dan nama tab baru dapat disimpan melalui admin sesudah OAuth dikonfigurasi. Metadata sumber monitoring diverifikasi native Google Sheets. Tidak ada file Google yang diubah selama pengujian.

Edge Function `pic-profiles` sekarang versi 3, mendukung header PIC kosong di kolom O hanya ketika kolom tetangga cocok dengan layout sumber yang diverifikasi. Profil dan 60 pengaturan lama tetap dipertahankan.
