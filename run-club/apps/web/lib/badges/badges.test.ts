import { describe, expect, it } from "vitest";
import { defaultConfig as yoga } from "../yoga";
import { badgeXpEntries, catalogue, earnedBadges, unlockedCosmetics, type MemberStats } from "./index";

const none: MemberStats = { runCount: 0, totalKm: 0, longestRunKm: 0, higroundStarts: 0, bestStreakWeeks: 0, yogaBadgeKeys: new Set() };
const keys = (s: Partial<MemberStats>) => earnedBadges({ ...none, ...s }).map((b) => b.key);

describe("catalogue", () => {
  it("has unique keys and a badge for every yoga badge lib/yoga can award", () => {
    const all = catalogue.badges.map((b) => b.key);
    expect(new Set(all).size).toBe(all.length);
    const poseKeys = yoga.levels.filter((t) => t.level >= 4).flatMap((t) => t.missions.map((m) => `yoga_pose_${m.key}`));
    for (const k of ["yoga_clear_1", "yoga_clear_5", "yoga_perfect_5", "yoga_flow_master", ...poseKeys]) expect(all).toContain(k);
  });
});

describe("earning", () => {
  it("running and distance milestones", () => {
    expect(keys({})).toEqual([]);
    expect(keys({ runCount: 1, totalKm: 5, longestRunKm: 5 })).toEqual(["first_run"]);
    expect(keys({ runCount: 40, totalKm: 120, longestRunKm: 21.1 }))
      .toEqual(expect.arrayContaining(["total_50k", "total_100k", "first_10k", "half_marathon"]));
    expect(keys({ runCount: 40, totalKm: 120, longestRunKm: 21.1 })).not.toContain("marathon");
  });
  it("Higround starts and streaks", () => {
    expect(keys({ higroundStarts: 25 })).toEqual(expect.arrayContaining(["home_base", "regular"]));
    expect(keys({ higroundStarts: 25 })).not.toContain("local_legend");
    expect(keys({ bestStreakWeeks: 12 })).toEqual(expect.arrayContaining(["streak_4w", "streak_12w"]));
  });
  it("yoga badges come from lib/yoga", () => {
    expect(keys({ yogaBadgeKeys: new Set(["yoga_clear_1", "yoga_pose_crow"]) })).toEqual(["yoga_clear_1", "yoga_pose_crow"]);
  });
});

describe("rewards", () => {
  it("pays each badge's XP once", () => {
    const e = badgeXpEntries("u1", ["first_run", "first_run_typo", "home_base"]);
    expect(e.map((x) => [x.idempotencyKey, x.amount])).toEqual([["badge:first_run:u1", 20], ["badge:home_base:u1", 50]]);
  });
  it("unlocks the Run Club shirt at level 10 and the mascot hat with Local Legend", () => {
    expect(unlockedCosmetics(9, new Set())).toEqual([]);
    expect(unlockedCosmetics(10, new Set(["local_legend"])).map((c) => c.key)).toEqual(["shirt_runclub_orange", "hat_mascot"]);
  });
});
