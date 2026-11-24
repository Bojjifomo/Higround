/**
 * Run XP rule engine (SPEC §7). Pure functions: rules come in as data (config/xp_rules.json),
 * activities come in as plain objects, ledger entries come out. No clock, no I/O.
 *
 * Every entry carries an idempotency key, so the sync pipeline can recompute and upsert freely:
 * the database's unique index on xp_ledger.idempotency_key makes a second payout impossible.
 */
import rulesJson from "../../../../config/xp_rules.json";
import type { Activity, Eligibility, LedgerEntry, PbKey, XpRules } from "./types";

export * from "./types";
export const defaultRules = rulesJson as XpRules;

// ── time (WIB) ────────────────────────────────────────────────────────────────

/** Local calendar date (YYYY-MM-DD) of an instant in the rules' timezone. */
export function localDate(iso: string, rules: XpRules = defaultRules): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: rules.timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(new Date(iso));
  const get = (t: string) => parts.find((p) => p.type === t)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** Monday (YYYY-MM-DD) of the local week that contains the instant. Weeks run Mon–Sun. */
export function weekKey(iso: string, rules: XpRules = defaultRules): string {
  const d = new Date(localDate(iso, rules) + "T00:00:00Z");
  const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

// ── geography ─────────────────────────────────────────────────────────────────

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371008.8;
  const rad = Math.PI / 180;
  const dLat = (lat2 - lat1) * rad;
  const dLng = (lng2 - lng1) * rad;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Started within the Higround radius, on a type that can earn the bonus. */
export function isHigroundStart(a: Activity, rules: XpRules = defaultRules): boolean {
  const h = rules.higround_start;
  if (h.excluded_types.includes(a.type)) return false;
  if (a.startLat == null || a.startLng == null) return false;
  return haversineM(a.startLat, a.startLng, h.lat, h.lng) <= h.radius_m;
}

// ── eligibility & anti-cheat ──────────────────────────────────────────────────

export function eligibility(a: Activity, rules: XpRules = defaultRules): Eligibility {
  const reasons: string[] = [];
  if (!rules.counted_types.includes(a.type)) return { counted: false, flagged: false, reasons: ["type"] };
  if (a.source && rules.ignored_sources.includes(a.source.toUpperCase())) {
    return { counted: false, flagged: false, reasons: ["strava"] };
  }
  if (rules.anti_cheat.require_device_source && !a.deviceName) {
    return { counted: false, flagged: false, reasons: ["no_device"] };
  }
  const ac = rules.anti_cheat;
  const km = a.distanceM / 1000;
  if (km > 0 && a.movingTimeS > 0 && a.movingTimeS / km < ac.flag_if_avg_pace_faster_than_s_per_km) {
    reasons.push("pace_too_fast");
  }
  if (a.maxSpeedKmh != null && a.maxSpeedKmh > ac.flag_if_max_speed_kmh_over) reasons.push("max_speed");
  if (km > ac.flag_if_distance_km_over) reasons.push("distance");
  return { counted: true, flagged: reasons.length > 0, reasons };
}

// ── per-activity XP ───────────────────────────────────────────────────────────

const PB_DISTANCE_M: Record<PbKey, number> = { "5k": 5000, "10k": 10000, half: 21097.5, full: 42195 };

/**
 * Times (s) this activity set for each PB distance. Uses the provider's best efforts when present;
 * otherwise an activity whose total distance is within +5% of a standard distance counts as an
 * effort at that distance with its whole moving time (a race or time trial).
 */
export function effortsOf(a: Activity): Partial<Record<PbKey, number>> {
  if (a.bestEffortsS) return a.bestEffortsS;
  const out: Partial<Record<PbKey, number>> = {};
  for (const k of Object.keys(PB_DISTANCE_M) as PbKey[]) {
    const d = PB_DISTANCE_M[k];
    if (a.distanceM >= d && a.distanceM <= d * 1.05 && a.movingTimeS > 0) out[k] = a.movingTimeS;
  }
  return out;
}

export interface ActivityContext {
  /** Higround bonuses already paid on this local day (from earlier activities). */
  higroundBonusesToday: number;
  /** Best times (s) before this activity. A PB pays only when it beats an existing best. */
  previousBests: Partial<Record<PbKey, number>>;
}

/** XP entries for one activity. Flagged or uncounted activities earn nothing yet. */
export function activityXp(a: Activity, ctx: ActivityContext, rules: XpRules = defaultRules): LedgerEntry[] {
  const el = eligibility(a, rules);
  if (!el.counted || el.flagged) return [];
  const out: LedgerEntry[] = [];
  const add = (ruleKey: string, amount: number) => {
    if (amount > 0) {
      out.push({ userId: a.userId, amount, ruleKey, sourceType: "activity", sourceId: a.id,
                 idempotencyKey: `${ruleKey}:${a.id}` });
    }
  };
  const km = a.distanceM / 1000;
  const g = rules.distance.granularity_km;
  const steps = Math.floor(km / g + 1e-9);            // whole 0.1 km steps
  let distanceXp = Math.floor(steps * g * rules.distance.xp_per_km + 1e-9);

  const h = rules.higround_start;
  const higround = isHigroundStart(a, rules) && ctx.higroundBonusesToday < h.max_per_day;
  if (higround) distanceXp = Math.floor(distanceXp * h.distance_xp_multiplier + 1e-9);
  add("distance", distanceXp);
  if (higround) add("higround_start", h.flat_xp);

  if (rules.elevation.types.includes(a.type)) {
    add("elevation", Math.floor(a.elevGainM / 10) * rules.elevation.xp_per_10m);
  }
  const tier = [...rules.long_run].sort((x, y) => y.min_km - x.min_km).find((t) => km >= t.min_km);
  if (tier) add(`long_run_${tier.min_km}`, tier.xp);

  for (const [k, s] of Object.entries(effortsOf(a)) as [PbKey, number][]) {
    const prev = ctx.previousBests[k];
    if (prev != null && s < prev) add(`pb_${k}`, rules.personal_best[k]);
  }
  return out;
}

// ── weekly XP ─────────────────────────────────────────────────────────────────

/**
 * Weekly bonuses for one user and one week (Mon–Sun, local): every mileage tier reached
 * (cumulative), consistency, and the streak bonus. `streakWeeks` counts consecutive weeks with
 * at least one counted run, this week included (see streakWeeks()).
 */
export function weeklyXp(userId: string, week: string, weekActivities: Activity[], streak: number,
                         rules: XpRules = defaultRules): LedgerEntry[] {
  const counted = weekActivities.filter((a) => {
    const e = eligibility(a, rules);
    return e.counted && !e.flagged;
  });
  const out: LedgerEntry[] = [];
  const add = (ruleKey: string, amount: number) => {
    if (amount > 0) {
      out.push({ userId, amount, ruleKey, sourceType: "week", sourceId: week,
                 idempotencyKey: `${ruleKey}:${userId}:${week}` });
    }
  };
  const km = counted.reduce((s, a) => s + a.distanceM, 0) / 1000;
  for (const t of rules.weekly_mileage_tiers) if (km >= t.km) add(`weekly_tier_${t.km}`, t.xp);
  const days = new Set(counted.map((a) => localDate(a.startTime, rules))).size;
  if (days >= rules.consistency.min_run_days_per_week) add("consistency", rules.consistency.xp);
  if (counted.length > 0 && streak > 0) {
    add("streak", Math.min(rules.streak.xp_per_week_in_streak * streak, rules.streak.max_xp));
  }
  return out;
}

/** Consecutive weeks ending at `week` (inclusive) that contain a counted run. */
export function streakWeeks(week: string, activities: Activity[], rules: XpRules = defaultRules): number {
  const weeks = new Set(activities.filter((a) => {
    const e = eligibility(a, rules);
    return e.counted && !e.flagged;
  }).map((a) => weekKey(a.startTime, rules)));
  let n = 0;
  for (let w = week; weeks.has(w); w = addDays(w, -7)) n++;
  return n;
}

// ── whole history ─────────────────────────────────────────────────────────────

/**
 * Every ledger entry one user's history earns, in chronological order. Used for backfill and
 * for tests; the live pipeline upserts the same entries (same keys) as activities arrive.
 * `completedWeeksBefore` limits weekly bonuses to weeks that have ended (the Monday job).
 */
export function ledgerFor(userId: string, activities: Activity[], completedWeeksBefore: string,
                          rules: XpRules = defaultRules): LedgerEntry[] {
  const mine = activities.filter((a) => a.userId === userId)
    .sort((x, y) => Date.parse(x.startTime) - Date.parse(y.startTime));
  const out: LedgerEntry[] = [];
  const bests: Partial<Record<PbKey, number>> = {};
  const higroundByDay = new Map<string, number>();
  for (const a of mine) {
    const day = localDate(a.startTime, rules);
    const entries = activityXp(a, { higroundBonusesToday: higroundByDay.get(day) ?? 0, previousBests: { ...bests } }, rules);
    out.push(...entries);
    if (entries.some((e) => e.ruleKey === "higround_start")) higroundByDay.set(day, (higroundByDay.get(day) ?? 0) + 1);
    const el = eligibility(a, rules);
    if (el.counted && !el.flagged) {
      for (const [k, s] of Object.entries(effortsOf(a)) as [PbKey, number][]) {
        if (bests[k] == null || s < bests[k]!) bests[k] = s;
      }
    }
  }
  const weeks = [...new Set(mine.map((a) => weekKey(a.startTime, rules)))].sort();
  for (const w of weeks) {
    if (w >= completedWeeksBefore) continue;
    const inWeek = mine.filter((a) => weekKey(a.startTime, rules) === w);
    out.push(...weeklyXp(userId, w, inWeek, streakWeeks(w, mine, rules), rules));
  }
  return out;
}

// ── levels ────────────────────────────────────────────────────────────────────

/** Total XP needed to reach level n: 40 × (n − 1)². */
export function xpForLevel(n: number): number {
  return 40 * (n - 1) ** 2;
}

export interface LevelInfo {
  level: number;
  title: string;
  totalXp: number;
  xpIntoLevel: number;
  xpToNext: number | null;    // null at max level
}

export function levelFor(totalXp: number, rules: XpRules = defaultRules): LevelInfo {
  const max = rules.level_curve.max_level;
  let level = Math.floor(Math.sqrt(Math.max(0, totalXp) / 40)) + 1;
  while (level > 1 && xpForLevel(level) > totalXp) level--;      // guard float edges
  while (level < max && xpForLevel(level + 1) <= totalXp) level++;
  level = Math.min(level, max);
  const title = [...rules.titles].sort((x, y) => y.from - x.from).find((t) => level >= t.from)!.title;
  return {
    level, title, totalXp,
    xpIntoLevel: totalXp - xpForLevel(level),
    xpToNext: level >= max ? null : xpForLevel(level + 1) - totalXp,
  };
}
