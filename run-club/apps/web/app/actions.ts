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
  acceptYogaConsent, authUser, checkinQr, createEvent, disconnectIntervals, mode, qrSecret, roleForEmail, siteUrl,
  syncMember, type CheckinResult, claimTimer, classAward, currentMember, DEMO_COOKIE, flags, getStore, isDemo, rejectAttempt,
  reviewActivity, setWaVerified, startTimer, type ClaimOutcome,
} from "@/lib/data";
import { generateUniqueHandle, validateNickname } from "@/lib/nickname";
import { getProvider } from "@/lib/providers";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient as createSupabase } from "@/lib/supabase/server";
import { normalizeAvatar, randomAvatar, type AvatarColors } from "@/lib/world/sprite";
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
  if (mode() === "supabase") await (await createSupabase()).auth.signOut();
  else (await cookies()).delete(DEMO_COOKIE);
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
  await reviewActivity(await getStore(), m, String(formData.get("userId")), String(formData.get("id")), decision, Date.now());
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
  const url = `${await site()}/checkin?e=${encodeURIComponent(eventId)}&t=${qrToken(qrSecret(), eventId, Date.now())}`;
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

// ── Supabase auth, onboarding, Intervals.icu (mode "supabase") ───────────────

export type FormState = { ok: boolean; message: string } | null;

async function site() {
  const h = await headers();
  return siteUrl(h.get("x-forwarded-host") ?? h.get("host"), h.get("x-forwarded-proto"));
}

export async function sendMagicLink(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { ok: false, message: "Email belum valid." };
  const next = safeNext(formData.get("next")) ?? "/";
  const { error } = await (await createSupabase()).auth.signInWithOtp({
    email, options: { emailRedirectTo: `${await site()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  return error ? { ok: false, message: `Gagal kirim link: ${error.message}` } : { ok: true, message: `Link masuk dikirim ke ${email}. Cek inbox (dan folder spam).` };
}

export async function signInWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next")) ?? "/";
  const { data, error } = await (await createSupabase()).auth.signInWithOAuth({
    provider: "google", options: { redirectTo: `${await site()}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) redirect("/login?error=google");
  redirect(data.url);
}

export async function createProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const u = await authUser();
  if (!u) redirect("/login");
  const store = await getStore();
  if (await store.member(u.id)) redirect("/world");
  const checked = validateNickname(String(formData.get("displayName") ?? ""));
  if (!checked.ok) return { ok: false, message: checked.message };
  const displayName = checked.nickname;
  const handle = await generateUniqueHandle(displayName, async (c) => Boolean(await store.memberByHandle(c)));
  const initialAvatar = { ...randomAvatar(), customized: false };
  await store.addMember({
    id: u.id, handle, displayName, isPublic: true, role: roleForEmail(u.email), pinnedBadges: [], waVerifiedAt: null,
    yogaConsentVersion: null, joinedAt: new Date().toISOString(),
    avatar: initialAvatar,
  });
  redirect("/onboarding/connect");
}

export async function saveAvatar(_prev: FormState, formData: FormData): Promise<FormState> {
  const m = await me();
  const raw = String(formData.get("avatar") ?? "");
  let parsed: Partial<AvatarColors> = {};
  try {
    parsed = JSON.parse(raw) as Partial<AvatarColors>;
  } catch {
    return { ok: false, message: "Data karakter tidak valid." };
  }
  const avatar = { ...normalizeAvatar(parsed), customized: true };
  await (await getStore()).updateMember(m.id, { avatar });
  revalidatePath("/world");
  revalidatePath(`/u/${m.handle}`);
  revalidatePath("/");
  const next = safeNext(formData.get("next")) ?? "/world";
  redirect(next);
}

export async function syncNow() {
  const m = await me();
  await syncMember(await getStore(), getProvider(), m.id, Date.now());
  revalidatePath(`/u/${m.handle}`);
}

export async function disconnectNow() {
  const m = await me();
  await disconnectIntervals(await getStore(), getProvider(), m);
  revalidatePath(`/u/${m.handle}`);
}

export async function deleteAccount(formData: FormData) {
  const m = await me();
  if (String(formData.get("confirm") ?? "") !== m.handle) redirect(`/u/${m.handle}?delete=confirm`);
  const store = await getStore();
  await disconnectIntervals(store, getProvider(), m);
  await store.deleteMember(m.id);
  if (mode() === "supabase") {
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (key) await createAdminClient().auth.admin.deleteUser(m.id);
    await (await createSupabase()).auth.signOut();
  } else {
    (await cookies()).delete(DEMO_COOKIE);
  }
  redirect("/?deleted=1");
}
