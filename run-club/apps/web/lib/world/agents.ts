/**
 * Living characters (SPEC §6.4): each member on screen is an agent following a routine from
 * config/world_layout.json (coffee visit, pre/post run, yoga session, chill, family). The routine is picked
 * from real data (ran today, yoga stars, time of day). States: walk → use (bubble) → next step … → leave.
 * Pure: the caller passes dt and a random source; the renderer only reads positions and bubbles.
 */
import { buildWorld, nextScene, type SceneKey, type Tile, type World } from "./layout";
import { astar } from "./path";

export type Rng = () => number;

export interface Step { key: string; action: string | null; scene: SceneKey; tile: Tile }

export type Mode = "walk" | "use" | "leave" | "gone";

export interface Agent {
  id: string;
  memberId: string;
  routine: string;
  loop: boolean;                // the mascot never leaves
  scene: SceneKey;
  x: number;                    // tile coordinates (fractional while moving)
  y: number;
  path: Tile[];
  steps: Step[];
  stepIndex: number;
  mode: Mode;
  timer: number;                // seconds left in the current action
  bubble: { text: string; ttl: number } | null;
  facing: 1 | -1;
  exit: Tile;
}

export const SPEED = 2.2;       // tiles per second

/** What a member's real data says about them right now. */
export interface Hints {
  ranToday: boolean;
  yogaStars: number;
  isMascot?: boolean;
}

export function chooseRoutine(h: Hints, hourWib: number, rng: Rng): { name: string; loop: boolean } {
  if (h.isMascot) return { name: "mascot", loop: true };
  const morning = hourWib >= 5 && hourWib < 10;
  if (h.ranToday && morning) return { name: "post_run", loop: false };
  if (h.ranToday && rng() < 0.5) return { name: "post_run", loop: false };
  if (morning && rng() < 0.35) return { name: "pre_run", loop: false };
  if (h.yogaStars > 0 && rng() < (hourWib < 11 ? 0.5 : 0.25)) return { name: "yoga_session", loop: false };
  const r = rng();
  if (r < 0.45) return { name: "coffee_visit", loop: false };
  if (r < 0.75) return { name: "chill", loop: false };
  return { name: "family", loop: false };
}

export const MASCOT_ROUTINE = ["start_gate:stretch", "curved_bar:pickup_drink", "stretch_zone:stretch", "communal_table:chat",
                               "kids_corner:shoot_hoop"];

/** Turns routine tokens into concrete targets. `any_seat` = any place to sit; `table_f*` = a matching table. */
export function expandRoutine(tokens: string[], world: World, rng: Rng): Step[] {
  const out: Step[] = [];
  const all = Object.values(world.scenes).flatMap((g) => g.objects.map((o) => ({ o, g })));
  for (const tok of tokens) {
    const [name, action = null] = tok.split(":");
    let pick: (typeof all)[number] | undefined;
    if (name === "any_seat") {
      const seats = all.filter(({ o, g }) => o.actions?.includes("sit") && g.access[o.key] && g.key === "floor1");
      pick = seats[Math.floor(rng() * seats.length)];
    } else if (name.endsWith("*")) {
      const pre = name.slice(0, -1);
      const m = all.filter(({ o, g }) => o.key.startsWith(pre) && g.access[o.key]);
      pick = m[Math.floor(rng() * m.length)];
    } else {
      pick = all.find(({ o }) => o.key === name);
    }
    if (!pick) continue;
    const tile = pick.g.access[pick.o.key];
    if (!tile) continue;
    out.push({ key: pick.o.key, action: action ?? (pick.o.kind === "poi" ? pick.o.actions?.[0] ?? null : null), scene: pick.g.key, tile });
  }
  return out;
}

const BUBBLES: Record<string, string> = {
  queue: "…", order: "Kopi satu!", pay: "💸", pickup_drink: "☕", drink: "Enak!", eat: "🍔 Enak!", sit: "😌", read: "📖",
  puzzle: "🧩", color_book: "🖍️", shoot_hoop: "🏀", vote_burger: "🍔👍", order_gelato: "🍦", stretch: "🤸", run_start: "Gas! 🏃",
  run_return: "+XP!", drink_water: "💧", yoga_pose: "🧘 Perfect!", store_bag: "🎒", tie_shoes: "👟", chat: "💬", peek: "👀",
  grab_drink: "🥤", play_music: "🎵", photo_op: "📸", work: "💻", foam_roll: "😣", open_events: "📋", open_leaderboard: "🏆",
};
export const bubbleFor = (action: string | null) => (action ? BUBBLES[action] ?? null : null);

/** Seconds spent on an action. Running away from the gate takes a while: the runner is out on the road. */
export function actionSeconds(action: string | null, rng: Rng): number {
  if (!action) return 0;
  if (action === "run_start") return 1.5;
  if (["drink", "eat", "read", "chat", "work", "yoga_pose", "sit"].includes(action)) return 6 + rng() * 6;
  return 2 + rng() * 2.5;
}

