import { Avatar } from "@/components/Avatar";
import { Panel } from "@/components/ui";
import { getStore, isDemo } from "@/lib/data";
import { loginAs } from "../actions";

export const dynamic = "force-dynamic";

const ROLE = { admin: "Admin", instructor: "Instruktur", member: "Member" } as const;

export default async function Login() {
  if (!isDemo()) {
    return <Panel title="Masuk">Login Google / email magic link menyusul bersama Supabase Auth (roadmap Fase 1).</Panel>;
  }
  const members = await (await getStore()).members();
  return (
    <Panel title="Masuk (mode demo)" className="mx-auto max-w-xl">
      <p className="mb-4 text-sm text-neutral-700">
        Supabase belum disambungkan, jadi pilih salah satu member demo. Login Google / email menyusul.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        {members.map((m) => (
          <form key={m.id} action={loginAs}>
            <input type="hidden" name="id" value={m.id} />
            <button className="flex w-full items-center gap-3 rounded-md border-2 border-black bg-white px-3 py-2 text-left hover:bg-hg-cream">
              <Avatar avatar={m.avatar} size={28} label="" />
              <span className="min-w-0">
                <span className="block truncate font-bold">{m.displayName}</span>
                <span className="text-xs text-neutral-600">{ROLE[m.role]}{m.isPublic ? "" : " · privat"}</span>
              </span>
            </button>
          </form>
        ))}
      </div>
    </Panel>
  );
}
