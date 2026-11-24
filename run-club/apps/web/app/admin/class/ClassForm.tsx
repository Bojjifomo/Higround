"use client";
import { useActionState, useEffect, useState } from "react";
import { Button, Panel } from "@/components/ui";
import type { Tahap } from "@/lib/yoga";
import { awardClass, type ClassAwardState } from "../../actions";

export function ClassForm({ members, levels }: { members: { id: string; name: string }[]; levels: Tahap[] }) {
  const [state, action, pending] = useActionState<ClassAwardState, FormData>(awardClass, null);
  const [missionKey, setMissionKey] = useState(levels[0].missions[0].key);
  const mission = levels.flatMap((l) => l.missions).find((m) => m.key === missionKey)!;
  const [t0, setT0] = useState<number | null>(null);
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (t0 === null) return;
    const id = setInterval(() => setSecs(Math.floor((Date.now() - t0) / 1000)), 250);
    return () => clearInterval(id);
  }, [t0]);
  const suggested = mission.stars_s.filter((s) => secs >= s).length;

  return (
    <div className="grid gap-5 md:grid-cols-[1.3fr_1fr]">
      <Panel title="Beri bintang">
        <form action={action} className="grid gap-3 text-sm">
          <label className="grid gap-1 font-bold">Member
            <select name="userId" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal">
              {members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
          <label className="grid gap-1 font-bold">Misi
            <select name="missionKey" value={missionKey} onChange={(e) => setMissionKey(e.target.value)}
                    className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal">
              {levels.map((l) => (
                <optgroup key={l.level} label={`Tahap ${l.level}: ${l.name}`}>
                  {l.missions.map((m) => <option key={m.key} value={m.key}>{m.name}</option>)}
                </optgroup>
              ))}
            </select>
          </label>
          <fieldset className="grid gap-1">
            <legend className="font-bold">Sisi</legend>
            <div className="flex gap-3">
              {(mission.per_side ? (["left", "right"] as const) : (["both"] as const)).map((s, i) => (
                <label key={s} className="flex items-center gap-1">
                  <input type="radio" name="side" value={s} defaultChecked={i === 0} key={`${missionKey}-${s}`} />
                  {s === "both" ? "—" : s === "left" ? "Kiri" : "Kanan"}
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset className="grid gap-1">
            <legend className="font-bold">Bintang (1★ {mission.stars_s[0]} · 2★ {mission.stars_s[1]} · 3★ {mission.stars_s[2]} dtk)</legend>
            <div className="flex gap-3">
              {[1, 2, 3].map((n) => (
                <label key={n} className="flex items-center gap-1">
                  <input type="radio" name="stars" value={n} defaultChecked={n === 2} />{"★".repeat(n)}
                </label>
              ))}
            </div>
          </fieldset>
          {mission.safety_form_first && <p className="text-xs text-hg-red">⚠ Pose ini: bentuk yang benar lebih penting dari durasi.</p>}
          <div><Button disabled={pending}>Simpan</Button></div>
          {state && <p role="status" className={`font-bold ${state.ok ? "text-green-700" : "text-hg-red"}`}>{state.message}</p>}
        </form>
      </Panel>
      <Panel title="Stopwatch">
        <div className="font-pixel text-6xl tabular-nums" aria-live="polite">{secs}s</div>
        <p className="mt-1 text-sm">Saran: <b>{suggested}★</b> untuk {mission.name}</p>
        <div className="mt-3 flex gap-2">
          <Button onClick={() => { setSecs(0); setT0(Date.now()); }}>{t0 === null ? "Mulai" : "Ulang"}</Button>
          <Button variant="ghost" onClick={() => setT0(null)} disabled={t0 === null}>Stop</Button>
        </div>
      </Panel>
    </div>
  );
}
