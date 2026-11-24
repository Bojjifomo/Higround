/**
 * Optional: the service suite on a real PostgreSQL through node-postgres (the production driver).
 * Runs only when PG_TEST_URL points at a server where we may create databases, e.g.
 *   PG_TEST_URL=postgres://postgres@127.0.0.1:54329/postgres npm test
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";
import { afterAll, beforeAll, describe, it } from "vitest";
import { SUPABASE_STUB, uuidFor } from "../../supabase-tests/pglite";
import { PEOPLE } from "./demo";
import { serviceSuite } from "./service.suite";
import { SqlStore } from "./sql-store";

const URL_ = process.env.PG_TEST_URL;
const MIGRATIONS = join(__dirname, "../../../../supabase/migrations");
const withDb = (db: string) => { const u = new URL(URL_!); u.pathname = `/${db}`; return u.toString(); };

if (!URL_) {
  describe.skip("postgres store (node-postgres)", () => { it("needs PG_TEST_URL", () => {}); });
} else {
  let admin: Pool;
  beforeAll(async () => {
    admin = new Pool({ connectionString: URL_ });
    await admin.query("drop database if exists hg_tpl");
    await admin.query("create database hg_tpl");
    const tpl = new Pool({ connectionString: withDb("hg_tpl") });
    // roles are cluster-wide: create them only once
    const stub = SUPABASE_STUB.replace(/create role (\w+) nologin( bypassrls)?;/g,
      (_m, r, b) => `do $$ begin create role ${r} nologin${b ?? ""}; exception when duplicate_object then null; end $$;`);
    await tpl.query(stub);
    for (const f of readdirSync(MIGRATIONS).filter((x) => x.endsWith(".sql")).sort()) await tpl.query(readFileSync(join(MIGRATIONS, f), "utf8"));
    await tpl.end();
  }, 60_000);
  afterAll(async () => { await admin?.query("drop database if exists hg_tpl"); await admin?.end(); });

  serviceSuite("postgres store (node-postgres)", async () => {
    const name = `hg_t_${Math.random().toString(36).slice(2, 10)}`;
    await admin.query(`create database ${name} template hg_tpl`);
    const pool = new Pool({ connectionString: withDb(name), max: 3 });
    await pool.query("insert into auth.users (id) select unnest($1::uuid[])", [PEOPLE.map(([h]) => uuidFor(h))]);
    return {
      store: new SqlStore({ query: async (t, p) => (await pool.query(t, p)).rows }),
      idFor: uuidFor,
      close: async () => { await pool.end(); await admin.query(`drop database if exists ${name}`); },
    };
  });
}
