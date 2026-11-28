import { describe, expect, it, vi } from "vitest";
import { generateGiveawayCode, sendGiveawayWinnerEmail } from "../email/resend";
import { buildMembersCsv, matchLunaPosCsv, parseCsv } from "./crm";

describe("LunaPOS CSV parser & member matcher", () => {
  it("parses both comma and Indonesian semicolon CSVs with quoted values", () => {
    const semi = "\uFEFFNama;Email;Poin;Tier\n\"Rina, S.Kom\";rina@hg.test;250;Gold\n";
    const parsed = parseCsv(semi);
    expect(parsed.headers).toEqual(["Nama", "Email", "Poin", "Tier"]);
    expect(parsed.rows).toEqual([{ Nama: "Rina, S.Kom", Email: "rina@hg.test", Poin: "250", Tier: "Gold" }]);
  });

  it("matches LunaPOS rows by email or display name and tracks unmatched rows", () => {
    const csv = [
      "Customer Name,Email,Phone,Loyalty Tier,Points,Total Spend",
      "Rina Lestari,rina@hg.test,08123,Gold,320,1800000",
      "Bima Pratama,,08199,Silver,90,450000",
      "Walk-in Guest,guest@other.com,08111,Bronze,10,50000",
    ].join("\n");
    const members = [
      { id: "u1", handle: "rina", displayName: "Rina Lestari", email: "rina@hg.test" },
      { id: "u2", handle: "bima", displayName: "Bima Pratama", email: "bima@hg.test" },
    ];
    const res = matchLunaPosCsv(csv, members, "2026-11-28T05:00:00Z");
    expect(res.totalRows).toBe(3);
    expect(res.matchedCount).toBe(2);
    expect(res.unmatchedCount).toBe(1);
    expect(res.matchedRecords[0]).toMatchObject({ userId: "u1", lunaTier: "Gold", lunaPoints: 320, totalSpendIdr: 1800000 });
    expect(res.matchedRecords[1]).toMatchObject({ userId: "u2", lunaTier: "Silver", lunaPoints: 90 });
  });

  it("builds a UTF-8 BOM Excel-ready member database CSV", () => {
    const csv = buildMembersCsv([
      {
        id: "u1", handle: "rina", displayName: "Rina Lestari", email: "rina@hg.test", role: "member",
        joinedAt: "2026-09-01T00:00:00Z", level: 7, totalXp: 1200, totalKm: 84.5, weekKm: 18.2,
        runs: 14, higroundStarts: 6, waVerified: true, giveawayWins: 1,
        luna: { userId: "u1", email: "rina@hg.test", phone: null, lunaTier: "Gold", lunaPoints: 320, totalSpendIdr: null, syncedAt: "2026-11-28" },
      },
    ]);
    expect(csv.startsWith("\uFEFFNickname,Handle,Email")).toBe(true);
    expect(csv).toContain("Rina Lestari,@rina,rina@hg.test,member,2026-09-01,7,1200,84.50,18.20,14,6,Ya,Gold,320,1");
  });
});

describe("Resend Giveaway Email", () => {
  it("reports unconfigured gracefully when RESEND_API_KEY is missing", async () => {
    const code = generateGiveawayCode("andreas", 123456);
    const res = await sendGiveawayWinnerEmail(
      { toEmail: "a@hg.test", recipientName: "Andreas", prizeName: "Free Drink Higround", voucherCode: code },
      { apiKey: "" },
    );
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.configured).toBe(false);
  });

  it("sends giveaway email cleanly via Resend REST API when configured", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ id: "re_123" }), { status: 200 }));
    const res = await sendGiveawayWinnerEmail(
      { toEmail: "a@hg.test", recipientName: "Andreas", prizeName: "Free Drink Higround", voucherCode: "HG-GIV-ANDRE-0001" },
      { apiKey: "re_test_key", fetchImpl },
    );
    expect(res).toEqual({ ok: true, id: "re_123", voucherCode: "HG-GIV-ANDRE-0001" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });
});
