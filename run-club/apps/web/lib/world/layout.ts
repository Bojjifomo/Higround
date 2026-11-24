/**
 * The Higround world as grids (SPEC §6, config/world_layout.json). Pure data: no Phaser here.
 *
 * Units: the layout is in metres, 1 tile = 0.5 m. Each scene becomes a grid of tiles whose origin is the
 * scene's top-left corner in metres. Furniture blocks tiles; zones, wall art and overhead things do not.
 * Scenes connect through portals: the front door (street ↔ floor 1) and the stairs (floor 1 ↔ floor 2).
 */
import layoutJson from "../../../../config/world_layout.json";

export type SceneKey = "street" | "floor1" | "floor2";
export const SCENES: SceneKey[] = ["street", "floor1", "floor2"];
export const SCENE_LABEL: Record<SceneKey, string> = { street: "Jalan & Teras", floor1: "Lantai 1 · Coffee", floor2: "Lantai 2 · Studio" };

export interface WorldObject {
  key: string;
  label: string;
  kind: "zone" | "poi" | "deco" | "struct" | "wall_art";
  x: number; y: number; w: number; h: number;     // metres
  color?: string;
  actions?: string[];
  overhead?: boolean;
  note?: string;
}

export interface Tile { x: number; y: number }

export interface SceneGrid {
  key: SceneKey;
  originX: number;            // metres at tile (0, 0)
  originY: number;
  cols: number;
  rows: number;
  walkable: boolean[][];      // [row][col]
  objects: WorldObject[];
  /** Where an agent stands to use each POI (and each portal/waypoint struct). */
  access: Record<string, Tile>;
  /** Portal tiles in this scene, keyed by the scene they lead to. */
  portals: Partial<Record<SceneKey, Tile>>;
  /** Where agents enter and leave the world (street only). */
  edges: Tile[];
}

export interface World {
  tileM: number;
  scenes: Record<SceneKey, SceneGrid>;
  routines: Record<string, string[]>;
  /** Which scene holds each object key. */
  sceneOf: Record<string, SceneKey>;
}

/** Big pieces people stand on or walk through: they never block. The changing booth is the way into the
 *  event corner: in the concept plan storage, booth and toilet wall it off completely (owner to check). */
const WALK_THROUGH = new Set(["start_gate", "stretch_spot", "yoga_mats", "stretch_zone", "f1_door", "stairs", "stairs_top",
                              "sandwich_board", "event_corner", "changing_booth"]);

type Layout = { tile_m: number; scenes: Record<SceneKey, WorldObject[]>; agent_routines: Record<string, string[]> };
export const layout = layoutJson as unknown as Layout;

function blocks(o: WorldObject): boolean {
  if (o.overhead || o.kind === "zone" || o.kind === "wall_art") return false;
  return !WALK_THROUGH.has(o.key);
}

/** Tiles a rectangle covers (any overlap). */
export function tilesOf(o: Pick<WorldObject, "x" | "y" | "w" | "h">, g: Pick<SceneGrid, "originX" | "originY" | "cols" | "rows">, t: number): Tile[] {
  const x0 = Math.floor((o.x - g.originX) / t + 1e-9), x1 = Math.ceil((o.x + o.w - g.originX) / t - 1e-9) - 1;
  const y0 = Math.floor((o.y - g.originY) / t + 1e-9), y1 = Math.ceil((o.y + o.h - g.originY) / t - 1e-9) - 1;
  const out: Tile[] = [];
  for (let y = Math.max(0, y0); y <= Math.min(g.rows - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(g.cols - 1, x1); x++) out.push({ x, y });
  }
  return out;
}

/** Tiles whose centre lies inside the rectangle: what a piece of furniture actually takes up. */
export function tilesUnder(o: Pick<WorldObject, "x" | "y" | "w" | "h">, g: Pick<SceneGrid, "originX" | "originY" | "cols" | "rows">, t: number): Tile[] {
  return tilesOf(o, g, t).filter((p) => {
    const cx = g.originX + (p.x + 0.5) * t, cy = g.originY + (p.y + 0.5) * t;
    return cx >= o.x && cx < o.x + o.w && cy >= o.y && cy < o.y + o.h;
  });
}

export const inBounds = (g: Pick<SceneGrid, "cols" | "rows">, p: Tile) => p.x >= 0 && p.y >= 0 && p.x < g.cols && p.y < g.rows;
const dist2 = (a: Tile, b: { x: number; y: number }) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2;

