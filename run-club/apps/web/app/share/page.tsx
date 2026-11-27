import { redirect } from "next/navigation";
import { currentMember, getStore, profileView } from "@/lib/data";
import { dateLong, duration, pace } from "@/lib/format";
import { PB_BADGE_SPECS } from "@/lib/runs";
import type { ShareRunItem } from "@/remotion/RunStoryVideo";
import { ShareStudio } from "./ShareStudio";

export const dynamic = "force-dynamic";

const PB_NAME = Object.fromEntries(PB_BADGE_SPECS.map((s) => [s.key, s.name])) as Record<string, string>;

export default async function SharePage({
  searchParams,
}: {
  searchParams: Promise<{ run?: string }>;
}) {
  const q = await searchParams;
  const me = await currentMember();
  if (!me) {
    const next = q.run ? `/share?run=${encodeURIComponent(q.run)}` : "/share";
    redirect(`/login?next=${encodeURIComponent(next)}`);
  }
  const p = await profileView(await getStore(), me.handle, me, Date.now());
  if (!p) redirect("/login");

  const recentRuns: ShareRunItem[] = (p.run?.recent ?? [])
    .filter((a) => (a.status === "ok" || a.status === "approved" || a.isWalk) && a.distanceM > 0)
    .map((a) => {
      const distanceKm = a.distanceM / 1000;
      const paceS = distanceKm > 0 ? a.movingTimeS / distanceKm : null;
      return {
        id: a.id,
        name: a.name ?? (a.isWalk ? "Jalan Kaki" : "Lari"),
        dateLabel: dateLong(a.startTime),
        distanceKm,
        movingTimeS: a.movingTimeS,
        paceLabel: `${pace(paceS)}/km`,
        durationLabel: duration(a.movingTimeS),
        isHigroundStart: a.isHigroundStart,
        isWalk: a.isWalk,
        pbLabels: a.pbKeys.map((k) => PB_NAME[k] ?? `PB ${k.toUpperCase()}`),
        buddies: a.buddies.map((b) => ({
          handle: b.handle,
          displayName: b.displayName,
          avatar: b.avatar,
          atHiground: b.atHiground,
        })),
      };
    });

  return (
    <div className="space-y-4">
      <ShareStudio
        initialRunId={q.run ?? null}
        recentRuns={recentRuns}
        baseProps={{
          displayName: p.member.displayName,
          handle: p.member.handle,
          avatar: p.member.avatar,
          level: p.level.level,
          title: p.level.title,
          totalXp: p.level.totalXp,
          weekKm: p.run?.weekKm ?? 0,
          totalKm: p.run?.totalKm ?? 0,
          higroundStarts: p.run?.higroundStarts ?? 0,
          yogaStars: p.yoga?.progress.totalStars ?? 0,
          badges: p.badges.pinned.map((b) => b.name),
        }}
      />
    </div>
  );
}
