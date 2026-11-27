/**
 * Nickname validation and automatic URL handle generation (Roadmap v4 — Fase A).
 *
 * Rules:
 * - Nickname (display name): uppercase/lowercase letters (Caps Lock allowed), numbers, and spaces only.
 *   No symbols, no emoji.
 * - Handle (/u/[handle]): auto-generated behind the scenes to satisfy Postgres `^[a-z0-9_]{3,24}$`
 *   so profile URLs and DB relations never break even though users don't type a username.
 */

export const NICKNAME_MIN = 2;
export const NICKNAME_MAX = 32;
export const NICKNAME_PATTERN = /^[A-Za-z0-9 ]+$/;
export const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

export type NicknameValidation =
  | { ok: true; nickname: string }
  | { ok: false; message: string };

export function validateNickname(raw: string): NicknameValidation {
  const nickname = raw.trim().replace(/\s+/g, " ");
  if (!nickname) {
    return { ok: false, message: "Nama tampilan wajib diisi." };
  }
  if (nickname.length < NICKNAME_MIN) {
    return { ok: false, message: `Nama tampilan minimal ${NICKNAME_MIN} karakter.` };
  }
  if (nickname.length > NICKNAME_MAX) {
    return { ok: false, message: `Nama tampilan maksimal ${NICKNAME_MAX} karakter.` };
  }
  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      ok: false,
      message: "Nama tampilan hanya boleh huruf (besar/kecil), angka, dan spasi — tanpa simbol atau emoji.",
    };
  }
  return { ok: true, nickname };
}

/** Deterministic slug base matching `^[a-z0-9_]{3,18}$` (leaves room for uniqueness suffixes). */
export function handleBaseFromNickname(nickname: string): string {
  let base = nickname
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]/g, "")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");

  if (!base) base = "runner";
  if (base.length < 3) base = `${base}_hg`;
  if (base.length > 18) base = base.slice(0, 18).replace(/_+$/g, "") || "runner";
  if (base.length < 3) base = `${base}_hg`;
  return base;
}

/** Generate a unique handle matching `^[a-z0-9_]{3,24}$` from a validated nickname. */
export async function generateUniqueHandle(
  nickname: string,
  isTaken: (handle: string) => boolean | Promise<boolean>,
): Promise<string> {
  const base = handleBaseFromNickname(nickname);
  if (!(await isTaken(base))) return base;

  for (let i = 2; i <= 999; i++) {
    const suffix = `_${i}`;
    const candidate = `${base.slice(0, 24 - suffix.length)}${suffix}`;
    if (!(await isTaken(candidate))) return candidate;
  }

  for (let tries = 0; tries < 20; tries++) {
    const rand = Math.random().toString(36).slice(2, 7).replace(/[^a-z0-9]/g, "0").padEnd(5, "0");
    const candidate = `${base.slice(0, 18)}_${rand}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error("Gagal membuat ID profil unik. Coba nama tampilan lain.");
}
