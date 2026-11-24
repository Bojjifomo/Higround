/**
 * Yoga Quest rules (SPEC §8, config/yoga_quests.json). Pure functions, no I/O.
 *
 * v0.3: no reviewer. A claim is an honest self-report timed by the SERVER (timer started and
 * ended on the server, never a client-sent duration), with a cooldown and a daily cap.
 * Stars per side are stored separately; a per-side mission's stars = min(left, right).
 */
import questJson from "../../../../config/yoga_quests.json";
import type { LedgerEntry } from "../xp/types";

export type Side = "both" | "left" | "right";
export type Stars = 0 | 1 | 2 | 3;

export interface Mission {
  key: string;
  name: string;
  target_s: number;
  per_side: boolean;
  safety_form_first: boolean;
  stars_s: [number, number, number];
  form_cues?: string[];
  note?: string;
}
export interface Tahap {
  level: number;              // "Tahap" in the UI, to keep it apart from the player level
  name: string;
  xp_per_mission: number;
  unlock_needs_missions_at_2_stars: number | null;
  missions: Mission[];
}
export interface BonusMission {
  key: string; name: string; total_s: number; requires_level: number; xp: number;
}
export interface YogaConfig {
  stars: Record<"1" | "2" | "3", number>;
  unlock_rule: { min_ratio_missions_at_2_stars: number };
  xp_by_star_ratio: Record<"1" | "2" | "3", number>;
  requires: { consent_version: number; wa_group: { feature_flag: string; default: boolean; env_url: string } };
  levels: Tahap[];
  bonus_missions: BonusMission[];
  claim: { mode: string; server_timed: boolean; cooldown_minutes_per_mission: number; max_claims_per_day: number;
           per_side_star: string; label: string };
}

export const defaultConfig = questJson as unknown as YogaConfig;

export function findMission(key: string, cfg: YogaConfig = defaultConfig): { mission: Mission; tahap: Tahap } | null {
  for (const tahap of cfg.levels) {
    const mission = tahap.missions.find((m) => m.key === key);
    if (mission) return { mission, tahap };
  }
  return null;
}

// ── stars & XP ────────────────────────────────────────────────────────────────

/** Stars for one hold (one side). Thresholds come from stars_s (50% / 100% / 150% of target). */
export function starsForSeconds(m: Mission, seconds: number): Stars {
  const [s1, s2, s3] = m.stars_s;
  if (seconds >= s3) return 3;
  if (seconds >= s2) return 2;
  if (seconds >= s1) return 1;
  return 0;
}

/** Best stars per side for one mission, as stored. */
export type SideBests = Partial<Record<Side, Stars>>;

/** A mission's stars: per-side missions count their weaker side; others their single best. */
export function missionStars(m: Mission, bests: SideBests | undefined): Stars {
  if (!bests) return 0;
  if (m.per_side) return Math.min(bests.left ?? 0, bests.right ?? 0) as Stars;
  return bests.both ?? 0;
}

export function xpForStars(tahap: Tahap, stars: Stars, cfg: YogaConfig = defaultConfig): number {
  if (stars === 0) return 0;
  return Math.round(tahap.xp_per_mission * cfg.xp_by_star_ratio[String(stars) as "1" | "2" | "3"]);
}

/**
 * Reconcile one mission's yoga XP: what the member should hold for their best stars, minus what the
 * ledger already paid for that mission. Raising stars pays only the difference; an admin rejecting a
 * claim lowers the best stars and produces a negative entry; earning it back pays again.
 * `entriesSoFar` (the number of yoga entries already written for this mission) makes each key unique
 * and the whole thing idempotent: run it twice on the same state and the second run writes nothing.
 */
export function reconcileYogaXp(userId: string, missionKey: string, bestStars: Stars, paidSoFar: number,
                                entriesSoFar: number, cfg: YogaConfig = defaultConfig): LedgerEntry | null {
  const found = findMission(missionKey, cfg);
  if (!found) return null;
  const delta = xpForStars(found.tahap, bestStars, cfg) - paidSoFar;
  if (delta === 0) return null;
  return { userId, amount: delta, ruleKey: delta > 0 ? "yoga_stars" : "yoga_reversal", sourceType: "yoga",
           sourceId: missionKey, idempotencyKey: `yoga:${missionKey}:${userId}:${entriesSoFar + 1}` };
}

// ── progress, unlocks, badges ─────────────────────────────────────────────────

export interface TahapProgress {
  level: number;
  name: string;
  unlocked: boolean;
  missionsAt2: number;
  needed: number;             // missions at ≥2★ to clear this tahap
  cleared: boolean;           // the unlock rule is met (for Tahap 5: 80% at ≥2★)
  perfect: boolean;           // every mission at 3★
  stars: number;              // sum of mission stars
}

export interface YogaProgress {
  tahap: TahapProgress[];
  totalStars: number;
  flowUnlocked: boolean;
}

