/**
 * Applies every migration to an in-process Postgres (PGlite) with a minimal stand-in for what
 * Supabase provides (auth schema, auth.uid(), the anon / authenticated / service_role roles),
 * then checks the RLS rules from the member's side. No Docker, no Supabase project needed.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { levelFor } from "../lib/xp";

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");
const A = "00000000-0000-0000-0000-00000000000a";   // public member
const B = "00000000-0000-0000-0000-00000000000b";   // private member
const ADMIN = "00000000-0000-0000-0000-0000000000ad";

const SUPABASE_STUB = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key);
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

let db: PGlite;

/** Run `sql` as a signed-in member (or the service role when uid is null). */
async function as<T = Record<string, unknown>>(uid: string | null, sql: string, params: unknown[] = []) {
  await db.exec(`reset role; select set_config('request.jwt.claim.sub', '${uid ?? ""}', false);`);
  await db.exec(uid ? "set role authenticated" : "set role service_role");
  try {
    return (await db.query<T>(sql, params)).rows;
  } finally {
    await db.exec("reset role");
  }
}

beforeAll(async () => {
  db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  await db.exec(`
    insert into auth.users values ('${A}'), ('${B}'), ('${ADMIN}');
    insert into public.profiles (id, handle, display_name, is_dashboard_public, role) values
      ('${A}', 'rina', 'Rina', true, 'member'),
      ('${B}', 'budi', 'Budi', false, 'member'),
      ('${ADMIN}', 'owner', 'Owner', true, 'admin');
    insert into public.activities (user_id, provider_activity_id, type, start_time, distance_m, start_lat, start_lng, raw)
      values ('${A}', 'i1', 'Run', now(), 10000, -6.169, 106.975, '{"x":1}'),
             ('${B}', 'i2', 'Run', now(), 5000, -6.2, 106.9, '{}');
    insert into public.xp_ledger (user_id, amount, rule_key, source_type, source_id, idempotency_key)
      values ('${A}', 3240, 'distance', 'activity', 'i1', 'distance:i1');
    insert into public.integrations (user_id, provider, athlete_id, access_token_secret_id)
      values ('${A}', 'intervals', 'i123', gen_random_uuid());
  `);
});

afterAll(async () => { await db?.close(); });

describe("schema", () => {
  it("applies cleanly and has every table from SPEC §13.1", async () => {
    const rows = await db.query<{ table_name: string }>(
      "select table_name from information_schema.tables where table_schema = 'public' order by 1");
    expect(rows.rows.map((r) => r.table_name)).toEqual(expect.arrayContaining([
      "profiles", "integrations", "activities", "xp_ledger", "badges", "user_badges", "yoga_timers",
      "yoga_attempts", "yoga_progress", "events", "event_checkins", "cosmetics", "user_cosmetics", "v_user_level"]));
  });
  it("never pays the same idempotency key twice", async () => {
    await expect(db.query(`insert into public.xp_ledger (user_id, amount, rule_key, source_type, source_id, idempotency_key)
      values ('${A}', 10, 'distance', 'activity', 'i1', 'distance:i1')`)).rejects.toThrow(/duplicate key/);
  });
  it("v_user_level agrees with lib/xp", async () => {
    for (const xp of [0, 39, 40, 3239, 3240, 96040, 200000]) {
      await db.exec(`delete from public.xp_ledger where user_id = '${ADMIN}';`);
      if (xp) {
        await db.query(`insert into public.xp_ledger (user_id, amount, rule_key, source_type, source_id, idempotency_key)
          values ($1, $2, 'adjust', 'adjustment', 't', $3)`, [ADMIN, xp, `t:${xp}`]);
      }
      const [row] = (await db.query<{ level: number; title: string; xp_to_next: number | null }>(
        `select level, title, xp_to_next from public.v_user_level where user_id = $1`, [ADMIN])).rows;
      const want = levelFor(xp);
      expect([row.level, row.title, row.xp_to_next]).toEqual([want.level, want.title, want.xpToNext]);
    }
  });
});

