import { describe, expect, it } from "vitest";
import { generateUniqueHandle, HANDLE_PATTERN, handleBaseFromNickname, validateNickname } from "./nickname";

describe("validateNickname", () => {
  it("accepts letters (including Caps Lock), numbers, and spaces", () => {
    expect(validateNickname("Andreas K")).toEqual({ ok: true, nickname: "Andreas K" });
    expect(validateNickname("  BUDI   SANTOSO 99  ")).toEqual({ ok: true, nickname: "BUDI SANTOSO 99" });
    expect(validateNickname("Rina2026")).toEqual({ ok: true, nickname: "Rina2026" });
  });

  it("rejects symbols and emoji", () => {
    expect(validateNickname("rina_run").ok).toBe(false);
    expect(validateNickname("budi-run").ok).toBe(false);
    expect(validateNickname("andreas@hg").ok).toBe(false);
    expect(validateNickname("Rina 🔥").ok).toBe(false);
    expect(validateNickname("Runner!").ok).toBe(false);
    expect(validateNickname("Budi.K").ok).toBe(false);
  });

  it("enforces min and max length", () => {
    expect(validateNickname("   ").ok).toBe(false);
    expect(validateNickname("A").ok).toBe(false);
    expect(validateNickname("A".repeat(33)).ok).toBe(false);
    expect(validateNickname("Al")).toEqual({ ok: true, nickname: "Al" });
  });
});

describe("handleBaseFromNickname & generateUniqueHandle", () => {
  it("always produces valid Postgres handles", () => {
    for (const sample of ["Al", "BUDI SANTOSO", "A Very Long Runner Display Name 123", "99"]) {
      const h = handleBaseFromNickname(sample);
      expect(HANDLE_PATTERN.test(h)).toBe(true);
    }
  });

  it("appends numeric suffixes when a handle is already taken", async () => {
    const taken = new Set(["budi_santoso", "budi_santoso_2"]);
    const h = await generateUniqueHandle("BUDI SANTOSO", (c) => taken.has(c));
    expect(h).toBe("budi_santoso_3");
    expect(HANDLE_PATTERN.test(h)).toBe(true);
  });
});
