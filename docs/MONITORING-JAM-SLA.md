# Filter JAM dan prioritas SLA > 12 jam

Pembaruan 25 November 2026.

## Filter JAM Antrean

Kontrol JAM monitoring berada pada baris tersendiri di bawah filter Antrean, menggunakan nilai `jam` dari kolom A spreadsheet.

- `Semua JAM` tetap menjadi pilihan awal.
- Jam tertentu menampilkan hanya pesanan aktif pada jam tersebut, bukan seluruh pesanan AC yang kebetulan memiliki satu baris pada jam itu.
- `JAM terbaru` mengikuti jam valid paling akhir yang tersedia pada kumpulan Antrean saat snapshot diperbarui. Nilai `07.00`, `07:00`, `7`, dan `07:00:00` disamakan menjadi `07.00`. Opsi jam diurutkan dari terbaru; JAM kosong tersedia sebagai pilihan sendiri.
- Pilihan dan hitungan jam berasal dari pesanan yang belum DONE dalam PIC/sumber/status pesanan yang sedang dipilih. Jam yang hanya berisi DONE tidak menjadi jam terbaru.
- Ketika jam tertentu tidak lagi memiliki pesanan aktif, tampilkan keadaan kosong dan opsi jam tersebut berjumlah nol. Jangan diam-diam berpindah ke jam lain. Pengguna dapat memilih JAM terbaru atau Semua JAM.
- Filter bekerja pada baris sebelum hitungan toko/pesanan, daftar Shipment, metadata JAM, pesan, dan lampiran dibentuk kembali. DS dan REG pada AC/nomor sama tetap digabung bila keduanya lolos filter.
- Tidak ada penghapusan baris atau perubahan status pada spreadsheet. Pesanan yang menjadi DONE atau hilang dari sumber tidak lagi masuk Antrean pada snapshot berikutnya.

## Prioritas >12 jam

Kategori `7. > 12 Jam` dikenali melalui bucket SLA 12 jam, bukan hanya angka `12` di teks lain. Hitungan berasal dari baris aktif yang tampil; `slaBreakdown` lama tidak dapat menimbulkan peringatan palsu.

- AC dengan setidaknya satu pesanan aktif >12 jam ditempatkan di atas AC lainnya, tanpa mengubah urutan asli antar-AC yang setara. Pemilihan AC pengguna tetap dipertahankan bila masih tampil.
- Antrean menampilkan bingkai oranye/merah, ikon api, jumlah pesanan >12 jam dan label PRIORITAS UTAMA. Status chat lokal tetap terpisah dari SLA.
- Detail AC menampilkan banner merah besar dan petunjuk segera ditindaklanjuti. Pintasan pada baris JAM dapat menyaring SLA >12 jam.
- Lampiran PNG memuat banner merah, gambar api SVG, hitungan >12 jam, warna baris dan penanda Shipment, serta sel SLA merah dengan teks SEGERA DITANGANI. Banner tetap ada bila kolom SLA, judul, atau pewarnaan SLA biasa disembunyikan.
- Efek nyala api bergerak pada website, tanpa kedipan cepat. `prefers-reduced-motion` menonaktifkan animasi. PNG adalah gambar statis; ikon api dan seluruh peringatan tetap tercetak.

## Verifikasi

Tes mencakup normalisasi JAM, urutan jam, jam terbaru yang mengikuti snapshot, jam yang hilang setelah diproses, DS/REG, pesan/metadata yang hanya memuat jam terpilih, prioritas AC, pengecualian DONE dan 6 jam dari peringatan 12 jam, serta DOM PNG saat kolom SLA/pewarnaan biasa dimatikan.

QA browser menggunakan data contoh, menguji perubahan 08.00 ke 09.00, penyelesaian pesanan pada jam lama, ekspor PNG nyata, dan viewport 390px serta 1280px. Tidak mengirim WhatsApp atau mengubah spreadsheet operasional.
