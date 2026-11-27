/**
 * Business rules over a Store: XP sync, badges, Yoga Quest claims, admin review, class mode, and the
 * read models the pages render. Every function takes `now` (ms) so tests control the clock.
 */
import { dateShort, km as fmtKm } from "../format";
import { activeEvent, checkinFromClass, eventBadgesOf, syncEvents } from "./events-service";
import { badgeXpEntries, catalogue, earnedBadges, unlockedCosmetics, type Badge, type MemberStats } from "../badges";
import {
  cafeVouchersFor, loyaltyTierOf, rukoUpgradeFor, weeklyClubQuestFor,
  type CafeVoucher, type LoyaltyTier, type RukoUpgradeTier, type WeeklyClubQuest,
} from "../rewards";
import {
  defaultRules as rules, earns, effortsOf, eligibility, isHigroundStart, ledgerFor, levelFor, localDate, weekKey,
  type Activity, type LevelInfo, type PbKey,
} from "../xp";
import {
  checkClaim, checkFlow, defaultConfig as yoga, findMission, missionStars, progress, reconcileYogaXp, yogaBadges,
  type ClaimError, type Side, type SideBests, type Stars, type YogaProgress,
} from "../yoga";
import type { Member, Store, StoredActivity, StoredLedgerEntry, YogaAttempt } from "./store";

const DAY = 86_400_000;
export const FLOW_KEY = yoga.bonus_missions[0].key;

export class Forbidden extends Error {}
export class NotFound extends Error {}

