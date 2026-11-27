/**
 * Store on Postgres (Supabase). Talks SQL through a tiny `Sql` interface, so production uses node-postgres
 * with DATABASE_URL and the tests use PGlite with the very same migrations. Server-side only: it connects
 * as a role that bypasses RLS, and every rule is enforced by lib/data/service.ts before anything is written.
 */
import type { Checkin, CheckinMethod, ClubEvent, EventKind } from "../events";
import type { LedgerEntry } from "../xp/types";
import type { Side, Stars } from "../yoga";
import type { Integration, Member, Store, StoredActivity, StoredLedgerEntry, YogaAttempt, YogaTimer } from "./store";

export interface Sql {
  query<T = Row>(text: string, params?: unknown[]): Promise<T[]>;
}
type Row = Record<string, unknown>;

const ms = (v: unknown): number => (v == null ? 0 : v instanceof Date ? v.getTime() : new Date(String(v)).getTime());
const iso = (v: unknown): string => new Date(ms(v)).toISOString();
const num = (v: unknown): number => Number(v);
const numOrNull = (v: unknown): number | null => (v == null ? null : Number(v));
const ts = (msOrIso: number | string) => new Date(msOrIso).toISOString();

// ── row mappers ───────────────────────────────────────────────────────────────

function toMember(r: Row): Member {
  return {
    id: String(r.id), handle: String(r.handle), displayName: String(r.display_name),
    avatar: r.avatar as Member["avatar"], isPublic: Boolean(r.is_dashboard_public), role: r.role as Member["role"],
    pinnedBadges: (r.pinned_badges as string[]) ?? [], waVerifiedAt: r.wa_verified_at ? iso(r.wa_verified_at) : null,
    yogaConsentVersion: numOrNull(r.yoga_consent_version), joinedAt: iso(r.created_at),
  };
}

function toActivity(r: Row): StoredActivity {
  return {
    id: String(r.provider_activity_id), userId: String(r.user_id), type: String(r.type),
    source: (r.source as string) ?? null, deviceName: (r.device_name as string) ?? null, startTime: iso(r.start_time),
    distanceM: num(r.distance_m), movingTimeS: num(r.moving_time_s), elevGainM: num(r.elev_gain_m),
    maxSpeedKmh: numOrNull(r.max_speed_kmh), startLat: numOrNull(r.start_lat), startLng: numOrNull(r.start_lng),
    bestEffortsS: (r.best_efforts as StoredActivity["bestEffortsS"]) ?? undefined,
    isHigroundStart: Boolean(r.is_higround_start), counted: Boolean(r.counted), flagged: Boolean(r.flagged),
    flagReasons: (r.flag_reason as string[]) ?? [], reviewStatus: r.review_status as StoredActivity["reviewStatus"],
    name: (r.name as string) ?? null,
  };
}

function toLedger(r: Row): StoredLedgerEntry {
  return {
    userId: String(r.user_id), amount: num(r.amount), ruleKey: String(r.rule_key),
    sourceType: r.source_type as LedgerEntry["sourceType"], sourceId: String(r.source_id),
    idempotencyKey: String(r.idempotency_key), createdAt: iso(r.created_at),
  };
}

function toTimer(r: Row): YogaTimer {
  return { id: String(r.id), userId: String(r.user_id), missionKey: String(r.mission_key), side: r.side as Side,
           formCuesAck: Boolean(r.form_cues_ack), startedAt: ms(r.started_at), claimedAt: r.claimed_at ? ms(r.claimed_at) : null };
}

function toAttempt(r: Row): YogaAttempt {
  return {
    id: String(r.id), userId: String(r.user_id), timerId: (r.timer_id as string) ?? null, missionKey: String(r.mission_key),
    side: r.side as Side, measuredS: num(r.measured_s), stars: num(r.stars) as Stars, mode: r.mode as YogaAttempt["mode"],
    status: r.status as YogaAttempt["status"], reviewerId: (r.reviewer_id as string) ?? null, reason: (r.reason as string) ?? null,
    createdAt: ms(r.created_at),
  };
}

