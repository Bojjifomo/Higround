"use client";
/**
 * Run dashboard charts: weekly mileage (bars), weekly pace (line, faster = higher) and a 12-week calendar.
 * Single series each, so no legend; the title names the series. Hover or focus shows the exact value,
 * and every chart has a table view.
 */
import { useState } from "react";
import { dateShort, km, pace } from "@/lib/format";

const BAR = "#E0530A";          // brand orange, darkened to keep 3:1 on the panel
const LINE = "#4B4FB8";         // brand violet
const HEAT = ["#EFE6D3", "#F9D3B8", "#F2A472", "#E0530A", "#9C3A06"];   // rest → 15+ km

interface Week { week: string; km: number; paceSPerKm: number | null; runs: number }

function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded bg-black px-2 py-1 text-xs text-white shadow"
         style={{ left: `${x}%`, top: y }}>{children}</div>
  );
}

function TableToggle({ children }: { children: React.ReactNode }) {
  return (
    <details className="mt-2 text-xs">
      <summary className="cursor-pointer text-neutral-500">Lihat sebagai tabel</summary>
      {children}
    </details>
  );
}

const niceMax = (v: number) => {
  const step = v <= 20 ? 5 : v <= 60 ? 10 : 20;
  return Math.max(step, Math.ceil(v / step) * step);
};

export function WeeklyKm({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 480, H = 170, L = 30, B = 22, T = 8;
  const max = niceMax(Math.max(...weeks.map((w) => w.km)));
  const bw = (W - L) / weeks.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / max);
  const ticks = [0, max / 2, max];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Kilometer per minggu, 12 minggu terakhir">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W} y1={y(t)} y2={y(t)} stroke="#E7DCC4" />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#6b6257">{t}</text>
          </g>
        ))}
        {weeks.map((w, i) => {
          const x = L + i * bw + 3, h = y(0) - y(w.km), r = Math.min(4, h / 2);
          return (
            <g key={w.week} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
               onFocus={() => setHover(i)} onBlur={() => setHover(null)} tabIndex={0}
               aria-label={`Minggu ${dateShort(w.week)}: ${km(w.km)} km`}>
              <rect x={L + i * bw} y={T} width={bw} height={H - T - B} fill="transparent" />
              {h > 0 && (
                <path d={`M${x},${y(0)} V${y(w.km) + r} Q${x},${y(w.km)} ${x + r},${y(w.km)} H${x + bw - 6 - r} Q${x + bw - 6},${y(w.km)} ${x + bw - 6},${y(w.km) + r} V${y(0)} Z`}
                      fill={BAR} opacity={hover === null || hover === i ? 1 : 0.55} />
              )}
              {i % 3 === 0 && <text x={x + (bw - 6) / 2} y={H - 6} textAnchor="middle" fontSize="11" fill="#6b6257">{dateShort(w.week)}</text>}
            </g>
          );
        })}
      </svg>
      {hover !== null && (
        <Tip x={((L + (hover + 0.5) * bw) / W) * 100} y={(y(weeks[hover].km) / H) * 100}>
          <b>{km(weeks[hover].km)} km</b> · {weeks[hover].runs} lari<br />minggu {dateShort(weeks[hover].week)}
        </Tip>
      )}
      <TableToggle>
        <table className="mt-1 w-full">
          <thead><tr className="text-left text-neutral-500"><th>Minggu</th><th className="text-right">Km</th><th className="text-right">Lari</th><th className="text-right">Pace</th></tr></thead>
          <tbody>{weeks.map((w) => (
            <tr key={w.week}><td>{dateShort(w.week)}</td><td className="text-right tabular-nums">{km(w.km)}</td>
              <td className="text-right tabular-nums">{w.runs}</td><td className="text-right tabular-nums">{pace(w.paceSPerKm)}</td></tr>
          ))}</tbody>
        </table>
      </TableToggle>
    </div>
  );
}