const newId = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2));
const addDays = (day: string, n: number) => {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

// ── activities in ─────────────────────────────────────────────────────────────

/** A provider activity as stored: eligibility decided once, flagged runs wait for review. */
export function toStored(a: Activity, name: string | null = a.name ?? null): StoredActivity {
  const el = eligibility(a, rules);
  return { ...a, name, isHigroundStart: el.counted && isHigroundStart(a, rules), counted: el.counted,
           flagged: el.flagged, flagReasons: el.reasons, reviewStatus: el.counted && el.flagged ? "pending" : "none" };
}

const approvedIds = (acts: StoredActivity[]) => new Set(acts.filter((a) => a.reviewStatus === "approved").map((a) => a.id));

// ── XP sync ───────────────────────────────────────────────────────────────────

/** Writes every run XP entry the member's history earns that is not in the ledger yet. Weekly bonuses
 *  only for weeks that have ended (the Monday job). Idempotent. */
export async function syncRunXp(store: Store, userId: string, now: number): Promise<number> {
  const acts = await store.activities(userId);
  const entries = ledgerFor(userId, acts, weekKey(new Date(now).toISOString(), rules), rules, approvedIds(acts));
  return store.addLedger(entries, now);
}

export async function yogaBests(store: Store, userId: string): Promise<Record<string, SideBests>> {
  const out: Record<string, SideBests> = {};
  for (const a of await store.attempts(userId)) {
    if (a.status !== "approved" || a.missionKey === FLOW_KEY) continue;
    const cur = out[a.missionKey] ?? {};
    cur[a.side] = Math.max(cur[a.side] ?? 0, a.stars) as Stars;
    out[a.missionKey] = cur;
  }
  return out;
}

export async function syncYogaXp(store: Store, userId: string, missionKey: string, now: number): Promise<void> {
  const found = findMission(missionKey);
  if (!found) return;
  const bests = await yogaBests(store, userId);
  const mine = (await store.ledger(userId)).filter((e) => e.sourceType === "yoga" && e.sourceId === missionKey);
  const entry = reconcileYogaXp(userId, missionKey, missionStars(found.mission, bests[missionKey]),
                                mine.reduce((s, e) => s + e.amount, 0), mine.length);
  if (entry) await store.addLedger([entry], now);
}

async function flowDone(store: Store, userId: string) {
  return (await store.attempts(userId)).some((a) => a.missionKey === FLOW_KEY && a.status === "approved");
}

export async function memberStats(store: Store, userId: string): Promise<MemberStats & { yoga: YogaProgress }> {
  const acts = await store.activities(userId);
  const ok = acts.filter((a) => earns(a, approvedIds(acts), rules));
  const bests = await yogaBests(store, userId);
  const p = progress(bests);
  return {
    runCount: ok.length,
    totalKm: ok.reduce((s, a) => s + a.distanceM, 0) / 1000,
    longestRunKm: Math.max(0, ...ok.map((a) => a.distanceM / 1000)),
    higroundStarts: ok.filter((a) => a.isHigroundStart).length,
    bestStreakWeeks: longestStreak(ok.map((a) => weekKey(a.startTime, rules))),
    yogaBadgeKeys: new Set(yogaBadges(p, bests, await flowDone(store, userId))),
    yoga: p,
  };
}

function longestStreak(weeks: string[]): number {
  const set = [...new Set(weeks)].sort();
  let best = 0, run = 0, prev: string | null = null;
  for (const w of set) {
    run = prev && addDays(prev, 7) === w ? run + 1 : 1;
    best = Math.max(best, run);
    prev = w;
  }
  return best;
}

/** Pays the XP of every badge earned so far (each once). */
export async function syncBadges(store: Store, userId: string, now: number): Promise<Badge[]> {
  const earned = earnedBadges(await memberStats(store, userId));
  await store.addLedger(badgeXpEntries(userId, earned.map((b) => b.key)), now);
  return earned;
}

export async function syncAll(store: Store, userId: string, now: number): Promise<void> {
  await syncRunXp(store, userId, now);
  for (const key of Object.keys(await yogaBests(store, userId))) await syncYogaXp(store, userId, key, now);
  await syncBadges(store, userId, now);
  await syncEvents(store, userId, now);
}

export async function levelOf(store: Store, userId: string): Promise<LevelInfo> {
  return levelFor((await store.ledger(userId)).reduce((s, e) => s + e.amount, 0), rules);
}

// ── Yoga Quest ────────────────────────────────────────────────────────────────

export const YOGA_CONSENT_VERSION = yoga.requires.consent_version;

export async function acceptYogaConsent(store: Store, member: Member): Promise<void> {
  await store.updateMember(member.id, { yogaConsentVersion: YOGA_CONSENT_VERSION });
}

export async function startTimer(store: Store, member: Member, missionKey: string, side: Side, formCuesAck: boolean,
                                 now: number): Promise<string> {
  if (missionKey !== FLOW_KEY && !findMission(missionKey)) throw new NotFound("misi");
  const id = newId();
  await store.addTimer({ id, userId: member.id, missionKey, side, formCuesAck, startedAt: now, claimedAt: null });
  return id;
}

export type ClaimOutcome =
  | { ok: true; missionKey: string; measuredS: number; stars: Stars; missionStarsBefore: Stars; missionStarsAfter: Stars; xp: number }
  | { ok: false; error: ClaimError | "timer" | "already_claimed"; retryAfterS?: number };

/** Ends a server timer and records an honest self-reported claim (SPEC §8, v0.3). */
export async function claimTimer(store: Store, member: Member, timerId: string, now: number,
                                 opts: { waGateEnabled: boolean }): Promise<ClaimOutcome> {
  const t = await store.timer(timerId);
  if (!t || t.userId !== member.id) return { ok: false, error: "timer" };
  if (t.claimedAt) return { ok: false, error: "already_claimed" };
  const before = (await store.ledger(member.id)).reduce((s, e) => s + e.amount, 0);
  const bests = await yogaBests(store, member.id);

  if (t.missionKey === FLOW_KEY) {
    const res = checkFlow(progress(bests), t.startedAt, now);
    await store.updateTimer(t.id, { claimedAt: now });
    if (!res.ok) return { ok: false, error: res.error };
    const measuredS = Math.floor((now - t.startedAt) / 1000);
    await store.addAttempt({ id: newId(), userId: member.id, timerId: t.id, missionKey: FLOW_KEY, side: "both", measuredS,
                             stars: 2, mode: "timer", status: "approved", reviewerId: null, reason: null, createdAt: now });
    await store.addLedger([{ ...res.entry, userId: member.id, idempotencyKey: `yoga_flow:${member.id}` }], now);
    await syncBadges(store, member.id, now);
    const after = (await store.ledger(member.id)).reduce((s, e) => s + e.amount, 0);
    return { ok: true, missionKey: FLOW_KEY, measuredS, stars: 2, missionStarsBefore: 0, missionStarsAfter: 2, xp: after - before };
  }

  const today = localDate(new Date(now).toISOString(), rules);
  const mine = (await store.attempts(member.id)).filter((a) => a.mode === "timer");
  const last = mine.filter((a) => a.missionKey === t.missionKey && a.side === t.side).sort((a, b) => b.createdAt - a.createdAt)[0];
  const res = checkClaim({
    missionKey: t.missionKey, side: t.side, timerStartedAt: t.startedAt, now,
    consentVersion: member.yogaConsentVersion, formCuesAcknowledged: t.formCuesAck,
    waGateEnabled: opts.waGateEnabled, waVerified: !!member.waVerifiedAt, bests,
    claimsToday: mine.filter((a) => localDate(new Date(a.createdAt).toISOString(), rules) === today).length,
    lastClaimForMissionSide: last?.createdAt ?? null,
  });
  if (!res.ok) {
    if (res.error !== "cooldown") await store.updateTimer(t.id, { claimedAt: now });
    return res;
  }
  await store.updateTimer(t.id, { claimedAt: now });
  await store.addAttempt({ id: newId(), userId: member.id, timerId: t.id, missionKey: t.missionKey, side: t.side,
                           measuredS: res.measuredS, stars: res.sideStars, mode: "timer", status: "approved",
                           reviewerId: null, reason: null, createdAt: now });
  await syncYogaXp(store, member.id, t.missionKey, now);
  await syncBadges(store, member.id, now);
  const after = (await store.ledger(member.id)).reduce((s, e) => s + e.amount, 0);
  return { ok: true, missionKey: t.missionKey, measuredS: res.measuredS, stars: res.sideStars,
           missionStarsBefore: res.missionStarsBefore, missionStarsAfter: res.missionStarsAfter, xp: after - before };
}

// ── staff ─────────────────────────────────────────────────────────────────────

const isAdmin = (m: Member) => m.role === "admin";
const isStaff = (m: Member) => m.role === "admin" || m.role === "instructor";

export async function reviewActivity(store: Store, staff: Member, userId: string, activityId: string,
                                     decision: "approved" | "rejected", now: number): Promise<void> {
  if (!isAdmin(staff)) throw new Forbidden("admin");
  const a = await store.activity(userId, activityId);
  if (!a || a.reviewStatus !== "pending") throw new NotFound("aktivitas");
  await store.updateActivity(userId, activityId, { reviewStatus: decision });
  await syncRunXp(store, a.userId, now);
  await syncBadges(store, a.userId, now);
  await syncEvents(store, a.userId, now);
}

export async function rejectAttempt(store: Store, staff: Member, attemptId: string, reason: string, now: number): Promise<void> {
  if (!isStaff(staff)) throw new Forbidden("staff");
  const a = await store.attempt(attemptId);
  if (!a || a.status !== "approved") throw new NotFound("klaim");
  await store.updateAttempt(attemptId, { status: "rejected", reviewerId: staff.id, reason: reason.slice(0, 200) || null });
  await syncYogaXp(store, a.userId, a.missionKey, now);
}

export async function setWaVerified(store: Store, staff: Member, userId: string, verified: boolean, now: number): Promise<void> {
  if (!isAdmin(staff)) throw new Forbidden("admin");
  await store.updateMember(userId, { waVerifiedAt: verified ? new Date(now).toISOString() : null });
}

/** Class Mode: the instructor watches the hold and gives the stars directly (no timer claim, no cooldown). */
export async function classAward(store: Store, staff: Member, userId: string, missionKey: string, side: Side, stars: Stars,
                                 now: number): Promise<void> {
  if (!isStaff(staff)) throw new Forbidden("staff");
  const found = findMission(missionKey);
  if (!found || stars < 1 || stars > 3) throw new NotFound("misi");
  if (found.mission.per_side === (side === "both")) throw new NotFound("sisi");
  const p = progress(await yogaBests(store, userId));
  if (!p.tahap.find((t) => t.level === found.tahap.level)?.unlocked) throw new Forbidden("tahap terkunci");
  await store.addAttempt({ id: newId(), userId, timerId: null, missionKey, side, measuredS: found.mission.stars_s[stars - 1],
                           stars, mode: "class", status: "approved", reviewerId: staff.id, reason: null, createdAt: now });
  await syncYogaXp(store, userId, missionKey, now);
  await syncBadges(store, userId, now);
  await checkinFromClass(store, userId, now);
}

// ── read models ───────────────────────────────────────────────────────────────

export interface RunView {
  totalKm: number; weekKm: number; monthKm: number; runs: number; elevationM: number; higroundStarts: number;
  weeks: { week: string; km: number; paceSPerKm: number | null; runs: number }[];
  days: { day: string; km: number }[];
  pbs: Partial<Record<PbKey, number>>;
  recent: (StoredActivity & { status: "ok" | "pending" | "approved" | "rejected" | "uncounted" })[];
}

export function runView(acts: StoredActivity[], now: number): RunView {
  const ok = acts.filter((a) => earns(a, approvedIds(acts), rules));
  const nowIso = new Date(now).toISOString();
  const thisWeek = weekKey(nowIso, rules);
  const today = localDate(nowIso, rules);
  const month = today.slice(0, 7);
  const km = (xs: StoredActivity[]) => xs.reduce((s, a) => s + a.distanceM, 0) / 1000;
  const weeks = Array.from({ length: 12 }, (_, i) => addDays(thisWeek, -7 * (11 - i))).map((w) => {
    const inW = ok.filter((a) => weekKey(a.startTime, rules) === w);
    const d = inW.reduce((s, a) => s + a.distanceM, 0);
    const t = inW.reduce((s, a) => s + a.movingTimeS, 0);
    return { week: w, km: d / 1000, paceSPerKm: d > 0 ? t / (d / 1000) : null, runs: inW.length };
  });
  const firstDay = addDays(thisWeek, -7 * 11);
  const days: { day: string; km: number }[] = [];
  for (let d = firstDay; d <= today; d = addDays(d, 1)) {
    days.push({ day: d, km: km(ok.filter((a) => localDate(a.startTime, rules) === d)) });
  }
  const pbs: Partial<Record<PbKey, number>> = {};
  for (const a of ok) {
    for (const [k, s] of Object.entries(effortsOf(a)) as [PbKey, number][]) if (pbs[k] == null || s < pbs[k]!) pbs[k] = s;
  }
  const recent = [...acts].sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime)).slice(0, 10).map((a) => ({
    ...a,
    status: !a.counted ? "uncounted" as const
      : a.reviewStatus === "none" ? "ok" as const : a.reviewStatus,
  }));
  return {
    totalKm: km(ok), weekKm: km(ok.filter((a) => weekKey(a.startTime, rules) === thisWeek)),
    monthKm: km(ok.filter((a) => localDate(a.startTime, rules).startsWith(month))),
    runs: ok.length, elevationM: ok.reduce((s, a) => s + a.elevGainM, 0),
    higroundStarts: ok.filter((a) => a.isHigroundStart).length, weeks, days, pbs, recent,
  };
}

