"""Turn one month's inputs into the cell payloads for the Higround P&L Google Sheet.

    python run_month.py 2026-12            # reads data/2026-12/, writes data/2026-12/payload.json

payload.json holds {"clear": [...ranges], "write": [{"range": ..., "values": [[...]]}, ...]}.
Claude writes it to the sheet with the Google Sheets connector (see README.md, step 4).
"""
import calendar
import csv
import datetime as dt
import json
import sys
from pathlib import Path

import hgfin
from hgfin import CFG, OK, RV

DATA = Path(__file__).resolve().parent / "data"
LUNA_BAYAR = {"Cash": "B22", "EDC": "B23", "Shopee-Pay": "B24", "Go-Food": "B25", "Grab-Food": "B26"}
LUNA_TIPE = {"Normal": "B14", "GoFood": "B15", "GrabFood": "B16", "ShopeeFood": "B17"}
MAXROW = 600  # helper formulas are written down to this row


def link(urls):
    url = str(urls or "").split(",")[0].strip()
    return f'=HYPERLINK("{url}","Buka bukti")' if url else ""


def d(x):
    return x.strftime("%Y-%m-%d") if x else ""


def main(month):
    year, mon = map(int, month.split("-"))
    src = DATA / month
    bca = hgfin.parse_bca(src / "bca.csv", year, mon)
    luna = hgfin.parse_luna(src / "luna.pdf")

    items = []
    if (src / "manual.json").exists():
        items += hgfin.manual_items(json.loads((src / "manual.json").read_text()))
    history = []
    form_csv, form_json = src / "form_v2.csv", src / "form_v2.json"
    if form_csv.exists():  # Google Sheets > File > Download > CSV of tab 'Form Responses 2'
        history = hgfin.parse_form_v2(list(csv.reader(open(form_csv, encoding="utf-8-sig"))))
    elif form_json.exists():
        history = hgfin.parse_form_v2(json.loads(form_json.read_text()))
    items += history
    hgfin.reconcile(items, bca, year, mon)
    rows = [i for i in items if hgfin.in_month(i, year, mon)]
    for i in rows:
        hgfin.flag(i, year, mon)
    rows.sort(key=lambda i: (i["bca"] or i["ts"]) if "bca" in i else i["ts"])

    def tercatat(i):
        if str(i.get("cara", "")).lower().startswith("kas"):
            return "Kas"
        return "Ya" if i.get("bca") else "Belum"

    trx = [[d(i.get("bca") or i["ts"]), d(i.get("tgl_nota")), i.get("pengaju", ""), i["vendor"], i["item"],
            i["nominal"], i["kategori"], i["status"], i.get("catatan", ""), i.get("ref", ""),
            link(i.get("bukti", "")), None, tercatat(i)] for i in rows]
    for n, r in enumerate(trx, 5):
        r[11] = f'=IF($H{n}="Perlu review",COUNTIF($H$5:$H{n},"Perlu review"),"")'
    helper_trx = [[f'=IF($H{n}="Perlu review",COUNTIF($H$5:$H{n},"Perlu review"),"")']
                  for n in range(5 + len(trx), MAXROW + 1)]

    mut = [[d(b["date"]), b["desc"], b["typ"], b["amt"], b["bruto"], b["mdr"], b["kat"], b["note"], None]
           for b in bca]
    for n, r in enumerate(mut, 5):
        r[8] = f'=IF($G{n}="Perlu review",COUNTIF($G$5:$G{n},"Perlu review"),"")'

    days = calendar.monthrange(year, mon)[1]
    write = [
        {"range": "Asumsi!B5:B6", "values": [[d(luna["start"])], [d(luna["end"])]]},
        {"range": "Asumsi!B8", "values": [[days]]},
        {"range": "Penjualan!B4:B11", "values": [[luna["penjualan"]], [luna["diskon"]], [luna["service"]],
                                                 [luna["pajak"]], [luna["penyesuaian"]], ["=B4-B5+B6+B7+B8"],
                                                 [luna["invoice"]], [luna["void"]]]},
        {"range": "Transaksi!A5:M" + str(4 + max(len(trx), 1)), "values": trx or [[""] * 13]},
        {"range": f"Transaksi!L{5 + len(trx)}:L{MAXROW}", "values": helper_trx},
        {"range": "'Mutasi BCA'!A5:I" + str(4 + len(mut)), "values": mut},
    ]
    for k, cell in LUNA_TIPE.items():
        write.append({"range": f"Penjualan!{cell}", "values": [[luna["tipe"].get(k, 0)]]})
    for k, cell in LUNA_BAYAR.items():
        write.append({"range": f"Penjualan!{cell}", "values": [[luna["bayar"].get(k, 0)]]})

    aset = hgfin.aset_aktif(history, year, mon)
    write.append({"range": f"Asumsi!A46:E{47 + len(aset)}", "values":
                  [["Daftar aset aktif", "", "", "", ""], ["Tanggal", "Aset", "Nominal", "Umur (tahun)", "Penyusutan/bulan"]] +
                  [[d(a["tgl"]), a["nama"], a["nominal"], a["umur"], f"=C{48 + n}/(D{48 + n}*12)"]
                   for n, a in enumerate(aset)]})
    write.append({"range": "Asumsi!B15", "values": [["=SUM(E48:E200)"]]})

    unknown = sorted(set(luna["bayar"]) - set(LUNA_BAYAR)) + sorted(set(luna["tipe"]) - set(LUNA_TIPE))
    payload = {"month": month,
               "clear": ["Transaksi!A5:M1000", "'Mutasi BCA'!A5:I1000", "Asumsi!A46:E200"],
               "write": write}
    (src / "payload.json").write_text(json.dumps(payload, ensure_ascii=False, default=str))

    # ---- summary for the person running it
    tot = lambda f: sum(i["nominal"] for i in rows if f(i))
    db = sum(b["amt"] for b in bca if b["typ"] == "DB")
    fee = sum(b["amt"] for b in bca if b["kat"] == "Biaya bank")
    prev = sum(b["amt"] for b in bca if b["kat"] == "Bayar pengajuan bulan lalu")
    ya = tot(lambda i: tercatat(i) == "Ya")
    print(f"Periode LunaPOS {luna['start']:%d/%m}-{luna['end']:%d/%m/%Y}, total {luna['total']:,.0f}")
    print(f"Transaksi {len(rows)} baris, total {tot(lambda i: True):,.0f}; perlu review {sum(i['status'] == RV for i in rows)}")
    print(f"Mutasi {len(bca)} baris. Cek: keluar {db:,.0f} - biaya {fee:,.0f} - pengajuan lalu {prev:,.0f} "
          f"- tercatat {ya:,.0f} = {db - fee - prev - ya:,.0f}")
    print(f"Aset aktif {len(aset)}. Payload: {src / 'payload.json'}")
    if unknown:
        print("PERHATIAN: metode/tipe LunaPOS baru, belum dipetakan:", unknown)


if __name__ == "__main__":
    main(sys.argv[1])
