"""Smoke test for the form v2 parser and reconciliation (fake data, no real files needed)."""
import datetime as dt
import hgfin

H = ["Timestamp","Nama pengaju","Cabang","Jenis pengajuan","Tanggal nota","Kategori","Vendor / toko","Nama vendor lain",
     "Rincian barang / jasa","Nominal total (Rp)","Cara bayar","Rekening tujuan","Catatan (opsional)","Nama karyawan",
     "Periode gaji","Gaji pokok (Rp)","Lembur / tunjangan / bonus (Rp)","Potongan (Rp)","BPJS yang ditanggung toko (Rp)",
     "Total transfer (Rp)","Hari kerja","Rekening tujuan","Jenis","Tanggal nota / tagihan","Vendor","Barang / pekerjaan apa",
     "Nominal (Rp)","Kalau cicilan","Perkiraan umur pakai","Cara bayar","Rekening tujuan","Catatan (opsional)",
     "Upload Invoice/Photo","Upload Slip Gaji","Upload Invoice"]
def row(**kw):
    r = [""] * 35
    for k, v in kw.items():
        r[int(k[1:])] = v
    return r
V = [H,
     row(c0="12/2/2026 09:00:00", c1="Wilnardo", c3="Belanja / biaya operasional", c4="12/2/2026",
         c5="Bahan minuman (kopi, susu, ...)", c6="Espuga Utama (es batu)", c8="Es kristal", c9="22000",
         c10="Reimburse (dibayar pakai uang pribadi dulu)", c32="https://drive.google.com/open?id=x"),
     row(c0="12/2/2026 10:00:00", c1="Wilnardo", c3="Belanja / biaya operasional", c4="11/28/2026",
         c5="Utilities (listrik, ...)", c6="Lainnya (tulis di bawah)", c7="PLN", c8="Token listrik", c9="750000",
         c10="Transfer langsung ke vendor"),
     row(c0="12/2/2026 11:00:00", c1="Wilnardo", c3="Belanja / biaya operasional", c4="12/2/2026",
         c5="Packaging (gelas, ...)", c6="Toko plastik", c8="Gelas", c9="78000", c10="Kas kecil / uang cash toko"),
     row(c0="12/31/2026 18:00:00", c1="Noriva", c3="Gaji karyawan", c13="Karyawan A", c14="Desember 2026", c15="2400000",
         c16="0", c17="0", c18="100000", c19="2400000"),
     row(c0="12/5/2026 12:00:00", c1="Andreas", c3="Aset / renovasi / cicilan", c22="Beli alat / mesin", c23="12/5/2026",
         c24="Toko mesin", c25="Grinder", c26="12000000", c28="4 tahun", c29="Transfer langsung ke vendor")]
items = hgfin.parse_form_v2(V)
assert [i["kategori"] for i in items] == ["COGS - Bahan Minuman", "Utilities", "COGS - Packaging",
                                         "Gaji & Tunjangan", "Aset (disusutkan)"], [i["kategori"] for i in items]
assert items[3]["nominal"] == 2500000 and items[3]["periode"] == (2026, 12)
bca = [{"date": dt.datetime(2026, 12, 3), "desc": "TRSF E-BANKING DB WILNARDO", "typ": "DB", "amt": 22000.0,
        "bruto": 22000.0, "mdr": 0, "kat": "Pengeluaran (lihat Transaksi)", "note": ""},
       {"date": dt.datetime(2026, 12, 6), "desc": "TRSF E-BANKING DB TOKO MESIN", "typ": "DB", "amt": 12000000.0,
        "bruto": 12000000.0, "mdr": 0, "kat": "Pengeluaran (lihat Transaksi)", "note": ""},
       {"date": dt.datetime(2026, 12, 20), "desc": "TRSF E-BANKING DB INDIHOME", "typ": "DB", "amt": 350000.0,
        "bruto": 350000.0, "mdr": 0, "kat": "Pengeluaran (lihat Transaksi)", "note": ""}]
hgfin.reconcile(items, bca, 2026, 12)
rows = [i for i in items if hgfin.in_month(i, 2026, 12)]
for i in rows:
    hgfin.flag(i, 2026, 12)
by = {i["item"]: i for i in rows}
assert by["Es kristal"]["bca"] and by["Es kristal"]["status"] == "OK"
assert by["Token listrik"]["status"] == "Perlu review"          # nota bulan lalu + belum ketemu di BCA
assert by["Gelas"]["status"] == "OK" and "bca" not in by["Gelas"]  # kas kecil tidak dicocokkan
indi = [i for i in rows if i["jenis"] == "bca"]
assert len(indi) == 1 and indi[0]["kategori"] == "Utilities"      # tagihan internet tanpa form
assert len(hgfin.aset_aktif(items, 2027, 1)) == 1 and hgfin.aset_aktif(items, 2027, 1)[0]["umur"] == 4
print("OK: form v2 parser, reconcile, flags, aset")