export interface ProfileView {
  member: Member;
  isOwner: boolean;
  hidden: boolean;            // private profile seen by someone else: header only
  level: LevelInfo;
  run: RunView | null;
  yoga: { progress: YogaProgress; bests: Record<string, SideBests>; masteredPoses: string[] } | null;
  badges: { all: Badge[]; earned: Set<string>; pinned: Badge[] };
  cosmetics: string[];
  history: HistoryItem[];
  eventBadges: { key: string; name: string; rarity: string }[];
}

/** A ledger entry dated by what earned it (the run, the week, the claim), with a human detail. */
export interface HistoryItem extends StoredLedgerEntry {
  when: string;
  detail: string | null;
}

function historyOf(ledger: StoredLedgerEntry[], acts: StoredActivity[], limit: number,
                   eventNames: Map<string, string> = new Map()): HistoryItem[] {
  const byId = new Map(acts.map((a) => [a.id, a]));
  const missions = new Map(yoga.levels.flatMap((l) => l.missions).map((m) => [m.key, m.name]));
  const badges = new Map(catalogue.badges.map((b) => [b.key, b.name]));
  return ledger.map((e) => {
    const a = e.sourceType === "activity" ? byId.get(e.sourceId) : undefined;
    const when = a ? a.startTime : e.sourceType === "week" ? `${addDays(e.sourceId, 6)}T23:59:00+07:00` : e.createdAt;
    const detail = a ? (a.name ?? a.type)
      : e.sourceType === "week" ? `minggu ${dateShort(e.sourceId)}`
      : e.sourceType === "yoga" ? (missions.get(e.sourceId) ?? "Flow Challenge")
      : e.sourceType === "badge" ? (badges.get(e.sourceId) ?? e.sourceId)
      : e.sourceType === "event" ? (eventNames.get(e.sourceId) ?? "Event") : null;
    return { ...e, when, detail };
  }).sort((x, y) => Date.parse(y.when) - Date.parse(x.when) || y.idempotencyKey.localeCompare(x.idempotencyKey)).slice(0, limit);
}

