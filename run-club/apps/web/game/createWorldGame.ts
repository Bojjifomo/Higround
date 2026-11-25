/**
 * Phaser 3 isometric renderer for the Higround world (SPEC §6.3, §12.4).
 * Loaded only in the browser via dynamic import.
 *
 * Renders:
 * - CC0 PtDesigns isometric pixel floor tiles & Cozy Shops furniture props
 * - Custom Higround pixel landmarks (Start Gate 0 KM, ORDER HERE! counter, Gelato Kiosk, Mascot Fridges, etc.)
 * - Animated multi-frame paper-doll characters (idle, walk, run, sit, stretch, yoga)
 * - Animated 4-pose Higround mascot, coffee steam particles, warm night lamps, pop-in Kairosoft bubbles,
 *   and dynamic Studio Room mode (Yoga morning vs Dine-in afternoon/evening).
 */
import * as Phaser from "phaser";
import { dayPhase, seeded, spawnAgent, tick, wibHour, type Agent, type Rng } from "@/lib/world/agents";
import { spriteEntry, WORLD_MANIFEST } from "@/lib/world/assetManifest";
import { buildWorld, type SceneGrid, type SceneKey, type World, type WorldObject } from "@/lib/world/layout";
import { ISO_H, ISO_W, toGrid, toScreen } from "@/lib/world/path";
import {
  ANIM_FRAMES, MASCOT, MASCOT_PALETTE, renderAvatarPixels, type AnimPose, type AvatarColors,
} from "@/lib/world/sprite";

export type StudioModeOverride = "auto" | "yoga" | "dine";

export interface GameMember {
  id: string;
  name: string;
  avatar: AvatarColors;
  ranToday: boolean;
  yogaStars: number;
  isMe: boolean;
  level: number;
}

export interface WorldGame {
  setScene(key: SceneKey): void;
  setZoom(z: number): void;
  setStudioMode(mode: StudioModeOverride): void;
  focusMe(): SceneKey | null;
  destroy(): void;
}

export interface GameOptions {
  members: GameMember[];
  initialScene: SceneKey;
  onSelect(memberId: string | null): void;
  onSceneCount?(counts: Record<SceneKey, number>): void;
  onStudioModeResolved?(mode: "yoga" | "dine"): void;
}

const MASCOT_ID = "__mascot__";
const FLOOR_FALLBACK: Record<SceneKey, [number, number]> = {
  street: [0xb9b4ab, 0xaea89e],
  floor1: [0xa9a6a0, 0x9f9c96],
  floor2: [0xe9dfc8, 0xe1d6bd],
};
const KIND_H: Record<string, number> = { poi: 12, deco: 9, struct: 30, wall_art: 24 };
const FLAT = new Set(["yoga_mats", "stretch_zone", "stretch_spot", "event_corner"]);

const hex = (c: string | undefined, fallback: number) => {
  if (!c || c === "none" || !c.startsWith("#")) return fallback;
  return parseInt(c.slice(1, 7), 16);
};
const shade = (c: number, f: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f));
  const g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
};

function isYogaHoursWib(nowMs: number): boolean {
  const wib = new Date(nowMs + 7 * 3_600_000);
  const hour = wib.getUTCHours();
  const dow = wib.getUTCDay(); // 0 Sun, 6 Sat
  const endHour = dow === 0 || dow === 6 ? 11 : 10;
  return hour >= 6 && hour < endHour;
}

function poseForAgent(a: Agent): AnimPose {
  if (a.mode === "walk" || a.mode === "leave") {
    if (a.routine === "pre_run" || a.routine === "post_run") return "run";
    return "walk";
  }
  const step = a.steps[a.stepIndex];
  const act = step?.action ?? "";
  if (["sit", "drink", "eat", "chat", "work", "read", "puzzle", "color_book", "tie_shoes"].includes(act)) return "sit";
  if (["stretch", "foam_roll", "shoot_hoop"].includes(act)) return "stretch";
  if (["yoga_pose", "yoga_inversion"].includes(act)) return "yoga";
  if (["run_start", "run_return"].includes(act)) return "run";
  return "idle";
}

function fpsForPose(p: AnimPose): number {
  if (p === "run") return 10;
  if (p === "walk") return 6.5;
  if (p === "stretch" || p === "yoga") return 2.4;
  return 2.0;
}

interface SteamPuff {
  dot: Phaser.GameObjects.Rectangle;
  baseX: number;
  baseY: number;
  age: number;
  life: number;
  drift: number;
}

