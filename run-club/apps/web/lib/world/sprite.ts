/**
 * Modular 20x26 chibi pixel-art paper-doll character system (inspired by Kairosoft + SnowHex),
 * shared across the Character Creator (/create), Profile Avatar (SVG), and World (Phaser 3 textures).
 * Fully backward-compatible with legacy 5-color Avatar records ({ skin, hair, top, bottom, shoes }).
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
    { id: "tee", label: "Kaos" },
    { id: "higround", label: "Kaos Run Club" },
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
  skin: ["#FFE0C4", "#F4CCA4", "#E2AE82", "#C48A5E", "#9C6542", "#6E432A"],
  hair: ["#1F1A18", "#4A2F1E", "#7A4A2A", "#B86B35", "#D9A84E", "#C93B2B", "#2E3A8C", "#5B4B8A", "#2E7D5B", "#E8E2D6"],
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
    skin: validHex(a.skin, "#F4CCA4"),
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

export const SPRITE_W = 20;
export const SPRITE_H = 26;

export const ANIM_FRAMES: Record<AnimPose, number> = {
  idle: 2,
  walk: 4,
  run: 4,
  sit: 2,
  stretch: 2,
  yoga: 2,
};

export interface RenderedSprite {
  width: number;
  height: number;
  rows: string[];
  palette: Record<string, string>;
}

/** Build palette with automatic highlight + shadow shades for crisp 16-bit depth. */
export function buildAvatarPalette(raw: AvatarColors): Record<string, string> {
  const a = normalizeAvatar(raw);
  return {
    o: "#1E1716", // crisp pixel outline
    w: "#FFFFFF",
    k: "#181414", // eyes / pupils
    p: "#E88B84", // subtle blush
    m: shadeHex(a.skin, 0.72), // mouth / skin shadow
    s: a.skin,
    S: shadeHex(a.skin, 0.85),
    h: a.hair,
    H: shadeHex(a.hair, 0.72),
    L: shadeHex(a.hair, 1.22),
    t: a.top,
    T: shadeHex(a.top, 0.75),
    u: a.top === "#FF5F0E" ? "#FFFDF7" : "#FF5F0E", // logo/accent stripe
    b: a.bottom,
    B: shadeHex(a.bottom, 0.74),
    f: a.shoes,
    F: shadeHex(a.shoes, 0.72),
    c: a.headwearColor,
    C: shadeHex(a.headwearColor, 0.74),
    a: a.accessoryColor,
    A: shadeHex(a.accessoryColor, 0.72),
    r: "#E0352B", // mascot red for mascot_hat
    y: "#F7D046", // gold star/medal
  };
}

