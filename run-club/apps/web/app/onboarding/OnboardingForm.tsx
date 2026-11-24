"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { createProfile, type FormState } from "../actions";

export function OnboardingForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProfile, null);
  return (
    <form action={action} className="grid gap-3 text-sm">
      {email && <p className="text-xs text-neutral-500">Masuk sebagai {email}</p>}
      <label className="grid gap-1 font-bold">Nama tampilan
        <input name="displayName" required maxLength={40} className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
      </label>
      <label className="grid gap-1 font-bold">Username (untuk link profil)
        <input name="handle" required pattern="[a-z0-9_]{3,24}" placeholder="contoh: rina_run" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
      </label>
      <div><Button disabled={pending}>Simpan &amp; lanjut</Button></div>
      {state && !state.ok && <p role="alert" className="font-bold text-hg-red">{state.message}</p>}
    </form>
  );
}
