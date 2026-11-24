/**
 * Placeholder pixel art shared by the profile avatar (SVG) and the world (Phaser textures), until the
 * commissioned sprites from SPEC §12 exist. 16 × 20 cells; letters map to paper-doll colours.
 */
export interface AvatarColors { skin: string; hair: string; top: string; bottom: string; shoes: string }

export const PERSON = [
  "......hhhh......",
  ".....hhhhhh.....",
  "....hhssssh.....",
  "....hsskssk.....",
  "....hssssss.....",
  ".....ssmms......",
  "......ss........",
  "....tttttttt....",
  "...tttttttttt...",
  "...sttttttttS...",
  "...sttttttttS...",
  "....tttttttt....",
  "....bbbbbbbb....",
  "....bbbbbbbb....",
  "....bbb..bbb....",
  "....bbb..bbb....",
  "....bbb..bbb....",
  "....ss....ss....",
  "...fff....fff...",
  "...fff....fff...",
];

/** The mascot "Higround": a red furry creature with big eyes and small feet (placeholder). */
export const MASCOT = [
  "....r..rr..r....",
  "...rrrrrrrrrr...",
  "..rrrrrrrrrrrr..",
  ".rrrrrrrrrrrrrr.",
  ".rrwwwrrrrwwwrr.",
  ".rrwkwrrrrwkwrr.",
  ".rrwwwrrrrwwwrr.",
  "rrrrrrrrrrrrrrrr",
  "rrrrrrmmmmrrrrrr",
  "rrrrrrrmmrrrrrrr",
  "rrrrrrrrrrrrrrrr",
  ".rrrrrrrrrrrrrr.",
  ".rrrrrrrrrrrrrr.",
  "..rrrrrrrrrrrr..",
  "...rrrrrrrrrr...",
  "....oo....oo....",
];

export function personPalette(a: AvatarColors): Record<string, string> {
  return { h: a.hair, s: a.skin, S: a.skin, k: "#1b1b1b", m: "#9a4a3a", t: a.top, b: a.bottom, f: a.shoes };
}

export const MASCOT_PALETTE: Record<string, string> = { r: "#E0352B", w: "#ffffff", k: "#111111", m: "#7a1a14", o: "#FF5F0E" };
