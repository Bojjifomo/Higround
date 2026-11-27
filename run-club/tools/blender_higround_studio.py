#!/usr/bin/env python3
"""
Higround Run Club — Blender 4.x + Standalone Python 2:1 Isometric Pixel-Art Studio
===================================================================================
Solves art consistency across Higround's 5 x 18 m ruko by defining architectural pieces in true 3D
meter coordinates, lighting them from one consistent upper-left directional sun, and projecting
through an exact 2:1 Orthographic Isometric camera with 3-band toon shading + crisp 1px pixel outlines.

Usage:
  1) With Blender installed (`brew install --cask blender`):
     blender --background --python run-club/tools/blender_higround_studio.py
  2) Without Blender (runs immediately anywhere with Python 3 + Pillow):
     python3 run-club/tools/blender_higround_studio.py --standalone

Outputs PNG sprites + manifest into apps/web/public/assets/world/blender/ (100% Higround-owned).
"""
from __future__ import annotations

import json
import math
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
OUT_DIR = REPO / "run-club" / "apps" / "web" / "public" / "assets" / "world" / "blender"
OUT_DIR.mkdir(parents=True, exist_ok=True)

# ── Shared 3D Box Primitive Definitions (meters, Higround brand palette §5) ──
# Each box: (x0, y0, z0, dx, dy, dz, (r, g, b))
PALETTE = {
    "cream": (243, 233, 210),
    "white": (250, 248, 242),
    "orange": (255, 95, 14),
    "wood": (176, 122, 74),
    "wood_dark": (128, 84, 46),
    "navy": (46, 58, 140),
    "yellow": (247, 208, 70),
    "concrete": (146, 142, 136),
    "glass": (142, 197, 232),
    "dark_glass": (54, 72, 92),
    "charcoal": (44, 44, 50),
    "green": (74, 152, 78),
    "green_light": (120, 190, 112),
    "red": (224, 53, 43),
}

