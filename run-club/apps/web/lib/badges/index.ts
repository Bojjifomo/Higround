/**
 * Badges (SPEC §8.3, §9). The catalogue lives in config/badges.json; this decides which ones a member
 * has earned from their numbers. Pure: stats in, badge keys and ledger entries out.
 */
import badgesJson from "../../../../config/badges.json";
import type { LedgerEntry } from "../xp/types";

export type Rarity = "common" | "rare" | "epic" | "legendary";
export type Criteria =
  | { kind: "run_count"; min: number }
  | { kind: "total_km"; min: number }
  | { kind: "single_run_km"; min: number }
  | { kind: "higround_starts"; min: number }
  | { kind: "streak_weeks"; min: number }
  | { kind: "yoga"; key: string };

export interface Badge {
  key: string;
  name: string;
  category: "running" | "distance" | "higround" | "streak" | "yoga" | "event";
  rarity: Rarity;
  xp_reward: number;
  icon: string;
  description: string;
  criteria: Criteria;
  unlock_cosmetic?: string;
}
export interface Cosmetic { key: string; slot: string; name: string; unlock: { level?: number; badge?: string } }

export const catalogue = badgesJson as unknown as { badges: Badge[]; cosmetics: Cosmetic[] };

export interface MemberStats {
  runCount: number;
  totalKm: number;
  longestRunKm: number;
  higroundStarts: number;
  bestStreakWeeks: number;
  yogaBadgeKeys: ReadonlySet<string>;   // from lib/yoga yogaBadges()
}

export function earned(b: Badge, s: MemberStats): boolean {
  const c = b.criteria;
  switch (c.kind) {
    case "run_count": return s.runCount >= c.min;
    case "total_km": return s.totalKm >= c.min;
    case "single_run_km": return s.longestRunKm >= c.min;
    case "higround_starts": return s.higroundStarts >= c.min;
    case "streak_weeks": return s.bestStreakWeeks >= c.min;
    case "yoga": return s.yogaBadgeKeys.has(c.key);
  }
}

export function earnedBadges(s: MemberStats, badges: Badge[] = catalogue.badges): Badge[] {
  return badges.filter((b) => earned(b, s));
}

/** One ledger entry per badge with an XP reward; the key makes the reward a one-off. */
export function badgeXpEntries(userId: string, keys: string[], badges: Badge[] = catalogue.badges): LedgerEntry[] {
  return keys.map((k) => badges.find((b) => b.key === k)).filter((b): b is Badge => !!b && b.xp_reward > 0)
    .map((b) => ({ userId, amount: b.xp_reward, ruleKey: `badge_${b.key}`, sourceType: "badge" as const,
                   sourceId: b.key, idempotencyKey: `badge:${b.key}:${userId}` }));
}

/** Cosmetics unlocked by level or by a badge. */
export function unlockedCosmetics(level: number, badgeKeys: ReadonlySet<string>, cosmetics = catalogue.cosmetics): Cosmetic[] {
  return cosmetics.filter((c) => (c.unlock.level != null && level >= c.unlock.level) ||
                                 (c.unlock.badge != null && badgeKeys.has(c.unlock.badge)));
}
