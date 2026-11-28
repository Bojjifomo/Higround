import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Heatmap31, PaceTrend, WeeklyKm } from "@/components/Charts";
import { BadgeChip, Button, Panel, Stat, XpBar } from "@/components/ui";
import { currentMember, getStore, profileView, syncIfStale, type ProfileView, type RunView } from "@/lib/data";
import { dateLong, dateShort, duration, int, km, pace } from "@/lib/format";
import { getProvider } from "@/lib/providers";
import { PB_BADGE_SPECS } from "@/lib/runs";
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

const PB_SHORT_LABEL = Object.fromEntries(PB_BADGE_SPECS.map((s) => [s.key, s.shortLabel])) as Record<string, string>;

export default async function Profile({ params, searchParams }: {
  params: Promise<{ handle: string }>; searchParams: Promise<{ intervals?: string; welcome?: string }>;
}) {
  const { handle } = await params;
  const q = await searchParams;
  const viewer = await currentMember();
  const store = await getStore();
  const now = Date.now();
  // Auto-sync Intervals.icu if the signed-in owner visits their own profile and last sync was > 15 min ago
  if (viewer && viewer.handle === handle) {
    await Promise.race([
      syncIfStale(store, getProvider(), viewer.id, now).catch(() => null),
      new Promise((resolve) => setTimeout(resolve, 4500)),
    ]);
  }
  const p = await profileView(store, handle, viewer, now);
  if (!p) notFound();
  const { member, level } = p;
  const integ = p.isOwner ? await store.integration(member.id) : null;
  const isMockIntervals = p.isOwner ? getProvider().name === "intervals-mock" : false;

  const runBadges = p.badges.all.filter((b) => b.category !== "yoga");
  const yogaBadgesList = p.badges.all.filter((b) => b.category === "yoga");
  const earnedRunCount = runBadges.filter((b) => p.badges.earned.has(b.key)).length;
  const earnedYogaCount = yogaBadgesList.filter((b) => p.badges.earned.has(b.key)).length;

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
              🎨 Ganti Karakter
            </Link>
            <Link
              href="/share"
              className="rounded-md border-2 border-black bg-hg-navy px-3 py-1.5 font-bold text-white shadow-[2px_2px_0_#111] hover:brightness-110"
            >
              🎬 Studio IG Story
            </Link>
            <form action={togglePublic} className="flex items-center gap-2">
              <span>Profil {member.isPublic ? "publik untuk member lain" : "privat"}.</span>
              <Button variant="ghost">{member.isPublic ? "Jadikan privat" : "Jadikan publik"}</Button>
            </form>
          </div>
        )}
      </Panel>

      {p.isOwner && <Connection integ={integ} note={q.intervals} handle={member.handle} welcome={q.welcome === "1"} isMock={isMockIntervals} />}

      {p.hidden ? (
        <Panel title="Profil privat"><p className="text-sm">{member.displayName} memilih menyembunyikan dashboard-nya.</p></Panel>
      ) : (
        <>
          <RunSection run={p.run!} isOwner={p.isOwner} />
          <YogaSection p={p} />

          {/* Badges split clearly into Run Badge & Yoga Badge (Coming Soon) */}
          <Panel
            id="badge"
            title="Badge"
            aside={<span className="text-xs text-neutral-500">{p.badges.earned.size} dari {p.badges.all.length}</span>}
          >
            <div className="space-y-5">
              {/* 1. Run Badges */}
              <div>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <h3 className="font-bold text-[#241917]">🏃 Run Badge</h3>
                  <span className="text-xs font-semibold text-neutral-500">
                    {earnedRunCount} / {runBadges.length} terbuka
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[...runBadges]
                    .sort((a, b) => Number(p.badges.earned.has(b.key)) - Number(p.badges.earned.has(a.key)))
                    .map((b) => <BadgeChip key={b.key} badge={b} earned={p.badges.earned.has(b.key)} />)}
                </div>
                {p.eventBadges.length > 0 && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-bold">Badge event:</span>
                    {p.eventBadges.map((b) => (
                      <span key={b.key} className="rounded-md border-2 border-hg-violet bg-white px-2 py-1 font-bold">
                        🎟️ {b.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Yoga Badges (Coming Soon) */}
              <div className="border-t border-[#EFE6D3] pt-4">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-neutral-600">🧘 Yoga Badge</h3>
                    <span className="rounded border border-neutral-400 bg-neutral-100 px-1.5 py-0.5 text-[10px] font-bold text-neutral-500">
                      🔒 Coming Soon
                    </span>
                  </div>
                  <span className="text-xs text-neutral-500">
                    {earnedYogaCount} / {yogaBadgesList.length} terbuka
                  </span>
                </div>
                <div className="flex flex-wrap gap-2 opacity-75">
                  {[...yogaBadgesList]
                    .sort((a, b) => Number(p.badges.earned.has(b.key)) - Number(p.badges.earned.has(a.key)))
                    .map((b) => <BadgeChip key={b.key} badge={b} earned={p.badges.earned.has(b.key)} />)}
                </div>
              </div>
            </div>

            {p.cosmetics.length > 0 && (
              <p className="mt-4 border-t border-[#EFE6D3] pt-3 text-sm">
                Kosmetik terbuka: <b>{p.cosmetics.join(", ")}</b>
              </p>
            )}
          </Panel>
        </>
      )}
    </div>
  );
}

function RunSection({ run, isOwner }: { run: RunView; isOwner: boolean }) {
  return (
    <Panel
      title="Lari & Aktivitas"
      aside={
        run.groupRunsCount > 0 ? (
          <span className="rounded-full border border-hg-orange bg-[#FFF1E6] px-2.5 py-0.5 text-xs font-bold text-hg-orange">
            🤝 {run.groupRunsCount}× lari bareng · {run.uniqueBuddiesCount} teman
          </span>
        ) : null
      }
    >
      {/* Core Running Stats — Elevasi removed, Minggu ini prominent */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-lg border-2 border-black bg-[#FFF1E6] p-3">
          <Stat value={km(run.weekKm)} unit="km" label="Minggu ini" />
        </div>
        <div className="rounded-lg border border-[#E7DCC4] bg-white p-3">
          <Stat value={km(run.monthKm)} unit="km" label="Bulan ini" />
        </div>
        <div className="rounded-lg border border-[#E7DCC4] bg-white p-3">
          <Stat value={km(run.totalKm)} unit="km" label="Total Lari" />
        </div>
        <div className="rounded-lg border border-[#E7DCC4] bg-white p-3">
          <Stat value={int(run.runs)} label="Sesi Lari" />
        </div>
        <div className="rounded-lg border border-[#E7DCC4] bg-white p-3">
          <Stat value={int(run.higroundStarts)} label="Start dari Higround" />
        </div>
      </div>

      {/* Dedicated Walk Summary Card (Opsi A: shown in profile & heatmap, Leaderboard stays Run-only) */}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border-2 border-[#4FA88B] bg-[#EEF9F4] px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border-2 border-[#2F7D4B] bg-white text-xl">
            🚶
          </span>
          <div>
            <div className="text-xs font-extrabold uppercase tracking-wider text-[#2F7D4B]">Jalan Kaki (Walk)</div>
            <div className="text-sm font-bold text-[#241917] tabular-nums">
              Minggu ini <b>{km(run.walk.weekKm)} km</b> · Total <b>{km(run.walk.totalKm)} km</b> ({int(run.walk.walks)} sesi)
            </div>
          </div>
        </div>
        <span className="text-[11px] font-medium text-[#2F7D4B]">
          Tampil di profil &amp; heatmap · Leaderboard KM khusus Lari
        </span>
      </div>

      {/* Weekly KM & Pace Charts */}
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="mb-1 font-bold">Kilometer per minggu</h3>
          <WeeklyKm weeks={run.weeks} />
        </div>
        <div>
          <h3 className="mb-1 font-bold">
            Pace rata-rata per minggu <span className="text-xs font-normal text-neutral-500">(makin atas makin cepat)</span>
          </h3>
          <PaceTrend weeks={run.weeks} />
        </div>
      </div>

      {/* 31-Day Heatmap + 6 Personal Best Badges (1K, 5K, 10K, 21K, 42K, 50K) */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(280px,340px)_1fr]">
        <div>
          <h3 className="mb-2 font-bold">Aktivitas 31 Hari Terakhir</h3>
          <Heatmap31 days={run.days31} />
        </div>
        <div>
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <h3 className="font-bold">Personal Best Badge</h3>
            <span className="text-xs text-neutral-500">1K · 5K · 10K · 21K · 42K · 50K</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {PB_BADGE_SPECS.map((spec) => {
              const res = run.pbBadges[spec.key];
              const achieved = Boolean(res);
              return (
                <div
                  key={spec.key}
                  className={`relative rounded-xl border-2 p-3 transition-transform ${
                    achieved
                      ? "border-black shadow-[3px_3px_0_#111]"
                      : "border-dashed border-neutral-300 bg-neutral-50/80 opacity-65"
                  }`}
                  style={achieved ? { background: spec.bg } : undefined}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border-2 border-black text-base"
                      style={{ background: achieved ? spec.accent : "#E5E5E5", color: achieved ? "#FFFDF7" : "#666" }}
                    >
                      {spec.icon}
                    </span>
                    <span
                      className="rounded px-1.5 py-0.5 font-pixel text-[11px] font-bold uppercase"
                      style={{
                        background: achieved ? "#241917" : "#E5E5E5",
                        color: achieved ? "#F7D046" : "#666",
                      }}
                    >
                      {spec.shortLabel}
                    </span>
                  </div>
                  <div className="mt-2 text-xs font-bold text-neutral-700">{spec.name}</div>
                  {res ? (
                    <>
                      <div className="mt-0.5 text-xl font-black tabular-nums leading-tight text-[#241917]">
                        {duration(res.timeS)}
                      </div>
                      <div className="mt-0.5 text-[11px] text-neutral-600">
                        {dateShort(res.startTime)}{res.estimated ? " · est. pace" : ""}
                      </div>
                    </>
                  ) : (
                    <div className="mt-1 text-xs font-semibold text-neutral-400">Belum tercapai</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Recent Activities with Walk tag, PB pill, Run Buddies, and Per-Run Share Story button */}
      <h3 className="mb-2 mt-6 font-bold">Aktivitas terbaru</h3>
      {run.recent.length === 0 ? (
        <p className="text-sm text-neutral-500">Belum ada aktivitas tersinkronisasi.</p>
      ) : (
        <ul className="divide-y divide-[#EFE6D3] text-sm">
          {run.recent.map((a) => {
            const canShare = isOwner && (a.status === "ok" || a.status === "approved" || a.isWalk) && a.distanceM > 0;
            return (
              <li key={a.id} className="py-2.5">
                <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                  <span className="font-bold text-[#241917]">{a.name ?? a.type}</span>
                  <span className="text-xs text-neutral-500">{dateLong(a.startTime)}</span>

                  {a.isWalk && (
                    <span className="rounded bg-[#2F7D4B] px-1.5 py-0.5 text-[11px] font-bold text-white">
                      🚶 JALAN KAKI
                    </span>
                  )}
                  {a.isHigroundStart && (
                    <span className="rounded bg-hg-orange px-1.5 py-0.5 text-[11px] font-bold text-white">
                      START HIGROUND
                    </span>
                  )}
                  {a.pbKeys.map((pk) => (
                    <span key={pk} className="rounded border border-black bg-hg-yellow px-1.5 py-0.5 text-[11px] font-black text-black">
                      ⚡ PB {PB_SHORT_LABEL[pk] ?? pk.toUpperCase()}
                    </span>
                  ))}
                  {!a.isWalk && a.status !== "ok" && (
                    <span className="rounded border border-neutral-400 px-1.5 py-0.5 text-xs">
                      {STATUS[a.status]}{a.flagReasons.length ? `: ${a.flagReasons.map((r) => REASON[r] ?? r).join(", ")}` : ""}
                    </span>
                  )}

                  <div className="ml-auto flex items-center gap-2.5">
                    <span className="font-bold tabular-nums text-[#241917]">
                      {km(a.distanceM / 1000)} km
                      {(a.type.endsWith("Run") || a.isWalk) && a.distanceM > 0
                        ? ` · ${pace(a.movingTimeS / (a.distanceM / 1000))}/km`
                        : ""}
                    </span>
                    {canShare && (
                      <Link
                        href={`/share?run=${encodeURIComponent(a.id)}`}
                        className="rounded-md border-2 border-black bg-hg-yellow px-2 py-0.5 text-xs font-bold text-black shadow-[1px_1px_0_#111] hover:brightness-95"
                      >
                        🎬 Share
                      </Link>
                    )}
                  </div>
                </div>

                {/* Run Buddies row (detected server-side without exposing GPS) */}
                {a.buddies.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="font-bold text-hg-orange">🤝 Lari bareng:</span>
                    {a.buddies.map((b) => (
                      <Link
                        key={b.userId}
                        href={`/u/${b.handle}`}
                        className="inline-flex items-center gap-1 rounded-full border border-[#2b1d17] bg-[#FFF8EA] px-2 py-0.5 font-bold text-[#241917] hover:bg-hg-yellow"
                      >
                        <Avatar avatar={b.avatar} size={18} label={b.displayName} />
                        <span>{b.displayName}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-xs text-neutral-500">
        Rute dan koordinat GPS tidak pernah ditampilkan ke member lain. Deteksi <b>Lari bareng</b> berjalan otomatis di server.
      </p>
    </Panel>
  );
}

function YogaSection({ p }: { p: ProfileView }) {
  const y = p.yoga!;
  return (
    <Panel
      title="Yoga Quest"
      aside={
        <span
          aria-disabled="true"
          className="inline-flex cursor-not-allowed items-center gap-1 rounded border border-neutral-400 bg-neutral-100 px-2 py-0.5 text-xs font-bold text-neutral-500"
        >
          🔒 Coming Soon
        </span>
      }
    >
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
