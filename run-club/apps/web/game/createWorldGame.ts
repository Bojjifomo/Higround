/**
 * Phaser 3 Isometric Diorama Renderer for Higround Run Club (v2).
 * Inspired by Kairosoft, WorkAdventure/Gather.town, Pikmin Bloom, Zombies Run!, NIKELAND & Pokémon GO.
 *
 * Features:
 * - Warm time-of-day diorama backdrop + 3D cutaway slab base + green neighborhood border (no empty void)
 * - 66 photo-accurate shaded CC0 + Higround sprites (zero grey placeholder boxes)
 * - 28x36 multi-frame chibi animations (idle blink, walk, run, coffee-sip sit, stretch, yoga)
 * - Clickable interactive POIs (Start Gate, ORDER HERE!, Gelato Kiosk, Yoga Board, Leaderboard, Sandwich Board)
 * - Pikmin-style glowing runner footstep trails for members who ran today
 * - Zombies Run! visual ruko upgrades unlocked by community mileage (string lights, mascot balloon, gold trophy)
 * - WorkAdventure/Gather live cheer reaction + jump-to-member camera pan
 */
import * as Phaser from "phaser";
import { dayPhase, seeded, spawnAgent, tick, wibHour, type Agent, type Rng } from "@/lib/world/agents";
import { spriteEntry, WORLD_MANIFEST } from "@/lib/world/assetManifest";
import { buildWorld, inBounds, type SceneGrid, type SceneKey, type World, type WorldObject } from "@/lib/world/layout";
import { ISO_H, ISO_W, toGrid, toScreen } from "@/lib/world/path";
import {
  ANIM_FRAMES, MASCOT, MASCOT_PALETTE, renderAvatarPixels, SPRITE_W, type AnimPose, type AvatarColors,
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
  weeklyRank?: 1 | 2 | 3 | null;
}

export interface WorldUpgrades {
  stringLights: boolean;
  mascotBalloon: boolean;
  goldTrophy: boolean;
}

export interface LiveMovePayload {
  userId: string;
  scene: SceneKey;
  x: number;
  y: number;
  facing: 1 | -1;
  moving: boolean;
}

export interface WorldGame {
  setScene(key: SceneKey): void;
  setZoom(z: number): void;
  setStudioMode(mode: StudioModeOverride): void;
  setMoveInput(dx: number, dy: number): void;
  applyRemoteMove(payload: LiveMovePayload): void;
  syncMembers(members: GameMember[]): void;
  focusMe(): SceneKey | null;
  focusMember(memberId: string): SceneKey | null;
  cheerMember(memberId: string): void;
  sayMessage(memberId: string, text: string): void;
  destroy(): void;
}

export interface GameOptions {
  members: GameMember[];
  initialScene: SceneKey;
  initialZoom?: number;
  upgrades: WorldUpgrades;
  hasActiveEvent: boolean;
  onSelect(memberId: string | null): void;
  onSelectPoi?(poiKey: string): void;
  onSceneCount?(counts: Record<SceneKey, number>): void;
  onStudioModeResolved?(mode: "yoga" | "dine"): void;
  onControlMode?(mode: "manual" | "auto"): void;
  onLocalMove?(payload: LiveMovePayload): void;
}

const MASCOT_ID = "__mascot__";
const FLAT = new Set(["yoga_mats", "stretch_zone", "stretch_spot", "event_corner"]);
const WALL_MOUNTED = new Set([
  "guest_check", "mascot_banner", "run_posters", "mirror_wall", "poster_wall_f2",
  "yoga_quest_board", "leaderboard_board", "medal_wall",
]);
const INTERACTIVE_POIS = new Set([
  "start_gate", "order_counter", "gelato_kiosk", "sandwich_board", "yoga_quest_board", "leaderboard_board", "medal_wall", "kids_corner",
]);

const DIORAMA_BG: Record<string, number> = {
  pagi: 0xd6e8d5,
  siang: 0xcfe4ce,
  sore: 0xebd1b0,
  subuh: 0x3b385a,
  malam: 0x262b46,
};

const MANUAL_AUTO_FALLBACK_MS = 4000;

function isYogaHoursWib(nowMs: number): boolean {
  const wib = new Date(nowMs + 7 * 3_600_000);
  const hour = wib.getUTCHours();
  const dow = wib.getUTCDay();
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
  if (p === "sit") return 1.5;
  return 1.8;
}

interface SteamPuff {
  dot: Phaser.GameObjects.Rectangle;
  baseX: number;
  baseY: number;
  age: number;
  life: number;
  drift: number;
}

interface TrailDot {
  dot: Phaser.GameObjects.Arc;
  age: number;
  life: number;
}

class WorldScene extends Phaser.Scene {
  world!: World;
  current: SceneKey = "street";
  studioOverride: StudioModeOverride = "auto";
  statics: Phaser.GameObjects.GameObject[] = [];
  steam: SteamPuff[] = [];
  trails: TrailDot[] = [];
  trailCooldown = new Map<string, number>();
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
  hasPanned = false;
  activePointerId: number | null = null;
  dragDown = { x: 0, y: 0 };
  dragPrev = { x: 0, y: 0 };
  lastCounts = "";
  manualInput = { dx: 0, dy: 0 };
  manualUntil = 0;
  controlMode: "auto" | "manual" = "auto";
  remoteTargets = new Map<string, { scene: SceneKey; x: number; y: number; facing: 1 | -1; moving: boolean; until: number }>();

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

  private clampCamera() {
    const g = this.world.scenes[this.current];
    const top = this.corner(g, 0, 0);
    const right = this.corner(g, g.cols, 0);
    const bottom = this.corner(g, g.cols, g.rows);
    const left = this.corner(g, 0, g.rows);
    const cam = this.cameras.main;
    const minX = Math.min(top.sx, right.sx, bottom.sx, left.sx) - 180;
    const maxX = Math.max(top.sx, right.sx, bottom.sx, left.sx) + 180;
    const minY = Math.min(top.sy, right.sy, bottom.sy, left.sy) - 180;
    const maxY = Math.max(top.sy, right.sy, bottom.sy, left.sy) + 180;
    const halfW = cam.width / (2 * cam.zoom);
    const halfH = cam.height / (2 * cam.zoom);
    const cx = cam.scrollX + cam.width / 2;
    const cy = cam.scrollY + cam.height / 2;
    const clampedCx = Phaser.Math.Clamp(cx, minX - halfW * 0.25, maxX + halfW * 0.25);
    const clampedCy = Phaser.Math.Clamp(cy, minY - halfH * 0.25, maxY + halfH * 0.25);
    cam.scrollX = clampedCx - cam.width / 2;
    cam.scrollY = clampedCy - cam.height / 2;
  }

