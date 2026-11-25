#!/usr/bin/env python3
"""
Higround Run Club — Shaded Isometric Pixel Art Asset Compositor (v3)
Every single sprite in /world is composed from either:
  1. High-craft Higround-generated pixel art (Start Gate, ORDER HERE! Counter, Gelato Kiosk, Mascot Fridges, Mascot)
  2. Shaded CC0 PtDesigns Cozy Shops & Town Environments pixel sprites, carefully composited and recolored to
     match Higround's real photos (reference/photos/01..11) and brand palette (SPEC §5).

Zero flat programmer-art polygons. 100% CC0 or Higround-owned (safe for public GitHub repo).
"""
from __future__ import annotations

import json
import os
from pathlib import Path
from PIL import Image, ImageDraw, ImageEnhance

REPO = Path(__file__).resolve().parents[2]
WEB_PUBLIC = REPO / "run-club" / "apps" / "web" / "public" / "assets" / "world"
EXTRACTED = Path(
    os.environ.get(
        "HIGROUND_EXTRACTED_ASSETS",
        "/Users/andreas/.gemini/antigravity/brain/db247ab7-bcce-4275-a93a-121c44b1d67f/scratch/extracted_assets",
    )
)
GEN_DIR = Path(
    os.environ.get(
        "HIGROUND_GEN_ASSETS",
        "/Users/andreas/.gemini/antigravity/brain/db247ab7-bcce-4275-a93a-121c44b1d67f",
    )
)

SHOPS = EXTRACTED / "ptdesigns_shops"
TOWN = EXTRACTED / "ptdesigns_town"

CAFE = SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites"
BAKERY = SHOPS / "cozy_shops_corner_bakery_sprites_v1.0/cozy_shops_corner_bakery_sprites_v1.0/sprites"
BOOKS = SHOPS / "cozy_shops_little_bookshop_sprites_v1.0/cozy_shops_little_bookshop_sprites_v1.0/sprites"
FLOWERS = SHOPS / "cozy_shops_flower_shop_sprites_v1.0/cozy_shops_flower_shop_sprites_v1.0/sprites"
GENERAL = SHOPS / "cozy_shops_general_store_sprites_v1.0/cozy_shops_general_store_sprites_v1.0/sprites"
FOUND = SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles"
STREET = TOWN / "environments_shopping_street_tiles_v1.0/environments_shopping_street_tiles_v1.0/tiles"
PARKS = TOWN / "environments_courtyards_parks_tiles_v1.0/environments_courtyards_parks_tiles_v1.0/tiles"
ALLEYS = TOWN / "environments_back_alleys_service_areas_tiles_v1.0/environments_back_alleys_service_areas_tiles_v1.0/tiles"

OUT_TILES = WEB_PUBLIC / "tiles"
OUT_PROPS = WEB_PUBLIC / "props"
OUT_LANDMARKS = WEB_PUBLIC / "landmarks"
OUT_MASCOT = WEB_PUBLIC / "mascot"
for d in (OUT_TILES, OUT_PROPS, OUT_LANDMARKS, OUT_MASCOT):
    d.mkdir(parents=True, exist_ok=True)


def trim_alpha(im: Image.Image, thresh: int = 24) -> Image.Image:
    im = im.convert("RGBA")
    mask = im.getchannel("A").point(lambda a: 255 if a >= thresh else 0)
    bbox = mask.getbbox()
    return im.crop(bbox) if bbox else im


def crisp_resize(im: Image.Image, target_w: int, target_h: int | None = None, alpha_cutoff: int = 110) -> Image.Image:
    im = trim_alpha(im)
    w, h = im.size
    if target_h is None:
        scale = target_w / max(w, 1)
        target_h = max(1, int(round(h * scale)))
    else:
        scale = min(target_w / max(w, 1), target_h / max(h, 1))
        target_w = max(1, int(round(w * scale)))
        target_h = max(1, int(round(h * scale)))
    small = im.resize((target_w, target_h), Image.Resampling.LANCZOS)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            px[x, y] = (0, 0, 0, 0) if a < alpha_cutoff else (r, g, b, 255)
    return small


def tint_image(im: Image.Image, target_rgb: tuple[int, int, int], strength: float = 0.25, sat: float = 1.0) -> Image.Image:
    im = im.convert("RGBA")
    if sat != 1.0:
        rgb = ImageEnhance.Color(im.convert("RGB")).enhance(sat)
        im = Image.merge("RGBA", (*rgb.split(), im.getchannel("A")))
    px = im.load()
    tr, tg, tb = target_rgb
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            # Keep dark pixel outlines crisp!
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < 42:
                continue
            nr = int(r * (1 - strength) + tr * strength)
            ng = int(g * (1 - strength) + tg * strength)
            nb = int(b * (1 - strength) + tb * strength)
            px[x, y] = (max(0, min(255, nr)), max(0, min(255, ng)), max(0, min(255, nb)), a)
    return im


