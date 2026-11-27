"use client";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui";
import { NICKNAME_MAX, validateNickname } from "@/lib/nickname";
import { createProfile, type FormState } from "../actions";

export function OnboardingForm({ email }: { email: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(createProfile, null);
  const [value, setValue] = useState("");
  const liveCheck = value.length > 0 ? validateNickname(value) : null;

  return (
    <form action={action} className="grid gap-3 text-sm">
      {email && <p className="text-xs text-neutral-500">Masuk sebagai {email}</p>}
      <label className="grid gap-1 font-bold">
        Nama tampilan (Nickname)
        <input
          name="displayName"
          required
          minLength={2}
          maxLength={NICKNAME_MAX}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="contoh: Rina Run 99"
          autoComplete="nickname"
          className="rounded border-2 border-black bg-white px-3 py-2 text-base font-normal"
        />
        <span className="text-xs font-normal text-neutral-600">
          Boleh huruf besar/kecil (Caps Lock bebas), angka, dan spasi. Tanpa simbol atau emoji.
        </span>
      </label>
      {liveCheck && !liveCheck.ok && (
        <p role="alert" className="text-xs font-bold text-hg-red">{liveCheck.message}</p>
      )}
      <div>
        <Button disabled={pending || (liveCheck !== null && !liveCheck.ok)}>Simpan &amp; lanjut</Button>
      </div>
      {state && !state.ok && <p role="alert" className="font-bold text-hg-red">{state.message}</p>}
    </form>
  );
}
