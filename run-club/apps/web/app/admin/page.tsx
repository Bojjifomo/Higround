import { redirect } from "next/navigation";
import { Button, Panel } from "@/components/ui";
import { currentMember, getStore } from "@/lib/data";
import { dateLong, km, pace } from "@/lib/format";
import { defaultConfig as yoga } from "@/lib/yoga";
import { rejectClaim, review, verifyWa } from "../actions";
import { eventConfig } from "@/lib/events";
import { EventForm } from "./EventForm";

export const dynamic = "force-dynamic";

const REASON: Record<string, string> = {
  pace_too_fast: "pace < 3:00/km", max_speed: "kecepatan maks > 25 km/jam", distance: "> 100 km",
};

export default async function Admin() {
  const me = await currentMember();
  if (!me) redirect("/login");
  if (me.role !== "admin") return <Panel title="Khusus admin"><p className="text-sm">Halaman ini cuma untuk admin.</p></Panel>;
  const store = await getStore();
  const members = await store.members();
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? id;
  const pending = (await store.pendingActivities()).sort((a, b) => b.startTime.localeCompare(a.startTime));
  const claims = await store.recentAttempts(15);
  const missionName = (k: string) => yoga.levels.flatMap((l) => l.missions).find((m) => m.key === k)?.name ?? "Flow Challenge";

  return (
    <div className="space-y-5">
      <h1 className="font-pixel text-4xl leading-none">Admin</h1>
      <EventForm templates={eventConfig.templates} />

      <Panel title={`Aktivitas di-flag (${pending.length})`}>
        <p className="mb-2 text-sm text-neutral-600">Kena aturan anti-cheat. XP-nya ditahan sampai disetujui.</p>
        <ul className="divide-y divide-[#EFE6D3]">
          {pending.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-bold">{name(a.userId)}</span>
              <span>{a.name ?? a.type} · {dateLong(a.startTime)}</span>
              <span className="tabular-nums">{km(a.distanceM / 1000)} km · {pace(a.movingTimeS / (a.distanceM / 1000))}/km{a.maxSpeedKmh ? ` · maks ${km(a.maxSpeedKmh)} km/jam` : ""}</span>
              <span className="text-hg-red">{a.flagReasons.map((r) => REASON[r] ?? r).join(", ")}</span>
              <form action={review} className="ml-auto flex gap-2">
                <input type="hidden" name="id" value={a.id} />
                <Button name="decision" value="approved">Setujui</Button>
                <Button name="decision" value="rejected" variant="danger">Tolak</Button>
              </form>
            </li>
          ))}
        </ul>
        {pending.length === 0 && <p className="text-sm">Aman, nggak ada yang perlu direview.</p>}
      </Panel>

      <Panel title="Klaim Yoga Quest terbaru">
        <p className="mb-2 text-sm text-neutral-600">Sistem kejujuran: klaim langsung dihitung. Batalkan kalau ada yang nggak sesuai; XP-nya ikut ditarik.</p>
        <ul className="divide-y divide-[#EFE6D3]">
          {claims.map((c) => (
            <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
              <span className="font-bold">{name(c.userId)}</span>
              <span>{missionName(c.missionKey)}{c.side !== "both" ? ` (${c.side === "left" ? "kiri" : "kanan"})` : ""}</span>
              <span>{c.measuredS} dtk · {c.stars}★ · {c.mode === "class" ? "Class Mode" : "self-reported"}</span>
              {c.status === "rejected" ? <span className="ml-auto text-hg-red">dibatalkan</span> : (
                <form action={rejectClaim} className="ml-auto flex gap-2">
                  <input type="hidden" name="id" value={c.id} />
                  <input name="reason" placeholder="alasan" className="w-32 rounded border-2 border-neutral-300 px-2 py-1" />
                  <Button variant="danger">Batalkan</Button>
                </form>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title="Grup WhatsApp">
        <p className="mb-2 text-sm text-neutral-600">WhatsApp tidak punya API untuk cek anggota grup. Tandai member yang sudah gabung.</p>
        <ul className="divide-y divide-[#EFE6D3]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 py-1.5 text-sm">
              <span className="flex-1 font-bold">{m.displayName}</span>
              <span>{m.waVerifiedAt ? "✅ terverifikasi" : "belum"}</span>
              <form action={verifyWa}>
                <input type="hidden" name="id" value={m.id} />
                <input type="hidden" name="verified" value={m.waVerifiedAt ? "0" : "1"} />
                <Button variant="ghost">{m.waVerifiedAt ? "Cabut" : "Tandai"}</Button>
              </form>
            </li>
          ))}
        </ul>
      </Panel>
    </div>
  );
}
