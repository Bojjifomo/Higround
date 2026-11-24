import "server-only";
import { Pool } from "pg";
import type { Sql } from "./sql-store";

const g = globalThis as unknown as { __hgPool?: Pool };

/**
 * Postgres pool for the Supabase database (DATABASE_URL, e.g. the Supavisor session pooler string).
 * TLS: with DATABASE_CA_CERT (Supabase dashboard → Database → SSL certificate) the server is verified;
 * without it the connection is encrypted but the certificate is not checked.
 */
export function pgSql(): Sql {
  if (!g.__hgPool) {
    const url = new URL(process.env.DATABASE_URL!);
    const noTls = url.searchParams.get("sslmode") === "disable";          // local Postgres for development
    url.searchParams.delete("sslmode");                                    // TLS is configured below, not by the URL
    const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, "\n");
    g.__hgPool = new Pool({ connectionString: url.toString(), max: 5,
                            ssl: noTls ? false : ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false } });
  }
  const pool = g.__hgPool;
  return { query: async <T,>(text: string, params?: unknown[]) => (await pool.query(text, params)).rows as T[] };
}
