"use client";
import { useEffect, useState } from "react";
import { Panel } from "@/components/ui";
import type { CoffeeCheckinRecord, VoucherRedemptionRecord } from "@/lib/admin/crm";
import { dateShort } from "@/lib/format";

interface CoffeeQrPayload {
  dateWib: string;
  dailyUrl: string;
  dailySvg: string;
  staticUrl: string;
  staticSvg: string;
}

export function CoffeeActivationPanel({
  coffeeCheckins,
  voucherRedemptions,
}: {
  coffeeCheckins: CoffeeCheckinRecord[];
  voucherRedemptions: VoucherRedemptionRecord[];
}) {
  const [qr, setQr] = useState<CoffeeQrPayload | null>(null);
  const [qrMode, setQrMode] = useState<"daily" | "static">("daily");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    fetch("/api/admin/coffee-qr", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { ok?: boolean } & Partial<CoffeeQrPayload>) => {
        if (alive && d.ok && d.dailySvg && d.staticSvg && d.dailyUrl && d.staticUrl && d.dateWib) {
          setQr({
            dateWib: d.dateWib,
            dailyUrl: d.dailyUrl,
            dailySvg: d.dailySvg,
            staticUrl: d.staticUrl,
            staticSvg: d.staticSvg,
          });
        }
      })
      .catch(() => null);
    return () => { alive = false; };
  }, []);

  const activeUrl = qr ? (qrMode === "daily" ? qr.dailyUrl : qr.staticUrl) : "";
  const activeSvg = qr ? (qrMode === "daily" ? qr.dailySvg : qr.staticSvg) : "";

  const copyLink = async () => {
    if (!activeUrl || typeof navigator === "undefined" || !navigator.clipboard) return;
    try {
      await navigator.clipboard.writeText(activeUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore clipboard errors
    }
  };

  const downloadSvg = () => {
    if (!activeSvg) return;
    const blob = new Blob([activeSvg], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = qrMode === "daily" ? `higround-coffee-qr-${qr?.dateWib ?? "today"}.svg` : "higround-coffee-table-qr-permanent.svg";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Panel title="☕ Daily Coffee Check-in QR & Log Redeem Kasir">
      <div className="grid gap-4 lg:grid-cols-[1.05fr_1.2fr]">
        {/* QR Generator for Counter Tablet & Printable Table Stickers */}
        <div className="space-y-3 rounded-lg border-2 border-[#2b1d17] bg-[#FFF8EA] p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold uppercase tracking-wide text-[#241917]">
              QR Check-in Ngopi (+1 Brew Stamp &amp; +25 XP)
            </h3>
            <div className="flex gap-1 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setQrMode("daily")}
                className={`rounded border border-black px-2 py-0.5 ${qrMode === "daily" ? "bg-hg-orange text-white" : "bg-white"}`}
              >
                QR Harian (Layar Kasir)
              </button>
              <button
                type="button"
                onClick={() => setQrMode("static")}
                className={`rounded border border-black px-2 py-0.5 ${qrMode === "static" ? "bg-hg-navy text-white" : "bg-white"}`}
              >
                QR Stiker Meja (Cetak)
              </button>
            </div>
          </div>

          <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
            <div
              className="h-40 w-40 shrink-0 rounded-lg border-2 border-black bg-white p-2 [&>svg]:h-full [&>svg]:w-full"
              aria-label="QR Check-in Ngopi Higround"
              dangerouslySetInnerHTML={{ __html: activeSvg }}
            />
            <div className="min-w-0 flex-1 space-y-2 text-xs text-neutral-700">
              {qrMode === "daily" ? (
                <p>
                  <b>Mode Layar Kasir ({qr?.dateWib ?? "hari ini"} WIB):</b> Kode berganti otomatis setiap hari WIB agar foto QR tidak bisa dipakai di luar hari itu.
                </p>
              ) : (
                <p>
                  <b>Mode Stiker Meja / Kasir (Siap Print):</b> QR permanen yang bisa dicetak &amp; ditempel di meja/kasir. Server tetap membatasi maksimal <b>1× check-in per hari WIB</b> per member.
                </p>
              )}
              <p className="text-[11px] text-neutral-600">
                Customer scan pakai kamera HP → masuk <code>/coffee-checkin</code> → tap Check-in → otomatis dapat <b>+1 Brew Stamp</b> &amp; <b>+25 XP</b>! (3 Stamps = Free Popsicle Gelato, 5 Stamps = Free Coffee).
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => void copyLink()}
                  className="rounded border-2 border-black bg-white px-2.5 py-1 text-[11px] font-bold hover:bg-hg-cream"
                >
                  {copied ? "✅ Link Disalin!" : "📋 Salin Link QR"}
                </button>
                <button
                  type="button"
                  onClick={downloadSvg}
                  className="rounded border-2 border-black bg-hg-yellow px-2.5 py-1 text-[11px] font-bold text-[#241917]"
                >
                  🖨️ Download SVG (Siap Print)
                </button>
              </div>
              {activeUrl && (
                <p className="break-all font-mono text-[10px] text-neutral-400">{activeUrl}</p>
              )}
            </div>
          </div>
        </div>

        {/* Live Kasir Voucher Redemptions + Recent Coffee Check-ins */}
        <div className="space-y-3">
          <div>
            <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-neutral-600">
              🎟️ Log Redeem Voucher Kafe di Kasir ({voucherRedemptions.length})
            </h3>
            <div className="max-h-40 overflow-y-auto rounded-lg border-2 border-[#2b1d17] bg-white p-2 text-xs">
              {voucherRedemptions.length === 0 ? (
                <p className="py-3 text-center text-neutral-400">
                  Belum ada voucher kafe yang dikonfirmasi ditukar di kasir.
                </p>
              ) : (
                <ul className="divide-y divide-[#EFE6D3]">
                  {voucherRedemptions.slice(0, 20).map((r) => (
                    <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5">
                      <div>
                        <span className="font-bold text-[#241917]">{r.displayName}</span>{" "}
                        <span className="text-[11px] text-neutral-500">@{r.handle}</span> ·{" "}
                        <span className="font-semibold text-hg-orange">{r.voucherName}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="rounded border border-black bg-hg-yellow px-1.5 py-0.5 font-mono text-[10px] font-black">
                          {r.voucherCode}
                        </span>
                        <span className="text-[11px] text-emerald-700 font-bold">
                          ✅ {dateShort(r.redeemedAt)}
                        </span>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div>
            <h3 className="mb-1.5 text-xs font-extrabold uppercase tracking-wide text-neutral-600">
              ☕ Check-in Ngopi Terbaru ({coffeeCheckins.length})
            </h3>
            <div className="max-h-36 overflow-y-auto rounded-lg border-2 border-[#2b1d17] bg-white p-2 text-xs">
              {coffeeCheckins.length === 0 ? (
                <p className="py-3 text-center text-neutral-400">
                  Belum ada check-in ngopi via QR hari ini.
                </p>
              ) : (
                <ul className="divide-y divide-[#EFE6D3]">
                  {coffeeCheckins.slice(0, 20).map((c) => (
                    <li key={c.id} className="flex items-center justify-between gap-2 py-1">
                      <div>
                        <span className="font-bold text-[#241917]">{c.displayName}</span>{" "}
                        <span className="text-[11px] text-neutral-500">@{c.handle}</span>
                      </div>
                      <span className="font-mono text-[11px] text-neutral-600">
                        {c.dateWib} · +{c.xpAwarded} XP · +1 ☕
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}
