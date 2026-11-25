#!/usr/bin/env python3
"""
Higround Run Club — Isometric Pixel Art Asset Builder
Processes CC0 itch.io assets (PtDesigns Cozy Shops & Town Environments) and builds bespoke
Higround-owned pixel landmarks into apps/web/public/assets/world/ + manifest.json.

All outputs in apps/web/public/assets/world/ are 100% CC0 or Higround-owned (safe for public repo).
"""
from __future__ import annotations

import json
import math
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

OUT_TILES = WEB_PUBLIC / "tiles"
OUT_PROPS = WEB_PUBLIC / "props"
OUT_LANDMARKS = WEB_PUBLIC / "landmarks"
OUT_MASCOT = WEB_PUBLIC / "mascot"
OUT_TILES.mkdir(parents=True, exist_ok=True)
OUT_PROPS.mkdir(parents=True, exist_ok=True)
OUT_LANDMARKS.mkdir(parents=True, exist_ok=True)
OUT_MASCOT.mkdir(parents=True, exist_ok=True)


def trim_alpha(im: Image.Image, thresh: int = 24) -> Image.Image:
    im = im.convert("RGBA")
    alpha = im.getchannel("A")
    mask = alpha.point(lambda a: 255 if a >= thresh else 0)
    bbox = mask.getbbox()
    return im.crop(bbox) if bbox else im


def crisp_resize(im: Image.Image, target_w: int, target_h: int | None = None, alpha_cutoff: int = 110) -> Image.Image:
    """Downscale pixel-art sprite cleanly keeping sharp edges and hard 1-bit pixel alpha."""
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
    # Sharpen alpha to crisp pixel-art edges (no muddy semi-transparent halo)
    px = small.load()
    for y in range(small.height):
        for x in range(small.width):
            r, g, b, a = px[x, y]
            if a < alpha_cutoff:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    return small


def tint_image(im: Image.Image, target_rgb: tuple[int, int, int], strength: float = 0.18) -> Image.Image:
    im = im.convert("RGBA")
    px = im.load()
    tr, tg, tb = target_rgb
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nr = int(r * (1 - strength) + tr * strength)
            ng = int(g * (1 - strength) + tg * strength)
            nb = int(b * (1 - strength) + tb * strength)
            px[x, y] = (max(0, min(255, nr)), max(0, min(255, ng)), max(0, min(255, nb)), a)
    return im


def make_diamond_tile(src: Path, out: Path, tint: tuple[int, int, int] | None = None, strength: float = 0.0) -> None:
    """Extract diamond floor tile from PtDesigns 384x512 tile and downscale cleanly to 32x16 iso diamond."""
    im = trim_alpha(Image.open(src))
    tile = im.resize((32, 16), Image.Resampling.LANCZOS)
    # Mask strictly to 32x16 isometric diamond so tiles tessellate cleanly with zero seams
    mask = Image.new("L", (32, 16), 0)
    md = ImageDraw.Draw(mask)
    md.polygon([(16, 0), (31, 8), (16, 15), (0, 8)], fill=255)
    px = tile.load()
    mp = mask.load()
    for y in range(16):
        for x in range(32):
            r, g, b, a = px[x, y]
            if mp[x, y] == 0 or a < 60:
                px[x, y] = (0, 0, 0, 0)
            else:
                px[x, y] = (r, g, b, 255)
    if tint and strength > 0:
        tile = tint_image(tile, tint, strength)
    tile.save(out)


def chroma_key_magenta(im: Image.Image) -> Image.Image:
    """Flood-fill remove solid magenta (#FF00FF) background cleanly from JPEG/PNG sprite sheets."""
    im = im.convert("RGBA")
    px = im.load()
    w, h = im.size

    def is_bg(r: int, g: int, b: int) -> bool:
        return r > 155 and b > 140 and g < 110 and (r - g) > 65 and (b - g) > 55

    # 1. Remove exterior + enclosed magenta holes (like inside the Start Gate arch!)
    visited = bytearray(w * h)
    stack: list[tuple[int, int]] = []
    # Seed edges + any pure magenta pixels across the image
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

    # 2. Clean 2-pass magenta JPEG fringe adjacent to transparent pixels
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


