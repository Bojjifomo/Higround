/**
 * Storage primitives the services need. Two implementations: the in-memory demo store (below, used
 * while Supabase is not configured) and, later, a Supabase store with the same shape. All business
 * rules live in service.ts, never here.
 */
import type { Activity, LedgerEntry } from "../xp/types";
import type { Checkin, ClubEvent } from "../events";
import type { Side, Stars } from "../yoga";

export type Role = "member" | "instructor" | "admin";

export interface Avatar {
  skin: string; hair: string; top: string; bottom: string; shoes: string;
}

export interface Member {
  id: string;
  handle: string;
  displayName: string;
  avatar: Avatar;
  isPublic: boolean;
  role: Role;
  pinnedBadges: string[];
  waVerifiedAt: string | null;
  yogaConsentVersion: number | null;
  joinedAt: string;
}

export type ReviewStatus = "none" | "pending" | "approved" | "rejected";

export interface StoredActivity extends Activity {
  isHigroundStart: boolean;
  counted: boolean;
  flagged: boolean;
  flagReasons: string[];
  reviewStatus: ReviewStatus;
  name: string | null;
}

export interface StoredLedgerEntry extends LedgerEntry {
  createdAt: string;
}

/** A member's Intervals.icu connection. The token lives in Supabase Vault in production. */
export interface Integration {
  userId: string;
  athleteId: string;
  scopes: string;
  token: string;
  connectedAt: number;
  lastSyncedAt: number | null;
  syncError: string | null;
}

export interface YogaTimer {
  id: string;
  userId: string;
  missionKey: string;
  side: Side;
  formCuesAck: boolean;
  startedAt: number;          // server ms
  claimedAt: number | null;
}

export interface YogaAttempt {
  id: string;
  userId: string;
  timerId: string | null;
  missionKey: string;
  side: Side;
  measuredS: number;
  stars: Stars;
  mode: "timer" | "class";
  status: "approved" | "rejected";
  reviewerId: string | null;
  reason: string | null;
  createdAt: number;
}

export interface Store {
  addMember(m: Member): Promise<void>;
  /** Delete the member and everything of theirs (account deletion, SPEC §11). */
  deleteMember(id: string): Promise<void>;
  members(): Promise<Member[]>;
  member(id: string): Promise<Member | null>;
  memberByHandle(handle: string): Promise<Member | null>;
  updateMember(id: string, patch: Partial<Member>): Promise<void>;

  /** Insert or refresh runs from the provider. An admin's review decision is never overwritten. */
  upsertActivities(list: StoredActivity[]): Promise<void>;
  activities(userId: string): Promise<StoredActivity[]>;
  activity(userId: string, id: string): Promise<StoredActivity | null>;
  pendingActivities(): Promise<StoredActivity[]>;
  updateActivity(userId: string, id: string, patch: Partial<StoredActivity>): Promise<void>;

  ledger(userId: string): Promise<StoredLedgerEntry[]>;
  /** Inserts entries whose idempotency key is new; returns how many were written. */
  addLedger(entries: LedgerEntry[], at: number): Promise<number>;

  addTimer(t: YogaTimer): Promise<void>;
  timer(id: string): Promise<YogaTimer | null>;
  updateTimer(id: string, patch: Partial<YogaTimer>): Promise<void>;

  attempts(userId: string): Promise<YogaAttempt[]>;
  recentAttempts(limit: number): Promise<YogaAttempt[]>;
  attempt(id: string): Promise<YogaAttempt | null>;
  addAttempt(a: YogaAttempt): Promise<void>;
  updateAttempt(id: string, patch: Partial<YogaAttempt>): Promise<void>;

  saveIntegration(i: { userId: string; athleteId: string; scopes: string; token: string; at: number }): Promise<void>;
  integration(userId: string): Promise<Integration | null>;
  integrationByAthlete(athleteId: string): Promise<Integration | null>;
  integrations(): Promise<Integration[]>;
  markSynced(userId: string, at: number, error: string | null): Promise<void>;
  /** Disconnect: forget the token, the runs and the XP they earned (SPEC §3, §11). */
  removeRunData(userId: string): Promise<void>;

  events(): Promise<ClubEvent[]>;
  event(id: string): Promise<ClubEvent | null>;
  addEvent(e: ClubEvent): Promise<void>;
  checkins(eventId: string): Promise<Checkin[]>;
  checkinsOf(userId: string): Promise<Checkin[]>;
  /** False when this member already checked in to this event. */
  addCheckin(c: Checkin): Promise<boolean>;
}

/** In-memory store. Lives as long as the server process; the demo seeds it on first use. */
export class MemoryStore implements Store {
  private m = new Map<string, Member>();
  private acts = new Map<string, StoredActivity>();
  private led: StoredLedgerEntry[] = [];
  private keys = new Set<string>();
  private timers = new Map<string, YogaTimer>();
  private atts = new Map<string, YogaAttempt>();
  private evs = new Map<string, ClubEvent>();
  private ints = new Map<string, Integration>();
  private cks: Checkin[] = [];

