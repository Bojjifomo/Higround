import { describe, expect, it } from "vitest";
import {
  checkClaim, checkFlow, defaultConfig as C, findMission, missionStars, progress, starsForSeconds,
  xpForStars, yogaBadges, yogaXpEntries, type ClaimInput, type SideBests, type Stars,
} from "./index";

const m = (key: string) => findMission(key)!.mission;
const t = (key: string) => findMission(key)!.tahap;

/** Bests where every mission of the given tahap levels has `stars` on every side it needs. */
function allAt(levels: number[], stars: Stars): Record<string, SideBests> {
  const out: Record<string, SideBests> = {};
  for (const tahap of C.levels.filter((x) => levels.includes(x.level))) {
    for (const mi of tahap.missions) out[mi.key] = mi.per_side ? { left: stars, right: stars } : { both: stars };
  }
  return out;
}

describe("config matches the PDF", () => {
  it("has 5 tahap and 28 missions, 1,650 XP at 2★ everywhere", () => {
    expect(C.levels).toHaveLength(5);
    expect(C.levels.flatMap((l) => l.missions)).toHaveLength(28);
    const total = C.levels.reduce((s, l) => s + l.missions.reduce((a) => a + xpForStars(l, 2), 0), 0);
    expect(total).toBe(1650);
  });
  it("star thresholds are 50/100/150% of target, half rounded up", () => {
    for (const mi of C.levels.flatMap((l) => l.missions)) {
      expect(mi.stars_s).toEqual([Math.round(mi.target_s * 0.5 + 1e-9), mi.target_s, Math.round(mi.target_s * 1.5 + 1e-9)]);
    }
  });
  it("every safety-first pose has form cues filled in", () => {
    for (const mi of C.levels.flatMap((l) => l.missions).filter((x) => x.safety_form_first)) {
      expect(mi.form_cues!.length).toBeGreaterThanOrEqual(2);
      expect(mi.form_cues!.join(" ")).not.toMatch(/TODO/);
    }
  });
});

describe("stars", () => {
  it("counts thresholds held", () => {
    const child = m("child");                                   // 23 / 45 / 68
    expect([22, 23, 44, 45, 67, 68, 500].map((s) => starsForSeconds(child, s))).toEqual([0, 1, 1, 2, 2, 3, 3]);
  });
  it("a per-side mission takes the weaker side", () => {
    expect(missionStars(m("tree"), { left: 3, right: 1 })).toBe(1);
    expect(missionStars(m("tree"), { left: 3 })).toBe(0);
    expect(missionStars(m("mountain"), { both: 2 })).toBe(2);
  });
});

describe("XP", () => {
  it("pays xp_per_mission × star ratio", () => {
    expect([1, 2, 3].map((s) => xpForStars(t("crow"), s as Stars))).toEqual([40, 80, 120]);
  });
  it("raising stars pays only the difference, once per star level", () => {
    const up = yogaXpEntries("u1", "crow", 1, 3);
    expect(up.map((e) => e.amount)).toEqual([40, 40]);
    expect(up.reduce((s, e) => s + e.amount, 0)).toBe(xpForStars(t("crow"), 3) - xpForStars(t("crow"), 1));
    expect(up.map((e) => e.idempotencyKey)).toEqual(["yoga:crow:2:u1", "yoga:crow:3:u1"]);
    expect(yogaXpEntries("u1", "crow", 2, 2)).toEqual([]);
    expect(yogaXpEntries("u1", "crow", 3, 1)).toEqual([]);
  });
});

describe("unlocks", () => {
  it("opens Tahap 1 only at the start", () => {
    expect(progress({}).tahap.map((x) => x.unlocked)).toEqual([true, false, false, false, false]);
  });
  it("opens the next tahap at 80% of missions on ≥2★ (4/5, 5/6, 6/7, 4/5)", () => {
    expect(progress({}).tahap.map((x) => x.needed)).toEqual([4, 5, 6, 4, 4]);
    const keys = C.levels[0].missions.map((x) => x.key);
    const three = Object.fromEntries(keys.slice(0, 3).map((k) => [k, { both: 2 as Stars }]));
    const four = Object.fromEntries(keys.slice(0, 4).map((k) => [k, { both: 2 as Stars }]));
    expect(progress(three).tahap[1].unlocked).toBe(false);
    expect(progress(four).tahap[1].unlocked).toBe(true);
  });
  it("needs both sides at ≥2★ for per-side missions", () => {
    const bests = { ...allAt([1], 2), ...allAt([2], 2), tree: { left: 3, right: 1 } as SideBests,
                    triangle: { left: 2 } as SideBests };
    expect(progress(bests).tahap[1].missionsAt2).toBe(4);
    expect(progress(bests).tahap[2].unlocked).toBe(false);
  });
  it("a later tahap never opens while an earlier one is closed", () => {
    expect(progress(allAt([2, 3], 3)).tahap.map((x) => x.unlocked)).toEqual([true, false, false, false, false]);
  });
  it("flow challenge opens after Tahap 2 is cleared", () => {
    expect(progress(allAt([1], 2)).flowUnlocked).toBe(false);
    expect(progress(allAt([1, 2], 2)).flowUnlocked).toBe(true);
  });
});

