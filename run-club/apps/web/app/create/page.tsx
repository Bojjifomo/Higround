import { redirect } from "next/navigation";
import { currentMember } from "@/lib/data";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { CharacterCreator } from "./CharacterCreator";

export const dynamic = "force-dynamic";

export default async function CreateCharacterPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string; intervals?: string; next?: string }>;
}) {
  const me = await currentMember();
  if (!me) redirect("/login?next=/create");
  const { welcome, intervals, next } = await searchParams;
  const isWelcome = welcome === "1" || !me.avatar.customized;
  const safeNext = next && next.startsWith("/") && !next.startsWith("//") ? next : "/world";

  return (
    <div className="space-y-4">
      {isWelcome && (
        <div className="mx-auto max-w-lg">
          <OnboardingStepper step={3} />
        </div>
      )}
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-hg-orange">Higround Character Studio</p>
          <h1 className="font-pixel text-3xl leading-none">
            {isWelcome ? "Bikin Karakter Pixel Kamu" : "Edit Karakter"}
          </h1>
        </div>
      </div>
      <CharacterCreator
        initial={me.avatar}
        displayName={me.displayName}
        handle={me.handle}
        welcome={isWelcome}
        intervalsNote={intervals}
        nextPath={safeNext}
      />
    </div>
  );
}
