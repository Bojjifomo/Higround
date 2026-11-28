import { NextResponse } from "next/server";
import { currentMember, getStore, levelOf } from "@/lib/data";
import { listChatMessages, postChatMessage } from "@/lib/chat/store";

export const dynamic = "force-dynamic";

/** GET /api/world/chat?since=<ms> — fetch recent live MMORPG world chat messages. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const since = Number(url.searchParams.get("since") ?? "0") || 0;
  return NextResponse.json({
    ok: true,
    messages: listChatMessages(since, 40),
  });
}

/** POST /api/world/chat — post a profanity-filtered message into live world chat. */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me) {
    return NextResponse.json({ ok: false, error: "Masuk dulu untuk ikut chat di Higround." }, { status: 401 });
  }
  let body: { text?: unknown } = {};
  try {
    body = (await req.json()) as { text?: unknown };
  } catch {
    return NextResponse.json({ ok: false, error: "Format pesan tidak valid." }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text : "";
  const lvl = await levelOf(await getStore(), me.id);
  const res = postChatMessage(
    { userId: me.id, handle: me.handle, displayName: me.displayName, level: lvl.level },
    text,
    Date.now(),
  );
  if (!res.ok) {
    return NextResponse.json({ ok: false, error: res.error }, { status: res.status });
  }
  return NextResponse.json({ ok: true, message: res.message });
}