export async function profileView(store: Store, handle: string, viewer: Member | null, now: number): Promise<ProfileView | null> {
  const member = await store.memberByHandle(handle);
  if (!member) return null;
  const isOwner = viewer?.id === member.id;
  const hidden = !member.isPublic && !isOwner && viewer?.role !== "admin";
  const level = await levelOf(store, member.id);
  const stats = await memberStats(store, member.id);
  const earned = new Set(earnedBadges(stats).map((b) => b.key));
  const pinned = (member.pinnedBadges.length ? member.pinnedBadges : [...earned].slice(-3))
    .map((k) => catalogue.badges.find((b) => b.key === k)).filter((b): b is Badge => !!b && earned.has(b.key)).slice(0, 3);
  const bests = await yogaBests(store, member.id);
  const mastered = yoga.levels.flatMap((t) => t.missions).filter((m) => missionStars(m, bests[m.key]) >= 2).map((m) => m.name);
  return {
    member, isOwner, hidden, level,
    run: hidden ? null : runView(await store.activities(member.id), now),
    yoga: hidden ? null : { progress: stats.yoga, bests, masteredPoses: mastered },
    badges: { all: catalogue.badges, earned, pinned },
    cosmetics: unlockedCosmetics(level.level, earned).map((c) => c.name),
    history: hidden ? [] : historyOf(await store.ledger(member.id), await store.activities(member.id), 25,
                                     new Map((await store.events()).map((e) => [e.id, e.name]))),
    eventBadges: hidden ? [] : await eventBadgesOf(store, member.id),
  };
}

