import { currentMember, getStore, isDemo, syncIfStale, worldView } from "@/lib/data";
import { getProvider } from "@/lib/providers";
import { markOnline, onlineUserIds } from "@/lib/world/presence";
import { WorldClient } from "./WorldClient";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const me = await currentMember();
  const store = await getStore();
  const now = Date.now();
  if (me) {
    markOnline(me.id, now);
    // Keep runs fresh in background if last sync was > 15 min ago (non-blocking)
    void syncIfStale(store, getProvider(), me.id, now).catch(() => null);
  }
  const ids = isDemo() ? null : onlineUserIds(now);
  const w = await worldView(store, me, now, ids);
  return <WorldClient world={w} meHandle={me?.handle ?? null} />;
}