function toEvent(r: Row): ClubEvent {
  return {
    id: String(r.id), template: String(r.template), name: String(r.name), kind: r.kind as EventKind,
    description: String(r.description), startsAt: ms(r.starts_at), endsAt: ms(r.ends_at), lat: num(r.lat), lng: num(r.lng),
    radiusM: num(r.radius_m), multiplier: num(r.multiplier), minKm: numOrNull(r.min_km), targetKm: numOrNull(r.target_km),
    checkin: (r.checkin as CheckinMethod[]) ?? [], bonusXp: num(r.bonus_xp), badgeRarity: String(r.badge_rarity),
  };
}

const toCheckin = (r: Row): Checkin => ({ eventId: String(r.event_id), userId: String(r.user_id),
                                          method: r.method as CheckinMethod, createdAt: ms(r.created_at) });

/** A value as Postgres text input; the SQL casts it to the column type. Keeps VALUES lists driver-neutral. */
function asText(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) {
    const quote = (x: unknown) => '"' + String(x).split("\\").join("\\\\").split('"').join('\\"') + '"';
    return "{" + v.map(quote).join(",") + "}";
  }
  return String(v);
}

/** Multi-row VALUES ($1, $2, …), (…) for a batch insert; every parameter goes as text. */
function values(rows: unknown[][]): { sql: string; params: unknown[] } {
  const params: unknown[] = [];
  const sql = rows.map((row) => `(${row.map((v) => { params.push(asText(v)); return `$${params.length}`; }).join(", ")})`).join(", ");
  return { sql, params };
}
const chunks = <T>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n));

// ── the store ─────────────────────────────────────────────────────────────────

const MEMBER_COLS: Record<string, string> = {
  handle: "handle", displayName: "display_name", avatar: "avatar", isPublic: "is_dashboard_public", role: "role",
  pinnedBadges: "pinned_badges", waVerifiedAt: "wa_verified_at", yogaConsentVersion: "yoga_consent_version",
};

export class SqlStore implements Store {
  constructor(private db: Sql) {}

  async addMember(m: Member) {
    await this.db.query(
      `insert into public.profiles (id, handle, display_name, avatar, pinned_badges, is_dashboard_public, wa_verified_at,
         yoga_consent_version, role, created_at)
       values ($1, $2, $3, $4::jsonb, $5::text[], $6, $7::timestamptz, $8, $9, $10::timestamptz)`,
      [m.id, m.handle, m.displayName, JSON.stringify(m.avatar), m.pinnedBadges, m.isPublic, m.waVerifiedAt,
       m.yogaConsentVersion, m.role, m.joinedAt]);
  }
  async deleteMember(id: string) {
    await this.removeRunData(id);                              // also drops the Vault secret
    await this.db.query("delete from public.profiles where id::text = $1", [id]);   // cascades to the rest
  }
  async members() { return (await this.db.query("select * from public.profiles order by created_at")).map(toMember); }
  async member(id: string) {
    return (await this.db.query("select * from public.profiles where id::text = $1", [id])).map(toMember)[0] ?? null;
  }
  async memberByHandle(h: string) {
    return (await this.db.query("select * from public.profiles where handle = $1", [h])).map(toMember)[0] ?? null;
  }
  async updateMember(id: string, patch: Partial<Member>) {
    const sets: string[] = [];
    const params: unknown[] = [id];
    for (const [k, v] of Object.entries(patch)) {
      const col = MEMBER_COLS[k];
      if (!col) continue;
      params.push(k === "avatar" ? JSON.stringify(v) : v);
      sets.push(`${col} = $${params.length}${k === "avatar" ? "::jsonb" : k === "waVerifiedAt" ? "::timestamptz" : ""}`);
    }
    if (sets.length) await this.db.query(`update public.profiles set ${sets.join(", ")} where id::text = $1`, params);
  }

