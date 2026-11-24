/**
 * The member's Intervals.icu connection (SPEC §3, §13.2): connect, sync (a 12-week backfill the first time,
 * then the last few days), webhook-triggered syncs, and disconnect, which also forgets the runs.
 */
import { ProviderAuthError, type ActivityProvider, type TokenResult } from "../providers";
import { syncAll, toStored } from "./service";
import type { Member, Store } from "./store";

const DAY = 86_400_000;
export const BACKFILL_DAYS = 84;
export const RESYNC_DAYS = 3;
const wibDate = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 10);

export async function connectIntervals(store: Store, member: Member, tok: TokenResult, now: number): Promise<void> {
  const other = await store.integrationByAthlete(tok.athleteId);
  if (other && other.userId !== member.id) throw new Error("Akun Intervals.icu ini sudah tersambung ke member lain.");
  await store.saveIntegration({ userId: member.id, athleteId: tok.athleteId, scopes: tok.scope, token: tok.accessToken, at: now });
}

export type SyncResult = { ok: true; runs: number } | { ok: false; error: string };

/** Pull runs from Intervals.icu, store them, and pay whatever XP they earn. Safe to run any time. */
export async function syncMember(store: Store, provider: ActivityProvider, userId: string, now: number): Promise<SyncResult> {
  const integ = await store.integration(userId);
  if (!integ) return { ok: false, error: "Belum tersambung ke Intervals.icu." };
  const oldest = wibDate(now - (integ.lastSyncedAt ? RESYNC_DAYS : BACKFILL_DAYS) * DAY);
  try {
    const acts = await provider.listActivities(integ.token, userId, oldest, wibDate(now));
    await store.upsertActivities(acts.map((a) => toStored(a)));
    await syncAll(store, userId, now);
    await store.markSynced(userId, now, null);
    return { ok: true, runs: acts.length };
  } catch (e) {
    const msg = e instanceof ProviderAuthError ? "Akses Intervals.icu dicabut. Sambungkan ulang." : `Sync gagal: ${(e as Error).message}`;
    await store.markSynced(userId, now, msg.slice(0, 300));
    return { ok: false, error: msg };
  }
}

/** Webhook from Intervals.icu: re-sync each athlete whose activities changed. */
export async function handleWebhook(store: Store, provider: ActivityProvider, body: unknown, now: number): Promise<number> {
  const events = provider.parseWebhook(body);
  const athletes = new Set(events.filter((e) => e.type.startsWith("ACTIVITY_")).map((e) => e.athleteId));
  let n = 0;
  for (const a of athletes) {
    const integ = await store.integrationByAthlete(a);
    if (integ && (await syncMember(store, provider, integ.userId, now)).ok) n++;
  }
  return n;
}

/** Daily safety net: re-sync everyone connected. */
export async function syncEveryone(store: Store, provider: ActivityProvider, now: number): Promise<{ ok: number; failed: number }> {
  let ok = 0, failed = 0;
  for (const i of await store.integrations()) {
    if ((await syncMember(store, provider, i.userId, now)).ok) ok++;
    else failed++;
  }
  return { ok, failed };
}

export async function disconnectIntervals(store: Store, provider: ActivityProvider, member: Member): Promise<void> {
  const integ = await store.integration(member.id);
  if (integ?.token) await provider.disconnect(integ.token).catch(() => undefined);
  await store.removeRunData(member.id);
}
