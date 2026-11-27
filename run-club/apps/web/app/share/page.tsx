import { redirect } from "next/navigation";
import { currentMember, getStore, profileView } from "@/lib/data";
import { ShareStudio } from "./ShareStudio";

export const dynamic = "force-dynamic";

export default async function SharePage() {
  const me = await currentMember();
  if (!me) redirect("/login?next=/share");
  const p = await profileView(await getStore(), me.handle, me, Date.now());
  if (!p) redirect("/login");

  return (
    <div className="space-y-4">
      <ShareStudio
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
