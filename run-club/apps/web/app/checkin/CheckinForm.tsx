"use client";
import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import type { CheckinResult } from "@/lib/data/events-service";
import { checkinAction } from "../actions";

export function CheckinForm({ eventId, token, name, who }: { eventId: string; token: string; name: string; who: string }) {
  const [res, action, pending] = useActionState<CheckinResult | null, FormData>(checkinAction, null);
  if (res?.ok) {
    return (
      <div role="status">
        <p className="font-pixel text-2xl text-green-700">{res.already ? "Sudah check-in ✓" : "Check-in berhasil! ✓"}</p>
        <p className="mt-1 text-sm">{name}. Bonus XP dan badge event masuk ke profil kamu.</p>
        <Link href={`/events/${eventId}`} className="mt-3 inline-block font-bold text-hg-orange underline">Lihat event →</Link>
      </div>
    );
  }
  return (
    <form action={action}>
      <p className="mb-3">Check-in <b>{who}</b> ke <b>{name}</b>?</p>
      <input type="hidden" name="e" value={eventId} />
      <input type="hidden" name="t" value={token} />
      <Button disabled={pending}>Check-in</Button>
      {res && !res.ok && <p role="alert" className="mt-2 font-bold text-hg-red">{res.error}</p>}
    </form>
  );
}
