import "server-only";
/**
 * Server-only helper to assemble the complete Higround Member CRM directory
 * (merging profiles + run metrics + Supabase auth emails + LunaPOS loyalty + Giveaway wins).
 */
import { getStore, levelOf, memberStats, mode } from "../data";
import { createAdminClient } from "../supabase/admin";
import { defaultRules as rules, earns, weekKey } from "../xp";
import type { MemberCrmRow } from "./crm";
import { loadCrmState } from "./crm-store";

async function loadEmailsByUserId(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (mode() !== "supabase" || !process.env.SUPABASE_SERVICE_ROLE_KEY) return map;
  try {
    const admin = createAdminClient();
    const { data } = await admin.auth.admin.listUsers({ perPage: 1000 });
    for (const u of data?.users ?? []) {
      if (u.id && u.email) map.set(u.id, u.email);
    }
  } catch {
    // Non-fatal — emails remain null if service role key lacks permission
  }
  return map;
}

export async function buildMemberDirectory(now: number = Date.now()): Promise<{
  rows: MemberCrmRow[];
  crm: ReturnType<typeof loadCrmState>;
}> {
  const store = await getStore();
  const members = await store.members();
  const emails = await loadEmailsByUserId();
  const crm = loadCrmState();
  const thisWeek = weekKey(new Date(now).toISOString(), rules);

  const winCounts = new Map<string, number>();
  for (const g of crm.giveaways) {
    winCounts.set(g.userId, (winCounts.get(g.userId) ?? 0) + 1);
  }

  const rows: MemberCrmRow[] = await Promise.all(
    members.map(async (m) => {
      const [lvl, stats, acts] = await Promise.all([
        levelOf(store, m.id),
        memberStats(store, m.id),
        store.activities(m.id),
      ]);
      const approved = new Set(acts.filter((a) => a.reviewStatus === "approved").map((a) => a.id));
      const ok = acts.filter((a) => earns(a, approved, rules));
      const weekKm =
        ok.filter((a) => weekKey(a.startTime, rules) === thisWeek).reduce((s, a) => s + a.distanceM, 0) / 1000;
      const fallbackDemoEmail = mode() === "demo" ? `${m.handle}@higround.demo` : null;

      return {
        id: m.id,
        handle: m.handle,
        displayName: m.displayName,
        email: emails.get(m.id) ?? crm.lunaByUserId[m.id]?.email ?? fallbackDemoEmail,
        role: m.role,
        joinedAt: m.joinedAt,
        level: lvl.level,
        totalXp: lvl.totalXp,
        totalKm: stats.totalKm,
        weekKm,
        runs: stats.runCount,
        higroundStarts: stats.higroundStarts,
        waVerified: Boolean(m.waVerifiedAt),
        luna: crm.lunaByUserId[m.id] ?? null,
        giveawayWins: winCounts.get(m.id) ?? 0,
      };
    }),
  );

  rows.sort((a, b) => b.weekKm - a.weekKm || b.totalKm - a.totalKm || a.displayName.localeCompare(b.displayName));
  return { rows, crm };
}
