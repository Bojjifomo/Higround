import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { postAdminBroadcast } from "@/lib/chat/store";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** POST /api/admin/broadcast — Send highlighted Admin announcement to /world Chat + optional pinned banner. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }
  let body: { text?: unknown; pinBanner?: unknown; clearBanner?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Format tidak valid." }, { status: 400 });
  }

  const state = loadCrmState();
  if (body.clearBanner === true) {
    state.announcement = null;
    saveCrmState(state);
    return NextResponse.json({ ok: true, announcement: null });
  }

  const text = typeof body.text === "string" ? body.text.replace(/\s+/g, " ").trim().slice(0, 200) : "";
  if (!text) {
    return NextResponse.json({ ok: false, error: "Isi teks pengumuman dulu." }, { status: 400 });
  }

  const now = Date.now();
  const msg = postAdminBroadcast({ userId: me.id, handle: me.handle, displayName: me.displayName }, text, now);

  if (body.pinBanner !== false) {
    state.announcement = {
      text,
      author: me.displayName,
      createdAt: new Date(now).toISOString(),
    };
    saveCrmState(state);
  }

  return NextResponse.json({ ok: true, message: msg, announcement: state.announcement });
}