  async upsertActivities(list: StoredActivity[]) {
    for (const batch of chunks(list, 150)) {
      const { sql, params } = values(batch.map((a) => [
        a.userId, a.id, a.source, a.deviceName, a.type, a.startTime, a.distanceM, Math.round(a.movingTimeS), a.elevGainM,
        a.distanceM > 0 && a.movingTimeS > 0 ? a.movingTimeS / (a.distanceM / 1000) : null, a.maxSpeedKmh, a.startLat, a.startLng,
        a.isHigroundStart, a.counted, a.flagged, a.flagReasons, a.reviewStatus, a.name,
        a.bestEffortsS ? JSON.stringify(a.bestEffortsS) : null,
      ]));
      await this.db.query(
        `insert into public.activities (user_id, provider_activity_id, source, device_name, type, start_time, distance_m,
           moving_time_s, elev_gain_m, avg_pace_s_per_km, max_speed_kmh, start_lat, start_lng, is_higround_start, counted,
           flagged, flag_reason, review_status, name, best_efforts)
         select v.c1::uuid, v.c2, v.c3, v.c4, v.c5, v.c6::timestamptz, v.c7::float8, v.c8::int, v.c9::float8, v.c10::float8,
                v.c11::float8, v.c12::float8, v.c13::float8, v.c14::bool, v.c15::bool, v.c16::bool, v.c17::text[], v.c18,
                v.c19, v.c20::jsonb
         from (values ${sql}) as v(c1, c2, c3, c4, c5, c6, c7, c8, c9, c10, c11, c12, c13, c14, c15, c16, c17, c18, c19, c20)
         on conflict (user_id, provider_activity_id) do update set
           source = excluded.source, device_name = excluded.device_name, type = excluded.type, start_time = excluded.start_time,
           distance_m = excluded.distance_m, moving_time_s = excluded.moving_time_s, elev_gain_m = excluded.elev_gain_m,
           avg_pace_s_per_km = excluded.avg_pace_s_per_km, max_speed_kmh = excluded.max_speed_kmh,
           start_lat = excluded.start_lat, start_lng = excluded.start_lng, is_higround_start = excluded.is_higround_start,
           counted = excluded.counted, flagged = excluded.flagged, flag_reason = excluded.flag_reason, name = excluded.name,
           best_efforts = excluded.best_efforts,
           review_status = case when activities.review_status in ('approved', 'rejected') then activities.review_status
                                else excluded.review_status end`, params);
    }
  }
  async activities(userId: string) {
    return (await this.db.query("select * from public.activities where user_id::text = $1", [userId])).map(toActivity);
  }
  async activity(userId: string, id: string) {
    return (await this.db.query("select * from public.activities where user_id::text = $1 and provider_activity_id = $2",
                                [userId, id])).map(toActivity)[0] ?? null;
  }
  async pendingActivities() {
    return (await this.db.query("select * from public.activities where review_status = 'pending'")).map(toActivity);
  }
  async updateActivity(userId: string, id: string, patch: Partial<StoredActivity>) {
    if (patch.reviewStatus) {
      await this.db.query("update public.activities set review_status = $3 where user_id::text = $1 and provider_activity_id = $2",
                          [userId, id, patch.reviewStatus]);
    }
  }

  async ledger(userId: string) {
    return (await this.db.query("select * from public.xp_ledger where user_id::text = $1 order by id", [userId])).map(toLedger);
  }
  async addLedger(entries: LedgerEntry[], at: number) {
    let n = 0;
    for (const batch of chunks(entries, 200)) {
      const { sql, params } = values(batch.map((e) => [e.userId, e.amount, e.ruleKey, e.sourceType, e.sourceId, e.idempotencyKey, ts(at)]));
      const rows = await this.db.query(
        `insert into public.xp_ledger (user_id, amount, rule_key, source_type, source_id, idempotency_key, created_at)
         select v.a::uuid, v.b::int, v.c, v.d, v.e, v.f, v.g::timestamptz from (values ${sql}) as v(a, b, c, d, e, f, g)
         on conflict (idempotency_key) do nothing returning id`, params);
      n += rows.length;
    }
    return n;
  }

