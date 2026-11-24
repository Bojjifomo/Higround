import "server-only";
import { cookies } from "next/headers";
import { createClient } from "../supabase/server";
import { supabaseConfigured } from "../supabase/env";
import { seedDemo } from "./demo";
import { pgSql } from "./pg";
import { SqlStore } from "./sql-store";
import { MemoryStore, type Member, type Store } from "./store";

export * from "./store";
export * from "./service";
export * from "./events-service";
export * from "./intervals-service";

export const DEMO_COOKIE = "hg_demo_uid";

/**
 * "supabase": Supabase Auth for login and the Supabase Postgres (DATABASE_URL) for data.
 * "demo": no Supabase yet — an in-memory made-up club and a member picker instead of login.
 */
export function mode(): "demo" | "supabase" {
  return supabaseConfigured() && process.env.DATABASE_URL ? "supabase" : "demo";
}
export const isDemo = () => mode() === "demo";

const g = globalThis as unknown as { __hgStore?: Promise<Store> };

export function getStore(): Promise<Store> {
  g.__hgStore ??= (async () => {
    if (mode() === "supabase") return new SqlStore(pgSql());
    const s = new MemoryStore();
    await seedDemo(s, Date.now());
    return s;
  })();
  return g.__hgStore;
}

/** The signed-in Supabase user (may not have a profile yet), or null. Demo mode has no auth users. */
export async function authUser(): Promise<{ id: string; email: string | null } | null> {
  if (mode() !== "supabase") return null;
  const { data } = await (await createClient()).auth.getUser();
  return data.user ? { id: data.user.id, email: data.user.email ?? null } : null;
}

export async function currentMember(): Promise<Member | null> {
  if (mode() === "supabase") {
    const u = await authUser();
    return u ? (await getStore()).member(u.id) : null;
  }
  const id = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!id) return null;
  return (await getStore()).member(id);
}

const g2 = globalThis as unknown as { __hgQr?: string };

/** Secret for the rotating event QR codes. Set EVENT_QR_SECRET in production; the demo makes one per run. */
export function qrSecret(): string {
  const env = process.env.EVENT_QR_SECRET?.trim();
  if (env) return env;
  g2.__hgQr ??= globalThis.crypto.randomUUID();
  return g2.__hgQr;
}

export function flags() {
  return {
    waGateEnabled: process.env.YOGA_WA_GATE === "true",
    waGroupUrl: process.env.WA_GROUP_URL?.trim() || null,
  };
}

/** Role for a new profile: emails listed in ADMIN_EMAILS / INSTRUCTOR_EMAILS (comma-separated). */
export function roleForEmail(email: string | null): Member["role"] {
  const list = (k: string) => (process.env[k] ?? "").split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const e = (email ?? "").toLowerCase();
  if (e && list("ADMIN_EMAILS").includes(e)) return "admin";
  if (e && list("INSTRUCTOR_EMAILS").includes(e)) return "instructor";
  return "member";
}

/** Base URL for links we send out (magic link, OAuth redirect, QR). */
export function siteUrl(host: string | null, proto: string | null): string {
  return process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "") || `${proto ?? "http"}://${host ?? "localhost:3000"}`;
}
