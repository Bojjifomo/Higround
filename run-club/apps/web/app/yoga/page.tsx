import { redirect } from "next/navigation";
import { Button, Panel } from "@/components/ui";
import { currentMember, flags, getStore, questView, FLOW_KEY } from "@/lib/data";
import { defaultConfig as yoga } from "@/lib/yoga";
import { acceptConsent } from "../actions";
import { QuestBoard } from "./QuestBoard";

export const dynamic = "force-dynamic";

export default async function YogaPage() {
  const me = await currentMember();
  if (!me) redirect("/login");
  const q = await questView(await getStore(), me, Date.now(), flags());

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-pixel text-4xl leading-none">Yoga Quest</h1>
        <p className="mt-2 max-w-prose text-sm text-neutral-700">
          5 tahap, 28 misi. Tahan pose sesuai target untuk dapat 1–3 bintang. Tahap berikutnya terbuka kalau 80% misi
          di tahap ini sudah ≥2★. Kamu bisa klaim di mana aja pakai timer ini, atau ikut kelas di Higround (Class Mode).
        </p>
      </div>

      {!q.consentOk ? (
        <Panel title="Sebelum mulai">
          <ul className="list-disc space-y-1 pl-5 text-sm">
            <li><b>Sistem kejujuran.</b> Klaim hanya waktu yang benar-benar kamu tahan, dengan bentuk yang benar. Instruktur bisa membatalkan klaim.</li>
            <li><b>Keamanan dulu.</b> Untuk inversi dan backbend, bentuk yang benar lebih penting dari durasi. Berhenti kalau nyeri, pusing, atau ada cedera.</li>
            <li>Timer berjalan di server: waktunya dihitung dari saat kamu tekan Mulai sampai Selesai.</li>
          </ul>
          <form action={acceptConsent} className="mt-3"><Button>Saya mengerti dan setuju</Button></form>
        </Panel>
      ) : q.waGateEnabled && !q.waVerified ? (
        <Panel title="Gabung grup WhatsApp dulu">
          <p className="text-sm">Yoga Quest butuh kamu gabung grup WhatsApp Run Club. Admin akan menandai akunmu setelah kamu masuk.</p>
          {q.waGroupUrl
            ? <a href={q.waGroupUrl} target="_blank" rel="noopener" className="mt-3 inline-block rounded-md border-2 border-black bg-[#25D366] px-3 py-1.5 font-bold">Buka grup WhatsApp</a>
            : <p className="mt-3 inline-block rounded bg-neutral-200 px-3 py-1.5 text-sm font-bold">Segera hadir</p>}
        </Panel>
      ) : (
        <QuestBoard
          levels={yoga.levels}
          progress={q.progress}
          bests={q.bests}
          cooldowns={q.cooldowns}
          claimsToday={q.claimsToday}
          maxClaims={yoga.claim.max_claims_per_day}
          flow={{ ...yoga.bonus_missions[0], key: FLOW_KEY, unlocked: q.progress.flowUnlocked, done: q.flowDone }}
        />
      )}

      {q.recent.length > 0 && (
        <Panel title="Klaim terakhir">
          <ul className="divide-y divide-[#EFE6D3] text-sm">
            {q.recent.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-3 py-1">
                <span className="font-bold">{yoga.levels.flatMap((l) => l.missions).find((m) => m.key === a.missionKey)?.name ?? "Flow Challenge"}</span>
                {a.side !== "both" && <span>{a.side === "left" ? "kiri" : "kanan"}</span>}
                <span>{a.measuredS} dtk · {a.stars}★</span>
                <span className="text-neutral-500">{a.mode === "class" ? "Class Mode" : "self-reported"}</span>
                {a.status === "rejected" && <span className="text-hg-red">dibatalkan{a.reason ? `: ${a.reason}` : ""}</span>}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
