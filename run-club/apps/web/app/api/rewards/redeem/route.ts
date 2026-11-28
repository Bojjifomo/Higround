import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { currentMember, getStore, levelOf, memberStats } from "@/lib/data";
import { cafeVouchersFor } from "@/lib/rewards";

export const dynamic = "force-dynamic";

/**
 * POST /api/rewards/redeem
 * Persists kasir voucher redemption on the server after barista taps confirmation on the live voucher screen.
 */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Masuk dulu untuk klaim voucher." }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as { voucherKey?: string };
  const voucherKey = String(body.voucherKey ?? "").trim();
  if (!voucherKey) {
    return NextResponse.json({ ok: false, error: "Voucher tidak valid." }, { status: 400 });
  }

  const crm = loadCrmState();
  const already = crm.voucherRedemptions.find(
    (r) => r.userId === me.id && r.voucherKey === voucherKey,
  );
  if (already) {
    return NextResponse.json({
      ok: true,
      alreadyRedeemed: true,
      record: already,
    });
  }

  // Recompute voucher eligibility strictly on the server
  const store = await getStore();
  const [lvl, stats, checkins] = await Promise.all([
    levelOf(store, me.id),
    memberStats(store, me.id),
    store.checkinsOf(me.id),
  ]);
  const myCoffeeCount = crm.coffeeCheckins.filter((c) => c.userId === me.id).length;
  const vouchers = cafeVouchersFor({
    handle: me.handle,
    level: lvl.level,
    totalXp: lvl.totalXp,
    totalKm: stats.totalKm,
    higroundStarts: stats.higroundStarts,
    yogaTahapCleared: stats.yoga.tahap.filter((t) => t.cleared).length,
    eventCheckins: checkins.length,
    coffeeCheckins: myCoffeeCount,
  });

  const target = vouchers.find((v) => v.key === voucherKey);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Voucher tidak ditemukan." }, { status: 404 });
  }
  if (!target.unlocked) {
    return NextResponse.json({ ok: false, error: "Syarat voucher ini belum terpenuhi." }, { status: 403 });
  }

  const now = Date.now();
  const record = {
    id: `red-${now}-${Math.random().toString(36).slice(2, 7)}`,
    userId: me.id,
    handle: me.handle,
    displayName: me.displayName,
    voucherKey: target.key,
    voucherName: target.name,
    voucherCode: target.code,
    redeemedAt: new Date(now).toISOString(),
  };
  crm.voucherRedemptions = [record, ...crm.voucherRedemptions].slice(0, 500);
  saveCrmState(crm);

  return NextResponse.json({ ok: true, alreadyRedeemed: false, record });
}
