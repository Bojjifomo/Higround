"use client";
import Link from "next/link";
import { useState } from "react";
import { Panel } from "@/components/ui";
import { sfx } from "@/lib/audio/sfx";

export function CoffeeCheckinClient({
  displayName,
  handle,
  token,
  tokenValid,
  todayWib,
  alreadyToday,
  initialStamps,
}: {
  displayName: string;
  handle: string;
  token: string;
  tokenValid: boolean;
  todayWib: string;
  alreadyToday: boolean;
  initialStamps: number;
}) {
  const [checkedIn, setCheckedIn] = useState(alreadyToday);
  const [stamps, setStamps] = useState(initialStamps);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doCheckin = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch("/api/coffee/checkin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        alreadyCheckedIn?: boolean;
        xpAwarded?: number;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        if (data.alreadyCheckedIn) setCheckedIn(true);
        setError(data.error ?? "Check-in ngopi gagal.");
        return;
      }
      void sfx.cashier();
      setCheckedIn(true);
      setStamps((s) => s + 1);
      setMessage(`Check-in berhasil! +1 Brew Stamp & +${data.xpAwarded ?? 25} XP sudah masuk ke akunmu! ☕✨`);
    } catch {
      setError("Koneksi terputus. Coba lagi sebentar ya.");
    } finally {
      setBusy(false);
    }
  };

  const filledInCycle = stamps > 0 && stamps % 5 === 0 ? 5 : stamps % 5;

  return (
    <div className="mx-auto max-w-md space-y-4">
      <Panel title="☕ Check-in Ngopi Higround">
        <div className="mb-4 flex items-center gap-3 rounded-lg border-2 border-black bg-hg-cream p-3">
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
            <i>
              &ldquo;Halo <b>{displayName}</b>! Makasih udah mampir ngopi hari ini ({todayWib}). Tap check-in di bawah untuk dapat <b>+1 Brew Stamp &amp; +25 XP</b>!&rdquo;
            </i>
          </p>
        </div>

        {/* 5-Stamp Punch Card */}
        <div className="mb-4 rounded-lg border-2 border-[#2b1d17] bg-white p-3">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-neutral-600">Kartu Brew Stamps Kamu</span>
            <span className="text-hg-orange">Total: {stamps} ☕</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-2">
            {Array.from({ length: 5 }, (_, i) => {
              const filled = i < filledInCycle;
              return (
                <div
                  key={i}
                  className={`flex h-11 w-11 items-center justify-center rounded-full border-2 border-[#2b1d17] text-lg transition-transform ${
                    filled ? "scale-105 bg-hg-orange text-white shadow-[2px_2px_0_#111]" : "bg-[#EFE1C4] text-neutral-400"
                  }`}
                >
                  ☕
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-[11px] text-neutral-600">
            Kumpulin <b>3 Stamps</b> → <b>Free Popsicle Gelato</b> · <b>5 Stamps</b> → <b>Free Coffee</b>! (Maks 1× check-in/hari WIB)
          </p>
        </div>

        {!tokenValid && !checkedIn ? (
          <div className="rounded-lg border-2 border-hg-red bg-white p-3 text-sm text-hg-red">
            <b>QR tidak valid atau sudah kedaluwarsa.</b> Coba scan ulang QR Check-in Ngopi di kasir / meja Higround ya!
          </div>
        ) : checkedIn ? (
          <div className="space-y-3">
            <div className="rounded-lg border-2 border-emerald-700 bg-emerald-50 p-3 text-sm font-bold text-emerald-900">
              ✅ {message ?? `Kamu sudah check-in ngopi hari ini (${todayWib})! Sampai ketemu besok buat Brew Stamp berikutnya.`}
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/world"
                className="flex-1 rounded-md border-2 border-black bg-hg-orange px-4 py-2 text-center text-sm font-bold text-white shadow-[3px_3px_0_#111]"
              >
                🗺️ Masuk Dunia Higround
              </Link>
              <Link
                href={`/u/${handle}`}
                className="rounded-md border-2 border-black bg-white px-4 py-2 text-center text-sm font-bold"
              >
                Profil
              </Link>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <button
              type="button"
              disabled={busy}
              onClick={doCheckin}
              className="w-full rounded-md border-2 border-black bg-hg-orange px-4 py-3 text-base font-bold text-white shadow-[3px_3px_0_#111] hover:translate-x-[-1px] hover:translate-y-[-1px] disabled:opacity-50"
            >
              {busy ? "Memproses check-in..." : "☕ Check-in Ngopi (+1 Stamp & +25 XP)"}
            </button>
            {error && (
              <p role="alert" className="rounded border-2 border-hg-red bg-white px-3 py-2 text-xs font-bold text-hg-red">
                ⚠️ {error}
              </p>
            )}
          </div>
        )}
      </Panel>
    </div>
  );
}
