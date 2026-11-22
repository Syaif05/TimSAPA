# Template pesan per PIC

Setiap PIC menyimpan 1–20 template pada pengaturan bersama PIC yang sudah ada. Empat template lama tetap tersedia dan isi kustom pengguna tidak dimigrasi atau ditimpa. Batas diperiksa di browser serta Edge Function `pic-profiles`; tidak memerlukan perubahan schema database.

## Mengelola koleksi

Buka menu Template pesan, kemudian gunakan **Baru**, **Duplikat**, atau **Hapus**. Nama dan deskripsi bisa diubah. Pencarian membantu menemukan template saat koleksi besar. **Jadikan utama** menentukan pilihan awal, lalu **Simpan semua** untuk menyimpan koleksi dan pilihan utama. Pengaturan memakai pemeriksaan revisi per PIC yang sudah ada, sehingga perubahan dari perangkat lama tidak menimpa revisi baru diam-diam.

Di Antrean, pemilih **Template untuk AC ini** berada tepat di atas draf pesan. Pilihan terakhir menjadi pilihan awal untuk AC berikutnya. Pergantian pada satu kartu tidak mengganti draf kartu lain yang sedang terbuka. Jika draf AC sudah diedit, tombol Batal mempertahankan teks; Ganti template mengganti draf secara eksplisit.

Setiap isi template maksimal 20.000 karakter. Koleksi dibatasi 160.000 byte JSON UTF-8 agar aman terhadap batas penyimpanan profil; emoji dan huruf multibyte ikut dihitung. Hapus atau ringkas teks bila koleksi melampaui batas.

## Variabel otomatis

Pemilih variabel memiliki pencarian dan kategori Waktu, Identitas, Toko, Pesanan, dan Follow up. Klik variabel untuk menyisipkan pada posisi kursor. Katalog pusat terdapat pada `TEMPLATE_VARIABLES` di `src/utils/templateEngine.js` dan menampilkan deskripsi masing-masing variabel di UI.

Contoh yang sering digunakan:

- `{salam}`, `{waktu}`, `{jam_sekarang}`, `{tanggal}`, `{hari}`.
- `{nama_ac}`, `{cug_ac}`, `{pic}`, `{cabang}`, `{region}`.
- `{daftar_nama_toko}` untuk nama toko per baris; `{nama_toko_koma}` untuk nama dipisah koma.
- `{daftar_toko}` untuk kode + nama; `{rincian_toko}` untuk jumlah pesanan per toko.
- `{shipment_koma}`, `{shipment_ds}`, `{shipment_reg}`, `{total_ds}`, `{total_reg}`.
- `{daftar_kendala}`, `{daftar_grouping}`, `{daftar_pejabat}`, `{kondisi_motor}`, `{personil_per_toko}`.

Semua rincian dan hitungan pesanan berasal dari baris aktif yang sedang ditampilkan; DONE dikeluarkan sebelum render. DS dan REG pada kontak yang sama tetap digabung sesuai working set. Nama toko/nomor shipment pada daftar unik tidak diulang. Jumlah personil ditampilkan per toko, bukan dijumlah ulang untuk setiap shipment.

Sapaan **Otomatis · WIB** memakai Asia/Jakarta: Pagi 05.00–10.59, Siang 11.00–14.59, Sore 15.00–17.59, Malam 18.00–04.59. Waktu juga dapat dipilih manual per template. Pilihan ini hanya memengaruhi `{salam}` dan `{waktu}`; teks sapaan yang diketik langsung tetap apa adanya. Jam/tanggal sekarang selalu WIB, sedangkan `{tanggal_data}` berasal dari tanggal sheet. Jam diperbarui setiap menit pada draf otomatis, dan draf yang sudah diedit dipertahankan.

## Variabel khusus

Maksimal 10 per template. Contoh nama `link_formulir`, `batas_waktu`, atau `catatan_tambahan`, dengan nilai tetap yang diisi sendiri. Nama 2–40 karakter berupa huruf kecil, angka, dan garis bawah; mulai dengan huruf. Nilai maksimal 1.000 karakter. Variabel khusus tidak mengganti variabel otomatis dan nilainya tidak dirender ulang secara rekursif. Nilai kosong menghasilkan teks kosong.

Contoh isi template:

```text
{salam}, Bapak/Ibu {nama_ac}.

Mohon bantuannya melengkapi pendataan toko berikut:
{daftar_nama_toko}

Formulir: {link_formulir}
Batas pengisian: {batas_waktu}

Terima kasih.
{pic} · {tanggal} · {jam_sekarang} WIB
```

Pratinjau memakai data contoh, bukan data AC sungguhan. Placeholder yang belum dikenal ditampilkan sebagai peringatan dan dipertahankan sebagai teks agar salah ketik dapat diperbaiki.

## Rilis

Rilis mencakup frontend Vercel dan Edge Function `pic-profiles` (termasuk file baru `templateRules.js`). Deploy frontend saja tidak memperluas batas server dari empat menjadi 20. Konfigurasi JWT/API key dan cakupan akses PIC tetap mengikuti layanan sebelumnya. Tidak perlu reset profil atau menulis ulang template milik pengguna.