/**
 * Draw a 20x26 modular chibi pixel character for any animation pose and frame.
 * Every pixel is placed onto a crisp integer grid and auto-outlined with `o` so characters pop
 * cleanly against isometric floors and buildings just like Kairosoft & SnowHex sprites.
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

  // Vertical bobbing & posture offset
  const bob =
    pose === "walk" ? (f % 2 === 1 ? -1 : 0) :
    pose === "run" ? (f % 2 === 1 ? -2 : 0) :
    pose === "idle" ? (f === 1 ? 1 : 0) :
    pose === "sit" ? 3 :
    pose === "stretch" ? (f === 1 ? -1 : 0) :
    pose === "yoga" ? (f === 1 ? -1 : 0) : 0;

  const headY = 4 + bob;
  const torsoY = 13 + bob;
  const hipY = 18 + bob;

  // ── 1. Back hair layer (for long / ponytail / twintails / curly) ──────────
  if (a.hairStyle === "long") {
    rect(4, headY + 3, 12, 10, "H");
    rect(5, headY + 4, 10, 8, "h");
  } else if (a.hairStyle === "ponytail") {
    rect(13, headY + 3, 3, 6, "H");
    rect(14, headY + 4, 2, 4, "h");
    set(13, headY + 3, "u");
  } else if (a.hairStyle === "twintails") {
    rect(3, headY + 4, 2, 7, "H");
    rect(15, headY + 4, 2, 7, "H");
    set(4, headY + 4, "u");
    set(15, headY + 4, "u");
  } else if (a.hairStyle === "curly") {
    rect(4, headY + 1, 12, 8, "H");
  }

  // ── 2. Legs, shorts/pants & shoes (animated per pose!) ────────────────────
  const drawLegs = () => {
    const longPants = a.bottomStyle === "pants" || a.bottomStyle === "joggers";
    const drawLeg = (lx: number, ly: number, len: number, shoeOffY = 0) => {
      for (let i = 0; i < len; i++) {
        const isPants = longPants ? i < len - 1 : i < 2;
        set(lx, ly + i, isPants ? "b" : "s");
        set(lx + 1, ly + i, isPants ? "B" : "S");
      }
      // Shoe
      set(lx, ly + len - 1 + shoeOffY, "f");
      set(lx + 1, ly + len - 1 + shoeOffY, "f");
      set(lx + 2, ly + len - 1 + shoeOffY, "F");
    };

    if (pose === "sit") {
      // Seated tucked forward legs
      rect(6, hipY, 8, 2, "b");
      rect(7, hipY + 2, 3, 2, longPants ? "b" : "s");
      rect(11, hipY + 2, 3, 2, longPants ? "B" : "S");
      rect(7, hipY + 3, 3, 2, "f");
      rect(11, hipY + 3, 3, 2, "F");
      return;
    }

    if (pose === "yoga") {
      // Tree pose: left leg grounded, right knee bent out to side!
      rect(6, hipY, 8, 2, "b");
      drawLeg(8, hipY + 1, 6);
      // Bent right leg resting against knee
      set(11, hipY + 1, "b");
      set(12, hipY + 2, longPants ? "b" : "s");
      set(13, hipY + 2, longPants ? "B" : "s");
      set(11, hipY + 3, "f");
      set(12, hipY + 3, "F");
      return;
    }

    // Waistband
    rect(6, hipY, 8, 2, "b");
    if (a.bottomStyle === "run_shorts") {
      set(6, hipY + 1, "u");
      set(13, hipY + 1, "u");
    }

    if (pose === "walk") {
      if (f === 0) {
        drawLeg(6, hipY + 1, 5);
        drawLeg(11, hipY + 1, 4);
      } else if (f === 2) {
        drawLeg(7, hipY + 1, 4);
        drawLeg(12, hipY + 1, 5);
      } else {
        drawLeg(7, hipY + 1, 5);
        drawLeg(11, hipY + 1, 5);
      }
    } else if (pose === "run") {
      if (f === 0) {
        drawLeg(5, hipY + 1, 5);
        drawLeg(12, hipY, 4);
      } else if (f === 2) {
        drawLeg(6, hipY, 4);
        drawLeg(13, hipY + 1, 5);
      } else {
        drawLeg(7, hipY + 1, 5);
        drawLeg(11, hipY + 1, 5);
      }
    } else {
      drawLeg(7, hipY + 1, 5);
      drawLeg(11, hipY + 1, 5);
    }
  };
  drawLegs();

  // ── 3. Torso & Top Style ──────────────────────────────────────────────────
  rect(6, torsoY, 8, 5, "t");
  rect(12, torsoY, 2, 5, "T"); // right-side shading
  if (a.topStyle === "higround") {
    // Bold Higround chest stripe / logo block
    rect(7, torsoY + 1, 6, 2, "u");
    set(9, torsoY + 1, "t");
  } else if (a.topStyle === "hoodie") {
    rect(7, torsoY, 6, 1, "T"); // hood collar
    rect(8, torsoY + 3, 4, 2, "T"); // kangaroo pocket
    set(9, torsoY + 1, "w");
    set(10, torsoY + 1, "w");
  } else if (a.topStyle === "jacket") {
    rect(9, torsoY, 2, 5, "w"); // open zip/inner tee
    set(8, torsoY + 2, "T");
    set(11, torsoY + 2, "T");
  } else if (a.topStyle === "polo") {
    set(8, torsoY, "w");
    set(11, torsoY, "w");
    set(9, torsoY + 1, "w");
  } else if (a.topStyle === "singlet") {
    set(6, torsoY, "s");
    set(13, torsoY, "S");
    rect(8, torsoY, 4, 1, "s"); // scoop neck
  }

  // ── 4. Arms (animated per pose!) ──────────────────────────────────────────
  const sleeve = a.topStyle === "singlet" ? "s" : "t";
  if (pose === "stretch") {
    // Arms raised overhead stretching!
    const reach = f === 1 ? -1 : 0;
    rect(4, torsoY - 4 + reach, 2, 5, "s");
    rect(14, torsoY - 4 - reach, 2, 5, "S");
    set(5, torsoY, sleeve);
    set(14, torsoY, sleeve);
  } else if (pose === "yoga") {
    // Graceful raised V / prayer arms overhead
    rect(4, torsoY - 3, 2, 3, "s");
    rect(14, torsoY - 3, 2, 3, "S");
    set(5, torsoY - 4, "s");
    set(14, torsoY - 4, "S");
    set(5, torsoY, sleeve);
    set(14, torsoY, sleeve);
  } else if (pose === "run") {
    const swing = f === 0 ? -1 : f === 2 ? 1 : 0;
    set(4, torsoY + 1 + swing, sleeve);
    set(4, torsoY + 2 + swing, "s");
    set(5, torsoY + 2 + swing, "s");
    set(15, torsoY + 1 - swing, sleeve);
    set(15, torsoY + 2 - swing, "S");
    set(14, torsoY + 2 - swing, "S");
  } else if (pose === "walk") {
    const swing = f === 0 ? 1 : f === 2 ? -1 : 0;
    rect(4, torsoY + 1 + (swing > 0 ? 1 : 0), 2, 2, sleeve);
    set(4, torsoY + 3 + (swing > 0 ? 1 : 0), "s");
    rect(14, torsoY + 1 + (swing < 0 ? 1 : 0), 2, 2, sleeve);
    set(15, torsoY + 3 + (swing < 0 ? 1 : 0), "S");
  } else {
    rect(4, torsoY + 1, 2, 2, sleeve);
    rect(4, torsoY + 3, 2, 2, "s");
    rect(14, torsoY + 1, 2, 2, sleeve);
    rect(14, torsoY + 3, 2, 2, "S");
  }

  // ── 5. Torso Accessories (Hydration Vest / Medal) ─────────────────────────
  if (a.accessory === "vest") {
    rect(6, torsoY, 2, 4, "a");
    rect(12, torsoY, 2, 4, "A");
    rect(7, torsoY + 2, 6, 1, "A");
    set(7, torsoY + 1, "w"); // water flask cap
    set(12, torsoY + 1, "w");
  } else if (a.accessory === "medal") {
    set(8, torsoY, "u");
    set(11, torsoY, "u");
    set(9, torsoY + 1, "u");
    set(10, torsoY + 1, "u");
    rect(9, torsoY + 2, 2, 2, "y");
  }

  // ── 6. Head & Face (big cozy SnowHex/Kairosoft chibi head) ──────────────
  rect(5, headY + 1, 10, 8, "s");
  rect(6, headY, 8, 9, "s");
  // Subtle jaw shading + warm blush
  rect(13, headY + 2, 2, 6, "S");
  set(6, headY + 6, "p");
  set(13, headY + 6, "p");
  // Smile
  set(9, headY + 7, "m");
  set(10, headY + 7, "m");

  // Eyes
  if (a.eyeStyle === "classic") {
    rect(7, headY + 4, 2, 2, "k");
    set(7, headY + 4, "w");
    rect(11, headY + 4, 2, 2, "k");
    set(11, headY + 4, "w");
  } else if (a.eyeStyle === "happy") {
    set(7, headY + 5, "k"); set(8, headY + 4, "k"); set(9, headY + 5, "k");
    set(11, headY + 5, "k"); set(12, headY + 4, "k"); set(13, headY + 5, "k");
  } else if (a.eyeStyle === "cool") {
    rect(7, headY + 4, 2, 1, "H");
    rect(7, headY + 5, 2, 1, "k");
    rect(11, headY + 4, 2, 1, "H");
    rect(11, headY + 5, 2, 1, "k");
  } else if (a.eyeStyle === "wide") {
    rect(6, headY + 4, 3, 2, "w");
    rect(7, headY + 4, 2, 2, "k");
    set(7, headY + 4, "w");
    rect(11, headY + 4, 3, 2, "w");
    rect(11, headY + 4, 2, 2, "k");
    set(11, headY + 4, "w");
  } else if (a.eyeStyle === "wink") {
    rect(7, headY + 4, 2, 2, "k");
    set(7, headY + 4, "w");
    rect(11, headY + 5, 2, 1, "k");
  }

  // ── 7. Front Hair Layer (10 distinct silhouettes!) ────────────────────────
  switch (a.hairStyle) {
    case "buzz":
      rect(6, headY - 1, 8, 2, "h");
      rect(5, headY, 10, 2, "h");
      set(7, headY, "L");
      break;
    case "short":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 3, "h");
      rect(14, headY + 1, 2, 3, "H");
      set(7, headY + 2, "h");
      set(11, headY + 2, "h");
      rect(7, headY, 3, 1, "L");
      break;
    case "spiky":
      rect(5, headY - 1, 10, 3, "h");
      set(5, headY - 2, "h"); set(8, headY - 3, "L"); set(11, headY - 2, "h"); set(14, headY - 2, "H");
      set(4, headY + 1, "h"); set(15, headY + 1, "H");
      set(7, headY + 2, "h"); set(10, headY + 2, "h"); set(13, headY + 2, "H");
      break;
    case "bob":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 7, "h");
      rect(14, headY + 1, 2, 7, "H");
      rect(6, headY + 2, 8, 1, "h");
      rect(7, headY, 4, 1, "L");
      break;
    case "ponytail":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 4, "h");
      rect(14, headY + 1, 2, 4, "H");
      rect(7, headY, 4, 1, "L");
      break;
    case "bun":
      rect(8, headY - 3, 4, 2, "h");
      set(9, headY - 3, "L");
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 4, "h");
      rect(14, headY + 1, 2, 4, "H");
      break;
    case "curly":
      rect(5, headY - 2, 10, 4, "h");
      rect(4, headY, 2, 6, "h");
      rect(14, headY, 2, 6, "H");
      set(6, headY - 2, "L"); set(10, headY - 2, "L"); set(13, headY - 1, "H");
      set(6, headY + 2, "h"); set(9, headY + 2, "h"); set(12, headY + 2, "H");
      break;
    case "long":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 9, "h");
      rect(14, headY + 1, 2, 9, "H");
      rect(6, headY + 2, 3, 1, "h");
      rect(11, headY + 2, 3, 1, "h");
      rect(7, headY, 4, 1, "L");
      break;
    case "twintails":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 4, "h");
      rect(14, headY + 1, 2, 4, "H");
      rect(6, headY + 2, 8, 1, "h");
      rect(7, headY, 4, 1, "L");
      break;
    case "sidepart":
      rect(5, headY - 1, 10, 3, "h");
      rect(4, headY + 1, 2, 4, "h");
      rect(14, headY + 1, 2, 3, "H");
      rect(6, headY + 2, 6, 1, "h");
      rect(6, headY, 5, 1, "L");
      break;
  }

  // ── 8. Face Accessories (Glasses / Shades / Earphones) ────────────────────
  if (a.accessory === "glasses") {
    rect(6, headY + 4, 3, 2, "a");
    rect(11, headY + 4, 3, 2, "a");
    set(7, headY + 4, "w"); set(7, headY + 5, "k");
    set(12, headY + 4, "w"); set(12, headY + 5, "k");
    rect(9, headY + 4, 2, 1, "a");
  } else if (a.accessory === "shades") {
    rect(6, headY + 4, 4, 2, "k");
    rect(10, headY + 4, 4, 2, "k");
    set(7, headY + 4, "a");
    set(11, headY + 4, "a");
    rect(9, headY + 4, 2, 1, "a");
  } else if (a.accessory === "earphones") {
    rect(4, headY + 3, 1, 3, "a");
    rect(15, headY + 3, 1, 3, "A");
    rect(5, headY - 2, 10, 1, "a");
  }

  // ── 9. Headwear Layer ─────────────────────────────────────────────────────
  if (a.headwear === "headband") {
    rect(5, headY + 1, 10, 2, "c");
    rect(13, headY + 1, 2, 2, "C");
    set(9, headY + 1, "w");
  } else if (a.headwear === "cap") {
    rect(5, headY - 2, 10, 3, "c");
    rect(13, headY - 1, 2, 2, "C");
    rect(6, headY + 1, 11, 1, "C"); // forward brim
    set(9, headY - 1, "w");
  } else if (a.headwear === "visor") {
    rect(5, headY + 1, 10, 1, "c");
    rect(6, headY + 2, 11, 1, "C");
  } else if (a.headwear === "beanie") {
    rect(6, headY - 3, 8, 4, "c");
    rect(5, headY, 10, 2, "C");
    set(9, headY - 4, "c"); set(10, headY - 4, "c");
  } else if (a.headwear === "mascot_hat") {
    rect(5, headY - 2, 10, 3, "r");
    set(9, headY - 3, "r"); set(10, headY - 3, "r");
    set(7, headY - 1, "w"); set(8, headY - 1, "k");
    set(11, headY - 1, "w"); set(12, headY - 1, "k");
  }

  // ── 10. Crisp 1px Pixel Outline Pass (Kairosoft / SnowHex signature) ──────
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
  skin: "#F4CCA4", hair: "#1F1A18", top: "#FF5F0E", bottom: "#222228", shoes: "#FFFDF7",
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
