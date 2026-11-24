# Higround finance: laporan laba rugi bulanan

Laporan laba rugi Higround Harapan Indah dibuat dari tiga sumber, lalu ditulis ke Google Sheet laporan.

| Sumber | Isi | Di mana |
|---|---|---|
| Purchasing Form v2 | Semua pengeluaran: belanja, gaji, aset/renovasi/cicilan | Spreadsheet "Purchasing Form", tab `Form Responses 2` (ID: `data/ids.json` → `purchasing_form_sheet`) |
| Mutasi BCA | Setoran QRIS/EDC/ShopeeFood/GoFood/Grab, transfer keluar, biaya bank, listrik/air/internet | Export CSV rekening, diupload tiap akhir bulan |
| LunaPOS | Penjualan, diskon, PB1, per tipe dan per metode bayar | PDF "Ringkasan Penjualan", diupload tiap akhir bulan |
| Bon cash | Foto nota belanja pakai uang cash | Folder Drive "Invoice Offline" (ID: `data/ids.json` → `folder_bon_cash`) |

Laporan: Google Sheet (ID: `data/ids.json` → `laporan_sheet`) (tab Laba Rugi, Transaksi, Perlu Review, Penjualan, Mutasi BCA, Asumsi, Data Sources).

## Aturan pencatatan

- **Basis bulan = bulan pengajuan form** (timestamp). Mutasi BCA dipakai untuk mengecek, bukan untuk menghitung beban. Pengajuan bulan lalu yang baru ditransfer bulan ini muncul di Mutasi sebagai "Bayar pengajuan bulan lalu" dan tidak dihitung lagi.
- **Gaji** masuk bulan sesuai "Periode gaji". Kalau belum ada pengajuan gaji bulan itu, Laba Rugi memakai estimasi gaji acuan × faktor pro-rata (tab Asumsi).
- **Sewa** Rp75 jt/tahun, dibagi rata per bulan. **Cadangan THR** 1/12 gaji.
- **Aset** (alat, furnitur, renovasi) tidak jadi beban; disusutkan garis lurus sesuai umur pakai di form. **Cicilan** dan deposit tidak masuk laba rugi.
- **PB1** bukan pendapatan. Penjualan bersih = penjualan LunaPOS − diskon + pembulatan.
- **Perlu review** muncul kalau: kategori belum jelas, vendor baru > Rp500 rb, tanpa bukti > Rp500 rb, Lain-lain > Rp500 rb, nota bulan lalu, pengajuan yang tidak ketemu di mutasi, transfer BCA tanpa pengajuan, atau uang masuk di luar POS. Pemilik memutuskan lewat dropdown Kategori/Status di tab Transaksi.

## Checklist bulanan

**Pemilik (akhir bulan, ±10 menit)**
1. Export mutasi BCA 1 bulan penuh (CSV).
2. Export LunaPOS "Ringkasan Penjualan" 1 bulan penuh (PDF). File "Penjualan" per transaksi tidak perlu.
3. Upload keduanya ke chat (atau folder Drive yang disepakati) dan minta Claude menjalankan laporan bulan itu.
4. Setelah laporan jadi, cek tab **Perlu Review**, pilih kategori/status di tab Transaksi.

**Claude (menjalankan laporan bulan `YYYY-MM`)**
1. Simpan input ke `data/YYYY-MM/` (folder ini di-gitignore, jangan di-commit):
   - `bca.csv` = CSV mutasi BCA
   - `luna.pdf` = PDF Ringkasan Penjualan LunaPOS
   - `form_v2.csv` = tab `Form Responses 2` di-download sebagai CSV (Google Sheets: File > Download > CSV), atau `form_v2.json` = hasil `get_values` `'Form Responses 2'!A:AI` (seluruh histori, header ikut)
   - `manual.json` (opsional) = baris transaksi yang sudah dikategorikan manual; dipakai untuk November 2026 (sebelum form v2)
2. Bon cash: lihat folder Invoice Offline. Foto hanya dibaca kalau belanja cash itu **tidak** ada di form (cara bayar "Kas kecil"); hasilnya ditambahkan ke `manual.json` (format 11 kolom tab Transaksi).
3. Jalankan:
   ```bash
   python3 test_form_v2.py
   python3 run_month.py YYYY-MM
   ```
   Baris "Cek" harus berakhir `= 0`. Kalau muncul "PERHATIAN: metode/tipe LunaPOS baru", tambahkan petanya di `run_month.py` dan sel Penjualan.
4. Sebelum menulis, **arsipkan bulan sebelumnya** kalau belum: `duplicateSheet` tab Laba Rugi dan Transaksi menjadi `LR <Bulan Tahun>` / `Trx <Bulan Tahun>`, lalu ubah isinya jadi nilai (copyPaste `PASTE_VALUES`).
5. Tulis `data/YYYY-MM/payload.json` ke sheet laporan: kosongkan semua range di `clear` (batch_clear_values), lalu tiap item `write` dengan `update_formulas` (range dan values apa adanya).
6. Verifikasi dengan `get_values` `'Laba Rugi'!A1:C59`: dua baris "Selisih ... (harus 0)" bernilai `-`, tidak ada `#REF!`/`#N/A`.
7. Laporkan ke pemilik: laba sementara, total Perlu Review, dan hal yang perlu diputuskan.

## Kontrak tata letak sheet

`run_month.py` menulis ke sel tetap. Kalau posisi ini diubah di sheet, ubah juga di `run_month.py`.

| Tab | Ditulis script |
|---|---|
| Asumsi | B5:B6 periode, B8 hari dalam bulan, B15 penyusutan (rumus), A46:E daftar aset aktif |
| Penjualan | B4:B11 ringkasan, B14:B17 per tipe, B22:B26 per metode bayar |
| Transaksi | A5:M (13 kolom; L = nomor review, M = Tercatat di BCA: Ya / Belum / Kas) |
| Mutasi BCA | A5:I (I = nomor review) |

Rumus Laba Rugi menjumlah tab Transaksi per nama kategori (kolom A Laba Rugi harus sama persis dengan daftar kategori di `config.json`).

## File

- `data/ids.json` (lokal, tidak di-commit): ID spreadsheet Purchasing Form, sheet laporan, folder bon cash. Kalau hilang, minta ke pemilik.
- `config.json`: sewa, asumsi komisi, batas review, pemetaan kategori form, aturan klasifikasi mutasi BCA.
- `hgfin.py`: parser BCA, LunaPOS, form v2; pencocokan form ↔ mutasi; aturan review; daftar aset.
- `run_month.py`: menyusun `payload.json` untuk sheet dan ringkasan cek.
- `test_form_v2.py`: tes cepat dengan data palsu.
