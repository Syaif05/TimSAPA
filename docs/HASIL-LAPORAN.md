# Hasil Laporan

Menu Hasil Laporan menerima satu ekspor Excel (.xlsx / .xls) atau CSV pending_delivery_follow_up. Jika ada banyak worksheet, pilih worksheet yang sesuai; `history` dipilih otomatis jika tersedia. Pemrosesan berlangsung di browser, tanpa mengunggah data mentah ke server. Data tetap tersedia saat berpindah menu, sampai aplikasi dimuat ulang. Preferensi tampilan disimpan pada browser per PIC; nama dan tanggal dipilih ulang ketika mengganti berkas.

## Perhitungan dan urutan

- Ringkasan: baris berdasarkan `agent_follow_up`; hitung jumlah baris dengan `nomor_shipment` terisi dan jumlah nilai `store_id` berbeda.
- Toko kosong secara default dihitung sebagai satu nilai, sesuai DISTINCTCOUNT Excel. Pilihan ini dapat dimatikan.
- Grand Total toko merupakan DISTINCTCOUNT dari gabungan data yang terpilih, sehingga tidak selalu sama dengan penjumlahan setiap nama.
- Rincian: baris `descp_follow_up` (dapat diganti dengan grouping, cabang, kode toko, atau kategori), kolom nama A–Z, nilai COUNT shipment.
- Urutan awal ringkasan adalah jumlah toko menurun; rincian jumlah shipment menurun. Urutan abjad tersedia pada kedua tabel.
- Filter tanggal memakai `update_at` (tanggal follow up), bukan tanggal di nomor shipment. Tanggal terbaru dipilih otomatis setelah impor.
- Nama pada kedua tabel secara default sama; pilihan nama terpisah tersedia untuk meniru contoh gambar dengan filter berbeda.
- Shipment berulang tetap dihitung sebagai riwayat follow up; aplikasi melaporkan jumlah kemunculan berulang. Baris tanpa shipment diabaikan dan jumlahnya ditampilkan.
- Normalisasi spasi termasuk nonbreaking space dilakukan pada teks. Nama petugas diubah menjadi huruf besar; ejaan berbeda tidak digabung secara otomatis.

Hasil dapat disalin sebagai gambar atau diunduh sebagai PNG, untuk kedua tabel atau salah satunya. Font awal Calibri 11 pt dengan fallback Arial. Salin data menghasilkan teks bertab untuk Excel/Sheets.

## Hasil pemeriksaan contoh

Empat workbook pada `HasilLaporan/DataMentah` berisi 7.372, 1.586, 1.586, dan 319 baris shipment. Dua file bernama `(3)` identik, sehingga harus digunakan salah satunya. Workbook terbesar mencakup 19–26 Oktober 2026. Seluruh 7 gambar contoh diperiksa: terdapat variasi urutan alfabet/jumlah dan pilihan nama berbeda antara ringkasan dan rincian. Filter lengkap pada gambar tidak tersedia dan angka gambar tidak seluruhnya cocok dengan workbook, sehingga tidak diasumsikan sebagai pasangan data identik.

Logika agregasi berada di `src/utils/hasilLaporan.js`; UI di `src/components/HasilLaporanView.jsx`. Pengujian mencakup total toko lintas petugas, nilai kosong, filter terpisah, tanggal, kategori, dan COUNT shipment.

## Desain bersama

Tema Biru, Hijau, Gelap, atau Minimal dapat dipilih beserta waktu Siang/Sore/Malam, visibilitas judul/tanggal/waktu/tabel/Grand Total, ukuran font, garis sel, angka nol, dan catatan. Tombol Simpan untuk semua PIC mengirim hanya desain, tanpa data mentah atau filter nama/tanggal, ke `/api/report-design`. Penyimpanan terakhir berlaku untuk seluruh PIC. Desain dimuat saat menu dibuka dan diperiksa setiap 30 detik; draf yang sedang diedit tidak ditimpa otomatis. Gunakan desain terbaru untuk mengambil versi tersimpan secara eksplisit.

Snapshot desain disimpan server-side pada `sapa_source_cache`, key `settings:followup-design`, tanpa kedaluwarsa operasional (tahun 9999). Pembersihan cache yang hanya menghapus entri kedaluwarsa tidak menghapus desain ini. Penulisan memeriksa origin dan nama PIC terdaftar, sesuai model profil bersama aplikasi. Nama penyimpan dan waktu simpan ditampilkan di UI.