  async addTimer(t: YogaTimer) {
    await this.db.query(
      `insert into public.yoga_timers (id, user_id, mission_key, side, form_cues_ack, started_at, claimed_at)
       values ($1::uuid, $2::uuid, $3, $4, $5, $6::timestamptz, $7::timestamptz)`,
      [t.id, t.userId, t.missionKey, t.side, t.formCuesAck, ts(t.startedAt), t.claimedAt ? ts(t.claimedAt) : null]);
  }
  async timer(id: string) {
    return (await this.db.query("select * from public.yoga_timers where id::text = $1", [id])).map(toTimer)[0] ?? null;
  }
  async updateTimer(id: string, patch: Partial<YogaTimer>) {
    if (patch.claimedAt !== undefined) {
      await this.db.query("update public.yoga_timers set claimed_at = $2::timestamptz where id::text = $1",
                          [id, patch.claimedAt ? ts(patch.claimedAt) : null]);
    }
  }

  async attempts(userId: string) {
    return (await this.db.query("select * from public.yoga_attempts where user_id::text = $1", [userId])).map(toAttempt);
  }
  async recentAttempts(limit: number) {
    return (await this.db.query("select * from public.yoga_attempts order by created_at desc limit $1", [limit])).map(toAttempt);
  }
  async attempt(id: string) {
    return (await this.db.query("select * from public.yoga_attempts where id::text = $1", [id])).map(toAttempt)[0] ?? null;
  }
  async addAttempt(a: YogaAttempt) {
    await this.db.query(
      `insert into public.yoga_attempts (id, user_id, timer_id, mission_key, side, measured_s, stars, mode, status, reviewer_id,
         reason, created_at)
       values ($1::uuid, $2::uuid, $3::uuid, $4, $5, $6, $7, $8, $9, $10::uuid, $11, $12::timestamptz)`,
      [a.id, a.userId, a.timerId, a.missionKey, a.side, a.measuredS, a.stars, a.mode, a.status, a.reviewerId, a.reason, ts(a.createdAt)]);
  }
  async updateAttempt(id: string, patch: Partial<YogaAttempt>) {
    await this.db.query(
      `update public.yoga_attempts set status = coalesce($2, status), reviewer_id = coalesce($3::uuid, reviewer_id),
         reason = coalesce($4, reason) where id::text = $1`,
      [id, patch.status ?? null, patch.reviewerId ?? null, patch.reason ?? null]);
  }

