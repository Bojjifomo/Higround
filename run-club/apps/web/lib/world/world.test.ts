import { describe, expect, it } from "vitest";
import {
  bubbleFor, chooseRoutine, dayPhase, expandRoutine, seeded, spawnAgent, tick, wibHour, type Agent,
} from "./agents";
import { buildWorld, reachable, SCENES } from "./layout";
import { astar, toGrid, toScreen } from "./path";
import { ANIM_FRAMES, normalizeAvatar, randomAvatar, renderAvatarPixels, SPRITE_H, SPRITE_W, type AnimPose } from "./sprite";
import { WORLD_MANIFEST } from "./assetManifest";
import { cafeVouchersFor, loyaltyTierOf, rukoUpgradeFor, weeklyClubQuestFor } from "../rewards";

const world = buildWorld();

describe("layout", () => {
  it("builds three scenes, 10 tiles wide, from the 0.5 m grid", () => {
    expect(SCENES.map((k) => world.scenes[k].cols)).toEqual([10, 10, 10]);
    expect(world.scenes.floor1.rows).toBe(36);
    expect(world.scenes.street.rows).toBe(12);
    expect(world.scenes.floor2.rows).toBeGreaterThanOrEqual(38);
  });
  it("blocks furniture but not zones, wall art or the yoga mats", () => {
    const f1 = world.scenes.floor1;
    const counter = { x: 1, y: 10 };                       // order counter covers x 0.5–2.1 m, y 4–7.5 m
    expect(f1.walkable[counter.y][counter.x]).toBe(false);
    const f2 = world.scenes.floor2;
    const mat = { x: Math.floor((2 - f2.originX) / 0.5), y: Math.floor((3 - f2.originY) / 0.5) };
    expect(f2.walkable[mat.y][mat.x]).toBe(true);
  });
  it("connects the street to floor 1 and floor 1 to floor 2", () => {
    expect(world.scenes.street.portals.floor1).toBeDefined();
    expect(world.scenes.floor1.portals.street).toBeDefined();
    expect(world.scenes.floor1.portals.floor2).toBeDefined();
    expect(world.scenes.floor2.portals.floor1).toBeDefined();
  });
  it("can reach every POI from the scene's entrance", () => {
    for (const k of SCENES) {
      const g = world.scenes[k];
      const entry = g.portals.street ?? g.portals.floor1 ?? g.portals.floor2!;
      const reach = reachable(g, entry);
      for (const o of g.objects.filter((x) => x.kind === "poi")) {
        const a = g.access[o.key];
        expect(a, `${k}:${o.key} has a spot to stand`).toBeDefined();
        expect(reach.has(`${a.x},${a.y}`), `${k}:${o.key} reachable`).toBe(true);
      }
    }
  });
});

describe("path & projection", () => {
  it("finds a path that only uses walkable tiles", () => {
    const g = world.scenes.floor1;
    const p = astar(g, g.portals.street!, g.access.communal_table)!;
    expect(p.length).toBeGreaterThan(20);
    for (const t of p) expect(g.walkable[t.y][t.x]).toBe(true);
    expect(p[p.length - 1]).toEqual(g.access.communal_table);
  });
  it("returns null for a blocked target", () => {
    expect(astar(world.scenes.floor1, world.scenes.floor1.portals.street!, { x: 1, y: 10 })).toBeNull();
  });
  it("toGrid undoes toScreen", () => {
    for (const [x, y] of [[0, 0], [3, 7], [9.5, 35.25]]) {
      const s = toScreen(x, y);
      const g = toGrid(s.sx, s.sy);
      expect(g.x).toBeCloseTo(x);
      expect(g.y).toBeCloseTo(y);
    }
  });
});

describe("routines from real data", () => {
  it("runners who ran today come back to Higround after the run in the morning", () => {
    expect(chooseRoutine({ ranToday: true, yogaStars: 0 }, 7, seeded(1)).name).toBe("post_run");
  });
  it("yoga people go upstairs more often in the morning", () => {
    const rng = seeded(2);
    const n = Array.from({ length: 200 }, () => chooseRoutine({ ranToday: false, yogaStars: 20 }, 13, rng).name)
      .filter((r) => r === "yoga_session").length;
    expect(n).toBeGreaterThan(20);
    const none = Array.from({ length: 200 }, () => chooseRoutine({ ranToday: false, yogaStars: 0 }, 13, rng).name)
      .filter((r) => r === "yoga_session").length;
    expect(none).toBe(0);
  });
  it("expands routine tokens into reachable targets, including any_seat and table_f*", () => {
    const steps = expandRoutine(["order_counter:order", "any_seat:drink", "table_f*:eat", "nope"], world, seeded(3));
    expect(steps.map((s) => s.key)).toEqual(["order_counter", expect.any(String), expect.stringMatching(/^table_f/)]);
    expect(steps[1].action).toBe("drink");
  });
});

