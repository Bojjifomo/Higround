import { createHmac, timingSafeEqual } from "node:crypto";

export const COFFEE_CHECKIN_XP = 25;

/** Format timestamp into YYYY-MM-DD in Asia/Jakarta (WIB, UTC+7). */
export function wibDateString(nowMs: number = Date.now()): string {
  const d = new Date(nowMs + 7 * 3_600_000);
  return d.toISOString().slice(0, 10);
}

/** Daily rotating HMAC token (valid for the given WIB date). */
export function coffeeDailyToken(secret: string, dateWib: string): string {
  return createHmac("sha256", secret).update(`hg-coffee-daily:${dateWib}`).digest("base64url").slice(0, 16);
}

/** Permanent table/counter sticker HMAC token (still strictly enforced 1×/day per member on server). */
export function coffeeStaticToken(secret: string): string {
  return createHmac("sha256", secret).update("hg-coffee-static:v1").digest("base64url").slice(0, 16);
}

function safeEq(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/** Verify either today's WIB rotating QR token or the signed permanent table QR token. */
export function verifyCoffeeToken(
  secret: string,
  token: string,
  nowMs: number = Date.now(),
): { ok: true; mode: "daily" | "static"; dateWib: string } | { ok: false } {
  const clean = token.trim();
  if (!clean) return { ok: false };
  const today = wibDateString(nowMs);
  if (safeEq(clean, coffeeDailyToken(secret, today))) {
    return { ok: true, mode: "daily", dateWib: today };
  }
  // 10-minute grace around midnight WIB so a customer scanning at 23:59 still succeeds
  const tenMinAgo = wibDateString(nowMs - 10 * 60_000);
  if (tenMinAgo !== today && safeEq(clean, coffeeDailyToken(secret, tenMinAgo))) {
    return { ok: true, mode: "daily", dateWib: today };
  }
  if (safeEq(clean, coffeeStaticToken(secret))) {
    return { ok: true, mode: "static", dateWib: today };
  }
  return { ok: false };
}