describe("RLS from a member's side", () => {
  it("shows public profiles and your own, hides private ones", async () => {
    const seenByA = (await as<{ handle: string }>(A, "select handle from public.profiles order by 1")).map((r) => r.handle);
    expect(seenByA).toEqual(["owner", "rina"]);
    const seenByB = (await as<{ handle: string }>(B, "select handle from public.profiles order by 1")).map((r) => r.handle);
    expect(seenByB).toEqual(["budi", "owner", "rina"]);
    const seenByAdmin = await as(ADMIN, "select handle from public.profiles");
    expect(seenByAdmin).toHaveLength(3);
  });
  it("lets members edit their own profile but not their role or WA verification", async () => {
    await as(A, "update public.profiles set display_name = 'Rina K' where id = $1", [A]);
    expect((await as<{ display_name: string }>(null, "select display_name from public.profiles where id = $1", [A]))[0].display_name).toBe("Rina K");
    await expect(as(A, "update public.profiles set role = 'admin' where id = $1", [A])).rejects.toThrow(/permission denied/);
    await expect(as(A, "update public.profiles set wa_verified_at = now() where id = $1", [A])).rejects.toThrow(/permission denied/);
    await as(A, "update public.profiles set display_name = 'Hacked' where id = $1", [B]);
    expect((await as<{ display_name: string }>(null, "select display_name from public.profiles where id = $1", [B]))[0].display_name).toBe("Budi");
  });
  it("never shows start coordinates, raw payloads or token references to clients", async () => {
    await expect(as(A, "select start_lat from public.activities")).rejects.toThrow(/permission denied/);
    await expect(as(A, "select raw from public.activities")).rejects.toThrow(/permission denied/);
    await expect(as(A, "select access_token_secret_id from public.integrations")).rejects.toThrow(/permission denied/);
    expect(await as(A, "select athlete_id from public.integrations")).toEqual([{ athlete_id: "i123" }]);
    expect(await as(B, "select athlete_id from public.integrations")).toEqual([]);
  });
  it("hides a private member's runs and XP from others", async () => {
    expect((await as(A, "select provider_activity_id from public.activities")).length).toBe(1);   // own only
    expect((await as(B, "select provider_activity_id from public.activities order by 1")).length).toBe(2);
  });
  it("gives clients no way to write XP, activities or attempts", async () => {
    await expect(as(A, `insert into public.xp_ledger (user_id, amount, rule_key, source_type, source_id, idempotency_key)
      values ('${A}', 999, 'x', 'adjustment', 'x', 'cheat')`)).rejects.toThrow(/permission denied/);
    await expect(as(A, `insert into public.activities (user_id, provider_activity_id, type, start_time)
      values ('${A}', 'fake', 'Run', now())`)).rejects.toThrow(/permission denied/);
    await expect(as(A, `insert into public.yoga_attempts (user_id, mission_key, side, measured_s, stars)
      values ('${A}', 'mountain', 'both', 99, 3)`)).rejects.toThrow(/permission denied/);
  });
  it("starts yoga timers on the server's clock, for yourself only", async () => {
    const [t] = await as<{ started_at: Date; user_id: string }>(A,
      "insert into public.yoga_timers (mission_key, side) values ('mountain', 'both') returning started_at, user_id");
    expect(t.user_id).toBe(A);
    expect(Math.abs(Date.now() - new Date(t.started_at).getTime())).toBeLessThan(60_000);
    await expect(as(A, `insert into public.yoga_timers (mission_key, side, started_at)
      values ('mountain', 'both', now() - interval '1 hour')`)).rejects.toThrow(/permission denied/);
    expect(await as(B, "select id from public.yoga_timers")).toEqual([]);
  });
  it("lets only admins manage events", async () => {
    const ev = "insert into public.events (name, starts_at, ends_at) values ('Sunday Long Run', now(), now() + interval '3 hours')";
    await expect(as(A, ev)).rejects.toThrow(/row-level security/);
    await as(ADMIN, ev);
    expect(await as(A, "select name from public.events")).toEqual([{ name: "Sunday Long Run" }]);
  });
});
