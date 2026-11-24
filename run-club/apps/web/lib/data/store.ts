/**
 * Storage primitives the services need. Two implementations: the in-memory demo store (below, used
 * while Supabase is not configured) and, later, a Supabase store with the same shape. All business
 * rules live in service.ts, never here.
 */
import type { Activity, LedgerEntry } from "../xp/types";
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
  members(): Promise<Member[]>;
  member(id: string): Promise<Member | null>;
  memberByHandle(handle: string): Promise<Member | null>;
  updateMember(id: string, patch: Partial<Member>): Promise<void>;

  activities(userId: string): Promise<StoredActivity[]>;
  activity(id: string): Promise<StoredActivity | null>;
  pendingActivities(): Promise<StoredActivity[]>;
  updateActivity(id: string, patch: Partial<StoredActivity>): Promise<void>;

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
}

/** In-memory store. Lives as long as the server process; the demo seeds it on first use. */
export class MemoryStore implements Store {
  private m = new Map<string, Member>();
  private acts = new Map<string, StoredActivity>();
  private led: StoredLedgerEntry[] = [];
  private keys = new Set<string>();
  private timers = new Map<string, YogaTimer>();
  private atts = new Map<string, YogaAttempt>();

  putMember(x: Member) { this.m.set(x.id, x); }
  putActivity(x: StoredActivity) { this.acts.set(`${x.userId}:${x.id}`, x); }

  async members() { return [...this.m.values()]; }
  async member(id: string) { return this.m.get(id) ?? null; }
  async memberByHandle(h: string) { return [...this.m.values()].find((x) => x.handle === h) ?? null; }
  async updateMember(id: string, patch: Partial<Member>) {
    const cur = this.m.get(id);
    if (cur) this.m.set(id, { ...cur, ...patch });
  }

  async activities(userId: string) { return [...this.acts.values()].filter((a) => a.userId === userId); }
  async activity(id: string) { return [...this.acts.values()].find((a) => a.id === id) ?? null; }
  async pendingActivities() { return [...this.acts.values()].filter((a) => a.reviewStatus === "pending"); }
  async updateActivity(id: string, patch: Partial<StoredActivity>) {
    for (const [k, a] of this.acts) if (a.id === id) this.acts.set(k, { ...a, ...patch });
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
}
