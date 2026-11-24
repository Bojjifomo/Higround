import { redirect } from "next/navigation";
import { Panel } from "@/components/ui";
import { currentMember, getStore } from "@/lib/data";
import { defaultConfig as yoga } from "@/lib/yoga";
import { ClassForm } from "./ClassForm";

export const dynamic = "force-dynamic";

export default async function ClassMode() {
  const me = await currentMember();
  if (!me) redirect("/login");
  if (me.role !== "admin" && me.role !== "instructor") {
    return <Panel title="Khusus instruktur"><p className="text-sm">Class Mode cuma untuk instruktur dan admin.</p></Panel>;
  }
  const members = (await (await getStore()).members()).map((m) => ({ id: m.id, name: m.displayName }));
  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-pixel text-4xl leading-none">Class Mode</h1>
        <p className="mt-2 max-w-prose text-sm text-neutral-700">
          Untuk kelas yoga di Higround. Pilih member dan misi, pakai stopwatch kalau perlu, lalu beri bintang yang kamu lihat.
          Tanpa video, tanpa cooldown. Tahap misi harus sudah terbuka untuk member itu.
        </p>
      </div>
      <ClassForm members={members} levels={yoga.levels} />
    </div>
  );
}