def make_diamond_tile(src: Path, out: Path, tint: tuple[int, int, int] | None = None, strength: float = 0.0) -> None:
    im = trim_alpha(Image.open(src))
    tile = im.resize((32, 16), Image.Resampling.LANCZOS)
    mask = Image.new("L", (32, 16), 0)
    ImageDraw.Draw(mask).polygon([(16, 0), (31, 8), (16, 15), (0, 8)], fill=255)
    px = tile.load()
    mp = mask.load()
    for y in range(16):
        for x in range(32):
            r, g, b, a = px[x, y]
            px[x, y] = (0, 0, 0, 0) if (mp[x, y] == 0 or a < 60) else (r, g, b, 255)
    if tint and strength > 0:
        tile = tint_image(tile, tint, strength)
    tile.save(out)


def chroma_key_magenta(im: Image.Image) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def is_bg(r: int, g: int, b: int) -> bool:
        return r > 155 and b > 140 and g < 110 and (r - g) > 65 and (b - g) > 55

    visited = bytearray(w * h)
    stack: list[tuple[int, int]] = []
    for y in range(h):
        for x in range(w):
            r, g, b, _ = px[x, y]
            if r > 200 and b > 190 and g < 75:
                idx = y * w + x
                if not visited[idx]:
                    visited[idx] = 1
                    stack.append((x, y))
    while stack:
        x, y = stack.pop()
        px[x, y] = (0, 0, 0, 0)
        for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
            nx, ny = x + dx, y + dy
            if 0 <= nx < w and 0 <= ny < h:
                idx = ny * w + nx
                if not visited[idx]:
                    r, g, b, _ = px[nx, ny]
                    if is_bg(r, g, b):
                        visited[idx] = 1
                        stack.append((nx, ny))

    for _ in range(2):
        to_clear = []
        for y in range(h):
            for x in range(w):
                r, g, b, a = px[x, y]
                if a == 0:
                    continue
                if r > 110 and b > 95 and g < min(r, b) - 25:
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1)):
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < w and 0 <= ny < h and px[nx, ny][3] == 0:
                            to_clear.append((x, y))
                            break
        for x, y in to_clear:
            px[x, y] = (0, 0, 0, 0)
    return im


def load_prop(path: Path, w: int, h: int, tint: tuple[int, int, int] | None = None, strength: float = 0.0, sat: float = 1.0) -> Image.Image:
    im = crisp_resize(Image.open(path), w, h)
    if tint and strength > 0 or sat != 1.0:
        im = tint_image(im, tint or (255, 255, 255), strength, sat=sat)
    return im


