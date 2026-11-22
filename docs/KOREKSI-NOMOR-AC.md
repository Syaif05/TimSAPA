# Antrean tetap terlihat dan koreksi nomor AC

Pada desktop (lebar di atas 800px), panel Antrean bersifat sticky dan menyesuaikan tinggi ruang layar. Daftar AC mempunyai scroll sendiri; menggulir detail/lampiran panjang tidak menghilangkan panel tersebut. Kontainer memakai overflow clip agar sticky tidak terikat ke scroll container tersembunyi. Saat memilih AC lain, detail diarahkan kembali ke awal tanpa menghilangkan Antrean. Pada ponsel, daftar tetap horizontal agar tidak memenuhi ruang layar detail.

## Update nomor

1. Pilih AC pada Antrean.
2. Ubah isian Nomor WhatsApp AC. Pengetikan hanya mengubah draft input, tanpa menyimpan atau memindahkan kelompok AC.
3. Klik **Update nomor**. Format 08…, 8…, +62…, dan 62… dinormalisasi menjadi 62…. Nomor dengan huruf, kosong, atau format tidak valid ditolak.
4. Setelah server mengonfirmasi penyimpanan, tombol menjadi Tersimpan dan nomor digunakan untuk Buka chat. Batal mengembalikan nomor terakhir.

Koreksi berlaku untuk **nama AC dan cabang yang sama**, untuk seluruh PIC pada Monitoring, termasuk hari/perangkat berikutnya. AC senama di cabang lain tidak ikut berubah. Perubahan nomor tidak membuang draf pesan atau memindahkan pilihan ke AC pertama. Status chat lokal dipertahankan ketika nomor mengubah kunci grup WhatsApp.

## Penyimpanan dan sinkronisasi

API yang dipakai tetap `/api/contacts` sehingga jumlah Vercel Functions tidak bertambah:

- `GET /api/contacts?mode=phone-overrides`: daftar koreksi tersimpan.
- `PATCH /api/contacts`: simpan acName, cabang, phone, pic, expectedVersion.

Penyimpanan memakai record terpisah dalam tabel server-only `sapa_source_cache`, dengan prefix `contact-phone:` dan masa berlaku tanpa kedaluwarsa operasional. Tidak memerlukan migrasi schema baru. Record berisi identitas stabil nama/cabang, nomor normalisasi, PIC pembaru, waktu, dan versi UUID. Pengelompokan ulang DS/REG memakai nomor hasil koreksi, sedangkan kode toko, shipment, status pesanan, dan sumber Sheets tidak diubah.

Koreksi ini mempunyai prioritas atas data kontak sumber untuk Monitoring dan tidak dihapus oleh sinkronisasi kontak, pergantian tanggal, atau penyegaran cache Monitoring. Pengguna dapat memperbaruinya lagi dengan tombol yang sama bila nomor berubah. Halaman Hub AC dan kolom nomor pada Google Sheets tidak ditulis oleh fitur ini.

Klien memuat daftar koreksi setiap 60 detik dan saat tab aktif; penyimpanan berhasil langsung memperbarui browser pengubah. Cache lokal dipakai sebagai cadangan pada PIC/browser yang sudah pernah memuat koreksi. Pembacaan yang dimulai sebelum penyimpanan tidak menimpa hasil simpan baru. API tidak memerlukan token Google untuk menyimpan koreksi, tetapi tetap memerlukan koneksi database, PIC terdaftar, origin aplikasi yang benar, dan izin edit PIC yang aktif.

Penyimpanan pertama memakai insert tanpa menimpa record lama; pembaruan memakai versi yang diharapkan. Jika pengguna lain sudah mengganti nomor, API mengembalikan 409 dan klien mengambil versi terbaru. Batal memakai nomor terbaru sebelum pengguna mengedit ulang. Tidak ada pesan WhatsApp yang dikirim oleh tombol Update nomor; tanda format valid tidak memverifikasi kepemilikan atau status WhatsApp nomor.
