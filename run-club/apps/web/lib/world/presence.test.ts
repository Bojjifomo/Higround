import { afterEach, describe, expect, it } from "vitest";
import { clearPresence, isUserOnline, markOffline, markOnline, ONLINE_TTL_MS, onlineUserIds } from "./presence";

describe("world online presence", () => {
  afterEach(() => clearPresence());

  it("tracks online users and expires stale heartbeats after ONLINE_TTL_MS", () => {
    const t0 = 1_000_000;
    markOnline("u1", t0);
    markOnline("u2", t0 + 10_000);
    expect([...onlineUserIds(t0 + 20_000)].sort()).toEqual(["u1", "u2"]);
    expect(isUserOnline("u1", t0 + ONLINE_TTL_MS)).toBe(true);
    expect(isUserOnline("u1", t0 + ONLINE_TTL_MS + 1)).toBe(false);
    expect([...onlineUserIds(t0 + ONLINE_TTL_MS + 1)]).toEqual(["u2"]);
  });

  it("immediately removes a user when marked offline", () => {
    const t0 = 2_000_000;
    markOnline("u1", t0);
    markOnline("u2", t0);
    markOffline("u1");
    expect([...onlineUserIds(t0)]).toEqual(["u2"]);
  });
});
