"use client";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import { currentQr } from "../../actions";

/** For the counter screen: the check-in QR, refreshed before it rotates. */
export function QrPanel({ eventId }: { eventId: string }) {
  const [qr, setQr] = useState<{ svg: string; url: string; rotateS: number } | null>(null);
  const [left, setLeft] = useState(0);
  useEffect(() => {
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const load = async () => {
      const q = await currentQr(eventId);
      if (!alive) return;
      setQr(q);
      const ms = q.rotateS * 1000 - (Date.now() % (q.rotateS * 1000));
      setLeft(Math.ceil(ms / 1000));
      timer = setTimeout(load, ms + 500);
    };
    load();
    const tick = setInterval(() => setLeft((s) => Math.max(0, s - 1)), 1000);
    return () => { alive = false; clearTimeout(timer); clearInterval(tick); };
  }, [eventId]);
  return (
    <Panel title="QR check-in (layar kasir)">
      <div className="flex flex-wrap items-center gap-5">
        <div className="h-56 w-56 rounded border-4 border-black bg-white p-1 [&>svg]:h-full [&>svg]:w-full"
             aria-label="QR check-in" dangerouslySetInnerHTML={{ __html: qr?.svg ?? "" }} />
        <div className="max-w-xs text-sm">
          <p>Member scan QR ini dengan kamera HP lalu tekan <b>Check-in</b>. Kode berganti tiap {qr?.rotateS ?? 60} detik, jadi foto QR yang dibagikan cepat kedaluwarsa.</p>
          <p className="mt-2 text-xs text-neutral-500">Ganti dalam {left} dtk</p>
          {qr && <p className="mt-1 break-all text-[10px] text-neutral-400" data-testid="checkin-url">{qr.url}</p>}
        </div>
      </div>
    </Panel>
  );
}
