/**
 * Higround Run Club — Cafe Rewards, Loyalty Tiers, Weekly Club Party Quest & Ruko Visual Upgrades.
 * Inspired by Chipotle Burrito Builder, Starbucks Rewards, Habitica, Zombies Run!, and Runaddicts.
 * Pure functions so both /world and unit tests share exact deterministic rules.
 */

export interface RewardInput {
  handle: string;
  level: number;
  totalXp: number;
  totalKm: number;
  higroundStarts: number;
  yogaTahapCleared: number;
  eventCheckins: number;
}

export interface CafeVoucher {
  key: string;
  name: string;
  perk: string;
  icon: string;
  requirement: string;
  progress: number;   // 0..1
  progressLabel: string;
  unlocked: boolean;
  code: string;
}

export interface LoyaltyTier {
  name: "Bronze Runner" | "Silver Strider" | "Gold Pacer" | "Higround Legend";
  color: string;
  nextName: string | null;
  xpToNext: number;
  stamps: number;           // 1 stamp per Higround start or event check-in
  stampsPerFreeDrink: number;
}

export interface RukoUpgradeTier {
  tier: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  clubTotalKm: number;
  nextThresholdKm: number | null;
  unlocks: {
    stringLights: boolean;
    mascotBalloon: boolean;
    goldTrophy: boolean;
  };
}

export interface WeeklyClubQuest {
  title: string;
  subtitle: string;
  currentKm: number;
  targetKm: number;
  pct: number;
  completed: boolean;
  rewardText: string;
}

export function loyaltyTierOf(input: RewardInput): LoyaltyTier {
  const stamps = input.higroundStarts + input.eventCheckins;
  const xp = input.totalXp;
  if (xp >= 5000) {
    return { name: "Higround Legend", color: "#FF5F0E", nextName: null, xpToNext: 0, stamps, stampsPerFreeDrink: 5 };
  }
  if (xp >= 2000) {
    return { name: "Gold Pacer", color: "#E0A800", nextName: "Higround Legend", xpToNext: 5000 - xp, stamps, stampsPerFreeDrink: 5 };
  }
  if (xp >= 500) {
    return { name: "Silver Strider", color: "#4B4FB8", nextName: "Gold Pacer", xpToNext: 2000 - xp, stamps, stampsPerFreeDrink: 5 };
  }
  return { name: "Bronze Runner", color: "#B07A4A", nextName: "Silver Strider", xpToNext: 500 - xp, stamps, stampsPerFreeDrink: 5 };
}

