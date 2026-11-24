/**
 * Phaser renderer for the Higround world (SPEC §6.3). Loaded only in the browser (dynamic import).
 * Placeholder art drawn in code: iso floor diamonds, furniture as boxes, back walls, pixel people and the
 * mascot. All game logic lives in lib/world (pure, tested); this file only draws and handles input.
 *
 * Coordinates: grid rows are flipped (row 0 = the back of the building) so the street sits at the front,
 * the way you see Higround from the road.
 */
import * as Phaser from "phaser";
import { dayPhase, seeded, spawnAgent, tick, wibHour, type Agent, type Rng } from "@/lib/world/agents";
import { buildWorld, type SceneGrid, type SceneKey, type World, type WorldObject } from "@/lib/world/layout";
import { ISO_H, ISO_W, toGrid, toScreen } from "@/lib/world/path";
import { MASCOT, MASCOT_PALETTE, PERSON, personPalette, type AvatarColors } from "@/lib/world/sprite";

export interface GameMember {
  id: string; name: string; avatar: AvatarColors; ranToday: boolean; yogaStars: number; isMe: boolean; level: number;
}

export interface WorldGame {
  setScene(key: SceneKey): void;
  setZoom(z: number): void;
  destroy(): void;
}

export interface GameOptions {
  members: GameMember[];
  initialScene: SceneKey;
  onSelect(memberId: string | null): void;
  onSceneCount?(counts: Record<SceneKey, number>): void;
}

const MASCOT_ID = "__mascot__";
const FLOOR: Record<SceneKey, [number, number]> = {
  street: [0xb9b4ab, 0xaea89e], floor1: [0xa9a6a0, 0x9f9c96], floor2: [0xe9dfc8, 0xe1d6bd],
};
const KIND_H: Record<string, number> = { poi: 12, deco: 9, struct: 34, wall_art: 26 };
/** Things people stand on: drawn flat on the floor (mats, stretch areas, the gate's footprint). */
const FLAT = new Set(["yoga_mats", "stretch_zone", "stretch_spot", "start_gate", "event_corner", "sandwich_board"]);
const hex = (c: string | undefined, fallback: number) => {
  if (!c || c === "none" || !c.startsWith("#")) return fallback;
  return parseInt(c.slice(1, 7), 16);
};
const shade = (c: number, f: number) => {
  const r = Math.min(255, Math.round(((c >> 16) & 255) * f)), g = Math.min(255, Math.round(((c >> 8) & 255) * f));
  const b = Math.min(255, Math.round((c & 255) * f));
  return (r << 16) | (g << 8) | b;
};

class WorldScene extends Phaser.Scene {
  world!: World;
  current: SceneKey = "street";
  statics: Phaser.GameObjects.GameObject[] = [];
  agents: Agent[] = [];
  sprites = new Map<string, Phaser.GameObjects.Container>();
  respawnAt = new Map<string, number>();
  overlay!: Phaser.GameObjects.Rectangle;
  hoverLabel!: Phaser.GameObjects.Text;
  rng: Rng = seeded(Date.now() & 0xffff);
  dragging = false;
  dragStart = { x: 0, y: 0, sx: 0, sy: 0 };
  lastCounts = "";

  constructor(private opts: GameOptions) { super("world"); }

  // grid (x, row) → screen, with rows flipped so the front of the building is at the bottom
  project(g: SceneGrid, x: number, y: number) {
    return toScreen(x, g.rows - 1 - y);
  }
  corner(g: SceneGrid, bx: number, by: number) {
    // boundary coordinates (in tiles, flipped): the corner between cells
    return toScreen(bx - 0.5, by - 0.5);
  }

