import { beforeEach, describe, expect, it } from "vitest";
import { checkProfanity } from "./profanity";
import { listChatMessages, postChatMessage, resetChatStoreForTests } from "./store";

describe("Indonesian profanity filter", () => {
  it("allows friendly Indonesian running & coffee chat without false positives", () => {
    const cleanMessages = [
      "Gas Sunday Long Run besok jam 05.30 di Higround!",
      "Terima kasih kontribusi KM minggu ini mantap banget!",
      "Santai dulu habis lari 10k, ngopi coklat panas asik nih",
      "Analisis pace minggu ini makin kencang ya",
      "Cukup 5 km dulu hari ini buat recovery",
    ];
    for (const msg of cleanMessages) {
      expect(checkProfanity(msg).ok, `Should allow: ${msg}`).toBe(true);
    }
  });

  it("blocks Indonesian swear words, leetspeak, stretched letters, and spaced bypasses", () => {
    const badMessages = [
      "dasar anjing lo",
      "g0bl0k banget sih",
      "anjjjjiiiiing",
      "b.a.n.g.s.a.t",
      "a n j i n g",
      "t0l0l banget",
      "f*u*c*k off",
    ];
    for (const msg of badMessages) {
      expect(checkProfanity(msg).ok, `Should block: ${msg}`).toBe(false);
    }
  });
});

describe("World Chat store", () => {
  beforeEach(() => resetChatStoreForTests());

  it("posts clean messages, enforces rate limit, and rejects profanity", () => {
    const sender = { userId: "u1", handle: "andreas", displayName: "Andreas", level: 5 };
    const r1 = postChatMessage(sender, "Halo semua, ngopi yuk!", 10_000);
    expect(r1.ok).toBe(true);
    expect(listChatMessages()).toHaveLength(1);

    // Rate limit within 2s
    const r2 = postChatMessage(sender, "Spam cepat", 10_500);
    expect(r2.ok).toBe(false);

    // Profanity blocked after cooldown
    const r3 = postChatMessage(sender, "dasar g0bl0k", 13_000);
    expect(r3.ok).toBe(false);
    expect(listChatMessages()).toHaveLength(1);

    // Next clean message succeeds
    const r4 = postChatMessage(sender, "Gas lari pagi!", 13_500);
    expect(r4.ok).toBe(true);
    expect(listChatMessages(10_000)).toHaveLength(1);
  });
});
