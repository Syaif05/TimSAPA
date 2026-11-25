# Hasil Kerja

Perbaikan 22 November 2026.

## Pembacaan dan pengelompokan

- Status `Done`, termasuk dropdown `Done (Sudah dihubungi)`, dikenali sebagai DONE oleh ringkasan, Hasil Kerja, serta pengecualian Antrean/pesan/gambar.
- Hasil Kerja memakai seluruh snapshot Monitoring sebelum filter Antrean. PIC dan sumber dipilih sendiri pada Hasil Kerja.
- Kelompok harus mempunyai Kendala, kondisi motor, Grouping, jumlah personil, dan nama pejabat yang sama (abaikan kapitalisasi dan spasi berlebih). Nilai kosong hanya bergabung dengan nilai kosong, bukan sebagai pengganti nilai terisi.
- Shipment sama pada sumber/PIC yang sama dan isi laporan sama dihitung sekali. Urutan baris dan nomor baris spreadsheet tidak memengaruhi ceklis.
- Urutan: belum dikumpulkan dahulu; motor BAIK, RUSAK, lalu lainnya; personil numerik terbanyak; Grouping A–Z; Kendala sebagai pemecah urutan.

## Ceklis sepanjang hari

Ceklis disimpan per Shipment + sumber + PIC dengan sidik isi lima field laporan. Penyimpanan `sapa_work_results_v2:<scope>:<tanggal>` tetap berada pada storage profil PIC di perangkat/browser ini; belum sinkron antarperangkat.

- Shipment baru dalam kelompok yang sebelumnya dikumpulkan muncul sebagai kelompok belum dikumpulkan. Salin kelompok tersebut hanya berisi Shipment baru, tidak mengulang yang sudah dilaporkan.
- Jika isi laporan Shipment yang telah dikumpulkan berubah, baris muncul kembali dengan penanda `Data berubah · cek ulang`. Setelah diceklis lagi, sidik data tersimpan diperbarui.
- Kelompok sudah/belum dikumpulkan dipisah walaupun isinya sama; dapat menyatu kembali setelah status ceklis sama.
- Ceklis tidak terpisah oleh filter PIC/sumber maupun penyerahan 1/2. Laporan dapat dikumpulkan berkali-kali setiap hari menggunakan filter pengumpulan. Hari/scope baru mempunyai catatan terpisah.
- Ceklis v1 dari kedua penyerahan dan kombinasi filter dimigrasikan menggunakan snapshot baris historis. Data tambahan saat migrasi tetap belum dikumpulkan. Kehadiran ledger v2 kosong mencegah ceklis lama hidup kembali setelah dibatalkan.
- Pergantian tab browser memuat perubahan ceklis melalui event storage. Gagal menulis storage tidak menampilkan sukses ceklis.

## Kesegaran data

Pembaruan otomatis tetap mengikuti polling Monitoring. `Perbarui data` meminta `/api/sheets?...&fresh=1` untuk melewati cache 30 detik dan membaca sumber terbaru. Jam pemeriksaan ditampilkan dalam WIB. Jika sinkronisasi gagal, tampilkan peringatan dan data terakhir; keadaan tersebut tidak disebut tidak ada DONE.

Rekap Kendala mengikuti filter status yang terlihat. Progress tetap menghitung seluruh kelompok untuk PIC/sumber yang dipilih, sehingga filter belum dikumpulkan tidak mereset persentase.

## Verifikasi

Tes mencakup variasi dropdown DONE, perlindungan pesan/PNG dari pesanan selesai, pemisahan field berbeda/kosong, urutan, tambahan Shipment setelah ceklis, koreksi isi laporan, stabilitas saat sorting/filtering, deduplikasi dan migrasi v1. QA browser memakai data contoh tanpa mengubah spreadsheet operasional.
