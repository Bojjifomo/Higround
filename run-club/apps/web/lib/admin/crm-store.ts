import "server-only";
/**
 * Local JSON persistence for Admin CRM snapshots (LunaPOS monthly sync & Giveaway history).
 * Stored inside `.data/admin_crm.json` (gitignored) so self-hosted Mac mini PM2 keeps state across restarts.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AdminCrmState } from "./crm";

const DATA_DIR = join(process.cwd(), ".data");
const CRM_FILE = join(DATA_DIR, "admin_crm.json");

function emptyState(): AdminCrmState {
  return {
    lunaByUserId: {},
    lastLunaSyncAt: null,
    giveaways: [],
    announcement: null,
    coffeeCheckins: [],
    voucherRedemptions: [],
    clientErrors: [],
  };
}

export function loadCrmState(): AdminCrmState {
  try {
    const raw = readFileSync(CRM_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<AdminCrmState>;
    return {
      lunaByUserId: parsed.lunaByUserId ?? {},
      lastLunaSyncAt: parsed.lastLunaSyncAt ?? null,
      giveaways: Array.isArray(parsed.giveaways) ? parsed.giveaways : [],
      announcement: parsed.announcement ?? null,
      coffeeCheckins: Array.isArray(parsed.coffeeCheckins) ? parsed.coffeeCheckins : [],
      voucherRedemptions: Array.isArray(parsed.voucherRedemptions) ? parsed.voucherRedemptions : [],
      clientErrors: Array.isArray(parsed.clientErrors) ? parsed.clientErrors : [],
    };
  } catch {
    return emptyState();
  }
}

export function saveCrmState(state: AdminCrmState): void {
  try {
    mkdirSync(DATA_DIR, { recursive: true });
    writeFileSync(CRM_FILE, JSON.stringify(state, null, 2), "utf8");
  } catch {
    // Non-fatal in read-only test sandboxes
  }
}
