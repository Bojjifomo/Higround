import { NextResponse } from "next/server";
import { getStore, handleWebhook } from "@/lib/data";
import { getProvider, ProviderAuthError } from "@/lib/providers";

/** Intervals.icu webhook (ACTIVITY_UPLOADED / UPDATED / DELETED): checks the shared secret, re-syncs the athlete. */
export async function POST(req: Request) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad json" }, { status: 400 }); }
  try {
    const n = await handleWebhook(await getStore(), getProvider(), body, Date.now());
    return NextResponse.json({ synced: n });
  } catch (e) {
    if (e instanceof ProviderAuthError) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    throw e;
  }
}
