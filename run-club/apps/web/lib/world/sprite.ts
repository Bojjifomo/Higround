/**
 * High-detail 28x36 chibi pixel-art paper-doll character system (inspired by Kairosoft, SnowHex & Gather.town),
 * shared across Character Creator (/create), Profile Avatar (SVG), and World (Phaser 3 textures).
 * Features multi-tone hair highlights, expressive eyes with specular dots, blink idle, smooth walk/run strides,
 * coffee-cup sip pose, stretch, and yoga Tree/Warrior pose. Backward-compatible with 5-color legacy Avatars.
 */

export type HairStyleId =
  | "short" | "spiky" | "bob" | "ponytail" | "bun" | "curly" | "long" | "twintails" | "sidepart" | "buzz";
export type EyeStyleId = "classic" | "happy" | "cool" | "wide" | "wink";
export type TopStyleId = "tee" | "singlet" | "hoodie" | "higround" | "jacket" | "polo";
export type BottomStyleId = "shorts" | "run_shorts" | "pants" | "joggers";
export type HeadwearId = "none" | "cap" | "headband" | "visor" | "beanie" | "mascot_hat";
export type AccessoryId = "none" | "glasses" | "shades" | "vest" | "medal" | "earphones";
export type AnimPose = "idle" | "walk" | "run" | "sit" | "stretch" | "yoga";

export interface AvatarColors {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  hairStyle?: HairStyleId;
  eyeStyle?: EyeStyleId;
  topStyle?: TopStyleId;
  bottomStyle?: BottomStyleId;
  headwear?: HeadwearId;
  headwearColor?: string;
  accessory?: AccessoryId;
  accessoryColor?: string;
  customized?: boolean;
}

export interface NormalizedAvatar extends Required<Omit<AvatarColors, "customized">> {
  customized: boolean;
}

export const AVATAR_OPTIONS = {
  hairStyle: [
    { id: "short", label: "Pendek" },
    { id: "spiky", label: "Spiky" },
    { id: "bob", label: "Bob" },
    { id: "ponytail", label: "Ponytail" },
    { id: "bun", label: "Cepol" },
    { id: "curly", label: "Keriting" },
    { id: "long", label: "Panjang" },
    { id: "twintails", label: "Kuncir Dua" },
    { id: "sidepart", label: "Belah Samping" },
    { id: "buzz", label: "Cepak" },
  ] as const,
  eyeStyle: [
    { id: "classic", label: "Klasik" },
    { id: "happy", label: "Ceria" },
    { id: "cool", label: "Santai" },
    { id: "wide", label: "Berbinar" },
    { id: "wink", label: "Kedip" },
  ] as const,
  topStyle: [
    { id: "higround", label: "Kaos Run Club" },
    { id: "tee", label: "Kaos Polos" },
    { id: "singlet", label: "Singlet Lari" },
    { id: "hoodie", label: "Hoodie" },
    { id: "jacket", label: "Jaket Lari" },
    { id: "polo", label: "Polo" },
  ] as const,
  bottomStyle: [
    { id: "run_shorts", label: "Celana Lari" },
    { id: "shorts", label: "Pendek" },
    { id: "joggers", label: "Jogger" },
    { id: "pants", label: "Panjang" },
  ] as const,
  headwear: [
    { id: "none", label: "Tanpa Topi" },
    { id: "headband", label: "Headband" },
    { id: "cap", label: "Topi Lari" },
    { id: "visor", label: "Visor" },
    { id: "beanie", label: "Beanie" },
    { id: "mascot_hat", label: "Topi Maskot" },
  ] as const,
  accessory: [
    { id: "none", label: "Polos" },
    { id: "glasses", label: "Kacamata" },
    { id: "shades", label: "Kacamata Lari" },
    { id: "vest", label: "Hydration Vest" },
    { id: "medal", label: "Medali Finisher" },
    { id: "earphones", label: "Earphone" },
  ] as const,
};