class WorldScene extends Phaser.Scene {
  world!: World;
  current: SceneKey = "street";
  studioOverride: StudioModeOverride = "auto";
  statics: Phaser.GameObjects.GameObject[] = [];
  steam: SteamPuff[] = [];
  lampGlows: Phaser.GameObjects.Arc[] = [];
  agents: Agent[] = [];
  sprites = new Map<string, Phaser.GameObjects.Container>();
  animClock = new Map<string, number>();
  lastBubble = new Map<string, string>();
  respawnAt = new Map<string, number>();
  overlay!: Phaser.GameObjects.Rectangle;
  hoverLabel!: Phaser.GameObjects.Text;
  rng: Rng = seeded(Date.now() & 0xffff);
  dragging = false;
  dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  lastCounts = "";
  elapsed = 0;

  constructor(private opts: GameOptions) {
    super("world");
  }

  preload() {
    for (const [key, entry] of Object.entries(WORLD_MANIFEST.sprites)) {
      this.load.image(`spr-${key}`, entry.file);
    }
  }

  project(g: SceneGrid, x: number, y: number) {
    return toScreen(x, g.rows - 1 - y);
  }
  corner(g: SceneGrid, bx: number, by: number) {
    return toScreen(bx - 0.5, by - 0.5);
  }

  resolvedStudioMode(): "yoga" | "dine" {
    if (this.studioOverride === "auto") return isYogaHoursWib(Date.now()) ? "yoga" : "dine";
    return this.studioOverride;
  }