export function cafeVouchersFor(input: RewardInput): CafeVoucher[] {
  const tag = input.handle.toUpperCase().slice(0, 6);
  const clamp = (n: number) => Math.max(0, Math.min(1, n));

  const startOrLv = Math.max(clamp(input.higroundStarts / 3), clamp(input.level / 3));
  const km30 = clamp(input.totalKm / 30);
  const yoga1 = clamp(input.yogaTahapCleared / 1);
  const pourOver = Math.max(clamp(input.higroundStarts / 10), clamp(input.level / 10));
  const merch = Math.max(clamp(input.totalKm / 100), clamp(input.level / 20));

  return [
    {
      key: "free_americano",
      name: "Free Iced Americano",
      perk: "Tunjukkan kode ke barista di Counter ORDER HERE!",
      icon: "☕",
      requirement: "Capai Lv 3 atau 3× Start dari Higround",
      progress: startOrLv,
      progressLabel: input.higroundStarts >= 3 ? `${input.higroundStarts}/3 Start` : `Lv ${input.level}/3`,
      unlocked: input.level >= 3 || input.higroundStarts >= 3,
      code: `HG-BREW-${tag}`,
    },
    {
      key: "free_gelato",
      name: "Free Popsicle Gelato",
      perk: "Klaim langsung di Kios Gelato Lantai 1",
      icon: "🍦",
      requirement: "Selesaikan Yoga Quest Tahap 1 (Fondasi Clear)",
      progress: yoga1,
      progressLabel: `${input.yogaTahapCleared}/1 Tahap Yoga`,
      unlocked: input.yogaTahapCleared >= 1,
      code: `HG-GEL-${tag}`,
    },
    {
      key: "burger_20",
      name: "Diskon 20% Higround Burger",
      perk: "Berlaku untuk dine-in setelah lari di Higround",
      icon: "🍔",
      requirement: "Kumpulkan total 30 km lari tercatat",
      progress: km30,
      progressLabel: `${Math.min(30, Math.round(input.totalKm))}/30 km`,
      unlocked: input.totalKm >= 30,
      code: `HG-BRG-${tag}`,
    },
    {
      key: "free_pourover",
      name: "Free Specialty Pour-Over",
      perk: "Manual brew pilihan barista di bar melengkung",
      icon: "🫖",
      requirement: "Capai Lv 10 atau 10× Start dari Higround",
      progress: pourOver,
      progressLabel: input.higroundStarts >= 10 ? `${input.higroundStarts}/10 Start` : `Lv ${input.level}/10`,
      unlocked: input.level >= 10 || input.higroundStarts >= 10,
      code: `HG-POUR-${tag}`,
    },
    {
      key: "runclub_tee",
      name: "Voucher Kaos Higround Run Club",
      perk: "Diskon spesial merch resmi + kosmetik kaos in-game",
      icon: "👕",
      requirement: "Capai 100 km total atau Lv 20",
      progress: merch,
      progressLabel: `${Math.min(100, Math.round(input.totalKm))}/100 km`,
      unlocked: input.totalKm >= 100 || input.level >= 20,
      code: `HG-TEE-${tag}`,
    },
  ];
}

export function rukoUpgradeFor(clubTotalKm: number): RukoUpgradeTier {
  if (clubTotalKm >= 400) {
    return {
      tier: 4,
      name: "Sports Hub Legendaris",
      description: "Lampu gantung hangat, balon maskot Start Gate, & Piala Emas Sports Hub aktif di ruko!",
      clubTotalKm,
      nextThresholdKm: null,
      unlocks: { stringLights: true, mascotBalloon: true, goldTrophy: true },
    };
  }
  if (clubTotalKm >= 150) {
    return {
      tier: 3,
      name: "Markas Run Club Ramai",
      description: "Lampu string hangat & Balon Maskot raksasa sudah terpasang di Start Gate!",
      clubTotalKm,
      nextThresholdKm: 400,
      unlocks: { stringLights: true, mascotBalloon: true, goldTrophy: false },
    };
  }
  if (clubTotalKm >= 50) {
    return {
      tier: 2,
      name: "Kafe Hangat Berpijar",
      description: "Lampu string hangat di teras & kafe sudah menyala!",
      clubTotalKm,
      nextThresholdKm: 150,
      unlocks: { stringLights: true, mascotBalloon: false, goldTrophy: false },
    };
  }
  return {
    tier: 1,
    name: "Ruko Baru Buka",
    description: "Lari bareng komunitas sampai 50 km untuk menyalakan lampu string hangat di Higround.",
    clubTotalKm,
    nextThresholdKm: 50,
    unlocks: { stringLights: false, mascotBalloon: false, goldTrophy: false },
  };
}

export function weeklyClubQuestFor(communityKmWeek: number, weekNumber: number): WeeklyClubQuest {
  const targetKm = 150;
  const pct = Math.min(100, Math.round((communityKmWeek / targetKm) * 100));
  return {
    title: `Misi Klub Minggu #${weekNumber}`,
    subtitle: "Kumpulkan 150 km bareng seluruh member Higround minggu ini!",
    currentKm: communityKmWeek,
    targetKm,
    pct,
    completed: communityKmWeek >= targetKm,
    rewardText: "Nyalain dekor Pesta Run Club di Start Gate + Bonus Brew Stamp saat Sunday Long Run!",
  };
}
