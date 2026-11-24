import { describe, expect, it } from "vitest";
import type { Activity } from "../xp/types";
import {
  activityQualifies, completed, endOfMonthWib, eventXp, fromTemplate, HIGROUND, qrToken, status, verifyQr, windowKm,
} from "./index";

const SUN = Date.parse("2026-11-29T05:00:00+07:00");
const run = (over: Partial<Activity> = {}): Activity => ({
  id: "a1", userId: "u1", type: "Run", source: "GARMIN_CONNECT", deviceName: "x", startTime: "2026-11-29T05:30:00+07:00",
  distanceM: 12000, movingTimeS: 12 * 330, elevGainM: 0, maxSpeedKmh: 14, startLat: HIGROUND.lat, startLng: HIGROUND.lng, ...over,
});

describe("templates", () => {
  it("builds events from the config templates", () => {
    const e = fromTemplate("e1", "sunday_long_run", SUN);
    expect(e).toMatchObject({ name: "Sunday Long Run @Higround", multiplier: 2, minKm: 10, radiusM: 200 });
    expect(e.endsAt - e.startsAt).toBe(4 * 3_600_000);
    expect(fromTemplate("e2", "monthly_virtual", SUN).endsAt).toBe(Date.parse("2026-12-01T00:00:00+07:00"));
    expect(() => fromTemplate("e3", "nope", SUN)).toThrow();
  });
  it("ends a month at midnight WIB", () => {
    expect(endOfMonthWib(Date.parse("2026-12-31T20:00:00+07:00"))).toBe(Date.parse("2027-01-01T00:00:00+07:00"));
  });
  it("opens check-in 30 minutes early and closes at the end", () => {
    const e = fromTemplate("e1", "sunday_long_run", SUN);
    expect(status(e, SUN - 31 * 60_000)).toBe("upcoming");
    expect(status(e, SUN - 29 * 60_000)).toBe("open");
    expect(status(e, e.endsAt)).toBe("ended");
  });
});

describe("rotating QR", () => {
  const now = Date.parse("2026-11-29T06:00:30+07:00");
  it("accepts the current and the previous code only", () => {
    const tok = qrToken("s3cret", "e1", now);
    expect(verifyQr("s3cret", "e1", tok, now)).toBe(true);
    expect(verifyQr("s3cret", "e1", tok, now + 60_000)).toBe(true);
    expect(verifyQr("s3cret", "e1", tok, now + 120_000)).toBe(false);
    expect(verifyQr("s3cret", "e2", tok, now)).toBe(false);
    expect(verifyQr("other", "e1", tok, now)).toBe(false);
    expect(verifyQr("s3cret", "e1", "short", now)).toBe(false);
  });
});

describe("check-in from a run", () => {
  const e = fromTemplate("e1", "sunday_long_run", SUN);
  it("needs the window, the radius and the minimum distance", () => {
    expect(activityQualifies(e, run())).toBe(true);
    expect(activityQualifies(e, run({ distanceM: 9000 }))).toBe(false);
    expect(activityQualifies(e, run({ startLat: HIGROUND.lat + 0.01 }))).toBe(false);
    expect(activityQualifies(e, run({ startTime: "2026-11-28T05:30:00+07:00" }))).toBe(false);
    expect(activityQualifies(e, run({ type: "VirtualRun" }))).toBe(false);
  });
  it("counts runs from anywhere for a virtual challenge", () => {
    const v = fromTemplate("v", "monthly_virtual", Date.parse("2026-11-01T00:00:00+07:00"));
    const far = run({ startLat: 0, startLng: 0, distanceM: 30000 });
    expect(activityQualifies(v, far)).toBe(true);
    expect(windowKm(v, [far, run({ id: "a2", distanceM: 25000 })])).toBe(55);
    expect(completed(v, false, [far, run({ id: "a2", distanceM: 25000 })])).toBe(true);
    expect(completed(v, false, [far])).toBe(false);
  });
  it("QR-only events never check in from a run", () => {
    expect(activityQualifies(fromTemplate("b", "run_brew", SUN), run())).toBe(false);
  });
});

describe("event XP", () => {
  it("pays the multiplier on qualifying runs and the join bonus once", () => {
    const e = fromTemplate("e1", "sunday_long_run", SUN);
    expect(eventXp(e, "u1", true, [{ activityId: "a1", xp: 150 }]).map((x) => [x.idempotencyKey, x.amount]))
      .toEqual([["event_mult:e1:a1", 150]]);
    const brew = fromTemplate("b", "run_brew", SUN);
    expect(eventXp(brew, "u1", true, [])).toEqual([expect.objectContaining({ amount: 50, idempotencyKey: "event_join:b:u1" })]);
    expect(eventXp(brew, "u1", false, [])).toEqual([]);
  });
});
