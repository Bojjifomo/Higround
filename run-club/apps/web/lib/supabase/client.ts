"use client";
import { createBrowserClient } from "@supabase/ssr";
import { supabaseEnv } from "./env";

/** Browser client: acts as the signed-in member, so RLS applies. */
export function createClient() {
  const { url, anonKey } = supabaseEnv();
  return createBrowserClient(url, anonKey);
}
