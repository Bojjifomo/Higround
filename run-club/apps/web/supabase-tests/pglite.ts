/**
 * A fresh in-process Postgres (PGlite) with a minimal stand-in for what Supabase provides (auth schema,
 * auth.uid(), the anon / authenticated / service_role roles) and every migration applied.
 */
import { PGlite } from "@electric-sql/pglite";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Sql } from "../lib/data/sql-store";

const MIGRATIONS = join(__dirname, "../../../supabase/migrations");

export const SUPABASE_STUB = `
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
  -- Supabase Vault stand-in (stores the secret in clear: tests only)
  create schema vault;
  create table vault.secrets (id uuid primary key default gen_random_uuid(), name text, description text, secret text);
  create view vault.decrypted_secrets as select id, name, description, secret as decrypted_secret from vault.secrets;
  create function vault.create_secret(new_secret text, new_name text default null, new_description text default '')
    returns uuid language sql as
    $$ insert into vault.secrets (name, description, secret) values (new_name, new_description, new_secret) returning id $$;
  create function vault.update_secret(secret_id uuid, new_secret text) returns void language sql as
    $$ update vault.secrets set secret = new_secret where id = secret_id $$;
`;

export async function freshDb(): Promise<PGlite> {
  const db = new PGlite();
  await db.exec(SUPABASE_STUB);
  for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith(".sql")).sort()) {
    await db.exec(readFileSync(join(MIGRATIONS, f), "utf8"));
  }
  return db;
}

export const asSql = (db: PGlite): Sql => ({
  query: async <T,>(text: string, params?: unknown[]) => (await db.query<T>(text, params)).rows,
});

/** Stable uuid for a demo handle. */
export function uuidFor(handle: string): string {
  let h = 0;
  for (const c of handle) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return `00000000-0000-4000-8000-${h.toString(16).padStart(12, "0")}`;
}