export interface QuestView {
  progress: YogaProgress;
  bests: Record<string, SideBests>;
  consentOk: boolean;
  waGateEnabled: boolean;
  waVerified: boolean;
  waGroupUrl: string | null;
  flowDone: boolean;
  claimsToday: number;
  cooldowns: Record<string, number>;      // "mission:side" → seconds left
  recent: YogaAttempt[];
}

export async function questView(store: Store, member: Member, now: number,
                                opts: { waGateEnabled: boolean; waGroupUrl: string | null }): Promise<QuestView> {
  const bests = await yogaBests(store, member.id);
  const all = await store.attempts(member.id);
  const timerClaims = all.filter((a) => a.mode === "timer");
  const today = localDate(new Date(now).toISOString(), rules);
  const cooldowns: Record<string, number> = {};
  const cd = yoga.claim.cooldown_minutes_per_mission * 60_000;
  for (const a of timerClaims) {
    const left = cd - (now - a.createdAt);
    const k = `${a.missionKey}:${a.side}`;
    if (left > 0) cooldowns[k] = Math.max(cooldowns[k] ?? 0, Math.ceil(left / 1000));
  }
  return {
    progress: progress(bests), bests,
    consentOk: (member.yogaConsentVersion ?? 0) >= YOGA_CONSENT_VERSION,
    waGateEnabled: opts.waGateEnabled, waVerified: !!member.waVerifiedAt, waGroupUrl: opts.waGroupUrl,
    flowDone: all.some((a) => a.missionKey === FLOW_KEY && a.status === "approved"),
    claimsToday: timerClaims.filter((a) => localDate(new Date(a.createdAt).toISOString(), rules) === today).length,
    cooldowns,
    recent: [...all].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8),
  };
}

