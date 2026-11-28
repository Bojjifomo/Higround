import { describe, expect, it, vi } from "vitest";
import { runView } from "../data/service";
import type { StoredActivity } from "../data/store";
import { askRunningCoach, buildCoachSummary } from "./coach";

const NOW = Date.parse("2026-11-27T09:00:00+07:00");

function sampleRun(over: Partial<StoredActivity>): StoredActivity {
  return {
    id: "r1",
    userId: "u1",
    type: "Run",
    name: "Morning Run",
    source: "GARMIN_CONNECT",
    deviceName: "Garmin 265",
    startTime: "2026-11-25T06:00:00+07:00",
    distanceM: 6000,
    movingTimeS: 1920,
    elevGainM: 12,
    maxSpeedKmh: 14,
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

describe("AI Running Coach", () => {
  const rv = runView([
    sampleRun({ id: "r1", distanceM: 5050, movingTimeS: 1550, startTime: "2026-11-26T06:00:00+07:00" }),
    sampleRun({ id: "r2", distanceM: 10200, movingTimeS: 3400, startTime: "2026-11-22T05:30:00+07:00" }),
  ], NOW);
  const summary = buildCoachSummary("Andreas", 5, rv);

  it("builds a privacy-safe summary without exposing GPS coordinates", () => {
    expect(summary.runs).toBe(2);
    expect(summary.weekKm).toBeGreaterThan(5);
    expect(JSON.stringify(summary)).not.toContain("-6.1693");
    expect(JSON.stringify(summary)).not.toContain("106.9752");
  });

  it("returns a helpful local preview gracefully when GEMINI_API_KEY is missing", async () => {
    const res = await askRunningCoach(summary, "Gimana progres lariku?", { apiKey: "" });
    expect(res.ok).toBe(true);
    expect(res.configured).toBe(false);
    expect(res.reply).toContain("Andreas");
    expect(res.reply).toContain("GEMINI_API_KEY");
  });

  it("calls Gemini REST API when GEMINI_API_KEY is provided", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify({
        candidates: [{ content: { parts: [{ text: "Mantap Andreas! Naikkan porsi easy run minggu depan." }] } }],
      }), { status: 200 }),
    );
    const res = await askRunningCoach(summary, "Target 5K sub-25", { apiKey: "AIza-test", fetchImpl });
    expect(res.configured).toBe(true);
    expect(res.reply).toContain("Mantap Andreas");
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