export const AVATAR_PALETTES = {
  skin: ["#FFE3C8", "#F6CFA8", "#E3B084", "#C68B5E", "#9E6642", "#6E442B"],
  hair: ["#1F1A18", "#4A2F1E", "#7B4B2A", "#B86B35", "#D9A84E", "#C93B2B", "#2E3A8C", "#654EA3", "#2E7D5B", "#ECE6DA"],
  top: ["#FF5F0E", "#2E3A8C", "#F7D046", "#E0352B", "#4B4FB8", "#2F7D4B", "#1F1F24", "#FFFDF7", "#E6689E", "#2D9CDB"],
  bottom: ["#222228", "#3B425E", "#6B5B4B", "#2E3A8C", "#1E5631", "#A84A28", "#D9CFC0", "#FF5F0E"],
  shoes: ["#FFFDF7", "#FF5F0E", "#1F1F24", "#F7D046", "#E0352B", "#2E3A8C", "#39B57A", "#E6689E"],
  headwearColor: ["#FF5F0E", "#2E3A8C", "#F7D046", "#E0352B", "#1F1F24", "#FFFDF7", "#2F7D4B", "#4B4FB8"],
  accessoryColor: ["#F7D046", "#FF5F0E", "#1F1F24", "#2E3A8C", "#2D9CDB", "#FFFDF7", "#E0352B", "#2F7D4B"],
};

const validId = <T extends string>(val: string | undefined, list: readonly { id: T }[], fallback: T): T =>
  list.some((x) => x.id === val) ? (val as T) : fallback;

const validHex = (val: string | undefined, fallback: string) =>
  val && /^#[0-9a-fA-F]{6}$/.test(val) ? val : fallback;

export function normalizeAvatar(raw: Partial<AvatarColors> | null | undefined): NormalizedAvatar {
  const a = raw ?? {};
  return {
    skin: validHex(a.skin, "#F6CFA8"),
    hair: validHex(a.hair, "#1F1A18"),
    top: validHex(a.top, "#FF5F0E"),
    bottom: validHex(a.bottom, "#222228"),
    shoes: validHex(a.shoes, "#FFFDF7"),
    hairStyle: validId(a.hairStyle, AVATAR_OPTIONS.hairStyle, "short"),
    eyeStyle: validId(a.eyeStyle, AVATAR_OPTIONS.eyeStyle, "classic"),
    topStyle: validId(a.topStyle, AVATAR_OPTIONS.topStyle, "higround"),
    bottomStyle: validId(a.bottomStyle, AVATAR_OPTIONS.bottomStyle, "run_shorts"),
    headwear: validId(a.headwear, AVATAR_OPTIONS.headwear, "none"),
    headwearColor: validHex(a.headwearColor, "#FF5F0E"),
    accessory: validId(a.accessory, AVATAR_OPTIONS.accessory, "none"),
    accessoryColor: validHex(a.accessoryColor, "#F7D046"),
    customized: Boolean(a.customized),
  };
}

export function randomAvatar(seed?: number): NormalizedAvatar {
  let s = (seed ?? Math.floor(Math.random() * 1e9)) >>> 0;
  const rng = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), s | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(rng() * arr.length)];
  return {
    skin: pick(AVATAR_PALETTES.skin),
    hair: pick(AVATAR_PALETTES.hair),
    top: pick(AVATAR_PALETTES.top),
    bottom: pick(AVATAR_PALETTES.bottom),
    shoes: pick(AVATAR_PALETTES.shoes),
    hairStyle: pick(AVATAR_OPTIONS.hairStyle).id,
    eyeStyle: pick(AVATAR_OPTIONS.eyeStyle).id,
    topStyle: pick(AVATAR_OPTIONS.topStyle).id,
    bottomStyle: pick(AVATAR_OPTIONS.bottomStyle).id,
    headwear: rng() < 0.55 ? pick(AVATAR_OPTIONS.headwear).id : "none",
    headwearColor: pick(AVATAR_PALETTES.headwearColor),
    accessory: rng() < 0.5 ? pick(AVATAR_OPTIONS.accessory).id : "none",
    accessoryColor: pick(AVATAR_PALETTES.accessoryColor),
    customized: true,
  };
}

