# Analitik aktivitas PIC

Admin `/admin` menampilkan dashboard aktivitas. Status koneksi dan pintasan lama dipindahkan ke Status sistem. Filter: tanggal WIB (maksimal 93 hari), PIC, fitur. Widget dapat disembunyikan/disimpan di browser Admin, tabel diurutkan, dan ringkasan PIC diekspor CSV. Grafik tren, komposisi fitur, jam penggunaan, statistik per PIC, serta 50 aktivitas terbaru diperbarui tiap 60 detik saat halaman terlihat.

Pencatatan dimulai ketika PIC membuka versi baru. Tidak merekonstruksi sejarah sebelumnya. Sesi memakai ID per tab dan PIC; kunjungan halaman, upload/salin/update Tarik Data, upload/salin/unduh Hasil Laporan, pembukaan draf chat, dan Hasil Kerja dicatat setelah tindakan berhasil. Menghitung frekuensi tindakan, bukan hasil kinerja, pengiriman pesan, atau jumlah laporan unik. Profil PIC dipilih tanpa login personal seperti arsitektur sebelumnya, sehingga metrik adalah aktivitas profil terpilih dan bukan bukti identitas.

Heartbeat tiap menit hanya menambah estimasi waktu aktif jika tab terlihat, fokus, dan memiliki interaksi dalam 2 menit terakhir. Dapat terhitung dari beberapa tab/perangkat; tidak dianggap jam kerja definitif. Browser mengirim antrean maksimal 20 kejadian per permintaan, retry ID yang sama untuk deduplikasi, dan membatasi antrean sementara 100 kejadian. Kegagalan analitik tidak mengganggu pekerjaan utama; aktivitas saat gangguan panjang dapat tidak tercatat.

Server memvalidasi jenis tindakan, fitur, PIC terdaftar, batas angka, dan Origin. Waktu pencatatan ditentukan server (termasuk saat pengiriman tertunda). Tidak menyimpan nama file, isi CSV, pesan, nomor telepon atau informasi pelanggan. POST `/api/activity` memakai pola profil publik yang sudah ada; GET `/api/admin/analytics` wajib sesi Admin. Tabel `sapa_pic_activity` memiliki RLS tanpa policy publik, semua grant anon/authenticated dicabut. Agregasi `sapa_activity_summary` security invoker hanya diizinkan untuk service_role. API key server tidak dikirim ke browser.

Schema: `supabase/schema/pic-activity.sql`, migration remote `pic_activity_analytics`. Contoh data pengujian SQL dijalankan dengan ROLLBACK agar tidak masuk statistik nyata.
