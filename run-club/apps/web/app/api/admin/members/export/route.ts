import { NextResponse } from "next/server";
import { buildMembersCsv } from "@/lib/admin/crm";
import { buildMemberDirectory } from "@/lib/admin/directory";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

/** GET /api/admin/members/export — Download full Higround member database as Excel-ready CSV. */
export async function GET() {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ error: "Khusus admin." }, { status: 403 });
  }
  const { rows } = await buildMemberDirectory(Date.now());
  const csv = buildMembersCsv(rows);
  const dateTag = new Date().toISOString().slice(0, 10);
  return new NextResponse(csv, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="higround-members-${dateTag}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
