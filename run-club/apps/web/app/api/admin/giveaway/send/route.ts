import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { buildMemberDirectory } from "@/lib/admin/directory";
import { currentMember } from "@/lib/data";
import { generateGiveawayCode, sendGiveawayWinnerEmail } from "@/lib/email/resend";

export const dynamic = "force-dynamic";

/** POST /api/admin/giveaway/send — Send Giveaway Free Drinks winner notification email via Resend. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }

  let body: { userId?: unknown; emailOverride?: unknown; prizeName?: unknown; note?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Format request tidak valid." }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId : "";
  const prizeName = typeof body.prizeName === "string" && body.prizeName.trim()
    ? body.prizeName.trim().slice(0, 100)
    : "Free Drink Pilihan Higround";
  const note = typeof body.note === "string" ? body.note.trim().slice(0, 240) : "";
  const emailOverride = typeof body.emailOverride === "string" ? body.emailOverride.trim() : "";

  const now = Date.now();
  const { rows } = await buildMemberDirectory(now);
  const winner = rows.find((r) => r.id === userId);
  if (!winner) {
    return NextResponse.json({ ok: false, error: "Member tidak ditemukan." }, { status: 404 });
  }

  const toEmail = emailOverride || winner.email || "";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(toEmail)) {
    return NextResponse.json(
      { ok: false, error: "Email pemenang tidak ditemukan. Isi kolom email manual sebelum kirim." },
      { status: 400 },
    );
  }

  const voucherCode = generateGiveawayCode(winner.handle, now);
  const sent = await sendGiveawayWinnerEmail({
    toEmail,
    recipientName: winner.displayName,
    prizeName,
    voucherCode,
    note: note || undefined,
  });

  // Always log giveaway draw & voucher code even if RESEND_API_KEY is not configured yet
  const state = loadCrmState();
  state.giveaways.unshift({
    id: `giv-${now}`,
    userId: winner.id,
    handle: winner.handle,
    displayName: winner.displayName,
    email: toEmail,
    prizeName,
    voucherCode,
    sentViaResend: sent.ok,
    sentAt: new Date(now).toISOString(),
  });
  state.giveaways = state.giveaways.slice(0, 50);
  saveCrmState(state);

  if (!sent.ok) {
    return NextResponse.json({
      ok: false,
      configured: sent.configured,
      voucherCode,
      error: sent.error,
    }, { status: sent.configured ? 502 : 200 });
  }

  return NextResponse.json({
    ok: true,
    id: sent.id,
    voucherCode,
    email: toEmail,
    winnerName: winner.displayName,
  });
}
