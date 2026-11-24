/**
 * Events (SPEC §10) on top of a Store: create from a template, check in by rotating QR, by a qualifying run
 * or from Class Mode, and pay the event XP (join bonus, run multiplier). Every function takes `now` (ms).
 */
import {
  activityQualifies, completed, eventBadgeKey, eventXp, fromTemplate, status, verifyQr, windowKm,
  type CheckinMethod, type ClubEvent, type EventStatus,
} from "../events";
import { earns } from "../xp";
import type { Member, Store } from "./store";

export class EventError extends Error {}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));

export async function createEvent(store: Store, admin: Member, templateKey: string, startsAt: number,
                                  over: Partial<ClubEvent> = {}): Promise<ClubEvent> {
  if (admin.role !== "admin") throw new EventError("khusus admin");
  if (!Number.isFinite(startsAt)) throw new EventError("waktu mulai tidak valid");
  const e = fromTemplate(newId(), templateKey, startsAt, over);
  if (e.endsAt <= e.startsAt) throw new EventError("waktu selesai harus setelah mulai");
  await store.addEvent(e);
  return e;
}

/** Check-ins from runs, then the event XP the member is owed. Idempotent. */
export async function syncEvents(store: Store, userId: string, now: number): Promise<void> {
  const acts = await store.activities(userId);
  const approved = new Set(acts.filter((a) => a.reviewStatus === "approved").map((a) => a.id));
  const ok = acts.filter((a) => earns(a, approved));
  const ledger = await store.ledger(userId);
  for (const e of await store.events()) {
    if (status(e, now) === "upcoming") continue;
    const qualifying = ok.filter((a) => activityQualifies(e, a));
    if (qualifying.length && e.kind !== "virtual") {
      await store.addCheckin({ eventId: e.id, userId, method: "activity", createdAt: Date.parse(qualifying[0].startTime) });
    }
    const checkedIn = (await store.checkins(e.id)).some((c) => c.userId === userId);
    const done = completed(e, checkedIn, ok);
    const runXp = qualifying.map((a) => ({
      activityId: a.id,
      xp: ledger.filter((x) => x.sourceType === "activity" && x.sourceId === a.id).reduce((s, x) => s + x.amount, 0),
    }));
    await store.addLedger(eventXp(e, userId, done, runXp), now);
  }
}

export type CheckinResult = { ok: true; already: boolean; event: ClubEvent } | { ok: false; error: string };

export async function checkinQr(store: Store, member: Member, eventId: string, token: string, now: number,
                                secret: string): Promise<CheckinResult> {
  const e = await store.event(eventId);
  if (!e) return { ok: false, error: "Event tidak ditemukan." };
  if (!e.checkin.includes("qr")) return { ok: false, error: "Event ini tidak pakai check-in QR." };
  const st = status(e, now);
  if (st !== "open") return { ok: false, error: st === "upcoming" ? "Check-in belum dibuka." : "Event sudah selesai." };
  if (!verifyQr(secret, e.id, token, now)) return { ok: false, error: "QR sudah kedaluwarsa. Scan ulang QR di kasir." };
  const fresh = await store.addCheckin({ eventId: e.id, userId: member.id, method: "qr", createdAt: now });
  await syncEvents(store, member.id, now);
  return { ok: true, already: !fresh, event: e };
}

/** Class Mode during an open yoga event checks the member in. */
export async function checkinFromClass(store: Store, userId: string, now: number): Promise<void> {
  for (const e of await store.events()) {
    if (e.kind === "yoga" && e.checkin.includes("class") && status(e, now) === "open") {
      await store.addCheckin({ eventId: e.id, userId, method: "class", createdAt: now });
    }
  }
  await syncEvents(store, userId, now);
}

export interface EventRow {
  event: ClubEvent;
  status: EventStatus;
  participants: number;
  mine: { method: CheckinMethod | null; done: boolean; km: number | null } | null;
}

export async function eventsView(store: Store, viewer: Member | null, now: number): Promise<EventRow[]> {
  const rows: EventRow[] = [];
  const acts = viewer ? (await store.activities(viewer.id)).filter((a) => earns(a)) : [];
  const everyone = await store.members();
  for (const e of await store.events()) {
    const cks = await store.checkins(e.id);
    const my = viewer ? cks.find((c) => c.userId === viewer.id) ?? null : null;
    let participants = cks.length;
    if (e.kind === "virtual") {                      // no check-in: count who reached the target
      participants = 0;
      for (const m of everyone) if (completed(e, false, (await store.activities(m.id)).filter((a) => earns(a)))) participants++;
    }
    rows.push({
      event: e, status: status(e, now), participants,
      mine: viewer ? { method: my?.method ?? null, done: completed(e, !!my, acts), km: e.kind === "virtual" ? windowKm(e, acts) : null } : null,
    });
  }
  const order: Record<EventStatus, number> = { open: 0, upcoming: 1, ended: 2 };
  return rows.sort((a, b) => order[a.status] - order[b.status] ||
    (a.status === "ended" ? b.event.startsAt - a.event.startsAt : a.event.startsAt - b.event.startsAt));
}

export async function eventDetail(store: Store, id: string, viewer: Member | null, now: number) {
  const e = await store.event(id);
  if (!e) return null;
  const cks = await store.checkins(id);
  const people = await Promise.all(cks.map(async (c) => ({ c, m: await store.member(c.userId) })));
  const row = (await eventsView(store, viewer, now)).find((r) => r.event.id === id)!;
  return {
    ...row,
    attendees: people.filter(({ m }) => m && (m.isPublic || m.id === viewer?.id))
      .map(({ c, m }) => ({ handle: m!.handle, name: m!.displayName, method: c.method })),
  };
}

/** Events a member finished, for the profile's event badges. */
export async function eventBadgesOf(store: Store, userId: string): Promise<{ key: string; name: string; rarity: string }[]> {
  const acts = (await store.activities(userId)).filter((a) => earns(a));
  const out: { key: string; name: string; rarity: string }[] = [];
  for (const e of await store.events()) {
    const ck = (await store.checkins(e.id)).some((c) => c.userId === userId);
    if (completed(e, ck, acts)) out.push({ key: eventBadgeKey(e), name: e.name, rarity: e.badgeRarity });
  }
  return out;
}

/** The event to show in the world HUD: an on-site event happening now first, else a running challenge. */
export async function activeEvent(store: Store, now: number): Promise<ClubEvent | null> {
  const open = (await store.events()).filter((e) => status(e, now) === "open");
  return open.find((e) => e.kind !== "virtual") ?? open[0] ?? null;
}
