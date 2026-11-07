# Update Langsung Tarik Data

Upload CSV tetap mendukung salin manual. Update Langsung hanya berjalan saat tombol ditekan dan hanya menulis nilai B:L pada kategori REG atau DS yang dipilih, sama dengan 11 kolom hasil Salin manual. Tidak mengisi Jam, PIC, Status, atau follow up; tidak mengubah format/dropdown/rumus dan tidak mengurutkan. Baris baru ditambahkan setelah Shipment terakhir; jika kapasitas baris kurang, baris ditambahkan terlebih dahulu. Maksimal 5.000 baris input.

Header berada di baris 2. Server mengecek susunan B:L, semua Shipment di REG/DS, semua PIC/status dan duplikat CSV. Data disimpan sebagai teks literal; teks diawali '=' tidak dieksekusi sebagai rumus.

Jika tab hari ini belum ada, server mencari tab REG/DS dari kemarin menurut WIB (termasuk pergantian bulan/tahun). Hanya tab yang belum ada yang diduplikat. Tab baru mempertahankan baris 1–3, termasuk satu data contoh yang diminta. Baris 4 sampai terakhir dihapus HANYA dari tab duplikat. Data baru mulai setelah baris 3. Tab sumber kemarin dan tab hari ini yang sudah ada tidak dipotong. Jika sumber kemarin tidak tersedia atau header tidak sesuai, update dibatalkan tanpa menulis spreadsheet.

Duplikasi, pemotongan tab baru, penambahan kapasitas baris dan penulisan B:L dikirim dalam satu batch Google Sheets. Import memakai lock sapa_source_cache dan audit sapa_sheet_audit. Jika respons penulisan tidak pasti, jangan kirim ulang sebelum memeriksa spreadsheet; lock dipertahankan sementara (maksimal 10 menit). Cache Monitoring hari ini dibatalkan setelah sukses.

Jika pemeriksaan awal gagal karena tab belum tersedia, CSV tetap disimpan di tampilan dan tombol Update Langsung tetap dapat dipakai. Server akan membuat tab dan memeriksa duplikat pada saat tombol ditekan. Upload saja tidak membuat tab atau mengubah spreadsheet. Pengujian menggunakan mock Sheets, tidak menambahkan pesanan uji ke kantor.
