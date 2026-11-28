import { NextResponse } from "next/server";
import { clearChatMessages, deleteChatMessage, listChatMessages } from "@/lib/chat/store";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** POST /api/admin/chat/moderate — Delete a single chat message or clear World Chat room. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }
  let body: { action?: unknown; id?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Format tidak valid." }, { status: 400 });
  }

  if (body.action === "clear") {
    const removed = clearChatMessages();
    return NextResponse.json({ ok: true, removed, messages: [] });
  }
  if (body.action === "delete" && typeof body.id === "string") {
    const deleted = deleteChatMessage(body.id);
    return NextResponse.json({ ok: true, deleted, messages: listChatMessages(0, 40) });
  }
  return NextResponse.json({ ok: false, error: "Aksi moderasi tidak dikenal." }, { status: 400 });
}