  create() {
    this.world = buildWorld();
    this.current = this.opts.initialScene;
    const canvas = this.game.canvas;
    if (canvas) {
      canvas.style.touchAction = "none";
      canvas.style.userSelect = "none";
      (canvas.style as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect = "none";
    }
    this.cameras.main.setZoom(this.opts.initialZoom ?? 2);
    this.makeCharacterTextures();
    const hour = wibHour(Date.now());
    for (const m of this.opts.members) this.spawn(m.id, hour, true);
    this.spawn(MASCOT_ID, hour, true);

    this.hoverLabel = this.add.text(0, 0, "", {
      fontFamily: "monospace",
      fontSize: "10px",
      fontStyle: "bold",
      color: "#FFF8EA",
      backgroundColor: "#241917",
      padding: { x: 5, y: 3 },
    }).setDepth(1e6).setVisible(false).setResolution(2);

    this.overlay = this.add.rectangle(0, 0, 10, 10, 0xffffff, 0).setOrigin(0).setScrollFactor(0).setDepth(2e6);
    this.drawScene();
    this.centerOnMeImmediate();
    this.applyDayPhase();
    this.time.addEvent({ delay: 60_000, loop: true, callback: () => this.applyDayPhase() });
    this.scale.on("resize", () => {
      this.fitOverlay();
      if (!this.hasPanned) this.centerOnMeImmediate(false);
    });

    const resetDrag = () => {
      this.activePointerId = null;
      this.dragging = false;
    };

    this.input.on("pointerdown", (p: Phaser.Input.Pointer) => {
      if (this.activePointerId !== null && this.activePointerId !== p.id) return;
      this.cameras.main.panEffect.reset();
      this.activePointerId = p.id;
      this.dragging = false;
      this.dragDown = { x: p.x, y: p.y };
      this.dragPrev = { x: p.x, y: p.y };
    });
    this.input.on("pointermove", (p: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (this.activePointerId === p.id) {
        if (!p.isDown && !p.wasTouch) {
          resetDrag();
          return;
        }
        if (!this.dragging && Math.hypot(p.x - this.dragDown.x, p.y - this.dragDown.y) > 6) {
          this.dragging = true;
          this.hasPanned = true;
          this.hoverLabel.setVisible(false);
        }
        if (this.dragging) {
          cam.scrollX -= (p.x - this.dragPrev.x) / cam.zoom;
          cam.scrollY -= (p.y - this.dragPrev.y) / cam.zoom;
          this.clampCamera();
        }
        this.dragPrev = { x: p.x, y: p.y };
        return;
      }
      if (!p.wasTouch && !p.isDown) {
        this.hover(p.worldX, p.worldY);
      }
    });
    this.input.on("pointerup", (p: Phaser.Input.Pointer, over: Phaser.GameObjects.GameObject[]) => {
      if (this.activePointerId !== null && this.activePointerId !== p.id) return;
      const wasDragging = this.dragging;
      resetDrag();
      if (wasDragging) return;
      const memberHit = over.find((o) => o.getData("memberId"));
      if (memberHit) {
        this.opts.onSelect(memberHit.getData("memberId") as string);
        return;
      }
      const poiHit = over.find((o) => o.getData("poiKey"));
      if (poiHit) {
        this.opts.onSelect(null);
        this.opts.onSelectPoi?.(poiHit.getData("poiKey") as string);
        return;
      }
      this.opts.onSelect(null);
    });
    this.input.on("pointerupoutside", resetDrag);
    this.input.on("gameout", resetDrag);
    canvas?.addEventListener("touchcancel", resetDrag);
  }

  private paintTexture(key: string, rows: string[], pal: Record<string, string>) {
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
  }

  private ensureMemberTextures(m: GameMember) {
    const poses: AnimPose[] = ["idle", "walk", "run", "sit", "stretch", "yoga"];
    for (const pose of poses) {
      for (let f = 0; f < ANIM_FRAMES[pose]; f++) {
        const spr = renderAvatarPixels(m.avatar, pose, f);
        this.paintTexture(`p-${m.id}-${pose}-${f}`, spr.rows, spr.palette);
      }
    }
  }

  makeCharacterTextures() {
    for (const m of this.opts.members) this.ensureMemberTextures(m);
    this.paintTexture(`p-${MASCOT_ID}-fallback`, MASCOT, MASCOT_PALETTE);
  }

  spawn(memberId: string, hour: number, scatter: boolean): void {
    const m = this.opts.members.find((x) => x.id === memberId);
    const a = spawnAgent(
      `${memberId}-${Date.now()}`,
      memberId,
      {
        ranToday: !!m?.ranToday,
        yogaStars: m?.yogaStars ?? 0,
        isMascot: memberId === MASCOT_ID,
        isMe: Boolean(m?.isMe),
        preferredScene: m?.isMe ? this.current : undefined,
      },
      hour,
      this.rng,
      this.world,
    );
    if (scatter && !a.loop && !m?.isMe) {
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
    } else if (!isMascot) {
      img.setScale(24 / SPRITE_W); // crisp ~24px wide on 32x16 tiles at any sprite resolution
    }

    const shadow = this.add.ellipse(0, 0, isMascot ? 18 : 15, 6, 0x1a1412, 0.28);
    const labelText = isMascot ? "★ Higround" : `${m?.name.split(" ")[0] ?? ""}${m?.ranToday ? " 🔥" : ""}`;
    const name = this.add.text(0, isMascot ? -36 : -33, labelText, {
      fontFamily: "monospace",
      fontSize: "8px",
      fontStyle: m?.isMe || isMascot ? "bold" : "normal",
      color: isMascot ? "#FFF8EA" : "#241917",
      backgroundColor: isMascot ? "#E0352B" : m?.isMe ? "#F7D046" : "#FFF8EAee",
      padding: { x: 3, y: 1 },
    }).setOrigin(0.5, 1).setResolution(3);

    const bubble = this.add.text(0, isMascot ? -49 : -46, "", {
      fontFamily: "monospace",
      fontSize: "9px",
      fontStyle: "bold",
      color: "#241917",
      backgroundColor: "#FFF8EA",
      padding: { x: 4, y: 2 },
      stroke: "#FF5F0E",
      strokeThickness: 1,
    }).setOrigin(0.5, 1).setResolution(3).setVisible(false);

    const parts: Phaser.GameObjects.GameObject[] = [shadow, img, name, bubble];
    if (m?.isMe) {
      const marker = this.add.triangle(0, -45, 0, 0, 6, 0, 3, 4, 0xff5f0e).setOrigin(0.5);
      parts.push(marker);
      this.tweens.add({ targets: marker, y: -49, duration: 500, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
    if (!isMascot && m?.weeklyRank) {
      const rank = m.weeklyRank;
      const medalY = m.isMe ? -56 : -47;
      const glowColor = rank === 1 ? 0xffd54f : rank === 2 ? 0xd9e2ec : 0xcd7f32;
      const badgeBg = rank === 1 ? "#F7D046" : rank === 2 ? "#E5E7EB" : "#E6A57E";
      const badgeLabel = rank === 1 ? "🥇#1" : rank === 2 ? "🥈#2" : "🥉#3";
      const medalGlow = this.add.circle(0, medalY - 4, 7, glowColor, 0.45);
      const medalText = this.add.text(0, medalY, badgeLabel, {
        fontFamily: "monospace",
        fontSize: "8px",
        fontStyle: "bold",
        color: "#241917",
        backgroundColor: badgeBg,
        padding: { x: 2, y: 1 },
      }).setOrigin(0.5, 1).setResolution(3);
      parts.push(medalGlow, medalText);
      this.tweens.add({
        targets: [medalGlow, medalText],
        y: "-=3",
        duration: 700 + rank * 80,
        yoyo: true,
        repeat: -1,
        ease: "Sine.easeInOut",
      });
    }
    if ((m?.level ?? 0) >= 20) {
      const aura = this.add.ellipse(0, -13, 24, 30, 0xf7d046, 0.22);
      parts.unshift(aura);
      this.tweens.add({ targets: aura, alpha: 0.38, scaleX: 1.08, duration: 900, yoyo: true, repeat: -1 });
    }

    c = this.add.container(0, 0, parts);
    c.setSize(24, 34).setInteractive(
      new Phaser.Geom.Rectangle(-12, -32, 24, 34),
      Phaser.Geom.Rectangle.Contains,
    );
    if (c.input) c.input.cursor = isMascot ? "default" : "pointer";
    c.setData("memberId", isMascot ? null : a.memberId)
      .setData("bubble", bubble)
      .setData("img", img)
      .setData("shadow", shadow)
      .setData("weeklyRank", m?.weeklyRank ?? null);
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
      if (metresY < -3.8) return x % 3 === 1 && y === 2 ? "spr-tile_road_dashed" : "spr-tile_asphalt";
      return "spr-tile_sidewalk";
    }
    if (this.current === "floor1") {
      // Photo 07: Bright sunlit skylight courtyard at the back right (y >= 15m, x >= 2.2m)
      if (metresY >= 15.0 && x >= 4) return "spr-tile_skylight";
      return (x + y) % 2 === 0 ? "spr-tile_concrete_1" : "spr-tile_concrete_2";
    }
    // Photo 11: Sleek darker polished concrete in Studio Room; warm timber in Run Club Lounge
    if (metresY >= 9.0 && metresY <= 15.0 && x >= 2) return "spr-tile_lounge";
    return (x + y) % 2 === 0 ? "spr-tile_studio_1" : "spr-tile_studio_2";
  }

  drawScene() {
    for (const o of this.statics) o.destroy();
    for (const t of this.trails) t.dot.destroy();
    this.statics = [];
    this.steam = [];
    this.trails = [];
    this.lampGlows = [];

    const g = this.world.scenes[this.current];
    const studioMode = this.resolvedStudioMode();
    if (this.current === "floor2") this.opts.onStudioModeResolved?.(studioMode);

    // ── 0. Cozy Diorama Surroundings + 3D Architectural Base Slab ─────────────
    this.drawDioramaPlatform(g);

    // ── 1. Photo-Accurate Textured Isometric Floor Tiles ──────────────────────
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        const { sx, sy } = this.project(g, x, y);
        const texKey = this.tileTextureFor(g, x, y);
        if (texKey && this.textures.exists(texKey)) {
          this.addStatic(this.add.image(sx, sy, texKey).setOrigin(0.5, 0.5).setDepth(-1000));
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

    // Subtle Run Club orange track guide line on Floor 1 (stairs -> front door)
    if (this.current === "floor1") {
      const guide = this.addStatic(this.add.graphics().setDepth(-994));
      const pStart = this.project(g, 2.5, 22);
      const pMid = this.project(g, 2.5, 4);
      const pDoor = this.project(g, 1.5, 1);
      guide.lineStyle(2, 0xff5f0e, 0.65);
      guide.lineBetween(pStart.sx, pStart.sy, pMid.sx, pMid.sy);
      guide.lineBetween(pMid.sx, pMid.sy, pDoor.sx, pDoor.sy);
    }

    // ── 2. Cutaway Walls & Storefront Architecture (Photos 01, 02, 03, 11) ────
    if (this.current !== "street") {
      this.drawWalls(g);
    } else {
      this.drawStreetFacade(g);
    }

    // ── 3. Shaded Objects, Landmarks & Clickable Interactive POIs ─────────────
    const solids = g.objects
      .filter((o) => o.kind !== "zone" && !o.overhead)
      .map((o) => ({ o, r: rect(o) }))
      .sort((a, b) => a.r.C.sy - b.r.C.sy);

    for (const { o, r } of solids) {
      if (o.key === "round_mirror") continue; // already integrated into plant_bench!
      if (o.key === "f1_door" || o.key === "arch_window" || o.key === "wood_pillar" || o.key === "wood_slat_wall" || o.key === "front_window_f2") {
        continue; // rendered cleanly as part of architectural cutaway walls!
      }
      if (o.key === "yoga_mats") {
        this.drawStudioArea(g, o, studioMode);
        continue;
      }
      if (o.key === "stretch_zone" || o.key === "stretch_spot") {
        this.drawStretchArea(o, r);
        continue;
      }
      if (o.key === "stairs" || o.key === "stairs_top") {
        this.drawStairs(r);
        continue;
      }

      const entry = spriteEntry(o.key);
      const texKey = `spr-${o.key}`;
      if (entry && this.textures.exists(texKey)) {
        const isWallMounted = WALL_MOUNTED.has(o.key);
        const px = isWallMounted && o.x < 0.5 ? r.A.sx + 4 : r.cx;
        const py = isWallMounted
          ? (o.key === "mascot_banner" ? r.cy - 22 : o.y >= 17.0 ? r.cy - 14 : r.cy - 12)
          : (o.key === "order_counter" || o.key === "curved_bar" ? r.cy + 10 : r.cy + 6);
        const objDepth = FLAT.has(o.key)
          ? -500
          : isWallMounted
            ? -860
            : (o.key === "order_counter" || o.key === "curved_bar" ? r.cy + 3 : r.cy);

        // Grounded espresso contact shadow beneath freestanding furniture (higround-pixel-art-bible)
        if (!FLAT.has(o.key) && !isWallMounted && o.key !== "start_gate") {
          const footSpan = Math.max(18, Math.min(54, Math.hypot(r.B.sx - r.D.sx, (r.B.sy - r.D.sy) * 0.5) * 0.72));
          this.addStatic(
            this.add.ellipse(r.cx, r.cy + 2, footSpan, Math.max(7, footSpan * 0.34), 0x1a1412, 0.2)
              .setDepth(-498),
          );
        }

        const img = this.addStatic(
          this.add.image(px, py, texKey)
            .setOrigin(entry.anchorX, entry.anchorY)
            .setDepth(objDepth),
        );
        const footW = Math.hypot(r.B.sx - r.D.sx, (r.B.sy - r.D.sy) * 0.4);
        if (o.key === "order_counter" || o.key === "curved_bar") {
          img.setScale(Math.max(0.9, Math.min(1.15, footW / Math.max(img.width, 1))));
        } else if (o.key === "start_gate") {
          img.setScale(1.04);
        } else if (isWallMounted) {
          img.setScale(0.85);
        }

        // Make key landmarks clickable POIs (Pokémon GO PokéStop style!)
        if (INTERACTIVE_POIS.has(o.key)) {
          img.setInteractive({ useHandCursor: true }).setData("poiKey", o.key);
          img.on("pointerover", () => img.setTint(0xfff2d6));
          img.on("pointerout", () => img.clearTint());
          if (o.key === "order_counter") {
            const menuTag = this.addStatic(
              this.add.text(px, py - img.displayHeight * 0.92, "🍔 Menu", {
                fontFamily: "monospace",
                fontSize: "8px",
                fontStyle: "bold",
                color: "#FFFFFF",
                backgroundColor: "#FF5F0E",
                padding: { x: 4, y: 2 },
              })
                .setOrigin(0.5, 1)
                .setResolution(3)
                .setDepth(2400)
                .setInteractive({ useHandCursor: true })
                .setData("poiKey", "order_counter"),
            );
            this.tweens.add({ targets: menuTag, y: menuTag.y - 3, duration: 750, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
          } else {
            // Tiny floating golden interactive sparkle pin
            const pin = this.addStatic(
              this.add.circle(px, py - img.displayHeight * 0.88, 2.5, 0xf7d046, 0.92).setDepth(isWallMounted ? -840 : objDepth + 20),
            );
            this.tweens.add({ targets: pin, y: pin.y - 3, alpha: 0.45, duration: 750, yoyo: true, repeat: -1 });
          }
        }

        if (o.key === "curved_bar" || o.key === "order_counter") {
          this.spawnSteamSource(px, py - 34, objDepth + 12);
        }
        continue;
      }

      // Event corner photo backdrop on floor 2
      if (o.key === "event_corner") {
        const bg = this.addStatic(this.add.graphics().setDepth(-492));
        bg.fillStyle(0xff5f0e, 0.22);
        bg.fillPoints([{ x: r.A.sx, y: r.A.sy }, { x: r.B.sx, y: r.B.sy }, { x: r.C.sx, y: r.C.sy }, { x: r.D.sx, y: r.D.sy }], true);
        bg.lineStyle(1, 0xff5f0e, 0.7);
        bg.strokePoints([{ x: r.A.sx, y: r.A.sy }, { x: r.B.sx, y: r.B.sy }, { x: r.C.sx, y: r.C.sy }, { x: r.D.sx, y: r.D.sy }], true);
      }
    }

    // Kitchen station sprite on Floor 1 back-left (replaces plain grey zone!)
    if (this.current === "floor1" && this.textures.exists("spr-kitchen")) {
      const kPos = this.project(g, 2.2, 33.2);
      this.addStatic(this.add.image(kPos.sx, kPos.sy + 4, "spr-kitchen").setOrigin(0.5, 0.85).setDepth(kPos.sy));
    }

    // ── 4. Zombies, Run! Club Upgrade Props & NIKELAND Live Event Glow ────────
    this.drawClubUpgrades(g);

    // ── 5. Warm Night Lamps ───────────────────────────────────────────────────
    this.setupNightLamps(g);

    this.cameras.main.removeBounds();
    this.centre();
    for (const a of this.agents) {
      this.sprites.get(a.memberId)?.setVisible(a.scene === this.current);
    }
    this.applyDayPhase();
  }

  /** Tactile 3D cutaway slab + cozy garden lawn edge around the street diorama (no empty dark void!). */
  private drawDioramaPlatform(g: SceneGrid) {
    const slab = this.addStatic(this.add.graphics().setDepth(-1010));
    const A = this.corner(g, 0, 0);
    const B = this.corner(g, g.cols, 0);
    const C = this.corner(g, g.cols, g.rows);
    const D = this.corner(g, 0, g.rows);
    const depthH = 14;

    // Soft drop shadow beneath floating diorama slab
    slab.fillStyle(0x1f1917, 0.18);
    slab.fillPoints([
      { x: A.sx, y: A.sy + depthH + 6 }, { x: B.sx, y: B.sy + depthH + 6 },
      { x: C.sx, y: C.sy + depthH + 6 }, { x: D.sx, y: D.sy + depthH + 6 },
    ], true);

    // 3D front-left and front-right concrete foundation faces
    slab.fillStyle(0x7c746b, 1);
    slab.fillPoints([{ x: D.sx, y: D.sy }, { x: C.sx, y: C.sy }, { x: C.sx, y: C.sy + depthH }, { x: D.sx, y: D.sy + depthH }], true);
    slab.fillStyle(0x5e574f, 1);
    slab.fillPoints([{ x: C.sx, y: C.sy }, { x: B.sx, y: B.sy }, { x: B.sx, y: B.sy + depthH }, { x: C.sx, y: C.sy + depthH }], true);
    slab.lineStyle(2, 0x2b1d17, 0.85);
    slab.strokePoints([{ x: D.sx, y: D.sy }, { x: C.sx, y: C.sy }, { x: B.sx, y: B.sy }], false);

    // On street scene: add lush cozy grass tiles & trees flanking left/right sides of the ruko!
    if (this.current === "street" && this.textures.exists("spr-tile_grass")) {
      for (let y = 0; y < g.rows; y++) {
        for (const gx of [-2, -1, g.cols, g.cols + 1]) {
          const { sx, sy } = this.project(g, gx, y);
          this.addStatic(this.add.image(sx, sy, "spr-tile_grass").setOrigin(0.5, 0.5).setDepth(-1005));
        }
      }
      if (this.textures.exists("spr-tree_exterior")) {
        for (const [tx, ty] of [[-1.3, 1.5], [-1.3, 8.5], [g.cols + 0.6, 2.0], [g.cols + 0.6, 9.0]]) {
          const { sx, sy } = this.project(g, tx, ty);
          this.addStatic(this.add.image(sx, sy + 4, "spr-tree_exterior").setOrigin(0.5, 0.88).setDepth(sy - 5));
        }
      }
    }
  }

  private drawStairs(
    r: { A: { sx: number; sy: number }; B: { sx: number; sy: number }; C: { sx: number; sy: number }; D: { sx: number; sy: number } },
  ) {
    const g = this.addStatic(this.add.graphics().setDepth(-495));
    const { A, B, C, D } = r;
    const h = 6;
    g.fillStyle(0x9a9186, 1);
    g.fillPoints([{ x: D.sx, y: D.sy - h }, { x: C.sx, y: C.sy - h }, { x: C.sx, y: C.sy }, { x: D.sx, y: D.sy }], true);
    g.fillStyle(0xb5aba0, 1);
    g.fillPoints([{ x: A.sx, y: A.sy - h }, { x: B.sx, y: B.sy - h }, { x: C.sx, y: C.sy - h }, { x: D.sx, y: D.sy - h }], true);
    g.lineStyle(1, 0x3b2f2a, 0.75);
    for (let i = 1; i <= 7; i++) {
      const f = i / 8;
      g.lineBetween(
        A.sx + (D.sx - A.sx) * f, A.sy - h + (D.sy - A.sy) * f,
        B.sx + (C.sx - B.sx) * f, B.sy - h + (C.sy - B.sy) * f,
      );
    }
    // Warm wood handrail
    g.lineStyle(2, 0xb07a4a, 1);
    g.lineBetween(B.sx, B.sy - h - 8, C.sx, C.sy - h - 8);
  }

  private drawStudioArea(g: SceneGrid, o: WorldObject, mode: "yoga" | "dine") {
    const t = this.world.tileM;
    const cols = mode === "yoga" ? 2 : 1;
    const rows = 3;
    const tex = mode === "yoga" ? "spr-yoga_mat_single" : "spr-studio_table_set";
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
    r: { cx: number; cy: number },
  ) {
    if (this.textures.exists("spr-stretch_mat")) {
      const count = o.key === "stretch_zone" ? 2 : 1;
      for (let i = 0; i < count; i++) {
        const off = count === 2 ? (i === 0 ? -16 : 16) : 0;
        this.addStatic(this.add.image(r.cx + off, r.cy + off * 0.35, "spr-stretch_mat").setOrigin(0.5, 0.5).setDepth(-490));
      }
    }
  }

  drawWalls(g: SceneGrid) {
    const w = this.addStatic(this.add.graphics());
    const H = 56;
    const A = this.corner(g, 0, 0);
    const B = this.corner(g, g.cols, 0);
    const D = this.corner(g, 0, g.rows);

    // Warm cream interior walls (Photos 03, 07, 11)
    w.fillStyle(0xf6edd8, 1);
    w.fillPoints([{ x: A.sx, y: A.sy - H }, { x: B.sx, y: B.sy - H }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    w.fillStyle(0xe8ddc2, 1);
    w.fillPoints([{ x: D.sx, y: D.sy - H }, { x: A.sx, y: A.sy - H }, { x: A.sx, y: A.sy }, { x: D.sx, y: D.sy }], true);

    // Warm wood baseboard trim
    const baseH = 7;
    w.fillStyle(0xb07a4a, 0.85);
    w.fillPoints([{ x: A.sx, y: A.sy - baseH }, { x: B.sx, y: B.sy - baseH }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    w.fillStyle(0x96643a, 0.85);
    w.fillPoints([{ x: D.sx, y: D.sy - baseH }, { x: A.sx, y: A.sy - baseH }, { x: A.sx, y: A.sy }, { x: D.sx, y: D.sy }], true);

    // Signature Higround orange cutaway cap
    w.lineStyle(3, 0xff5f0e, 1);
    w.lineBetween(D.sx, D.sy - H, A.sx, A.sy - H);
    w.lineBetween(A.sx, A.sy - H, B.sx, B.sy - H);
    w.lineStyle(1, 0x2b1d17, 0.8);
    w.lineBetween(D.sx, D.sy - H - 1, A.sx, A.sy - H - 1);
    w.lineBetween(A.sx, A.sy - H - 1, B.sx, B.sy - H - 1);

    // Floor 1 Photo 03: vertical wood slat wall behind counter + Skylight sunbeam glow at back!
    if (this.current === "floor1") {
      const s0 = this.corner(g, 0, g.rows - 16);
      const s1 = this.corner(g, 0, g.rows - 8);
      w.fillStyle(0xb07a4a, 0.92);
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
      // Warm skylight sunlight wash on back wall (Photo 07!)
      const sk0 = this.corner(g, 5, 0);
      const sk1 = this.corner(g, g.cols, 0);
      w.fillStyle(0xfff9e6, 0.55);
      w.fillPoints([
        { x: sk0.sx, y: sk0.sy - H + 2 }, { x: sk1.sx, y: sk1.sy - H + 2 },
        { x: sk1.sx, y: sk1.sy - baseH }, { x: sk0.sx, y: sk0.sy - baseH },
      ], true);

      // Clean cutaway low partition wall framing the kitchen & toilet zone (prevents floating toilet door!)
      const pA = this.corner(g, 0, g.rows - 30);
      const pB = this.corner(g, 4.7, g.rows - 30);
      const pC = this.corner(g, 4.7, g.rows - 25);
      const partH = 26;
      w.fillStyle(0xeee4cd, 1);
      w.fillPoints([{ x: pA.sx, y: pA.sy - partH }, { x: pB.sx, y: pB.sy - partH }, { x: pB.sx, y: pB.sy }, { x: pA.sx, y: pA.sy }], true);
      w.fillStyle(0xe0d4ba, 1);
      w.fillPoints([{ x: pB.sx, y: pB.sy - partH }, { x: pC.sx, y: pC.sy - partH }, { x: pC.sx, y: pC.sy }, { x: pB.sx, y: pB.sy }], true);
      w.lineStyle(1.5, 0xb07a4a, 0.9);
      w.lineBetween(pA.sx, pA.sy - partH, pB.sx, pB.sy - partH);
      w.lineBetween(pB.sx, pB.sy - partH, pC.sx, pC.sy - partH);
    }

    // Floor 2 Photo 11: Large sunlit studio front window showing lush green tree leaves outside!
    if (this.current === "floor2") {
      // Place window along back-left upper Studio wall (clearly visible!)
      const u0 = this.corner(g, 0, g.rows - 6);
      const u1 = this.corner(g, 0, g.rows - 1);
      w.fillStyle(0xc8ecfa, 1);
      w.fillPoints([
        { x: u1.sx, y: u1.sy - 46 }, { x: u0.sx, y: u0.sy - 46 },
        { x: u0.sx, y: u0.sy - 16 }, { x: u1.sx, y: u1.sy - 16 },
      ], true);
      // Green tree foliage visible through the studio window
      const midX = (u0.sx + u1.sx) / 2;
      const midY = (u0.sy + u1.sy) / 2 - 30;
      w.fillStyle(0x52a152, 0.9);
      w.fillCircle(midX - 8, midY + 2, 9);
      w.fillCircle(midX + 6, midY - 3, 10);
      w.fillStyle(0x7ac76a, 0.85);
      w.fillCircle(midX, midY - 5, 7);
      w.lineStyle(2, 0x3b2f2a, 0.9);
      w.strokePoints([
        { x: u1.sx, y: u1.sy - 46 }, { x: u0.sx, y: u0.sy - 46 },
        { x: u0.sx, y: u0.sy - 16 }, { x: u1.sx, y: u1.sy - 16 },
      ], true);

      // Clean cutaway back partition separating Run Club Lounge from back storage/restrooms
      const rA = this.corner(g, 0, g.rows - 32);
      const rB = this.corner(g, 5.0, g.rows - 32);
      const partH = 26;
      w.fillStyle(0xeee4cd, 1);
      w.fillPoints([{ x: rA.sx, y: rA.sy - partH }, { x: rB.sx, y: rB.sy - partH }, { x: rB.sx, y: rB.sy }, { x: rA.sx, y: rA.sy }], true);
      w.lineStyle(1.5, 0xb07a4a, 0.9);
      w.lineBetween(rA.sx, rA.sy - partH, rB.sx, rB.sy - partH);
    }

    // Subtle low architectural curb along open front-right cutaway edge (B -> C) so rooms feel neatly framed
    const C = this.corner(g, g.cols, g.rows);
    w.lineStyle(2.5, 0xb07a4a, 0.7);
    w.lineBetween(B.sx, B.sy, C.sx, C.sy);
    w.lineBetween(D.sx, D.sy, C.sx, C.sy);

    w.setDepth(-950);
  }

  /** Photo 01 & 02: Iconic Higround storefront with tall glass door, warm wood pillar, and huge ARCH WINDOW! */
  drawStreetFacade(g: SceneGrid) {
    const w = this.addStatic(this.add.graphics());
    const H = 64;
    const A = this.corner(g, 0, 0);
    const B = this.corner(g, g.cols, 0);

    // Cream-white ruko facade
    w.fillStyle(0xf6f0e2, 1);
    w.fillPoints([{ x: A.sx, y: A.sy - H }, { x: B.sx, y: B.sy - H }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);

    // Left glass entrance door
    const d0 = this.corner(g, 0.4, 0);
    const d1 = this.corner(g, 2.7, 0);
    w.fillStyle(0x8ec5e8, 0.85);
    w.fillPoints([{ x: d0.sx, y: d0.sy - 40 }, { x: d1.sx, y: d1.sy - 40 }, { x: d1.sx, y: d1.sy }, { x: d0.sx, y: d0.sy }], true);
    w.lineStyle(2, 0x2b1d17, 0.9);
    w.strokePoints([{ x: d0.sx, y: d0.sy - 40 }, { x: d1.sx, y: d1.sy - 40 }, { x: d1.sx, y: d1.sy }, { x: d0.sx, y: d0.sy }], true);

    // Warm vertical wood pillar between door and arch window (Photo 02!)
    const p0 = this.corner(g, 2.7, 0);
    const p1 = this.corner(g, 3.5, 0);
    w.fillStyle(0xc48a52, 1);
    w.fillPoints([{ x: p0.sx, y: p0.sy - 42 }, { x: p1.sx, y: p1.sy - 42 }, { x: p1.sx, y: p1.sy }, { x: p0.sx, y: p0.sy }], true);

    // Iconic Arched Window "COFFEE & BURGER" (Photo 02!)
    const w0 = this.corner(g, 4.0, 0);
    const w1 = this.corner(g, 8.8, 0);
    const wMidX = (w0.sx + w1.sx) / 2;
    const wMidY = (w0.sy + w1.sy) / 2;
    w.fillStyle(0x2e3b48, 0.92);
    w.fillPoints([
      { x: w0.sx, y: w0.sy - 26 },
      { x: wMidX, y: wMidY - 40 },
      { x: w1.sx, y: w1.sy - 26 },
      { x: w1.sx, y: w1.sy - 5 },
      { x: w0.sx, y: w0.sy - 5 },
    ], true);
    w.lineStyle(2, 0x2b1d17, 0.95);
    w.strokePoints([
      { x: w0.sx, y: w0.sy - 26 },
      { x: wMidX, y: wMidY - 40 },
      { x: w1.sx, y: w1.sy - 26 },
      { x: w1.sx, y: w1.sy - 5 },
      { x: w0.sx, y: w0.sy - 5 },
    ], true);

    // Orange top trim beam
    w.lineStyle(4, 0xff5f0e, 1);
    w.lineBetween(A.sx, A.sy - H, B.sx, B.sy - H);
    w.setDepth(-998);

    // Subtle "COFFEE & BURGER" window lettering matching Photo 02!
    this.addStatic(
      this.add.text(wMidX, wMidY - 14, "COFFEE &\nBURGER", {
        fontFamily: "monospace",
        fontSize: "6px",
        fontStyle: "bold",
        color: "#FFF8EA",
        align: "center",
      }).setOrigin(0.5, 0.5).setResolution(3).setDepth(-994),
    );

    // Crisp HIGROUND facade sign cleanly above the roofline (zero overlap!)
    const mid = this.corner(g, 5.2, 0);
    this.addStatic(
      this.add.text(mid.sx, mid.sy - H - 6, "HIGROUND · COFFEE & RUN CLUB", {
        fontFamily: "monospace",
        fontSize: "9px",
        fontStyle: "bold",
        color: "#FFF8EA",
        backgroundColor: "#FF5F0E",
        padding: { x: 5, y: 2 },
      }).setOrigin(0.5, 1).setResolution(3).setDepth(-990),
    );
  }

  /** Zombies, Run! visual ruko upgrades + NIKELAND active event decorations! */
  private drawClubUpgrades(g: SceneGrid) {
    const u = this.opts.upgrades;

    // Tier 2+: Warm glowing fairy string lights across cafe / teras!
    if (u.stringLights) {
      const lights = this.addStatic(this.add.graphics().setDepth(1e5));
      const p1 = this.corner(g, 0.5, 2);
      const p2 = this.corner(g, g.cols - 0.5, 2);
      lights.lineStyle(1, 0x3b2f2a, 0.5);
      lights.lineBetween(p1.sx, p1.sy - 46, p2.sx, p2.sy - 46);
      for (let i = 1; i <= 7; i++) {
        const f = i / 8;
        const bx = p1.sx + (p2.sx - p1.sx) * f;
        const by = p1.sy - 46 + (p2.sy - p1.sy) * f + Math.sin(f * Math.PI) * 7;
        const bulb = this.addStatic(this.add.circle(bx, by, 2.5, i % 2 === 0 ? 0xf7d046 : 0xff9b42, 0.95).setDepth(1e5 + 1));
        this.tweens.add({ targets: bulb, alpha: 0.45, duration: 900 + i * 110, yoyo: true, repeat: -1 });
      }
    }

    // Tier 3+: Giant floating Higround Mascot Balloon flanking outer-right terrace (zero overlap with Start Gate!)
    if (this.current === "street" && u.mascotBalloon && this.textures.exists("spr-upgrade_balloon")) {
      const bPos = this.project(g, 10.6, 5.2);
      const bal = this.addStatic(
        this.add.image(bPos.sx, bPos.sy, "spr-upgrade_balloon").setOrigin(0.5, 0.95).setDepth(bPos.sy + 12),
      );
      this.tweens.add({ targets: bal, y: bal.y - 5, duration: 1400, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }

    // Tier 4: Gleaming Golden Club Trophy Pedestal neatly placed at Floor 2 Run Club Lounge corner!
    if (this.current === "floor2" && u.goldTrophy && this.textures.exists("spr-upgrade_trophy")) {
      const tPos = this.project(g, 8.2, 20.5);
      this.addStatic(
        this.add.image(tPos.sx, tPos.sy, "spr-upgrade_trophy").setOrigin(0.5, 0.88).setDepth(tPos.sy + 4),
      );
    }

    // NIKELAND / Zwift: Live active event celebratory pennant cleanly above Start Gate!
    if (this.current === "street" && this.opts.hasActiveEvent) {
      const ePos = this.project(g, 7.0, 5.0);
      const tag = this.addStatic(
        this.add.text(ePos.sx, ePos.sy - 68, "★ EVENT AKTIF! ★", {
          fontFamily: "monospace",
          fontSize: "8px",
          fontStyle: "bold",
          color: "#241917",
          backgroundColor: "#F7D046",
          padding: { x: 4, y: 2 },
        }).setOrigin(0.5, 1).setResolution(3).setDepth(1e5),
      );
      this.tweens.add({ targets: tag, y: tag.y - 4, duration: 650, yoyo: true, repeat: -1, ease: "Sine.easeInOut" });
    }
  }

  private spawnSteamSource(x: number, y: number, depth: number) {
    for (let i = 0; i < 3; i++) {
      const dot = this.addStatic(this.add.rectangle(x, y, 2, 2, 0xfffdf7, 0.65).setDepth(depth));
      this.steam.push({ dot, baseX: x + (i - 1) * 4, baseY: y, age: i * 0.65, life: 2.0, drift: (i - 1) * 3 });
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
      const glow = this.addStatic(this.add.circle(sx, sy - 6, 52, 0xffcc66, 0).setDepth(1.5e6));
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
    this.cameras.main.setBackgroundColor(DIORAMA_BG[p.name] ?? 0xcfe4ce);
    this.overlay.setFillStyle(p.tint, p.alpha * 0.72);
    for (const glow of this.lampGlows) {
      glow.setFillStyle(0xffcc66, p.lamps ? 0.18 : 0);
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
    const hint = INTERACTIVE_POIS.has(o.key) ? ` (Klik!)` : "";
    this.hoverLabel.setText(`${o.label}${hint}`).setPosition(wx + 8, wy - 18).setVisible(true);
  }

  private pulseBeacon(sx: number, sy: number) {
    const ring = this.add.circle(sx, sy + 2, 10, 0xff5f0e, 0).setDepth(sy + 40);
    ring.setStrokeStyle(2.5, 0xff5f0e, 0.95);
    this.tweens.add({
      targets: ring,
      scale: 2.6,
      alpha: 0,
      duration: 650,
      repeat: 1,
      ease: "Quad.easeOut",
      onComplete: () => ring.destroy(),
    });
  }

  centerOnMeImmediate(withBeacon = true): SceneKey | null {
    const me = this.opts.members.find((m) => m.isMe);
    if (!me) {
      this.centre();
      return null;
    }
    let agent = this.agents.find((a) => a.memberId === me.id);
    if (!agent || agent.mode === "gone") {
      this.spawn(me.id, wibHour(Date.now()), false);
      agent = this.agents.find((a) => a.memberId === me.id);
    }
    if (!agent) {
      this.centre();
      return null;
    }
    if (agent.scene !== this.current) {
      this.current = agent.scene;
      this.drawScene();
    }
    const g = this.world.scenes[agent.scene];
    const { sx, sy } = this.project(g, agent.x, agent.y);
    this.cameras.main.centerOn(sx, sy - 10);
    this.clampCamera();
    if (withBeacon) this.pulseBeacon(sx, sy);
    return agent.scene;
  }

  focusMember(memberId: string): SceneKey | null {
    let agent = this.agents.find((a) => a.memberId === memberId);
    if (!agent || agent.mode === "gone") {
      const exists = this.opts.members.some((m) => m.id === memberId);
      if (!exists) return null;
      this.respawnAt.delete(memberId);
      this.spawn(memberId, wibHour(Date.now()), false);
      agent = this.agents.find((a) => a.memberId === memberId);
      if (!agent) return null;
    }
    if (agent.scene !== this.current) this.setCurrent(agent.scene);
    const g = this.world.scenes[agent.scene];
    const { sx, sy } = this.project(g, agent.x, agent.y);
    this.hasPanned = true;
    this.cameras.main.pan(sx, sy - 10, 350, "Sine.easeInOut");
    this.pulseBeacon(sx, sy);
    return agent.scene;
  }

  focusMe(): SceneKey | null {
    const me = this.opts.members.find((m) => m.isMe);
    return me ? this.focusMember(me.id) : null;
  }

  /** WorkAdventure / Gather.town live cheer reaction right inside the world! */
  cheerMember(memberId: string) {
    const agent = this.agents.find((a) => a.memberId === memberId);
    if (!agent) return;
    agent.bubble = { text: "👏 Semangat! 🔥", ttl: 3.2 };
    const c = this.sprites.get(memberId);
    if (c && c.visible) {
      const img = c.getData("img") as Phaser.GameObjects.Image;
      this.tweens.add({ targets: img, y: -8, duration: 150, yoyo: true, repeat: 2, ease: "Quad.easeOut" });
      for (let i = 0; i < 4; i++) {
        const heart = this.add.text(c.x + (i - 1.5) * 8, c.y - 24, i % 2 === 0 ? "🧡" : "✨", { fontSize: "10px" })
          .setOrigin(0.5).setDepth(c.depth + 30);
        this.tweens.add({
          targets: heart,
          y: heart.y - 26,
          alpha: 0,
          duration: 900 + i * 120,
          onComplete: () => heart.destroy(),
        });
      }
    }
  }

  /** MMORPG overhead speech bubble when a member sends a message in World Chat! */
  sayMessage(memberId: string, text: string) {
    const agent = this.agents.find((a) => a.memberId === memberId);
    if (!agent) return;
    const clipped = text.length > 38 ? `${text.slice(0, 37)}…` : text;
    agent.bubble = { text: `💬 ${clipped}`, ttl: 5.5 };
  }

  private canWalkAt(g: SceneGrid, x: number, y: number): boolean {
    const tx = Math.round(x);
    const ty = Math.round(y);
    return inBounds(g, { x: tx, y: ty }) && g.walkable[ty][tx];
  }

  private findOpenTile(g: SceneGrid): { x: number; y: number } {
    const cx = Math.floor(g.cols / 2);
    const cy = Math.floor(g.rows / 2);
    for (let radius = 0; radius < Math.max(g.cols, g.rows); radius++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const tx = cx + dx;
          const ty = cy + dy;
          if (inBounds(g, { x: tx, y: ty }) && g.walkable[ty][tx]) return { x: tx, y: ty };
        }
      }
    }
    return { x: cx, y: cy };
  }

  setMoveInput(dx: number, dy: number) {
    this.manualInput = { dx, dy };
    if (dx !== 0 || dy !== 0) {
      this.manualUntil = Date.now() + MANUAL_AUTO_FALLBACK_MS;
    }
  }

  private setControlMode(next: "auto" | "manual") {
    if (this.controlMode !== next) {
      this.controlMode = next;
      this.opts.onControlMode?.(next);
    }
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const now = Date.now();
    const hour = wibHour(now);
    const counts: Record<SceneKey, number> = { street: 0, floor1: 0, floor2: 0 };

    for (const s of this.steam) {
      s.age = (s.age + dt) % s.life;
      const p = s.age / s.life;
      s.dot.setPosition(s.baseX + Math.sin(p * Math.PI * 2) * 2 + s.drift * p, s.baseY - p * 16);
      s.dot.setAlpha((1 - p) * 0.65);
    }

    // Update Pikmin-style glowing footstep trails
    for (let i = this.trails.length - 1; i >= 0; i--) {
      const tr = this.trails[i];
      tr.age += dt;
      if (tr.age >= tr.life) {
        tr.dot.destroy();
        this.trails.splice(i, 1);
      } else {
        tr.dot.setAlpha((1 - tr.age / tr.life) * 0.65);
      }
    }

    const me = this.opts.members.find((m) => m.isMe);
    const manualDriving = Boolean(me && (this.manualInput.dx !== 0 || this.manualInput.dy !== 0 || now < this.manualUntil));
    if (manualDriving && (this.manualInput.dx !== 0 || this.manualInput.dy !== 0)) {
      this.manualUntil = now + MANUAL_AUTO_FALLBACK_MS;
    }

    for (const a of this.agents) {
      const isMeAgent = Boolean(me && a.memberId === me.id);
      const remote = !isMeAgent ? this.remoteTargets.get(a.memberId) : undefined;
      if (isMeAgent && manualDriving) {
        this.setControlMode("manual");
        if (a.scene !== this.current) {
          a.scene = this.current;
          const open = this.findOpenTile(this.world.scenes[this.current]);
          a.x = open.x;
          a.y = open.y;
          a.path = [];
        }
        const { dx, dy } = this.manualInput;
        if (dx !== 0 || dy !== 0) {
          // Convert screen direction (dx right, dy down) to isometric grid velocity
          const rawVx = dx + dy;
          const rawVy = dx - dy;
          const len = Math.hypot(rawVx, rawVy) || 1;
          const speed = 3.6;
          const stepX = (rawVx / len) * speed * dt;
          const stepY = (rawVy / len) * speed * dt;
          const gCur = this.world.scenes[a.scene];
          if (this.canWalkAt(gCur, a.x + stepX, a.y + stepY)) {
            a.x += stepX;
            a.y += stepY;
          } else if (this.canWalkAt(gCur, a.x + stepX, a.y)) {
            a.x += stepX;
          } else if (this.canWalkAt(gCur, a.x, a.y + stepY)) {
            a.y += stepY;
          }
          a.facing = dx !== 0 ? (dx > 0 ? 1 : -1) : (dy > 0 ? 1 : -1);
          a.mode = "walk";
          a.path = [];
          this.opts.onLocalMove?.({
            userId: a.memberId,
            scene: a.scene,
            x: a.x,
            y: a.y,
            facing: a.facing === -1 ? -1 : 1,
            moving: true,
          });
          // Smooth camera follow while actively steering
          const pos = this.project(gCur, a.x, a.y);
          const cam = this.cameras.main;
          const targetScrollX = pos.sx - cam.width / 2;
          const targetScrollY = pos.sy - 10 - cam.height / 2;
          cam.scrollX += (targetScrollX - cam.scrollX) * Math.min(1, dt * 8);
          cam.scrollY += (targetScrollY - cam.scrollY) * Math.min(1, dt * 8);
          this.clampCamera();
          this.hasPanned = true;
        } else {
          // Waiting during grace period before auto-walk resumes
          a.mode = "use";
          a.timer = 1;
          a.path = [];
        }
        if (a.bubble) {
          a.bubble.ttl -= dt;
          if (a.bubble.ttl <= 0) a.bubble = null;
        }
      } else if (remote && now < remote.until) {
        if (a.scene !== remote.scene) {
          a.scene = remote.scene;
          a.x = remote.x;
          a.y = remote.y;
        } else {
          const lerp = Math.min(1, dt * 10);
          a.x += (remote.x - a.x) * lerp;
          a.y += (remote.y - a.y) * lerp;
        }
        a.facing = remote.facing;
        a.mode = remote.moving ? "walk" : "use";
        a.path = [];
        if (a.bubble) {
          a.bubble.ttl -= dt;
          if (a.bubble.ttl <= 0) a.bubble = null;
        }
      } else {
        if (remote) this.remoteTargets.delete(a.memberId);
        if (isMeAgent && this.controlMode === "manual") {
          this.setControlMode("auto");
          a.mode = "use";
          a.timer = 0.25;
          a.path = [];
        }
        tick(a, dt, this.rng, this.world);
      }

      const c = this.sprite(a);
      if (a.mode === "gone") {
        c.setVisible(false);
        if (!this.respawnAt.has(a.memberId)) this.respawnAt.set(a.memberId, now + 4000 + this.rng() * 8000);
        continue;
      }

      counts[a.scene]++;
      const g = this.world.scenes[a.scene];
      const { sx, sy } = this.project(g, a.x, a.y);
      c.setPosition(sx, sy + 3).setDepth(sy + 4).setVisible(a.scene === this.current);

      const img = c.getData("img") as Phaser.GameObjects.Image;
      const shadow = c.getData("shadow") as Phaser.GameObjects.Ellipse;
      const isMascot = a.memberId === MASCOT_ID;
      const member = this.opts.members.find((m) => m.id === a.memberId);
      const pose = isMeAgent && manualDriving ? (this.manualInput.dx !== 0 || this.manualInput.dy !== 0 ? "walk" : "idle") : poseForAgent(a);
      const clock = (this.animClock.get(a.memberId) ?? 0) + dt * fpsForPose(pose);
      this.animClock.set(a.memberId, clock);

      // Pikmin Bloom trail: members who ran today leave warm glowing footsteps as they walk/run!
      if (member?.ranToday && a.scene === this.current && (a.mode === "walk" || a.mode === "leave")) {
        const lastT = this.trailCooldown.get(a.memberId) ?? 0;
        if (now - lastT > 260 && this.trails.length < 48) {
          this.trailCooldown.set(a.memberId, now);
          const dot = this.add.circle(sx, sy + 2, 2.2, 0xff5f0e, 0.65).setDepth(-450);
          this.trails.push({ dot, age: 0, life: 2.4 });
        }
      }

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
      if (now >= at) { this.respawnAt.delete(id); this.spawn(id, hour, false); }
    }

    const key = JSON.stringify(counts);
    if (key !== this.lastCounts) { this.lastCounts = key; this.opts.onSceneCount?.(counts); }
  }

  setCurrent(k: SceneKey) {
    this.current = k;
    this.hasPanned = false;
    this.drawScene();
  }

  setStudioOverride(mode: StudioModeOverride) {
    this.studioOverride = mode;
    if (this.current === "floor2") this.drawScene();
  }

  applyRemoteMove(payload: LiveMovePayload) {
    this.remoteTargets.set(payload.userId, {
      ...payload,
      until: Date.now() + 4500,
    });
  }

  /** Add newly online members and remove members who went offline without resetting existing walkers. */
  syncMembers(nextMembers: GameMember[]) {
    const nextIds = new Set(nextMembers.map((m) => m.id));
    this.opts.members = nextMembers;

    // Remove agents & sprites for members who went offline (never remove the mascot)
    for (const a of [...this.agents]) {
      if (a.memberId === MASCOT_ID) continue;
      if (!nextIds.has(a.memberId)) {
        this.sprites.get(a.memberId)?.destroy();
        this.sprites.delete(a.memberId);
        this.animClock.delete(a.memberId);
        this.lastBubble.delete(a.memberId);
        this.respawnAt.delete(a.memberId);
        this.remoteTargets.delete(a.memberId);
      }
    }
    this.agents = this.agents.filter((a) => a.memberId === MASCOT_ID || nextIds.has(a.memberId));

    // Spawn members who just came online & refresh sprite if Top 1-3 medal changed
    const existingIds = new Set(this.agents.map((a) => a.memberId));
    const hour = wibHour(Date.now());
    for (const m of nextMembers) {
      this.ensureMemberTextures(m);
      const existingSprite = this.sprites.get(m.id);
      if (existingSprite && (existingSprite.getData("weeklyRank") ?? null) !== (m.weeklyRank ?? null)) {
        existingSprite.destroy();
        this.sprites.delete(m.id);
      }
      if (!existingIds.has(m.id)) {
        this.spawn(m.id, hour, false);
      }
    }
  }
}

export function createWorldGame(parent: HTMLElement, opts: GameOptions): WorldGame {
  const scene = new WorldScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#cfe4ce",
    pixelArt: true,
    roundPixels: true,
    input: {
      touch: { capture: true },
      activePointers: 2,
    },
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
    setZoom: (z) => {
      if (scene.cameras?.main) {
        scene.cameras.main.setZoom(z);
        if (!scene.hasPanned) scene.centerOnMeImmediate(false);
      }
    },
    setStudioMode: (m) => scene.sys?.isActive() && scene.setStudioOverride(m),
    setMoveInput: (dx, dy) => scene.sys?.isActive() && scene.setMoveInput(dx, dy),
    applyRemoteMove: (p) => scene.sys?.isActive() && scene.applyRemoteMove(p),
    syncMembers: (ms) => scene.sys?.isActive() && scene.syncMembers(ms),
    focusMe: () => (scene.sys?.isActive() ? scene.focusMe() : null),
    focusMember: (id) => (scene.sys?.isActive() ? scene.focusMember(id) : null),
    cheerMember: (id) => scene.sys?.isActive() && scene.cheerMember(id),
    sayMessage: (id, text) => scene.sys?.isActive() && scene.sayMessage(id, text),
    destroy: () => game.destroy(true),
  };
}