def draw_iso_box(
    draw: ImageDraw.ImageDraw,
    cx: int,
    cy: int,
    rx: int,
    ry: int,
    h: int,
    top: tuple[int, int, int],
    left: tuple[int, int, int],
    right: tuple[int, int, int],
    outline: tuple[int, int, int] = (35, 28, 26),
) -> None:
    """Draw a crisp 2:1 isometric pixel box centered at bottom vertex (cx, cy)."""
    top_pts = [(cx, cy - h - ry * 2), (cx + rx, cy - h - ry), (cx, cy - h), (cx - rx, cy - h - ry)]
    left_pts = [(cx - rx, cy - h - ry), (cx, cy - h), (cx, cy), (cx - rx, cy - ry)]
    right_pts = [(cx, cy - h), (cx + rx, cy - h - ry), (cx + rx, cy - ry), (cx, cy)]
    draw.polygon(left_pts, fill=left + (255,), outline=outline + (255,))
    draw.polygon(right_pts, fill=right + (255,), outline=outline + (255,))
    draw.polygon(top_pts, fill=top + (255,), outline=outline + (255,))


def build_bespoke_landmarks() -> dict[str, dict]:
    """Craft razor-sharp, Kairosoft-scale Higround landmark pixel art (100% Higround-owned)."""
    entries: dict[str, dict] = {}
    OUT = (34, 26, 24, 255)
    ORANGE = (255, 95, 14)
    ORANGE_D = (204, 68, 8)
    ORANGE_L = (255, 136, 64)
    NAVY = (46, 58, 140)
    NAVY_D = (30, 38, 98)
    YELLOW = (247, 208, 70)
    YELLOW_D = (204, 162, 36)
    CREAM = (246, 238, 220)
    CREAM_D = (218, 206, 184)
    WHITE = (252, 250, 245)
    WHITE_D = (215, 212, 205)
    WOOD = (176, 122, 74)
    WOOD_D = (134, 88, 50)
    BLUE = (75, 79, 184)
    BLUE_D = (52, 55, 140)
    RED = (224, 53, 43)
    RED_D = (175, 34, 28)
    CYAN = (127, 184, 224)
    CYAN_D = (84, 140, 184)

    # 1. START GATE Higround Run Club (76 x 56)
    im = Image.new("RGBA", (76, 56), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Left & right orange truss pillars (isometric placement along SE-NW)
    draw_iso_box(d, 16, 48, 7, 4, 30, ORANGE_L, ORANGE, ORANGE_D)
    draw_iso_box(d, 60, 38, 7, 4, 30, ORANGE_L, ORANGE, ORANGE_D)
    # Top arch beam connecting pillars
    beam = [(11, 18), (61, 7), (66, 10), (66, 20), (16, 31), (11, 28)]
    d.polygon(beam, fill=ORANGE + (255,), outline=OUT)
    d.polygon([(11, 18), (61, 7), (66, 10), (16, 21)], fill=ORANGE_L + (255,), outline=OUT)
    # White banner stripe + "0 KM" badge
    d.polygon([(20, 22), (56, 14), (56, 21), (20, 29)], fill=WHITE + (255,), outline=OUT)
    # Pixel "HIGROUND" dots on banner
    for i in range(6):
        bx = 24 + i * 5
        by = int(24 - i * 1.1)
        d.rectangle([bx, by, bx + 2, by + 2], fill=ORANGE + (255,))
    # Small yellow 0KM flag on top
    d.rectangle([34, 5, 46, 12], fill=YELLOW + (255,), outline=OUT)
    d.rectangle([36, 7, 38, 10], fill=OUT)
    d.rectangle([40, 7, 44, 10], fill=ORANGE + (255,))
    im.save(OUT_LANDMARKS / "start_gate.png")
    entries["start_gate"] = {"file": "/assets/world/landmarks/start_gate.png", "anchorX": 0.5, "anchorY": 0.88}

    # 2. Counter ORDER HERE! (88 x 68) — white counter + bold navy front panel + POS + grinders
    im = Image.new("RGBA", (88, 68), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 44, 62, 34, 17, 22, WHITE, WHITE_D, CREAM_D)
    # Navy ORDER HERE! panel on right-front face
    d.polygon([(46, 42), (75, 28), (75, 43), (46, 57)], fill=NAVY + (255,), outline=OUT)
    # Crisp pixel letters on navy panel
    for i in range(7):
        px = 50 + i * 3
        py = int(47 - i * 1.5)
        d.rectangle([px, py, px + 1, py + 3], fill=YELLOW + (255,))
    # Wood counter accent strip
    d.polygon([(13, 39), (44, 24), (75, 39), (44, 54)], fill=CREAM + (255,), outline=OUT)
    # POS tablet + tip jar + two cream coffee grinders + cookie jar on top
    draw_iso_box(d, 56, 36, 5, 3, 7, (50, 56, 68), (35, 38, 46), (25, 28, 36))
    d.rectangle([54, 28, 58, 31], fill=CYAN + (255,))
    draw_iso_box(d, 38, 38, 4, 2, 10, CREAM, CREAM_D, (180, 170, 155))
    d.ellipse([35, 22, 41, 28], fill=(70, 50, 38, 255), outline=OUT)
    draw_iso_box(d, 28, 34, 4, 2, 10, CREAM, CREAM_D, (180, 170, 155))
    d.ellipse([25, 18, 31, 24], fill=(70, 50, 38, 255), outline=OUT)
    # Red tip jar
    d.rectangle([45, 33, 50, 39], fill=RED + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "order_counter.png")
    entries["order_counter"] = {"file": "/assets/world/landmarks/order_counter.png", "anchorX": 0.5, "anchorY": 0.85}

    # 3. Curved Bar under stairs (86 x 66) — white bar + red/black espresso machine + maneki-neko + orange cups
    im = Image.new("RGBA", (86, 66), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 43, 60, 33, 16, 20, WHITE, WHITE_D, CREAM_D)
    # Espresso machine (black/red iconic machine)
    draw_iso_box(d, 34, 34, 10, 5, 12, (58, 58, 62), RED, (36, 36, 40))
    # Steam cups on espresso top
    for ox in (-4, 0, 4):
        d.rectangle([33 + ox, 16, 36 + ox, 19], fill=WHITE + (255,), outline=OUT)
    # Orange stack of Higround cups
    d.rectangle([48, 30, 53, 39], fill=ORANGE + (255,), outline=OUT)
    # Tiny white Maneki-Neko + Breakdance sign
    d.rectangle([57, 34, 62, 40], fill=WHITE + (255,), outline=OUT)
    d.point((59, 36), fill=RED + (255,))
    d.rectangle([64, 36, 70, 43], fill=CREAM + (255,), outline=OUT)
    d.rectangle([65, 38, 69, 40], fill=ORANGE + (255,))
    im.save(OUT_LANDMARKS / "curved_bar.png")
    entries["curved_bar"] = {"file": "/assets/world/landmarks/curved_bar.png", "anchorX": 0.5, "anchorY": 0.85}

    # 4. Kios HIGROUND COFFEE | POPSICLE GELATO (78 x 70)
    im = Image.new("RGBA", (78, 70), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Lower freezer counter (white/navy)
    draw_iso_box(d, 39, 64, 28, 14, 22, WHITE, NAVY, WHITE_D)
    # Glass gelato display window
    d.polygon([(17, 45), (37, 55), (37, 60), (17, 50)], fill=CYAN + (255,), outline=OUT)
    # 2 side corner posts
    d.rectangle([13, 24, 16, 48], fill=NAVY + (255,), outline=OUT)
    d.rectangle([62, 24, 65, 48], fill=NAVY + (255,), outline=OUT)
    # Yellow-and-blue roof fascia signage ("HIGROUND COFFEE / POPSICLE GELATO")
    draw_iso_box(d, 39, 34, 30, 15, 10, YELLOW, YELLOW_D, YELLOW)
    # Blue trim stripe on top & bottom of fascia
    d.line([(9, 19), (39, 34), (69, 19)], fill=NAVY + (255,), width=2)
    d.line([(9, 28), (39, 43), (69, 28)], fill=NAVY + (255,), width=2)
    # Red signage pixel dots
    for i in range(6):
        d.rectangle([16 + i * 3, 25 + int(i * 1.5), 17 + i * 3, 27 + int(i * 1.5)], fill=RED + (255,))
        d.rectangle([44 + i * 3, 35 - int(i * 1.5), 45 + i * 3, 37 - int(i * 1.5)], fill=ORANGE + (255,))
    im.save(OUT_LANDMARKS / "gelato_kiosk.png")
    entries["gelato_kiosk"] = {"file": "/assets/world/landmarks/gelato_kiosk.png", "anchorX": 0.5, "anchorY": 0.88}

    # 5. Two Blue Mascot-Wrapped Fridges (56 x 64)
    im = Image.new("RGBA", (56, 64), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Back fridge (taller)
    draw_iso_box(d, 22, 46, 12, 6, 32, WHITE, BLUE_D, BLUE)
    # Front fridge (slightly shorter, like photo 06!)
    draw_iso_box(d, 36, 56, 12, 6, 26, WHITE, BLUE_D, BLUE)
    # Cute red furry mascot decals on blue doors!
    for mx, my in [(26, 26), (40, 39)]:
        d.ellipse([mx - 4, my - 4, mx + 4, my + 5], fill=RED + (255,), outline=OUT)
        d.rectangle([mx - 2, my - 2, mx - 1, my], fill=WHITE + (255,))
        d.rectangle([mx + 1, my - 2, mx + 2, my], fill=WHITE + (255,))
    im.save(OUT_LANDMARKS / "mascot_fridges.png")
    entries["mascot_fridges"] = {"file": "/assets/world/landmarks/mascot_fridges.png", "anchorX": 0.5, "anchorY": 0.90}

    # 6. Kids Corner (Red mesh cabinet + mini basketball hoop + board) (64 x 58)
    im = Image.new("RGBA", (64, 58), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 30, 52, 20, 10, 20, RED, RED_D, RED)
    # Mesh dots
    for gx in range(32, 48, 3):
        for gy in range(36, 48, 3):
            d.point((gx, gy - (gx - 32) // 2), fill=OUT)
    # Mini basketball backboard + hoop
    d.rectangle([16, 10, 30, 22], fill=WHITE + (255,), outline=OUT)
    d.rectangle([19, 13, 27, 19], fill=ORANGE + (255,), outline=OUT)
    d.ellipse([20, 18, 26, 22], outline=RED + (255,))
    im.save(OUT_LANDMARKS / "kids_corner.png")
    entries["kids_corner"] = {"file": "/assets/world/landmarks/kids_corner.png", "anchorX": 0.5, "anchorY": 0.88}

    # 7. Orange Mascot Banner Wall ("ONE BITE SAYS IT ALL") (44 x 52)
    im = Image.new("RGBA", (44, 52), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    # Isometric wall hanging along right wall
    d.polygon([(8, 12), (36, 26), (36, 48), (8, 34)], fill=CREAM + (255,), outline=OUT)
    d.line([(8, 12), (36, 26)], fill=ORANGE + (255,), width=2)
    # Orange mascot silhouette in middle
    d.ellipse([16, 23, 28, 36], fill=ORANGE + (255,), outline=OUT)
    d.rectangle([19, 26, 21, 29], fill=WHITE + (255,))
    d.rectangle([23, 26, 25, 29], fill=WHITE + (255,))
    im.save(OUT_LANDMARKS / "mascot_banner.png")
    entries["mascot_banner"] = {"file": "/assets/world/landmarks/mascot_banner.png", "anchorX": 0.5, "anchorY": 0.92}

    # 8. Papan RUN CLUB WEEK (Leaderboard Board) (64 x 42)
    im = Image.new("RGBA", (64, 42), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(6, 20), (54, 4), (58, 6), (58, 26), (10, 40), (6, 38)], fill=NAVY + (255,), outline=OUT)
    # Yellow header bar + orange progress bars
    d.polygon([(12, 22), (52, 9), (52, 13), (12, 26)], fill=YELLOW + (255,))
    for row in range(3):
        y0 = 28 + row * 3
        d.line([(13, y0), (42 - row * 6, y0 - 9 + row * 2)], fill=ORANGE + (255,), width=2)
    im.save(OUT_LANDMARKS / "leaderboard_board.png")
    entries["leaderboard_board"] = {"file": "/assets/world/landmarks/leaderboard_board.png", "anchorX": 0.5, "anchorY": 0.90}

    # 9. Papan YOGA QUEST (28-pose grid) (52 x 46)
    im = Image.new("RGBA", (52, 46), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(8, 10), (44, 24), (44, 42), (8, 28)], fill=ORANGE + (255,), outline=OUT)
    d.polygon([(11, 13), (41, 25), (41, 39), (11, 27)], fill=CREAM + (255,), outline=OUT)
    # Mini yellow stars grid
    for col in range(5):
        for row in range(3):
            sx = 14 + col * 5
            sy = 18 + col * 2 + row * 4
            d.rectangle([sx, sy, sx + 2, sy + 2], fill=(YELLOW if (col + row) % 2 == 0 else ORANGE) + (255,))
    im.save(OUT_LANDMARKS / "yoga_quest_board.png")
    entries["yoga_quest_board"] = {"file": "/assets/world/landmarks/yoga_quest_board.png", "anchorX": 0.5, "anchorY": 0.90}

    # 10. Medal & Bib Wall (72 x 42)
    im = Image.new("RGBA", (72, 42), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(6, 24), (62, 6), (66, 8), (66, 22), (10, 40), (6, 38)], fill=WOOD + (255,), outline=OUT)
    # Hanging gold medals & white race bibs
    for i in range(6):
        mx = 14 + i * 8
        my = int(31 - i * 2.5)
        d.line([(mx, my - 5), (mx, my)], fill=ORANGE + (255,), width=1)
        d.ellipse([mx - 2, my, mx + 2, my + 4], fill=YELLOW + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "medal_wall.png")
    entries["medal_wall"] = {"file": "/assets/world/landmarks/medal_wall.png", "anchorX": 0.5, "anchorY": 0.90}

    # 11. Hydration Station / Galon Air (32 x 40)
    im = Image.new("RGBA", (32, 40), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 16, 36, 9, 5, 16, WHITE, WHITE_D, CREAM_D)
    # Blue water gallon on top
    d.rounded_rectangle([10, 6, 22, 20], radius=3, fill=CYAN + (255,), outline=OUT)
    d.rectangle([12, 9, 15, 16], fill=(195, 232, 255, 255))
    d.rectangle([14, 24, 18, 28], fill=ORANGE + (255,))
    im.save(OUT_LANDMARKS / "hydration_station.png")
    entries["hydration_station"] = {"file": "/assets/world/landmarks/hydration_station.png", "anchorX": 0.5, "anchorY": 0.90}
    entries["hydration_out"] = {"file": "/assets/world/landmarks/hydration_station.png", "anchorX": 0.5, "anchorY": 0.90}

    # 12. Orange Traffic Cone (20 x 24)
    im = Image.new("RGBA", (20, 24), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(4, 20), (10, 17), (16, 20), (10, 23)], fill=ORANGE_D + (255,), outline=OUT)
    d.polygon([(6, 19), (10, 6), (14, 19)], fill=ORANGE + (255,), outline=OUT)
    d.line([(8, 13), (12, 13)], fill=WHITE + (255,), width=2)
    im.save(OUT_LANDMARKS / "cone.png")
    entries["cone"] = {"file": "/assets/world/landmarks/cone.png", "anchorX": 0.5, "anchorY": 0.90}

    # 13. Parked Scooters (68 x 44)
    im = Image.new("RGBA", (68, 44), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    for ox, oy, col in [(0, 0, (66, 70, 82)), (22, 8, (195, 62, 48))]:
        # Wheels
        d.ellipse([12 + ox, 22 + oy, 20 + ox, 30 + oy], fill=(32, 32, 36, 255), outline=OUT)
        d.ellipse([28 + ox, 16 + oy, 36 + ox, 24 + oy], fill=(32, 32, 36, 255), outline=OUT)
        # Body + seat
        d.polygon([(14 + ox, 22 + oy), (30 + ox, 14 + oy), (36 + ox, 18 + oy), (20 + ox, 26 + oy)], fill=col + (255,), outline=OUT)
        d.polygon([(16 + ox, 18 + oy), (25 + ox, 14 + oy), (28 + ox, 16 + oy), (19 + ox, 20 + oy)], fill=(45, 40, 38, 255), outline=OUT)
        # Handlebar + helmet
        d.line([(31 + ox, 16 + oy), (31 + ox, 7 + oy)], fill=(50, 50, 54, 255), width=2)
        d.line([(27 + ox, 8 + oy), (35 + ox, 6 + oy)], fill=OUT, width=2)
        d.ellipse([17 + ox, 11 + oy, 24 + ox, 18 + oy], fill=YELLOW + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "scooters.png")
    entries["scooters"] = {"file": "/assets/world/landmarks/scooters.png", "anchorX": 0.5, "anchorY": 0.86}

    # 14. Bar Sink (34 x 34)
    im = Image.new("RGBA", (34, 34), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 17, 30, 12, 6, 14, (205, 212, 218), (156, 164, 172), (178, 186, 194))
    d.polygon([(12, 13), (17, 10), (22, 13), (17, 16)], fill=(120, 134, 145, 255), outline=OUT)
    d.line([(17, 10), (17, 5), (19, 6)], fill=(90, 96, 104, 255), width=2)
    im.save(OUT_LANDMARKS / "bar_sink.png")
    entries["bar_sink"] = {"file": "/assets/world/landmarks/bar_sink.png", "anchorX": 0.5, "anchorY": 0.88}

    # 15. Shoe Rack (36 x 38)
    im = Image.new("RGBA", (36, 38), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    draw_iso_box(d, 18, 34, 13, 6, 18, (64, 66, 74), (42, 44, 52), (52, 54, 62))
    for sy in (20, 26):
        d.rectangle([10, sy, 14, sy + 2], fill=ORANGE + (255,))
        d.rectangle([16, sy + 2, 20, sy + 4], fill=WHITE + (255,))
        d.rectangle([22, sy, 26, sy + 2], fill=YELLOW + (255,))
    im.save(OUT_LANDMARKS / "shoe_rack.png")
    entries["shoe_rack"] = {"file": "/assets/world/landmarks/shoe_rack.png", "anchorX": 0.5, "anchorY": 0.88}

    # 16. Single Yoga Mat (for Studio Room yoga mode, tiled 2x3!) (38 x 22)
    im = Image.new("RGBA", (38, 22), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(19, 2), (35, 10), (19, 18), (3, 10)], fill=(255, 146, 94, 255), outline=OUT)
    d.polygon([(19, 4), (31, 10), (19, 16), (7, 10)], fill=(255, 174, 128, 255))
    im.save(OUT_LANDMARKS / "yoga_mat_single.png")
    entries["yoga_mat_single"] = {"file": "/assets/world/landmarks/yoga_mat_single.png", "anchorX": 0.5, "anchorY": 0.5}

    # 17. Stretch Mat + Orange Foam Roller (44 x 26)
    im = Image.new("RGBA", (44, 26), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.polygon([(22, 3), (41, 13), (22, 23), (3, 13)], fill=(238, 214, 192, 255), outline=OUT)
    d.rounded_rectangle([14, 10, 28, 15], radius=2, fill=ORANGE + (255,), outline=OUT)
    im.save(OUT_LANDMARKS / "stretch_mat.png")
    entries["stretch_mat"] = {"file": "/assets/world/landmarks/stretch_mat.png", "anchorX": 0.5, "anchorY": 0.5}

    # Process AI-generated 2x2 Higround landmark & mascot sheets when available
    lm_files = sorted(GEN_DIR.glob("gen_landmarks_1*.jpg")) + sorted(GEN_DIR.glob("gen_landmarks_1*.png"))
    if lm_files:
        raw = chroma_key_magenta(Image.open(lm_files[-1]))
        gw, gh = raw.size
        quads = {
            "start_gate": ((0, 0, gw // 2, gh // 2), 82, 74, 0.88),
            "order_counter": ((gw // 2, 0, gw, gh // 2), 84, 72, 0.85),
            "gelato_kiosk": ((0, gh // 2, gw // 2, gh), 68, 76, 0.88),
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
            q = crisp_resize(raw.crop(box), 32, 34, alpha_cutoff=115)
            q.save(OUT_MASCOT / f"{key}.png")
            entries[key] = {"file": f"/assets/world/mascot/{key}.png", "anchorX": 0.5, "anchorY": 0.94, "source": "Higround (own)"}
        # High-res guide portraits for Character Creator & Onboarding UI
        guide = crisp_resize(raw.crop((0, 0, gw // 2, gh // 2)), 96, 96, alpha_cutoff=115)
        guide.save(OUT_MASCOT / "guide_idle.png")
        cheer = crisp_resize(raw.crop((0, gh // 2, gw // 2, gh)), 96, 96, alpha_cutoff=115)
        cheer.save(OUT_MASCOT / "guide_cheer.png")
        entries["mascot_guide"] = {"file": "/assets/world/mascot/guide_idle.png", "anchorX": 0.5, "anchorY": 0.94, "source": "Higround (own)"}

    return entries


def build_cc0_assets() -> dict[str, dict]:
    """Slice & downscale CC0 PtDesigns Cozy Shops + Town Environments sprites to crisp 32x16 grid scale."""
    manifest: dict[str, dict] = {}

    # Floor tiles (32x16 exact isometric diamonds)
    tile_sources = {
        "tile_asphalt": (TOWN / "environments_shopping_street_tiles_v1.0/environments_shopping_street_tiles_v1.0/tiles/asphalt_plain.png", None, 0.0),
        "tile_road_dashed": (TOWN / "environments_shopping_street_tiles_v1.0/environments_shopping_street_tiles_v1.0/tiles/road_dashed_u.png", None, 0.0),
        "tile_sidewalk": (TOWN / "environments_shopping_street_tiles_v1.0/environments_shopping_street_tiles_v1.0/tiles/sidewalk_plain.png", (215, 208, 196), 0.15),
        "tile_concrete_1": (SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles/floor_stone_clean.png", (196, 192, 184), 0.35),
        "tile_concrete_2": (SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles/floor_stone_aged.png", (184, 180, 172), 0.35),
        "tile_studio_1": (SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles/floor_timber_clean.png", (243, 233, 210), 0.25),
        "tile_studio_2": (SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles/floor_timber_aged.png", (236, 224, 198), 0.25),
        "tile_lounge": (SHOPS / "cozy_shops_foundations_tiles_v1.0/cozy_shops_foundations_tiles_v1.0/tiles/floor_tile_clean.png", (255, 224, 196), 0.30),
    }
    for key, (src, tint, strength) in tile_sources.items():
        if src.exists():
            out = OUT_TILES / f"{key}.png"
            make_diamond_tile(src, out, tint=tint, strength=strength)
            manifest[key] = {"file": f"/assets/world/tiles/{key}.png", "anchorX": 0.5, "anchorY": 0.5, "source": "PtDesigns (CC0)"}

    # Props mapped directly to world_layout.json keys (CC0 PtDesigns Cozy Shops)
    prop_specs: dict[str, tuple[Path, int, int, tuple[int, int, int] | None, float]] = {
        "cafe_table": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/04_round_cafe_table.png", 34, 34, (45, 45, 48), 0.25),
        "cafe_chair": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/05_dining_chair.png", 20, 26, (245, 243, 238), 0.30),
        "plants_terrace": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/24_small_potted_tree.png", 34, 44, None, 0.0),
        "plants_window": (SHOPS / "cozy_shops_general_store_sprites_v1.0/cozy_shops_general_store_sprites_v1.0/sprites/24_potted_rubber_plant.png", 28, 36, None, 0.0),
        "plant_bench": (SHOPS / "cozy_shops_flower_shop_sprites_v1.0/cozy_shops_flower_shop_sprites_v1.0/sprites/09_fern_pot.png", 32, 32, None, 0.0),
        "sandwich_board": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/22_chalkboard_easel_blank.png", 26, 32, None, 0.0),
        "book_ledge": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/23_low_bookshelf.png", 44, 44, (176, 122, 74), 0.15),
        "chiller": (SHOPS / "cozy_shops_flower_shop_sprites_v1.0/cozy_shops_flower_shop_sprites_v1.0/sprites/03_refrigerated_floral_cabinet.png", 36, 46, (210, 228, 240), 0.22),
        "communal_table": (SHOPS / "cozy_shops_corner_bakery_sprites_v1.0/cozy_shops_corner_bakery_sprites_v1.0/sprites/04_wooden_preparation_bench.png", 64, 52, (176, 122, 74), 0.16),
        "vinyl_shelf": (SHOPS / "cozy_shops_little_bookshop_sprites_v1.0/cozy_shops_little_bookshop_sprites_v1.0/sprites/02_low_display_bookshelf.png", 44, 40, (243, 233, 210), 0.18),
        "props_rack": (SHOPS / "cozy_shops_general_store_sprites_v1.0/cozy_shops_general_store_sprites_v1.0/sprites/02_goods_shelving_unit.png", 38, 46, (176, 122, 74), 0.15),
        "wall_desks": (SHOPS / "cozy_shops_little_bookshop_sprites_v1.0/cozy_shops_little_bookshop_sprites_v1.0/sprites/03_cashier_desk.png", 42, 42, (248, 244, 236), 0.25),
        "bag_cubbies": (SHOPS / "cozy_shops_little_bookshop_sprites_v1.0/cozy_shops_little_bookshop_sprites_v1.0/sprites/01_tall_oak_bookcase.png", 42, 54, (176, 122, 74), 0.14),
        "bench_lounge": (SHOPS / "cozy_shops_corner_bakery_sprites_v1.0/cozy_shops_corner_bakery_sprites_v1.0/sprites/04_wooden_preparation_bench.png", 52, 42, (176, 122, 74), 0.18),
        "kitchen_oven": (SHOPS / "cozy_shops_corner_bakery_sprites_v1.0/cozy_shops_corner_bakery_sprites_v1.0/sprites/03_stone_baking_oven.png", 42, 48, (180, 184, 190), 0.25),
        "espresso_prop": (SHOPS / "cozy_shops_neighborhood_cafe_sprites_v1.0/cozy_shops_neighborhood_cafe_sprites_v1.0/sprites/02_espresso_machine.png", 28, 28, (224, 53, 43), 0.25),
    }

    for key, (src, tw, th, tint, strength) in prop_specs.items():
        if not src.exists():
            print(f"WARN missing CC0 source: {src}")
            continue
        im = crisp_resize(Image.open(src), tw, th)
        if tint and strength > 0:
            im = tint_image(im, tint, strength)
        out = OUT_PROPS / f"{key}.png"
        im.save(out)
        manifest[key] = {
            "file": f"/assets/world/props/{key}.png",
            "anchorX": 0.5,
            "anchorY": 0.86,
            "source": "PtDesigns (CC0)",
        }

    # Build a nice composite table+2 chairs sprite for tables (f1..f3, m1..m3)
    if (OUT_PROPS / "cafe_table.png").exists() and (OUT_PROPS / "cafe_chair.png").exists():
        tbl = Image.open(OUT_PROPS / "cafe_table.png").convert("RGBA")
        chr_l = Image.open(OUT_PROPS / "cafe_chair.png").convert("RGBA")
        chr_r = chr_l.transpose(Image.Transpose.FLIP_LEFT_RIGHT)
        comp = Image.new("RGBA", (54, 42), (0, 0, 0, 0))
        comp.alpha_composite(chr_l, (2, 10))
        comp.alpha_composite(chr_r, (32, 10))
        comp.alpha_composite(tbl, (10, 6))
        comp.save(OUT_PROPS / "table_set.png")
        for tk in ("table_f1", "table_f2", "table_f3", "table_m1", "table_m2", "table_m3"):
            manifest[tk] = {
                "file": "/assets/world/props/table_set.png",
                "anchorX": 0.5,
                "anchorY": 0.84,
                "source": "PtDesigns (CC0)",
            }

    return manifest


def main() -> None:
    manifest = {}
    manifest.update(build_cc0_assets())
    manifest.update(build_bespoke_landmarks())
    manifest_path = WEB_PUBLIC / "manifest.json"
    manifest_path.write_text(json.dumps({"tileW": 32, "tileH": 16, "sprites": manifest}, indent=2) + "\n")
    print(f"Built {len(manifest)} world sprites -> {manifest_path}")


if __name__ == "__main__":
    main()
