/**
 * Activations / events (SPEC §10). Pure rules: templates, the rotating QR token, check-in from a run,
 * the XP multiplier bonus and the virtual challenge. Templates live in config/events.json.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import eventsJson from "../../../../config/events.json";
import { haversineM } from "../xp";
import type { Activity, LedgerEntry } from "../xp/types";

export type EventKind = "run" | "virtual" | "brew" | "yoga";
export type CheckinMethod = "qr" | "activity" | "class";

export interface EventTemplate {
  name: string; kind: EventKind; description: string; duration_hours: number; multiplier: number;
  min_km?: number; target_km?: number; checkin: CheckinMethod[]; bonus_xp: number; badge_rarity: string;
}
export const eventConfig = eventsJson as unknown as {
  qr_rotate_seconds: number; checkin_early_minutes: number; templates: Record<string, EventTemplate>;
};

export interface ClubEvent {
  id: string;
  template: string;
  name: string;
  kind: EventKind;
  description: string;
  startsAt: number;            // ms
  endsAt: number;
  lat: number;
  lng: number;
  radiusM: number;
  multiplier: number;
  minKm: number | null;
  targetKm: number | null;
  checkin: CheckinMethod[];
  bonusXp: number;
  badgeRarity: string;
}

export interface Checkin { eventId: string; userId: string; method: CheckinMethod; createdAt: number }

export const HIGROUND = { lat: -6.1692868660954705, lng: 106.97518796135917 };

/** A new event from a template; anything in `over` replaces the template's value. */
export function fromTemplate(id: string, templateKey: string, startsAt: number, over: Partial<ClubEvent> = {}): ClubEvent {
  const t = eventConfig.templates[templateKey];
  if (!t) throw new Error(`unknown template ${templateKey}`);
  const endsAt = t.kind === "virtual" ? endOfMonthWib(startsAt) : startsAt + t.duration_hours * 3_600_000;
  return {
    id, template: templateKey, name: t.name, kind: t.kind, description: t.description, startsAt, endsAt,
    lat: HIGROUND.lat, lng: HIGROUND.lng, radiusM: 200, multiplier: t.multiplier, minKm: t.min_km ?? null,
    targetKm: t.target_km ?? null, checkin: t.checkin, bonusXp: t.bonus_xp, badgeRarity: t.badge_rarity, ...over,
  };
}

/** First instant of the next month in WIB. */
export function endOfMonthWib(ms: number): number {
  const d = new Date(ms + 7 * 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1) - 7 * 3_600_000;
}

export type EventStatus = "upcoming" | "open" | "ended";

/** Check-in opens a little before the start (people arrive early) and closes at the end. */
export function status(e: ClubEvent, now: number): EventStatus {
  if (now < e.startsAt - eventConfig.checkin_early_minutes * 60_000) return "upcoming";
  if (now >= e.endsAt) return "ended";
  return "open";
}

// ── rotating QR ───────────────────────────────────────────────────────────────

const slotOf = (now: number) => Math.floor(now / 1000 / eventConfig.qr_rotate_seconds);

export function qrToken(secret: string, eventId: string, now: number): string {
  return createHmac("sha256", secret).update(`${eventId}:${slotOf(now)}`).digest("base64url").slice(0, 12);
}

/** Valid for the current and the previous slot, so a code scanned just as it rotates still works. */
export function verifyQr(secret: string, eventId: string, token: string, now: number): boolean {
  if (!token || token.length !== 12) return false;
  for (const t of [now, now - eventConfig.qr_rotate_seconds * 1000]) {
    const want = qrToken(secret, eventId, t);
    if (timingSafeEqual(Buffer.from(want), Buffer.from(token))) return true;
  }
  return false;
}

// ── check-in from a run ───────────────────────────────────────────────────────

/** A run counts as attending when it starts in the event window, within the radius (not for virtual
 *  challenges, which count runs from anywhere) and is long enough. */
export function activityQualifies(e: ClubEvent, a: Activity): boolean {
  if (!e.checkin.includes("activity")) return false;
  const t = Date.parse(a.startTime);
  if (t < e.startsAt - eventConfig.checkin_early_minutes * 60_000 || t >= e.endsAt) return false;
  if (e.minKm != null && a.distanceM / 1000 < e.minKm) return false;
  if (e.kind === "virtual") return true;
  if (a.type === "VirtualRun" || a.startLat == null || a.startLng == null) return false;
  return haversineM(a.startLat, a.startLng, e.lat, e.lng) <= e.radiusM;
}

/** km run inside the event window (virtual challenge progress). */
export function windowKm(e: ClubEvent, acts: Activity[]): number {
  return acts.filter((a) => { const t = Date.parse(a.startTime); return t >= e.startsAt && t < e.endsAt; })
    .reduce((s, a) => s + a.distanceM, 0) / 1000;
}

/** Did this member finish the event (and earn its badge)? */
export function completed(e: ClubEvent, checkedIn: boolean, acts: Activity[]): boolean {
  if (e.kind === "virtual") return e.targetKm != null && windowKm(e, acts) >= e.targetKm;
  return checkedIn;
}

// ── XP ────────────────────────────────────────────────────────────────────────

/**
 * Event XP for one member: the join bonus once they are in, and the multiplier on the XP of each run that
 * qualified for the event (bonus = run XP × (multiplier − 1)). Keys make every payout a one-off.
 */
export function eventXp(e: ClubEvent, userId: string, joined: boolean, qualifyingRunXp: { activityId: string; xp: number }[]): LedgerEntry[] {
  const out: LedgerEntry[] = [];
  if (joined && e.bonusXp > 0) {
    out.push({ userId, amount: e.bonusXp, ruleKey: "event_join", sourceType: "event", sourceId: e.id,
               idempotencyKey: `event_join:${e.id}:${userId}` });
  }
  if (e.multiplier > 1) {
    for (const r of qualifyingRunXp) {
      const bonus = Math.round(r.xp * (e.multiplier - 1));
      if (bonus > 0) {
        out.push({ userId, amount: bonus, ruleKey: "event_multiplier", sourceType: "event", sourceId: e.id,
                   idempotencyKey: `event_mult:${e.id}:${r.activityId}` });
      }
    }
  }
  return out;
}

export const eventBadgeKey = (e: ClubEvent) => `event_${e.id}`;
