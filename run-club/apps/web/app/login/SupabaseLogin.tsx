"use client";
import { useActionState } from "react";
import { Button } from "@/components/ui";
import { sendMagicLink, signInWithGoogle, type FormState } from "../actions";

export function SupabaseLogin({ next }: { next: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(sendMagicLink, null);
  return (
    <div className="grid gap-4 text-sm">
      <form action={signInWithGoogle}>
        <input type="hidden" name="next" value={next} />
        <Button variant="ghost" className="w-full">Masuk dengan Google</Button>
      </form>
      <div className="text-center text-xs text-neutral-500">atau lewat email</div>
      <form action={action} className="grid gap-2">
        <input type="hidden" name="next" value={next} />
        <label className="grid gap-1 font-bold">Email
          <input type="email" name="email" required autoComplete="email" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
        </label>
        <Button disabled={pending}>Kirim link masuk</Button>
        {state && <p role="status" className={`font-bold ${state.ok ? "text-green-700" : "text-hg-red"}`}>{state.message}</p>}
      </form>
    </div>
  );
}
