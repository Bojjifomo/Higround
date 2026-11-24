// Shapes shared by the XP rule engine. Pure data, no I/O.

export interface XpRules {
  timezone: string;
  counted_types: string[];
  ignored_sources: string[];
  distance: { xp_per_km: number; granularity_km: number };
  elevation: { xp_per_10m: number; types: string[] };
  long_run: { min_km: number; xp: number }[];
  weekly_mileage_tiers: { km: number; xp: number }[];
  consistency: { min_run_days_per_week: number; xp: number };
  streak: { xp_per_week_in_streak: number; max_xp: number };
  higround_start: {
    lat: number;
    lng: number;
    radius_m: number;
    distance_xp_multiplier: number;
    flat_xp: number;
    max_per_day: number;
    excluded_types: string[];
  };
  personal_best: Record<PbKey, number>;
  anti_cheat: {
    flag_if_avg_pace_faster_than_s_per_km: number;
    flag_if_max_speed_kmh_over: number;
    flag_if_distance_km_over: number;
    require_device_source: boolean;
  };
  level_curve: { formula: string; max_level: number };
  titles: { from: number; title: string }[];
}

export type PbKey = "5k" | "10k" | "half" | "full";

/** One activity as the app stores it (provider-neutral). */
export interface Activity {
  id: string;                 // provider activity id
  userId: string;
  type: string;               // Run, TrailRun, VirtualRun, Ride, ...
  source: string | null;      // GARMIN_CONNECT, COROS, STRAVA, MANUAL, ...
  deviceName: string | null;
  startTime: string;          // ISO 8601 with offset or Z
  distanceM: number;
  movingTimeS: number;
  elevGainM: number;
  maxSpeedKmh: number | null;
  startLat: number | null;
  startLng: number | null;
  /** The run's title from the provider, when it has one. */
  name?: string | null;
  /** Fastest time (s) over each standard distance inside this activity, when the provider has it. */
  bestEffortsS?: Partial<Record<PbKey, number>>;
}

export interface LedgerEntry {
  userId: string;
  amount: number;
  ruleKey: string;            // e.g. "distance", "weekly_tier_20", "pb_5k"
  sourceType: "activity" | "week" | "yoga" | "badge" | "event";
  sourceId: string;           // activity id, ISO week key, ...
  idempotencyKey: string;     // unique per (rule, source): re-running never pays twice
}

export interface Eligibility {
  counted: boolean;           // false = ignored entirely (wrong type, Strava stub, no device)
  flagged: boolean;           // counted but XP held until an admin reviews it
  reasons: string[];
}