export function spawnAgent(id: string, memberId: string, h: Hints, hourWib: number, rng: Rng, world: World = buildWorld()): Agent {
  const { name, loop } = chooseRoutine(h, hourWib, rng);
  const tokens = name === "mascot" ? MASCOT_ROUTINE : world.routines[name] ?? world.routines.coffee_visit;
  const edges = world.scenes.street.edges;
  const start = edges[Math.floor(rng() * edges.length)];
  const exit = edges[Math.floor(rng() * edges.length)];
  const a: Agent = {
    id, memberId, routine: name, loop, scene: "street", x: start.x, y: start.y, path: [], steps: expandRoutine(tokens, world, rng),
    stepIndex: 0, mode: "walk", timer: 0, bubble: null, facing: 1, exit,
  };
  if (loop) {                                               // the mascot starts inside, already at home
    const first = a.steps[0];
    Object.assign(a, { scene: first.scene, x: first.tile.x, y: first.tile.y });
  }
  return a;
}

function target(a: Agent): { scene: SceneKey; tile: Tile } {
  if (a.mode === "leave") return { scene: "street", tile: a.exit };
  return a.steps[a.stepIndex];
}

const at = (a: Agent, t: Tile) => Math.abs(a.x - t.x) < 1e-6 && Math.abs(a.y - t.y) < 1e-6;

function finishStep(a: Agent) {
  a.stepIndex++;
  if (a.stepIndex >= a.steps.length) {
    if (a.loop) a.stepIndex = 0;
    else { a.mode = "leave"; return; }
  }
  a.mode = "walk";
}

/** Advance one agent by dt seconds. Mutates and returns the agent. */
export function tick(a: Agent, dt: number, rng: Rng, world: World = buildWorld()): Agent {
  if (a.bubble) {
    a.bubble.ttl -= dt;
    if (a.bubble.ttl <= 0) a.bubble = null;
  }
  if (a.mode === "gone") return a;
  if (a.mode === "use") {
    a.timer -= dt;
    if (a.timer <= 0) finishStep(a);
    return a;
  }
  if (a.mode === "walk" && a.steps.length === 0) { a.mode = "leave"; }

  let budget = SPEED * dt;
  for (let guard = 0; guard < 8 && budget > 0; guard++) {
    if (a.path.length) {
      const n = a.path[0];
      const dx = n.x - a.x, dy = n.y - a.y;
      const d = Math.hypot(dx, dy);
      if (dx - dy !== 0) a.facing = dx - dy > 0 ? 1 : -1;     // screen-x direction in iso
      if (d <= budget) { a.x = n.x; a.y = n.y; a.path.shift(); budget -= d; continue; }
      a.x += (dx / d) * budget; a.y += (dy / d) * budget;
      return a;
    }
    const tgt = target(a);
    const g = world.scenes[a.scene];
    const here = { x: Math.round(a.x), y: Math.round(a.y) };
    if (a.scene !== tgt.scene) {
      const via = nextScene(a.scene, tgt.scene);
      const portal = g.portals[via]!;
      if (at(a, portal)) {                                    // step through the door / stairs
        const back = world.scenes[via].portals[a.scene]!;
        a.scene = via; a.x = back.x; a.y = back.y;
        continue;
      }
      const p = astar(g, here, portal);
      if (!p) { a.x = portal.x; a.y = portal.y; continue; }   // never get stuck: hop to the portal
      a.path = p;
      continue;
    }
    if (at(a, tgt.tile)) {
      if (a.mode === "leave") { a.mode = "gone"; return a; }
      const step = a.steps[a.stepIndex];
      const text = bubbleFor(step.action);
      if (text) a.bubble = { text, ttl: 2.5 };
      a.timer = actionSeconds(step.action, rng);
      a.mode = "use";
      if (a.timer <= 0) finishStep(a);
      return a;
    }
    const p = astar(g, here, tgt.tile);
    if (!p) {                                                  // unreachable target: skip it
      if (a.mode === "leave") { a.mode = "gone"; return a; }
      finishStep(a);
      return a;
    }
    a.path = p;
  }
  return a;
}

// ── time of day (WIB) ─────────────────────────────────────────────────────────

export interface DayPhase { name: "malam" | "subuh" | "pagi" | "siang" | "sore"; tint: number; alpha: number; lamps: boolean }

export function dayPhase(hourWib: number): DayPhase {
  if (hourWib < 5 || hourWib >= 19) return { name: "malam", tint: 0x1a1f4a, alpha: 0.38, lamps: true };
  if (hourWib < 6) return { name: "subuh", tint: 0x4a3a6a, alpha: 0.25, lamps: true };
  if (hourWib < 11) return { name: "pagi", tint: 0xfff2d6, alpha: 0.06, lamps: false };
  if (hourWib < 16) return { name: "siang", tint: 0xffffff, alpha: 0, lamps: false };
  return { name: "sore", tint: 0xff9a4a, alpha: 0.16, lamps: true };
}

export function wibHour(nowMs: number): number {
  return new Date(nowMs + 7 * 3600_000).getUTCHours();
}

/** Small deterministic PRNG for tests and reproducible scenes. */
export function seeded(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
