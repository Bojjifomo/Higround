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
          <p className="text-sm font-bold uppercase tracking-widest text-hg-orange">Higround Coffee &amp; Run Club · Harapan Indah</p>
          <h1 className="mt-2 font-pixel text-4xl leading-none sm:text-5xl">Ngopi, lari, nongkrong di dunia pixel.</h1>
          <p className="mt-3 max-w-prose text-sm leading-relaxed text-neutral-700 sm:text-base">
            Intip ruko Higround versi game interaktif, bikin karakter pixel kamu sendiri, kumpulin <b>Brew Stamps &amp; Free Drinks</b>, lalu ikutan event &amp; lari bareng komunitas — tanpa wajib punya smartwatch dulu!
          </p>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-bold text-[#241917]">
            <span className="rounded-full border-2 border-black bg-[#FFF8EA] px-2.5 py-1">☕ Brew Stamps &amp; Free Drinks</span>
            <span className="rounded-full border-2 border-black bg-[#FFF8EA] px-2.5 py-1">🗺️ Ruko Pixel &amp; Menu Kafe</span>
            <span className="rounded-full border-2 border-black bg-[#FFF8EA] px-2.5 py-1">🏃 Bonus XP Lari &amp; Event</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {me ? (
              <>
                <Link href="/world" className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 font-bold text-white shadow-[3px_3px_0_#111]">🗺️ Masuk Dunia Higround</Link>
                <Link href="/create" className="rounded-md border-2 border-black bg-hg-yellow px-4 py-2 font-bold">🎨 Edit Karakter</Link>
                <Link href={`/u/${me.handle}`} className="rounded-md border-2 border-black bg-white px-4 py-2 font-bold">Profil gue</Link>
              </>
            ) : (
              <>
                <Link href="/world" className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 font-bold text-white shadow-[3px_3px_0_#111]">🗺️ Jelajahi Dunia Higround</Link>
                <Link href="/login" className="rounded-md border-2 border-black bg-hg-yellow px-4 py-2 font-bold shadow-[3px_3px_0_#111]">Masuk / Daftar Gratis</Link>
              </>
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
