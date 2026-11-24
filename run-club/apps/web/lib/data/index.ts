import "server-only";
import { cookies } from "next/headers";
import { supabaseConfigured } from "../supabase/env";
import { seedDemo } from "./demo";
import { MemoryStore, type Member, type Store } from "./store";

export * from "./store";
export * from "./service";

export const DEMO_COOKIE = "hg_demo_uid";

/** Demo mode = no Supabase yet. The Supabase store comes with the auth work (roadmap Fase 1). */
export function isDemo(): boolean {
  return !supabaseConfigured();
}

const g = globalThis as unknown as { __hgStore?: Promise<Store> };

export function getStore(): Promise<Store> {
  if (!isDemo()) {
    throw new Error("Supabase store not built yet: unset NEXT_PUBLIC_SUPABASE_URL to use the demo store");
  }
  g.__hgStore ??= (async () => {
    const s = new MemoryStore();
    await seedDemo(s, Date.now());
    return s;
  })();
  return g.__hgStore;
}

export async function currentMember(): Promise<Member | null> {
  const id = (await cookies()).get(DEMO_COOKIE)?.value;
  if (!id) return null;
  return (await getStore()).member(id);
}

export function flags() {
  return {
    waGateEnabled: process.env.YOGA_WA_GATE === "true",
    waGroupUrl: process.env.WA_GROUP_URL?.trim() || null,
  };
}