  create() {
    this.world = buildWorld();
    this.current = this.opts.initialScene;
    this.makeTextures();
    const hour = wibHour(Date.now());
    for (const m of this.opts.members) this.spawn(m.id, hour, true);
    this.spawn(MASCOT_ID, hour, true);

    this.hoverLabel = this.add.text(0, 0, "", {
      fontFamily: "monospace", fontSize: "10px", color: "#ffffff", backgroundColor: "#111111", padding: { x: 3, y: 2 },
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

  makeTextures() {
    const paint = (key: string, rows: string[], pal: Record<string, string>) => {
      if (this.textures.exists(key)) return;
      const g = this.make.graphics({ x: 0, y: 0 }, false);
      rows.forEach((row, y) => [...row].forEach((ch, x) => {
        if (pal[ch]) { g.fillStyle(parseInt(pal[ch].slice(1), 16), 1); g.fillRect(x, y, 1, 1); }
      }));
      g.generateTexture(key, rows[0].length, rows.length);
      g.destroy();
    };
    for (const m of this.opts.members) paint(`p-${m.id}`, PERSON, personPalette(m.avatar));
    paint(`p-${MASCOT_ID}`, MASCOT, MASCOT_PALETTE);
  }

  spawn(memberId: string, hour: number, scatter: boolean): void {
    const m = this.opts.members.find((x) => x.id === memberId);
    const a = spawnAgent(`${memberId}-${Date.now()}`, memberId,
                         { ranToday: !!m?.ranToday, yogaStars: m?.yogaStars ?? 0, isMascot: memberId === MASCOT_ID }, hour, this.rng, this.world);
    if (scatter && !a.loop) {                       // start the day mid-routine so the world is not empty
      for (let i = 0, n = Math.floor(this.rng() * 900); i < n && a.mode !== "gone"; i++) tick(a, 0.1, this.rng, this.world);
      if (a.mode === "gone") { this.spawn(memberId, hour, false); return; }
    }
    this.agents = this.agents.filter((x) => x.memberId !== memberId).concat(a);
  }

  sprite(a: Agent): Phaser.GameObjects.Container {
    let c = this.sprites.get(a.memberId);
    if (c) return c;
    const m = this.opts.members.find((x) => x.id === a.memberId);
    const isMascot = a.memberId === MASCOT_ID;
    const img = this.add.image(0, 0, `p-${a.memberId}`).setOrigin(0.5, 1);
    const shadow = this.add.ellipse(0, 0, 14, 5, 0x000000, 0.25);
    const name = this.add.text(0, -24, isMascot ? "Higround" : (m?.name.split(" ")[0] ?? ""), {
      fontFamily: "monospace", fontSize: "8px", color: "#111111", backgroundColor: m?.isMe ? "#F7D046" : "#ffffffcc", padding: { x: 2, y: 1 },
    }).setOrigin(0.5, 1).setResolution(3);
    const bubble = this.add.text(0, -34, "", {
      fontFamily: "monospace", fontSize: "9px", color: "#111111", backgroundColor: "#ffffff", padding: { x: 3, y: 2 },
    }).setOrigin(0.5, 1).setResolution(3).setVisible(false);
    const parts: Phaser.GameObjects.GameObject[] = [shadow, img, name, bubble];
    if ((m?.level ?? 0) >= 20) {                     // high level: a small aura
      parts.unshift(this.add.ellipse(0, -9, 22, 26, 0xf7d046, 0.25));
    }
    c = this.add.container(0, 0, parts);
    c.setSize(18, 24).setInteractive(new Phaser.Geom.Rectangle(-9, -22, 18, 24), Phaser.Geom.Rectangle.Contains);
    c.setData("memberId", isMascot ? null : a.memberId).setData("bubble", bubble).setData("img", img);
    if (isMascot) c.setData("memberId", null);
    this.sprites.set(a.memberId, c);
    return c;
  }

  drawScene() {
    for (const o of this.statics) o.destroy();
    this.statics = [];
    const g = this.world.scenes[this.current];
    const layer = { add: (o: Phaser.GameObjects.GameObject) => { this.statics.push(o); } };
    const gfx = this.add.graphics().setDepth(-1000);
    layer.add(gfx);
    const [c1, c2] = FLOOR[this.current];
    // floor tiles
    for (let y = 0; y < g.rows; y++) {
      for (let x = 0; x < g.cols; x++) {
        const { sx, sy } = this.project(g, x, y);
        gfx.fillStyle((x + y) % 2 ? c1 : c2, 1);
        gfx.fillPoints([{ x: sx, y: sy - ISO_H / 2 }, { x: sx + ISO_W / 2, y: sy }, { x: sx, y: sy + ISO_H / 2 }, { x: sx - ISO_W / 2, y: sy }], true);
      }
    }
    // zones tint the floor, then walls, then furniture sorted by depth
    const rect = (o: WorldObject) => {
      const t = this.world.tileM;
      const x0 = (o.x - g.originX) / t, x1 = (o.x + o.w - g.originX) / t;
      const y0 = g.rows - (o.y + o.h - g.originY) / t, y1 = g.rows - (o.y - g.originY) / t;   // flipped
      const A = this.corner(g, x0, y0), B = this.corner(g, x1, y0), C = this.corner(g, x1, y1), D = this.corner(g, x0, y1);
      return { A, B, C, D };
    };
    for (const o of g.objects.filter((o) => o.kind === "zone")) {
      const { A, B, C, D } = rect(o);
      gfx.fillStyle(hex(o.color, 0xcccccc), 0.35);
      gfx.fillPoints([{ x: A.sx, y: A.sy }, { x: B.sx, y: B.sy }, { x: C.sx, y: C.sy }, { x: D.sx, y: D.sy }], true);
    }
    if (this.current !== "street") this.drawWalls(g, layer);
    const solids = g.objects.filter((o) => o.kind !== "zone" && !o.overhead)
      .map((o) => ({ o, r: rect(o) })).sort((a, b) => a.r.C.sy - b.r.C.sy);
    for (const { o, r } of solids) {
      const box = this.add.graphics();
      const flat = FLAT.has(o.key);
      const h = flat ? 2 : o.kind === "struct" && (o.key.includes("stairs") || o.key.includes("door")) ? 6 : KIND_H[o.kind] ?? 10;
      const top = hex(o.color, o.kind === "struct" ? 0xd8d2c4 : 0x8a6a4a);
      const { A, B, C, D } = r;
      box.fillStyle(shade(top, 0.72), 1);
      box.fillPoints([{ x: D.sx, y: D.sy - h }, { x: C.sx, y: C.sy - h }, { x: C.sx, y: C.sy }, { x: D.sx, y: D.sy }], true);
      box.fillStyle(shade(top, 0.86), 1);
      box.fillPoints([{ x: C.sx, y: C.sy - h }, { x: B.sx, y: B.sy - h }, { x: B.sx, y: B.sy }, { x: C.sx, y: C.sy }], true);
      box.fillStyle(top, 1);
      box.fillPoints([{ x: A.sx, y: A.sy - h }, { x: B.sx, y: B.sy - h }, { x: C.sx, y: C.sy - h }, { x: D.sx, y: D.sy - h }], true);
      box.lineStyle(1, 0x000000, 0.25);
      box.strokePoints([{ x: A.sx, y: A.sy - h }, { x: B.sx, y: B.sy - h }, { x: C.sx, y: C.sy - h }, { x: D.sx, y: D.sy - h }], true);
      box.setDepth(flat ? -500 : C.sy);
      layer.add(box);
    }
    // scene bounds for the camera
    this.cameras.main.removeBounds();          // a small scene must still sit in the middle of a big viewport
    this.centre();
    for (const a of this.agents) this.sprites.get(a.memberId)?.setVisible(a.scene === this.current);
  }

  drawWalls(g: SceneGrid, layer: { add(o: Phaser.GameObjects.GameObject): void }) {
    const w = this.add.graphics();
    const H = 46;
    const A = this.corner(g, 0, 0), B = this.corner(g, g.cols, 0), D = this.corner(g, 0, g.rows);
    w.fillStyle(0xf3e9d2, 1);
    w.fillPoints([{ x: A.sx, y: A.sy - H }, { x: B.sx, y: B.sy - H }, { x: B.sx, y: B.sy }, { x: A.sx, y: A.sy }], true);
    w.fillStyle(0xe6dbc1, 1);
    w.fillPoints([{ x: D.sx, y: D.sy - H }, { x: A.sx, y: A.sy - H }, { x: A.sx, y: A.sy }, { x: D.sx, y: D.sy }], true);
    w.lineStyle(2, 0xff5f0e, 1);
    w.lineBetween(D.sx, D.sy - H, A.sx, A.sy - H);
    w.lineBetween(A.sx, A.sy - H, B.sx, B.sy - H);
    w.setDepth(-999);
    layer.add(w);
  }

  centre() {
    const g = this.world.scenes[this.current];
    const mid = this.project(g, g.cols / 2, g.rows / 2);
    this.cameras.main.centerOn(mid.sx, mid.sy - 10);
  }

  fitOverlay() {
    this.overlay.setSize(this.scale.width, this.scale.height);
  }

  applyDayPhase() {
    const p = dayPhase(wibHour(Date.now()));
    this.overlay.setFillStyle(p.tint, p.alpha);
    this.fitOverlay();
  }

  hover(wx: number, wy: number) {
    const g = this.world.scenes[this.current];
    const grid = toGrid(wx, wy);
    const x = grid.x + 0.5, yFlip = grid.y + 0.5;
    const metresX = g.originX + x * this.world.tileM;
    const metresY = g.originY + (g.rows - yFlip) * this.world.tileM;
    const o = g.objects.find((ob) => ob.kind === "poi" && metresX >= ob.x && metresX <= ob.x + ob.w && metresY >= ob.y && metresY <= ob.y + ob.h);
    if (!o) { this.hoverLabel.setVisible(false); return; }
    this.hoverLabel.setText(o.label).setPosition(wx + 8, wy - 18).setVisible(true);
  }

  update(_t: number, deltaMs: number) {
    const dt = Math.min(deltaMs / 1000, 0.1);
    const now = Date.now();
    const hour = wibHour(now);
    const counts: Record<SceneKey, number> = { street: 0, floor1: 0, floor2: 0 };
    for (const a of this.agents) {
      tick(a, dt, this.rng, this.world);
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
      (c.getData("img") as Phaser.GameObjects.Image).setFlipX(a.facing < 0);
      const bubble = c.getData("bubble") as Phaser.GameObjects.Text;
      if (a.bubble) bubble.setText(a.bubble.text).setVisible(true); else bubble.setVisible(false);
    }
    for (const [id, at] of this.respawnAt) {
      if (now >= at) { this.respawnAt.delete(id); this.spawn(id, hour, false); }
    }
    const key = JSON.stringify(counts);
    if (key !== this.lastCounts) { this.lastCounts = key; this.opts.onSceneCount?.(counts); }
  }

  setCurrent(k: SceneKey) {
    this.current = k;
    this.drawScene();
  }
}

export function createWorldGame(parent: HTMLElement, opts: GameOptions): WorldGame {
  const scene = new WorldScene(opts);
  const game = new Phaser.Game({
    type: Phaser.AUTO, parent, backgroundColor: "#2b2a33", pixelArt: true, roundPixels: true,
    scale: { mode: Phaser.Scale.RESIZE, width: parent.clientWidth, height: parent.clientHeight },
    scene, banner: false,
  });
  /** Where a member's character is on screen (CSS px inside the canvas), for tests and tooling. */
  (window as unknown as { __hgWhere?: (id: string) => { x: number; y: number } | null }).__hgWhere = (id) => {
    const c = scene.sprites.get(id);
    if (!c || !c.visible) return null;
    const cam = scene.cameras.main;
    return { x: (c.x - cam.worldView.x) * cam.zoom, y: (c.y - 10 - cam.worldView.y) * cam.zoom };
  };
  return {
    setScene: (k) => scene.sys?.isActive() && scene.setCurrent(k),
    setZoom: (z) => { scene.cameras?.main?.setZoom(z); },
    destroy: () => game.destroy(true),
  };
}
