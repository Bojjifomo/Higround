"use server";
/**
 * Server actions. Every write goes through lib/data/service, which enforces roles and the game rules;
 * the client never sends a duration, stars for itself, or XP.
 */
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  acceptYogaConsent, claimTimer, classAward, currentMember, DEMO_COOKIE, flags, getStore, isDemo, rejectAttempt,
  reviewActivity, setWaVerified, startTimer, type ClaimOutcome,
} from "@/lib/data";
import type { Side, Stars } from "@/lib/yoga";

async function me() {
  const m = await currentMember();
  if (!m) redirect("/login");
  return m;
}

export async function loginAs(formData: FormData) {
  if (!isDemo()) throw new Error("demo login only");
  const store = await getStore();
  const m = await store.member(String(formData.get("id") ?? ""));
  if (!m) redirect("/login");
  (await cookies()).set(DEMO_COOKIE, m.id, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30 });
  redirect(`/u/${m.handle}`);
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
