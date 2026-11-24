import { createIntervalsProvider } from "./intervals";
import { createMockProvider } from "./intervals.mock";
import type { ActivityProvider } from "./types";

export * from "./types";
export { normalizeIntervals } from "./intervals";

/**
 * The real Intervals.icu provider when INTERVALS_CLIENT_ID and INTERVALS_REDIRECT_URI are set, else the mock
 * (SPEC §3: everything must run in mock mode until the owner's OAuth credentials exist).
 * INTERVALS_CLIENT_SECRET may stay empty: the app is then a public client and logs in with PKCE alone.
 */
export function getProvider(env: Record<string, string | undefined> = process.env): ActivityProvider {
  const clientId = env.INTERVALS_CLIENT_ID?.trim();
  const redirectUri = env.INTERVALS_REDIRECT_URI?.trim();
  if (!clientId || !redirectUri) return createMockProvider({ baseUrl: env.NEXT_PUBLIC_SITE_URL });
  return createIntervalsProvider({
    clientId,
    redirectUri,
    clientSecret: env.INTERVALS_CLIENT_SECRET?.trim() || undefined,
    webhookSecret: env.INTERVALS_WEBHOOK_SECRET?.trim() || undefined,
  });
}
