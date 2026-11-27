import { currentMember, getStore, isDemo, worldView } from "@/lib/data";
import { markOnline, onlineUserIds } from "@/lib/world/presence";
import { WorldClient } from "./WorldClient";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const me = await currentMember();
  const now = Date.now();
  if (me) markOnline(me.id, now);
  const ids = isDemo() ? null : onlineUserIds(now);
  const w = await worldView(await getStore(), me, now, ids);
  return <WorldClient world={w} meHandle={me?.handle ?? null} />;
}