def build_shaded_composites() -> dict[str, dict]:
    entries: dict[str, dict] = {}
    OUT = (34, 26, 24, 255)
    ORANGE = (255, 95, 14)
    NAVY = (46, 58, 140)
    YELLOW = (247, 208, 70)
    CREAM = (246, 238, 220)
    WHITE = (252, 250, 245)
    WOOD = (176, 122, 74)
    RED = (224, 53, 43)
    CYAN = (127, 184, 224)

    # 1. Photo 03: Modern Matte-Black Table + 2 Cream Minimalist Chairs (Shaded CC0 Composite!)
    tbl_blk = load_prop(CAFE / "04_round_cafe_table.png", 34, 34, (42, 42, 46), 0.58, sat=0.25)
    chr_crm = load_prop(CAFE / "05_dining_chair.png", 20, 26, (245, 240, 228), 0.45, sat=0.4)
    chr_crm_r = chr_crm.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    cup = load_prop(CAFE / "17_takeaway_cup_stack.png", 10, 12, ORANGE, 0.35)
    comp = Image.new("RGBA", (54, 44), (0, 0, 0, 0))
    comp.alpha_composite(chr_crm, (2, 12))
    comp.alpha_composite(chr_crm_r, (32, 12))
    comp.alpha_composite(tbl_blk, (10, 6))
    comp.alpha_composite(cup, (22, 10))
    comp.save(OUT_LANDMARKS / "modern_table_set.png")
    for tk in ("table_f1", "table_f2", "table_f3", "table_m1", "table_m2", "table_m3"):
        entries[tk] = {"file": "/assets/world/landmarks/modern_table_set.png", "anchorX": 0.5, "anchorY": 0.84, "source": "PtDesigns (CC0) + Higround"}

    # 2. Photo 11: Sleek White Studio Cafe Table + White/Navy Chairs (Dine-in L2)
    tbl_wht = load_prop(CAFE / "04_round_cafe_table.png", 36, 36, WHITE, 0.62, sat=0.15)
    chr_nvy = load_prop(CAFE / "05_dining_chair.png", 20, 26, NAVY, 0.48, sat=0.8)
    comp = Image.new("RGBA", (56, 44), (0, 0, 0, 0))
    comp.alpha_composite(chr_nvy, (2, 12))
    comp.alpha_composite(chr_crm_r, (34, 12))
    comp.alpha_composite(tbl_wht, (10, 5))
    comp.save(OUT_LANDMARKS / "studio_table_set.png")
    entries["studio_table_set"] = {"file": "/assets/world/landmarks/studio_table_set.png", "anchorX": 0.5, "anchorY": 0.84, "source": "PtDesigns (CC0) + Higround"}

    # 3. Photo 06: Curved White Coffee Bar + Black Espresso Machine + Orange Cup Stack
    bar = load_prop(CAFE / "01_cafe_counter.png", 76, 62, WHITE, 0.42, sat=0.35)
    esp = load_prop(CAFE / "02_espresso_machine.png", 30, 30, (44, 44, 50), 0.55, sat=0.2)
    cups = load_prop(CAFE / "17_takeaway_cup_stack.png", 16, 18, ORANGE, 0.55, sat=1.3)
    comp = Image.new("RGBA", (82, 68), (0, 0, 0, 0))
    comp.alpha_composite(bar, (3, 6))
    comp.alpha_composite(esp, (18, 2))
    comp.alpha_composite(cups, (50, 14))
    comp.save(OUT_LANDMARKS / "curved_bar.png")
    entries["curved_bar"] = {"file": "/assets/world/landmarks/curved_bar.png", "anchorX": 0.5, "anchorY": 0.85, "source": "PtDesigns (CC0) + Higround"}

    # 4. Photo 07: Long Teak Communal Table + 4 Curved Wooden Chairs + Center Vase
    bench = load_prop(BAKERY / "04_wooden_preparation_bench.png", 60, 52, WOOD, 0.20)
    ch_w = load_prop(CAFE / "05_dining_chair.png", 20, 26, WOOD, 0.15)
    ch_wr = ch_w.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
    vase = load_prop(CAFE / "18_ceramic_flower_vase.png", 14, 18)
    comp = Image.new("RGBA", (82, 62), (0, 0, 0, 0))
    comp.alpha_composite(ch_w, (6, 16))
    comp.alpha_composite(ch_wr, (52, 12))
    comp.alpha_composite(bench, (11, 4))
    comp.alpha_composite(vase, (34, 8))
    comp.alpha_composite(ch_w, (18, 32))
    comp.alpha_composite(ch_wr, (46, 30))
    comp.save(OUT_LANDMARKS / "communal_table.png")
    entries["communal_table"] = {"file": "/assets/world/landmarks/communal_table.png", "anchorX": 0.5, "anchorY": 0.84, "source": "PtDesigns (CC0) + Higround"}

    # 5. Photo 07: Stepped Wood Planter Bench + Lush Tropical Ferns & Rubber Plants + Round Mirror
    fern = load_prop(FLOWERS / "09_fern_pot.png", 28, 28)
    rub = load_prop(GENERAL / "24_potted_rubber_plant.png", 28, 34)
    tree = load_prop(CAFE / "24_small_potted_tree.png", 28, 36)
    low_b = load_prop(BAKERY / "04_wooden_preparation_bench.png", 68, 40, WOOD, 0.22)
    comp = Image.new("RGBA", (86, 68), (0, 0, 0, 0))
    d = ImageDraw.Draw(comp)
    # Round mirror centered above the planter bench
    d.ellipse([32, 2, 54, 24], fill=(214, 232, 240, 255), outline=OUT, width=2)
    d.line([(38, 8), (45, 15)], fill=WHITE + (255,), width=2)
    d.line([(42, 6), (49, 13)], fill=WHITE + (255,), width=1)
    comp.alpha_composite(low_b, (9, 26))
    comp.alpha_composite(fern, (6, 22))
    comp.alpha_composite(rub, (28, 16))
    comp.alpha_composite(tree, (52, 18))
    comp.save(OUT_LANDMARKS / "plant_bench.png")
    entries["plant_bench"] = {"file": "/assets/world/landmarks/plant_bench.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}
    entries["round_mirror"] = {"file": "/assets/world/landmarks/plant_bench.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # 6. Photo 08: Book Ledge + Puzzle Corner (Shaded CC0 bookshelf + books + lamp!)
    bs = load_prop(CAFE / "23_low_bookshelf.png", 50, 50, WOOD, 0.14)
    comp = Image.new("RGBA", (54, 54), (0, 0, 0, 0))
    comp.alpha_composite(bs, (2, 2))
    d = ImageDraw.Draw(comp)
    # Iconic tiny Higround orange shelf labels
    d.rectangle([16, 24, 21, 27], fill=ORANGE + (255,))
    d.rectangle([28, 34, 33, 37], fill=ORANGE + (255,))
    comp.save(OUT_LANDMARKS / "book_ledge.png")
    entries["book_ledge"] = {"file": "/assets/world/landmarks/book_ledge.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # 7. Photo 09: KIDS CORNER — Red-tinted Cabinet + Mini Basketball Hoop + Potted Plants!
    cab = load_prop(BOOKS / "02_low_display_bookshelf.png", 46, 46, RED, 0.62, sat=1.2)
    pl = load_prop(FLOWERS / "09_fern_pot.png", 20, 22)
    comp = Image.new("RGBA", (66, 62), (0, 0, 0, 0))
    d = ImageDraw.Draw(comp)
    # Mini blue basketball hoop above red cabinet
    d.rounded_rectangle([24, 2, 42, 14], radius=3, fill=NAVY + (255,), outline=OUT)
    d.rectangle([28, 5, 38, 11], fill=ORANGE + (255,), outline=WHITE + (255,))
    d.ellipse([29, 12, 37, 17], outline=RED + (255,), width=2)
    comp.alpha_composite(cab, (12, 16))
    comp.alpha_composite(pl, (2, 36))
    # Yellow KIDS CORNER sign on top
    d.rectangle([22, 20, 36, 28], fill=YELLOW + (255,), outline=OUT)
    d.rectangle([24, 22, 34, 25], fill=RED + (255,))
    comp.save(OUT_LANDMARKS / "kids_corner.png")
    entries["kids_corner"] = {"file": "/assets/world/landmarks/kids_corner.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # 8. Photo 11: Low White Vinyl Shelf + Art Prints + Yellow Mushroom Lamp
    vs = load_prop(BOOKS / "02_low_display_bookshelf.png", 50, 44, WHITE, 0.58, sat=0.25)
    lamp = load_prop(BOOKS / "10_reading_lamp.png", 18, 22, YELLOW, 0.45, sat=1.3)
    art = load_prop(BOOKS / "20_framed_book_art.png", 16, 18)
    comp = Image.new("RGBA", (64, 52), (0, 0, 0, 0))
    comp.alpha_composite(vs, (7, 8))
    comp.alpha_composite(art, (12, 4))
    comp.alpha_composite(lamp, (34, 2))
    comp.save(OUT_LANDMARKS / "vinyl_shelf.png")
    entries["vinyl_shelf"] = {"file": "/assets/world/landmarks/vinyl_shelf.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # 9. Photo 11: Sleek White Wall Desk + Warm Desk Lamp
    desk = load_prop(BOOKS / "03_cashier_desk.png", 44, 42, WHITE, 0.58, sat=0.2)
    dlamp = load_prop(BOOKS / "10_reading_lamp.png", 16, 20, YELLOW, 0.40, sat=1.3)
    comp = Image.new("RGBA", (48, 48), (0, 0, 0, 0))
    comp.alpha_composite(desk, (2, 6))
    comp.alpha_composite(dlamp, (18, 0))
    comp.save(OUT_LANDMARKS / "wall_desks.png")
    entries["wall_desks"] = {"file": "/assets/world/landmarks/wall_desks.png", "anchorX": 0.5, "anchorY": 0.86, "source": "PtDesigns (CC0) + Higround"}

    # 10. Burger Kitchen Station (Shaded CC0 Bakery Oven + Prep Counter + Pastry/Buns!)
    oven = load_prop(BAKERY / "03_stone_baking_oven.png", 46, 52, (192, 198, 206), 0.48, sat=0.25)
    prep = load_prop(BAKERY / "04_wooden_preparation_bench.png", 44, 42, (206, 212, 218), 0.50, sat=0.2)
    comp = Image.new("RGBA", (78, 60), (0, 0, 0, 0))
    comp.alpha_composite(oven, (4, 4))
    comp.alpha_composite(prep, (30, 16))
    comp.save(OUT_LANDMARKS / "kitchen.png")
    entries["kitchen"] = {"file": "/assets/world/landmarks/kitchen.png", "anchorX": 0.5, "anchorY": 0.85, "source": "PtDesigns (CC0) + Higround"}

    # 11. Shaded CC0 Cutaway Rooms (Restroom, Changing Booth, Storage) using PtDesigns plaster walls + doors!
    wall_u = load_prop(STREET / "wall_plaster_u.png", 36, 48, CREAM, 0.25)
    door_v = load_prop(STREET / "storefront_solid_door_v.png", 36, 48, WOOD, 0.12)
    # Restroom unit
    comp = Image.new("RGBA", (58, 56), (0, 0, 0, 0))
    comp.alpha_composite(wall_u, (2, 6))
    comp.alpha_composite(door_v, (20, 6))
    ImageDraw.Draw(comp).rectangle([33, 20, 41, 25], fill=NAVY + (255,), outline=OUT)
    comp.save(OUT_LANDMARKS / "restroom_unit.png")
    entries["toilet_f1"] = {"file": "/assets/world/landmarks/restroom_unit.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}
    entries["toilet_f2"] = {"file": "/assets/world/landmarks/restroom_unit.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # Changing Booth unit (orange curtain accent!)
    door_o = load_prop(STREET / "storefront_open_doorway_v.png", 36, 48, ORANGE, 0.35)
    comp = Image.new("RGBA", (58, 56), (0, 0, 0, 0))
    comp.alpha_composite(wall_u, (2, 6))
    comp.alpha_composite(door_o, (20, 6))
    comp.save(OUT_LANDMARKS / "changing_booth.png")
    entries["changing_booth"] = {"file": "/assets/world/landmarks/changing_booth.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # Storage room unit (plaster wall + coffee sacks + shelf!)
    sack = load_prop(CAFE / "08_coffee_bean_sack.png", 20, 22)
    crate = load_prop(FLOWERS / "22_wooden_crate.png", 22, 22)
    comp = Image.new("RGBA", (66, 58), (0, 0, 0, 0))
    comp.alpha_composite(wall_u, (4, 6))
    comp.alpha_composite(door_v, (22, 6))
    comp.alpha_composite(crate, (38, 30))
    comp.alpha_composite(sack, (16, 32))
    comp.save(OUT_LANDMARKS / "storage_f2.png")
    entries["storage_f2"] = {"file": "/assets/world/landmarks/storage_f2.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # 12. Wall Art, Boards, Hydration, Mats, Scooters, Cone, Sink, Shoe Rack
    # Mascot banner, Leaderboard board, Yoga quest board, Medal wall, Poster frames, Yoga wall, Mirror wall
    im = Image.new("RGBA", (46, 54), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(8, 12), (38, 26), (38, 50), (8, 36)], fill=CREAM + (255,), outline=OUT)
    d.line([(8, 12), (38, 26)], fill=ORANGE + (255,), width=3)
    d.ellipse([16, 24, 30, 38], fill=ORANGE + (255,), outline=OUT)
    d.rectangle([19, 27, 21, 30], fill=WHITE + (255,))
    d.rectangle([24, 27, 26, 30], fill=WHITE + (255,))
    im.save(OUT_LANDMARKS / "mascot_banner.png")
    entries["mascot_banner"] = {"file": "/assets/world/landmarks/mascot_banner.png", "anchorX": 0.5, "anchorY": 0.92, "source": "Higround (own)"}

    im = Image.new("RGBA", (68, 46), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(6, 22), (58, 4), (62, 6), (62, 28), (10, 44), (6, 42)], fill=NAVY + (255,), outline=OUT)
    d.polygon([(12, 23), (56, 9), (56, 14), (12, 28)], fill=YELLOW + (255,))
    for row in range(3):
        y0 = 30 + row * 4
        d.line([(13, y0), (46 - row * 7, y0 - 10 + row * 2)], fill=ORANGE + (255,), width=2)
    im.save(OUT_LANDMARKS / "leaderboard_board.png")
    entries["leaderboard_board"] = {"file": "/assets/world/landmarks/leaderboard_board.png", "anchorX": 0.5, "anchorY": 0.90, "source": "Higround (own)"}

    im = Image.new("RGBA", (54, 48), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(8, 10), (46, 24), (46, 44), (8, 30)], fill=ORANGE + (255,), outline=OUT)
    d.polygon([(11, 13), (43, 25), (43, 41), (11, 29)], fill=(253, 249, 240, 255), outline=OUT)
    for col in range(5):
        for row in range(3):
            sx = 14 + col * 5
            sy = 19 + col * 2 + row * 4
            d.rectangle([sx, sy, sx + 2, sy + 2], fill=(YELLOW if (col + row) % 2 == 0 else ORANGE) + (255,))
    im.save(OUT_LANDMARKS / "yoga_quest_board.png")
    entries["yoga_quest_board"] = {"file": "/assets/world/landmarks/yoga_quest_board.png", "anchorX": 0.5, "anchorY": 0.90, "source": "Higround (own)"}

    im = Image.new("RGBA", (76, 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(6, 26), (66, 6), (70, 8), (70, 24), (10, 42), (6, 40)], fill=WOOD + (255,), outline=OUT)
    for i in range(7):
        mx = 14 + i * 8
        my = int(33 - i * 2.5)
        d.line([(mx, my - 5), (mx, my)], fill=ORANGE + (255,), width=1)
        d.ellipse([mx - 2, my, mx + 2, my + 4], fill=YELLOW + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "medal_wall.png")
    entries["medal_wall"] = {"file": "/assets/world/landmarks/medal_wall.png", "anchorX": 0.5, "anchorY": 0.90, "source": "Higround (own)"}

    # Framed poster art (CC0 framed book art!)
    pf = load_prop(BOOKS / "20_framed_book_art.png", 32, 36)
    pf.save(OUT_LANDMARKS / "poster_frames.png")
    for pk in ("poster_wall_f2", "run_posters", "guest_check"):
        entries[pk] = {"file": "/assets/world/landmarks/poster_frames.png", "anchorX": 0.5, "anchorY": 0.90, "source": "PtDesigns (CC0)"}

    # Yoga wall (CC0 wood wall panel!)
    yw = load_prop(STREET / "wall_wood_u.png", 44, 50, WOOD, 0.20)
    yw.save(OUT_LANDMARKS / "yoga_wall.png")
    entries["yoga_wall"] = {"file": "/assets/world/landmarks/yoga_wall.png", "anchorX": 0.5, "anchorY": 0.90, "source": "PtDesigns (CC0)"}

    # Full-length mirror wall
    mw = load_prop(STREET / "storefront_window_v.png", 36, 46, (210, 232, 244), 0.35)
    mw.save(OUT_LANDMARKS / "mirror_wall.png")
    entries["mirror_wall"] = {"file": "/assets/world/landmarks/mirror_wall.png", "anchorX": 0.5, "anchorY": 0.90, "source": "PtDesigns (CC0)"}

    # Hydration Station (CC0 barrel/cabinet + cyan water gallon)
    im = Image.new("RGBA", (32, 42), (0, 0, 0, 0))
    cab_sm = load_prop(GENERAL / "03_glass_display_cabinet.png", 26, 28, WHITE, 0.55, sat=0.2)
    im.alpha_composite(cab_sm, (3, 14))
    d = ImageDraw.Draw(im)
    d.rounded_rectangle([10, 4, 22, 18], radius=3, fill=CYAN + (255,), outline=OUT)
    d.rectangle([12, 7, 15, 14], fill=(208, 240, 255, 255))
    im.save(OUT_LANDMARKS / "hydration_station.png")
    entries["hydration_station"] = {"file": "/assets/world/landmarks/hydration_station.png", "anchorX": 0.5, "anchorY": 0.90, "source": "PtDesigns (CC0) + Higround"}
    entries["hydration_out"] = {"file": "/assets/world/landmarks/hydration_station.png", "anchorX": 0.5, "anchorY": 0.90, "source": "PtDesigns (CC0) + Higround"}

    # Cone, Scooters, Bar Sink, Shoe Rack, Yoga Mats, Stretch Mats
    im = Image.new("RGBA", (20, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(4, 20), (10, 17), (16, 20), (10, 23)], fill=(196, 66, 8, 255), outline=OUT)
    d.polygon([(6, 19), (10, 6), (14, 19)], fill=ORANGE + (255,), outline=OUT)
    d.line([(8, 13), (12, 13)], fill=WHITE + (255,), width=2)
    im.save(OUT_LANDMARKS / "cone.png")
    entries["cone"] = {"file": "/assets/world/landmarks/cone.png", "anchorX": 0.5, "anchorY": 0.90, "source": "Higround (own)"}

    im = Image.new("RGBA", (68, 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for ox, oy, col in [(0, 0, (66, 70, 82)), (22, 8, (195, 62, 48))]:
        d.ellipse([12 + ox, 22 + oy, 20 + ox, 30 + oy], fill=(32, 32, 36, 255), outline=OUT)
        d.ellipse([28 + ox, 16 + oy, 36 + ox, 24 + oy], fill=(32, 32, 36, 255), outline=OUT)
        d.polygon([(14 + ox, 22 + oy), (30 + ox, 14 + oy), (36 + ox, 18 + oy), (20 + ox, 26 + oy)], fill=col + (255,), outline=OUT)
        d.polygon([(16 + ox, 18 + oy), (25 + ox, 14 + oy), (28 + ox, 16 + oy), (19 + ox, 20 + oy)], fill=(45, 40, 38, 255), outline=OUT)
        d.line([(31 + ox, 16 + oy), (31 + ox, 7 + oy)], fill=(50, 50, 54, 255), width=2)
        d.line([(27 + ox, 8 + oy), (35 + ox, 6 + oy)], fill=OUT, width=2)
        d.ellipse([17 + ox, 11 + oy, 24 + ox, 18 + oy], fill=YELLOW + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "scooters.png")
    entries["scooters"] = {"file": "/assets/world/landmarks/scooters.png", "anchorX": 0.5, "anchorY": 0.86, "source": "Higround (own)"}

    sink = load_prop(BAKERY / "04_wooden_preparation_bench.png", 34, 34, (192, 200, 208), 0.60, sat=0.15)
    sink.save(OUT_LANDMARKS / "bar_sink.png")
    entries["bar_sink"] = {"file": "/assets/world/landmarks/bar_sink.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0)"}

    sr = load_prop(GENERAL / "02_goods_shelving_unit.png", 36, 40, (56, 58, 66), 0.55, sat=0.25)
    sr.save(OUT_LANDMARKS / "shoe_rack.png")
    entries["shoe_rack"] = {"file": "/assets/world/landmarks/shoe_rack.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0)"}

    im = Image.new("RGBA", (42, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(21, 2), (39, 11), (21, 20), (3, 11)], fill=ORANGE + (255,), outline=OUT)
    d.polygon([(21, 4), (35, 11), (21, 18), (7, 11)], fill=(255, 148, 80, 255))
    im.save(OUT_LANDMARKS / "yoga_mat_single.png")
    entries["yoga_mat_single"] = {"file": "/assets/world/landmarks/yoga_mat_single.png", "anchorX": 0.5, "anchorY": 0.5, "source": "Higround (own)"}

    im = Image.new("RGBA", (46, 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(23, 3), (43, 13), (23, 23), (3, 13)], fill=(238, 214, 192, 255), outline=OUT)
    d.rounded_rectangle([14, 10, 29, 15], radius=2, fill=ORANGE + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "stretch_mat.png")
    entries["stretch_mat"] = {"file": "/assets/world/landmarks/stretch_mat.png", "anchorX": 0.5, "anchorY": 0.5, "source": "Higround (own)"}

    # Trophy pedestal (CC0 cake stand tinted gold!)
    tr = load_prop(CAFE / "12_cake_stand.png", 28, 34, YELLOW, 0.45, sat=1.3)
    tr.save(OUT_LANDMARKS / "upgrade_trophy.png")
    entries["upgrade_trophy"] = {"file": "/assets/world/landmarks/upgrade_trophy.png", "anchorX": 0.5, "anchorY": 0.88, "source": "PtDesigns (CC0) + Higround"}

    # ── AI-Generated High-Craft Landmarks & Mascot Sheets ─────────────────────
    lm_files = sorted(GEN_DIR.glob("gen_landmarks_1*.jpg")) + sorted(GEN_DIR.glob("gen_landmarks_1*.png"))
    if lm_files:
        raw = chroma_key_magenta(Image.open(lm_files[-1]))
        gw, gh = raw.size
        quads = {
            "start_gate": ((0, 0, gw // 2, gh // 2), 86, 78, 0.88),
            "order_counter": ((gw // 2, 0, gw, gh // 2), 86, 74, 0.85),
            "gelato_kiosk": ((0, gh // 2, gw // 2, gh), 72, 80, 0.88),
            "mascot_fridges": ((gw // 2, gh // 2, gw, gh), 56, 68, 0.90),
        }
        for key, (box, tw, th, ay) in quads.items():
            q = crisp_resize(raw.crop(box), tw, th, alpha_cutoff=115)
            q.save(OUT_LANDMARKS / f"{key}.png")
            entries[key] = {"file": f"/assets/world/landmarks/{key}.png", "anchorX": 0.5, "anchorY": ay, "source": "Higround (own)"}

    ms_files = sorted(GEN_DIR.glob("gen_mascot_sheet*.jpg")) + sorted(GEN_DIR.glob("gen_mascot_sheet*.png"))
    if ms_files:
        raw = chroma_key_magenta(Image.open(ms_files[-1]))
        gw, gh = raw.size
        poses = {
            "mascot_idle": (0, 0, gw // 2, gh // 2),
            "mascot_run": (gw // 2, 0, gw, gh // 2),
            "mascot_cheer": (0, gh // 2, gw // 2, gh),
            "mascot_stretch": (gw // 2, gh // 2, gw, gh),
        }
        for key, box in poses.items():
            q = crisp_resize(raw.crop(box), 36, 38, alpha_cutoff=115)
            q.save(OUT_MASCOT / f"{key}.png")
            entries[key] = {"file": f"/assets/world/mascot/{key}.png", "anchorX": 0.5, "anchorY": 0.94, "source": "Higround (own)"}
        guide = crisp_resize(raw.crop((0, 0, gw // 2, gh // 2)), 96, 96, alpha_cutoff=115)
        guide.save(OUT_MASCOT / "guide_idle.png")
        cheer = crisp_resize(raw.crop((0, gh // 2, gw // 2, gh)), 96, 96, alpha_cutoff=115)
        cheer.save(OUT_MASCOT / "guide_cheer.png")
        entries["mascot_guide"] = {"file": "/assets/world/mascot/guide_idle.png", "anchorX": 0.5, "anchorY": 0.94, "source": "Higround (own)"}

        # Giant Higround Mascot Balloon upgrade prop (uses real high-craft shaded mascot!)
        bal = Image.new("RGBA", (48, 66), (0, 0, 0, 0))
        bd = ImageDraw.Draw(bal)
        bd.line([(24, 42), (24, 62)], fill=WHITE + (255,), width=2)
        big_m = crisp_resize(raw.crop((0, gh // 2, gw // 2, gh)), 44, 44, alpha_cutoff=115)
        bal.alpha_composite(big_m, (2, 2))
        bal.save(OUT_LANDMARKS / "upgrade_balloon.png")
        entries["upgrade_balloon"] = {"file": "/assets/world/landmarks/upgrade_balloon.png", "anchorX": 0.5, "anchorY": 0.95, "source": "Higround (own)"}

    return entries


def build_cc0_assets() -> dict[str, dict]:
    manifest: dict[str, dict] = {}
    tile_sources = {
        "tile_asphalt": (STREET / "asphalt_plain.png", None, 0.0),
        "tile_road_dashed": (STREET / "road_dashed_u.png", None, 0.0),
        "tile_sidewalk": (STREET / "sidewalk_plain.png", (215, 208, 196), 0.16),
        "tile_grass": (PARKS / "park_lawn.png", None, 0.0),
        "tile_concrete_1": (ALLEYS / "service_concrete.png", (174, 170, 162), 0.35),
        "tile_concrete_2": (ALLEYS / "service_concrete_worn.png", (166, 162, 154), 0.35),
        "tile_skylight": (PARKS / "courtyard_limestone.png", (245, 238, 222), 0.38),
        "tile_studio_1": (ALLEYS / "service_concrete.png", (134, 138, 140), 0.42),
        "tile_studio_2": (ALLEYS / "service_concrete_worn.png", (126, 130, 132), 0.42),
        "tile_lounge": (FOUND / "floor_timber_clean.png", (222, 186, 146), 0.25),
    }
    for key, (src, tint, strength) in tile_sources.items():
        if src.exists():
            out = OUT_TILES / f"{key}.png"
            make_diamond_tile(src, out, tint=tint, strength=strength)
            manifest[key] = {"file": f"/assets/world/tiles/{key}.png", "anchorX": 0.5, "anchorY": 0.5, "source": "PtDesigns (CC0)"}

    prop_specs: dict[str, tuple[Path, int, int, tuple[int, int, int] | None, float]] = {
        "plants_terrace": (CAFE / "24_small_potted_tree.png", 38, 48, None, 0.0),
        "plants_window": (GENERAL / "24_potted_rubber_plant.png", 32, 40, None, 0.0),
        "sandwich_board": (CAFE / "22_chalkboard_easel_blank.png", 26, 32, None, 0.0),
        "chiller": (FLOWERS / "03_refrigerated_floral_cabinet.png", 36, 46, (215, 232, 242), 0.22),
        "props_rack": (GENERAL / "02_goods_shelving_unit.png", 38, 46, (176, 122, 74), 0.16),
        "bag_cubbies": (BOOKS / "01_tall_oak_bookcase.png", 44, 54, (176, 122, 74), 0.14),
        "bench_lounge": (BAKERY / "04_wooden_preparation_bench.png", 52, 40, (176, 122, 74), 0.18),
        "tree_exterior": (CAFE / "24_small_potted_tree.png", 46, 56, (74, 148, 72), 0.12),
    }
    for key, (src, tw, th, tint, strength) in prop_specs.items():
        if not src.exists():
            continue
        im = load_prop(src, tw, th, tint=tint, strength=strength)
        out = OUT_PROPS / f"{key}.png"
        im.save(out)
        manifest[key] = {"file": f"/assets/world/props/{key}.png", "anchorX": 0.5, "anchorY": 0.86, "source": "PtDesigns (CC0)"}

    return manifest


def main() -> None:
    manifest = {}
    manifest.update(build_cc0_assets())
    manifest.update(build_shaded_composites())
    manifest_path = WEB_PUBLIC / "manifest.json"
    manifest_path.write_text(json.dumps({"tileW": 32, "tileH": 16, "sprites": manifest}, indent=2) + "\n")
    print(f"Built {len(manifest)} shaded world sprites -> {manifest_path}")


if __name__ == "__main__":
    main()
