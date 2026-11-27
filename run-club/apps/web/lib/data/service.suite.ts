/**
 * The service behaviour, run against every Store implementation (memory, Postgres) with the same demo club.
 * Not a test file itself: service.test.ts and sql-store.test.ts call it.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seedDemo, type IdFor } from "./demo";
import {
  acceptYogaConsent, claimTimer, classAward, Forbidden, levelOf, profileView, questView, rejectAttempt, reviewActivity,
  setWaVerified, startTimer, syncAll,
} from "./service";
import type { Member, Store } from "./store";


export function serviceSuite(label: string, make: () => Promise<{ store: Store; idFor?: IdFor; close?: () => Promise<void> }>) {
  describe(label, () => {
    const NOW = Date.parse("2026-11-24T09:00:00+07:00");
    const flags = { waGateEnabled: false };
    let s: Store;
    let close: (() => Promise<void>) | undefined;
    let owner: Member, sari: Member, rina: Member, bima: Member, gita: Member;
    const xp = async (m: Member) => (await levelOf(s, m.id)).totalXp;

    afterEach(async () => { await close?.(); });

    beforeEach(async () => {
      const made = await make();
      s = made.store;
      close = made.close;
      await seedDemo(s, NOW, made.idFor);
      [owner, sari, rina, bima, gita] = await Promise.all(["owner", "sari", "rina", "bima", "gita"].map(async (h) => (await s.memberByHandle(h))!));
    });

    describe("demo seed", () => {
      it("gives runners XP from their runs and leaves suspicious runs for review", async () => {
        expect(await xp(bima)).toBeGreaterThan(1000);
        expect((await s.pendingActivities()).length).toBeGreaterThan(0);
        expect(await xp(sari)).toBeGreaterThan(0);                       // yoga only
      });
      it("re-syncing pays nothing twice", async () => {
        const before = await xp(rina);
        await syncAll(s, rina.id, NOW);
        expect(await xp(rina)).toBe(before);
      });
    });

    describe("profile", () => {
      it("shows the run dashboard, yoga and badges", async () => {
        const p = (await profileView(s, "rina", bima, NOW))!;
        expect(p.hidden).toBe(false);
        expect(p.run!.weeks).toHaveLength(12);
        expect(p.run!.days.length).toBeGreaterThanOrEqual(78);
        expect(p.run!.higroundStarts).toBeGreaterThan(0);
        expect(p.badges.earned.has("yoga_clear_1")).toBe(true);
        expect(p.yoga!.progress.tahap[1].unlocked).toBe(true);
      });
      it("hides a private profile from other members but not from its owner or an admin", async () => {
        expect((await profileView(s, "gita", bima, NOW))!.hidden).toBe(true);
        expect((await profileView(s, "gita", bima, NOW))!.run).toBeNull();
        expect((await profileView(s, "gita", gita, NOW))!.hidden).toBe(false);
        expect((await profileView(s, "gita", owner, NOW))!.hidden).toBe(false);
        expect(await profileView(s, "nobody", bima, NOW)).toBeNull();
      });
    });

    describe("Yoga Quest claims", () => {
      it("needs the consent first, then pays stars from the server timer", async () => {
        const t1 = await startTimer(s, bima, "mountain", "both", false, NOW);
        expect(await claimTimer(s, bima, t1, NOW + 31_000, flags)).toMatchObject({ ok: false, error: "consent" });
        await acceptYogaConsent(s, bima);
        bima = (await s.member(bima.id))!;
        const before = await xp(bima);
        const t2 = await startTimer(s, bima, "mountain", "both", false, NOW + 60_000);
        const r = await claimTimer(s, bima, t2, NOW + 60_000 + 46_000, flags);
        expect(r).toMatchObject({ ok: true, stars: 3, missionStarsAfter: 3 });
        expect(await xp(bima)).toBeGreaterThanOrEqual(before + 15);
        expect(await claimTimer(s, bima, t2, NOW + 200_000, flags)).toMatchObject({ ok: false, error: "already_claimed" });
      });
      it("refuses someone else's timer and enforces the cooldown", async () => {
        await acceptYogaConsent(s, bima);
        bima = (await s.member(bima.id))!;
        const t = await startTimer(s, bima, "child", "both", false, NOW);
        expect(await claimTimer(s, rina, t, NOW + 50_000, flags)).toMatchObject({ ok: false, error: "timer" });
        await claimTimer(s, bima, t, NOW + 50_000, flags);
        const t2 = await startTimer(s, bima, "child", "both", false, NOW + 60_000);
        expect(await claimTimer(s, bima, t2, NOW + 130_000, flags)).toMatchObject({ ok: false, error: "cooldown" });
      });
      it("quest view reports cooldowns and today's claims", async () => {
        await acceptYogaConsent(s, bima);
        bima = (await s.member(bima.id))!;
        const t = await startTimer(s, bima, "child", "both", false, NOW);
        await claimTimer(s, bima, t, NOW + 50_000, flags);
        const q = await questView(s, bima, NOW + 60_000, { waGateEnabled: false, waGroupUrl: null });
        expect(q.claimsToday).toBe(1);
        expect(q.cooldowns["child:both"]).toBeGreaterThan(500);
        expect(q.consentOk).toBe(true);
      });
    });

    describe("staff", () => {
      it("admin approves a flagged run and it starts paying XP; members cannot", async () => {
        const [pending] = (await s.pendingActivities()).filter((a) => a.userId === bima.id);
        await expect(reviewActivity(s, rina, pending.userId, pending.id, "approved", NOW)).rejects.toBeInstanceOf(Forbidden);
        const before = await xp(bima);
        await reviewActivity(s, owner, pending.userId, pending.id, "approved", NOW);
        expect(await xp(bima)).toBeGreaterThan(before);
      });
      it("a rejected run pays nothing", async () => {
        const [pending] = (await s.pendingActivities()).filter((a) => a.userId === bima.id);
        const before = await xp(bima);
        await reviewActivity(s, owner, pending.userId, pending.id, "rejected", NOW);
        expect(await xp(bima)).toBe(before);
      });
      it("class mode awards stars; rejecting a claim takes the XP back", async () => {
        const before = await xp(bima);
        await classAward(s, sari, bima.id, "mountain", "both", 3, NOW);
        expect(await xp(bima)).toBe(before + 15);
        const [att] = (await s.attempts(bima.id)).filter((a) => a.missionKey === "mountain");
        await rejectAttempt(s, sari, att.id, "bentuk belum pas", NOW);
        expect(await xp(bima)).toBe(before);
        await expect(classAward(s, rina, bima.id, "mountain", "both", 3, NOW)).rejects.toBeInstanceOf(Forbidden);
        await expect(classAward(s, sari, bima.id, "crow", "both", 2, NOW)).rejects.toBeInstanceOf(Forbidden);   // tahap locked
      });
      it("only admins verify WhatsApp", async () => {
        await expect(setWaVerified(s, sari, bima.id, true, NOW)).rejects.toBeInstanceOf(Forbidden);
        await setWaVerified(s, owner, bima.id, true, NOW);
        expect((await s.member(bima.id))!.waVerifiedAt).not.toBeNull();
      });
    });

    describe("world view", () => {
      it("shows all public signed-up members (even with 0 runs), always you, the HUD and a ticker", async () => {
        const { worldView } = await import("./service");
        const w = await worldView(s, gita, NOW);
        expect(w.members.length).toBeLessThanOrEqual(25);
        expect(w.members[0]).toMatchObject({ handle: "gita", isMe: true });             // private, but it's you
        // Owner has 0 runs/yoga in demo seed, yet must still appear in the world & Aktif tab
        expect(w.members.some((m) => m.handle === "owner")).toBe(true);
        const other = await worldView(s, bima, NOW);
        expect(other.members.some((m) => m.handle === "gita")).toBe(false);           // private to others
        expect(other.members.some((m) => m.ranToday)).toBe(true);                      // this morning's runs
        expect(other.hud.communityKmWeek).toBeGreaterThan(0);
        expect(other.hud.week).toBe(48);
        expect(other.ticker.length).toBeGreaterThan(0);
        expect(other.ticker.join(" ")).not.toMatch(/Gita/);
        // Online-only filter: only online members (+ viewer) appear in /world
        const onlineOnly = await worldView(s, bima, NOW, new Set([bima.id, rina.id]));
        expect(onlineOnly.members.map((m) => m.handle).sort()).toEqual(["bima", "rina"]);
      });
    });

    describe("events", () => {
      it("checks in Sunday long runners from their runs and pays the ×2 bonus", async () => {
        const { eventsView, syncAll } = await import("./index-test-shim");
        const slr = (await s.checkins("slr-last"));
        expect(slr.length).toBeGreaterThan(0);
        expect(slr.every((c) => c.method === "activity")).toBe(true);
        const who = slr[0].userId;
        const bonus = (await s.ledger(who)).filter((e) => e.ruleKey === "event_multiplier");
        expect(bonus.length).toBe(1);
        expect(bonus[0].amount).toBeGreaterThan(50);
        const before = await xp((await s.member(who))!);
        await syncAll(s, who, NOW);
        expect(await xp((await s.member(who))!)).toBe(before);                         // idempotent
        const rows = await eventsView(s, bima, NOW);
        expect(rows[0].status).toBe("open");                                           // open events first
      });
      it("QR check-in: valid code once, expired code refused, wrong method refused", async () => {
        const { checkinQr } = await import("./index-test-shim");
        const { qrToken } = await import("../events");
        const tok = qrToken("sec", "brew-now", NOW);
        const before = await xp(bima);
        expect(await checkinQr(s, bima, "brew-now", tok, NOW, "sec")).toMatchObject({ ok: true, already: false });
        expect(await xp(bima)).toBe(before + 50);
        expect(await checkinQr(s, bima, "brew-now", tok, NOW + 30_000, "sec")).toMatchObject({ ok: true, already: true });
        expect(await xp(bima)).toBe(before + 50);
        expect(await checkinQr(s, rina, "brew-now", tok, NOW + 5 * 60_000, "sec")).toMatchObject({ ok: false });
        expect(await checkinQr(s, rina, "virtual-month", qrToken("sec", "virtual-month", NOW), NOW, "sec")).toMatchObject({ ok: false });
        expect(await checkinQr(s, rina, "slr-next", qrToken("sec", "slr-next", NOW), NOW, "sec")).toMatchObject({ ok: false, error: "Check-in belum dibuka." });
      });
      it("only admins create events", async () => {
        const { createEvent, EventError } = await import("./index-test-shim");
        await expect(createEvent(s, sari, "run_brew", NOW)).rejects.toBeInstanceOf(EventError);
        const e = await createEvent(s, owner, "run_brew", NOW);
        expect((await s.event(e.id))!.name).toBe("Run + Brew");
      });
    });


    describe("Intervals.icu connection", () => {
      it("connects, backfills 12 weeks, re-syncs idempotently, and disconnect forgets the runs", async () => {
        const { connectIntervals, syncMember, disconnectIntervals, handleWebhook } = await import("./intervals-service");
        const { createMockProvider } = await import("../providers/intervals.mock");
        const provider = createMockProvider({ now: () => NOW });
        // a brand-new member with no runs yet
        const id = (await s.members()).find((m) => m.handle === "sari")!.id;          // sari has no runs in the demo
        const sariM = (await s.member(id))!;
        expect((await s.activities(id)).length).toBe(0);
        expect(await syncMember(s, provider, id, NOW)).toMatchObject({ ok: false });
        await connectIntervals(s, sariM, { accessToken: "tok-1", scope: "ACTIVITY:READ", athleteId: "i-sari", athleteName: null }, NOW);
        expect((await s.integration(id))!.token).toBe("tok-1");
        const first = await syncMember(s, provider, id, NOW);
        expect(first).toMatchObject({ ok: true });
        const runs = (await s.activities(id)).length;
        expect(runs).toBeGreaterThan(20);
        const xpAfter = await xp(sariM);
        expect(xpAfter).toBeGreaterThan(1000);
        expect(await syncMember(s, provider, id, NOW + 60_000)).toMatchObject({ ok: true });
        expect(await xp(sariM)).toBe(xpAfter);                                       // nothing paid twice
        expect((await s.integration(id))!.lastSyncedAt).toBe(NOW + 60_000);
        expect(await handleWebhook(s, provider, { events: [{ athlete_id: "i-sari", type: "ACTIVITY_UPLOADED" }] }, NOW)).toBe(1);
        await expect(connectIntervals(s, rina, { accessToken: "x", scope: "", athleteId: "i-sari", athleteName: null }, NOW))
          .rejects.toThrow(/sudah tersambung/);
        await disconnectIntervals(s, provider, sariM);
        expect(await s.integration(id)).toBeNull();
        expect((await s.activities(id)).length).toBe(0);
        expect(await xp(sariM)).toBeLessThan(xpAfter);
      });
    });
  });
}
