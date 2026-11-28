import { NextResponse } from "next/server";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";

export const dynamic = "force-dynamic";

/**
 * POST /api/telemetry/error
 * Lightweight self-hosted client error collector so admins can spot iPhone Safari / JS issues in /admin.
 */
export async function POST(req: Request) {
  const body = (await req.json().catch(() => ({}))) as {
    message?: string;
    path?: string;
    ua?: string;
  };
  const message = String(body.message ?? "").replace(/\s+/g, " ").trim().slice(0, 260);
  if (!message) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const crm = loadCrmState();
  const entry = {
    id: `err-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    message,
    path: String(body.path ?? "/").slice(0, 120),
    ua: String(body.ua ?? "").slice(0, 120),
    at: new Date().toISOString(),
  };
  crm.clientErrors = [entry, ...crm.clientErrors].slice(0, 30);
  saveCrmState(crm);
  return NextResponse.json({ ok: true });
}
