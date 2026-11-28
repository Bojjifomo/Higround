import { NextResponse } from "next/server";
import { currentMember, getStore, syncEveryone } from "@/lib/data";
import { getProvider } from "@/lib/providers";

export const dynamic = "force-dynamic";

/** POST /api/admin/sync-all — Force-sync every member connected to Intervals.icu right now. */
export async function POST() {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }
  const result = await syncEveryone(await getStore(), getProvider(), Date.now());
  return NextResponse.json({ ok: true, synced: result.ok, failed: result.failed });
}
