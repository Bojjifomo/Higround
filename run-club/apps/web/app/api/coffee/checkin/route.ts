import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { COFFEE_CHECKIN_XP, verifyCoffeeToken } from "@/lib/coffee";
import { currentMember, getStore, qrSecret } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * POST /api/coffee/checkin
 * Daily Coffee Check-in QR endpoint for regular Higround coffee customers & runners.
 * Enforces max 1 check-in per member per WIB day, awards +1 Brew Stamp and +25 XP in ledger.
 */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Masuk dulu sebelum check-in ngopi." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { token?: string };
  const token = String(body.token ?? "").trim();
  const now = Date.now();
  const verified = verifyCoffeeToken(qrSecret(), token, now);
  if (!verified.ok) {
    return NextResponse.json(
      { ok: false, error: "QR Check-in Ngopi tidak valid atau sudah kedaluwarsa. Scan ulang QR di kasir ya!" },
      { status: 400 },
    );
  }

  const crm = loadCrmState();
  const existingToday = crm.coffeeCheckins.find(
    (c) => c.userId === me.id && c.dateWib === verified.dateWib,
  );
  if (existingToday) {
    const myCount = crm.coffeeCheckins.filter((c) => c.userId === me.id).length;
    return NextResponse.json(
      {
        ok: false,
        alreadyCheckedIn: true,
        dateWib: verified.dateWib,
        coffeeCheckins: myCount,
        error: `Kamu sudah check-in ngopi hari ini (${verified.dateWib}). Sampai ketemu besok buat +1 Brew Stamp lagi! ☕`,
      },
      { status: 409 },
    );
  }

  const store = await getStore();
  await store.addLedger(
    [
      {
        userId: me.id,
        amount: COFFEE_CHECKIN_XP,
        ruleKey: "coffee_checkin",
        sourceType: "adjustment",
        sourceId: verified.dateWib,
        idempotencyKey: `coffee-checkin:${me.id}:${verified.dateWib}`,
      },
    ],
    now,
  );

  const record = {
    id: `cof-${now}-${Math.random().toString(36).slice(2, 7)}`,
    userId: me.id,
    handle: me.handle,
    displayName: me.displayName,
    dateWib: verified.dateWib,
    checkedInAt: new Date(now).toISOString(),
    xpAwarded: COFFEE_CHECKIN_XP,
  };
  crm.coffeeCheckins = [record, ...crm.coffeeCheckins].slice(0, 500);
  saveCrmState(crm);

  const myCount = crm.coffeeCheckins.filter((c) => c.userId === me.id).length;
  return NextResponse.json({
    ok: true,
    record,
    coffeeCheckins: myCount,
    xpAwarded: COFFEE_CHECKIN_XP,
  });
}
