"""Generate run-club/config/world_layout.json and reference/floorplan.svg (+png via rsvg-convert).
Units: meters. x = 0 (left wall, viewed from street) .. 5 ; y = 0 (front facade) .. 18 (back wall).
Street/terrace scene uses negative y. 1 tile = 0.5 m  ->  10 x 36 tiles per floor.
"""
import json, subprocess, sys
from pathlib import Path

OUT = Path(sys.argv[1])

# kind: zone (area), poi (interactive object), deco (ornament), wall_art, struct (stairs/walls/door)
def item(key, label, kind, x, y, w, h, **kw):
    d = {"key": key, "label": label, "kind": kind, "x": x, "y": y, "w": w, "h": h}
    d.update(kw)
    return d

street = [
    item("street_road", "Jalan", "zone", 0, -6, 5, 2.2, color="#6f6d6a"),
    item("sidewalk", "Trotoar + parkir motor", "zone", 0, -3.8, 5, 3.8, color="#b9b4ab"),
    item("start_gate", "START GATE Higround Run Club", "poi", 2.6, -3.6, 2.2, 0.5, color="#FF5F0E",
         actions=["stretch", "run_start", "run_return"], note="Gerbang lengkung oranye, banner HIGROUND RUN CLUB, papan jarak 0 KM"),
    item("stretch_spot", "Spot stretching", "poi", 2.8, -2.9, 1.8, 1.0, color="#ffd2b8", actions=["stretch"]),
    item("scooters", "Motor parkir + helm", "deco", 0.1, -3.6, 2.2, 1.4, color="#4a4a4a"),
    item("sandwich_board", "Sandwich board event/menu", "poi", 1.9, -1.3, 0.5, 0.3, color="#2b2b2b", actions=["open_events"]),
    item("cone", "Cone oranye + rantai", "deco", 1.4, -0.9, 0.3, 0.3, color="#FF5F0E"),
    item("plants_terrace", "Tanaman pot besar (calathea, palem)", "deco", 4.0, -1.4, 1.0, 1.3, color="#4f8a4b"),
    item("hydration_out", "Galon air + gelas (Run Club)", "poi", 0.1, -1.2, 0.5, 0.5, color="#7fb8e0", actions=["drink_water"]),
    item("canopy", "Kanopi seng + paranet (overhead)", "deco", -0.2, -2.2, 5.4, 2.2, color="none", overhead=True),
]

