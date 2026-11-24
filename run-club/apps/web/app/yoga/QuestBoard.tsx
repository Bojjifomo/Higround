"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Button, Stars } from "@/components/ui";
import type { ClaimOutcome } from "@/lib/data/service";
import { missionStars, type Mission, type Side, type SideBests, type Tahap, type YogaProgress } from "@/lib/yoga";
import { claimYogaTimer, startYogaTimer } from "../actions";

const ERROR: Record<string, string> = {
  consent: "Setujui aturan Yoga Quest dulu.", wa_gate: "Gabung grup WhatsApp dulu.", locked: "Tahap ini belum terbuka.",
  form_cues: "Centang semua cue bentuk dulu.", cooldown: "Tunggu dulu sebelum klaim misi ini lagi.",
  daily_limit: "Batas klaim hari ini sudah tercapai.", too_short: "Belum cukup lama untuk 1★.", wrong_side: "Sisi salah.",
  unknown_mission: "Misi tidak dikenal.", timer: "Timer tidak ditemukan.", already_claimed: "Timer ini sudah diklaim.",
};

interface Flow { key: string; name: string; total_s: number; xp: number; unlocked: boolean; done: boolean }

export function QuestBoard({ levels, progress, bests, cooldowns, claimsToday, maxClaims, flow }: {
  levels: Tahap[]; progress: YogaProgress; bests: Record<string, SideBests>; cooldowns: Record<string, number>;
  claimsToday: number; maxClaims: number; flow: Flow;
}) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <p className="text-sm">Klaim hari ini: <b>{claimsToday}/{maxClaims}</b></p>
      {levels.map((t) => {
        const tp = progress.tahap.find((x) => x.level === t.level)!;
        return (
          <section key={t.level} className={`rounded-lg border-4 p-4 ${tp.unlocked ? "border-hg-orange bg-[#FFFDF7] shadow-[4px_4px_0_#111]" : "border-dashed border-neutral-400 bg-neutral-100"}`}>
            <div className="mb-2 flex flex-wrap items-baseline gap-x-3">
              <h2 className="font-pixel text-xl">Tahap {t.level}: {t.name}</h2>
              <span className="text-sm">{t.xp_per_mission} XP/misi di 2★</span>
              <span className="ml-auto text-sm">{tp.unlocked ? `${tp.missionsAt2}/${t.missions.length} misi ≥2★ · perlu ${tp.needed}${tp.cleared ? " · CLEAR" : ""}` : "🔒 terkunci"}</span>
            </div>
            <ul className="grid gap-2 md:grid-cols-2">
              {t.missions.map((m) => (
                <li key={m.key} className="rounded-md border-2 border-black bg-white">
                  <button disabled={!tp.unlocked} onClick={() => setOpen(open === m.key ? null : m.key)}
                          className="flex w-full items-center gap-2 px-3 py-2 text-left disabled:cursor-not-allowed">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{m.name}{m.safety_form_first && <span title="Bentuk lebih penting dari durasi"> ⚠</span>}</span>
                      <span className="text-xs text-neutral-600">target {m.target_s} dtk{m.per_side ? " per sisi" : ""}{m.note ? ` · ${m.note}` : ""}</span>
                    </span>
                    <Stars n={missionStars(m, bests[m.key])} />
                  </button>
                  {open === m.key && tp.unlocked && <MissionTimer mission={m} bests={bests[m.key]} cooldowns={cooldowns} />}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
      <section className={`rounded-lg border-4 p-4 ${flow.unlocked ? "border-hg-violet bg-[#FFFDF7]" : "border-dashed border-neutral-400 bg-neutral-100"}`}>
        <h2 className="font-pixel text-xl">Bonus: {flow.name}</h2>
        <p className="text-sm">Total {flow.total_s} detik tanpa jeda · +{flow.xp} XP sekali. {flow.done ? "✅ Selesai" : flow.unlocked ? "" : "🔒 Terbuka setelah Tahap 2 clear."}</p>
        {flow.unlocked && !flow.done && (
          <MissionTimer flat mission={{ key: flow.key, name: flow.name, target_s: flow.total_s, per_side: false, safety_form_first: false,
                                        stars_s: [flow.total_s, flow.total_s, flow.total_s] }} bests={undefined} cooldowns={cooldowns} />
        )}
      </section>
    </div>
  );
}

function MissionTimer({ mission, bests, cooldowns, flat = false }: {
  mission: Mission; bests: SideBests | undefined; cooldowns: Record<string, number>; flat?: boolean;
}) {
  const router = useRouter();
  const [side, setSide] = useState<Side>(mission.per_side ? "left" : "both");
  const [cues, setCues] = useState<boolean[]>((mission.form_cues ?? []).map(() => false));
  const [run, setRun] = useState<{ timerId: string; t0: number } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [result, setResult] = useState<ClaimOutcome | null>(null);
  const [pending, start] = useTransition();
  const cooldown = cooldowns[`${mission.key}:${side}`] ?? 0;

  useEffect(() => {
    if (!run) return;
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - run.t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [run]);

  const begin = () => start(async () => {
    setResult(null);
    const r = await startYogaTimer(mission.key, side, cues.every(Boolean));
    setElapsed(0);
    setRun({ timerId: r.timerId, t0: Date.now() });
  });
  const finish = () => start(async () => {
    if (!run) return;
    const r = await claimYogaTimer(run.timerId);
    setRun(null);
    setResult(r);
    router.refresh();
  });

  const reached = mission.stars_s.filter((s) => elapsed >= s).length;
  return (
    <div className="border-t-2 border-black p-3 text-sm">
      {mission.per_side && (
        <div className="mb-2 flex items-center gap-2">
          Sisi:
          {(["left", "right"] as const).map((s) => (
            <button key={s} disabled={!!run} onClick={() => setSide(s)}
                    className={`rounded border-2 px-2 py-0.5 font-bold ${side === s ? "border-black bg-hg-yellow" : "border-neutral-300"}`}>
              {s === "left" ? "Kiri" : "Kanan"} <Stars n={bests?.[s] ?? 0} />
            </button>
          ))}
        </div>
      )}
      {!flat && <p className="mb-2 text-xs text-neutral-600">1★ {mission.stars_s[0]} dtk · 2★ {mission.stars_s[1]} dtk · 3★ {mission.stars_s[2]} dtk</p>}
      {mission.form_cues && (
        <fieldset className="mb-2 space-y-1">
          <legend className="text-xs font-bold">Cek bentuk dulu (wajib):</legend>
          {mission.form_cues.map((c, i) => (
            <label key={i} className="flex gap-2 text-xs">
              <input type="checkbox" checked={cues[i]} disabled={!!run}
                     onChange={(e) => setCues(cues.map((v, j) => (j === i ? e.target.checked : v)))} />
              {c}
            </label>
          ))}
        </fieldset>
      )}
      {run ? (
        <div className="flex items-center gap-4">
          <span className="font-pixel text-4xl tabular-nums" aria-live="polite">{elapsed}s</span>
          {!flat && <Stars n={reached} />}
          <Button onClick={finish} disabled={pending}>Selesai</Button>
        </div>
      ) : (
        <Button onClick={begin} disabled={pending || cooldown > 0 || (mission.form_cues ? !cues.every(Boolean) : false)}>
          {cooldown > 0 ? `Tunggu ${Math.ceil(cooldown / 60)} mnt` : "Mulai timer"}
        </Button>
      )}
      {result && (
        <p className={`mt-2 font-bold ${result.ok ? "text-green-700" : "text-hg-red"}`} role="status">
          {result.ok
            ? `${result.measuredS} detik${flat ? "" : ` · ${result.stars}★`}${result.xp ? ` · +${result.xp} XP` : ""}${mission.per_side && result.missionStarsAfter === 0 ? " · lanjut sisi satunya" : ""}`
            : ERROR[result.error] ?? result.error}
        </p>
      )}
    </div>
  );
}
