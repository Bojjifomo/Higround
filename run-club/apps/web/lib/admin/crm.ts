/**
 * Pure Admin CRM utilities: Member Database CSV Export, LunaPOS Monthly CSV Parser/Matcher,
 * and shared TypeScript types (100% isomorphic — no node:fs imports).
 */

export interface LunaPosRecord {
  userId: string;
  email: string | null;
  phone: string | null;
  lunaTier: string | null;
  lunaPoints: number;
  totalSpendIdr: number | null;
  syncedAt: string;
}

export interface GiveawayRecord {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  email: string;
  prizeName: string;
  voucherCode: string;
  sentViaResend: boolean;
  sentAt: string;
  redeemedAt?: string | null;
}

export interface WorldAnnouncement {
  text: string;
  author: string;
  createdAt: string;
}

export interface CoffeeCheckinRecord {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  dateWib: string;
  checkedInAt: string;
  xpAwarded: number;
}

export interface VoucherRedemptionRecord {
  id: string;
  userId: string;
  handle: string;
  displayName: string;
  voucherKey: string;
  voucherName: string;
  voucherCode: string;
  redeemedAt: string;
}

export interface ClientErrorRecord {
  id: string;
  message: string;
  path: string;
  ua: string;
  at: string;
}

export interface AdminCrmState {
  lunaByUserId: Record<string, LunaPosRecord>;
  lastLunaSyncAt: string | null;
  giveaways: GiveawayRecord[];
  announcement: WorldAnnouncement | null;
  coffeeCheckins: CoffeeCheckinRecord[];
  voucherRedemptions: VoucherRedemptionRecord[];
  clientErrors: ClientErrorRecord[];
}

export interface MemberCrmRow {
  id: string;
  handle: string;
  displayName: string;
  email: string | null;
  role: string;
  joinedAt: string;
  level: number;
  totalXp: number;
  totalKm: number;
  weekKm: number;
  runs: number;
  higroundStarts: number;
  waVerified: boolean;
  luna: LunaPosRecord | null;
  giveawayWins: number;
}

// ── RFC-4180 + Semicolon CSV Parser (handles Indonesian Excel & LunaPOS exports) ──

export function parseCsv(csvText: string): { headers: string[]; rows: Record<string, string>[] } {
  const text = csvText.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
  if (!text) return { headers: [], rows: [] };

  // Detect delimiter from first line (comma vs semicolon)
  const firstLine = text.split("\n")[0] ?? "";
  const semiCount = (firstLine.match(/;/g) ?? []).length;
  const commaCount = (firstLine.match(/,/g) ?? []).length;
  const delim = semiCount > commaCount ? ";" : ",";

  const matrix: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delim) {
      row.push(field.trim());
      field = "";
    } else if (ch === "\n") {
      row.push(field.trim());
      if (row.some((cell) => cell.length > 0)) matrix.push(row);
      row = [];
      field = "";
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((cell) => cell.length > 0)) matrix.push(row);

  if (matrix.length === 0) return { headers: [], rows: [] };
  const headers = matrix[0].map((h) => h.trim());
  const rows = matrix.slice(1).map((cells) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}

function pickField(row: Record<string, string>, patterns: RegExp[]): string {
  for (const [k, v] of Object.entries(row)) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (patterns.some((p) => p.test(norm)) && v) return v;
  }
  return "";
}

function parseNumber(raw: string): number {
  const digits = raw.replace(/[^0-9.-]/g, "");
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export interface LunaPosSyncSummary {
  totalRows: number;
  matchedCount: number;
  unmatchedCount: number;
  matchedRecords: LunaPosRecord[];
  unmatchedLabels: string[];
}

/**
 * Match LunaPOS CSV export rows against Higround Run Club members (by email first, then displayName).
 */
export function matchLunaPosCsv(
  csvText: string,
  members: { id: string; displayName: string; handle: string; email: string | null }[],
  syncedAtIso: string,
): LunaPosSyncSummary {
  const { rows } = parseCsv(csvText);
  const byEmail = new Map<string, (typeof members)[number]>();
  const byName = new Map<string, (typeof members)[number]>();
  for (const m of members) {
    if (m.email) byEmail.set(m.email.trim().toLowerCase(), m);
    byName.set(m.displayName.trim().toLowerCase(), m);
    byName.set(m.handle.trim().toLowerCase(), m);
  }

  const matchedRecords: LunaPosRecord[] = [];
  const unmatchedLabels: string[] = [];

  for (const r of rows) {
    const email = pickField(r, [/^email$/, /^mail$/, /email/]).toLowerCase();
    const name = pickField(r, [/^nama$/, /^name$/, /customer/, /member/, /pelanggan/]);
    const phone = pickField(r, [/phone/, /telp/, /^hp$/, /nohp/, /whatsapp/, /^wa$/]);
    const pointsRaw = pickField(r, [/poin/, /point/, /stamp/]);
    const tier = pickField(r, [/tier/, /level/, /status/, /membership/]);
    const spendRaw = pickField(r, [/spend/, /belanja/, /totaltransaksi/, /amount/, /nominal/]);

    const hit = (email && byEmail.get(email)) || (name && byName.get(name.trim().toLowerCase())) || null;
    if (!hit) {
      const label = email || name || phone || "(baris kosong)";
      unmatchedLabels.push(label);
      continue;
    }

    matchedRecords.push({
      userId: hit.id,
      email: email || hit.email,
      phone: phone || null,
      lunaTier: tier || "Member",
      lunaPoints: Math.round(parseNumber(pointsRaw)),
      totalSpendIdr: spendRaw ? Math.round(parseNumber(spendRaw)) : null,
      syncedAt: syncedAtIso,
    });
  }

  return {
    totalRows: rows.length,
    matchedCount: matchedRecords.length,
    unmatchedCount: unmatchedLabels.length,
    matchedRecords,
    unmatchedLabels: unmatchedLabels.slice(0, 20),
  };
}

function csvCell(v: string | number | boolean | null | undefined): string {
  const s = v == null ? "" : String(v);
  if (/[",\n;]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Build an Excel-friendly UTF-8 CSV (with BOM) of the full Higround member database. */
export function buildMembersCsv(rows: MemberCrmRow[]): string {
  const header = [
    "Nickname",
    "Handle",
    "Email",
    "Role",
    "Tanggal Gabung",
    "Level",
    "Total XP",
    "Total KM (Lari)",
    "KM Minggu Ini",
    "Sesi Lari",
    "Start Higround",
    "Grup WA",
    "LunaPOS Tier",
    "LunaPOS Poin",
    "Menang Giveaway",
  ];
  const lines = [
    header.join(","),
    ...rows.map((r) =>
      [
        r.displayName,
        `@${r.handle}`,
        r.email ?? "",
        r.role,
        r.joinedAt.slice(0, 10),
        r.level,
        r.totalXp,
        r.totalKm.toFixed(2),
        r.weekKm.toFixed(2),
        r.runs,
        r.higroundStarts,
        r.waVerified ? "Ya" : "Belum",
        r.luna?.lunaTier ?? "",
        r.luna?.lunaPoints ?? "",
        r.giveawayWins,
      ].map(csvCell).join(","),
    ),
  ];
  return `\uFEFF${lines.join("\n")}\n`;
}

export const LUNAPOS_SAMPLE_CSV = [
  "Customer Name,Email,Phone,Loyalty Tier,Points,Total Spend",
  "Rina Lestari,rina@example.com,08123456789,Gold,240,1450000",
  "Bima Pratama,bima@example.com,08129876543,Silver,120,780000",
].join("\n");