describe("badges", () => {
  it("awards clear, perfect, flow and pose badges", () => {
    const bests = { ...allAt([1], 3), ...allAt([2], 2), crow: { both: 2 } as SideBests };
    const b = yogaBadges(progress(bests), bests, true);
    expect(b).toEqual(expect.arrayContaining(["yoga_clear_1", "yoga_perfect_1", "yoga_clear_2", "yoga_flow_master", "yoga_pose_crow"]));
    expect(b).not.toContain("yoga_perfect_2");
    expect(b).not.toContain("yoga_clear_3");
  });
});

describe("claims (honor system, server-timed)", () => {
  const T0 = Date.parse("2026-11-24T06:00:00+07:00");
  const base = (over: Partial<ClaimInput> = {}): ClaimInput => ({
    missionKey: "mountain", side: "both", timerStartedAt: T0, now: T0 + 31_000, consentVersion: 1,
    formCuesAcknowledged: false, waGateEnabled: false, waVerified: false, bests: {}, claimsToday: 0,
    lastClaimForMissionSide: null, ...over,
  });
  it("measures the hold from server times", () => {
    expect(checkClaim(base())).toMatchObject({ ok: true, measuredS: 31, sideStars: 2, missionStarsAfter: 2 });
    expect(checkClaim(base({ now: T0 + 10_000 }))).toMatchObject({ ok: false, error: "too_short" });
  });
  it("needs the consent, and the WA group only when the flag is on", () => {
    expect(checkClaim(base({ consentVersion: null }))).toMatchObject({ error: "consent" });
    expect(checkClaim(base({ waGateEnabled: true }))).toMatchObject({ error: "wa_gate" });
    expect(checkClaim(base({ waGateEnabled: true, waVerified: true })).ok).toBe(true);
  });
  it("refuses locked tahap and safety poses without the form cues", () => {
    expect(checkClaim(base({ missionKey: "crow" }))).toMatchObject({ error: "locked" });
    const open = allAt([1, 2, 3], 2);
    expect(checkClaim(base({ missionKey: "wheel", bests: open, now: T0 + 16_000 }))).toMatchObject({ error: "form_cues" });
    expect(checkClaim(base({ missionKey: "wheel", bests: open, now: T0 + 16_000, formCuesAcknowledged: true })).ok).toBe(true);
  });
  it("needs a side for per-side missions and none otherwise", () => {
    const open = allAt([1], 2);
    expect(checkClaim(base({ missionKey: "tree", bests: open }))).toMatchObject({ error: "wrong_side" });
    expect(checkClaim(base({ side: "left" }))).toMatchObject({ error: "wrong_side" });
    const left = checkClaim(base({ missionKey: "tree", side: "left", bests: open }));
    expect(left).toMatchObject({ ok: true, sideStars: 2, missionStarsAfter: 0 });          // right side still missing
    const right = checkClaim(base({ missionKey: "tree", side: "right", bests: { ...open, tree: { left: 2 } } }));
    expect(right).toMatchObject({ ok: true, missionStarsBefore: 0, missionStarsAfter: 2 });
  });
  it("enforces the 10-minute cooldown per mission side and 10 claims a day", () => {
    expect(checkClaim(base({ lastClaimForMissionSide: T0 + 31_000 - 60_000 }))).toMatchObject({ error: "cooldown", retryAfterS: 540 });
    expect(checkClaim(base({ lastClaimForMissionSide: T0 + 31_000 - 600_000 })).ok).toBe(true);
    expect(checkClaim(base({ claimsToday: 10 }))).toMatchObject({ error: "daily_limit" });
  });
  it("a weaker re-try never lowers stars", () => {
    const r = checkClaim(base({ bests: { mountain: { both: 3 } } }));
    expect(r).toMatchObject({ ok: true, sideStars: 2, missionStarsBefore: 3, missionStarsAfter: 3 });
  });
});

describe("flow challenge", () => {
  it("pays 60 XP for 75 s after Tahap 2", () => {
    const open = progress(allAt([1, 2], 2));
    expect(checkFlow(open, 0, 75_000)).toMatchObject({ ok: true, entry: { amount: 60 } });
    expect(checkFlow(open, 0, 70_000)).toMatchObject({ ok: false, error: "too_short" });
    expect(checkFlow(progress({}), 0, 75_000)).toMatchObject({ ok: false, error: "locked" });
  });
});
