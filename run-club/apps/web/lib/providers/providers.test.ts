import { describe, expect, it, vi } from "vitest";
import { eligibility, isHigroundStart, ledgerFor } from "../xp";
import { createIntervalsProvider, normalizeIntervals } from "./intervals";
import { createMockProvider, mockRawActivities } from "./intervals.mock";
import { getProvider, ProviderAuthError } from "./index";

const NOW = Date.parse("2026-11-24T09:00:00+07:00");

describe("getProvider", () => {
  it("falls back to the mock while credentials are missing", () => {
    expect(getProvider({}).name).toBe("intervals-mock");
    expect(getProvider({ INTERVALS_CLIENT_ID: "1999" }).name).toBe("intervals-mock");      // no redirect URI yet
    expect(getProvider({ INTERVALS_CLIENT_ID: "1999", INTERVALS_REDIRECT_URI: "https://x/cb" }).name).toBe("intervals");
  });
});

describe("normalizeIntervals", () => {
  it("maps Intervals fields and drops Strava stubs", () => {
    const a = normalizeIntervals({ id: 42, type: "Run", start_date: "2026-11-23T22:30:00Z", distance: 10000,
      moving_time: 3300, total_elevation_gain: 40, max_speed: 4.5, source: "GARMIN_CONNECT",
      device_name: "Forerunner 265", start_latlng: [-6.17, 106.97] }, "u1")!;
    expect(a).toMatchObject({ id: "42", startTime: "2026-11-23T22:30:00Z", distanceM: 10000, movingTimeS: 3300,
      elevGainM: 40, maxSpeedKmh: 16.2, startLat: -6.17, startLng: 106.97, deviceName: "Forerunner 265" });
    expect(normalizeIntervals({ id: 1, type: "Run", source: "STRAVA", start_date_local: "2026-11-23T05:00:00",
      _note: "STRAVA activities are not available via the API" }, "u1")).toBeNull();
  });
  it("assumes WIB when only a local start time is given", () => {
    expect(normalizeIntervals({ id: 1, type: "Run", start_date_local: "2026-11-23T05:30:00" }, "u1")!.startTime)
      .toBe("2026-11-23T05:30:00+07:00");
  });
});

