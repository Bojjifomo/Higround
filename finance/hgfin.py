"""Higround finance: parse sources, reconcile, and build the monthly P&L workbook.

Inputs live in data/<YYYY-MM>/ (git-ignored, see README.md):
  bca.csv            BCA statement export for the month
  luna.pdf           LunaPOS "Ringkasan Penjualan" PDF
  form_v2.json       values of 'Form Responses 2' (header row included), all history
  manual.json        optional: already-categorised rows (used for Nov 2026, before form v2)
  asumsi.json        optional: {"gaji_acuan": <angka>, "gaji_acuan_sumber": "..."}
"""
import calendar
import csv
import datetime as dt
import itertools
import json
import re
from pathlib import Path

HERE = Path(__file__).resolve().parent
CFG = json.loads((HERE / "config.json").read_text())

OK, RV = "OK", "Perlu review"


# ---------------------------------------------------------------- helpers
def rupiah(s):
    """'432,600' / '432.600' / '277500 (Bun Burger)' / 432600 -> 432600.0"""
    if isinstance(s, (int, float)):
        return float(s)
    m = re.search(r"\d[\d.,]*", str(s or ""))
    if not m:
        return 0.0
    t = m.group(0)
    if re.search(r"[.,]\d{1,2}$", t) and not re.search(r"[.,]\d{3}$", t):
        t = t[: -3]  # drop decimal part like ,00
    return float(re.sub(r"[.,]", "", t) or 0)


