import { redirect } from "next/navigation";
import { loadCrmState } from "@/lib/admin/crm-store";
import { verifyCoffeeToken, wibDateString } from "@/lib/coffee";
import { currentMember, getStore, memberStats, qrSecret } from "@/lib/data";
import { CoffeeCheckinClient } from "./CoffeeCheckinClient";

export const dynamic = "force-dynamic";

/**
 * Opened by scanning the Higround Daily / Table Coffee Check-in QR.
 * Never mutates on GET — user clicks the Check-in button (POST /api/coffee/checkin).
 */
export default async function CoffeeCheckinPage({
  searchParams,
}: {
  searchParams: Promise<{ t?: string }>;
}) {
  const { t = "" } = await searchParams;
  const me = await currentMember();
  if (!me) {
    redirect(`/login?next=${encodeURIComponent(`/coffee-checkin?t=${t}`)}`);
  }

  const now = Date.now();
  const tokenCheck = verifyCoffeeToken(qrSecret(), t, now);
  const todayWib = wibDateString(now);

  const [store, crm] = await Promise.all([getStore(), Promise.resolve(loadCrmState())]);
  const [stats, eventCheckins] = await Promise.all([
    memberStats(store, me.id),
    store.checkinsOf(me.id),
  ]);
  const myCoffeeCheckins = crm.coffeeCheckins.filter((c) => c.userId === me.id);
  const alreadyToday = myCoffeeCheckins.some((c) => c.dateWib === todayWib);
  const totalStamps = stats.higroundStarts + eventCheckins.length + myCoffeeCheckins.length;

  return (
    <CoffeeCheckinClient
      displayName={me.displayName}
      handle={me.handle}
      token={t}
      tokenValid={tokenCheck.ok}
      todayWib={todayWib}
      alreadyToday={alreadyToday}
      initialStamps={totalStamps}
    />
  );
}
