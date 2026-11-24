import { redirect } from "next/navigation";
import { Panel } from "@/components/ui";
import { currentMember, getStore } from "@/lib/data";
import { CheckinForm } from "./CheckinForm";

export const dynamic = "force-dynamic";

/** Opened by scanning the counter QR. The check-in itself is a POST (button), never a GET side effect. */
export default async function Checkin({ searchParams }: { searchParams: Promise<{ e?: string; t?: string }> }) {
  const { e = "", t = "" } = await searchParams;
  const me = await currentMember();
  if (!me) redirect(`/login?next=${encodeURIComponent(`/checkin?e=${e}&t=${t}`)}`);
  const ev = await (await getStore()).event(e);
  return (
    <Panel title="Check-in event" className="mx-auto max-w-md">
      {ev ? <CheckinForm eventId={e} token={t} name={ev.name} who={me.displayName} /> : <p>Event tidak ditemukan.</p>}
    </Panel>
  );
}