floor1 = [
    item("f1_door", "Pintu kaca", "struct", 0.1, -0.15, 1.3, 0.3, color="#9fd3e6"),
    item("arch_window", "Jendela lengkung COFFEE & BURGER (+ ilustrasi rusa)", "wall_art", 1.8, -0.15, 2.9, 0.3, color="#2c3e50"),
    item("wood_pillar", "Pilar kayu", "deco", 1.45, -0.15, 0.3, 0.3, color="#B07A4A"),
    item("front_dining", "Area makan depan", "zone", 2.0, 0.5, 3.0, 3.2, color="#e8e2d6"),
    item("table_f1", "Meja hitam + 2 kursi putih", "poi", 2.3, 0.9, 0.8, 0.8, color="#2b2b2b", seats=2, actions=["sit", "drink", "eat"]),
    item("table_f2", "Meja hitam + 2 kursi putih", "poi", 3.8, 0.9, 0.8, 0.8, color="#2b2b2b", seats=2, actions=["sit", "drink", "eat"]),
    item("table_f3", "Meja hitam + 2 kursi putih", "poi", 3.8, 2.4, 0.8, 0.8, color="#2b2b2b", seats=2, actions=["sit", "drink", "eat"]),
    item("plants_window", "Monstera dekat jendela", "deco", 4.4, 0.1, 0.5, 0.5, color="#4f8a4b"),
    item("chiller", "Chiller minuman botol", "poi", 2.3, 3.9, 0.6, 0.5, color="#dfe7ea", actions=["grab_drink"]),
    item("guest_check", "Poster GUEST CHECK (wajah-wajah pelanggan)", "wall_art", 2.3, 3.75, 0.6, 0.1, color="#f4efe4"),
    item("gelato_kiosk", "Kios HIGROUND COFFEE | POPSICLE GELATO", "poi", 3.7, 4.2, 1.3, 2.4, color="#F7D046",
         actions=["order_gelato"], note="Signage kuning-biru, freezer gelato di bawahnya"),
    item("wood_slat_wall", "Dinding wood slat", "wall_art", 0.0, 3.8, 0.15, 3.9, color="#B07A4A"),
    item("order_counter", "Counter ORDER HERE! (POS, tip jar, toples cookies, 2 grinder)", "poi", 0.5, 4.0, 1.6, 3.5, color="#ffffff",
         stroke="#2E3A8C", actions=["queue", "order", "pay"], staff=True, note="Panel depan navy bertuliskan ORDER HERE!"),
    item("curved_bar", "Bar melengkung bawah tangga (espresso merah, maneki-neko, gumball, saus)", "poi", 0.5, 7.5, 1.9, 3.0, color="#ffffff",
         actions=["pickup_drink"], staff=True, rounded=True,
         note="Plafon miring karena tangga; papan kecil 'IN CASE OF EMERGENCY: BREAKDANCE'"),
    item("mascot_fridges", "2 kulkas wrap maskot Higround (biru)", "poi", 0.0, 7.7, 0.45, 2.4, color="#4B4FB8", actions=["peek"]),
    item("bar_sink", "Sink stainless + rak", "deco", 0.0, 10.1, 0.45, 0.6, color="#c9ced1"),
    item("mid_dining", "Area makan tengah", "zone", 2.6, 7.2, 2.4, 4.0, color="#e8e2d6"),
    item("table_m1", "Meja hitam + 2 kursi", "poi", 2.9, 7.6, 0.8, 0.8, color="#2b2b2b", seats=2, actions=["sit", "drink", "eat"]),
    item("table_m2", "Meja hitam + 2 kursi", "poi", 2.9, 9.4, 0.8, 0.8, color="#2b2b2b", seats=2, actions=["sit", "drink", "eat"]),
    item("table_m3", "Meja hitam + 4 kursi", "poi", 4.0, 8.3, 0.8, 1.4, color="#2b2b2b", seats=4, actions=["sit", "drink", "eat"]),
    item("mascot_banner", "Banner kain maskot oranye 'ONE BITE SAYS IT ALL' + AC", "wall_art", 4.85, 7.4, 0.15, 2.6, color="#FF5F0E"),
    item("run_posters", "Pigura poster Run Club (pengganti poster padel)", "wall_art", 4.85, 10.1, 0.15, 1.0, color="#F7D046"),
    item("stairs", "Tangga ke Lantai 2", "struct", 0.0, 10.8, 1.1, 4.0, color="#9b9893", leads_to="floor2.stairs_top"),
    item("toilet_f1", "Toilet", "struct", 1.25, 12.5, 1.1, 2.3, color="#cfd8dc"),
    item("kids_corner", "KIDS CORNER (lemari mesh merah, buku mewarnai, ring basket mini, board 'Burger MVP')", "poi", 3.3, 11.6, 1.7, 1.9, color="#E0352B",
         actions=["color_book", "shoot_hoop", "vote_burger"]),
    item("book_ledge", "Rak buku ledge (buku menghadap depan, label oranye) + kotak puzzle", "poi", 3.6, 13.7, 1.4, 1.6, color="#B07A4A",
         actions=["read", "puzzle"]),
    item("kitchen", "Dapur burger (oven, deep fryer, rice cooker, meja prep) — staff only", "zone", 0.0, 15.0, 2.2, 3.0, color="#d7d2c8",
         staff_only=True, note="Sesuai kondisi nyata: tanpa air fryer"),
    item("skylight_area", "Light well / skylight", "zone", 2.4, 15.2, 2.6, 2.8, color="#fbf6e9"),
    item("communal_table", "Meja kayu jati panjang + 6 kursi", "poi", 2.9, 15.6, 1.6, 1.9, color="#B07A4A", seats=6,
         actions=["sit", "drink", "eat", "chat"]),
    item("plant_bench", "Bangku kayu dengan tanaman (aglonema)", "deco", 2.5, 17.5, 2.4, 0.45, color="#4f8a4b"),
    item("round_mirror", "Cermin bulat di dinding belakang", "wall_art", 3.4, 17.9, 0.6, 0.1, color="#c7d3da"),
    item("track_lights_f1", "Track light hangat (overhead)", "deco", 0.6, 4.0, 0.1, 6.0, color="none", overhead=True),
]

