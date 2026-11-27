/**
 * Mock Intervals.icu provider: realistic raw activity JSON (in Intervals' own field names) run through the
 * same normalizer as the real one, so the whole XP / profile / world pipeline works without credentials.
 *
 * Twelve weeks of history per athlete, deterministic per user id: easy runs, Sunday long runs that start at
 * Higround, a treadmill session, a ride (not counted), a Strava stub (dropped) and one suspicious run (flagged).
 */
import xpRules from "../../../../config/xp_rules.json";
import type { Activity } from "../xp/types";
import { normalizeIntervals } from "./intervals";
import type { ActivityProvider } from "./types";

const HG = xpRules.higround_start;

/** Small deterministic PRNG (mulberry32) seeded from a string. */
function rng(seed: string) {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let a = h >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

/** Short stable tag from the whole user id, so activity ids never collide between members. */
function idTag(userId: string): string {
  let h = 2166136261;
  for (let i = 0; i < userId.length; i++) h = Math.imul(h ^ userId.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}
const wibDate = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 10);

/** Raw Intervals-shaped activities for one athlete over the 84 days before `now`. */
export function mockRawActivities(userId: string, now: number): Record<string, unknown>[] {
  const r = rng(userId);
  const tag = idTag(userId);
  const out: Record<string, unknown>[] = [];
  const pace = 300 + Math.floor(r() * 120);                     // 5:00–7:00 /km
  const device = ["Garmin Forerunner 265", "COROS PACE 3", "Polar Pacer Pro", "Suunto Race"][Math.floor(r() * 4)];
  const source = device.startsWith("Garmin") ? "GARMIN_CONNECT" : device.split(" ")[0].toUpperCase();
  let n = 0;
  for (let back = 84; back >= 0; back--) {                    // back = 0: this morning's run, once it has happened
    const ms = now - back * DAY;
    const day = wibDate(ms);
    const dow = new Date(day + "T00:00:00Z").getUTCDay();       // 0 = Sunday
    const longRun = dow === 0;
    if (!longRun && r() > 0.45) continue;
    const km = longRun ? 12 + r() * 9 : 4 + r() * 5;
    const atHg = longRun || r() < 0.15;
    const p = pace + (longRun ? 20 : 0) + Math.floor(r() * 20);
    const startIso = new Date(`${day}T${longRun ? "05:30" : "06:10"}:00+07:00`).toISOString();
    if (Date.parse(startIso) + km * p * 1000 > now) continue;
    const id = `i${tag}-${++n}`;
    out.push({
      id, type: "Run", name: longRun ? "Sunday Long Run @Higround" : "Easy Run",
      start_date: startIso,
      start_date_local: `${day}T${longRun ? "05:30" : "06:10"}:00`,
      distance: Math.round(km * 1000), moving_time: Math.round(km * p), elapsed_time: Math.round(km * p * 1.05),
      total_elevation_gain: Math.round(km * (2 + r() * 4)), max_speed: (1000 / p) * 1.35,                     // m/s, a little above average pace
      average_heartrate: 140 + Math.floor(r() * 20), source, device_name: device,
      start_latlng: atHg ? [HG.lat + (r() - 0.5) * 0.001, HG.lng + (r() - 0.5) * 0.001]
                         : [HG.lat + 0.01 + r() * 0.02, HG.lng + 0.01 + r() * 0.02],
    });
  }
  const extra = (back: number, a: Record<string, unknown>) => {
    const ms = now - back * DAY;
    out.push({ start_date_local: `${wibDate(ms)}T19:00:00`, start_date: new Date(`${wibDate(ms)}T19:00:00+07:00`).toISOString(),
               source, device_name: device, ...a });
  };
  extra(20, { id: `i${tag}-tm`, type: "VirtualRun", name: "Treadmill", distance: 6000, moving_time: 6 * pace,
              total_elevation_gain: 0, max_speed: 3.2 });
  extra(15, { id: `i${tag}-ride`, type: "Ride", name: "Gowes pagi", distance: 30000, moving_time: 4000 });
  extra(9, { id: `i${tag}-strava`, type: "Run", source: "STRAVA",
             _note: "STRAVA activities are not available via the API" });
  extra(4, { id: `i${tag}-sus`, type: "Run", name: "Lari (kayaknya naik motor)", distance: 21000,
             moving_time: 21 * 140, max_speed: 12.5, start_latlng: [HG.lat, HG.lng] });
  return out;
}

export function createMockProvider(opts: { now?: () => number; baseUrl?: string } = {}): ActivityProvider {
  const now = opts.now ?? Date.now;
  return {
    name: "intervals-mock",
    authorizeUrl(state) {
      const code = `mock-${state.slice(0, 16)}`;
      return `${opts.baseUrl ?? ""}/api/intervals/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    },
    async exchangeCode(code) {
      const clean = code.replace(/^mock-/, "") || "demo";
      return { accessToken: `mock-token-${clean}`, scope: "ACTIVITY:READ", athleteId: `mock-${clean}`, athleteName: "Mock Runner" };
    },
    async listActivities(_token, userId, oldest, newest) {
      return mockRawActivities(userId, now())
        .map((raw) => normalizeIntervals(raw, userId))
        .filter((a): a is Activity => a !== null)
        .filter((a) => {
          const d = wibDate(Date.parse(a.startTime));
          return d >= oldest && (!newest || d <= newest);
        });
    },
    async disconnect() {},
    parseWebhook(body) {
      const events = (body as { events?: Record<string, unknown>[] })?.events ?? [];
      return events.map((e) => ({ athleteId: String(e.athlete_id ?? ""), type: String(e.type ?? ""),
                                  activityId: e.activity_id == null ? null : String(e.activity_id), timestamp: null }));
    },
  };
}