  async addMember(x: Member) { this.m.set(x.id, x); }
  async deleteMember(id: string) {
    await this.removeRunData(id);
    this.m.delete(id);
    this.led = this.led.filter((e) => e.userId !== id);
    this.keys = new Set(this.led.map((e) => e.idempotencyKey));
    for (const [k, a] of this.atts) if (a.userId === id) this.atts.delete(k);
    for (const [k, t] of this.timers) if (t.userId === id) this.timers.delete(k);
    this.cks = this.cks.filter((c) => c.userId !== id);
  }
  async upsertActivities(list: StoredActivity[]) {
    for (const x of list) {
      const k = `${x.userId}:${x.id}`;
      const old = this.acts.get(k);
      const keep = old && (old.reviewStatus === "approved" || old.reviewStatus === "rejected");
      this.acts.set(k, keep ? { ...x, reviewStatus: old.reviewStatus } : x);
    }
  }

  async members() { return [...this.m.values()]; }
  async member(id: string) { return this.m.get(id) ?? null; }
  async memberByHandle(h: string) { return [...this.m.values()].find((x) => x.handle === h) ?? null; }
  async updateMember(id: string, patch: Partial<Member>) {
    const cur = this.m.get(id);
    if (cur) this.m.set(id, { ...cur, ...patch });
  }

  async activities(userId: string) { return [...this.acts.values()].filter((a) => a.userId === userId); }
  async activity(userId: string, id: string) { return this.acts.get(`${userId}:${id}`) ?? null; }
  async pendingActivities() { return [...this.acts.values()].filter((a) => a.reviewStatus === "pending"); }
  async updateActivity(userId: string, id: string, patch: Partial<StoredActivity>) {
    const k = `${userId}:${id}`;
    const cur = this.acts.get(k);
    if (cur) this.acts.set(k, { ...cur, ...patch });
  }


  async ledger(userId: string) { return this.led.filter((e) => e.userId === userId); }
  async addLedger(entries: LedgerEntry[], at: number) {
    let n = 0;
    for (const e of entries) {
      if (this.keys.has(e.idempotencyKey)) continue;
      this.keys.add(e.idempotencyKey);
      this.led.push({ ...e, createdAt: new Date(at).toISOString() });
      n++;
    }
    return n;
  }

  async addTimer(t: YogaTimer) { this.timers.set(t.id, t); }
  async timer(id: string) { return this.timers.get(id) ?? null; }
  async updateTimer(id: string, patch: Partial<YogaTimer>) {
    const cur = this.timers.get(id);
    if (cur) this.timers.set(id, { ...cur, ...patch });
  }

  async attempts(userId: string) { return [...this.atts.values()].filter((a) => a.userId === userId); }
  async recentAttempts(limit: number) {
    return [...this.atts.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit);
  }
  async attempt(id: string) { return this.atts.get(id) ?? null; }
  async addAttempt(a: YogaAttempt) { this.atts.set(a.id, a); }
  async updateAttempt(id: string, patch: Partial<YogaAttempt>) {
    const cur = this.atts.get(id);
    if (cur) this.atts.set(id, { ...cur, ...patch });
  }

  async saveIntegration(i: { userId: string; athleteId: string; scopes: string; token: string; at: number }) {
    this.ints.set(i.userId, { userId: i.userId, athleteId: i.athleteId, scopes: i.scopes, token: i.token, connectedAt: i.at,
                              lastSyncedAt: null, syncError: null });
  }
  async integration(userId: string) { return this.ints.get(userId) ?? null; }
  async integrationByAthlete(athleteId: string) { return [...this.ints.values()].find((i) => i.athleteId === athleteId) ?? null; }
  async integrations() { return [...this.ints.values()]; }
  async markSynced(userId: string, at: number, error: string | null) {
    const cur = this.ints.get(userId);
    if (cur) this.ints.set(userId, { ...cur, lastSyncedAt: error ? cur.lastSyncedAt : at, syncError: error });
  }
  async removeRunData(userId: string) {
    this.ints.delete(userId);
    for (const k of [...this.acts.keys()]) if (k.startsWith(`${userId}:`)) this.acts.delete(k);
    this.led = this.led.filter((e) => !(e.userId === userId && ["activity", "week", "event"].includes(e.sourceType)));
    this.keys = new Set(this.led.map((e) => e.idempotencyKey));
  }

  async events() { return [...this.evs.values()].sort((a, b) => a.startsAt - b.startsAt); }
  async event(id: string) { return this.evs.get(id) ?? null; }
  async addEvent(e: ClubEvent) { this.evs.set(e.id, e); }
  async checkins(eventId: string) { return this.cks.filter((c) => c.eventId === eventId); }
  async checkinsOf(userId: string) { return this.cks.filter((c) => c.userId === userId); }
  async addCheckin(c: Checkin) {
    if (this.cks.some((x) => x.eventId === c.eventId && x.userId === c.userId)) return false;
    this.cks.push(c);
    return true;
  }
}
