import { describe, expect, it } from "vitest";
import {
  activityXp, defaultRules as R, eligibility, isHigroundStart, ledgerFor, levelFor, localDate,
  streakWeeks, weekKey, weeklyXp, xpForLevel, type Activity,
} from "./index";

const HG = { lat: R.higround_start.lat, lng: R.higround_start.lng };
let n = 0;
function run(over: Partial<Activity> = {}): Activity {
  n++;
  return {
    id: `a${n}`, userId: "u1", type: "Run", source: "GARMIN_CONNECT", deviceName: "Forerunner 265",
    startTime: "2026-11-23T05:30:00+07:00", distanceM: 5000, movingTimeS: 5000 * 0.33, elevGainM: 0,
    maxSpeedKmh: 14, startLat: null, startLng: null, ...over,
  };
}
const ctx = { higroundBonusesToday: 0, previousBests: {} };
const total = (es: { amount: number }[]) => es.reduce((s, e) => s + e.amount, 0);
const byRule = (es: { ruleKey: string; amount: number }[]) => Object.fromEntries(es.map((e) => [e.ruleKey, e.amount]));

describe("time in WIB", () => {
  it("dates and weeks follow Asia/Jakarta, Monday first", () => {
    expect(localDate("2026-11-22T18:30:00Z")).toBe("2026-11-23");      // 01:30 WIB Monday
    expect(weekKey("2026-11-22T16:59:00Z")).toBe("2026-11-16");        // 23:59 WIB Sunday
    expect(weekKey("2026-11-22T17:00:00Z")).toBe("2026-11-23");        // 00:00 WIB Monday
  });
});

describe("distance & elevation", () => {
  it("pays 10 XP per km in whole 0.1 km steps", () => {
    expect(byRule(activityXp(run({ distanceM: 5000 }), ctx)).distance).toBe(50);
    expect(byRule(activityXp(run({ distanceM: 5099 }), ctx)).distance).toBe(50);
    expect(byRule(activityXp(run({ distanceM: 5100 }), ctx)).distance).toBe(51);
  });
  it("pays 1 XP per 10 m climbed on Run and TrailRun only", () => {
    expect(byRule(activityXp(run({ elevGainM: 87 }), ctx)).elevation).toBe(8);
    expect(byRule(activityXp(run({ type: "TrailRun", elevGainM: 120 }), ctx)).elevation).toBe(12);
    expect(byRule(activityXp(run({ type: "VirtualRun", elevGainM: 120 }), ctx)).elevation).toBeUndefined();
  });
});

describe("long run", () => {
  it("pays only the highest tier reached", () => {
    const e = (km: number) => activityXp(run({ distanceM: km * 1000, movingTimeS: km * 330 }), ctx)
      .filter((x) => x.ruleKey.startsWith("long_run"));
    expect(e(9.9)).toEqual([]);
    expect(total(e(10))).toBe(30);
    expect(total(e(21.1))).toBe(100);
    expect(total(e(42.2))).toBe(300);
    expect(e(42.2)).toHaveLength(1);
  });
});

describe("Higround start bonus", () => {
  it("is within 200 m of the café", () => {
    expect(isHigroundStart(run({ startLat: HG.lat, startLng: HG.lng }))).toBe(true);
    expect(isHigroundStart(run({ startLat: HG.lat + 0.0017, startLng: HG.lng }))).toBe(true);   // ~189 m
    expect(isHigroundStart(run({ startLat: HG.lat + 0.0019, startLng: HG.lng }))).toBe(false);  // ~211 m
    expect(isHigroundStart(run({ startLat: null, startLng: null }))).toBe(false);
  });
  it("multiplies distance XP by 1.5 and adds 25, once a day, never on treadmill", () => {
    const at = { startLat: HG.lat, startLng: HG.lng, distanceM: 10000, movingTimeS: 3300 };
    const r = byRule(activityXp(run(at), ctx));
    expect(r.distance).toBe(150);
    expect(r.higround_start).toBe(25);
    const second = byRule(activityXp(run(at), { ...ctx, higroundBonusesToday: 1 }));
    expect(second.distance).toBe(100);
    expect(second.higround_start).toBeUndefined();
    expect(byRule(activityXp(run({ ...at, type: "VirtualRun" }), ctx)).higround_start).toBeUndefined();
  });
  it("ledgerFor pays the bonus to the first Higround start of each day only", () => {
    const a = run({ startLat: HG.lat, startLng: HG.lng, startTime: "2026-11-23T05:00:00+07:00" });
    const b = run({ startLat: HG.lat, startLng: HG.lng, startTime: "2026-11-23T18:00:00+07:00" });
    const c = run({ startLat: HG.lat, startLng: HG.lng, startTime: "2026-11-24T05:00:00+07:00" });
    const bonuses = ledgerFor("u1", [c, b, a], "2026-11-01").filter((e) => e.ruleKey === "higround_start");
    expect(bonuses.map((e) => e.sourceId)).toEqual([a.id, c.id]);
  });
});

describe("anti-cheat & eligibility", () => {
  it("ignores Strava stubs, non-runs and activities without a device", () => {
    expect(eligibility(run({ source: "STRAVA" })).counted).toBe(false);
    expect(eligibility(run({ type: "Ride" })).counted).toBe(false);
    expect(eligibility(run({ deviceName: null })).counted).toBe(false);
  });
  it("flags pace under 3:00/km, max speed over 25 km/h, and over 100 km, and holds their XP", () => {
    expect(eligibility(run({ movingTimeS: 5 * 170 })).reasons).toContain("pace_too_fast");
    expect(eligibility(run({ maxSpeedKmh: 31 })).reasons).toContain("max_speed");
    expect(eligibility(run({ distanceM: 101000, movingTimeS: 101 * 400 })).reasons).toContain("distance");
    expect(activityXp(run({ maxSpeedKmh: 31 }), ctx)).toEqual([]);
    expect(eligibility(run({ movingTimeS: 5 * 180 })).flagged).toBe(false);     // exactly 3:00 is fine
  });
});

