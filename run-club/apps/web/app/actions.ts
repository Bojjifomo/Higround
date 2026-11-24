"use server";
/**
 * Server actions. Every write goes through lib/data/service, which enforces roles and the game rules;
 * the client never sends a duration, stars for itself, or XP.
 */
import { revalidatePath } from "next/cache";
import { cookies, headers } from "next/headers";
import QRCode from "qrcode";
import { redirect } from "next/navigation";
import { eventConfig, qrToken, type ClubEvent } from "@/lib/events";
import {
  acceptYogaConsent, checkinQr, createEvent, qrSecret, type CheckinResult, claimTimer, classAward, currentMember, DEMO_COOKIE, flags, getStore, isDemo, rejectAttempt,
  reviewActivity, setWaVerified, startTimer, type ClaimOutcome,
} from "@/lib/data";
import type { Side, Stars } from "@/lib/yoga";

async function me() {
  const m = await currentMember();
  if (!m) redirect("/login");
  return m;
}

/** Only same-site paths: "/checkin?…" yes, "//evil.com" or "https://…" no. */
function safeNext(v: FormDataEntryValue | null): string | null {
  const s = typeof v === "string" ? v : "";
  return s.startsWith("/") && !s.startsWith("//") && !s.startsWith("/\\") ? s : null;
}

export async function loginAs(formData: FormData) {
  if (!isDemo()) throw new Error("demo login only");
  const store = await getStore();
  const m = await store.member(String(formData.get("id") ?? ""));
  if (!m) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, m.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(safeNext(formData.get("next")) ?? `/u/${m.handle}`);
}

export async function logout() {
  (await cookies()).delete(DEMO_COOKIE);
  redirect("/");
}

export async function togglePublic() {
  const m = await me();
  await (await getStore()).updateMember(m.id, { isPublic: !m.isPublic });
  revalidatePath(`/u/${m.handle}`);
}

export async function acceptConsent() {
  const m = await me();
  await acceptYogaConsent(await getStore(), m);
  revalidatePath("/yoga");
}

export async function startYogaTimer(missionKey: string, side: Side, formCuesAck: boolean): Promise<{ timerId: string; startedAt: number }> {
  const m = await me();
  const now = Date.now();
  return { timerId: await startTimer(await getStore(), m, missionKey, side, formCuesAck, now), startedAt: now };
}

export async function claimYogaTimer(timerId: string): Promise<ClaimOutcome> {
  const m = await me();
  const res = await claimTimer(await getStore(), m, timerId, Date.now(), flags());
  revalidatePath("/yoga");
  return res;
}

export async function review(formData: FormData) {
  const m = await me();
  const decision = formData.get("decision") === "approved" ? "approved" : "rejected";
  await reviewActivity(await getStore(), m, String(formData.get("id")), decision, Date.now());
  revalidatePath("/admin");
}

export async function rejectClaim(formData: FormData) {
  const m = await me();
  await rejectAttempt(await getStore(), m, String(formData.get("id")), String(formData.get("reason") ?? ""), Date.now());
  revalidatePath("/admin");
}

export async function verifyWa(formData: FormData) {
  const m = await me();
  await setWaVerified(await getStore(), m, String(formData.get("id")), formData.get("verified") === "1", Date.now());
  revalidatePath("/admin");
}

export type ClassAwardState = { ok: boolean; message: string } | null;

export async function awardClass(_prev: ClassAwardState, formData: FormData): Promise<ClassAwardState> {
  const m = await me();
  const store = await getStore();
  const userId = String(formData.get("userId") ?? "");
  const missionKey = String(formData.get("missionKey") ?? "");
  const side = String(formData.get("side") ?? "both") as Side;
  const stars = Number(formData.get("stars")) as Stars;
  try {
    await classAward(store, m, userId, missionKey, side, stars, Date.now());
  } catch (e) {
    return { ok: false, message: e instanceof Error ? `Gagal: ${e.message}` : "Gagal" };
  }
  const who = await store.member(userId);
  revalidatePath("/admin/class");
  return { ok: true, message: `${stars}★ untuk ${who?.displayName ?? "member"} tercatat.` };
}

// ── events (SPEC §10) ─────────────────────────────────────────────────────────

export type EventFormState = { ok: boolean; message: string } | null;

export async function createEventAction(_prev: EventFormState, formData: FormData): Promise<EventFormState> {
  const m = await me();
  const template = String(formData.get("template") ?? "");
  const local = String(formData.get("startsAt") ?? "");                     // "2026-11-29T05:00" in WIB
  const startsAt = Date.parse(`${local}:00+07:00`);
  const over: Partial<ClubEvent> = {};
  const name = String(formData.get("name") ?? "").trim();
  if (name) over.name = name.slice(0, 80);
  const mult = Number(formData.get("multiplier"));
  if (mult >= 1 && mult <= 5) over.multiplier = mult;
  try {
    const e = await createEvent(await getStore(), m, template, startsAt, over);
    revalidatePath("/events");
    return { ok: true, message: `Event "${e.name}" dibuat.` };
  } catch (err) {
    return { ok: false, message: err instanceof Error ? err.message : "Gagal" };
  }
}

/** The QR the counter screen shows: a check-in URL with the current rotating token, as SVG. */
export async function currentQr(eventId: string): Promise<{ svg: string; url: string; rotateS: number }> {
  const m = await me();
  if (m.role !== "admin" && m.role !== "instructor") throw new Error("khusus staff");
  const h = await headers();
  const base = process.env.NEXT_PUBLIC_SITE_URL?.trim() || `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}`;
  const url = `${base}/checkin?e=${encodeURIComponent(eventId)}&t=${qrToken(qrSecret(), eventId, Date.now())}`;
  const svg = await QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#111111", light: "#ffffff" } });
  return { svg, url, rotateS: eventConfig.qr_rotate_seconds };
}

export async function checkinAction(_prev: CheckinResult | null, formData: FormData): Promise<CheckinResult | null> {
  const m = await me();
  const res = await checkinQr(await getStore(), m, String(formData.get("e") ?? ""), String(formData.get("t") ?? ""),
                              Date.now(), qrSecret());
  revalidatePath("/events");
  return res;
}
