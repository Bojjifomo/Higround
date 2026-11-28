"use client";
/**
 * Classic MMORPG World Chatbox overlay for /world (Roadmap v4 — Fase E).
 * Messages are checked by the Indonesian profanity filter on the server AND pop up
 * as live overhead speech bubbles above the speaker's pixel character in Phaser!
 */
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { sfx } from "@/lib/audio/sfx";
import type { WorldChatMessage } from "@/lib/chat/store";

const QUICK_CHATS = ["☕ Ngopi yuk!", "🏃 Gas lari!", "🔥 Semangat!", "👋 Halo!"];

function timeWib(ms: number): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(ms));
}

export function WorldChatBox({
  messages,
  signedIn,
  onSend,
  onClose,
}: {
  messages: WorldChatMessage[];
  signedIn: boolean;
  onSend: (text: string) => Promise<{ ok: true } | { ok: false; error: string }>;
  onClose: () => void;
}) {
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const submit = async (text: string) => {
    const clean = text.trim();
    if (!clean || busy) return;
    setBusy(true);
    setError(null);
    const res = await onSend(clean);
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    void sfx.pop(2);
    setInput("");
  };

  return (
    <div className="pixel-frame pointer-events-auto absolute inset-x-2 bottom-[118px] z-30 mx-auto w-[calc(100%-16px)] max-w-[380px] rounded-xl bg-[#FFF8EA] p-2.5 shadow-lg sm:bottom-[96px]">
      {/* Header */}
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <span className="font-pixel text-sm leading-none text-[#241917]">💬 World Chat</span>
          <span className="rounded bg-[#EFE1C4] px-1.5 py-0.5 text-[9px] font-bold text-[#3B261C]">
            🛡️ Anti-Toxic
          </span>
        </div>
        <button
          type="button"
          onClick={() => { void sfx.select(); onClose(); }}
          className="rounded border border-[#2b1d17] bg-white px-1.5 py-0.5 text-[10px] font-bold text-[#241917]"
        >
          ✕
        </button>
      </div>

      {/* MMORPG Message Log */}
      <div
        ref={logRef}
        className="h-36 overflow-y-auto rounded-lg border-2 border-[#2b1d17] bg-[#241917] px-2.5 py-2 font-mono text-[11px] leading-snug text-[#FFF8EA] space-y-1.5"
      >
        {messages.length === 0 ? (
          <p className="text-neutral-400">
            Belum ada obrolan nih. Sapa pelari lain — pesanmu bakal muncul jadi bubble di atas kepala karaktermu! 💬
          </p>
        ) : (
          messages.map((m) =>
            m.isAdminAnnouncement ? (
              <div
                key={m.id}
                className="break-words rounded border border-hg-orange/70 bg-hg-orange/25 px-1.5 py-1 text-[#FFF8EA]"
              >
                <span className="text-neutral-300">[{timeWib(m.createdAt)}]</span>{" "}
                <span className="rounded bg-hg-orange px-1 py-0.5 text-[9px] font-black text-white">
                  📣 ADMIN
                </span>{" "}
                <span className="font-bold text-hg-yellow">{m.text}</span>
              </div>
            ) : (
              <div key={m.id} className="break-words">
                <span className="text-neutral-400">[{timeWib(m.createdAt)}]</span>{" "}
                <Link href={`/u/${m.handle}`} className="font-bold text-hg-yellow hover:underline">
                  {m.displayName.split(" ")[0]}
                </Link>
                <span className="text-[10px] text-hg-orange"> (Lv{m.level})</span>:{" "}
                <span>{m.text}</span>
              </div>
            ),
          )
        )}
      </div>

      {/* Quick Emote Chips & Input */}
      {signedIn ? (
        <div className="mt-2 space-y-1.5">
          <div className="flex gap-1 overflow-x-auto pb-0.5">
            {QUICK_CHATS.map((q) => (
              <button
                key={q}
                type="button"
                disabled={busy}
                onClick={() => void submit(q)}
                className="shrink-0 rounded-full border border-[#2b1d17] bg-white px-2 py-0.5 text-[10px] font-bold text-[#241917] hover:bg-hg-yellow disabled:opacity-50"
              >
                {q}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void submit(input);
            }}
            className="flex gap-1.5"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={140}
              placeholder="Ketik pesan di dunia Higround..."
              className="min-w-0 flex-1 rounded-md border-2 border-[#2b1d17] bg-white px-2.5 py-1 text-xs font-medium text-[#241917]"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="pixel-btn shrink-0 rounded-md bg-hg-orange px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
            >
              {busy ? "..." : "Kirim"}
            </button>
          </form>

          {error && (
            <p role="alert" className="rounded border border-hg-red bg-white px-2 py-1 text-[11px] font-bold text-hg-red">
              ⚠️ {error}
            </p>
          )}
        </div>
      ) : (
        <div className="mt-2 text-center text-xs">
          <Link href="/login" className="font-bold text-hg-orange underline">
            Masuk dulu untuk ikut World Chat →
          </Link>
        </div>
      )}
    </div>
  );
}