floor2 = [
    item("balcony", "Balkon besi (tanaman, view jalan)", "zone", 0.6, -1.1, 3.8, 1.1, color="#d9d4ca"),
    item("front_window_f2", "Jendela depan besar (pohon di luar)", "wall_art", 1.5, -0.1, 2.0, 0.2, color="#9fd3e6"),
    item("studio_room", "STUDIO ROOM — Yoga Studio (pagi) / Dine-in (siang-malam)", "zone", 0.0, 0.0, 5.0, 9.0, color="#efe6d0",
         modes={"yoga": {"hours_wib": "06:00-10:00", "days": "Sabtu-Minggu sampai 11:00"},
                "dine": {"hours_wib": "10:00-22:00"}},
         note="Lantai beton gelap, dinding krem, track light, poster warna-warni"),
    item("vinyl_shelf", "Rak vinyl + speaker di bawah jendela", "poi", 1.6, 0.2, 1.8, 0.45, color="#f4efe4", actions=["play_music"]),
    item("yoga_wall", "Yoga wall (untuk Headstand di tembok)", "poi", 0.0, 1.0, 0.2, 3.0, color="#B07A4A", actions=["yoga_inversion"]),
    item("yoga_mats", "Area 6 mat yoga (mode yoga) / 3 meja putih (mode dine)", "poi", 0.8, 1.2, 3.6, 5.0, color="#ffd2b8",
         slots=6, actions=["yoga_pose", "sit", "drink"]),
    item("props_rack", "Rak props: blok, strap, bolster", "deco", 4.5, 0.6, 0.45, 1.6, color="#B07A4A"),
    item("mirror_wall", "Cermin panjang", "wall_art", 4.85, 2.4, 0.15, 3.0, color="#c7d3da"),
    item("wall_desks", "Meja tempel dinding + lampu meja (kiri & kanan)", "poi", 0.0, 6.4, 0.6, 2.2, color="#ffffff",
         seats=2, actions=["sit", "work", "drink"]),
    item("yoga_quest_board", "Papan YOGA QUEST (grid 28 pose, bintang member)", "poi", 4.8, 6.0, 0.2, 2.6, color="#FF5F0E",
         actions=["open_yoga_quest"]),
    item("poster_wall_f2", "Dinding poster ilustrasi", "wall_art", 0.0, 4.3, 0.1, 1.8, color="#F7D046"),
    item("stairs_top", "Ujung tangga dari Lantai 1", "struct", 0.0, 10.8, 1.1, 4.0, color="#9b9893", leads_to="floor1.stairs"),
    item("run_lounge", "RUN CLUB LOUNGE — Sports Hub", "zone", 1.3, 9.2, 3.7, 5.6, color="#ffe6d6"),
    item("bag_cubbies", "Loker / cubby tas member", "poi", 4.4, 9.4, 0.6, 2.2, color="#B07A4A", actions=["store_bag"]),
    item("shoe_rack", "Rak sepatu lari", "deco", 4.4, 11.7, 0.6, 1.0, color="#2b2b2b"),
    item("leaderboard_board", "Papan RUN CLUB WEEK (km komunitas, top mileage, event)", "poi", 1.4, 9.0, 2.6, 0.25, color="#2E3A8C",
         actions=["open_leaderboard", "open_events"]),
    item("stretch_zone", "Matras stretching + foam roller", "poi", 1.6, 10.2, 2.4, 2.0, color="#ffd2b8", actions=["stretch", "foam_roll"]),
    item("hydration_station", "Hydration station (air + elektrolit)", "poi", 1.4, 13.0, 0.7, 0.6, color="#7fb8e0", actions=["drink_water"]),
    item("bench_lounge", "Bangku panjang ganti sepatu", "poi", 2.4, 13.4, 2.2, 0.5, color="#B07A4A", seats=4, actions=["sit", "tie_shoes"]),
    item("medal_wall", "Dinding medali & bib race member + piala maskot", "wall_art", 1.3, 14.75, 3.7, 0.2, color="#F7D046"),
    item("changing_booth", "Bilik ganti", "struct", 2.6, 15.2, 1.2, 1.6, color="#cfd8dc"),
    item("toilet_f2", "Toilet", "struct", 3.9, 15.2, 1.1, 1.6, color="#cfd8dc"),
    item("storage_f2", "Gudang (stok + perlengkapan event)", "struct", 0.0, 15.0, 2.4, 3.0, color="#d7d2c8", staff_only=True),
    item("event_corner", "Pojok event (backdrop foto, gantungan medali finisher)", "poi", 2.6, 16.9, 2.4, 1.0, color="#FF5F0E",
         actions=["photo_op"]),
]

