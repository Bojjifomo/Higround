import { describe, expect, it } from "vitest";
import { asSql, freshDb, uuidFor } from "../../supabase-tests/pglite";
import { PEOPLE } from "./demo";
import { serviceSuite } from "./service.suite";
import { SqlStore } from "./sql-store";

// The whole service suite again, this time on Postgres with the real migrations.
serviceSuite("postgres store (PGlite)", async () => {
  const db = await freshDb();
  await db.query(`insert into auth.users (id) select unnest($1::uuid[])`, [PEOPLE.map(([h]) => uuidFor(h))]);
  return { store: new SqlStore(asSql(db)), idFor: uuidFor, close: () => db.close() };
});

describe("postgres store details", () => {
  it("keeps an admin's review decision when the provider sends the run again", async () => {
    const db = await freshDb();
    const id = uuidFor("x");
    await db.query("insert into auth.users (id) values ($1)", [id]);
    const s = new SqlStore(asSql(db));
    await s.addMember({ id, handle: "xx_", displayName: "X", avatar: { skin: "#000", hair: "#000", top: "#000", bottom: "#000", shoes: "#000" },
                        isPublic: true, role: "member", pinnedBadges: [], waVerifiedAt: null, yogaConsentVersion: null,
                        joinedAt: new Date().toISOString() });
    const run = { id: "i1", userId: id, type: "Run", source: "GARMIN_CONNECT", deviceName: "x", startTime: "2026-11-23T05:00:00+07:00",
                  distanceM: 21000, movingTimeS: 2940, elevGainM: 0, maxSpeedKmh: 45, startLat: null, startLng: null,
                  isHigroundStart: false, counted: true, flagged: true, flagReasons: ["max_speed"], reviewStatus: "pending" as const,
                  name: "Fast" };
    await s.upsertActivities([run]);
    await s.updateActivity(id, "i1", { reviewStatus: "approved" });
    await s.upsertActivities([{ ...run, name: "Fast (edited)" }]);
    const [a] = await s.activities(id);
    expect(a).toMatchObject({ reviewStatus: "approved", name: "Fast (edited)", startTime: "2026-11-22T22:00:00.000Z" });
    expect(await s.addLedger([{ userId: id, amount: 5, ruleKey: "r", sourceType: "activity", sourceId: "i1", idempotencyKey: "k" }], Date.now())).toBe(1);
    expect(await s.addLedger([{ userId: id, amount: 5, ruleKey: "r", sourceType: "activity", sourceId: "i1", idempotencyKey: "k" }], Date.now())).toBe(0);
    await db.close();
  });
});
