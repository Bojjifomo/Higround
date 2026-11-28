"use client";
/**
 * Lightweight client telemetry for Higround:
 *  - Optional PostHog analytics & session replay (activated automatically when NEXT_PUBLIC_POSTHOG_KEY is set)
 *  - Zero-dependency client error reporting to /api/telemetry/error (visible in /admin Mission Control)
 */

interface PostHogLike {
  init: (key: string, opts: Record<string, unknown>) => void;
  capture: (event: string, props?: Record<string, unknown>) => void;
}

declare global {
  interface Window {
    posthog?: PostHogLike;
  }
}

let posthogLoaded = false;

export function initTelemetry(): void {
  if (typeof window === "undefined") return;

  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim() || "https://us.i.posthog.com";
  if (key && !posthogLoaded) {
    posthogLoaded = true;
    const script = document.createElement("script");
    script.async = true;
    script.src = `${host.replace(/\/$/, "")}/static/array.js`;
    script.onload = () => {
      try {
        window.posthog?.init(key, {
          api_host: host,
          person_profiles: "identified_only",
          capture_pageview: true,
          capture_pageleave: true,
        });
      } catch {
        // non-fatal
      }
    };
    document.head.appendChild(script);
  }
}

export function trackEvent(event: string, props?: Record<string, unknown>): void {
  if (typeof window === "undefined") return;
  try {
    window.posthog?.capture(event, props);
  } catch {
    // non-fatal
  }
}

let lastErrorSentAt = 0;

export function reportClientError(message: string, path?: string): void {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastErrorSentAt < 5000) return; // throttle noisy bursts
  lastErrorSentAt = now;
  const clean = message.trim().slice(0, 260);
  if (!clean) return;
  try {
    void fetch("/api/telemetry/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: clean,
        path: path ?? window.location.pathname,
        ua: navigator.userAgent.slice(0, 120),
      }),
      keepalive: true,
    }).catch(() => null);
  } catch {
    // non-fatal
  }
}