  create() {
    this.world = buildWorld();
    this.current = this.opts.initialScene;
    this.makeCharacterTextures();
    const hour = wibHour(Date.now());
    for (const m of this.opts.members) this.spawn(m.id, hour, true);
    this.spawn(MASCOT_ID, hour, true);

    this.hoverLabel = this.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#FFFDF7", backgroundColor: "#1B1716", padding: { x: 4, y: 2 },
    }).setDepth(1e6).setVisible(false).setResolution(2);

    this.overlay = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(2e6);
    this.drawScene();
    this.applyDayPhase();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.applyDayPhase() });
    this.scale.on("resize", () => { this.fitOverlay(); this.centre(); });

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      this.dragging = false;
      this.dragStart = { x: p.x, y: p.y, sx: this.cameras.main.scrollX, sy: this.cameras.main.scrollY };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (p.isDown) {
        if (Math.hypot(p.x - this.dragStart.x, p.y - this.dragStart.y) > 5) this.dragging = true;
        if (this.dragging) {
          cam.scrollX = this.dragStart.sx - (p.x - this.dragStart.x) / cam.zoom;
          cam.scrollY = this.dragStart.sy - (p.y - this.dragStart.y) / cam.zoom;
        }
        return;
      }
      this.hover(p.worldX, p.worldY);
    });
    this.input.on("pointerup", (_p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.dragging) return;
      const hit = over.find((o) => o.getData("memberId"));
      this.opts.onSelect(hit ? (hit.getData("memberId") as string) : null);
    });
  }

  /** Bake crisp multi-frame textures for every member's paper-doll avatar across all 6 poses. */
  makeCharacterTextures() {
    const paint = (key: string, rows: string[], pal: Record<string, string>) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          const c = pal[ch];
          if (c) {
            g.fillStyle(parseInt(c.slice(1), 16), 1);
            g.fillRect(x, y, 1, 1);
          }
        }),
      );
      g.generateTexture(key, rows[0].length, rows.length);
      g.destroy();
    };

    const poses: AnimPose[] = ["idle", "walk", "run", "sit", "stretch", "yoga"];
    for (const m of this.opts.members) {
      for (const pose of poses) {
        const count = ANIM_FRAMES[pose];
        for (let f = 0; f < count; f++) {
          const spr = renderAvatarPixels(m.avatar, pose, f);
          paint(`p-${m.id}-${pose}-${f}`, spr.rows, spr.palette);
        }
      }
    }
    // Fallback procedural mascot if PNG textures didn't load
    paint(`p-${MASCOT_ID}-fallback`, MASCOT, MASCOT_PALETTE);
  }

  spawn(memberId: string, hour: number, scatter: boolean): void {
    const m = this.opts.members.find((x) => x.id === memberId);
    const a = spawnAgent(
      `${memberId}-${Date.now()}`,
      memberId,
      { ranToday: !!m?.ranToday, yogaStars: m?.yogaStars ?? 0, isMascot: memberId === MASCOT_ID },
      hour,
      this.rng,
      this.world,
    );
    if (scatter && !a.loop) {
      for (let i = 0, n = Math.floor(this.rng() * 900); i < n && a.mode !== "gone"; i++) {
        tick(a, 0.1, this.rng, this.world);
      }
      if (a.mode === "gone") {
        this.spawn(memberId, hour, false);
        return;
      }
    }
    this.agents = this.agents.filter((x) => x.memberId !== memberId).concat(a);
    this.animClock.set(memberId, this.rng() * 4);
  }

  sprite(a: Agent): Phaser.GameObjects.Container {
    let c = this.sprites.get(a.memberId);
    if (c) return c;
    const m = this.opts.members.find((x) => x.id === a.memberId);
    const isMascot = a.memberId === MASCOT_ID;

    const initialTex = isMascot
      ? (this.textures.exists("spr-mascot_idle") ? "spr-mascot_idle" : `p-${MASCOT_ID}-fallback`)
      : `p-${a.memberId}-idle-0`;

    const img = this.add.image(0, 0, initialTex).setOrigin(0.5, 0.96);
    if (isMascot && this.textures.exists("spr-mascot_idle")) {
      img.setScale(0.95);
    }

    const shadow = this.add.ellipse(0, 0, isMascot ? 18 : 14, 5, 0x1a1412, 0.28);
    const labelText = isMascot ? "★ Higround" : (m?.name.split(" ")[0] ?? "");
    const name = this.add.text(0, isMascot ? -34 : -28, labelText, {
      fontFamily: "monospace",
      fontSize: "8px",
      fontStyle: m?.isMe || isMascot ? "bold" : "normal",
      color: isMascot ? "#FFFDF7" : "#111111",
      backgroundColor: isMascot ? "#E0352B" : m?.isMe ? "#F7D046" : "#FFFDF7dd",
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setResolution(3);

    const bubble = this.add.text(0, isMascot ? -47 : -41, "", {
      fontFamily: "monospace",
      fontSize: "9px",
      fontStyle: "bold",
      color: "#1B1716",
      backgroundColor: "#FFFDF7",
      padding: { x: 4, y: 2 },
      stroke: "#FF5F0E",
      strokeThickness: 1,
    }).setOrigin(0.5, 1).setResolution(3).setVisible(false);

    const parts: Phaser.GameObjects.GameObject[] = [shadow, img, name, bubble];
    if (m?.isMe) {
      // Tiny bouncing orange pointer triangle above user's own character
      const marker = this.add.triangle(0, -40, 0, 0, 6, 0, 3, 4, 0xff5f0e).setOrigin(0.5);
      parts.push(marker);
      this.tweens.add({ targets: marker, y: -44, duration: 520, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    if ((m?.level ?? 0) >= 20) {
      const aura = this.add.ellipse(0, -11, 24, 28, 0xf7d046, 0.22);
      parts.unshift(aura);
      this.tweens.add({ targets: aura, alpha: 0.38, scaleX: 1.08, duration: 900, yoyo: true, repeat: -1 });
    }

    c = this.add.container(0, 0, parts);
    c.setSize(22, 30).setInteractive(new Phaser.Geom.Rectangle(-11, -28, 22, 30), Phaser.Geom.Rectangle.Contains);
    c.setData("memberId", isMascot ? null : a.memberId)
      .setData("bubble", bubble)
      .setData("img", img)
      .setData("shadow", shadow);
    this.sprites.set(a.memberId, c);
    return c;
  }

  private addStatic<T extends Phaser.GameObjects.GameObject>(o: T): T {
    this.statics.push(o);
    return o;
  }

  private tileTextureFor(g: SceneGrid, x: number, y: number): string | null {
    const metresY = g.originY + (y + 0.5) * this.world.tileM;
    if (this.current === "street") {
      if (metresY < -3.8) {
        return x % 3 === 1 && y === 2 ? "spr-tile_road_dashed" : "spr-tile_asphalt";
      }
      return "spr-tile_sidewalk";
    }
    if (this.current === "floor1") {
      return (x + y) % 2 === 0 ? "spr-tile_concrete_1" : "spr-tile_concrete_2";
    }
    // floor2: studio room front (y < 9m) = warm timber; run club lounge back = cozy lounge tile
    if (metresY >= 9.0 && metresY <= 15.0) return "spr-tile_lounge";
    return (x + y) % 2 === 0 ? "spr-tile_studio_1" : "spr-tile_studio_2";
  }

  drawScene() {
    for (const o of this.statics) o.destroy();
    this.statics = [];
    this.steam = [];
    this.lampGlows = [];

    const g = this.world.scenes[this.current];
    const studioMode = this.resolvedStudioMode();
    if (this.current === "floor2") this.opts.onStudioModeResolved?.(studioMode);

    // ── 1. Textured Isometric Floor Tiles ─────────────────────────────────────
    const gfx = this.addStatic(this.add.graphics().setDepth(-1000));
    const [c1, c2] = FLOOR_FALLBACK[this.current];
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        const { sx, sy } = this.project(g, x, y);
        const texKey = this.tileTextureFor(g, x, y);
        if (texKey && this.textures.exists(texKey)) {
          this.addStatic(this.add.image(sx, sy, texKey).setOrigin(0.5, 0.5).setDepth(-1000));
        } else {
          gfx.fillStyle((x + y) % 2 ? c1 : c2, 1);
          gfx.fillPoints([
            { x: sx, y: sy - ISO_H / 2 },
            { x: sx + ISO_W / 2, y: sy },
            { x: sx, y: sy + ISO_H / 2 },
            { x: sx - ISO_W / 2, y: sy },
          ], true);
        }
      }
    }

    const rect = (o: WorldObject) => {
      const t = this.world.tileM;
      const x0 = (o.x - g.originX) / t;
      const x1 = (o.x + o.w - g.originX) / t;
      const y0 = g.rows - (o.y + o.h - g.originY) / t;
      const y1 = g.rows - (o.y - g.originY) / t;
      const A = this.corner(g, x0, y0);
      const B = this.corner(g, x1, y0);
      const C = this.corner(g, x1, y1);
      const D = this.corner(g, x0, y1);
      return { A, B, C, D, cx: (A.sx + C.sx) / 2, cy: (A.sy + C.sy) / 2 };
    };

    // Subtle zone floor tints & Higround orange track guide line (SPEC §6.2)
    const zoneGfx = this.addStatic(this.add.graphics().setDepth(-995));
    for (const o of g.objects.filter((o) => o.kind === "zone")) {
      const { A, B, C, D } = rect(o);
      zoneGfx.fillStyle(hex(o.color, 0xcccccc), o.key === "skylight_area" ? 0.25 : 0.16);
      zoneGfx.fillPoints([{ x: A.sx, y: A.sy }, { x: B.sx, y: B.sy }, { x: C.sx, y: C.sy }, { x: D.sx, y: D.sy }], true);
    }

    if (this.current === "floor1") {
      // Signature thin orange Run Club track guide line from stairs to front door
      const pStart = this.project(g, 2.5, 22);
      const pMid = this.project(g, 2.5, 4);
      const pDoor = this.project(g, 1.5, 1);
      zoneGfx.lineStyle(2, 0xff5f0e, 0.55);
      zoneGfx.lineBetween(pStart.sx, pStart.sy, pMid.sx, pMid.sy);
      zoneGfx.lineBetween(pMid.sx, pMid.sy, pDoor.sx, pDoor.sy);
    }

    // ── 2. Cutaway Back Walls & Architecture ──────────────────────────────────
    if (this.current !== "street") {
      this.drawWalls(g);
    } else {
      this.drawStreetFacade(g);
    }

    // ── 3. Objects, Landmarks, CC0 Props & Dynamic Floor 2 Studio Mode ────────
    const solids = g.objects
      .filter((o) => o.kind !== "zone" && !o.overhead)
      .map((o) => ({ o, r: rect(o) }))
      .sort((a, b) => a.r.C.sy - b.r.C.sy);

    for (const { o, r } of solids) {
      // Dynamic Floor 2 Studio Room: 6 Yoga Mats (morning) vs 3 Cafe Tables (dine-in)
      if (o.key === "yoga_mats") {
        this.drawStudioArea(g, o, studioMode);
        continue;
      }
      if (o.key === "stretch_zone" || o.key === "stretch_spot") {
        this.drawStretchArea(o, r);
        continue;
      }

      const entry = spriteEntry(o.key);
      const texKey = `spr-${o.key}`;
      if (entry && this.textures.exists(texKey)) {
        const isCutawayRightWall = o.kind === "wall_art" && o.x >= 4.5;
        const px = isCutawayRightWall ? r.cx - 6 : r.cx;
        const py = isCutawayRightWall ? r.C.sy - 10 : r.C.sy;
        const img = this.addStatic(
          this.add.image(px, py, texKey)
            .setOrigin(entry.anchorX, entry.anchorY)
            .setDepth(FLAT.has(o.key) ? -500 : r.C.sy),
        );
        // Scale gently so multi-tile footprints feel cohesive with 32x16 tiles
        const footW = Math.hypot(r.B.sx - r.D.sx, (r.B.sy - r.D.sy) * 0.4);
        if (o.key === "order_counter" || o.key === "curved_bar") {
          img.setScale(Math.max(0.95, Math.min(1.25, footW / Math.max(img.width, 1))));
        } else if (o.key === "start_gate") {
          img.setScale(1.05);
        }
        // Ambient coffee steam puffs on coffee bar & order counter!
        if (o.key === "curved_bar" || o.key === "order_counter") {
          this.spawnSteamSource(r.cx, r.C.sy - 34, r.C.sy + 10);
        }
        continue;
      }

      // Refined architectural fallback for stairs, doors, walls, booths
      this.drawFallbackBox(o, r);
    }

    // ── 4. Warm Night Lamps (visible during sore / malam / subuh WIB) ─────────
    this.setupNightLamps(g);

    this.cameras.main.removeBounds();
    this.centre();
    for (const a of this.agents) {
      this.sprites.get(a.memberId)?.setVisible(a.scene === this.current);
    }
    this.applyDayPhase();
  }

  private drawStudioArea(g: SceneGrid, o: WorldObject, mode: "yoga" | "dine") {
    const t = this.world.tileM;
    const cols = mode === "yoga" ? 2 : 1;
    const rows = 3;
    const tex = mode === "yoga" ? "spr-yoga_mat_single" : "spr-table_set";
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const mx = o.x + (o.w / (cols + 1)) * (c + 1);
        const my = o.y + (o.h / (rows + 1)) * (r + 1);
        const tx = (mx - g.originX) / t;
        const ty = (my - g.originY) / t;
        const { sx, sy } = this.project(g, tx, ty);
        if (this.textures.exists(tex)) {
          this.addStatic(
            this.add.image(sx, sy, tex)
              .setOrigin(0.5, mode === "yoga" ? 0.5 : 0.82)
              .setDepth(mode === "yoga" ? -480 : sy),
          );
        }
      }
    }
  }

  private drawStretchArea(
    o: WorldObject,
    r: { A: { sx: number; sy: number }; B: { sx: number; sy: number }; C: { sx: number; sy: number }; D: { sx: number; sy: number }; cx: number; cy: number },
  ) {
    if (this.textures.exists("spr-stretch_mat")) {
      const count = o.key === "stretch_zone" ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const off = count === 2 ? (i === 0 ? -16 : 16) : 0;
        this.addStatic(this.add.image(r.cx + off, r.cy + off * 0.35, "spr-stretch_mat").setOrigin(0.5, 0.5).setDepth(-490));
      }
      return;
    }
    this.drawFallbackBox(o, r);
  }

  private drawFallbackBox(
    o: WorldObject,
    r: { A: { sx: number; sy: number }; B: { sx: number; sy: number }; C: { sx: number; sy: number }; D: { sx: number; sy: number } },
  ) {
    const box = this.addStatic(this.add.graphics());
    const flat = FLAT.has(o.key);
    const isStairs = o.key.includes("stairs");
    const isDoor = o.key.includes("door");
    const h = flat ? 2 : isStairs || isDoor ? 8 : KIND_H[o.kind] ?? 12;
    const top = hex(o.color, o.kind === "struct" ? 0xd8d2c4 : 0x8a6a4a);
    const { A, B, C, D } = r;

    box.fillStyle(shade(top, 0.72), 1);
    box.fillPoints([{ x: D.sx, y: D.sy - h }, { x: C.sx, y: C.sy - h }, { x: C.sx, y: C.sy }, { x: D.sx, y: D.sy }], true);
    box.fillStyle(shade(top, 0.86), 1);
    box.fillPoints([{ x: C.sx, y: C.sy - h }, { x: B.sx, y: B.sy - h }, { x: B.sx, y: B.sy }, { x: C.sx, y: C.sy }], true);
    box.fillStyle(top, 1);
    box.fillPoints([{ x: A.sx, y: A.sy - h }, { x: B.sx, y: B.sy - h }, { x: C.sx, y: C.sy - h }, { x: D.sx, y: D.sy - h }], true);
    box.lineStyle(1, 0x221a18, 0.55);
    box.strokePoints([{ x: A.sx, y: A.sy - h }, { x: B.sx, y: B.sy - h }, { x: C.sx, y: C.sy - h }, { x: D.sx, y: D.sy - h }], true);

    // Pixel step lines on stairs
    if (isStairs) {
      box.lineStyle(1, 0x3b3632, 0.6);
      for (let i = 1; i <= 5; i++) {
        const f = i / 6;
        const lx = A.sx + (D.sx - A.sx) * f;
        const ly = A.sy - h + (D.sy - A.sy) * f;
        const rx = B.sx + (C.sx - B.sx) * f;
        const ry = B.sy - h + (C.sy - B.sy) * f;
        box.lineBetween(lx, ly, rx, ry);
      }
    }
    box.setDepth(flat || isStairs || isDoor ? -495 : C.sy);
  }

  drawWalls(g: SceneGrid) {
    const w = this.addStatic(this.add.graphics());
    const H = 52;
    const A = this.corner(g, 0, 0);
    const B = this.corner(g, g.cols, 0);
    const D = this.corner(g, 0, g.rows);

    // Back-right wall (cream plaster)
    w.fillStyle(0xf5ecd6, 1);
    w.fillPoints([{ x: A.sx, y: A.sy - H }, { x: B.sx, y: B.sy - H }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    // Back-left wall (warmer shaded cream)
    w.fillStyle(0xe8dec3, 1);
    w.fillPoints([{ x: D.sx, y: D.sy - H }, { x: A.sx, y: A.sy - H }, { x: A.sx, y: A.sy }, { x: D.sx, y: D.sy }], true);

    // Warm wood baseboard trim along both cutaway walls
    const baseH = 7;
    w.fillStyle(0xb07a4a, 0.85);
    w.fillPoints([{ x: A.sx, y: A.sy - baseH }, { x: B.sx, y: B.sy - baseH }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    w.fillStyle(0x96643a, 0.85);
    w.fillPoints([{ x: D.sx, y: D.sy - baseH }, { x: A.sx, y: A.sy - baseH }, { x: A.sx, y: A.sy }, { x: D.sx, y: D.sy }], true);

    // Signature Higround orange wall cap + crisp dark outline
    w.lineStyle(3, 0xff5f0e, 1);
    w.lineBetween(D.sx, D.sy - H, A.sx, A.sy - H);
    w.lineBetween(A.sx, A.sy - H, B.sx, B.sy - H);
    w.lineStyle(1, 0x221a18, 0.7);
    w.lineBetween(D.sx, D.sy - H - 1, A.sx, A.sy - H - 1);
    w.lineBetween(A.sx, A.sy - H - 1, B.sx, B.sy - H - 1);

    // On Floor 1: vertical wood slat accent panel behind Order Counter
    if (this.current === "floor1") {
      const s0 = this.corner(g, 0, g.rows - 16);
      const s1 = this.corner(g, 0, g.rows - 8);
      w.fillStyle(0xb07a4a, 0.9);
      w.fillPoints([
        { x: s1.sx, y: s1.sy - H + 6 }, { x: s0.sx, y: s0.sy - H + 6 },
        { x: s0.sx, y: s0.sy - baseH }, { x: s1.sx, y: s1.sy - baseH },
      ], true);
      w.lineStyle(1, 0x734926, 0.7);
      for (let i = 1; i < 8; i++) {
        const f = i / 8;
        const sx = s1.sx + (s0.sx - s1.sx) * f;
        const sy = s1.sy + (s0.sy - s1.sy) * f;
        w.lineBetween(sx, sy - H + 6, sx, sy - baseH);
      }
    }

    w.setDepth(-999);
  }

  /** Cozy Higround storefront backdrop at the back edge of the street scene! */
  drawStreetFacade(g: SceneGrid) {
    const w = this.addStatic(this.add.graphics());
    const H = 56;
    const A = this.corner(g, 0, 0);
    const B = this.corner(g, g.cols, 0);
    // White-cream ruko storefront facade
    w.fillStyle(0xf5efe0, 1);
    w.fillPoints([{ x: A.sx, y: A.sy - H }, { x: B.sx, y: B.sy - H }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    // Glass door (left side)
    const d0 = this.corner(g, 0.4, 0);
    const d1 = this.corner(g, 2.8, 0);
    w.fillStyle(0x7fb8e0, 0.85);
    w.fillPoints([{ x: d0.sx, y: d0.sy - 36 }, { x: d1.sx, y: d1.sy - 36 }, { x: d1.sx, y: d1.sy }, { x: d0.sx, y: d0.sy }], true);
    w.lineStyle(2, 0x221a18, 0.9);
    w.strokePoints([{ x: d0.sx, y: d0.sy - 36 }, { x: d1.sx, y: d1.sy - 36 }, { x: d1.sx, y: d1.sy }, { x: d0.sx, y: d0.sy }], true);
    // Iconic arched COFFEE & BURGER window (right side)
    const w0 = this.corner(g, 3.8, 0);
    const w1 = this.corner(g, 9.0, 0);
    w.fillStyle(0x3a4d63, 0.9);
    w.fillPoints([{ x: w0.sx, y: w0.sy - 32 }, { x: w1.sx, y: w1.sy - 32 }, { x: w1.sx, y: w1.sy - 4 }, { x: w0.sx, y: w0.sy - 4 }], true);
    w.lineStyle(2, 0xb07a4a, 1);
    w.strokePoints([{ x: w0.sx, y: w0.sy - 32 }, { x: w1.sx, y: w1.sy - 32 }, { x: w1.sx, y: w1.sy - 4 }, { x: w0.sx, y: w0.sy - 4 }], true);
    // Higround orange fascia beam
    w.lineStyle(4, 0xff5f0e, 1);
    w.lineBetween(A.sx, A.sy - H, B.sx, B.sy - H);
    w.setDepth(-998);

    // Crisp pixel storefront sign "HIGROUND · COFFEE & RUN CLUB"
    const mid = this.corner(g, 5.2, 0);
    this.addStatic(
      this.add.text(mid.sx, mid.sy - H - 2, "HIGROUND · COFFEE & RUN CLUB", {
        fontFamily: "monospace", fontSize: "9px", fontStyle: "bold", color: "#FFFDF7", backgroundColor: "#FF5F0E", padding: { x: 4, y: 2 },
      }).setOrigin(0.5, 1).setResolution(3).setDepth(-990),
    );
  }

  private spawnSteamSource(x: number, y: number, depth: number) {
    for (let i = 0; i < 3; i++) {
      const dot = this.addStatic(this.add.rectangle(x, y, 2, 2, 0xfffdf7, 0.6).setDepth(depth));
      this.steam.push({
        dot,
        baseX: x + (i - 1) * 4,
        baseY: y,
        age: i * 0.65,
        life: 2.0,
        drift: (i - 1) * 3,
      });
    }
  }

  private setupNightLamps(g: SceneGrid) {
    const spots: [number, number][] =
      this.current === "street"
        ? [[2, 9], [7, 9]]
        : this.current === "floor1"
          ? [[3, 12], [6, 20], [6, 32]]
          : [[5, 8], [5, 22]];
    for (const [tx, ty] of spots) {
      if (tx >= g.cols || ty >= g.rows) continue;
      const { sx, sy } = this.project(g, tx, ty);
      const glow = this.addStatic(this.add.circle(sx, sy - 6, 48, 0xffc864, 0).setDepth(1.5e6));
      this.lampGlows.push(glow);
    }
  }

  centre() {
    const g = this.world.scenes[this.current];
    const mid = this.project(g, g.cols / 2, g.rows / 2);
    this.cameras.main.centerOn(mid.sx, mid.sy - 14);
  }

  fitOverlay() {
    this.overlay.setSize(this.scale.width, this.scale.height);
  }

  applyDayPhase() {
    const p = dayPhase(wibHour(Date.now()));
    this.overlay.setFillStyle(p.tint, p.alpha);
    for (const glow of this.lampGlows) {
      glow.setFillStyle(0xffc864, p.lamps ? 0.14 : 0);
    }
    this.fitOverlay();
  }

  hover(wx: number, wy: number) {
    const g = this.world.scenes[this.current];
    const grid = toGrid(wx, wy);
    const x = grid.x + 0.5;
    const yFlip = grid.y + 0.5;
    const metresX = g.originX + x * this.world.tileM;
    const metresY = g.originY + (g.rows - yFlip) * this.world.tileM;
    const o = g.objects.find(
      (ob) => ob.kind === "poi" && metresX >= ob.x && metresX <= ob.x + ob.w && metresY >= ob.y && metresY <= ob.y + ob.h,
    );
    if (!o) {
      this.hoverLabel.setVisible(false);
      return;
    }
    this.hoverLabel.setText(o.label).setPosition(wx + 8, wy - 18).setVisible(true);
  }

  focusMe(): SceneKey | null {
    const me = this.opts.members.find((m) => m.isMe);
    if (!me) return null;
    const agent = this.agents.find((a) => a.memberId === me.id);
    if (!agent || agent.mode === "gone") return null;
    if (agent.scene !== this.current) {
      this.setCurrent(agent.scene);
    }
    const g = this.world.scenes[agent.scene];
    const { sx, sy } = this.project(g, agent.x, agent.y);
    this.cameras.main.pan(sx, sy - 10, 350, "Sine.easeInOut");
    return agent.scene;
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    this.elapsed += dt;
    const now = Date.now();
    const hour = wibHour(now);
    const counts: Record<SceneKey, number> = { street: 0, floor1: 0, floor2: 0 };

    // Update ambient coffee steam puffs
    for (const s of this.steam) {
      s.age = (s.age + dt) % s.life;
      const p = s.age / s.life;
      s.dot.setPosition(s.baseX + Math.sin(p * Math.PI * 2) * 2 + s.drift * p, s.baseY - p * 16);
      s.dot.setAlpha((1 - p) * 0.65);
    }

    for (const a of this.agents) {
      tick(a, dt, this.rng, this.world);
      const c = this.sprite(a);
      if (a.mode === "gone") {
        c.setVisible(false);
        if (!this.respawnAt.has(a.memberId)) {
          this.respawnAt.set(a.memberId, now + 4000 + this.rng() * 8000);
        }
        continue;
      }

      counts[a.scene]++;
      const g = this.world.scenes[a.scene];
      const { sx, sy } = this.project(g, a.x, a.y);
      c.setPosition(sx, sy + 3).setDepth(sy + 4).setVisible(a.scene === this.current);

      const img = c.getData("img") as Phaser.GameObjects.Image;
      const shadow = c.getData("shadow") as Phaser.GameObjects.Ellipse;
      const isMascot = a.memberId === MASCOT_ID;
      const pose = poseForAgent(a);
      const clock = (this.animClock.get(a.memberId) ?? 0) + dt * fpsForPose(pose);
      this.animClock.set(a.memberId, clock);

      if (isMascot) {
        const mKey =
          pose === "run" || pose === "walk" ? "spr-mascot_run" :
          pose === "stretch" || pose === "yoga" ? "spr-mascot_stretch" :
          a.bubble ? "spr-mascot_cheer" : "spr-mascot_idle";
        if (this.textures.exists(mKey) && img.texture.key !== mKey) img.setTexture(mKey);
        const hop = pose === "walk" || pose === "run" ? Math.abs(Math.sin(clock * 1.1)) * 3.5 : Math.sin(clock * 0.8) * 1;
        img.setY(-hop);
        shadow.setScale(1 - hop * 0.04, 1);
      } else {
        const frame = Math.floor(clock) % ANIM_FRAMES[pose];
        const texKey = `p-${a.memberId}-${pose}-${frame}`;
        if (this.textures.exists(texKey) && img.texture.key !== texKey) img.setTexture(texKey);
        const bounce = pose === "run" ? Math.abs(Math.sin(clock * 1.4)) * 2 : 0;
        img.setY(-bounce);
      }
      img.setFlipX(a.facing < 0);

      // Kairosoft spring pop-in speech bubble
      const bubble = c.getData("bubble") as Phaser.GameObjects.Text;
      const prev = this.lastBubble.get(a.memberId) ?? "";
      const next = a.bubble?.text ?? "";
      if (next) {
        if (next !== prev) {
          bubble.setText(next).setVisible(true).setScale(0.35);
          this.tweens.add({ targets: bubble, scale: 1, duration: 220, ease: "Back.easeOut" });
        }
      } else {
        bubble.setVisible(false);
      }
      this.lastBubble.set(a.memberId, next);
    }

    for (const [id, at] of this.respawnAt) {
      if (now >= at) {
        this.respawnAt.delete(id);
        this.spawn(id, hour, false);
      }
    }

    const key = JSON.stringify(counts);
    if (key !== this.lastCounts) {
      this.lastCounts = key;
      this.opts.onSceneCount?.(counts);
    }
  }

  setCurrent(k: SceneKey) {
    this.current = k;
    this.drawScene();
  }

  setStudioOverride(mode: StudioModeOverride) {
    this.studioOverride = mode;
    if (this.current === "floor2") this.drawScene();
  }
}

export function createWorldGame(parent: HTMLElement, opts: GameOptions): WorldGame {
  const scene = new WorldScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#26232c",
    pixelArt: true,
    roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene,
    banner: false,
  });

  (window as unknown as { __hgWhere?: (id: string) => { x: number; y: number } | null }).__hgWhere = (id) => {
    const c = scene.sprites.get(id);
    if (!c || !c.visible) return null;
    const cam = scene.cameras.main;
    return { x: (c.x - cam.worldView.x) * cam.zoom, y: (c.y - 10 - cam.worldView.y) * cam.zoom };
  };

  return {
    setScene: (k) => scene.sys?.isActive() && scene.setCurrent(k),
    setZoom: (z) => { scene.cameras?.main?.setZoom(z); },
    setStudioMode: (m) => scene.sys?.isActive() && scene.setStudioOverride(m),
    focusMe: () => (scene.sys?.isActive() ? scene.focusMe() : null),
    destroy: () => game.destroy(true),
  };
}