export async function leaderboardLite(store: Store): Promise<{ member: Member; level: LevelInfo }[]> {
  const ms = (await store.members()).filter((m) => m.isPublic);
  const rows = await Promise.all(ms.map(async (member) => ({ member, level: await levelOf(store, member.id) })));
  return rows.sort((a, b) => b.level.totalXp - a.level.totalXp);
}

export { DAY };

// ── world (SPEC §6) ───────────────────────────────────────────────────────────

export interface WorldMember {
  id: string; handle: string; name: string; avatar: Member["avatar"]; level: number; title: string;
  badges: { name: string; icon: string }[]; ranToday: boolean; yogaStars: number; isMe: boolean;
  weekKm: number; totalKm: number; higroundStarts: number;
}

export interface WorldView {
  members: WorldMember[];
  hud: {
    week: number;
    communityKmWeek: number;
    communityTotalKm: number;
    myXp: number | null;
    myLevel: number | null;
    myTitle: string | null;
    myXpIntoLevel: number;
    myXpToNext: number | null;
    myStreakWeeks: number;
    event: { id: string; name: string; multiplier: number; description: string } | null;
  };
  ticker: string[];
  clubQuest: WeeklyClubQuest;
  rukoUpgrade: RukoUpgradeTier;
  weeklyLeaders: { handle: string; name: string; avatar: Member["avatar"]; weekKm: number; level: number; ranToday: boolean }[];
  rewards: { tier: LoyaltyTier; vouchers: CafeVoucher[] } | null;
}

const ISO_WEEK = (iso: string) => {
  const d = new Date(localDate(iso, rules) + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((d.getTime() - firstThu.getTime()) / DAY - 3 + ((firstThu.getUTCDay() + 6) % 7)) / 7);
};

