import { NextResponse } from "next/server";
import { currentMember, getStore, isDemo, worldView } from "@/lib/data";
import { markOffline, markOnline, onlineUserIds } from "@/lib/world/presence";

export const dynamic = "force-dynamic";

/**
 * Heartbeat endpoint for live online presence in /world.
 * - POST /api/world/presence           → mark signed-in member online and return currently online WorldMembers
 * - POST /api/world/presence?offline=1 → mark signed-in member offline (used via navigator.sendBeacon on pagehide)
 */
export async function POST(req: Request) {
  const url = new URL(req.url);
  const me = await currentMember();
  const now = Date.now();

  if (url.searchParams.get("offline") === "1") {
    if (me) markOffline(me.id);
    return NextResponse.json({ ok: true });
  }

  if (me) markOnline(me.id, now);
  const ids = isDemo() ? null : onlineUserIds(now);
  const view = await worldView(await getStore(), me, now, ids);
  return NextResponse.json({
    ok: true,
    members: view.members,
  });
}
