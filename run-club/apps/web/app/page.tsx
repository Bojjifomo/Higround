import Link from "next/link";
import { redirect } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { Panel } from "@/components/ui";
import { authUser, currentMember, getStore, leaderboardLite } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function Home() {
  const me = await currentMember();
  if (!me && (await authUser())) redirect("/onboarding");   // signed in with Google / email but no profile yet
  const rows = await leaderboardLite(await getStore());
  return (
    <div className="space-y-6">
      <section className="grid items-center gap-6 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="text-sm font-bold uppercase tracking-widest text-hg-orange">Higround Harapan Indah</p>
          <h1 className="mt-2 font-pixel text-5xl leading-none">Lari, yoga, naik level.</h1>
          <p className="mt-3 max-w-prose text-neutral-700">
            Sambungkan jam lu lewat Intervals.icu. Tiap lari dan tiap misi Yoga Quest jadi XP, dan start dari Higround
            dapat bonus. Dunia pixel Higround menyusul.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            {me ? (
              <>
                <Link href={`/u/${me.handle}`} className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 font-bold text-white shadow-[3px_3px_0_#111]">Profil gue</Link>
                <Link href="/yoga" className="rounded-md border-2 border-black bg-white px-4 py-2 font-bold">Yoga Quest</Link>
                <Link href="/world" className="rounded-md border-2 border-black bg-white px-4 py-2 font-bold">Masuk dunia Higround</Link>
              </>
            ) : (
              <Link href="/login" className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 font-bold text-white shadow-[3px_3px_0_#111]">Masuk</Link>
            )}
          </div>
        </div>
        <Panel title="Member">
          <ol className="divide-y divide-[#EFE6D3]">
            {rows.map(({ member, level }, i) => (
              <li key={member.id}>
                <Link href={`/u/${member.handle}`} className="flex items-center gap-3 py-2 hover:bg-hg-cream/50">
                  <span className="w-5 text-right font-pixel text-lg text-neutral-500">{i + 1}</span>
                  <Avatar avatar={member.avatar} size={28} label="" />
                  <span className="min-w-0 flex-1 truncate font-bold">{member.displayName}</span>
                  <span className="whitespace-nowrap text-xs">Lv {level.level} · {level.title}</span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-neutral-500">Urut berdasarkan XP. Profil privat tidak ditampilkan.</p>
        </Panel>
      </section>
    </div>
  );
}
