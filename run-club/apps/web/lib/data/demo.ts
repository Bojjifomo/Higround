/**
 * Demo club used while Supabase is not configured: made-up members, their runs from the mock Intervals.icu
 * provider, a few Yoga Quest claims, and all XP synced through the real rules. Nothing here is real data.
 */
import { fromTemplate } from "../events";
import { createMockProvider, mockRawActivities } from "../providers/intervals.mock";
import { defaultConfig as yoga, type Side, type Stars } from "../yoga";
import { MemoryStore, type Avatar, type Member, type Role } from "./store";
import { syncAll, toStored } from "./service";

const PEOPLE: [string, string, Role, boolean][] = [
  ["owner", "Demo Owner", "admin", true],
  ["sari", "Sari (Instruktur)", "instructor", true],
  ["rina", "Rina Lestari", "member", true],
  ["bima", "Bima Arya", "member", true],
  ["dimas", "Dimas Pratama", "member", true],
  ["eka", "Eka Saputri", "member", true],
  ["fajar", "Fajar Nugroho", "member", true],
  ["gita", "Gita Maharani", "member", false],
];

const SKIN = ["#F1C9A5", "#D9A27A", "#B67A55", "#8D5A3B"];
const HAIR = ["#1d1d1d", "#4a2f1e", "#7a4a2a", "#c9a15a"];
const TOP = ["#FF5F0E", "#2E3A8C", "#F7D046", "#E0352B", "#4B4FB8", "#2f7d4b"];
const BOTTOM = ["#222222", "#3b3f58", "#6b5b4b"];
const SHOES = ["#ffffff", "#FF5F0E", "#111111"];

function avatarFor(i: number): Avatar {
  return { skin: SKIN[i % SKIN.length], hair: HAIR[(i * 3) % HAIR.length], top: TOP[i % TOP.length],
           bottom: BOTTOM[i % BOTTOM.length], shoes: SHOES[(i + 1) % SHOES.length] };
}

/** Yoga claims for some members: everyone who did yoga cleared Tahap 1; a couple went further. */
const YOGA: Record<string, { levels: number[]; stars: Stars }[]> = {
  sari: [{ levels: [1, 2, 3], stars: 3 }, { levels: [4], stars: 2 }],
  rina: [{ levels: [1], stars: 3 }, { levels: [2], stars: 2 }],
  eka: [{ levels: [1], stars: 2 }],
  owner: [{ levels: [1], stars: 2 }],
};

/** Midnight WIB of the day `ms` falls on, plus `hours`. */
const wibDay = (ms: number, hours: number) => {
  const d = new Date(ms + 7 * 3_600_000);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - 7 * 3_600_000 + hours * 3_600_000;
};

/** Demo events around `now`: last and next Sunday Long Run, this month's virtual challenge, a Run + Brew
 *  open right now (so the QR check-in can be tried) and next Saturday's yoga class. */
export async function seedEvents(store: MemoryStore, now: number): Promise<void> {
  const DAYS = 86_400_000;
  const dow = new Date(now + 7 * 3_600_000).getUTCDay();          // 0 = Sunday (WIB)
  const lastSun = wibDay(now - (dow === 0 ? 7 : dow) * DAYS, 5);
  const month = new Date(now + 7 * 3_600_000);
  await store.addEvent(fromTemplate("slr-last", "sunday_long_run", lastSun));
  await store.addEvent(fromTemplate("slr-next", "sunday_long_run", lastSun + 7 * DAYS));
  await store.addEvent(fromTemplate("virtual-month", "monthly_virtual",
    Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1) - 7 * 3_600_000, { name: "Monthly Virtual Challenge" }));
  await store.addEvent(fromTemplate("brew-now", "run_brew", now - 3_600_000));
  await store.addEvent(fromTemplate("yoga-sat", "yoga_saturday", wibDay(now + (((6 - dow + 7) % 7) || 7) * DAYS, 7)));
}

export async function seedDemo(store: MemoryStore, now: number): Promise<void> {
  const provider = createMockProvider({ now: () => now });
  await seedEvents(store, now);
  for (const [i, [handle, name, role, isPublic]] of PEOPLE.entries()) {
    const id = `demo-${handle}`;
    const m: Member = { id, handle, displayName: name, avatar: avatarFor(i), isPublic, role, pinnedBadges: [],
                        waVerifiedAt: null, yogaConsentVersion: YOGA[handle] ? yoga.requires.consent_version : null,
                        joinedAt: new Date(now - 90 * 86_400_000).toISOString() };
    store.putMember(m);
    if (handle !== "sari") {
      const names = new Map(mockRawActivities(id, now).map((r) => [String(r.id), (r.name as string) ?? null]));
      for (const a of await provider.listActivities("demo", id, "2000-01-01")) store.putActivity(toStored(a, names.get(a.id) ?? null));
    }
    let t = now - 30 * 86_400_000;
    for (const plan of YOGA[handle] ?? []) {
      for (const tahap of yoga.levels.filter((l) => plan.levels.includes(l.level))) {
        for (const mission of tahap.missions) {
          const sides: Side[] = mission.per_side ? ["left", "right"] : ["both"];
          for (const side of sides) {
            t += 3_600_000;
            await store.addAttempt({ id: `${id}-${mission.key}-${side}`, userId: id, timerId: null, missionKey: mission.key, side,
                                     measuredS: mission.stars_s[plan.stars - 1], stars: plan.stars, mode: "class",
                                     status: "approved", reviewerId: "demo-sari", reason: null, createdAt: t });
          }
        }
      }
    }
    await syncAll(store, id, now);
  }
}