layout = {
    "_doc": "Denah konsep Higround (ruko 5 x 18 m, 2 lantai) untuk game. Satuan meter; 1 tile = 0.5 m (10 x 36 tile/lantai). "
            "x=0 dinding kiri dilihat dari jalan, y=0 fasad depan, y negatif = trotoar/jalan. Lihat SPEC.md §6.",
    "units": "meter", "tile_m": 0.5,
    "building": {"width_m": 5, "depth_m": 18, "floors": 2},
    "higround_coords": {"lat": -6.1692868660954705, "lng": 106.97518796135917},
    "scenes": {"street": street, "floor1": floor1, "floor2": floor2},
    "agent_routines": {
        "coffee_visit": ["f1_door", "order_counter:queue", "order_counter:order", "curved_bar:pickup_drink", "any_seat:drink", "f1_door"],
        "post_run": ["start_gate:run_return", "hydration_out", "f1_door", "order_counter:order", "curved_bar:pickup_drink", "communal_table:chat"],
        "pre_run": ["stairs", "bag_cubbies:store_bag", "bench_lounge:tie_shoes", "stairs", "f1_door", "start_gate:stretch", "start_gate:run_start"],
        "yoga_session": ["stairs", "yoga_mats:yoga_pose", "hydration_station", "stairs", "curved_bar:pickup_drink"],
        "chill": ["book_ledge:read", "any_seat:drink"],
        "family": ["kids_corner:color_book", "table_f*:eat", "gelato_kiosk:order_gelato"],
    },
}

OUT.mkdir(parents=True, exist_ok=True)
(OUT / "config").mkdir(exist_ok=True)
(OUT / "reference").mkdir(exist_ok=True)
(OUT / "config/world_layout.json").write_text(json.dumps(layout, indent=2, ensure_ascii=False))

# ---------------- SVG render ----------------
S = 40  # px per meter
PAD = 40
GAP = 70
COLW = 5 * S
def esc(s): return s.replace("&", "&amp;").replace("<", "&lt;")

