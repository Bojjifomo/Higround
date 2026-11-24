import Link from "next/link";
import { Panel } from "@/components/ui";
import { currentMember, eventsView, getStore, type EventRow } from "@/lib/data";
import { dateLong, km } from "@/lib/format";

export const dynamic = "force-dynamic";

const STATUS = { open: "Berlangsung", upcoming: "Akan datang", ended: "Selesai" } as const;
const METHOD = { qr: "QR di kasir", activity: "otomatis dari lari", class: "Class Mode" } as const;

export default async function Events() {
  const me = await currentMember();
  const rows = await eventsView(await getStore(), me, Date.now());
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-pixel text-4xl leading-none">Event</h1>
        <p className="mt-2 max-w-prose text-sm text-neutral-700">Ikut event Run Club untuk bonus XP dan badge event. Check-in lewat QR di kasir, otomatis dari lari kamu, atau dari kelas yoga.</p>
      </div>
      {(["open", "upcoming", "ended"] as const).map((st) => {
        const list = rows.filter((r) => r.status === st);
        if (!list.length) return null;
        return (
          <Panel key={st} title={STATUS[st]}>
            <ul className="grid gap-3 md:grid-cols-2">{list.map((r) => <EventCard key={r.event.id} r={r} />)}</ul>
          </Panel>
        );
      })}
      {rows.length === 0 && <Panel title="Belum ada event"><p className="text-sm">Admin bisa bikin event dari halaman Admin.</p></Panel>}
    </div>
  );
}

function EventCard({ r }: { r: EventRow }) {
  const e = r.event;
  return (
    <li className={`rounded-md border-2 border-black bg-white p-3 ${r.status === "open" ? "shadow-[3px_3px_0_#FF5F0E]" : ""}`}>
      <Link href={`/events/${e.id}`} className="block">
        <div className="flex items-baseline gap-2">
          <span className="font-bold">{e.name}</span>
          {e.multiplier > 1 && <span className="rounded bg-hg-orange px-1.5 text-xs font-bold text-white">XP ×{e.multiplier}</span>}
          {e.bonusXp > 0 && <span className="rounded bg-hg-yellow px-1.5 text-xs font-bold">+{e.bonusXp} XP</span>}
        </div>
        <div className="mt-1 text-xs text-neutral-600">{dateLong(e.startsAt)} – {dateLong(e.endsAt)} · {r.participants} {e.kind === "virtual" ? "tembus target" : "ikut"}</div>
        <p className="mt-1 text-sm">{e.description}</p>
        <div className="mt-2 text-xs">
          Check-in: {e.checkin.map((m) => METHOD[m]).join(" atau ")}
          {r.mine?.km != null && e.targetKm != null && <> · progres kamu <b>{km(r.mine.km)}/{e.targetKm} km</b></>}
          {r.mine?.method && <span className="ml-1 font-bold text-green-700">✓ kamu sudah check-in</span>}
          {r.mine?.done && e.kind === "virtual" && <span className="ml-1 font-bold text-green-700">✓ target tercapai</span>}
        </div>
      </Link>
    </li>
  );
}
