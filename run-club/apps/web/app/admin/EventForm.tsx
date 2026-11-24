"use client";
import { useActionState } from "react";
import { Button, Panel } from "@/components/ui";
import type { EventTemplate } from "@/lib/events";
import { createEventAction, type EventFormState } from "../actions";

export function EventForm({ templates }: { templates: Record<string, EventTemplate> }) {
  const [state, action, pending] = useActionState<EventFormState, FormData>(createEventAction, null);
  return (
    <Panel title="Buat event">
      <form action={action} className="grid gap-3 text-sm sm:grid-cols-2">
        <label className="grid gap-1 font-bold">Template
          <select name="template" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal">
            {Object.entries(templates).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
        </label>
        <label className="grid gap-1 font-bold">Mulai (WIB)
          <input type="datetime-local" name="startsAt" required className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
        </label>
        <label className="grid gap-1 font-bold">Nama (opsional)
          <input name="name" placeholder="pakai nama template" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
        </label>
        <label className="grid gap-1 font-bold">Multiplier XP (opsional)
          <input name="multiplier" type="number" min={1} max={5} step={0.5} placeholder="dari template" className="rounded border-2 border-black bg-white px-2 py-1.5 font-normal" />
        </label>
        <div className="sm:col-span-2"><Button disabled={pending}>Buat</Button>
          {state && <span role="status" className={`ml-3 font-bold ${state.ok ? "text-green-700" : "text-hg-red"}`}>{state.message}</span>}</div>
      </form>
    </Panel>
  );
}