export function PaceTrend({ weeks }: { weeks: Week[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const pts = weeks.map((w, i) => ({ i, w })).filter((p) => p.w.paceSPerKm);
  if (pts.length < 2) return <p className="text-sm text-neutral-500">Butuh minimal 2 minggu dengan lari.</p>;
  const W = 480, H = 170, L = 40, B = 22, T = 14;
  const vals = pts.map((p) => p.w.paceSPerKm!);
  const lo = Math.min(...vals) - 10, hi = Math.max(...vals) + 10;
  const x = (i: number) => L + ((W - L - 10) * i) / (weeks.length - 1);
  const y = (s: number) => T + (H - T - B) * ((s - lo) / (hi - lo));       // faster (smaller) = higher
  const d = pts.map((p, k) => `${k ? "L" : "M"}${x(p.i).toFixed(1)},${y(p.w.paceSPerKm!).toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Pace rata-rata per minggu">
        {[lo + 10, (lo + hi) / 2, hi - 10].map((s) => (
          <g key={s}>
            <line x1={L} x2={W} y1={y(s)} y2={y(s)} stroke="#E7DCC4" />
            <text x={L - 6} y={y(s) + 4} textAnchor="end" fontSize="11" fill="#6b6257">{pace(s)}</text>
          </g>
        ))}
        <path d={d} fill="none" stroke={LINE} strokeWidth="2" strokeLinejoin="round" />
        {pts.map((p) => (
          <g key={p.i} onMouseEnter={() => setHover(p.i)} onMouseLeave={() => setHover(null)} tabIndex={0}
             onFocus={() => setHover(p.i)} onBlur={() => setHover(null)} aria-label={`Minggu ${dateShort(p.w.week)}: ${pace(p.w.paceSPerKm)} per km`}>
            <circle cx={x(p.i)} cy={y(p.w.paceSPerKm!)} r="12" fill="transparent" />
            <circle cx={x(p.i)} cy={y(p.w.paceSPerKm!)} r={p === last ? 5 : 3.5} fill={LINE} stroke="#FFFDF7" strokeWidth="2" />
          </g>
        ))}
        <text x={x(last.i) - 8} y={y(last.w.paceSPerKm!) - 10} textAnchor="end" fontSize="12" fontWeight="700" fill="#111">{pace(last.w.paceSPerKm)}</text>
      </svg>
      {hover !== null && weeks[hover].paceSPerKm && (
        <Tip x={(x(hover) / W) * 100} y={(y(weeks[hover].paceSPerKm!) / H) * 100}>
          <b>{pace(weeks[hover].paceSPerKm)}/km</b> · minggu {dateShort(weeks[hover].week)}
        </Tip>
      )}
    </div>
  );
}

export function Calendar({ days }: { days: { day: string; km: number }[] }) {
  const level = (v: number) => (v === 0 ? 0 : v < 5 ? 1 : v < 10 ? 2 : v < 15 ? 3 : 4);
  return (
    <div>
      <div className="grid grid-flow-col grid-rows-7 gap-1 overflow-x-auto pb-1" style={{ gridAutoColumns: "14px" }}>
        {days.map((d) => (
          <span key={d.day} tabIndex={0} title={`${dateShort(d.day)}: ${d.km ? km(d.km) + " km" : "istirahat"}`}
                aria-label={`${dateShort(d.day)}: ${d.km ? km(d.km) + " km" : "istirahat"}`}
                className="block h-[14px] w-[14px] rounded-[3px]" style={{ background: HEAT[level(d.km)] }} />
        ))}
      </div>
      <div className="mt-2 flex items-center gap-1 text-xs text-neutral-500">
        Istirahat {HEAT.map((c) => <span key={c} className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />)} 15+ km
        <span className="ml-2">(&lt;5 · 5–10 · 10–15 · 15+)</span>
      </div>
    </div>
  );
}

const HEAT31 = ["#EFE6D3", "#F9D3B8", "#F2A472", "#E0530A", "#9C3A06"]; // rest, <3, 3-7, 7-12, 12+ km
const WALK_COLOR = "#4FA88B";
const DOW_LABELS = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];

export interface Heatmap31Day {
  day: string;
  runKm: number;
  walkKm: number;
  totalKm: number;
  runCount: number;
  walkCount: number;
}

export function Heatmap31({ days }: { days: Heatmap31Day[] }) {
  const defaultIdx = (() => {
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].totalKm > 0) return i;
    }
    return Math.max(0, days.length - 1);
  })();
  const [selected, setSelected] = useState<number>(defaultIdx);

  if (days.length === 0) return null;

  const firstDow = (new Date(days[0].day + "T00:00:00Z").getUTCDay() + 6) % 7; // 0 = Mon .. 6 = Sun
  const activeDays = days.filter((d) => d.totalKm > 0).length;
  const runDays = days.filter((d) => d.runKm > 0).length;
  const walkDays = days.filter((d) => d.walkKm > 0).length;

  const bgFor = (d: Heatmap31Day) => {
    if (d.runKm > 0) {
      const idx = d.runKm < 3 ? 1 : d.runKm < 7 ? 2 : d.runKm < 12 ? 3 : 4;
      return HEAT31[idx];
    }
    if (d.walkKm > 0) return WALK_COLOR;
    return HEAT31[0];
  };

  const textFor = (d: Heatmap31Day) => {
    if (d.runKm >= 7 || (d.runKm === 0 && d.walkKm > 0)) return "#FFFDF7";
    return "#3B261C";
  };

  const picked = days[selected] ?? days[days.length - 1];

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
        <span>
          <b>{dateShort(days[0].day)} – {dateShort(days[days.length - 1].day)}</b> ({days.length} hari)
        </span>
        <span className="font-semibold text-[#241917]">
          {activeDays} hari aktif · {runDays} lari{walkDays > 0 ? ` · ${walkDays} jalan` : ""}
        </span>
      </div>

      {/* Day-of-week header */}
      <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-neutral-500">
        {DOW_LABELS.map((l) => <div key={l}>{l}</div>)}
      </div>

      {/* 31-day aligned calendar grid */}
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: firstDow }).map((_, i) => (
          <div key={`pad-${i}`} aria-hidden="true" />
        ))}
        {days.map((d, idx) => {
          const dayNum = Number(d.day.slice(8, 10));
          const isSelected = idx === selected;
          const hasBoth = d.runKm > 0 && d.walkKm > 0;
          const summary = d.totalKm > 0
            ? `${dateShort(d.day)}: ${d.runKm > 0 ? `Lari ${km(d.runKm)} km` : ""}${hasBoth ? " + " : ""}${d.walkKm > 0 ? `Jalan ${km(d.walkKm)} km` : ""}`
            : `${dateShort(d.day)}: istirahat`;
          return (
            <button
              key={d.day}
              type="button"
              onClick={() => setSelected(idx)}
              onMouseEnter={() => setSelected(idx)}
              title={summary}
              aria-label={summary}
              aria-pressed={isSelected}
              className={`relative flex h-9 items-center justify-center rounded-md text-xs font-bold tabular-nums transition-transform ${
                isSelected ? "ring-2 ring-black ring-offset-1 scale-[1.04]" : "hover:scale-[1.03]"
              }`}
              style={{ background: bgFor(d), color: textFor(d) }}
            >
              {dayNum}
              {hasBoth && (
                <span
                  aria-hidden="true"
                  className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full border border-white"
                  style={{ background: WALK_COLOR }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Selected day detail pill (touch-friendly on iPhone) */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-xs">
        <span className="font-bold text-[#241917]">📅 {dateShort(picked.day)}</span>
        <span className="tabular-nums text-neutral-700">
          {picked.totalKm === 0 ? (
            "Istirahat"
          ) : (
            <>
              {picked.runKm > 0 && (
                <span className="font-bold text-hg-orange">
                  🏃 Lari {km(picked.runKm)} km{picked.runCount > 1 ? ` (${picked.runCount}×)` : ""}
                </span>
              )}
              {picked.runKm > 0 && picked.walkKm > 0 && " · "}
              {picked.walkKm > 0 && (
                <span className="font-bold text-[#2F7D4B]">
                  🚶 Jalan {km(picked.walkKm)} km{picked.walkCount > 1 ? ` (${picked.walkCount}×)` : ""}
                </span>
              )}
            </>
          )}
        </span>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-600">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: HEAT31[0] }} /> Istirahat
        </span>
        <span className="inline-flex items-center gap-1">
          Lari:
          {HEAT31.slice(1).map((c) => (
            <span key={c} className="inline-block h-3 w-3 rounded-sm" style={{ background: c }} />
          ))}
          <span className="text-neutral-500">(&lt;3 · 3–7 · 7–12 · 12+ km)</span>
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-3 w-3 rounded-sm" style={{ background: WALK_COLOR }} /> Jalan Kaki
        </span>
      </div>
    </div>
  );
}
