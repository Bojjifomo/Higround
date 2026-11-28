import { describe, expect, it } from "vitest";
import { coffeeDailyToken, coffeeStaticToken, verifyCoffeeToken, wibDateString } from "./index";

describe("Daily Coffee Check-in QR tokens", () => {
  const secret = "test-higround-secret";

  it("formats timestamps accurately into WIB (UTC+7) calendar dates", () => {
    // 2026-11-27T18:00:00Z is 2026-11-28 01:00 WIB
    expect(wibDateString(Date.parse("2026-11-27T18:00:00Z"))).toBe("2026-11-28");
    // 2026-11-27T16:55:00Z is 2026-11-27 23:55 WIB
    expect(wibDateString(Date.parse("2026-11-27T16:55:00Z"))).toBe("2026-11-27");
  });

  it("verifies daily rotating QR token for today and rejects yesterday or tampered tokens", () => {
    const now = Date.parse("2026-11-28T05:00:00Z"); // 12:00 WIB
    const today = wibDateString(now);
    const tok = coffeeDailyToken(secret, today);

    expect(verifyCoffeeToken(secret, tok, now)).toEqual({ ok: true, mode: "daily", dateWib: today });
    expect(verifyCoffeeToken(secret, "tampered-token", now)).toEqual({ ok: false });
    expect(verifyCoffeeToken(secret, coffeeDailyToken(secret, "2026-11-26"), now)).toEqual({ ok: false });
  });

  it("allows 10-minute midnight WIB grace period for daily QR and supports permanent table QR", () => {
    // 2026-11-28 00:05 WIB = 2026-11-27T17:05:00Z
    const justAfterMidnight = Date.parse("2026-11-27T17:05:00Z");
    const prevDayTok = coffeeDailyToken(secret, "2026-11-27");
    expect(verifyCoffeeToken(secret, prevDayTok, justAfterMidnight)).toEqual({
      ok: true,
      mode: "daily",
      dateWib: "2026-11-28",
    });

    const staticTok = coffeeStaticToken(secret);
    expect(verifyCoffeeToken(secret, staticTok, justAfterMidnight)).toEqual({
      ok: true,
      mode: "static",
      dateWib: "2026-11-28",
    });
  });
});
