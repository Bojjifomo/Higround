import { currentMember, getStore, worldView } from "@/lib/data";
import { WorldClient } from "./WorldClient";

export const dynamic = "force-dynamic";

export default async function WorldPage() {
  const me = await currentMember();
  const w = await worldView(await getStore(), me, Date.now());
  return <WorldClient members={w.members} hud={w.hud} ticker={w.ticker} meHandle={me?.handle ?? null} />;
}