SCENES_3D: dict[str, dict] = {
    # Photo 02: Iconic Higround storefront section (glass door + wood pillar + arch window!)
    "arch_facade_3d": {
        "scale": 14,
        "boxes": [
            # Main cream storefront wall
            (0.0, 0.0, 0.0, 4.6, 0.35, 3.1, PALETTE["cream"]),
            # Orange top fascia beam
            (0.0, -0.05, 3.05, 4.6, 0.45, 0.25, PALETTE["orange"]),
            # Tall glass door (left)
            (0.25, -0.04, 0.05, 1.15, 0.12, 2.35, PALETTE["glass"]),
            (0.25, -0.06, 0.05, 0.08, 0.14, 2.35, PALETTE["charcoal"]),
            (1.32, -0.06, 0.05, 0.08, 0.14, 2.35, PALETTE["charcoal"]),
            # Iconic warm wood vertical pillar
            (1.45, -0.06, 0.0, 0.38, 0.45, 2.65, PALETTE["wood"]),
            # Iconic arched COFFEE & BURGER window (stepped arch!)
            (2.05, -0.04, 0.55, 2.25, 0.12, 1.45, PALETTE["dark_glass"]),
            (2.35, -0.04, 2.00, 1.65, 0.12, 0.32, PALETTE["dark_glass"]),
            (2.65, -0.04, 2.32, 1.05, 0.12, 0.22, PALETTE["dark_glass"]),
            # Potted tropical plants beside arch window
            (4.1, -0.55, 0.0, 0.45, 0.45, 0.42, PALETTE["wood_dark"]),
            (4.0, -0.65, 0.42, 0.65, 0.65, 0.55, PALETTE["green"]),
            (4.12, -0.52, 0.90, 0.42, 0.42, 0.32, PALETTE["green_light"]),
        ],
    },
    # Isometric 8-step concrete staircase with warm oak handrail (L1 <-> L2)
    "staircase_3d": {
        "scale": 14,
        "boxes": [
            # 8 stepped concrete risers
            *[(0.0, i * 0.42, 0.0, 1.25, 0.44, 0.24 * (i + 1), PALETTE["concrete"]) for i in range(8)],
            # Warm wood handrail posts + sloping rail blocks
            *[(1.18, i * 0.42 + 0.12, 0.24 * (i + 1), 0.1, 0.1, 0.65, PALETTE["wood_dark"]) for i in (0, 3, 7)],
            *[(1.16, i * 0.42, 0.24 * (i + 1) + 0.62, 0.14, 0.46, 0.1, PALETTE["wood"]) for i in range(8)],
        ],
    },
    # Photo 11: Floor 2 Studio sunlit window + low white vinyl shelf + yellow mushroom lamp
    "studio_window_3d": {
        "scale": 16,
        "boxes": [
            # Cream studio back wall
            (0.0, 0.0, 0.0, 3.2, 0.25, 2.8, PALETTE["cream"]),
            # Sunlit double window + green foliage canopy outside
            (0.65, -0.04, 1.05, 1.9, 0.10, 1.35, PALETTE["glass"]),
            (0.85, -0.05, 1.25, 0.75, 0.08, 0.65, PALETTE["green"]),
            (1.45, -0.05, 1.45, 0.85, 0.08, 0.65, PALETTE["green_light"]),
            (1.56, -0.07, 1.05, 0.08, 0.12, 1.35, PALETTE["white"]),
            # Low white vinyl & art shelf underneath window
            (0.55, -0.58, 0.0, 2.1, 0.56, 0.62, PALETTE["white"]),
            # Two matte black bookshelf speakers
            (0.62, -0.46, 0.62, 0.26, 0.28, 0.42, PALETTE["charcoal"]),
            (2.32, -0.46, 0.62, 0.26, 0.28, 0.42, PALETTE["charcoal"]),
            # Framed colorful art prints
            (1.02, -0.35, 0.62, 0.36, 0.08, 0.45, PALETTE["red"]),
            (1.82, -0.35, 0.62, 0.36, 0.08, 0.45, PALETTE["navy"]),
            # Iconic glowing yellow mushroom lamp in center!
            (1.54, -0.44, 0.62, 0.12, 0.12, 0.22, PALETTE["yellow"]),
            (1.44, -0.52, 0.84, 0.32, 0.32, 0.18, PALETTE["yellow"]),
        ],
    },
    # Photo 07: Skylight stepped wooden planter bench + aglaonema + round mirror
    "skylight_bench_3d": {
        "scale": 16,
        "boxes": [
            # Bright sunlit skylight back wall
            (0.0, 0.0, 0.0, 3.0, 0.22, 2.5, PALETTE["white"]),
            # Round wall mirror (stepped pixel circle on back wall)
            (1.15, -0.05, 1.45, 0.70, 0.08, 0.70, PALETTE["glass"]),
            (1.05, -0.05, 1.55, 0.90, 0.08, 0.50, PALETTE["glass"]),
            # Stepped warm teak planter bench
            (0.15, -0.82, 0.0, 2.7, 0.80, 0.45, PALETTE["wood"]),
            (0.15, -0.45, 0.45, 2.7, 0.42, 0.30, PALETTE["wood_dark"]),
            # Lush aglaonema foliage clusters across top of bench
            *[(0.32 + i * 0.52, -0.52, 0.72, 0.42, 0.42, 0.42 + (i % 2) * 0.14, PALETTE["green"] if i % 2 == 0 else PALETTE["green_light"]) for i in range(5)],
        ],
    },
}