def tgl(s):
    """Form dates are M/D/YYYY (en_US), sometimes with time. Returns datetime or None."""
    if not s:
        return None
    if isinstance(s, dt.datetime):
        return s
    s = str(s).strip()
    for f in ("%m/%d/%Y %H:%M:%S", "%m/%d/%Y", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return dt.datetime.strptime(s, f)
        except ValueError:
            pass
    return None


BULAN = {m: i for i, m in enumerate(
    ["januari", "februari", "maret", "april", "mei", "juni", "juli", "agustus",
     "september", "oktober", "november", "desember"], 1)}
BULAN.update({"jan": 1, "feb": 2, "mar": 3, "apr": 4, "jun": 6, "jul": 7, "agu": 8, "aug": 8,
              "sep": 9, "okt": 10, "oct": 10, "nov": 11, "des": 12, "dec": 12})


def periode_bulan(s, fallback):
    """'November 2026' -> (2026, 11)."""
    t = str(s or "").lower()
    y = re.search(r"20\d\d", t)
    for k, v in BULAN.items():
        if re.search(rf"\b{k}", t):
            return (int(y.group(0)) if y else fallback[0], v)
    return fallback


def map_prefix(text, table, default="Belum dikategorikan"):
    for k, v in table.items():
        if str(text or "").lower().startswith(k.lower()):
            return v
    return default


# ---------------------------------------------------------------- BCA
def parse_bca(path, year, month):
    rows = list(csv.reader(open(path, encoding="latin-1")))
    out = []
    for r in rows:
        if len(r) < 5 or not r[0].startswith("'") or r[4] not in ("CR", "DB"):
            continue
        raw, desc, amt, typ = r[0][1:], re.sub(r"\s+", " ", r[1]).strip(), float(r[3]), r[4]
        note = ""
        if raw == "PEND":
            date = dt.datetime(year, month, calendar.monthrange(year, month)[1])
            note = "Pending di mutasi. "
        else:
            d, m, y = raw.split("/")
            date = dt.datetime(int(y), int(m), int(d))
        bruto, kat = amt, ""
        up = desc.upper()
        if typ == "CR":
            for pat, k in CFG["bca_masuk"]:
                if pat in up:
                    kat = k
                    break
            if kat == "Setoran QRIS":
                bruto = float(re.search(r"QR :\s*([\d.]+)", desc).group(1))
                m2 = re.search(r"TANGGAL :(\d\d)/(\d\d)", desc)
                if m2 and int(m2.group(2)) != month:
                    kat = "Setoran QRIS (penjualan bulan lain)"
            elif kat == "Setoran EDC debit":
                bruto = float(re.search(r"TGH:\s*([\d.]+)", desc).group(1))
            elif kat == "Setoran kartu kredit":
                bruto = float(re.search(r"TGH:0*([\d.]+)", desc).group(1))
            elif not kat and amt in CFG["nominal_tiket_yoga"]:
                kat = "Pendapatan kelas yoga"
            elif not kat:
                kat = "Perlu review"
                note += "Uang masuk di luar POS. Pendapatan apa?"
        else:
            kat = "Pengeluaran (lihat Transaksi)"
            for pat, k in CFG["bca_keluar_tanpa_form"]:
                if pat in up and k == "Biaya Bank":
                    kat = "Biaya bank"
                    break
        out.append({"date": date, "desc": desc[:90], "typ": typ, "amt": amt, "bruto": bruto,
                    "mdr": round(bruto - amt, 2) if bruto != amt else 0.0, "kat": kat,
                    "note": note.strip()})
    return out


# ---------------------------------------------------------------- LunaPOS
def parse_luna(pdf_path):
    import subprocess
    txt = subprocess.run(["pdftotext", "-layout", str(pdf_path), "-"],
                         capture_output=True, text=True, check=True).stdout

    def val(label, text=txt):
        m = re.search(rf"^\s*{label}\s+Rp\.\s*([\d.]+),\d\d", text, re.M)
        return float(m.group(1).replace(".", "")) if m else 0.0

    per = re.search(r"(\d\d/\d\d/\d{4})\s*-\s*(\d\d/\d\d/\d{4})", txt)
    start, end = (dt.datetime.strptime(x, "%d/%m/%Y") for x in per.groups())
    tipe_blk = txt.split("Ringkasan Berdasarkan Tipe Penjualan", 1)[1].split("TOTAL", 1)[0]
    bayar_blk = txt.split("Ringkasan Berdasarkan Pembayaran", 1)[1].split("TOTAL", 1)[0]
    pairs = lambda blk: {k.strip(): float(v.replace(".", ""))
                         for k, v in re.findall(r"^\s*([A-Za-z][\w \-]+?)\s+Rp\.\s*([\d.]+),\d\d", blk, re.M)}
    inv = re.search(r"Jumlah Invoice\s+([\d.]+)", txt)
    void_blk = txt.split("Ringkasan Void", 1)[1]
    return {
        "start": start, "end": end,
        "penjualan": val("Total Penjualan"), "diskon": val("Total Diskon"),
        "service": val("Total Service"), "pajak": val("Total Pajak"),
        "penyesuaian": val("Total Penyesuaian"), "total": val("TOTAL"),
        "invoice": int(inv.group(1).replace(".", "")) if inv else 0,
        "void": val("TOTAL", void_blk),
        "tipe": pairs(tipe_blk), "bayar": pairs(bayar_blk),
    }


# ---------------------------------------------------------------- Form v2
def parse_form_v2(values):
    """values = get_values of 'Form Responses 2'!A:AI (header first)."""
    h = values[0]
    assert h[9].startswith("Nominal total") and h[19].startswith("Total transfer") \
        and h[26].startswith("Nominal"), "Kolom form v2 berubah, cek urutan kolom"
    items = []
    for r in values[1:]:
        r = list(r) + [""] * (35 - len(r))
        ts = tgl(r[0])
        if not ts:
            continue
        jenis = r[3].lower()
        base = {"ts": ts, "pengaju": r[1], "ref": f"Form {ts:%d/%m %H:%M}"}
        if jenis.startswith("belanja"):
            vendor = r[7] if r[6].startswith("Lainnya") and r[7] else r[6]
            items.append({**base, "tgl_nota": tgl(r[4]), "vendor": vendor, "item": r[8],
                          "nominal": rupiah(r[9]), "kategori": map_prefix(r[5], CFG["kategori_form"]),
                          "cara": r[10], "rek": r[11], "catatan": r[12], "bukti": r[32],
                          "vendor_lain": r[6].startswith("Lainnya"), "jenis": "belanja"})
        elif jenis.startswith("gaji"):
            total = rupiah(r[19]) + rupiah(r[18])
            items.append({**base, "tgl_nota": None, "vendor": r[13], "item": f"Gaji {r[14]} ({r[20]})",
                          "nominal": total, "kategori": "Gaji & Tunjangan", "cara": "Transfer",
                          "rek": r[21], "catatan": "Total transfer + BPJS toko", "bukti": r[33],
                          "periode": periode_bulan(r[14], (ts.year, ts.month)), "jenis": "gaji",
                          "bpjs": rupiah(r[18]), "transfer": rupiah(r[19])})
        elif jenis.startswith("aset"):
            umur = re.search(r"\d+", r[28] or "")
            items.append({**base, "tgl_nota": tgl(r[23]), "vendor": r[24], "item": f"{r[22]}: {r[25]}",
                          "nominal": rupiah(r[26]), "kategori": map_prefix(r[22], CFG["jenis_aset"]),
                          "cara": r[29], "rek": r[30], "catatan": r[31] + (f" Cicilan {r[27]}." if r[27] else ""),
                          "bukti": r[34], "umur": int(umur.group(0)) if umur else CFG["umur_aset_default_tahun"],
                          "jenis": "aset"})
    return items


def manual_items(rows):
    """Rows in the 11-column Transaksi layout (used for Nov 2026)."""
    out = []
    for r in rows:
        out.append({"ts": tgl(r[0]), "tgl_nota": tgl(r[1]), "pengaju": r[2], "vendor": r[3], "item": r[4],
                    "nominal": float(r[5]), "kategori": r[6], "status": r[7], "catatan": r[8], "ref": r[9],
                    "bukti": r[10], "cara": "Transfer", "jenis": "manual"})
    return out


# ---------------------------------------------------------------- reconcile
def reconcile(items, bca, year, month):
    """Match outgoing BCA rows to form items. Mutates items/bca. Basis: month of submission."""
    lo, hi = CFG["jendela_cocok_hari"]
    tol = CFG["toleransi_biaya_transfer_rp"]
    ms = dt.datetime(year, month, 1)
    payable = [i for i in items if not str(i.get("cara", "")).lower().startswith("kas")
               and i["ts"] and i["ts"] >= ms - dt.timedelta(days=15)]
    for i in payable:
        i["bca"] = None
    # one unit per form submission: manual rows (split per receipt) are grouped by their form ref
    units, by_ref = [], {}
    for i in payable:
        key = i["ref"] if i["jenis"] == "manual" else id(i)
        if key not in by_ref:
            by_ref[key] = {"ts": i["ts"], "nominal": 0.0, "items": []}
            units.append(by_ref[key])
        u = by_ref[key]
        u["nominal"] += i["nominal"]
        u["items"].append(i)
        u["ts"] = min(u["ts"], i["ts"])
    for u in units:
        u["bca"] = None
    db = [b for b in bca if b["typ"] == "DB" and b["kat"] != "Biaya bank"]
    for b in db:
        b["match"] = []

    def in_win(u, b):
        return lo <= (b["date"] - u["ts"].replace(hour=0, minute=0, second=0)).days <= hi

    def take(b, us):
        b["match"] = us
        for u in us:
            u["bca"] = b["date"]
            for i in u["items"]:
                i["bca"] = b["date"]

    fees = []
    # 1) exact single matches, nearest date first
    pairs = sorted(((abs((b["date"] - u["ts"]).days), n, m) for n, u in enumerate(units)
                    for m, b in enumerate(db) if in_win(u, b) and abs(b["amt"] - u["nominal"]) < 0.5))
    for _, n, m in pairs:  # globally closest pairs first, so a later twin does not steal a match
        if units[n]["bca"] is None and not db[m]["match"]:
            take(db[m], [units[n]])
    # 2) one transfer paying several submissions (batch reimburse)
    for b in db:
        if b["match"]:
            continue
        cands = sorted([u for u in units if u["bca"] is None and in_win(u, b) and u["nominal"] < b["amt"]],
                       key=lambda u: abs((b["date"] - u["ts"]).days))[:18]
        for n in range(2, 8):
            hit = next((c for c in itertools.combinations(cands, n)
                        if abs(sum(x["nominal"] for x in c) - b["amt"]) < 0.5), None)
            if hit:
                take(b, list(hit))
                break
    # 3) virtual-account payments where the bank adds a fee on top
    for u in sorted(units, key=lambda x: x["ts"]):
        if u["bca"] is not None:
            continue
        cands = [b for b in db if not b["match"] and in_win(u, b) and 0 < b["amt"] - u["nominal"] <= tol]
        if cands:
            b = min(cands, key=lambda b: b["amt"] - u["nominal"])
            take(b, [u])
            fees.append((b, b["amt"] - u["nominal"]))
    for b, fee in fees:
        items.append({"ts": b["date"], "tgl_nota": None, "pengaju": "", "vendor": "BCA",
                      "item": "Selisih biaya transfer/VA", "nominal": fee, "kategori": "Biaya Bank",
                      "status": OK, "catatan": f"Mutasi Rp{b['amt']:,.0f} vs pengajuan Rp{b['amt']-fee:,.0f}",
                      "ref": f"Mutasi BCA {b['date']:%d/%m}", "bukti": "", "cara": "Transfer", "bca": b["date"],
                      "jenis": "bca"})
    # 3) leftovers
    for b in db:
        if b["match"]:
            if all(m["ts"] < ms for m in b["match"]):
                b["kat"] = "Bayar pengajuan bulan lalu"
            continue
        kat = "Belum dikategorikan"
        for pat, k in CFG["bca_keluar_tanpa_form"]:
            if pat in b["desc"].upper():
                kat = k
                break
        items.append({"ts": b["date"], "tgl_nota": None, "pengaju": "", "vendor": b["desc"][:40],
                      "item": "Uang keluar di BCA tanpa pengajuan form", "nominal": b["amt"], "kategori": kat,
                      "status": OK if kat != "Belum dikategorikan" else RV,
                      "catatan": "" if kat != "Belum dikategorikan" else "Tidak ada pengajuan form yang cocok. Bayar apa?",
                      "ref": f"Mutasi BCA {b['date']:%d/%m}", "bukti": "", "cara": "Transfer", "bca": b["date"],
                      "jenis": "bca"})
        b["match"] = ["bca"]


def flag(i, year, month):
    """Review rules for items that are not already decided."""
    if i.get("status"):
        return
    notes, lim = [], CFG["batas_review_rp"]
    if i["kategori"] == "Belum dikategorikan":
        notes.append("Kategori belum jelas.")
    if i.get("vendor_lain") and i["nominal"] > lim:
        notes.append("Vendor baru di atas batas review.")
    if not i.get("bukti") and i["nominal"] > lim and i["jenis"] != "bca":
        notes.append("Tanpa bukti, nominal di atas batas review.")
    if i["kategori"] == "Lain-lain" and i["nominal"] > lim:
        notes.append("Lain-lain di atas batas review.")
    if i.get("tgl_nota") and (i["tgl_nota"].year, i["tgl_nota"].month) < (year, month):
        notes.append(f"Nota {i['tgl_nota']:%B %Y}, diajukan bulan ini. Tetap di sini (basis kas) atau Beban Bulan Lain?")
    if i.get("jenis") in ("belanja", "aset", "manual") and "bca" in i and i["bca"] is None:
        notes.append("Belum ketemu di mutasi BCA (rekening lain / dibayar bulan depan?).")
    i["status"] = RV if notes else OK
    i["catatan"] = (str(i.get("catatan") or "") + " " + " ".join(notes)).strip()


def in_month(i, year, month):
    if i["jenis"] == "gaji":
        return i["periode"] == (year, month)
    return (i["ts"].year, i["ts"].month) == (year, month)


def aset_aktif(items, year, month):
    """Assets from all form history, depreciated straight-line from the month after purchase."""
    out = []
    for i in items:
        if i["kategori"] != "Aset (disusutkan)":
            continue
        d = i["tgl_nota"] or i["ts"]
        start = (d.year * 12 + d.month)  # depreciate from purchase month
        now = year * 12 + month
        if start <= now < start + i["umur"] * 12:
            out.append({"tgl": d, "nama": i["item"], "nominal": i["nominal"], "umur": i["umur"]})
    return out
