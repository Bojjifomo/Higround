import { notFound } from "next/navigation";
import { Panel } from "@/components/ui";
import { currentMember, eventDetail, getStore } from "@/lib/data";
import { dateLong, km } from "@/lib/format";
import { QrPanel } from "./QrPanel";

export const dynamic = "force-dynamic";

const METHOD = { qr: "QR", activity: "lari", class: "kelas" } as const;

export default async function EventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const me = await currentMember();
  const d = await eventDetail(await getStore(), id, me, Date.now());
  if (!d) notFound();
  const e = d.event;
  const staff = me?.role === "admin" || me?.role === "instructor";
  return (
    <div className="space-y-5">
      <Panel>
        <p className="text-xs font-bold uppercase tracking-widest text-hg-orange">{{ open: "Berlangsung", upcoming: "Akan datang", ended: "Selesai" }[d.status]}</p>
        <h1 className="mt-1 font-pixel text-3xl leading-none">{e.name}</h1>
        <p className="mt-2 text-sm text-neutral-600">{dateLong(e.startsAt)} – {dateLong(e.endsAt)}{e.kind !== "virtual" ? " · di Higround Harapan Indah" : " · dari mana saja"}</p>
        <p className="mt-2">{e.description}</p>
        <ul className="mt-3 flex flex-wrap gap-2 text-sm font-bold">
          {e.multiplier > 1 && <li className="rounded bg-hg-orange px-2 py-0.5 text-white">XP lari ×{e.multiplier}</li>}
          {e.bonusXp > 0 && <li className="rounded bg-hg-yellow px-2 py-0.5">+{e.bonusXp} XP</li>}
          {e.minKm != null && <li className="rounded border-2 border-black px-2 py-0.5">minimal {e.minKm} km</li>}
          {e.targetKm != null && <li className="rounded border-2 border-black px-2 py-0.5">target {e.targetKm} km</li>}
          <li className="rounded border-2 border-black px-2 py-0.5">badge event</li>
        </ul>
        {d.mine && (
          <p className="mt-3 text-sm">
            {d.mine.method ? <b className="text-green-700">✓ Kamu sudah check-in ({METHOD[d.mine.method]}).</b> : "Kamu belum check-in."}
            {d.mine.km != null && e.targetKm != null && <> Progres: <b>{km(d.mine.km)}/{e.targetKm} km</b>.</>}
          </p>
        )}
      </Panel>
      {staff && e.checkin.includes("qr") && d.status === "open" && <QrPanel eventId={e.id} />}
      <Panel title={e.kind === "virtual" ? `Tembus target (${d.participants})` : `Yang ikut (${d.participants})`}>
        <ul className="flex flex-wrap gap-2 text-sm">
          {d.attendees.map((a) => (
            <li key={a.handle}><a href={`/u/${a.handle}`} className="rounded border-2 border-black bg-white px-2 py-0.5">{a.name} <span className="text-neutral-500">· {METHOD[a.method]}</span></a></li>
          ))}
        </ul>
        {d.attendees.length === 0 && <p className="text-sm text-neutral-500">Belum ada.</p>}
      </Panel>
    </div>
  );
}