export function progress(bests: Record<string, SideBests>, cfg: YogaConfig = defaultConfig): YogaProgress {
  const out: TahapProgress[] = [];
  let unlocked: boolean = true;                         // Tahap 1 is always open
  for (const t of cfg.levels) {
    const stars = t.missions.map((m) => missionStars(m, bests[m.key]));
    const missionsAt2 = stars.filter((s) => s >= 2).length;
    const needed = t.unlock_needs_missions_at_2_stars
      ?? Math.ceil(t.missions.length * cfg.unlock_rule.min_ratio_missions_at_2_stars);
    const cleared: boolean = unlocked && missionsAt2 >= needed;
    out.push({ level: t.level, name: t.name, unlocked, missionsAt2, needed, cleared,
               perfect: unlocked && stars.every((s) => s === 3), stars: stars.reduce<number>((a, b) => a + b, 0) });
    unlocked = cleared;
  }
  const flowNeeds = cfg.bonus_missions[0]?.requires_level ?? 2;
  return {
    tahap: out,
    totalStars: out.reduce((s, t) => s + t.stars, 0),
    // "terbuka setelah Tahap 2" = Tahap 2 cleared
    flowUnlocked: out.find((t) => t.level === flowNeeds)?.cleared ?? false,
  };
}

/** Yoga badge keys earned (SPEC §8.3). Pose badges are per mission at ≥2★ in Tahap 4–5. */
export function yogaBadges(p: YogaProgress, bests: Record<string, SideBests>, flowDone: boolean,
                           cfg: YogaConfig = defaultConfig): string[] {
  const out: string[] = [];
  for (const t of p.tahap) {
    if (t.cleared) out.push(`yoga_clear_${t.level}`);
    if (t.perfect) out.push(`yoga_perfect_${t.level}`);
  }
  if (flowDone) out.push("yoga_flow_master");
  for (const t of cfg.levels.filter((t) => t.level >= 4)) {
    for (const m of t.missions) if (missionStars(m, bests[m.key]) >= 2) out.push(`yoga_pose_${m.key}`);
  }
  return out;
}

// ── claims (honor system, server-timed) ───────────────────────────────────────

export interface ClaimInput {
  missionKey: string;
  side: Side;
  /** Server times (ms since epoch) when the timer started and when the claim arrived. */
  timerStartedAt: number;
  now: number;
  consentVersion: number | null;         // version of the safety/honesty consent the member accepted
  formCuesAcknowledged: boolean;          // ticked the form cues before the timer (safety poses)
  waGateEnabled: boolean;                 // feature flag YOGA_WA_GATE
  waVerified: boolean;
  bests: Record<string, SideBests>;       // current best stars per mission and side
  /** Server times (ms) of this member's earlier claims: all of today's, and the last per mission+side. */
  claimsToday: number;
  lastClaimForMissionSide: number | null;
}

export type ClaimResult =
  | { ok: true; measuredS: number; sideStars: Stars; missionStarsBefore: Stars; missionStarsAfter: Stars }
  | { ok: false; error: ClaimError; retryAfterS?: number };

export type ClaimError = "unknown_mission" | "wrong_side" | "locked" | "consent" | "wa_gate" | "form_cues"
  | "cooldown" | "daily_limit" | "too_short";

export function checkClaim(c: ClaimInput, cfg: YogaConfig = defaultConfig): ClaimResult {
  const found = findMission(c.missionKey, cfg);
  if (!found) return { ok: false, error: "unknown_mission" };
  const { mission, tahap } = found;
  if (mission.per_side ? c.side === "both" : c.side !== "both") return { ok: false, error: "wrong_side" };
  if ((c.consentVersion ?? 0) < cfg.requires.consent_version) return { ok: false, error: "consent" };
  if (c.waGateEnabled && !c.waVerified) return { ok: false, error: "wa_gate" };
  const p = progress(c.bests, cfg);
  if (!p.tahap.find((t) => t.level === tahap.level)?.unlocked) return { ok: false, error: "locked" };
  if (mission.safety_form_first && !c.formCuesAcknowledged) return { ok: false, error: "form_cues" };
  if (c.claimsToday >= cfg.claim.max_claims_per_day) return { ok: false, error: "daily_limit" };
  if (c.lastClaimForMissionSide != null) {
    const wait = cfg.claim.cooldown_minutes_per_mission * 60_000 - (c.now - c.lastClaimForMissionSide);
    if (wait > 0) return { ok: false, error: "cooldown", retryAfterS: Math.ceil(wait / 1000) };
  }
  const measuredS = Math.floor((c.now - c.timerStartedAt) / 1000);
  const sideStars = starsForSeconds(mission, measuredS);
  if (sideStars === 0) return { ok: false, error: "too_short" };
  const before = missionStars(mission, c.bests[mission.key]);
  const prevSide = c.bests[mission.key]?.[c.side] ?? 0;
  const nextBests = { ...c.bests, [mission.key]: { ...c.bests[mission.key], [c.side]: Math.max(prevSide, sideStars) as Stars } };
  return { ok: true, measuredS, sideStars, missionStarsBefore: before, missionStarsAfter: missionStars(mission, nextBests[mission.key]) };
}

/** The flow challenge pays its flat XP once, when held for its full time after Tahap 2 is cleared. */
export function checkFlow(p: YogaProgress, timerStartedAt: number, now: number, cfg: YogaConfig = defaultConfig):
  { ok: true; entry: Omit<LedgerEntry, "userId" | "idempotencyKey"> } | { ok: false; error: "locked" | "too_short" } {
  const b = cfg.bonus_missions[0];
  if (!p.flowUnlocked) return { ok: false, error: "locked" };
  if ((now - timerStartedAt) / 1000 < b.total_s) return { ok: false, error: "too_short" };
  return { ok: true, entry: { amount: b.xp, ruleKey: "yoga_flow", sourceType: "yoga", sourceId: b.key } };
}