def render_standalone_3d_iso() -> dict[str, dict]:
    """Pure-Python 3D Orthographic Isometric 2:1 Z-buffer pixel rasterizer (runs without Blender)."""
    from PIL import Image

    OUTLINE = (36, 25, 23, 255)
    manifest: dict[str, dict] = {}

    for name, spec in SCENES_3D.items():
        scale = spec["scale"]
        boxes = spec["boxes"]

        # Project vertices through exact 2:1 isometric ortho matrix:
        # screen_x = (x - y) * scale, screen_y = (x + y) * (scale / 2) - z * scale
        def proj(x: float, y: float, z: float) -> tuple[float, float]:
            return ((x - y) * scale, (x + y) * (scale * 0.5) - z * scale)

        # Compute bounding box
        xs, ys = [], []
        for x0, y0, z0, dx, dy, dz, _ in boxes:
            for cx in (x0, x0 + dx):
                for cy in (y0, y0 + dy):
                    for cz in (z0, z0 + dz):
                        sx, sy = proj(cx, cy, cz)
                        xs.append(sx)
                        ys.append(sy)
        pad = 6
        min_x, max_x = math.floor(min(xs)) - pad, math.ceil(max(xs)) + pad
        min_y, max_y = math.floor(min(ys)) - pad, math.ceil(max(ys)) + pad
        w = max(16, max_x - min_x + 1)
        h = max(16, max_y - min_y + 1)

        im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        px = im.load()
        zbuf = [[-1e9] * w for _ in range(h)]

        # Rasterize every 3D box face with upper-left sun directional shading (Top 1.05, Left 0.86, Right 0.70)
        def shade_col(rgb: tuple[int, int, int], f: float) -> tuple[int, int, int, int]:
            return (
                max(0, min(255, int(rgb[0] * f))),
                max(0, min(255, int(rgb[1] * f))),
                max(0, min(255, int(rgb[2] * f))),
                255,
            )

        def fill_quad(pts3d: list[tuple[float, float, float]], color: tuple[int, int, int, int]) -> None:
            pts2 = [(proj(x, y, z)[0] - min_x, proj(x, y, z)[1] - min_y, x + y + z * 0.65) for x, y, z in pts3d]
            qx0 = max(0, math.floor(min(p[0] for p in pts2)))
            qx1 = min(w - 1, math.ceil(max(p[0] for p in pts2)))
            qy0 = max(0, math.floor(min(p[1] for p in pts2)))
            qy1 = min(h - 1, math.ceil(max(p[1] for p in pts2)))

            # Split quad into 2 triangles for exact barycentric z-buffer test
            for tri in ((pts2[0], pts2[1], pts2[2]), (pts2[0], pts2[2], pts2[3])):
                (x0, y0, z0), (x1, y1, z1), (x2, y2, z2) = tri
                denom = (y1 - y2) * (x0 - x2) + (x2 - x1) * (y0 - y2)
                if abs(denom) < 1e-6:
                    continue
                for py in range(qy0, qy1 + 1):
                    for px_i in range(qx0, qx1 + 1):
                        a = ((y1 - y2) * (px_i + 0.5 - x2) + (x2 - x1) * (py + 0.5 - y2)) / denom
                        b = ((y2 - y0) * (px_i + 0.5 - x2) + (x0 - x2) * (py + 0.5 - y2)) / denom
                        c = 1.0 - a - b
                        if a >= -1e-4 and b >= -1e-4 and c >= -1e-4:
                            depth = a * z0 + b * z1 + c * z2
                            if depth > zbuf[py][px_i]:
                                zbuf[py][px_i] = depth
                                px[px_i, py] = color

        for x0, y0, z0, dx, dy, dz, col in boxes:
            x1, y1, z1 = x0 + dx, y0 + dy, z0 + dz
            # Top face (+Z) — brightest (sun upper-left)
            fill_quad([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], shade_col(col, 1.04))
            # Front-left face (+Y)
            fill_quad([(x0, y1, z0), (x1, y1, z0), (x1, y1, z1), (x0, y1, z1)], shade_col(col, 0.85))
            # Front-right face (+X)
            fill_quad([(x1, y0, z0), (x1, y1, z0), (x1, y1, z1), (x1, y0, z1)], shade_col(col, 0.70))

        # Crisp 1px pixel-art outline pass
        out_im = im.copy()
        opx = out_im.load()
        for y in range(h):
            for x in range(w):
                if px[x, y][3] != 0:
                    continue
                if any(
                    0 <= x + dx < w and 0 <= y + dy < h and px[x + dx, y + dy][3] > 0
                    for dx, dy in ((-1, 0), (1, 0), (0, -1), (0, 1))
                ):
                    opx[x, y] = OUTLINE

        out_path = OUT_DIR / f"{name}.png"
        out_im.save(out_path)
        manifest[name] = {
            "file": f"/assets/world/blender/{name}.png",
            "width": w,
            "height": h,
            "pipeline": "blender_higround_studio (standalone 3D ortho 2:1)",
        }
        print(f"Rendered 3D ortho isometric sprite: {out_path.name} ({w}x{h})")

    (OUT_DIR / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n")
    return manifest


def render_with_blender() -> None:
    """Native Blender 4.x bpy isometric 2:1 orthographic pixel-art render pipeline."""
    import bpy  # type: ignore

    for name, spec in SCENES_3D.items():
        bpy.ops.wm.read_factory_settings(use_empty=True)
        scene = bpy.context.scene
        scene.render.engine = "BLENDER_EEVEE_NEXT" if "BLENDER_EEVEE_NEXT" in dir(bpy.types) else "BLENDER_EEVEE"
        scene.render.film_transparent = True
        scene.render.resolution_x = 128
        scene.render.resolution_y = 128
        scene.render.filter_size = 0.01  # crisp nearest-style pixel edges
        scene.render.use_freestyle = True
        scene.view_layers[0].freestyle_settings.linesets.new("PixelOutline")

        # True 2:1 Isometric Orthographic Camera (elevation arctan(1/sqrt(2)) ≈ 60° from vertical, yaw 45°)
        cam_data = bpy.data.cameras.new("IsoCam")
        cam_data.type = "ORTHO"
        cam_data.ortho_scale = 6.5
        cam_obj = bpy.data.objects.new("IsoCam", cam_data)
        scene.collection.objects.link(cam_obj)
        cam_obj.location = (10.0, -10.0, 10.0)
        cam_obj.rotation_euler = (math.radians(60.0), 0.0, math.radians(45.0))
        scene.camera = cam_obj

        # Upper-left directional sun matching Higround pixel art direction (SPEC §12.1)
        sun_data = bpy.data.lights.new("Sun", type="SUN")
        sun_data.energy = 3.2
        sun_obj = bpy.data.objects.new("Sun", sun_data)
        scene.collection.objects.link(sun_obj)
        sun_obj.rotation_euler = (math.radians(38.0), math.radians(-22.0), math.radians(30.0))

        for idx, (x0, y0, z0, dx, dy, dz, rgb) in enumerate(spec["boxes"]):
            bpy.ops.mesh.primitive_cube_add(size=1.0, location=(x0 + dx / 2, y0 + dy / 2, z0 + dz / 2))
            obj = bpy.context.active_object
            obj.scale = (dx, dy, dz)
            mat = bpy.data.materials.new(f"Mat_{idx}")
            mat.use_nodes = True
            bsdf = mat.node_tree.nodes.get("Principled BSDF")
            if bsdf:
                bsdf.inputs["Base Color"].default_value = (rgb[0] / 255.0, rgb[1] / 255.0, rgb[2] / 255.0, 1.0)
                bsdf.inputs["Roughness"].default_value = 0.9
            obj.data.materials.append(mat)

        scene.render.filepath = str(OUT_DIR / f"{name}.png")
        bpy.ops.render.render(write_still=True)
        print(f"Blender rendered {name}.png")


if __name__ == "__main__":
    if "--standalone" in sys.argv:
        render_standalone_3d_iso()
    else:
        try:
            import bpy  # type: ignore  # noqa: F401
            render_with_blender()
        except ImportError:
            print("Blender (bpy) not detected; running built-in 3D Orthographic 2:1 Pixel Renderer (--standalone)...")
            render_standalone_3d_iso()
