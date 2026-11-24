import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { getStore, syncEveryone } from "@/lib/data";
import { getProvider } from "@/lib/providers";

/** Daily safety net (Vercel Cron sends `Authorization: Bearer $CRON_SECRET`): re-sync every connected member.
 *  It also pays last week's bonuses after Monday 00:00 WIB. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET ?? "";
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer /, "");
  if (!secret || given.length !== secret.length || !timingSafeEqual(Buffer.from(given), Buffer.from(secret))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json(await syncEveryone(await getStore(), getProvider(), Date.now()));
}
