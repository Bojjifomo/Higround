import type { Activity } from "../xp/types";

/** What the app needs from an activity provider. Intervals.icu is the only one (SPEC §3). */
export interface ActivityProvider {
  readonly name: "intervals" | "intervals-mock";
  /** URL to send the member to for consent. `state` guards against CSRF; PKCE when a challenge is given. */
  authorizeUrl(state: string, codeChallenge?: string): string;
  /** Code from the redirect → access token and the athlete it belongs to. */
  exchangeCode(code: string, codeVerifier?: string): Promise<TokenResult>;
  /** Activities between two local dates (inclusive), already normalized. Strava stubs are dropped. */
  listActivities(token: string, userId: string, oldest: string, newest?: string): Promise<Activity[]>;
  /** Revoke our access (called on disconnect / account deletion). */
  disconnect(token: string): Promise<void>;
  /** Check a webhook delivery and pull out what changed. */
  parseWebhook(body: unknown): WebhookEvent[];
}

export interface TokenResult {
  accessToken: string;
  scope: string;
  athleteId: string;
  athleteName: string | null;
}

export interface WebhookEvent {
  athleteId: string;
  type: string;               // e.g. ACTIVITY_UPLOADED, ACTIVITY_UPDATED, ACTIVITY_DELETED, APP_SCOPE_CHANGED
  activityId: string | null;
  timestamp: string | null;
}

export class ProviderAuthError extends Error {}
export class ProviderError extends Error {
  constructor(message: string, readonly status?: number) { super(message); }
}
