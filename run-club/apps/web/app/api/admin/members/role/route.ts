import { NextResponse } from "next/server";
import { currentMember, getStore, type Role } from "@/lib/data";

export const dynamic = "force-dynamic";

const ALLOWED_ROLES = new Set<Role>(["member", "instructor", "admin"]);

/** POST /api/admin/members/role — Promote or demote a member's role (cannot demote yourself). */
export async function POST(req: Request) {
  const me = await currentMember();
  if (!me || me.role !== "admin") {
    return NextResponse.json({ ok: false, error: "Khusus admin." }, { status: 403 });
  }
  let body: { userId?: unknown; role?: unknown } = {};
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ ok: false, error: "Format tidak valid." }, { status: 400 });
  }
  const userId = typeof body.userId === "string" ? body.userId : "";
  const role = typeof body.role === "string" ? (body.role as Role) : null;
  if (!userId || !role || !ALLOWED_ROLES.has(role)) {
    return NextResponse.json({ ok: false, error: "Role tidak valid." }, { status: 400 });
  }
  if (userId === me.id && role !== "admin") {
    return NextResponse.json({ ok: false, error: "Tidak bisa mencabut role admin dari akunmu sendiri." }, { status: 400 });
  }
  const store = await getStore();
  const target = await store.member(userId);
  if (!target) {
    return NextResponse.json({ ok: false, error: "Member tidak ditemukan." }, { status: 404 });
  }
  await store.updateMember(userId, { role });
  return NextResponse.json({ ok: true, userId, role });
}
