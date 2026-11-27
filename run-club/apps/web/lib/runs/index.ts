/**
 * Pure running & walking analytics helpers (Roadmap v4 — Fase C):
 * - Walk activity recognition (shown in profile dashboard & 31-day heatmap, excluded from Run Leaderboard)
 * - 6 Personal Best (PB) badges: 1K, 5K, 10K, 21K (HM), 42K (FM), 50K (Ultra)
 * - 31-day activity heatmap builder (WIB calendar)
 * - Privacy-safe Run Buddy / Group Run detector (same WIB day, <=15m start diff, <=250m start distance;
 *   GPS coordinates are never exposed in the output)
 */
import type { Avatar, Member, StoredActivity } from "../data/store";
import { defaultRules as rules, earns, haversineM, localDate, type XpRules } from "../xp";

export const WALK_TYPES = new Set(["Walk", "Hike"]);
export const RUN_BUDDY_MAX_TIME_DIFF_MS = 15 * 60_000;
export const RUN_BUDDY_MAX_DISTANCE_M = 250;

export function isWalkActivity(a: Pick<StoredActivity, "type" | "source" | "distanceM">): boolean {
  if (!WALK_TYPES.has(a.type)) return false;
  if (a.source && rules.ignored_sources.includes(a.source.toUpperCase())) return false;
  return a.distanceM > 0;
}

// ── 6 Personal Best (PB) Badges: 1K, 5K, 10K, 21K, 42K, 50K ───────────────────

export type ProfilePbKey = "1k" | "5k" | "10k" | "half" | "full" | "50k";

export interface PbBadgeSpec {
  key: ProfilePbKey;
  shortLabel: string;
  name: string;
  distanceM: number;
  icon: string;
  accent: string;
  bg: string;
  rarity: "common" | "rare" | "epic" | "legendary";
}

export const PB_BADGE_SPECS: readonly PbBadgeSpec[] = [
  { key: "1k", shortLabel: "1K", name: "PB 1K", distanceM: 1000, icon: "⚡", accent: "#FF5F0E", bg: "#FFF1E6", rarity: "common" },
  { key: "5k", shortLabel: "5K", name: "PB 5K", distanceM: 5000, icon: "🏃", accent: "#2F7D4B", bg: "#EAF7EF", rarity: "common" },
  { key: "10k", shortLabel: "10K", name: "PB 10K", distanceM: 10000, icon: "🔥", accent: "#2E3A8C", bg: "#EDF0FF", rarity: "rare" },
  { key: "half", shortLabel: "21K", name: "PB 21K (HM)", distanceM: 21097.5, icon: "🏅", accent: "#4B4FB8", bg: "#F1EEFF", rarity: "epic" },
  { key: "full", shortLabel: "42K", name: "PB 42K (FM)", distanceM: 42195, icon: "👑", accent: "#D97706", bg: "#FFF8DC", rarity: "legendary" },
  { key: "50k", shortLabel: "50K", name: "PB 50K (Ultra)", distanceM: 50000, icon: "🐉", accent: "#1F1F24", bg: "#FDE8C8", rarity: "legendary" },
] as const;

export interface ProfilePbResult {
  key: ProfilePbKey;
  timeS: number;
  activityId: string;
  startTime: string;
  estimated: boolean;
}

/**
 * Compute best times across all 6 PB distances (1K, 5K, 10K, 21K, 42K, 50K) from counted runs.
 * - Uses provider `bestEffortsS` when present (`5k`, `10k`, `half`, `full`)
 * - Uses exact-window race runs (`1.00× .. 1.05×` target distance) for any distance
 * - For `1k` (where standalone 1 km runs are rare), falls back to fastest average 1 km split across runs >= 1 km
 */
export function computeProfilePbs(
  countedRuns: StoredActivity[],
): Partial<Record<ProfilePbKey, ProfilePbResult>> {
  const best: Partial<Record<ProfilePbKey, ProfilePbResult>> = {};
  const consider = (key: ProfilePbKey, timeS: number, a: StoredActivity, estimated: boolean) => {
    if (!Number.isFinite(timeS) || timeS <= 0) return;
    const cur = best[key];
    // Prefer exact over estimated only when times are comparable; otherwise fastest valid time wins
    if (!cur || (!estimated && cur.estimated) || (estimated === cur.estimated && timeS < cur.timeS)) {
      best[key] = { key, timeS: Math.round(timeS), activityId: a.id, startTime: a.startTime, estimated };
    }
  };

  for (const a of countedRuns) {
    if (a.movingTimeS <= 0 || a.distanceM <= 0) continue;
    // Provider best efforts (exact)
    if (a.bestEffortsS) {
      for (const k of ["5k", "10k", "half", "full"] as const) {
        const s = a.bestEffortsS[k];
        if (s && s > 0) consider(k, s, a, false);
      }
    }
    // Race-window check (1.00x to 1.05x distance) for all 6 PB distances
    for (const spec of PB_BADGE_SPECS) {
      if (a.distanceM >= spec.distanceM && a.distanceM <= spec.distanceM * 1.05) {
        consider(spec.key, a.movingTimeS, a, false);
      }
    }
    // 1K fallback: fastest average 1 km pace on any run >= 1 km
    if (a.distanceM >= 1000) {
      const avg1k = a.movingTimeS / (a.distanceM / 1000);
      consider("1k", avg1k, a, true);
    }
  }
  return best;
}

