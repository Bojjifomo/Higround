import { describe, expect, it } from "vitest";
import type { StoredActivity } from "../data/store";
import {
  buildLast31DaysHeatmap,
  computeProfilePbs,
  detectRunBuddiesForMember,
  isWalkActivity,
} from "./index";

function act(over: Partial<StoredActivity>): StoredActivity {
  return {
    id: "a1",
    userId: "u1",
    type: "Run",
    name: "Morning Run",
    source: "GARMIN_CONNECT",
    deviceName: "Garmin 265",
    startTime: "2026-11-24T05:30:00+07:00",
    distanceM: 5100,
    movingTimeS: 1500,
    elevGainM: 12,
    maxSpeedKmh: 15,
    startLat: -6.1693,
    startLng: 106.9752,
    isHigroundStart: true,
    counted: true,
    flagged: false,
    flagReasons: [],
    reviewStatus: "none",
    ...over,
  };
}

describe("Walk recognition", () => {
  it("recognizes non-Strava Walk/Hike activities with positive distance", () => {
    expect(isWalkActivity(act({ type: "Walk", distanceM: 3200 }))).toBe(true);
    expect(isWalkActivity(act({ type: "Hike", distanceM: 4500 }))).toBe(true);
    expect(isWalkActivity(act({ type: "Walk", source: "STRAVA", distanceM: 3200 }))).toBe(false);
    expect(isWalkActivity(act({ type: "Run", distanceM: 5000 }))).toBe(false);
  });
});

describe("6 Personal Best (PB) badges: 1K, 5K, 10K, 21K, 42K, 50K", () => {
  it("computes PBs across all 6 distances including 1K fallback and 50K ultra", () => {
    const runs = [
      act({ id: "r5", distanceM: 5050, movingTimeS: 1450 }),
      act({ id: "r10", distanceM: 10100, movingTimeS: 3100 }),
      act({ id: "r21", distanceM: 21200, movingTimeS: 6900 }),
      act({ id: "r42", distanceM: 42300, movingTimeS: 14800 }),
      act({ id: "r50", distanceM: 50500, movingTimeS: 19200 }),
    ];
    const pbs = computeProfilePbs(runs);
    expect(pbs["1k"]?.timeS).toBe(Math.round(1450 / 5.05));
    expect(pbs["5k"]?.timeS).toBe(1450);
    expect(pbs["10k"]?.timeS).toBe(3100);
    expect(pbs.half?.timeS).toBe(6900);
    expect(pbs.full?.timeS).toBe(14800);
    expect(pbs["50k"]?.timeS).toBe(19200);
  });
});

describe("31-day heatmap", () => {
  it("builds exactly 31 calendar days combining run and walk distances", () => {
    const now = Date.parse("2026-11-27T10:00:00+07:00");
    const runs = [act({ startTime: "2026-11-27T06:00:00+07:00", distanceM: 6000 })];
    const walks = [act({ id: "w1", type: "Walk", startTime: "2026-11-26T17:00:00+07:00", distanceM: 3500 })];
    const days = buildLast31DaysHeatmap(runs, walks, now);
    expect(days).toHaveLength(31);
    expect(days[0].day).toBe("2026-10-28");
    expect(days[30]).toMatchObject({ day: "2026-11-27", runKm: 6, walkKm: 0, totalKm: 6 });
    expect(days[29]).toMatchObject({ day: "2026-11-26", runKm: 0, walkKm: 3.5, totalKm: 3.5 });
  });
});

describe("Run Buddy / Group Run detector", () => {
  const avatar = { skin: "#F6CFA8", hair: "#1F1A18", top: "#FF5F0E", bottom: "#222228", shoes: "#FFFDF7" };

  it("matches public members starting within 15 minutes and 250m without exposing GPS", () => {
    const mine = [
      act({ id: "my-slr", userId: "u1", startTime: "2026-11-22T05:30:00+07:00", startLat: -6.1693, startLng: 106.9752 }),
    ];
    const bundles = [
      {
        member: { id: "u2", handle: "rina", displayName: "Rina Lestari", avatar, isPublic: true },
        activities: [
          act({ id: "r1", userId: "u2", startTime: "2026-11-22T05:38:00+07:00", startLat: -6.1695, startLng: 106.9754 }),
        ],
      },
      {
        // Too far away (~2km)
        member: { id: "u3", handle: "far", displayName: "Far Runner", avatar, isPublic: true },
        activities: [
          act({ id: "r2", userId: "u3", startTime: "2026-11-22T05:32:00+07:00", startLat: -6.19, startLng: 106.99 }),
        ],
      },
      {
        // Too late (40 min diff)
        member: { id: "u4", handle: "late", displayName: "Late Runner", avatar, isPublic: true },
        activities: [
          act({ id: "r3", userId: "u4", startTime: "2026-11-22T06:10:00+07:00", startLat: -6.1693, startLng: 106.9752 }),
        ],
      },
      {
        // Private profile must NOT be disclosed as buddy
        member: { id: "u5", handle: "priv", displayName: "Private Runner", avatar, isPublic: false },
        activities: [
          act({ id: "r4", userId: "u5", startTime: "2026-11-22T05:31:00+07:00", startLat: -6.1693, startLng: 106.9752 }),
        ],
      },
    ];

    const map = detectRunBuddiesForMember("u1", mine, bundles);
    const buddies = map.get("my-slr") ?? [];
    expect(buddies).toHaveLength(1);
    expect(buddies[0]).toMatchObject({ userId: "u2", handle: "rina", displayName: "Rina Lestari", atHiground: true });
    expect("startLat" in buddies[0]).toBe(false);
    expect("startLng" in buddies[0]).toBe(false);
  });
});
