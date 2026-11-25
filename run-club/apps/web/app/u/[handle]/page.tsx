import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Calendar, PaceTrend, WeeklyKm } from "@/components/Charts";
import { BadgeChip, Button, Panel, Stat, XpBar } from "@/components/ui";
import { currentMember, getStore, profileView, type ProfileView, type RunView } from "@/lib/data";
import { dateLong, dateShort, duration, int, km, pace, PB_LABEL, ruleLabel } from "@/lib/format";
import { defaultConfig as yoga } from "@/lib/yoga";
import { togglePublic } from "../../actions";
import { Connection } from "./Connection";

export const dynamic = "force-dynamic";

const STATUS: Record<string, string> = {
  ok: "", approved: "disetujui admin", pending: "menunggu review", rejected: "ditolak", uncounted: "tidak dihitung",
};
const REASON: Record<string, string> = {
  strava: "dari Strava", no_device: "tanpa jam", type: "bukan lari", pace_too_fast: "pace terlalu cepat",
  max_speed: "kecepatan maks > 25 km/jam", distance: "> 100 km",
};

export default async function Profile({ params, searchParams }: {
  params: Promise<{ handle: string }>; searchParams: Promise<{ intervals?: string; welcome?: string }>;
}) {
  const { handle } = await params;
  const q = await searchParams;
  const viewer = await currentMember();
  const store = await getStore();
  const p = await profileView(store, handle, viewer, Date.now());
  if (!p) notFound();
  const { member, level } = p;
  const integ = p.isOwner ? await store.integration(member.id) : null;

  return (
    <div className="space-y-5">
      <Panel>
        <div className="flex flex-wrap items-center gap-5">
          <Avatar avatar={member.avatar} size={88} label={`Avatar ${member.displayName}`} />
          <div className="min-w-[200px] flex-1">
            <h1 className="font-pixel text-3xl leading-none">{member.displayName}</h1>
            <p className="mt-1 text-sm text-neutral-600">@{member.handle}</p>
            <p className="mt-2 inline-block rounded bg-black px-2 py-0.5 text-sm font-bold text-hg-yellow">
              Lv {level.level} · {level.title} · {level.totalXp.toLocaleString("id-ID")} XP
            </p>
            <div className="mt-2 max-w-sm"><XpBar into={level.xpIntoLevel} toNext={level.xpToNext} level={level.level} /></div>
          </div>
          <div className="flex flex-col gap-2">
            {p.badges.pinned.map((b) => <BadgeChip key={b.key} badge={b} />)}
          </div>
        </div>
        {p.isOwner && (
          <div className="mt-3 flex flex-wrap items-center gap-3 text-sm">
            <Link
              href={`/create?next=${encodeURIComponent(`/u/${member.handle}`)}`}
              className="rounded-md border-2 border-black bg-hg-yellow px-3 py-1.5 font-bold text-black shadow-[2px_2px_0_#111] hover:brightness-95"
            >
              🎨 Edit Karakter
            </Link>
            <form action={togglePublic} className="flex items-center gap-2">
              <span>Profil {member.isPublic ? "publik untuk member lain" : "privat"}.</span>
              <Button variant="ghost">{member.isPublic ? "Jadikan privat" : "Jadikan publik"}</Button>
            </form>
          </div>
        )}
      </Panel>

      {p.isOwner && <Connection integ={integ} note={q.intervals} handle={member.handle} welcome={q.welcome === "1"} />}

      {p.hidden ? (
        <Panel title="Profil privat"><p className="text-sm">{member.displayName} memilih menyembunyikan dashboard-nya.</p></Panel>
      ) : (
        <>
          <RunSection run={p.run!} />
          <YogaSection p={p} />
          <Panel id="badge" title="Badge" aside={<span className="text-xs text-neutral-500">{p.badges.earned.size} dari {p.badges.all.length}</span>}>
            <div className="flex flex-wrap gap-2">
              {[...p.badges.all].sort((a, b) => Number(p.badges.earned.has(b.key)) - Number(p.badges.earned.has(a.key)))
                .map((b) => <BadgeChip key={b.key} badge={b} earned={p.badges.earned.has(b.key)} />)}
            </div>
            {p.eventBadges.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold">Badge event:</span>
                {p.eventBadges.map((b) => <span key={b.key} className="rounded-md border-2 border-hg-violet bg-white px-2 py-1 font-bold">🎟️ {b.name}</span>)}
              </div>
            )}
            {p.cosmetics.length > 0 && <p className="mt-3 text-sm">Kosmetik terbuka: <b>{p.cosmetics.join(", ")}</b></p>}
          </Panel>
          <Panel title="Riwayat XP">
            <table className="w-full text-sm">
              <tbody>
                {p.history.map((e) => (
                  <tr key={e.idempotencyKey} className="border-t border-[#EFE6D3]">
                    <td className="whitespace-nowrap py-1 pr-2 text-neutral-500">{dateShort(e.when)}</td>
                    <td className="py-1"><b>{ruleLabel(e.ruleKey)}</b>{e.detail && <span className="text-neutral-600"> · {e.detail}</span>}</td>
                    <td className={`py-1 text-right font-bold tabular-nums ${e.amount < 0 ? "text-hg-red" : ""}`}>
                      {e.amount > 0 ? "+" : ""}{int(e.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {p.history.length === 0 && <p className="text-sm text-neutral-500">Belum ada XP.</p>}
          </Panel>
        </>
      )}
    </div>
  );
}

function RunSection({ run }: { run: RunView }) {
  return (
    <Panel title="Lari">
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <Stat value={km(run.weekKm)} unit="km" label="Minggu ini" />
        <Stat value={km(run.monthKm)} unit="km" label="Bulan ini" />
        <Stat value={km(run.totalKm)} unit="km" label="Total" />
        <Stat value={int(run.runs)} label="Lari" />
        <Stat value={int(run.elevationM)} unit="m" label="Elevasi" />
        <Stat value={int(run.higroundStarts)} label="Start dari Higround" />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div><h3 className="mb-1 font-bold">Kilometer per minggu</h3><WeeklyKm weeks={run.weeks} /></div>
        <div><h3 className="mb-1 font-bold">Pace rata-rata per minggu <span className="text-xs font-normal text-neutral-500">(makin atas makin cepat)</span></h3><PaceTrend weeks={run.weeks} /></div>
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[auto_1fr]">
        <div><h3 className="mb-2 font-bold">12 minggu terakhir</h3><Calendar days={run.days} /></div>
        <div>
          <h3 className="mb-2 font-bold">Personal best</h3>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {(Object.keys(PB_LABEL) as (keyof typeof PB_LABEL)[]).map((k) => (
              <div key={k}><dt className="text-xs text-neutral-600">{PB_LABEL[k]}</dt>
                <dd className="text-lg font-black tabular-nums">{run.pbs[k] ? duration(run.pbs[k]!) : "–"}</dd></div>
            ))}
          </dl>
        </div>
      </div>
      <h3 className="mb-1 mt-5 font-bold">Aktivitas terbaru</h3>
      <ul className="divide-y divide-[#EFE6D3] text-sm">
        {run.recent.map((a) => (
          <li key={a.id} className="flex flex-wrap items-baseline gap-x-3 py-1.5">
            <span className="font-bold">{a.name ?? a.type}</span>
            <span className="text-neutral-500">{dateLong(a.startTime)}</span>
            {a.isHigroundStart && <span className="rounded bg-hg-orange px-1.5 text-xs font-bold text-white">START HIGROUND</span>}
            {a.status !== "ok" && (
              <span className="rounded border border-neutral-400 px-1.5 text-xs">
                {STATUS[a.status]}{a.flagReasons.length ? `: ${a.flagReasons.map((r) => REASON[r] ?? r).join(", ")}` : ""}
              </span>
            )}
            <span className="ml-auto tabular-nums">
              {km(a.distanceM / 1000)} km{a.type.endsWith("Run") ? ` · ${pace(a.distanceM ? a.movingTimeS / (a.distanceM / 1000) : null)}/km` : ""}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-neutral-500">Rute dan titik start tidak pernah ditampilkan ke member lain.</p>
    </Panel>
  );
}

function YogaSection({ p }: { p: ProfileView }) {
  const y = p.yoga!;
  return (
    <Panel title="Yoga Quest" aside={p.isOwner ? <Link href="/yoga" className="text-sm font-bold text-hg-orange underline">Buka Yoga Quest →</Link> : undefined}>
      <div className="grid gap-3 sm:grid-cols-5">
        {y.progress.tahap.map((t) => {
          const tahap = yoga.levels.find((l) => l.level === t.level)!;
          return (
            <div key={t.level} className={`rounded-md border-2 p-2 ${t.unlocked ? "border-black bg-white" : "border-dashed border-neutral-400 text-neutral-400"}`}>
              <div className="text-xs">Tahap {t.level}</div>
              <div className="font-bold">{t.name}</div>
              <div className="text-sm"><b>{t.stars}</b> / {tahap.missions.length * 3}★</div>
              <div className="text-xs">{t.missionsAt2}/{tahap.missions.length} misi ≥2★{t.cleared ? " · clear" : ""}</div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-sm">
        Total <b>{y.progress.totalStars}★</b>.{" "}
        {y.masteredPoses.length ? <>Pose dikuasai (≥2★): {y.masteredPoses.slice(0, 8).join(", ")}{y.masteredPoses.length > 8 ? ` +${y.masteredPoses.length - 8} lagi` : ""}.</> : "Belum ada pose ≥2★."}
      </p>
      <p className="mt-1 text-xs text-neutral-500">Klaim yoga = laporan jujur (self-reported) dengan timer di server, atau dari Class Mode instruktur.</p>
    </Panel>
  );
}
