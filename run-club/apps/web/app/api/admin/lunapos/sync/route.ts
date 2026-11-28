import { NextResponse } from "next/server";
import { matchLunaPosCsv } from "@/lib/admin/crm";
import { loadCrmState, saveCrmState } from "@/lib/admin/crm-store";
import { buildMemberDirectory } from "@/lib/admin/directory";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** POST /api/admin/lunapos/sync — Monthly LunaPOS CSV upload sync (matches by email or nickname). */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }

  let csvText = "";
  const ct = req.headers.get("content-type") ?? "";
  try {
    if (ct.includes("multipart/form-data")) {
      const form = await req.formData();
      const file = form.get("file");
      if (file && typeof file !== "string") {
        csvText = await file.text();
      } else {
        csvText = String(form.get("csv") ?? "");
      }
    } else {
      const body = (await req.json()) as { csv?: unknown };
      csvText = typeof body.csv === "string" ? body.csv : "";
    }
  } catch {
    return NextResponse.json({ ok: false, error: "Gagal membaca file CSV." }, { status: 400 });
  }

  if (!csvText.trim()) {
    return NextResponse.json({ ok: false, error: "File CSV kosong." }, { status: 400 });
  }

  const nowIso = new Date().toISOString();
  const { rows } = await buildMemberDirectory(Date.now());
  const summary = matchLunaPosCsv(
    csvText,
    rows.map((r) => ({ id: r.id, displayName: r.displayName, handle: r.handle, email: r.email })),
    nowIso,
  );

  const state = loadCrmState();
  for (const rec of summary.matchedRecords) {
    state.lunaByUserId[rec.userId] = rec;
  }
  state.lastLunaSyncAt = nowIso;
  saveCrmState(state);

  return NextResponse.json({
    ok: true,
    syncedAt: nowIso,
    totalRows: summary.totalRows,
    matchedCount: summary.matchedCount,
    unmatchedCount: summary.unmatchedCount,
    unmatchedLabels: summary.unmatchedLabels,
  });
}
