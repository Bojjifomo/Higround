import { redirect } from "next/navigation";
import { Panel } from "@/components/ui";
import { authUser, currentMember, isDemo } from "@/lib/data";
import { OnboardingForm } from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function Onboarding() {
  if (isDemo()) redirect("/login");
  const me = await currentMember();
  if (me) redirect(`/u/${me.handle}`);
  const u = await authUser();
  if (!u) redirect("/login");
  return (
    <Panel title="Halo! Bikin profil dulu" className="mx-auto max-w-lg">
      <p className="mb-4 text-sm text-neutral-700">
        Higround: <i>&ldquo;Selamat datang di Run Club! Pilih nama yang muncul di dunia dan di profil kamu.&rdquo;</i>
      </p>
      <OnboardingForm email={u.email} />
    </Panel>
  );
}