/** Who is in the world right now (all public signed-up members up to 25, you always), the HUD and the ticker. */
export async function worldView(store: Store, viewer: Member | null, now: number): Promise<WorldView> {
  const nowIso = new Date(now).toISOString();
  const today = localDate(nowIso, rules);
  const thisWeek = weekKey(nowIso, rules);
  const everyone = await store.members();
  type Row = { m: Member; acts: StoredActivity[]; ok: StoredActivity[]; atts: YogaAttempt[]; last: number; joined: number; weekKm: number; totalKm: number };
  const rows: Row[] = [];
  for (const m of everyone) {
    const acts = await store.activities(m.id);
    const ok = acts.filter((a) => earns(a, approvedIds(acts), rules));
    const atts = (await store.attempts(m.id)).filter((a) => a.status === "approved");
    const last = Math.max(0, ...ok.map((a) => Date.parse(a.startTime)), ...atts.map((a) => a.createdAt));
    const joined = Date.parse(m.joinedAt) || 0;
    const weekKm = ok.filter((a) => weekKey(a.startTime, rules) === thisWeek).reduce((x, a) => x + a.distanceM, 0) / 1000;
    const totalKm = ok.reduce((x, a) => x + a.distanceM, 0) / 1000;
    rows.push({ m, acts, ok, atts, last, joined, weekKm, totalKm });
  }
  const visible = rows.filter((r) => r.m.isPublic || r.m.id === viewer?.id);
  const active = [...visible]
    .sort((a, b) =>
      Number(b.m.id === viewer?.id) - Number(a.m.id === viewer?.id) ||
      b.last - a.last ||
      b.joined - a.joined,
    )
    .slice(0, 25);

  const members: WorldMember[] = [];
  for (const r of active) {
    const lvl = await levelOf(store, r.m.id);
    const stats = await memberStats(store, r.m.id);
    const earned = earnedBadges(stats);
    const pinned = (r.m.pinnedBadges.length ? earned.filter((b) => r.m.pinnedBadges.includes(b.key)) : earned.slice(-3)).slice(0, 3);
    const stars = stats.yoga.totalStars;
    members.push({
      id: r.m.id, handle: r.m.handle, name: r.m.displayName, avatar: r.m.avatar, level: lvl.level, title: lvl.title,
      badges: pinned.map((b) => ({ name: b.name, icon: b.icon })), yogaStars: stars, isMe: r.m.id === viewer?.id,
      ranToday: r.ok.some((a) => localDate(a.startTime, rules) === today),
      weekKm: r.weekKm, totalKm: r.totalKm, higroundStarts: stats.higroundStarts,
    });
  }

  const communityKmWeek = rows.reduce((s, r) => s + r.weekKm, 0);
  const communityTotalKm = rows.reduce((s, r) => s + r.totalKm, 0);
  const weekNum = ISO_WEEK(nowIso);

  const weeklyLeaders = (await Promise.all(
    visible.filter((r) => r.m.isPublic).map(async (r) => ({
      handle: r.m.handle,
      name: r.m.displayName,
      avatar: r.m.avatar,
      weekKm: r.weekKm,
      level: (await levelOf(store, r.m.id)).level,
      ranToday: r.ok.some((a) => localDate(a.startTime, rules) === today),
    })),
  )).sort((a, b) => b.weekKm - a.weekKm || b.level - a.level).slice(0, 8);

  // Ticker: runs and yoga claims of the last 36 hours, public members only, newest first.
  const missions = new Map(yoga.levels.flatMap((l) => l.missions).map((m) => [m.key, m.name]));
  const events: { at: number; text: string }[] = [];
  for (const r of visible) {
    const first = r.m.displayName.split(" ")[0];
    const ledger = await store.ledger(r.m.id);
    for (const a of r.ok.filter((x) => Date.parse(x.startTime) >= now - 36 * 3_600_000)) {
      const xp = ledger.filter((e) => e.sourceType === "activity" && e.sourceId === a.id).reduce((s, e) => s + e.amount, 0);
      events.push({ at: Date.parse(a.startTime),
                    text: `${first} baru lari ${fmtKm(a.distanceM / 1000)} km${a.isHigroundStart ? " dari Higround" : ""}! +${xp} XP` });
    }
    for (const a of r.atts.filter((x) => x.createdAt >= now - 36 * 3_600_000 && x.missionKey !== FLOW_KEY)) {
      events.push({ at: a.createdAt, text: `${first} dapat ${a.stars}★ ${missions.get(a.missionKey) ?? a.missionKey}` });
    }
  }

  const me = viewer ? await levelOf(store, viewer.id) : null;
  const meStats = viewer ? await memberStats(store, viewer.id) : null;
  const meCheckins = viewer ? (await store.checkinsOf(viewer.id)).length : 0;
  const rewardInput = viewer && me && meStats ? {
    handle: viewer.handle,
    level: me.level,
    totalXp: me.totalXp,
    totalKm: meStats.totalKm,
    higroundStarts: meStats.higroundStarts,
    yogaTahapCleared: meStats.yoga.tahap.filter((t) => t.cleared).length,
    eventCheckins: meCheckins,
  } : null;

  const ev = await activeEvent(store, now);
  return {
    members,
    hud: {
      week: weekNum,
      communityKmWeek,
      communityTotalKm,
      myXp: me?.totalXp ?? null,
      myLevel: me?.level ?? null,
      myTitle: me?.title ?? null,
      myXpIntoLevel: me?.xpIntoLevel ?? 0,
      myXpToNext: me?.xpToNext ?? null,
      myStreakWeeks: meStats?.bestStreakWeeks ?? 0,
      event: ev ? { id: ev.id, name: ev.name, multiplier: ev.multiplier, description: ev.description } : null,
    },
    ticker: events.sort((a, b) => b.at - a.at).slice(0, 12).map((e) => e.text),
    clubQuest: weeklyClubQuestFor(communityKmWeek, weekNum),
    rukoUpgrade: rukoUpgradeFor(communityTotalKm),
    weeklyLeaders,
    rewards: rewardInput ? { tier: loyaltyTierOf(rewardInput), vouchers: cafeVouchersFor(rewardInput) } : null,
  };
}
