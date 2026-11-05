# Update Langsung Tarik Data

Upload CSV tetap mendukung salin manual. Tombol Update Langsung hanya menulis kategori yang dipilih (REG atau DS), pada tab harian tanggal WIB saat tombol ditekan. Maksimal 5.000 baris input per permintaan. Pilih jam monitoring sebelum menekan tombol.

Server menggunakan koneksi Google pengelola dan pengaturan izin edit PIC yang sudah ada. Header harus di baris 2, data dimulai baris 3. Jika struktur A:V berubah, update ditolak. Shipment dicek ulang terhadap semua PIC dan status di kedua tab serta duplikat di input. Data baru ditambahkan di bawah Shipment terakhir; sel tujuan yang sudah berisi data selain template Jam/PIC menyebabkan penolakan.

B:L diisi nilai tarikan (sebagai teks literal). M:N kosong. O berisi XLOOKUP berdasarkan F dan sheet NEW PIC 2026. P:V dikosongkan untuk follow up baru. Dropdown A disalin dari template; P berisi Proses/Done/Tidak dapat dihubungi; U berisi pilihan Grouping. Format dan validasi disalin dari baris dengan jam yang sama jika ada, atau baris data terakhir. Warna jam 07/08/09 ditetapkan sesuai permintaan; jam lain mengikuti format template spreadsheet. Font Calibri 11. Header tidak ikut diurutkan; semua kolom A:V mulai baris 3 diurutkan sekaligus dengan prioritas D, C, O, agar isi tiap baris tetap bersama.

Import memakai lock di sapa_source_cache (maksimal 10 menit) dan audit di sapa_sheet_audit. Permintaan Google menggabungkan penambahan, format, validasi, dan pengurutan dalam satu batch. Jika respons penulisan tidak pasti, jangan kirim ulang sebelum memeriksa spreadsheet; lock dipertahankan sementara. Cache monitoring tanggal tersebut dibatalkan setelah sukses.

Update harian membutuhkan kedua tab REG dan DS sudah tersedia, izin edit Google aktif, dan sheet NEW PIC 2026 tersedia. Penulisan live hanya terjadi ketika pengguna menekan tombol, bukan saat upload CSV. Pengujian otomatis menggunakan mock Sheets, tanpa menambahkan pesanan uji ke data kantor.
