import { beforeEach, describe, expect, it } from "vitest";
import { seedDemo } from "./demo";
import {
  acceptYogaConsent, claimTimer, classAward, Forbidden, levelOf, profileView, questView, rejectAttempt, reviewActivity,
  setWaVerified, startTimer, syncAll,
} from "./service";
import { MemoryStore, type Member } from "./store";

const NOW = Date.parse("2026-11-24T09:00:00+07:00");
const flags = { waGateEnabled: false };
let s: MemoryStore;
let owner: Member, sari: Member, rina: Member, bima: Member, gita: Member;
const xp = async (m: Member) => (await levelOf(s, m.id)).totalXp;

beforeEach(async () => {
  s = new MemoryStore();
  await seedDemo(s, NOW);
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
    await expect(reviewActivity(s, rina, pending.id, "approved", NOW)).rejects.toBeInstanceOf(Forbidden);
    const before = await xp(bima);
    await reviewActivity(s, owner, pending.id, "approved", NOW);
    expect(await xp(bima)).toBeGreaterThan(before);
  });
  it("a rejected run pays nothing", async () => {
    const [pending] = (await s.pendingActivities()).filter((a) => a.userId === bima.id);
    const before = await xp(bima);
    await reviewActivity(s, owner, pending.id, "rejected", NOW);
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
  it("shows active public members, always you, the HUD and a ticker", async () => {
    const { worldView } = await import("./service");
    const w = await worldView(s, gita, NOW);
    expect(w.members.length).toBeLessThanOrEqual(25);
    expect(w.members[0]).toMatchObject({ handle: "gita", isMe: true });             // private, but it's you
    const other = await worldView(s, bima, NOW);
    expect(other.members.some((m) => m.handle === "gita")).toBe(false);           // private to others
    expect(other.members.some((m) => m.ranToday)).toBe(true);                      // this morning's runs
    expect(other.hud.communityKmWeek).toBeGreaterThan(0);
    expect(other.hud.week).toBe(48);
    expect(other.ticker.length).toBeGreaterThan(0);
    expect(other.ticker.join(" ")).not.toMatch(/Gita/);
  });
});
