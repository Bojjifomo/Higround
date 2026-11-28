import { NextResponse } from "next/server";
import { askRunningCoach, buildCoachSummary } from "@/lib/ai/coach";
import { currentMember, getStore, profileView } from "@/lib/data";

export const dynamic = "force-dynamic";

/** POST /api/coach — Personalized Running Coach for the signed-in member's profile dashboard. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Masuk dulu untuk pakai AI Running Coach." }, { status: 401 });
  }
  let body: { question?: unknown } = {};
  try {
    body = (await req.json()) as { question?: unknown };
  } catch {
    body = {};
  }
  const question = typeof body.question === "string" ? body.question.slice(0, 240) : "";
  const p = await profileView(await getStore(), me.handle, me, Date.now());
  if (!p || !p.run) {
    return NextResponse.json({ ok: false, error: "Data profil tidak ditemukan." }, { status: 404 });
  }
  const summary = buildCoachSummary(p.member.displayName, p.level.level, p.run);
  const res = await askRunningCoach(summary, question);
  return NextResponse.json(res);
}