function shadeHex(hex: string, factor: number): string {
  const n = parseInt(hex.slice(1, 7), 16);
  const r = Math.max(0, Math.min(255, Math.round(((n >> 16) & 255) * factor)));
  const g = Math.max(0, Math.min(255, Math.round(((n >> 8) & 255) * factor)));
  const b = Math.max(0, Math.min(255, Math.round((n & 255) * factor)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

export const SPRITE_W = 28;
export const SPRITE_H = 36;

export const ANIM_FRAMES: Record<AnimPose, number> = {
  idle: 3,   // 0 normal, 1 breath, 2 cute blink!
  walk: 4,
  run: 4,
  sit: 2,    // 0 sit with coffee cup, 1 gentle sip!
  stretch: 2,
  yoga: 2,
};

export interface RenderedSprite {
  width: number;
  height: number;
  rows: string[];
  palette: Record<string, string>;
}

export function buildAvatarPalette(raw: AvatarColors): Record<string, string> {
  const a = normalizeAvatar(raw);
  return {
    o: "#241917", // warm espresso pixel outline (SnowHex / Kairosoft signature)
    w: "#FFFFFF",
    k: "#1E1615", // eye pupil
    e: "#49322B", // iris/eyelash
    p: "#F0958E", // warm rosy blush
    m: shadeHex(a.skin, 0.72), // smile / nose shadow
    s: a.skin,
    S: shadeHex(a.skin, 0.86),
    D: shadeHex(a.skin, 0.76),
    h: a.hair,
    H: shadeHex(a.hair, 0.72),
    L: shadeHex(a.hair, 1.24),
    t: a.top,
    T: shadeHex(a.top, 0.76),
    Q: shadeHex(a.top, 1.15),
    u: a.top === "#FF5F0E" ? "#FFFDF7" : "#FF5F0E",
    b: a.bottom,
    B: shadeHex(a.bottom, 0.74),
    f: a.shoes,
    F: shadeHex(a.shoes, 0.72),
    c: a.headwearColor,
    C: shadeHex(a.headwearColor, 0.74),
    K: shadeHex(a.headwearColor, 1.18),
    a: a.accessoryColor,
    A: shadeHex(a.accessoryColor, 0.74),
    r: "#E0352B", // mascot red
    y: "#F7D046", // gold medal / star
    g: "#C98D59", // coffee cup sleeve
  };
}

/**
 * Draw a refined 28x36 chibi pixel character (SnowHex / Kairosoft / Gather.town quality).
 */
export function renderAvatarPixels(raw: AvatarColors, pose: AnimPose = "idle", frame = 0): RenderedSprite {
  const a = normalizeAvatar(raw);
  const f = ((frame % ANIM_FRAMES[pose]) + ANIM_FRAMES[pose]) % ANIM_FRAMES[pose];
  const grid: string[][] = Array.from({ length: SPRITE_H }, () => Array<string>(SPRITE_W).fill("."));

  const set = (x: number, y: number, ch: string) => {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix >= 1 && ix < SPRITE_W - 1 && iy >= 1 && iy < SPRITE_H - 1) grid[iy][ix] = ch;
  };
  const rect = (x0: number, y0: number, w: number, h: number, ch: string) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) set(x, y, ch);
  };

  const bob =
    pose === "walk" ? (f % 2 === 1 ? -1 : 0) :
    pose === "run" ? (f % 2 === 1 ? -2 : 0) :
    pose === "idle" ? (f === 1 ? 1 : 0) :
    pose === "sit" ? 3 :
    pose === "stretch" ? (f === 1 ? -1 : 0) :
    pose === "yoga" ? (f === 1 ? -1 : 0) : 0;

  const headY = 6 + bob;
  const neckY = 18 + bob;
  const torsoY = 19 + bob;
  const hipY = 26 + bob;

  // ── 1. Back Hair Volume ───────────────────────────────────────────────────
  if (a.hairStyle === "long") {
    rect(6, headY + 3, 16, 15, "H");
    rect(7, headY + 4, 14, 13, "h");
  } else if (a.hairStyle === "ponytail") {
    rect(19, headY + 3, 4, 9, "H");
    rect(20, headY + 4, 3, 7, "h");
    rect(19, headY + 3, 2, 2, "u");
  } else if (a.hairStyle === "twintails") {
    rect(4, headY + 5, 3, 11, "H");
    rect(21, headY + 5, 3, 11, "H");
    rect(5, headY + 6, 2, 8, "h");
    rect(21, headY + 6, 2, 8, "h");
    rect(5, headY + 5, 2, 1, "u");
    rect(21, headY + 5, 2, 1, "u");
  } else if (a.hairStyle === "curly") {
    rect(5, headY + 1, 18, 12, "H");
    rect(6, headY + 2, 16, 10, "h");
  }

  // ── 2. Legs, Bottoms & Sneakers (with white rubber sole!) ─────────────────
  const longPants = a.bottomStyle === "pants" || a.bottomStyle === "joggers";
  const drawLeg = (lx: number, ly: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const isPants = longPants ? i < len - 1 : i < 3;
      set(lx, ly + i, isPants ? "b" : "s");
      set(lx + 1, ly + i, isPants ? "b" : "s");
      set(lx + 2, ly + i, isPants ? "B" : "S");
    }
    // Detailed sneaker with white sole
    rect(lx - 1, ly + len - 2, 4, 2, "f");
    set(lx + 2, ly + len - 2, "F");
    rect(lx - 1, ly + len, 4, 1, "w");
  };

  if (pose === "sit") {
    rect(9, hipY, 10, 3, "b");
    rect(9, hipY + 3, 4, 2, longPants ? "b" : "s");
    rect(15, hipY + 3, 4, 2, longPants ? "B" : "S");
    rect(8, hipY + 4, 5, 2, "f");
    rect(15, hipY + 4, 5, 2, "F");
    rect(8, hipY + 6, 5, 1, "w");
    rect(15, hipY + 6, 5, 1, "w");
  } else if (pose === "yoga") {
    rect(9, hipY, 10, 2, "b");
    drawLeg(11, hipY + 1, 7);
    // Bent right knee out in Tree Pose
    rect(15, hipY + 1, 3, 2, "b");
    rect(17, hipY + 2, 2, 2, longPants ? "b" : "s");
    rect(15, hipY + 3, 3, 2, "f");
  } else {
    rect(9, hipY, 10, 2, "b");
    if (a.bottomStyle === "run_shorts") {
      set(9, hipY + 1, "u");
      set(18, hipY + 1, "u");
    }
    if (pose === "walk") {
      if (f === 0) { drawLeg(8, hipY + 1, 7); drawLeg(16, hipY + 1, 5); }
      else if (f === 2) { drawLeg(9, hipY + 1, 5); drawLeg(17, hipY + 1, 7); }
      else { drawLeg(9, hipY + 1, 7); drawLeg(16, hipY + 1, 7); }
    } else if (pose === "run") {
      if (f === 0) { drawLeg(6, hipY + 1, 7); drawLeg(17, hipY, 5); }
      else if (f === 2) { drawLeg(8, hipY, 5); drawLeg(18, hipY + 1, 7); }
      else { drawLeg(9, hipY + 1, 6); drawLeg(16, hipY + 1, 6); }
    } else {
      drawLeg(9, hipY + 1, 7);
      drawLeg(16, hipY + 1, 7);
    }
  }

  // ── 3. Neck & Torso with Top Styles ───────────────────────────────────────
  rect(12, neckY, 4, 2, "S");
  rect(9, torsoY, 10, 7, "t");
  rect(10, torsoY, 2, 6, "Q"); // subtle left light highlight
  rect(17, torsoY, 2, 7, "T"); // right shading

  if (a.topStyle === "higround") {
    rect(10, torsoY + 2, 8, 2, "u");
    set(13, torsoY + 2, "t");
    set(14, torsoY + 2, "t");
    rect(10, torsoY + 5, 8, 1, "T");
  } else if (a.topStyle === "hoodie") {
    rect(10, torsoY, 8, 2, "T");
    rect(11, torsoY + 4, 6, 3, "T");
    set(12, torsoY + 2, "w");
    set(15, torsoY + 2, "w");
  } else if (a.topStyle === "jacket") {
    rect(13, torsoY, 2, 7, "w");
    rect(11, torsoY + 1, 1, 5, "T");
    rect(16, torsoY + 1, 1, 5, "T");
  } else if (a.topStyle === "polo") {
    rect(11, torsoY, 2, 1, "w");
    rect(15, torsoY, 2, 1, "w");
    rect(13, torsoY + 1, 2, 2, "w");
  } else if (a.topStyle === "singlet") {
    rect(9, torsoY, 2, 1, "s");
    rect(17, torsoY, 2, 1, "S");
    rect(11, torsoY, 6, 1, "s");
  }

  // ── 4. Arms & Coffee Cup (during sit!) ────────────────────────────────────
  const sleeve = a.topStyle === "singlet" ? "s" : "t";
  if (pose === "stretch") {
    const reach = f === 1 ? -1 : 0;
    rect(6, torsoY - 6 + reach, 3, 7, "s");
    rect(19, torsoY - 6 - reach, 3, 7, "S");
    rect(7, torsoY, 2, 2, sleeve);
    rect(19, torsoY, 2, 2, sleeve);
  } else if (pose === "yoga") {
    rect(6, torsoY - 5, 2, 5, "s");
    rect(20, torsoY - 5, 2, 5, "S");
    rect(7, torsoY - 6, 2, 2, "s");
    rect(19, torsoY - 6, 2, 2, "S");
    rect(7, torsoY, 2, 2, sleeve);
    rect(19, torsoY, 2, 2, sleeve);
  } else if (pose === "sit") {
    // Left arm relaxed, right hand holding a tiny Higround takeaway coffee cup!
    rect(6, torsoY + 1, 3, 3, sleeve);
    rect(6, torsoY + 4, 3, 2, "s");
    const sipY = f === 1 ? -2 : 0;
    rect(19, torsoY + 1 + sipY, 3, 3, sleeve);
    rect(19, torsoY + 4 + sipY, 2, 2, "S");
    // Tiny orange/white coffee cup in hand!
    rect(21, torsoY + 2 + sipY, 3, 4, "w");
    rect(21, torsoY + 3 + sipY, 3, 2, "g");
    rect(20, torsoY + 1 + sipY, 5, 1, "u");
  } else if (pose === "run") {
    const swing = f === 0 ? -2 : f === 2 ? 2 : 0;
    rect(5, torsoY + 1 + swing, 4, 3, sleeve);
    rect(5, torsoY + 3 + swing, 3, 2, "s");
    rect(19, torsoY + 1 - swing, 4, 3, sleeve);
    rect(20, torsoY + 3 - swing, 3, 2, "S");
  } else if (pose === "walk") {
    const swing = f === 0 ? 1 : f === 2 ? -1 : 0;
    rect(6, torsoY + 1 + swing, 3, 3, sleeve);
    rect(6, torsoY + 4 + swing, 3, 2, "s");
    rect(19, torsoY + 1 - swing, 3, 3, sleeve);
    rect(19, torsoY + 4 - swing, 3, 2, "S");
  } else {
    rect(6, torsoY + 1, 3, 3, sleeve);
    rect(6, torsoY + 4, 3, 3, "s");
    rect(19, torsoY + 1, 3, 3, sleeve);
    rect(19, torsoY + 4, 3, 3, "S");
  }

  // ── 5. Torso Accessories (Hydration Vest / Medal) ─────────────────────────
  if (a.accessory === "vest") {
    rect(9, torsoY, 3, 6, "a");
    rect(16, torsoY, 3, 6, "A");
    rect(10, torsoY + 3, 8, 1, "A");
    set(10, torsoY + 2, "w");
    set(17, torsoY + 2, "w");
  } else if (a.accessory === "medal") {
    set(11, torsoY, "u"); set(16, torsoY, "u");
    set(12, torsoY + 1, "u"); set(15, torsoY + 1, "u");
    rect(13, torsoY + 2, 2, 2, "y");
    set(13, torsoY + 2, "w");
  }

  // ── 6. Chibi Head & Expressive SnowHex Face ───────────────────────────────
  rect(8, headY, 12, 12, "s");
  rect(7, headY + 1, 14, 10, "s");
  // Cute pixel ears
  rect(6, headY + 6, 1, 3, "s");
  rect(21, headY + 6, 1, 3, "S");
  // Soft right cheek & chin shading
  rect(19, headY + 3, 2, 7, "S");
  rect(9, headY + 11, 10, 1, "S");
  // Warm rosy blush
  rect(8, headY + 8, 2, 1, "p");
  rect(18, headY + 8, 2, 1, "p");
  // Cute smile
  rect(13, headY + 9, 2, 1, "m");

  // Eyes (with blink on idle frame 2!)
  const blinking = pose === "idle" && f === 2;
  if (blinking) {
    rect(9, headY + 6, 3, 1, "k");
    rect(16, headY + 6, 3, 1, "k");
  } else if (a.eyeStyle === "classic") {
    rect(9, headY + 5, 3, 3, "w");
    rect(10, headY + 5, 2, 3, "k");
    set(10, headY + 5, "w");
    rect(16, headY + 5, 3, 3, "w");
    rect(16, headY + 5, 2, 3, "k");
    set(16, headY + 5, "w");
  } else if (a.eyeStyle === "happy") {
    set(9, headY + 7, "k"); set(10, headY + 6, "k"); set(11, headY + 6, "k"); set(12, headY + 7, "k");
    set(15, headY + 7, "k"); set(16, headY + 6, "k"); set(17, headY + 6, "k"); set(18, headY + 7, "k");
  } else if (a.eyeStyle === "cool") {
    rect(9, headY + 5, 3, 1, "H");
    rect(10, headY + 6, 2, 2, "k");
    rect(16, headY + 5, 3, 1, "H");
    rect(16, headY + 6, 2, 2, "k");
  } else if (a.eyeStyle === "wide") {
    rect(9, headY + 4, 3, 4, "w");
    rect(10, headY + 5, 2, 3, "k");
    set(10, headY + 5, "w");
    set(11, headY + 7, "e");
    rect(16, headY + 4, 3, 4, "w");
    rect(16, headY + 5, 2, 3, "k");
    set(16, headY + 5, "w");
    set(17, headY + 7, "e");
  } else if (a.eyeStyle === "wink") {
    rect(9, headY + 5, 3, 3, "w");
    rect(10, headY + 5, 2, 3, "k");
    set(10, headY + 5, "w");
    rect(16, headY + 6, 3, 1, "k");
  }

  // ── 7. Front Hair with Layered Highlights & Soft Bangs ────────────────────
  switch (a.hairStyle) {
    case "buzz":
      rect(8, headY - 1, 12, 3, "h");
      rect(7, headY, 14, 3, "h");
      rect(10, headY, 5, 1, "L");
      break;
    case "short":
      rect(7, headY - 2, 14, 4, "h");
      rect(6, headY + 1, 2, 5, "h");
      rect(20, headY + 1, 2, 5, "H");
      rect(8, headY + 2, 3, 2, "h");
      rect(13, headY + 2, 3, 2, "h");
      rect(18, headY + 2, 2, 2, "H");
      rect(10, headY - 1, 6, 1, "L");
      break;
    case "spiky":
      rect(7, headY - 2, 14, 4, "h");
      rect(7, headY - 4, 2, 2, "h");
      rect(11, headY - 5, 3, 3, "L");
      rect(16, headY - 4, 2, 2, "h");
      rect(19, headY - 3, 2, 2, "H");
      rect(6, headY + 1, 2, 4, "h");
      rect(20, headY + 1, 2, 4, "H");
      rect(9, headY + 2, 2, 2, "h");
      rect(14, headY + 2, 3, 2, "h");
      break;
    case "bob":
      rect(7, headY - 2, 14, 4, "h");
      rect(5, headY + 1, 3, 10, "h");
      rect(20, headY + 1, 3, 10, "H");
      rect(8, headY + 2, 12, 2, "h");
      rect(10, headY - 1, 7, 1, "L");
      break;
    case "ponytail":
      rect(7, headY - 2, 14, 4, "h");
      rect(6, headY + 1, 2, 6, "h");
      rect(20, headY + 1, 2, 6, "H");
      rect(9, headY + 2, 4, 1, "h");
      rect(10, headY - 1, 6, 1, "L");
      break;
    case "bun":
      rect(11, headY - 5, 6, 3, "h");
      rect(12, headY - 5, 3, 1, "L");
      rect(11, headY - 2, 6, 1, "u");
      rect(7, headY - 2, 14, 4, "h");
      rect(6, headY + 1, 2, 5, "h");
      rect(20, headY + 1, 2, 5, "H");
      break;
    case "curly":
      rect(6, headY - 3, 16, 5, "h");
      rect(5, headY, 3, 8, "h");
      rect(20, headY, 3, 8, "H");
      rect(8, headY - 3, 3, 1, "L");
      rect(14, headY - 3, 3, 1, "L");
      rect(8, headY + 2, 3, 2, "h");
      rect(13, headY + 2, 3, 2, "h");
      rect(17, headY + 2, 3, 2, "H");
      break;
    case "long":
      rect(7, headY - 2, 14, 4, "h");
      rect(5, headY + 1, 3, 13, "h");
      rect(20, headY + 1, 3, 13, "H");
      rect(8, headY + 2, 4, 2, "h");
      rect(16, headY + 2, 4, 2, "H");
      rect(10, headY - 1, 7, 1, "L");
      break;
    case "twintails":
      rect(7, headY - 2, 14, 4, "h");
      rect(6, headY + 1, 2, 6, "h");
      rect(20, headY + 1, 2, 6, "H");
      rect(8, headY + 2, 12, 2, "h");
      rect(10, headY - 1, 6, 1, "L");
      break;
    case "sidepart":
      rect(7, headY - 2, 14, 4, "h");
      rect(6, headY + 1, 2, 6, "h");
      rect(20, headY + 1, 2, 4, "H");
      rect(8, headY + 2, 9, 2, "h");
      rect(9, headY - 1, 7, 1, "L");
      break;
  }

  // ── 8. Face Accessories ───────────────────────────────────────────────────
  if (a.accessory === "glasses") {
    rect(8, headY + 5, 5, 3, "a");
    rect(15, headY + 5, 5, 3, "a");
    rect(9, headY + 6, 3, 1, "w");
    set(10, headY + 6, "k");
    rect(16, headY + 6, 3, 1, "w");
    set(17, headY + 6, "k");
    rect(13, headY + 6, 2, 1, "a");
  } else if (a.accessory === "shades") {
    rect(8, headY + 5, 6, 3, "k");
    rect(14, headY + 5, 6, 3, "k");
    rect(9, headY + 5, 2, 1, "a");
    rect(15, headY + 5, 2, 1, "a");
    rect(13, headY + 5, 2, 1, "a");
  } else if (a.accessory === "earphones") {
    rect(5, headY + 4, 2, 4, "a");
    rect(21, headY + 4, 2, 4, "A");
    rect(7, headY - 3, 14, 1, "a");
  }

  // ── 9. Headwear Layer ─────────────────────────────────────────────────────
  if (a.headwear === "headband") {
    rect(7, headY + 1, 14, 2, "c");
    rect(18, headY + 1, 3, 2, "C");
    rect(13, headY + 1, 2, 1, "w");
  } else if (a.headwear === "cap") {
    rect(7, headY - 3, 14, 4, "c");
    rect(9, headY - 3, 6, 1, "K");
    rect(18, headY - 2, 3, 3, "C");
    rect(8, headY + 1, 15, 2, "C"); // sporty forward brim
    rect(12, headY - 1, 3, 1, "w");
  } else if (a.headwear === "visor") {
    rect(7, headY + 1, 14, 2, "c");
    rect(9, headY + 2, 14, 1, "C");
  } else if (a.headwear === "beanie") {
    rect(8, headY - 4, 12, 5, "c");
    rect(7, headY, 14, 2, "C");
    rect(12, headY - 5, 4, 2, "K");
  } else if (a.headwear === "mascot_hat") {
    rect(7, headY - 3, 14, 4, "r");
    rect(12, headY - 5, 4, 2, "r");
    rect(9, headY - 2, 3, 2, "w"); set(10, headY - 1, "k");
    rect(16, headY - 2, 3, 2, "w"); set(17, headY - 1, "k");
  }

  // ── 10. Crisp 1px Warm Espresso Outline Pass ──────────────────────────────
  const out = grid.map((r) => [...r]);
  for (let y = 0; y < SPRITE_H; y++) {
    for (let x = 0; x < SPRITE_W; x++) {
      if (grid[y][x] !== ".") continue;
      const touches =
        (x > 0 && grid[y][x - 1] !== ".") ||
        (x < SPRITE_W - 1 && grid[y][x + 1] !== ".") ||
        (y > 0 && grid[y - 1][x] !== ".") ||
        (y < SPRITE_H - 1 && grid[y + 1][x] !== ".");
      if (touches) out[y][x] = "o";
    }
  }

  return {
    width: SPRITE_W,
    height: SPRITE_H,
    rows: out.map((r) => r.join("")),
    palette: buildAvatarPalette(a),
  };
}

// ── Legacy compatibility exports ─────────────────────────────────────────────
export const PERSON = renderAvatarPixels({
  skin: "#F6CFA8", hair: "#1F1A18", top: "#FF5F0E", bottom: "#222228", shoes: "#FFFDF7",
}).rows;

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
  return buildAvatarPalette(a);
}

export const MASCOT_PALETTE: Record<string, string> = {
  r: "#E0352B", w: "#ffffff", k: "#111111", m: "#7a1a14", o: "#FF5F0E",
};
