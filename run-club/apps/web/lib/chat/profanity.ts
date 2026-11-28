/**
 * Indonesian + English profanity filter for Higround Run Club MMORPG World Chat (Fase E).
 * Handles:
 * - Case-insensitivity & Unicode accents / zero-width chars
 * - Leetspeak substitutions (4->a, 3->e, 1/!->i, 0->o, 5/$->s, 7->t, @->a)
 * - Stretched characters ("anjjjiiing" -> "anjing", "g0bl000k" -> "goblok")
 * - Spaced-out / punctuated bypasses ("a n j i n g", "b.a.n.g.s.a.t")
 * - Avoids false positives on normal Indonesian words ("kontribusi", "asik", "analisis", etc.)
 */

/** Strong profane roots checked with word boundaries AND spaced-letter detection. */
const BLOCKED_WORDS = [
  // Indonesian profanity & slurs
  "anjing", "anjir", "anjay", "anjg", "anj", "ajg",
  "bangsat", "bgst", "bngst",
  "babi", "bego", "begok", "bodoh", "tolol", "goblok", "gblk", "goblog",
  "kampret", "keparat", "brengsek", "berengsek",
  "kontol", "kntl", "kontl",
  "memek", "mmk", "pepek", "ppk", "puki", "pukimak",
  "ngentot", "ngntt", "entot", "kentot",
  "jembut", "jmbt",
  "lonte", "pelacur", "perek", "jalang", "sundal",
  "bajingan", "bjngn", "setan", "iblis", "jahanam",
  "taik", "tai", "taek", "tahi",
  "jancok", "jancuk", "dancok", "dancuk", "cuk", "cok",
  "asu", "asw", "matamu", "ndasmu", "picek", "bacot", "bacod", "bct",
  "cibai", "cbai", "kimak", "pantek", "panteq", "tempik",
  "sialan", "laknat", "bencong", "banci",
  // Common English profanity
  "fuck", "fucker", "fucking", "fck", "fuk",
  "shit", "bullshit", "bitch", "bastard", "asshole",
  "dick", "cock", "pussy", "cunt", "whore", "slut", "motherfucker",
] as const;

/** Safe Indonesian words that contain a short substring match if collapsed carelessly. */
const SAFE_WORDS = new Set([
  "kontribusi", "kontributor", "kontrol", "kontrak", "kontak", "konten", "konteks", "kontingen",
  "analisis", "analisa", "asik", "asyik", "asuransi", "asumsi", "asupan", "asuhan",
  "coklat", "cokelat", "cukup", "cukupan", "cukur", "cukai",
  "taichi", "tailor", "taipei", "taiwan", "detail", "setai", "santai", "pantai", "rantai", "lantai", "bantai",
  "babiq", "habib", "tabib",
  "class", "classic", "pass", "passing", "grass", "brass", "mass", "assistant", "assess",
  "cocktail", "peacock", "hancock", "shuttlecock",
  "shutter", "shirt", "tshirt",
]);

const LEET_MAP: Record<string, string> = {
  "4": "a", "@": "a",
  "3": "e",
  "1": "i", "!": "i", "|": "i",
  "0": "o",
  "5": "s", "$": "s",
  "7": "t",
  "8": "b",
  "6": "g",
};

function normalizeToken(raw: string): string {
  const lowered = raw
    .normalize("NFKD")
    .replace(/[\u0300-\u036f\u200B-\u200D\uFEFF]/g, "")
    .toLowerCase();
  let mapped = "";
  for (const ch of lowered) {
    mapped += LEET_MAP[ch] ?? ch;
  }
  // Keep only letters and collapse 2+ repeated letters to 1 or 2 for matching
  return mapped.replace(/[^a-z]/g, "");
}

function collapseRepeats(word: string): string {
  return word.replace(/(.)\1+/g, "$1");
}

const BLOCKED_EXACT = new Set<string>(BLOCKED_WORDS);
const BLOCKED_COLLAPSED = new Set<string>(BLOCKED_WORDS.map(collapseRepeats));
// Longer roots (>= 5 chars) that can also be caught when hidden inside obfuscated spaced letters
const LONG_BLOCKED = BLOCKED_WORDS.filter((w) => w.length >= 5);

export type ProfanityCheckResult =
  | { ok: true; clean: string }
  | { ok: false; reason: string; matched: string };

/**
 * Check whether a chat message is clean or contains Indonesian/English profanity.
 */
export function checkProfanity(input: string): ProfanityCheckResult {
  const clean = input.replace(/\s+/g, " ").trim();
  if (!clean) {
    return { ok: false, reason: "Pesan tidak boleh kosong.", matched: "" };
  }

  // 1. Check each whitespace-separated word token (and hyphen/slash sub-tokens)
  const rawTokens = clean.split(/[\s/,;:!?()[\]{}"']+/).filter(Boolean);
  for (const raw of rawTokens) {
    const plain = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z]/g, "");
    if (SAFE_WORDS.has(plain)) continue;

    const norm = normalizeToken(raw);
    if (!norm || SAFE_WORDS.has(norm)) continue;
    const collapsed = collapseRepeats(norm);

    if (BLOCKED_EXACT.has(norm) || BLOCKED_COLLAPSED.has(collapsed)) {
      return {
        ok: false,
        reason: "Pesan mengandung kata yang tidak sopan. Yuk jaga vibes positif di Higround! ☕",
        matched: norm,
      };
    }
  }

  // 2. Catch spaced-out obfuscation like "a n j i n g" or "b.a.n.g.s.a.t"
  // Only join runs of single/short separated tokens (1-2 chars each) to avoid joining normal words
  const singleCharRuns: string[] = [];
  let buf = "";
  for (const tok of rawTokens) {
    const norm = normalizeToken(tok);
    if (norm.length === 1) {
      buf += norm;
    } else {
      if (buf.length >= 3) singleCharRuns.push(buf);
      buf = "";
    }
  }
  if (buf.length >= 3) singleCharRuns.push(buf);

  for (const run of singleCharRuns) {
    const col = collapseRepeats(run);
    for (const root of LONG_BLOCKED) {
      if (run.includes(root) || col.includes(collapseRepeats(root))) {
        return {
          ok: false,
          reason: "Pesan mengandung kata yang tidak sopan. Yuk jaga vibes positif di Higround! ☕",
          matched: root,
        };
      }
    }
    if (BLOCKED_EXACT.has(run) || BLOCKED_COLLAPSED.has(col)) {
      return {
        ok: false,
        reason: "Pesan mengandung kata yang tidak sopan. Yuk jaga vibes positif di Higround! ☕",
        matched: run,
      };
    }
  }

  // 3. Catch dot/symbol-separated single tokens like "k.o.n.t.o.l" or "b-a-n-g-s-a-t"
  for (const raw of rawTokens) {
    if (!/[._\-*]/.test(raw)) continue;
    const stripped = normalizeToken(raw);
    if (!stripped || SAFE_WORDS.has(stripped)) continue;
    const col = collapseRepeats(stripped);
    if (BLOCKED_EXACT.has(stripped) || BLOCKED_COLLAPSED.has(col)) {
      return {
        ok: false,
        reason: "Pesan mengandung kata yang tidak sopan. Yuk jaga vibes positif di Higround! ☕",
        matched: stripped,
      };
    }
  }

  return { ok: true, clean };
}
