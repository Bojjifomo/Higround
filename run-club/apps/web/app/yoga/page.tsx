import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel } from "@/components/ui";
import { currentMember } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function YogaPage() {
  const me = await currentMember();
  if (!me) redirect("/login");

  return (
    <div className="mx-auto max-w-xl space-y-5">
      <div>
        <span className="inline-flex items-center gap-1 rounded bg-black px-2 py-0.5 text-xs font-bold uppercase tracking-wider text-hg-yellow">
          🔒 Coming Soon
        </span>
        <h1 className="mt-2 font-pixel text-4xl leading-none">Yoga Quest</h1>
      </div>

      <Panel title="Fitur Yoga Quest Sedang Disiapkan">
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/world/mascot/guide_idle.png"
            alt="Maskot Higround"
            width={56}
            height={56}
            className="shrink-0 [image-rendering:pixelated]"
          />
          <div className="space-y-2 text-sm text-neutral-700">
            <p>
              <b>Higround:</b>{" "}
              <i>&ldquo;Sabar ya! Yoga Quest (5 tahap, 28 pose) lagi kita poles dulu sebelum dibuka bareng jadwal Studio Room.&rdquo;</i>
            </p>
            <p className="text-xs text-neutral-600">
              Sementara ini, kamu bisa terus kumpulin XP dari lari, cek Misi Klub, dan nongkrong di Dunia Higround!
            </p>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Link
            href="/world"
            className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_#111]"
          >
            ← Kembali ke Dunia Higround
          </Link>
          <Link
            href={`/u/${me.handle}`}
            className="rounded-md border-2 border-black bg-white px-4 py-2 text-sm font-bold"
          >
            Buka Profil
          </Link>
        </div>
      </Panel>
    </div>
  );
}