def panel(items, ox, oy, title, ymin, ymax, building=True, start=0):
    out = [f'<text x="{ox}" y="{oy - 6*S - 30}" font-size="16" font-weight="bold" fill="#000">{esc(title)}</text>'] if title else []
    if building:
        out.append(f'<rect x="{ox}" y="{oy}" width="{COLW}" height="{18*S}" fill="#F3E9D2" stroke="#000" stroke-width="3"/>')
        for t in range(1, 10):  # tile grid
            out.append(f'<line x1="{ox+t*S/2}" y1="{oy}" x2="{ox+t*S/2}" y2="{oy+18*S}" stroke="#000" stroke-opacity="0.05"/>')
        for t in range(1, 36):
            out.append(f'<line x1="{ox}" y1="{oy+t*S/2}" x2="{ox+COLW}" y2="{oy+t*S/2}" stroke="#000" stroke-opacity="0.05"/>')
    order = {"zone": 0, "struct": 1, "poi": 2, "deco": 3, "wall_art": 4}
    n = start
    legend = []
    for it in sorted(items, key=lambda i: order[i["kind"]]):
        if it.get("overhead"):
            continue
        x, y, w, h = ox + it["x"]*S, oy + it["y"]*S, it["w"]*S, it["h"]*S
        fill = it.get("color", "#ccc")
        if it["kind"] == "zone":
            out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" fill="{fill}" fill-opacity="0.55" stroke="#8a8378" stroke-dasharray="4 3"/>')
            out.append(f'<text x="{x+4}" y="{y+13}" font-size="9" fill="#5b544a" font-weight="bold">{esc(it["label"].split(" (")[0].split(" —")[0][:30])}</text>')
            continue
        rx = 10 if it.get("rounded") else 2
        stroke = it.get("stroke", "#333")
        out.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rx}" fill="{fill}" stroke="{stroke}" stroke-width="{2 if it["kind"]=="poi" else 1}"/>')
        n += 1
        cx, cy = x + w/2, y + h/2
        out.append(f'<circle cx="{cx}" cy="{cy}" r="8" fill="#fff" stroke="#000"/>')
        out.append(f'<text x="{cx}" y="{cy+3.5}" font-size="9" text-anchor="middle" font-weight="bold">{n}</text>')
        legend.append((n, it))
    return out, legend

parts = []
W = PAD*2 + COLW*2 + GAP + 2*330
H = PAD*2 + 24*S + 100
ox1 = PAD; ox2 = PAD + COLW + 330 + GAP
oy = PAD + 6*S + 60  # leave room for street (6 m) above floor1
parts.append(f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" font-family="DejaVu Sans, sans-serif">')
parts.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
parts.append(f'<text x="{PAD}" y="26" font-size="20" font-weight="bold" fill="#FF5F0E">HIGROUND — Denah konsep game (ruko 5 × 18 m, 2 lantai)</text>')
parts.append(f'<text x="{PAD}" y="44" font-size="11" fill="#555">Tampak atas · 1 kotak grid = 0,5 m = 1 tile · jalan di atas, dinding belakang di bawah · sumber data: config/world_layout.json</text>')

# street (drawn relative to floor1 origin with negative y)
st, lg_st = panel(street, ox1, oy, "", -6, 0, building=False, start=0)
p1, lg1 = panel(floor1, ox1, oy, "LANTAI 1 — Coffee & Burger  (+ teras / Start Gate di atas)", 0, 18, start=len([i for i in street if i["kind"]!="zone" and not i.get("overhead")]))
p2, lg2 = panel(floor2, ox2, oy, "LANTAI 2 — Studio Room + Run Club Lounge (Sports Hub)", 0, 18)
parts += st + p1 + p2

def legend_block(lg, lx, ly, title, start_offset=0):
    o = [f'<text x="{lx}" y="{ly}" font-size="11" font-weight="bold">{esc(title)}</text>']
    for i, (n, it) in enumerate(lg):
        o.append(f'<text x="{lx}" y="{ly+14+i*12.5}" font-size="9.2" fill="#222">{n+start_offset}. {esc(it["label"][:62])}</text>')
    return o

# renumber street legend after floor1 to avoid collision: street numbers drawn separately with prefix S
parts_street_fix = []
for n, it in lg_st:
    pass
parts += legend_block(lg_st, ox1 + COLW + 14, oy - 6*S + 10, "Teras & jalan (nomor di area atas)")
parts += legend_block(lg1, ox1 + COLW + 14, oy + 2.6*S, "Lantai 1")
parts += legend_block(lg2, ox2 + COLW + 14, oy + 0.2*S, "Lantai 2")
parts.append('</svg>')
svg = OUT / "reference/floorplan.svg"
svg.write_text("\n".join(parts))
subprocess.run(["rsvg-convert", "-z", "1.6", str(svg), "-o", str(OUT / "reference/floorplan.png")], check=True)
print("ok", sum(len(v) for v in layout["scenes"].values()), "items")