describe("personal bests", () => {
  it("pays when an effort beats the previous best, not on the first effort", () => {
    const first = activityXp(run({ distanceM: 5000, movingTimeS: 1500 }), ctx);
    expect(byRule(first).pb_5k).toBeUndefined();
    const better = activityXp(run({ distanceM: 5000, movingTimeS: 1450 }), { ...ctx, previousBests: { "5k": 1500 } });
    expect(byRule(better).pb_5k).toBe(50);
    const slower = activityXp(run({ distanceM: 5000, movingTimeS: 1550 }), { ...ctx, previousBests: { "5k": 1500 } });
    expect(byRule(slower).pb_5k).toBeUndefined();
  });
  it("uses the provider's best efforts when present", () => {
    const a = run({ distanceM: 15000, movingTimeS: 15 * 330, bestEffortsS: { "10k": 3000 } });
    expect(byRule(activityXp(a, { ...ctx, previousBests: { "10k": 3100 } })).pb_10k).toBe(75);
  });
  it("ledgerFor tracks bests across the history", () => {
    const es = ledgerFor("u1", [
      run({ startTime: "2026-11-02T05:00:00+07:00", distanceM: 5000, movingTimeS: 1600 }),
      run({ startTime: "2026-11-09T05:00:00+07:00", distanceM: 5000, movingTimeS: 1550 }),
      run({ startTime: "2026-11-16T05:00:00+07:00", distanceM: 5000, movingTimeS: 1580 }),
    ], "2026-11-01");
    expect(es.filter((e) => e.ruleKey === "pb_5k")).toHaveLength(1);
  });
});

describe("weekly bonuses", () => {
  const week = "2026-11-16";
  const day = (d: number, km: number) => run({ startTime: `2026-11-${d}T05:30:00+07:00`, distanceM: km * 1000, movingTimeS: km * 330 });
  it("pays every mileage tier reached, cumulatively", () => {
    const r = byRule(weeklyXp("u1", week, [day(16, 12), day(18, 12), day(20, 8)], 1));
    expect([r.weekly_tier_10, r.weekly_tier_20, r.weekly_tier_30, r.weekly_tier_50]).toEqual([50, 100, 150, undefined]);
  });
  it("pays consistency for 3+ run days, counting days not runs", () => {
    expect(byRule(weeklyXp("u1", week, [day(16, 5), day(17, 5), day(18, 5)], 1)).consistency).toBe(40);
    expect(byRule(weeklyXp("u1", week, [day(16, 5), day(16, 5), day(18, 5)], 1)).consistency).toBeUndefined();
  });
  it("streak pays 10 × weeks, capped at 100", () => {
    expect(byRule(weeklyXp("u1", week, [day(16, 5)], 3)).streak).toBe(30);
    expect(byRule(weeklyXp("u1", week, [day(16, 5)], 14)).streak).toBe(100);
  });
  it("counts consecutive weeks with a run", () => {
    const acts = [run({ startTime: "2026-11-03T05:00:00+07:00" }), run({ startTime: "2026-11-10T05:00:00+07:00" }),
                  run({ startTime: "2026-11-18T05:00:00+07:00" })];
    expect(streakWeeks("2026-11-16", acts)).toBe(3);
    expect(streakWeeks("2026-11-23", acts)).toBe(0);
  });
  it("ledgerFor pays weekly bonuses only for finished weeks, with stable keys", () => {
    const acts = [day(16, 12), day(18, 12)];
    expect(ledgerFor("u1", acts, "2026-11-16").some((e) => e.sourceType === "week")).toBe(false);
    const done = ledgerFor("u1", acts, "2026-11-23").filter((e) => e.sourceType === "week");
    expect(done.map((e) => e.idempotencyKey)).toContain("weekly_tier_20:u1:2026-11-16");
    expect(new Set(done.map((e) => e.idempotencyKey)).size).toBe(done.length);
  });
});

describe("levels", () => {
  it("follows 40 × (n − 1)² with titles", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(40);
    expect(xpForLevel(10)).toBe(3240);
    expect(levelFor(39)).toMatchObject({ level: 1, title: "Rookie", xpToNext: 1 });
    expect(levelFor(40)).toMatchObject({ level: 2, xpIntoLevel: 0 });
    expect(levelFor(640).level).toBe(5);
    expect(levelFor(640).title).toBe("Jogger");
    expect(levelFor(3240).title).toBe("Pacer");
    expect(levelFor(xpForLevel(50))).toMatchObject({ level: 50, title: "Higround Legend", xpToNext: null });
    expect(levelFor(10_000_000).level).toBe(50);
  });
});

describe("idempotency", () => {
  it("recomputing the same history yields the same keys", () => {
    const acts = [run({ startTime: "2026-11-03T05:00:00+07:00", distanceM: 21100, movingTimeS: 21.1 * 330 })];
    const k1 = ledgerFor("u1", acts, "2026-11-30").map((e) => e.idempotencyKey);
    const k2 = ledgerFor("u1", acts, "2026-11-30").map((e) => e.idempotencyKey);
    expect(k1).toEqual(k2);
    expect(new Set(k1).size).toBe(k1.length);
  });
});
