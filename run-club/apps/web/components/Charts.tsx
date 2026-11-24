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