/** Walkable tiles reachable from `start` (4-neighbour flood fill). */
export function reachable(g: SceneGrid, start: Tile): Set<string> {
  const seen = new Set<string>([`${start.x},${start.y}`]);
  const q = [start];
  while (q.length) {
    const p = q.shift()!;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: p.x + dx, y: p.y + dy };
      const k = `${n.x},${n.y}`;
      if (inBounds(g, n) && g.walkable[n.y][n.x] && !seen.has(k)) { seen.add(k); q.push(n); }
    }
  }
  return seen;
}

function buildScene(key: SceneKey, objects: WorldObject[], t: number): SceneGrid {
  const width = 5;                                         // the building is 5 m wide; the street matches it
  const solid = objects.filter((o) => !o.overhead && o.kind !== "wall_art");
  const minY = Math.min(...solid.map((o) => o.y)), maxY = Math.max(...solid.map((o) => o.y + o.h));
  const originY = key === "floor1" ? 0 : Math.floor(minY / t) * t;      // the door sits on the facade line
  const g: SceneGrid = {
    key, originX: 0, originY, cols: Math.round(width / t), rows: Math.ceil((maxY - originY) / t - 1e-9),
    walkable: [], objects, access: {}, portals: {}, edges: [],
  };
  g.walkable = Array.from({ length: g.rows }, () => Array<boolean>(g.cols).fill(true));
  for (const o of objects.filter(blocks)) for (const p of tilesUnder(o, g, t)) g.walkable[p.y][p.x] = false;

  const centre = (o: WorldObject) => ({ x: (o.x + o.w / 2 - g.originX) / t - 0.5, y: (o.y + o.h / 2 - g.originY) / t - 0.5 });
  // Portals and their partner scenes.
  if (key === "street") {
    g.portals.floor1 = { x: 1, y: g.rows - 1 };            // in front of the door, on the terrace
    g.edges = [{ x: 0, y: 2 }, { x: g.cols - 1, y: 2 }, { x: 0, y: 3 }, { x: g.cols - 1, y: 3 }];   // on the road
  }
  const door = objects.find((o) => o.key === "f1_door");
  if (door) g.portals.street = tilesOf(door, g, t).sort((a, b) => dist2(a, centre(door)) - dist2(b, centre(door)))[0];
  const stairs = objects.find((o) => o.key === "stairs" || o.key === "stairs_top");
  if (stairs) {
    const foot = tilesOf(stairs, g, t).sort((a, b) => a.y - b.y || a.x - b.x)[0];
    g.portals[key === "floor1" ? "floor2" : "floor1"] = foot;
  }

  // Where to stand for each object: on it when it is walk-through, else the nearest reachable free tile beside it.
  const anchor = g.portals.street ?? g.portals.floor1 ?? g.portals.floor2 ?? g.edges[0];
  const reach = reachable(g, anchor);
  for (const o of objects) {
    if (o.kind === "zone" || o.overhead) continue;
    const c = centre(o);
    const own = tilesOf(o, g, t);
    let candidates: Tile[];
    if (!blocks(o)) {
      candidates = own;
    } else {
      const ring = new Map<string, Tile>();
      for (const p of own) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const n = { x: p.x + dx, y: p.y + dy };
          if (inBounds(g, n)) ring.set(`${n.x},${n.y}`, n);
        }
      }
      candidates = [...ring.values()];
    }
    const ok = candidates.filter((p) => g.walkable[p.y][p.x] && reach.has(`${p.x},${p.y}`))
      .sort((a, b) => dist2(a, c) - dist2(b, c));
    if (ok.length) g.access[o.key] = ok[0];
  }
  return g;
}

let cached: World | null = null;

export function buildWorld(): World {
  if (cached) return cached;
  const t = layout.tile_m;
  const scenes = {} as Record<SceneKey, SceneGrid>;
  const sceneOf: Record<string, SceneKey> = {};
  for (const k of SCENES) {
    scenes[k] = buildScene(k, layout.scenes[k], t);
    for (const o of layout.scenes[k]) sceneOf[o.key] = k;
  }
  cached = { tileM: t, scenes, routines: layout.agent_routines, sceneOf };
  return cached;
}

/** The scene to go through next to get from `from` to `to` (street ↔ floor1 ↔ floor2). */
export function nextScene(from: SceneKey, to: SceneKey): SceneKey {
  if (from === to) return to;
  if (from === "street") return "floor1";
  if (from === "floor2") return "floor1";
  return to;                                                // floor1 → street or floor2
}
