const nf1 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 1 });
const nf0 = new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 });

export const km = (v: number) => nf1.format(v);
export const int = (v: number) => nf0.format(v);

/** 330 → "5:30" */
export function pace(sPerKm: number | null | undefined): string {
  if (!sPerKm) return "–";
  const s = Math.round(sPerKm);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

/** 3725 → "1:02:05", 1500 → "25:00" */
export function duration(s: number): string {
  const t = Math.round(s);
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), sec = t % 60;
  const mm = String(m).padStart(h ? 2 : 1, "0"), ss = String(sec).padStart(2, "0");
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const dShort = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" });
const dLong = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const dateShort = (iso: string) => dShort.format(new Date(iso.length === 10 ? iso + "T00:00:00+07:00" : iso));
export const dateLong = (iso: string | number) => dLong.format(new Date(iso));

export const PB_LABEL = { "5k": "5K", "10k": "10K", half: "Half Marathon", full: "Marathon" } as const;

export const RULE_LABEL: Record<string, string> = {
  distance: "Jarak", elevation: "Elevasi", higround_start: "Start dari Higround", consistency: "Konsistensi mingguan",
  streak: "Streak", yoga_stars: "Yoga Quest", yoga_reversal: "Yoga Quest (dibatalkan)", yoga_flow: "Flow Challenge",
};
export function ruleLabel(key: string): string {
  if (RULE_LABEL[key]) return RULE_LABEL[key];
  if (key.startsWith("weekly_tier_")) return `Mileage mingguan ${key.slice(12)} km`;
  if (key.startsWith("long_run_")) return `Long run ≥${key.slice(9).replace(".", ",")} km`;
  if (key.startsWith("pb_")) return `Personal best ${PB_LABEL[key.slice(3) as keyof typeof PB_LABEL] ?? key.slice(3)}`;
  if (key.startsWith("badge_")) return "Badge";
  return key;
}
