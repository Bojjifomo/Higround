import Link from "next/link";
import { redirect } from "next/navigation";
import { Panel } from "@/components/ui";
import { currentMember, getStore } from "@/lib/data";
import { OnboardingStepper } from "@/components/OnboardingStepper";

export const dynamic = "force-dynamic";

const NOTE: Record<string, string> = {
  denied: "Kamu membatalkan izin di Intervals.icu. Kamu bisa coba lagi atau lewati dulu.",
  expired: "Sesi sambung kedaluwarsa, coba lagi.",
  failed: "Gagal menyambung ke Intervals.icu. Coba lagi sebentar lagi.",
};

export default async function OnboardingConnect({ searchParams }: { searchParams: Promise<{ intervals?: string }> }) {
  const me = await currentMember();
  if (!me) redirect("/login");
  const { intervals } = await searchParams;
  const integ = await (await getStore()).integration(me.id);
  if (integ) redirect("/create?welcome=1&intervals=connected");

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <OnboardingStepper step={2} />
      <Panel title="Sambungkan jam (Intervals.icu)">
        <div className="mb-4 flex items-center gap-3 rounded-md border-2 border-black bg-hg-cream p-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/world/mascot/guide_idle.png"
            alt="Maskot Higround"
            width={56}
            height={56}
            className="shrink-0 [image-rendering:pixelated]"
          />
          <p className="text-sm text-neutral-800">
            <b>Higround:</b>{" "}
            <i>
              &ldquo;Halo <b>{me.displayName}</b>! Sambungkan akun Intervals.icu supaya lari kamu dari Garmin, COROS, Polar, Suunto, atau Wahoo otomatis jadi XP.&rdquo;
            </i>
          </p>
        </div>

        {intervals && NOTE[intervals] && (
          <p role="alert" className="mb-3 rounded border-2 border-hg-red bg-white px-3 py-2 text-xs font-bold text-hg-red">
            {NOTE[intervals]}
          </p>
        )}

        <div className="space-y-3 text-sm">
          <div className="rounded-md border-2 border-black/20 bg-white p-3 text-xs text-neutral-700 space-y-1.5">
            <p className="font-bold text-black">Kenapa lewat Intervals.icu?</p>
            <ul className="list-disc pl-4 space-y-1">
              <li>Garmin, COROS, Polar, Suunto, dan Wahoo langsung tersambung ke Intervals.icu (Apple Watch lewat HealthFit / RunGap).</li>
              <li>Lari 12 minggu terakhir langsung ditarik buat XP awal kamu.</li>
              <li>Lari yang bersumber dari Strava tidak bisa dibaca karena aturan API Strava.</li>
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <a
              href="/api/intervals/connect?next=%2Fcreate%3Fwelcome%3D1"
              className="rounded-md border-2 border-black bg-hg-orange px-4 py-2 text-sm font-bold text-white shadow-[3px_3px_0_#111] hover:translate-x-[-1px] hover:translate-y-[-1px]"
            >
              Sambungkan Intervals.icu →
            </a>
            <Link
              href="/create?welcome=1"
              className="rounded-md border-2 border-black bg-white px-3 py-2 text-sm font-bold hover:bg-hg-cream"
            >
              Lewati dulu, lanjut bikin karakter
            </Link>
          </div>
        </div>
      </Panel>
    </div>
  );
}
