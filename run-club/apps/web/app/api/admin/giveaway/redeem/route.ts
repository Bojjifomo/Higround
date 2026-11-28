import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** POST /api/admin/giveaway/redeem — Mark or unmark a Giveaway voucher code as redeemed at kasir. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }
  let body: { id?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Format tidak valid." }, { status: 400 });
  }
  const id = typeof body.id === "string" ? body.id : "";
  const state = loadCrmState();
  const target = state.giveaways.find((g) => g.id === id);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Voucher giveaway tidak ditemukan." }, { status: 404 });
  }
  target.redeemedAt = target.redeemedAt ? null : new Date().toISOString();
  saveCrmState(state);
  return NextResponse.json({ ok: true, id: target.id, redeemedAt: target.redeemedAt });
}