// ── 31-Day Heatmap Builder (Last 1 Month = 31 Calendar Days in WIB) ───────────

export interface HeatmapDay {
  day: string;      // YYYY-MM-DD (WIB)
  runKm: number;
  walkKm: number;
  totalKm: number;
  runCount: number;
  walkCount: number;
}

function addDays(day: string, n: number): string {
  const d = new Date(day + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function buildLast31DaysHeatmap(
  countedRuns: StoredActivity[],
  walkActs: StoredActivity[],
  now: number,
  r: XpRules = rules,
): HeatmapDay[] {
  const today = localDate(new Date(now).toISOString(), r);
  const start = addDays(today, -30); // 30 days ago .. today = exactly 31 days
  const byDay = new Map<string, HeatmapDay>();
  const out: HeatmapDay[] = [];
  for (let i = 0; i < 31; i++) {
    const day = addDays(start, i);
    const entry: HeatmapDay = { day, runKm: 0, walkKm: 0, totalKm: 0, runCount: 0, walkCount: 0 };
    byDay.set(day, entry);
    out.push(entry);
  }
  for (const a of countedRuns) {
    const bucket = byDay.get(localDate(a.startTime, r));
    if (bucket) {
      const km = a.distanceM / 1000;
      bucket.runKm += km;
      bucket.totalKm += km;
      bucket.runCount += 1;
    }
  }
  for (const a of walkActs) {
    const bucket = byDay.get(localDate(a.startTime, r));
    if (bucket) {
      const km = a.distanceM / 1000;
      bucket.walkKm += km;
      bucket.totalKm += km;
      bucket.walkCount += 1;
    }
  }
  return out;
}

// ── Privacy-Safe Run Buddy / Group Run Detection ──────────────────────────────

export interface RunBuddy {
  userId: string;
  handle: string;
  displayName: string;
  avatar: Avatar;
  atHiground: boolean;
}

export interface MemberActivityBundle {
  member: Pick<Member, "id" | "handle" | "displayName" | "avatar" | "isPublic">;
  activities: StoredActivity[];
}

/**
 * Detect which other visible members ran together with each activity of `ownerId`.
 * Matching criteria (server-side only; GPS coordinates are NEVER returned):
 * - Different members
 * - Both activities are counted runs (not Strava, not rejected)
 * - Same WIB calendar date
 * - |startTimeA - startTimeB| <= 15 minutes
 * - Both have GPS start coordinates within <= 250 m (Haversine) — works at Higround AND anywhere else!
 */
export function detectRunBuddiesForMember(
  ownerId: string,
  ownerActs: StoredActivity[],
  allBundles: MemberActivityBundle[],
  r: XpRules = rules,
): Map<string, RunBuddy[]> {
  const result = new Map<string, RunBuddy[]>();
  const approvedFor = (acts: StoredActivity[]) =>
    new Set(acts.filter((a) => a.reviewStatus === "approved").map((a) => a.id));

  const ownerApproved = approvedFor(ownerActs);
  const ownerValid = ownerActs.filter(
    (a) => earns(a, ownerApproved, r) && a.startLat != null && a.startLng != null,
  );
  if (ownerValid.length === 0) return result;

  // Pre-index other public members' valid runs by WIB date for fast O(N) lookup
  type Candidate = {
    member: MemberActivityBundle["member"];
    startMs: number;
    lat: number;
    lng: number;
    atHiground: boolean;
  };
  const byDate = new Map<string, Candidate[]>();

  for (const bundle of allBundles) {
    if (bundle.member.id === ownerId) continue;
    if (!bundle.member.isPublic) continue;
    const app = approvedFor(bundle.activities);
    for (const a of bundle.activities) {
      if (!earns(a, app, r) || a.startLat == null || a.startLng == null) continue;
      const d = localDate(a.startTime, r);
      const list = byDate.get(d) ?? [];
      list.push({
        member: bundle.member,
        startMs: Date.parse(a.startTime),
        lat: a.startLat,
        lng: a.startLng,
        atHiground: a.isHigroundStart,
      });
      byDate.set(d, list);
    }
  }

  for (const mine of ownerValid) {
    const d = localDate(mine.startTime, r);
    const candidates = byDate.get(d);
    if (!candidates || candidates.length === 0) continue;
    const myMs = Date.parse(mine.startTime);
    const seenUsers = new Set<string>();
    const buddies: RunBuddy[] = [];

    for (const c of candidates) {
      if (seenUsers.has(c.member.id)) continue;
      if (Math.abs(myMs - c.startMs) > RUN_BUDDY_MAX_TIME_DIFF_MS) continue;
      const dist = haversineM(mine.startLat!, mine.startLng!, c.lat, c.lng);
      if (dist <= RUN_BUDDY_MAX_DISTANCE_M) {
        seenUsers.add(c.member.id);
        buddies.push({
          userId: c.member.id,
          handle: c.member.handle,
          displayName: c.member.displayName,
          avatar: c.member.avatar,
          atHiground: mine.isHigroundStart || c.atHiground,
        });
      }
    }

    if (buddies.length > 0) {
      result.set(mine.id, buddies);
    }
  }

  return result;
}
