"use client";
import { useEffect, useState } from "react";
import { initTelemetry, reportClientError, trackEvent } from "@/lib/telemetry/client";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "hg_pwa_banner_dismissed_v1";

export function PwaAndTelemetry() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    // 1. Initialize optional PostHog analytics & global JS error capture
    initTelemetry();
    const onError = (e: ErrorEvent) => {
      if (e.message && !e.message.includes("ResizeObserver")) {
        reportClientError(e.message);
      }
    };
    const onRejection = (e: PromiseRejectionEvent) => {
      const msg = e.reason instanceof Error ? e.reason.message : String(e.reason ?? "");
      if (msg && !msg.includes("AbortError")) reportClientError(`UnhandledRejection: ${msg}`);
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);

    // 2. Register PWA Service Worker
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => null);
    }

    // 3. Detect if already running as installed standalone PWA
    const isStandalone =
      window.matchMedia?.("(display-mode: standalone)").matches ||
      Boolean((navigator as unknown as { standalone?: boolean }).standalone);
    const wasDismissed = window.localStorage.getItem(DISMISS_KEY) === "1";

    if (!isStandalone && !wasDismissed) {
      const ua = navigator.userAgent;
      const isIos = /iPhone|iPad|iPod/i.test(ua) && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua);
      if (isIos) {
        setIosHint(true);
        setDismissed(false);
      }
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      if (!isStandalone && !wasDismissed) {
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setDismissed(false);
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
    };
  }, []);

  const dismiss = () => {
    setDismissed(true);
    try {
      window.localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
  };

  const installAndroid = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    trackEvent("pwa_install_prompt", { outcome: choice.outcome });
    setDeferredPrompt(null);
    dismiss();
  };

  if (dismissed || (!deferredPrompt && !iosHint)) return null;

  return (
    <div className="border-b-2 border-[#2b1d17] bg-[#241917] px-3 py-1.5 text-[11px] text-[#FFF8EA]">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          {deferredPrompt ? (
            <span>
              📲 <b>Pasang App Higround</b> di Home Screen biar akses lebih cepat &amp; fullscreen!
            </span>
          ) : (
            <span>
              📲 <b>Pasang di iPhone:</b> tap ikon <b>Share ↗</b> lalu pilih <b>Add to Home Screen</b> biar kayak app beneran!
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          {deferredPrompt && (
            <button
              type="button"
              onClick={() => void installAndroid()}
              className="rounded bg-hg-orange px-2 py-0.5 text-[10px] font-bold text-white"
            >
              Install
            </button>
          )}
          <button
            type="button"
            onClick={dismiss}
            aria-label="Tutup banner install"
            className="rounded border border-neutral-600 px-1.5 py-0.5 text-[10px] text-neutral-300"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}