describe("real provider (fetch stubbed)", () => {
  const ok = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

  it("builds the consent URL with PKCE", () => {
    const p = createIntervalsProvider({ clientId: "1999", redirectUri: "https://hg/cb" });
    const u = new URL(p.authorizeUrl("st", "chal"));
    expect(u.origin + u.pathname).toBe("https://intervals.icu/oauth/authorize");
    expect(Object.fromEntries(u.searchParams)).toEqual({ client_id: "1999", redirect_uri: "https://hg/cb",
      scope: "ACTIVITY:READ", state: "st", code_challenge: "chal", code_challenge_method: "S256" });
  });
  it("exchanges a code as a public client (no secret) or a confidential one", async () => {
    const fetchImpl = vi.fn(async () => ok({ access_token: "t", scope: "ACTIVITY:READ", athlete: { id: "i9", name: "Rina" } }));
    const pub = createIntervalsProvider({ clientId: "1999", redirectUri: "x", fetchImpl });
    expect(await pub.exchangeCode("c", "v")).toEqual({ accessToken: "t", scope: "ACTIVITY:READ", athleteId: "i9", athleteName: "Rina" });
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://intervals.icu/api/oauth/token");
    expect(Object.fromEntries(init.body as URLSearchParams)).toEqual({ client_id: "1999", code: "c", code_verifier: "v" });
    const conf = createIntervalsProvider({ clientId: "1999", clientSecret: "s", redirectUri: "x", fetchImpl });
    await conf.exchangeCode("c", "v");
    expect((fetchImpl.mock.calls[1] as unknown as [string, RequestInit])[1].body!.toString()).toContain("client_secret=s");
  });
  it("lists activities for the token's athlete and reports a revoked token", async () => {
    const fetchImpl = vi.fn(async () => ok([{ id: 1, type: "Run", start_date: "2026-11-23T22:30:00Z", distance: 5000,
      moving_time: 1650, device_name: "x" }, { id: 2, type: "Run", source: "STRAVA" }]));
    const p = createIntervalsProvider({ clientId: "1", redirectUri: "x", fetchImpl });
    const acts = await p.listActivities("tok", "u1", "2026-11-01", "2026-11-24");
    expect(acts.map((a) => a.id)).toEqual(["1"]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://intervals.icu/api/v1/athlete/0/activities?oldest=2026-11-01&newest=2026-11-24T23%3A59%3A59");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    const revoked = createIntervalsProvider({ clientId: "1", redirectUri: "x", fetchImpl: async () => ok({}, 401) });
    await expect(revoked.listActivities("tok", "u1", "2026-11-01")).rejects.toBeInstanceOf(ProviderAuthError);
  });
  it("accepts webhooks only with the shared secret", () => {
    const p = createIntervalsProvider({ clientId: "1", redirectUri: "x", webhookSecret: "s3cret" });
    const body = { secret: "s3cret", events: [{ athlete_id: "i9", type: "ACTIVITY_UPLOADED", timestamp: "t", payload: { id: 77 } }] };
    expect(p.parseWebhook(body)).toEqual([{ athleteId: "i9", type: "ACTIVITY_UPLOADED", activityId: "77", timestamp: "t" }]);
    expect(() => p.parseWebhook({ ...body, secret: "nope!!" })).toThrow(ProviderAuthError);
    expect(() => createIntervalsProvider({ clientId: "1", redirectUri: "x" }).parseWebhook(body)).toThrow(ProviderAuthError);
  });
});

describe("mock provider", () => {
  const mock = createMockProvider({ now: () => NOW });
  it("is deterministic per user and spans 12 weeks", async () => {
    const a = await mock.listActivities("t", "user-a", "2026-08-01");
    const b = await mock.listActivities("t", "user-a", "2026-08-01");
    expect(a).toEqual(b);
    expect(a.length).toBeGreaterThan(25);
    expect(mockRawActivities("user-a", NOW).some((r) => r.source === "STRAVA")).toBe(true);
    expect(a.some((x) => x.source === "STRAVA")).toBe(false);                      // stub dropped
  });
  it("feeds the XP pipeline: Higround starts, a flagged run, an uncounted ride", async () => {
    const acts = await mock.listActivities("t", "user-a", "2026-08-01");
    expect(acts.some((x) => isHigroundStart(x))).toBe(true);
    expect(acts.some((x) => eligibility(x).flagged)).toBe(true);
    expect(acts.some((x) => x.type === "Ride" && !eligibility(x).counted)).toBe(true);
    const ledger = ledgerFor("user-a", acts, "2026-11-23");
    expect(ledger.some((e) => e.ruleKey === "higround_start")).toBe(true);
    expect(ledger.some((e) => e.sourceType === "week")).toBe(true);
    expect(ledger.reduce((s, e) => s + e.amount, 0)).toBeGreaterThan(1000);
  });
  it("respects the date window", async () => {
    const recent = await mock.listActivities("t", "user-a", "2026-11-17", "2026-11-23");
    expect(recent.every((x) => x.startTime >= "2026-11-16")).toBe(true);
    expect(recent.length).toBeGreaterThan(0);
  });
  it("assigns distinct athleteIds per OAuth state so multiple members can connect in mock mode", async () => {
    const u1 = new URL(mock.authorizeUrl("state_user_one_123456"), "https://hg.test");
    const u2 = new URL(mock.authorizeUrl("state_user_two_789012"), "https://hg.test");
    const t1 = await mock.exchangeCode(u1.searchParams.get("code")!);
    const t2 = await mock.exchangeCode(u2.searchParams.get("code")!);
    expect(t1.athleteId).not.toBe(t2.athleteId);
  });
});