describe("agents walk their routine", () => {
  function run(a: Agent, seconds: number) {
    const rng = seeded(9);
    const scenes = new Set<string>();
    for (let t = 0; t < seconds && a.mode !== "gone"; t += 0.1) { tick(a, 0.1, rng); scenes.add(a.scene); }
    return scenes;
  }
  it("a coffee visit goes in, orders, drinks and leaves", () => {
    const rng = seeded(4);
    let a: Agent;
    do { a = spawnAgent("a", "m", { ranToday: false, yogaStars: 0 }, 14, rng); } while (a.routine !== "coffee_visit");
    const scenes = run(a, 400);
    expect(scenes.has("floor1")).toBe(true);
    expect(a.mode).toBe("gone");
  });
  it("a yoga session climbs to floor 2 and comes back", () => {
    const rng = seeded(5);
    let a: Agent;
    do { a = spawnAgent("y", "m", { ranToday: false, yogaStars: 30 }, 7, rng); } while (a.routine !== "yoga_session");
    const scenes = run(a, 500);
    expect([...scenes]).toEqual(expect.arrayContaining(["street", "floor1", "floor2"]));
    expect(a.mode).toBe("gone");
  });
  it("shows a bubble while using a POI", () => {
    const a = spawnAgent("m", "mascot", { ranToday: false, yogaStars: 0, isMascot: true }, 9, seeded(6));
    tick(a, 0.1, seeded(6));
    expect(a.mode).toBe("use");
    expect(a.bubble?.text).toBe(bubbleFor("stretch"));
  });
  it("the mascot loops forever", () => {
    const a = spawnAgent("m", "mascot", { ranToday: false, yogaStars: 0, isMascot: true }, 9, seeded(7));
    run(a, 600);
    expect(a.mode).not.toBe("gone");
  });
  it("the logged-in player spawns visibly inside the preferred scene and never disappears", () => {
    const a = spawnAgent("me", "u1", { ranToday: false, yogaStars: 0, isMe: true, preferredScene: "floor1" }, 14, seeded(8));
    expect(a.scene).toBe("floor1");
    expect(a.loop).toBe(true);
    expect(world.scenes.floor1.walkable[Math.round(a.y)][Math.round(a.x)]).toBe(true);
    run(a, 600);
    expect(a.mode).not.toBe("gone");
  });
});

describe("time of day", () => {
  it("follows WIB", () => {
    expect(wibHour(Date.parse("2026-11-24T23:30:00Z"))).toBe(6);
    expect(dayPhase(6).name).toBe("pagi");
    expect(dayPhase(13).alpha).toBe(0);
    expect(dayPhase(21)).toMatchObject({ name: "malam", lamps: true });
  });
});

describe("character sprites & world manifest", () => {
  it("normalizes legacy 5-color avatars and renders all 6 animated poses with crisp outlines", () => {
    const legacy = normalizeAvatar({ skin: "#F1C9A5", hair: "#1d1d1d", top: "#FF5F0E", bottom: "#222222", shoes: "#ffffff" });
    expect(legacy.hairStyle).toBe("short");
    const custom = randomAvatar(42);
    for (const pose of Object.keys(ANIM_FRAMES) as AnimPose[]) {
      for (let f = 0; f < ANIM_FRAMES[pose]; f++) {
        const s = renderAvatarPixels(custom, pose, f);
        expect(s.width).toBe(SPRITE_W);
        expect(s.height).toBe(SPRITE_H);
        expect(s.rows.length).toBe(SPRITE_H);
        expect(s.rows.every((r) => r.length === SPRITE_W)).toBe(true);
        expect(s.rows.some((r) => r.includes("o"))).toBe(true);
      }
    }
  });
  it("includes key Higround landmarks, mascot poses, and CC0 tiles in the sprite manifest", () => {
    for (const key of [
      "start_gate", "order_counter", "gelato_kiosk", "mascot_fridges", "mascot_idle", "mascot_run",
      "tile_asphalt", "table_f1", "communal_table", "plant_bench", "kids_corner", "vinyl_shelf",
      "toilet_f1", "changing_booth", "kitchen", "upgrade_balloon", "upgrade_trophy",
    ]) {
      expect(WORLD_MANIFEST.sprites[key]?.file).toMatch(/^\/assets\/world\//);
    }
  });
  it("computes cafe rewards, loyalty tiers, weekly club quest, and ruko upgrades from real activity", () => {
    const input = { handle: "rina", level: 12, totalXp: 2400, totalKm: 45, higroundStarts: 6, yogaTahapCleared: 1, eventCheckins: 2 };
    expect(loyaltyTierOf(input).name).toBe("Gold Pacer");
    expect(loyaltyTierOf(input).stamps).toBe(8);
    const vouchers = cafeVouchersFor(input);
    expect(vouchers.find((v) => v.key === "free_americano")?.unlocked).toBe(true);
    expect(vouchers.find((v) => v.key === "free_gelato")?.unlocked).toBe(true);
    expect(vouchers.find((v) => v.key === "burger_20")?.unlocked).toBe(true);
    expect(vouchers.find((v) => v.key === "runclub_tee")?.unlocked).toBe(false);
    expect(rukoUpgradeFor(220).tier).toBe(3);
    expect(rukoUpgradeFor(220).unlocks.mascotBalloon).toBe(true);
    expect(weeklyClubQuestFor(75, 48).pct).toBe(50);
  });
});
