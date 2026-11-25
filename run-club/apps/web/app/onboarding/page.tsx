import { redirect } from "next/navigation";
import { OnboardingStepper } from "@/components/OnboardingStepper";
import { Panel } from "@/components/ui";
import { authUser, currentMember, isDemo } from "@/lib/data";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  if (isDemo()) redirect("/login");
  const me = await currentMember();
  if (me) redirect(me.avatar.customized ? `/u/${me.handle}` : "/onboarding/connect");
  const u = await authUser();
  if (!u) redirect("/login");
  return (
    <div className="mx-auto max-w-lg space-y-4">
      <OnboardingStepper step={1} />
      <Panel title="Halo! Bikin ID dulu">
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
            <i>&ldquo;Selamat datang di Run Club! Pertama, pilih nama dan username dulu. Habis itu kita sambungin jam lari &amp; bikin karakter pixel kamu!&rdquo;</i>
          </p>
        </div>
        <OnboardingForm email={u.email} />
      </Panel>
    </div>
  );
}
