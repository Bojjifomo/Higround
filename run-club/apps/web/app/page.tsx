import { getProvider } from "@/lib/providers";
import { supabaseConfigured } from "@/lib/supabase/env";
import { defaultRules, levelFor, xpForLevel } from "@/lib/xp";
import { defaultConfig as yoga } from "@/lib/yoga";

// Fase 0–2 placeholder: shows the app is wired to the shared rules. Real pages come in session 2.
export const dynamic = "force-dynamic";

export default function Home() {
  const provider = getProvider().name;
  const missions = yoga.levels.flatMap((l) => l.missions).length;
  const titles = defaultRules.titles.map((t) => ({ ...t, xp: xpForLevel(t.from) }));
  return (
    <main className="mx-auto max-w-2xl px-4 py-10 font-[family-name:var(--font-geist-sans)]">
      <p className="text-sm font-bold uppercase tracking-widest text-hg-orange">Higround Harapan Indah</p>
      <h1 className="mt-2 text-4xl font-black">HIGROUND RUN CLUB</h1>
      <p className="mt-3 text-neutral-700">
        Fondasi Fase 0–2: aturan XP, Yoga Quest, database, dan provider Intervals.icu. Halaman profil, Yoga Quest,
        dan admin menyusul di sesi berikutnya.
      </p>

      <section className="mt-8 rounded-lg border-4 border-hg-orange bg-white p-5">
        <h2 className="text-lg font-bold">Status</h2>
        <ul className="mt-2 space-y-1 text-sm">
          <li>Provider aktivitas: <b>{provider === "intervals" ? "Intervals.icu" : "Mock (kredensial belum diisi)"}</b></li>
          <li>Supabase: <b>{supabaseConfigured() ? "tersambung" : "belum disetel"}</b></li>
          <li>Yoga Quest: <b>{yoga.levels.length} tahap, {missions} misi</b></li>
          <li>Contoh: 3.240 XP = <b>Lv {levelFor(3240).level} · {levelFor(3240).title}</b></li>
        </ul>
      </section>

      <section className="mt-6">
        <h2 className="text-lg font-bold">Title per level</h2>
        <table className="mt-2 w-full text-sm">
          <thead><tr className="text-left text-neutral-500"><th>Level</th><th>Title</th><th className="text-right">XP total</th></tr></thead>
          <tbody>
            {titles.map((t) => (
              <tr key={t.from} className="border-t border-hg-cream">
                <td>{t.from}</td><td>{t.title}</td><td className="text-right tabular-nums">{t.xp.toLocaleString("id-ID")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  );
}
