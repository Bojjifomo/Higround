/**
 * Demo club used while Supabase is not configured: made-up members, their runs from the mock Intervals.icu
 * provider, a few Yoga Quest claims, and all XP synced through the real rules. Nothing here is real data.
 */
import { fromTemplate } from "../events";
import { createMockProvider, mockRawActivities } from "../providers/intervals.mock";
import { defaultConfig as yoga, type Side, type Stars } from "../yoga";
import type { Avatar, Role, Store } from "./store";
import { syncAll, toStored } from "./service";

export const PEOPLE: [string, string, Role, boolean][] = [
  ["owner", "Demo Owner", "admin", true],
  ["sari", "Sari (Instruktur)", "instructor", true],
  ["rina", "Rina Lestari", "member", true],
  ["bima", "Bima Arya", "member", true],
  ["dimas", "Dimas Pratama", "member", true],
  ["eka", "Eka Saputri", "member", true],
  ["fajar", "Fajar Nugroho", "member", true],
  ["gita", "Gita Maharani", "member", false],
];

const DEMO_AVATARS: Avatar[] = [
  { skin: "#F6CFA8", hair: "#1F1A18", top: "#FF5F0E", bottom: "#222228", shoes: "#FFFDF7", hairStyle: "spiky", eyeStyle: "classic", topStyle: "tee", bottomStyle: "shorts", shoeStyle: "sneakers", headwear: "cap", headwearColor: "#FF5F0E", accessory: "glasses", accessoryColor: "#1F1F24", customized: true },
  { skin: "#E3B084", hair: "#4A2F1E", top: "#4B4FB8", bottom: "#3B425E", shoes: "#FFFDF7", hairStyle: "bun", eyeStyle: "happy", topStyle: "singlet", bottomStyle: "pants", shoeStyle: "barefoot", headwear: "headband", headwearColor: "#F7D046", accessory: "none", customized: true },
  { skin: "#F6CFA8", hair: "#7B4B2A", top: "#FF5F0E", bottom: "#222228", shoes: "#FF5F0E", hairStyle: "ponytail", eyeStyle: "wide", topStyle: "longsleeve", bottomStyle: "shorts", shoeStyle: "sneakers", headwear: "cap", headwearColor: "#FFFDF7", accessory: "medal", accessoryColor: "#F7D046", customized: true },
  { skin: "#C68B5E", hair: "#1F1A18", top: "#2E3A8C", bottom: "#222228", shoes: "#F7D046", hairStyle: "short", eyeStyle: "sipit", topStyle: "singlet", bottomStyle: "shorts", shoeStyle: "football", headwear: "headband", headwearColor: "#FF5F0E", accessory: "medal", accessoryColor: "#F7D046", customized: true },
  { skin: "#E3B084", hair: "#1F1A18", top: "#2F7D4B", bottom: "#6B5B4B", shoes: "#1F1F24", hairStyle: "sidepart", eyeStyle: "poker", topStyle: "jacket", bottomStyle: "pants", shoeStyle: "ice_climbing", headwear: "beanie", headwearColor: "#2E3A8C", accessory: "glasses", accessoryColor: "#1F1F24", customized: true },
  { skin: "#F6CFA8", hair: "#C93B2B", top: "#F7D046", bottom: "#222228", shoes: "#FFFDF7", hairStyle: "bob", eyeStyle: "wink", topStyle: "jacket", bottomStyle: "shorts", shoeStyle: "ice_skates", headwear: "crown", headwearColor: "#F7D046", accessory: "none", customized: true },
  { skin: "#9E6642", hair: "#1F1A18", top: "#E0352B", bottom: "#3B425E", shoes: "#FFFDF7", hairStyle: "curly", eyeStyle: "angry", topStyle: "polo", bottomStyle: "shorts", shoeStyle: "flipflops", headwear: "mascot_hat", headwearColor: "#E0352B", accessory: "none", customized: true },
  { skin: "#FFE3C8", hair: "#4A2F1E", top: "#E6689E", bottom: "#222228", shoes: "#FF5F0E", hairStyle: "long", eyeStyle: "pout", topStyle: "tee", bottomStyle: "pants", shoeStyle: "sneakers", headwear: "mask_cat", headwearColor: "#1F1F24", accessory: "none", customized: true },
];

function avatarFor(i: number): Avatar {
  return DEMO_AVATARS[i % DEMO_AVATARS.length];
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
export async function seedEvents(store: Store, now: number): Promise<void> {
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

/** Ids for demo members: `demo-<handle>` in memory; a Postgres test passes uuids (profiles.id is a uuid). */
export type IdFor = (handle: string) => string;

export async function seedDemo(store: Store, now: number, idFor: IdFor = (h) => `demo-${h}`): Promise<void> {
  const provider = createMockProvider({ now: () => now });
  await seedEvents(store, now);
  for (const [i, [handle, name, role, isPublic]] of PEOPLE.entries()) {        // everyone first (reviewer FKs)
    await store.addMember({ id: idFor(handle), handle, displayName: name, avatar: avatarFor(i), isPublic, role, pinnedBadges: [],
                            waVerifiedAt: null, yogaConsentVersion: YOGA[handle] ? yoga.requires.consent_version : null,
                            joinedAt: new Date(now - 90 * 86_400_000).toISOString() });
  }
  for (const [handle] of PEOPLE) {
    const id = idFor(handle);
    if (handle !== "sari") {
      const names = new Map(mockRawActivities(id, now).map((r) => [String(r.id), (r.name as string) ?? null]));
      await store.upsertActivities((await provider.listActivities("demo", id, "2000-01-01")).map((a) => toStored(a, names.get(a.id) ?? null)));
    }
    let t = now - 30 * 86_400_000;
    for (const plan of YOGA[handle] ?? []) {
      for (const tahap of yoga.levels.filter((l) => plan.levels.includes(l.level))) {
        for (const mission of tahap.missions) {
          const sides: Side[] = mission.per_side ? ["left", "right"] : ["both"];
          for (const side of sides) {
            t += 3_600_000;
            await store.addAttempt({ id: globalThis.crypto.randomUUID(), userId: id, timerId: null, missionKey: mission.key, side,
                                     measuredS: mission.stars_s[plan.stars - 1], stars: plan.stars, mode: "class",
                                     status: "approved", reviewerId: idFor("sari"), reason: null, createdAt: t });
          }
        }
      }
    }
    await syncAll(store, id, now);
  }
}