  // Tokens go to Supabase Vault: the table only keeps the secret's id.
  async saveIntegration(i: { userId: string; athleteId: string; scopes: string; token: string; at: number }) {
    const secretName = `intervals:${i.userId}`;
    const old = await this.db.query<{ access_token_secret_id: string | null }>(
      "select access_token_secret_id from public.integrations where user_id::text = $1 and provider = 'intervals'", [i.userId]);
    let secretId = old[0]?.access_token_secret_id ?? null;
    if (!secretId) {
      const existing = await this.db.query<{ id: string }>(
        "select id from vault.secrets where name = $1 limit 1", [secretName]);
      secretId = existing[0]?.id ?? null;
    }
    if (secretId) {
      await this.db.query("select vault.update_secret($1::uuid, $2)", [secretId, i.token]);
    } else {
      const [r] = await this.db.query<{ id: string }>("select vault.create_secret($1, $2, $3) as id",
                                                       [i.token, secretName, "Intervals.icu access token"]);
      secretId = r.id;
    }
    await this.db.query(
      `insert into public.integrations (user_id, provider, athlete_id, access_token_secret_id, scopes, connected_at, revoked_at, sync_error)
       values ($1::uuid, 'intervals', $2, $3::uuid, $4, $5::timestamptz, null, null)
       on conflict (user_id, provider) do update set athlete_id = excluded.athlete_id,
         access_token_secret_id = excluded.access_token_secret_id, scopes = excluded.scopes,
         connected_at = excluded.connected_at, revoked_at = null, sync_error = null`,
      [i.userId, i.athleteId, secretId, i.scopes, ts(i.at)]);
  }
  private async integrationsWhere(where: string, params: unknown[]): Promise<Integration[]> {
    const rows = await this.db.query(
      `select i.*, s.decrypted_secret as token from public.integrations i
       left join vault.decrypted_secrets s on s.id = i.access_token_secret_id
       where i.provider = 'intervals' and i.revoked_at is null ${where}`, params);
    return rows.map((r) => ({ userId: String(r.user_id), athleteId: String(r.athlete_id), scopes: String(r.scopes),
                              token: String(r.token ?? ""), connectedAt: ms(r.connected_at),
                              lastSyncedAt: r.last_synced_at ? ms(r.last_synced_at) : null, syncError: (r.sync_error as string) ?? null }));
  }
  async integration(userId: string) { return (await this.integrationsWhere("and i.user_id::text = $1", [userId]))[0] ?? null; }
  async integrationByAthlete(athleteId: string) {
    return (await this.integrationsWhere("and i.athlete_id = $1", [athleteId]))[0] ?? null;
  }
  async integrations() { return this.integrationsWhere("", []); }
  async markSynced(userId: string, at: number, error: string | null) {
    await this.db.query(
      `update public.integrations set sync_error = $3, last_synced_at = case when $3::text is null then $2::timestamptz else last_synced_at end
       where user_id::text = $1`, [userId, ts(at), error]);
  }
  async removeRunData(userId: string) {
    const ids = await this.db.query<{ access_token_secret_id: string | null }>(
      "select access_token_secret_id from public.integrations where user_id::text = $1", [userId]);
    await this.db.query("delete from public.integrations where user_id::text = $1", [userId]);
    for (const r of ids) if (r.access_token_secret_id) await this.db.query("delete from vault.secrets where id = $1::uuid", [r.access_token_secret_id]);
    await this.db.query("delete from public.activities where user_id::text = $1", [userId]);
    await this.db.query("delete from public.xp_ledger where user_id::text = $1 and source_type in ('activity', 'week', 'event')", [userId]);
  }

  async events() { return (await this.db.query("select * from public.events order by starts_at")).map(toEvent); }
  async event(id: string) { return (await this.db.query("select * from public.events where id = $1", [id])).map(toEvent)[0] ?? null; }
  async addEvent(e: ClubEvent) {
    await this.db.query(
      `insert into public.events (id, template, name, kind, description, starts_at, ends_at, lat, lng, radius_m, multiplier,
         min_km, target_km, checkin, bonus_xp, badge_rarity)
       values ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8, $9, $10, $11, $12, $13, $14::text[], $15, $16)`,
      [e.id, e.template, e.name, e.kind, e.description, ts(e.startsAt), ts(e.endsAt), e.lat, e.lng, e.radiusM, e.multiplier,
       e.minKm, e.targetKm, e.checkin, e.bonusXp, e.badgeRarity]);
  }
  async checkins(eventId: string) {
    return (await this.db.query("select * from public.event_checkins where event_id = $1", [eventId])).map(toCheckin);
  }
  async checkinsOf(userId: string) {
    return (await this.db.query("select * from public.event_checkins where user_id::text = $1", [userId])).map(toCheckin);
  }
  async addCheckin(c: Checkin) {
    const rows = await this.db.query(
      `insert into public.event_checkins (event_id, user_id, method, created_at) values ($1, $2::uuid, $3, $4::timestamptz)
       on conflict (event_id, user_id) do nothing returning event_id`, [c.eventId, c.userId, c.method, ts(c.createdAt)]);
    return rows.length > 0;
  }
}
