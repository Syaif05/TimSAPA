# Spreadsheet Pintar

Menu Monitoring: **Antrean → Spreadsheet Pintar → Hasil Kerja**.

Tujuannya mengurangi pengisian ulang ketika Shipment yang sama muncul pada beberapa JAM dalam satu hari. Tarik Data tetap menerima semua duplikat. Tidak ada baris sumber yang dihapus atau diurutkan ulang oleh fitur ini.

## Tampilan dan pengisian

- Satu baris tampilan untuk kombinasi tanggal/mode, sumber REG atau DS, PIC, Kode Toko, dan Shipment. Nama toko saja tidak dipakai sebagai identitas.
- Kemunculan dengan JAM terakhir ditampilkan. Jika JAM sama, baris sumber terakhir menjadi wakil. Format `07:00`, `7.00`, dan `07.00` dikenali sebagai JAM yang sama.
- Enam isian: Status, Kondisi Motor, Jumlah Personil, Nama Pejabat, KENDALA, Grouping. Klik sel untuk membuka editor, lalu **Simpan ke spreadsheet**. Grouping menyediakan saran dari data sumber; teks lain tetap bisa dimasukkan.
- Sel kosong mengambil nilai nonkosong terdekat dari JAM sebelumnya. Penanda biru `Dari HH.mm · belum tersimpan` menunjukkan usulan, bukan keberhasilan tulis. Angka personil `0` bukan kosong.
- Isian pada JAM terbaru yang sudah terisi dipertahankan. Nilai yang berbeda pada JAM yang sama ditandai untuk pemeriksaan riwayat; sistem tidak menebak nilai mana yang benar.
- Riwayat memperlihatkan enam isian asli pada setiap baris/JAM. Tombol edit baris tersedia untuk memperbaiki baris tertentu jika ada perbedaan. Pengubahan baris lama tidak menimpa isian terbaru yang sudah terisi.
- Filter PIC, sumber, JAM terakhir, status, pencarian; judul kolom untuk urut A–Z/Z–A; detail AC/PIC opsional; 50 baris per halaman. Salin tampilan menyalin TSV tanpa header.
- DONE tetap ditampilkan di menu ini. Antrean tetap mengecualikan DONE; Hasil Kerja membaca status yang benar-benar tersimpan di sumber.

## Penerusan otomatis

`Teruskan isian otomatis` aktif secara awal, dapat dimatikan, dan pengaturannya tersimpan di browser per profil. Penerusan berjalan **selama menu ini terbuka dan halaman terlihat**, pada data harian hari ini, untuk **satu PIC dan sumber terpilih**. Filter pencarian/JAM/status hanya mengatur tampilan; penerusan memeriksa seluruh Shipment pada PIC/sumber tersebut.

`Teruskan sekarang` menjalankan pemeriksaan yang sama secara manual. Hanya sel kosong pada kemunculan JAM terakhir yang ditulis; seluruh kemunculan yang identik pada JAM terakhir dapat diisi. Riwayat jam lama tidak ditulis ulang. Jika jam 11 terlewat dan data jam 12 sudah ada saat menu dibuka, tujuan adalah jam 12.

Sistem memanfaatkan pembaruan snapshot Monitoring sekitar 30 detik, bukan cron/background worker setelah website ditutup. Batch dibatasi 100 baris dan satu sumber per permintaan; sisa diteruskan setelah snapshot baru diterima jika otomatis aktif. Jika otomatis mati, klik lagi untuk batch berikutnya.

Batas penting: riwayat harus masih tersedia pada tab tanggal yang sama. Fitur tidak mengambil isian kemarin dan tidak dapat memulihkan isian dari baris yang sudah dihapus dari spreadsheet. Sel yang sengaja dikosongkan juga termasuk sasaran penerusan; matikan otomatis jika ingin membiarkannya kosong.

## Batas tulis dan pengaman

- Menggunakan endpoint `/api/orders` PATCH yang sudah ada. `action: carry-forward` menghitung rencana ulang di server, tidak menerima daftar sel tujuan bebas dari browser.
- Memakai izin `allow_pic_edits`, pemeriksaan origin, dan PIC terdaftar yang sudah ada. Profil PIC tetap profil bersama, bukan bukti identitas pribadi.
- Hanya enam field follow up yang diizinkan; posisi kolom dibaca dari header. Dalam layout saat ini P–U. A–O dan V seterusnya, rumus PIC, dropdown, format, serta baris lain tidak diubah.
- Fresh snapshot wajib berhasil. Sel tujuan dibaca ulang dengan `FORMULA` untuk mendeteksi rumus dengan hasil kosong. Shipment, Kode Toko, dan JAM target diperiksa kembali sebelum penerusan.
- Edit manual menggunakan expected-values dan pemeriksaan ulang sel/identitas. Formula target tidak boleh ditimpa.
- Semua penulisan menggunakan `RAW`, audit `sapa_sheet_audit`, dan kunci bersama di `sapa_source_cache` yang sama dengan Update Langsung Tarik Data. Tidak ada schema/database migration baru.
- Bila write timeout/hasil tidak pasti, tidak dikirim ulang otomatis. Kunci sementara dipertahankan maksimal 10 menit; otomatis dijeda dan pilihan dijeda dipersist di browser. Periksa sumber dan muat ulang data sebelum mencoba lagi.
- Google Sheets tidak menyediakan atomic compare-and-swap nilai sel. Kunci mengoordinasikan penulisan aplikasi; perubahan manual di Google Sheets di sela pemeriksaan dan penulisan tetap merupakan keterbatasan API.

## Pengujian

`tests/smart-sheet.test.js` mencakup pewarisan enam field, identitas sumber/PIC/toko/tanggal, urutan JAM, nilai terbaru, personil nol, konflik JAM, duplikat, idempotensi, batas kolom RAW, formula, posisi berubah, sumber stale, header tidak valid, serta timeout. `tests/google-connection.test.js` menguji editor enam field dan izin/konflik API yang sudah ada.

QA browser menggunakan fixture terisolasi, tanpa menulis Sheets operasional: 10→11→12, simpan editor, riwayat, filter DONE/JAM terbaru, clipboard multiline tanpa header, mode gelap, layar 390 px, dan scroll tabel internal.
