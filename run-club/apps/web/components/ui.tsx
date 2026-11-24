import type { Badge } from "@/lib/badges";

/** Kairosoft-style panel: cream card, thick orange border (SPEC §5). */
export function Panel({ title, children, className = "", aside, id }: {
  title?: string; children: React.ReactNode; className?: string; aside?: React.ReactNode; id?: string;
}) {
  return (
    <section id={id} className={`rounded-lg border-4 border-hg-orange bg-[#FFFDF7] p-4 shadow-[4px_4px_0_#111] ${className}`}>
      {title && (
        <div className="mb-3 flex items-baseline justify-between gap-2">
          <h2 className="font-pixel text-xl leading-none">{title}</h2>
          {aside}
        </div>
      )}
      {children}
    </section>
  );
}

export function Stat({ value, unit, label }: { value: string; unit?: string; label: string }) {
  return (
    <div>
      <div className="text-2xl font-black tabular-nums leading-tight">{value}{unit && <span className="ml-1 text-sm font-bold">{unit}</span>}</div>
      <div className="text-xs text-neutral-600">{label}</div>
    </div>
  );
}

export function Stars({ n, of = 3, label }: { n: number; of?: number; label?: string }) {
  return (
    <span className="whitespace-nowrap" aria-label={label ?? `${n} dari ${of} bintang`}>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} aria-hidden className={i < n ? "text-[#E0A800]" : "text-neutral-300"}>★</span>
      ))}
    </span>
  );
}

const ICON: Record<string, string> = {
  shoe: "👟", road: "🛣️", medal: "🏅", pin: "📍", flame: "🔥", lotus: "🪷", star: "🌟", wave: "🌊", pose: "🤸",
};
const RARITY: Record<string, string> = {
  common: "border-neutral-400", rare: "border-hg-navy", epic: "border-hg-violet", legendary: "border-hg-orange",
};

export function BadgeChip({ badge, earned = true }: { badge: Badge; earned?: boolean }) {
  return (
    <div title={`${badge.name}: ${badge.description}${badge.xp_reward ? ` (+${badge.xp_reward} XP)` : ""}`}
         className={`flex items-center gap-2 rounded-md border-2 bg-white px-2 py-1 text-xs ${RARITY[badge.rarity]} ${earned ? "" : "opacity-40 grayscale"}`}>
      <span aria-hidden className="text-base">{ICON[badge.icon] ?? "🏷️"}</span>
      <span className="font-bold leading-tight">{badge.name}</span>
      {!earned && <span className="sr-only">(belum didapat)</span>}
    </div>
  );
}

export function XpBar({ into, toNext, level }: { into: number; toNext: number | null; level: number }) {
  const pct = toNext === null ? 100 : Math.round((into / (into + toNext)) * 100);
  return (
    <div>
      <div className="h-3 w-full overflow-hidden rounded-full border-2 border-black bg-white" role="progressbar"
           aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`Progres ke level ${level + 1}`}>
        <div className="h-full bg-hg-yellow" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1 text-xs text-neutral-600">
        {toNext === null ? "Level maksimal" : `${toNext.toLocaleString("id-ID")} XP lagi ke Lv ${level + 1}`}
      </div>
    </div>
  );
}

export function Button({ children, variant = "primary", ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger";
}) {
  const style = {
    primary: "bg-hg-orange text-white border-black shadow-[3px_3px_0_#111] hover:translate-x-[-1px] hover:translate-y-[-1px]",
    ghost: "bg-white text-black border-black",
    danger: "bg-white text-hg-red border-hg-red",
  }[variant];
  return (
    <button {...rest}
            className={`rounded-md border-2 px-3 py-1.5 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${style} ${rest.className ?? ""}`}>
      {children}
    </button>
  );
}
