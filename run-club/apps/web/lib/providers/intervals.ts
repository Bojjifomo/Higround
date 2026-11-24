/**
 * Intervals.icu provider (SPEC §3). Facts below were checked against the forum thread
 * "Intervals.icu OAuth support" and the API docs, and against a working club app (HiGround v1):
 *
 *  - authorize:  https://intervals.icu/oauth/authorize?client_id&redirect_uri&scope&state[&code_challenge&code_challenge_method=S256]
 *  - token:      POST https://intervals.icu/api/oauth/token, form-encoded: client_id, code, code_verifier,
 *                and client_secret ONLY for a confidential client. A public client (tick "Public Client" on the
 *                app) with PKCE sends no secret. Answer: { access_token, token_type, scope, athlete: { id, name } }.
 *                Tokens do not expire and there is no refresh token; a 401/403 later means the member revoked us.
 *  - activities: GET /api/v1/athlete/0/activities?oldest=YYYY-MM-DD&newest=YYYY-MM-DDT23:59:59 (0 = the token's athlete)
 *  - revoke:     DELETE /api/v1/disconnect-app
 *  - webhooks:   POST { secret, events: [{ athlete_id, type, timestamp, payload }] }, the secret in the body.
 *  - Strava-sourced activities come back as stubs: { source: "STRAVA", _note: "...not available via the API" }.
 *  - Cloudflare in front of intervals.icu blocks some default library user agents.
 *
 * Not yet verified against a live account (TODO when credentials exist): the exact field carrying the start
 * coordinates on list results (`start_latlng` assumed; else the latlng stream), and the activity id's place
 * in webhook payloads (payload.id or payload.activity.id are both accepted).
 */
import { timingSafeEqual } from "node:crypto";
import type { Activity } from "../xp/types";
import {
  ProviderAuthError, ProviderError, type ActivityProvider, type TokenResult, type WebhookEvent,
} from "./types";

const AUTHORIZE_URL = "https://intervals.icu/oauth/authorize";
const TOKEN_URL = "https://intervals.icu/api/oauth/token";
const API = "https://intervals.icu/api/v1";
export const SCOPE = "ACTIVITY:READ";
const UA = "Mozilla/5.0 (compatible; HigroundRunClub/0.1)";

export interface IntervalsConfig {
  clientId: string;
  clientSecret?: string;      // empty = public client (PKCE only)
  redirectUri: string;
  webhookSecret?: string;
  fetchImpl?: typeof fetch;   // injectable for tests
  /** Offset assumed when an activity only has a local start time (the club is in WIB). */
  localOffset?: string;
}

/** Intervals.icu activity JSON → app Activity. Strava stubs and anything without a start give null. */
export function normalizeIntervals(raw: Record<string, unknown>, userId: string, localOffset = "+07:00"): Activity | null {
  if (!raw || raw.id == null) return null;
  const source = typeof raw.source === "string" ? raw.source.toUpperCase() : null;
  if (source === "STRAVA") return null;
  const startUtc = typeof raw.start_date === "string" ? raw.start_date : null;
  const startLocal = typeof raw.start_date_local === "string" ? raw.start_date_local : null;
  const startTime = startUtc ?? (startLocal ? `${startLocal.slice(0, 19)}${localOffset}` : null);
  if (!startTime) return null;
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const latlng = Array.isArray(raw.start_latlng) ? raw.start_latlng : null;
  const maxSpeed = num(raw.max_speed);
  return {
    id: String(raw.id),
    userId,
    type: String(raw.type ?? ""),
    source,
    deviceName: typeof raw.device_name === "string" && raw.device_name ? raw.device_name : null,
    startTime,
    distanceM: num(raw.distance) ?? 0,
    movingTimeS: num(raw.moving_time) ?? num(raw.elapsed_time) ?? 0,
    elevGainM: num(raw.total_elevation_gain) ?? 0,
    maxSpeedKmh: maxSpeed == null ? null : maxSpeed * 3.6,
    startLat: latlng && typeof latlng[0] === "number" ? latlng[0] : null,
    startLng: latlng && typeof latlng[1] === "number" ? latlng[1] : null,
  };
}

export function createIntervalsProvider(cfg: IntervalsConfig): ActivityProvider {
  const f = cfg.fetchImpl ?? fetch;

  async function call(url: string, init: RequestInit = {}): Promise<unknown> {
    const res = await f(url, { ...init, headers: { "User-Agent": UA, Accept: "application/json", ...(init.headers ?? {}) } });
    const text = await res.text();
    if (res.status === 401 || res.status === 403) throw new ProviderAuthError(`intervals.icu ${res.status}: ${text.slice(0, 200)}`);
    if (!res.ok) throw new ProviderError(`intervals.icu ${res.status}: ${text.slice(0, 200)}`, res.status);
    return text ? JSON.parse(text) : null;
  }

  return {
    name: "intervals",

    authorizeUrl(state, codeChallenge) {
      const q = new URLSearchParams({ client_id: cfg.clientId, redirect_uri: cfg.redirectUri, scope: SCOPE, state });
      if (codeChallenge) { q.set("code_challenge", codeChallenge); q.set("code_challenge_method", "S256"); }
      return `${AUTHORIZE_URL}?${q}`;
    },

    async exchangeCode(code, codeVerifier): Promise<TokenResult> {
      const form = new URLSearchParams({ client_id: cfg.clientId, code });
      if (cfg.clientSecret) form.set("client_secret", cfg.clientSecret);
      if (codeVerifier) form.set("code_verifier", codeVerifier);
      const out = (await call(TOKEN_URL, {
        method: "POST", body: form, headers: { "Content-Type": "application/x-www-form-urlencoded" },
      })) as { access_token?: string; scope?: string; athlete?: { id?: string | number; name?: string } } | null;
      if (!out?.access_token || out.athlete?.id == null) throw new ProviderError("intervals.icu token answer incomplete");
      return { accessToken: out.access_token, scope: out.scope ?? "", athleteId: String(out.athlete.id),
               athleteName: out.athlete.name ?? null };
    },

    async listActivities(token, userId, oldest, newest) {
      const q = new URLSearchParams({ oldest });
      if (newest) q.set("newest", `${newest}T23:59:59`);
      const rows = await call(`${API}/athlete/0/activities?${q}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!Array.isArray(rows)) return [];
      return rows.map((r) => normalizeIntervals(r as Record<string, unknown>, userId, cfg.localOffset))
        .filter((a): a is Activity => a !== null);
    },

    async disconnect(token) {
      try {
        await call(`${API}/disconnect-app`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      } catch (e) {
        if (!(e instanceof ProviderAuthError)) throw e;     // already revoked: nothing to do
      }
    },

    parseWebhook(body) {
      const b = body as { secret?: unknown; events?: unknown } | null;
      const expected = cfg.webhookSecret ?? "";
      const given = typeof b?.secret === "string" ? b.secret : "";
      if (!expected || given.length !== expected.length ||
          !timingSafeEqual(Buffer.from(given), Buffer.from(expected))) {
        throw new ProviderAuthError("webhook secret mismatch");
      }
      if (!Array.isArray(b?.events)) return [];
      return b.events.map((e: Record<string, unknown>) => {
        const p = (e.payload ?? {}) as Record<string, unknown>;
        const act = (p.activity ?? {}) as Record<string, unknown>;
        const id = p.id ?? act.id ?? null;
        return { athleteId: String(e.athlete_id ?? ""), type: String(e.type ?? ""),
                 activityId: id == null ? null : String(id), timestamp: typeof e.timestamp === "string" ? e.timestamp : null };
      });
    },
  };
}
