/**
 * Lightweight in-memory online presence tracker for /world.
 *
 * Works cleanly on single-node deployments (e.g. Mac mini PM2 `runclub`) with zero DB migrations:
 * - Visiting /world marks the member online immediately.
 * - WorldClient sends a heartbeat every ~15s while the tab is open.
 * - Closing/leaving /world fires a sendBeacon offline signal; otherwise entries auto-expire after ONLINE_TTL_MS.
 */

export const ONLINE_TTL_MS = 45_000;

const g = globalThis as unknown as { __hgPresence?: Map<string, number> };

function table(): Map<string, number> {
  g.__hgPresence ??= new Map<string, number>();
  return g.__hgPresence;
}

export function prunePresence(now = Date.now()): void {
  const m = table();
  for (const [id, lastSeen] of m) {
    if (now - lastSeen > ONLINE_TTL_MS) m.delete(id);
  }
}

export function markOnline(userId: string, now = Date.now()): void {
  if (!userId) return;
  prunePresence(now);
  table().set(userId, now);
}

export function markOffline(userId: string): void {
  if (!userId) return;
  table().delete(userId);
}

export function onlineUserIds(now = Date.now()): Set<string> {
  prunePresence(now);
  return new Set(table().keys());
}

export function isUserOnline(userId: string, now = Date.now()): boolean {
  prunePresence(now);
  return table().has(userId);
}

export function clearPresence(): void {
  table().clear();
}
