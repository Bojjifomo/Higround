/**
 * High-detail 36x48 chibi pixel-art paper-doll character system (v2 — Roadmap v4 Fase B).
 * Smooth, readable silhouettes shared across Character Creator (/create), Profile Avatar (SVG),
 * Remotion IG Story, and World (Phaser 3 textures).
 *
 * Backward-compatible with legacy 5-color and v1 avatar JSONB stored in Supabase `profiles.avatar`.
 */

export type HairStyleId =
  | "short" | "spiky" | "bob" | "ponytail" | "bun" | "curly" | "long" | "twintails" | "sidepart" | "buzz";

export type EyeStyleId =
  | "classic" | "happy" | "sipit" | "wide" | "wink"
  | "angry" | "pout" | "sleepy" | "poker" | "panic";

export type TopStyleId = "singlet" | "tee" | "longsleeve" | "jacket" | "polo";
export type BottomStyleId = "pants" | "shorts" | "underwear";
export type ShoeStyleId = "sneakers" | "flipflops" | "barefoot" | "ice_skates" | "ice_climbing" | "football";
export type HeadwearId =
  | "none" | "cap" | "headband" | "beanie" | "mascot_hat"
  | "crown" | "helmet" | "propeller" | "mask_luchador" | "mask_cat";
export type AccessoryId = "none" | "glasses" | "medal";
export type AnimPose = "idle" | "walk" | "run" | "sit" | "stretch" | "yoga";

export interface AvatarColors {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  hairStyle?: HairStyleId | string;
  eyeStyle?: EyeStyleId | string;
  topStyle?: TopStyleId | string;
  bottomStyle?: BottomStyleId | string;
  shoeStyle?: ShoeStyleId | string;
  headwear?: HeadwearId | string;
  headwearColor?: string;
  accessory?: AccessoryId | string;
  accessoryColor?: string;
  customized?: boolean;
}

export interface NormalizedAvatar {
  skin: string;
  hair: string;
  top: string;
  bottom: string;
  shoes: string;
  hairStyle: HairStyleId;
  eyeStyle: EyeStyleId;
  topStyle: TopStyleId;
  bottomStyle: BottomStyleId;
  shoeStyle: ShoeStyleId;
  headwear: HeadwearId;
  headwearColor: string;
  accessory: AccessoryId;
  accessoryColor: string;
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
    { id: "sipit", label: "Sipit" },
    { id: "wide", label: "Berbinar" },
    { id: "wink", label: "Kedip" },
    { id: "angry", label: "Marah / Kesal" },
    { id: "pout", label: "Cemberut" },
    { id: "sleepy", label: "Ngantuk" },
    { id: "poker", label: "Datar" },
    { id: "panic", label: "Panik" },
  ] as const,
  topStyle: [
    { id: "singlet", label: "Singlet" },
    { id: "tee", label: "Kaos Pendek" },
    { id: "longsleeve", label: "Lengan Panjang" },
    { id: "jacket", label: "Jaket" },
    { id: "polo", label: "Polo" },
  ] as const,
  bottomStyle: [
    { id: "pants", label: "Panjang" },
    { id: "shorts", label: "Pendek" },
    { id: "underwear", label: "Dalaman" },
  ] as const,
  shoeStyle: [
    { id: "sneakers", label: "Sepatu Biasa" },
    { id: "flipflops", label: "Sendal Jepit" },
    { id: "barefoot", label: "Nyeker" },
    { id: "ice_skates", label: "Ice Skating" },
    { id: "ice_climbing", label: "Manjat Es" },
    { id: "football", label: "Sepatu Bola" },
  ] as const,
  headwear: [
    { id: "none", label: "Polos" },
    { id: "cap", label: "Topi Lari" },
    { id: "headband", label: "Headband" },
    { id: "beanie", label: "Beanie" },
    { id: "mascot_hat", label: "Topi Maskot" },
    { id: "crown", label: "Mahkota" },
    { id: "helmet", label: "Helm" },
    { id: "propeller", label: "Baling-Baling" },
    { id: "mask_luchador", label: "Topeng Luchador" },
    { id: "mask_cat", label: "Topeng Kucing" },
  ] as const,
  accessory: [
    { id: "none", label: "Polos" },
    { id: "glasses", label: "Kacamata Biasa" },
    { id: "medal", label: "Medali" },
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

const LEGACY_EYE: Record<string, EyeStyleId> = { cool: "sipit" };
const LEGACY_TOP: Record<string, TopStyleId> = { higround: "tee", hoodie: "jacket" };
const LEGACY_BOTTOM: Record<string, BottomStyleId> = { run_shorts: "shorts", joggers: "pants" };
const LEGACY_HEADWEAR: Record<string, HeadwearId> = { visor: "cap" };
const LEGACY_ACCESSORY: Record<string, AccessoryId> = { shades: "glasses", vest: "none", earphones: "none" };

const validId = <T extends string>(
  val: string | undefined,
  list: readonly { id: T }[],
  fallback: T,
  legacy?: Record<string, T>,
): T => {
  if (!val) return fallback;
  const mapped = legacy?.[val] ?? val;
  return list.some((x) => x.id === mapped) ? (mapped as T) : fallback;
};

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
    eyeStyle: validId(a.eyeStyle, AVATAR_OPTIONS.eyeStyle, "classic", LEGACY_EYE),
    topStyle: validId(a.topStyle, AVATAR_OPTIONS.topStyle, "tee", LEGACY_TOP),
    bottomStyle: validId(a.bottomStyle, AVATAR_OPTIONS.bottomStyle, "shorts", LEGACY_BOTTOM),
    shoeStyle: validId(a.shoeStyle, AVATAR_OPTIONS.shoeStyle, "sneakers"),
    headwear: validId(a.headwear, AVATAR_OPTIONS.headwear, "none", LEGACY_HEADWEAR),
    headwearColor: validHex(a.headwearColor, "#FF5F0E"),
    accessory: validId(a.accessory, AVATAR_OPTIONS.accessory, "none", LEGACY_ACCESSORY),
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
    shoeStyle: pick(AVATAR_OPTIONS.shoeStyle).id,
    headwear: rng() < 0.6 ? pick(AVATAR_OPTIONS.headwear).id : "none",
    headwearColor: pick(AVATAR_PALETTES.headwearColor),
    accessory: rng() < 0.45 ? pick(AVATAR_OPTIONS.accessory).id : "none",
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

export const SPRITE_W = 36;
export const SPRITE_H = 48;

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
    o: "#241917", // warm espresso pixel outline
    w: "#FFFFFF",
    k: "#1E1615", // pupil / studs
    e: "#49322B", // iris/lash
    p: "#F0958E", // warm rosy blush / cat nose
    m: shadeHex(a.skin, 0.62), // mouth / nose shadow
    s: a.skin,
    S: shadeHex(a.skin, 0.85),
    D: shadeHex(a.skin, 0.74),
    h: a.hair,
    H: shadeHex(a.hair, 0.72),
    L: shadeHex(a.hair, 1.24),
    t: a.top,
    T: shadeHex(a.top, 0.72),
    Q: shadeHex(a.top, 1.18),
    u: a.top.toUpperCase() === "#FF5F0E" ? "#FFFDF7" : "#FF5F0E",
    b: a.bottom,
    B: shadeHex(a.bottom, 0.68),
    J: shadeHex(a.bottom, 1.18),
    f: a.shoes,
    F: shadeHex(a.shoes, 0.72),
    c: a.headwearColor,
    C: shadeHex(a.headwearColor, 0.72),
    K: shadeHex(a.headwearColor, 1.22),
    a: a.accessoryColor,
    A: shadeHex(a.accessoryColor, 0.72),
    r: "#E0352B", // mascot red / anger vein / ruby
    y: "#F7D046", // gold crown / medal / propeller
    Y: "#C89D1F", // dark gold shading
    g: "#C98D59", // coffee cup sleeve
    z: "#D6E1EC", // gleaming steel blade / crampon / glass glint
    Z: "#6E7B89", // dark steel shadow
    i: "#4DBDF0", // panic sweat blue
  };
}

const HAT_COVERS_CROWN = new Set<HeadwearId>([
  "cap", "beanie", "mascot_hat", "helmet", "propeller", "mask_luchador", "mask_cat",
]);
const FULL_MASK = new Set<HeadwearId>(["mask_luchador", "mask_cat"]);

/**
 * Draw a smooth 36x48 chibi pixel character with crisp silhouettes for every top, bottom, shoe, face, and hat/mask.
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

  const headY = 10 + bob;
  const neckY = 24 + bob;
  const torsoY = 25 + bob;
  const hipY = 35 + bob;
  const hidesTopHair = HAT_COVERS_CROWN.has(a.headwear);
  const isFullMask = FULL_MASK.has(a.headwear);

  // ── 1. Back Hair Volume ───────────────────────────────────────────────────
  if (!isFullMask) {
    if (a.hairStyle === "long") {
      rect(8, headY + 4, 20, 19, "H");
      rect(9, headY + 5, 18, 17, "h");
    } else if (a.hairStyle === "ponytail") {
      rect(25, headY + 4, 5, 12, "H");
      rect(26, headY + 5, 4, 10, "h");
      rect(25, headY + 4, 2, 2, "u");
    } else if (a.hairStyle === "twintails") {
      rect(5, headY + 6, 4, 14, "H");
      rect(27, headY + 6, 4, 14, "H");
      rect(6, headY + 7, 3, 11, "h");
      rect(27, headY + 7, 3, 11, "h");
      rect(6, headY + 6, 3, 1, "u");
      rect(27, headY + 6, 3, 1, "u");
    } else if (a.hairStyle === "curly") {
      rect(7, headY + 1, 22, 16, "H");
      rect(8, headY + 2, 20, 14, "h");
    }
  }

  // ── 2. Legs, Bottoms (Panjang / Pendek / Dalaman) & 6 Distinct Shoe Styles ─
  const drawFoot = (fx: number, fy: number) => {
    // fx is left edge of 4px leg; foot sits around fx-1 .. fx+4, fy is ankle top
    switch (a.shoeStyle) {
      case "barefoot": {
        rect(fx, fy, 4, 2, "s");
        rect(fx - 1, fy + 1, 5, 2, "s");
        set(fx + 3, fy + 1, "S");
        set(fx + 3, fy + 2, "S");
        set(fx, fy + 2, "D"); // toe separation
        set(fx + 2, fy + 2, "D");
        break;
      }
      case "flipflops": {
        // Bare foot + colored flip-flop footbed + Y-strap across top
        rect(fx, fy, 4, 2, "s");
        rect(fx - 1, fy + 1, 5, 1, "s");
        rect(fx - 1, fy + 2, 6, 1, "f"); // flip-flop sole
        set(fx + 4, fy + 2, "F");
        // Clear Y-strap
        set(fx, fy + 1, "f");
        set(fx + 1, fy, "f");
        set(fx + 2, fy + 1, "f");
        break;
      }
      case "ice_skates": {
        // High skating boot + silver steel blade underneath!
        rect(fx, fy - 2, 4, 3, "f");
        rect(fx - 1, fy, 5, 2, "f");
        set(fx + 3, fy, "F");
        set(fx + 1, fy - 1, "w"); // laces
        set(fx + 1, fy, "w");
        // Twin blade mounts + gleaming blade
        set(fx, fy + 2, "Z");
        set(fx + 3, fy + 2, "Z");
        rect(fx - 2, fy + 3, 7, 1, "z");
        set(fx - 2, fy + 2, "w"); // curved toe tip
        rect(fx - 1, fy + 3, 4, 1, "w");
        break;
      }
      case "ice_climbing": {
        // Chunky mountaineering boot + metallic crampon spikes!
        rect(fx, fy - 1, 4, 2, "F");
        rect(fx - 1, fy, 6, 2, "f");
        set(fx + 4, fy, "F");
        rect(fx - 1, fy + 2, 6, 1, "o"); // heavy tread
        // Sharp metallic crampon spikes pointing down & front
        set(fx - 2, fy + 2, "z");
        set(fx - 1, fy + 3, "z");
        set(fx + 1, fy + 3, "Z");
        set(fx + 3, fy + 3, "z");
        set(fx + 4, fy + 3, "Z");
        break;
      }
      case "football": {
        // Sleek soccer cleat with contrast stripes + black studs (pul)!
        rect(fx - 1, fy, 6, 2, "f");
        set(fx + 4, fy, "F");
        set(fx + 1, fy, "w");
        set(fx + 2, fy + 1, "w");
        rect(fx - 1, fy + 2, 6, 1, "F");
        // Unmistakable cleats/studs underneath
        set(fx - 1, fy + 3, "k");
        set(fx + 1, fy + 3, "k");
        set(fx + 4, fy + 3, "k");
        break;
      }
      case "sneakers":
      default: {
        rect(fx - 1, fy, 6, 2, "f");
        set(fx + 4, fy, "F");
        rect(fx, fy, 2, 1, "w"); // laces / stripe
        rect(fx - 1, fy + 2, 6, 1, "w"); // thick white sneaker sole
        break;
      }
    }
  };

  const drawLeg = (lx: number, ly: number, len: number) => {
    for (let i = 0; i < len; i++) {
      const covered =
        a.bottomStyle === "pants" ? i < len :
        a.bottomStyle === "shorts" ? i < Math.ceil(len * 0.48) :
        false; // underwear: legs completely bare!
      const isCuff = a.bottomStyle === "pants" && i === len - 1;
      const isShortsHem = a.bottomStyle === "shorts" && i === Math.ceil(len * 0.48) - 1;
      const cMain = covered ? (isCuff || isShortsHem ? "B" : "b") : "s";
      const cHi = covered ? (isCuff || isShortsHem ? "b" : "J") : "s";
      const cSh = covered ? "B" : "S";
      set(lx, ly + i, cHi);
      set(lx + 1, ly + i, cMain);
      set(lx + 2, ly + i, cMain);
      set(lx + 3, ly + i, cSh);
    }
    drawFoot(lx, ly + len - 1);
  };

  const drawHips = () => {
    if (a.bottomStyle === "underwear") {
      // Crisp white elastic waistband + brief V-cut at hips!
      rect(12, hipY, 12, 1, "w");
      rect(12, hipY + 1, 12, 2, "b");
      rect(14, hipY + 3, 8, 1, "b");
      rect(22, hipY + 1, 2, 2, "B");
      rect(16, hipY + 1, 4, 1, "J");
    } else {
      rect(11, hipY, 14, 1, "B"); // clear waist seam
      rect(11, hipY + 1, 14, 2, "b");
      rect(12, hipY + 1, 3, 2, "J");
      rect(22, hipY + 1, 3, 2, "B");
    }
  };

  if (pose === "sit") {
    drawHips();
    const sitLegC = a.bottomStyle === "pants" ? "b" : "s";
    const sitLegS = a.bottomStyle === "pants" ? "B" : "S";
    rect(11, hipY + 3, 5, 3, sitLegC);
    rect(20, hipY + 3, 5, 3, sitLegS);
    if (a.bottomStyle === "shorts") {
      rect(11, hipY + 3, 5, 1, "b");
      rect(20, hipY + 3, 5, 1, "B");
    }
    drawFoot(11, hipY + 5);
    drawFoot(20, hipY + 5);
  } else if (pose === "yoga") {
    drawHips();
    drawLeg(14, hipY + 2, 8);
    // Bent right knee out in Tree Pose
    const thighC = a.bottomStyle === "underwear" ? "s" : "b";
    rect(19, hipY + 2, 5, 2, thighC);
    rect(22, hipY + 3, 3, 2, a.bottomStyle === "pants" ? "b" : "s");
    drawFoot(20, hipY + 4);
  } else {
    drawHips();
    if (pose === "walk") {
      if (f === 0) { drawLeg(11, hipY + 2, 8); drawLeg(21, hipY + 2, 6); }
      else if (f === 2) { drawLeg(12, hipY + 2, 6); drawLeg(21, hipY + 2, 8); }
      else { drawLeg(12, hipY + 2, 8); drawLeg(20, hipY + 2, 8); }
    } else if (pose === "run") {
      if (f === 0) { drawLeg(9, hipY + 2, 8); drawLeg(22, hipY + 1, 6); }
      else if (f === 2) { drawLeg(11, hipY + 1, 6); drawLeg(23, hipY + 2, 8); }
      else { drawLeg(12, hipY + 2, 7); drawLeg(20, hipY + 2, 7); }
    } else {
      drawLeg(12, hipY + 2, 8);
      drawLeg(20, hipY + 2, 8);
    }
  }

  // ── 3. Neck & Torso — 5 Unmistakably Distinct Top Silhouettes ─────────────
  rect(15, neckY, 6, 2, "S");
  rect(16, neckY, 4, 1, "s");

  if (a.topStyle === "jacket") {
    // Wider boxy jacket silhouette + standing collar + white inner shirt + center zipper + side pockets!
    rect(10, torsoY, 16, 10, "t");
    rect(11, torsoY, 3, 9, "Q");
    rect(23, torsoY, 3, 10, "T");
    // Standing collar
    rect(13, torsoY - 1, 3, 2, "T");
    rect(20, torsoY - 1, 3, 2, "T");
    // Inner white shirt & zipper framing
    rect(17, torsoY, 2, 10, "w");
    rect(16, torsoY + 1, 1, 9, "T");
    rect(19, torsoY + 1, 1, 9, "T");
    // Side pockets
    rect(11, torsoY + 6, 4, 2, "T");
    rect(21, torsoY + 6, 4, 2, "T");
    // Bottom ribbed hem
    rect(10, torsoY + 9, 16, 1, "T");
  } else if (a.topStyle === "singlet") {
    // Athletic singlet: bare skin shoulders + deep U-neck + crisp contrast trim!
    rect(12, torsoY + 1, 12, 9, "t");
    rect(13, torsoY + 1, 2, 8, "Q");
    rect(22, torsoY + 1, 2, 9, "T");
    // Straps
    rect(13, torsoY, 2, 2, "t");
    rect(21, torsoY, 2, 2, "t");
    // Deep bare-skin U-scoop neck
    rect(15, torsoY, 6, 3, "s");
    rect(16, torsoY + 3, 4, 1, "u"); // contrast collar trim
    set(15, torsoY + 2, "u");
    set(20, torsoY + 2, "u");
    // Armhole contrast trim
    rect(12, torsoY + 1, 1, 3, "u");
    rect(23, torsoY + 1, 1, 3, "u");
    rect(12, torsoY + 9, 12, 1, "T");
  } else if (a.topStyle === "polo") {
    // Classic polo: crisp white folded collar wings + 2-button placket!
    rect(11, torsoY, 14, 10, "t");
    rect(12, torsoY + 1, 3, 8, "Q");
    rect(22, torsoY, 3, 10, "T");
    // Folded white collar wings
    rect(13, torsoY, 4, 2, "w");
    rect(19, torsoY, 4, 2, "w");
    set(14, torsoY + 2, "w");
    set(21, torsoY + 2, "w");
    // Center placket + 2 dark buttons
    rect(17, torsoY + 1, 2, 4, "w");
    set(17, torsoY + 2, "o");
    set(17, torsoY + 4, "o");
    rect(11, torsoY + 9, 14, 1, "T");
  } else if (a.topStyle === "longsleeve") {
    // Clean long-sleeve crewneck with contrast chest band
    rect(11, torsoY, 14, 10, "t");
    rect(12, torsoY + 1, 3, 8, "Q");
    rect(22, torsoY, 3, 10, "T");
    rect(15, torsoY, 6, 1, "T"); // crewneck rib
    rect(11, torsoY + 8, 14, 2, "T");
    rect(11, torsoY + 9, 14, 1, "w"); // crisp hem stripe
  } else {
    // tee (Kaos Pendek): classic crew tee with clean chest accent & hem
    rect(11, torsoY, 14, 10, "t");
    rect(12, torsoY + 1, 3, 8, "Q");
    rect(22, torsoY, 3, 10, "T");
    rect(15, torsoY, 6, 1, "T");
    rect(13, torsoY + 3, 10, 2, "u"); // sporty chest bar so tee pops!
    rect(11, torsoY + 9, 14, 1, "T");
  }

  // ── 4. Arms (Sleeves Clearly Match Singlet / Short / Long / Jacket / Polo!)
  const isLongSleeve = a.topStyle === "longsleeve" || a.topStyle === "jacket";
  const isNoSleeve = a.topStyle === "singlet";
  const upperArmL = isNoSleeve ? "s" : "t";
  const upperArmR = isNoSleeve ? "S" : "T";
  const lowerArmL = isLongSleeve ? "t" : "s";
  const lowerArmR = isLongSleeve ? "T" : "S";

  const drawArmVertical = (ax: number, ay: number, isRight: boolean) => {
    const up = isRight ? upperArmR : upperArmL;
    const lo = isRight ? lowerArmR : lowerArmL;
    rect(ax, ay, 3, 4, up);
    if (a.topStyle === "polo") rect(ax, ay + 3, 3, 1, "w"); // polo sleeve cuff
    rect(ax, ay + 4, 3, 3, lo);
    if (isLongSleeve) rect(ax, ay + 6, 3, 1, "w"); // longsleeve / jacket wrist cuff!
    rect(ax, ay + 7, 3, 2, isRight ? "S" : "s"); // hand
  };

  if (pose === "stretch") {
    const reach = f === 1 ? -1 : 0;
    rect(7, torsoY - 7 + reach, 3, 5, isLongSleeve ? "t" : "s");
    rect(26, torsoY - 7 - reach, 3, 5, isLongSleeve ? "T" : "S");
    rect(8, torsoY - 2 + reach, 3, 4, upperArmL);
    rect(25, torsoY - 2 - reach, 3, 4, upperArmR);
  } else if (pose === "yoga") {
    rect(7, torsoY - 6, 3, 6, isLongSleeve ? "t" : "s");
    rect(26, torsoY - 6, 3, 6, isLongSleeve ? "T" : "S");
    rect(8, torsoY, 3, 3, upperArmL);
    rect(25, torsoY, 3, 3, upperArmR);
  } else if (pose === "sit") {
    drawArmVertical(8, torsoY + 1, false);
    const sipY = f === 1 ? -2 : 0;
    rect(25, torsoY + 1 + sipY, 3, 4, upperArmR);
    rect(25, torsoY + 5 + sipY, 3, 2, lowerArmR);
    // Tiny Higround coffee cup!
    rect(28, torsoY + 2 + sipY, 4, 5, "w");
    rect(28, torsoY + 4 + sipY, 4, 2, "g");
    rect(27, torsoY + 1 + sipY, 6, 1, "u");
  } else if (pose === "run") {
    const swing = f === 0 ? -2 : f === 2 ? 2 : 0;
    drawArmVertical(7, torsoY + 1 + swing, false);
    drawArmVertical(26, torsoY + 1 - swing, true);
  } else if (pose === "walk") {
    const swing = f === 0 ? 1 : f === 2 ? -1 : 0;
    drawArmVertical(8, torsoY + 1 + swing, false);
    drawArmVertical(25, torsoY + 1 - swing, true);
  } else {
    drawArmVertical(8, torsoY + 1, false);
    drawArmVertical(25, torsoY + 1, true);
  }

  // ── 5. Torso Accessory: Medali Finisher ───────────────────────────────────
  if (a.accessory === "medal") {
    set(14, torsoY, "u"); set(21, torsoY, "u");
    set(15, torsoY + 1, "u"); set(20, torsoY + 1, "u");
    set(16, torsoY + 2, "u"); set(19, torsoY + 2, "u");
    rect(16, torsoY + 3, 4, 4, "y");
    rect(17, torsoY + 4, 2, 2, "Y");
    set(16, torsoY + 3, "w"); // gold shine
  }

  // ── 6. Rounded Chibi Head (Smooth Chamfered Corners!) ─────────────────────
  rect(12, headY, 12, 14, "s");
  rect(11, headY + 1, 14, 12, "s");
  rect(10, headY + 2, 16, 10, "s");
  // Cute rounded ears
  rect(9, headY + 7, 1, 3, "s");
  rect(26, headY + 7, 1, 3, "S");
  // Soft cheek & chin shading
  rect(24, headY + 4, 2, 8, "S");
  rect(12, headY + 13, 12, 1, "S");

  // Blush (omit for poker / angry / panic so expressions read crisply!)
  if (!isFullMask && a.eyeStyle !== "poker" && a.eyeStyle !== "angry" && a.eyeStyle !== "panic") {
    rect(11, headY + 9, 2, 1, "p");
    rect(23, headY + 9, 2, 1, "p");
  }

  // ── 7. 10 Expressive Faces (Eyes + Brows + Mouth!) ────────────────────────
  const blinking = pose === "idle" && f === 2 && !isFullMask;
  if (blinking) {
    rect(12, headY + 7, 4, 1, "k");
    rect(20, headY + 7, 4, 1, "k");
    rect(16, headY + 10, 4, 1, "m");
  } else {
    switch (a.eyeStyle) {
      case "happy": {
        set(12, headY + 8, "k"); set(13, headY + 7, "k"); set(14, headY + 7, "k"); set(15, headY + 8, "k");
        set(20, headY + 8, "k"); set(21, headY + 7, "k"); set(22, headY + 7, "k"); set(23, headY + 8, "k");
        // Wide happy grin
        rect(15, headY + 10, 6, 1, "m");
        rect(16, headY + 11, 4, 1, "w");
        break;
      }
      case "sipit": {
        // Sleek narrow horizontal almond eyes
        rect(12, headY + 7, 4, 1, "k");
        rect(13, headY + 8, 2, 1, "e");
        rect(20, headY + 7, 4, 1, "k");
        rect(21, headY + 8, 2, 1, "e");
        rect(16, headY + 10, 4, 1, "m");
        break;
      }
      case "wide": {
        // Huge sparkling eyes
        rect(12, headY + 5, 4, 4, "w");
        rect(13, headY + 6, 3, 3, "k");
        set(13, headY + 6, "w");
        set(15, headY + 8, "w");
        rect(20, headY + 5, 4, 4, "w");
        rect(20, headY + 6, 3, 3, "k");
        set(20, headY + 6, "w");
        set(22, headY + 8, "w");
        rect(17, headY + 10, 2, 2, "m");
        break;
      }
      case "wink": {
        rect(12, headY + 6, 4, 3, "w");
        rect(13, headY + 6, 3, 3, "k");
        set(13, headY + 6, "w");
        // Cheeky wink >
        set(20, headY + 6, "k"); set(21, headY + 7, "k"); set(22, headY + 7, "k"); set(23, headY + 6, "k");
        set(16, headY + 10, "m"); set(17, headY + 11, "m"); set(18, headY + 11, "m"); set(19, headY + 10, "m");
        break;
      }
      case "angry": {
        // Steep V-shaped furious eyebrows + narrowed eyes + frown + red anger mark!
        set(12, headY + 5, "k"); set(13, headY + 5, "k"); set(14, headY + 6, "k"); set(15, headY + 6, "k");
        set(20, headY + 6, "k"); set(21, headY + 6, "k"); set(22, headY + 5, "k"); set(23, headY + 5, "k");
        rect(12, headY + 7, 3, 2, "k"); set(12, headY + 7, "w");
        rect(21, headY + 7, 3, 2, "k"); set(21, headY + 7, "w");
        // Sharp frown
        set(15, headY + 11, "k"); rect(16, headY + 10, 4, 1, "k"); set(20, headY + 11, "k");
        // Tiny red anime anger vein on cheek/temple
        set(23, headY + 4, "r"); set(24, headY + 5, "r"); set(22, headY + 5, "r");
        break;
      }
      case "pout": {
        // Slanted sulky brows + sideways glance + pouty ^ mouth
        set(12, headY + 6, "e"); set(13, headY + 5, "e"); set(14, headY + 5, "e");
        set(21, headY + 5, "e"); set(22, headY + 5, "e"); set(23, headY + 6, "e");
        rect(12, headY + 7, 3, 2, "k"); set(12, headY + 7, "w");
        rect(21, headY + 7, 3, 2, "k"); set(21, headY + 7, "w");
        // Pouty mouth
        set(16, headY + 11, "m"); rect(17, headY + 10, 2, 1, "m"); set(19, headY + 11, "m");
        break;
      }
      case "sleepy": {
        // Droopy heavy eyelids + under-eye bags + yawning 'o'
        rect(12, headY + 6, 4, 1, "S");
        rect(12, headY + 7, 4, 1, "k");
        rect(13, headY + 8, 2, 1, "e");
        rect(12, headY + 9, 4, 1, "D"); // eye bag
        rect(20, headY + 6, 4, 1, "S");
        rect(20, headY + 7, 4, 1, "k");
        rect(21, headY + 8, 2, 1, "e");
        rect(20, headY + 9, 4, 1, "D"); // eye bag
        // Small yawning mouth
        rect(17, headY + 10, 2, 2, "k");
        break;
      }
      case "poker": {
        // Deadpan dot eyes + flat horizontal mouth
        rect(13, headY + 7, 2, 2, "k");
        rect(21, headY + 7, 2, 2, "k");
        rect(15, headY + 10, 6, 1, "k");
        break;
      }
      case "panic": {
        // Huge wide white eyes with tiny pinprick pupils + blue sweat drop + screaming O mouth!
        rect(11, headY + 5, 5, 4, "w");
        set(13, headY + 7, "k");
        rect(20, headY + 5, 5, 4, "w");
        set(22, headY + 7, "k");
        // Sweat drop on temple
        set(24, headY + 4, "i");
        rect(24, headY + 5, 2, 2, "i");
        set(24, headY + 5, "w");
        // Screaming O mouth
        rect(16, headY + 10, 4, 3, "k");
        rect(17, headY + 11, 2, 1, "r");
        break;
      }
      case "classic":
      default: {
        rect(12, headY + 6, 4, 3, "w");
        rect(13, headY + 6, 3, 3, "k");
        set(13, headY + 6, "w");
        rect(20, headY + 6, 4, 3, "w");
        rect(20, headY + 6, 3, 3, "k");
        set(20, headY + 6, "w");
        rect(16, headY + 10, 4, 1, "m");
        break;
      }
    }
  }

  // ── 8. Front Hair (Automatically Flattens Top When Wearing a Hat!) ────────
  if (!isFullMask) {
    const drawBaseCrown = () => {
      rect(10, headY - 2, 16, 4, "h");
      rect(12, headY - 2, 7, 1, "L");
      rect(23, headY - 1, 3, 3, "H");
    };
    const drawSideburns = (len: number) => {
      rect(9, headY + 1, 2, len, "h");
      rect(25, headY + 1, 2, len, "H");
    };

    switch (a.hairStyle) {
      case "buzz":
        rect(11, headY - 1, 14, 3, "h");
        rect(10, headY, 16, 3, "h");
        rect(13, headY, 6, 1, "L");
        break;
      case "short":
        drawBaseCrown();
        drawSideburns(6);
        rect(11, headY + 2, 4, 2, "h");
        rect(16, headY + 2, 4, 2, "h");
        rect(21, headY + 2, 4, 2, "H");
        break;
      case "spiky":
        drawBaseCrown();
        if (!hidesTopHair) {
          rect(10, headY - 5, 2, 3, "h");
          rect(14, headY - 6, 3, 4, "L");
          rect(19, headY - 5, 3, 3, "h");
          rect(23, headY - 4, 2, 2, "H");
        }
        drawSideburns(5);
        rect(12, headY + 2, 3, 2, "h");
        rect(17, headY + 2, 4, 2, "h");
        break;
      case "bob":
        drawBaseCrown();
        rect(8, headY + 1, 3, 13, "h");
        rect(25, headY + 1, 3, 13, "H");
        rect(11, headY + 2, 14, 2, "h");
        break;
      case "ponytail":
        drawBaseCrown();
        drawSideburns(7);
        rect(12, headY + 2, 5, 2, "h");
        break;
      case "bun":
        drawBaseCrown();
        if (!hidesTopHair) {
          rect(14, headY - 6, 8, 4, "h");
          rect(15, headY - 6, 4, 1, "L");
          rect(14, headY - 2, 8, 1, "u");
        }
        drawSideburns(6);
        break;
      case "curly":
        rect(9, headY - 3, 18, 5, "h");
        rect(8, headY, 3, 10, "h");
        rect(25, headY, 3, 10, "H");
        rect(11, headY - 3, 4, 1, "L");
        rect(18, headY - 3, 4, 1, "L");
        rect(11, headY + 2, 4, 2, "h");
        rect(17, headY + 2, 4, 2, "h");
        rect(22, headY + 2, 3, 2, "H");
        break;
      case "long":
        drawBaseCrown();
        rect(8, headY + 1, 3, 17, "h");
        rect(25, headY + 1, 3, 17, "H");
        rect(11, headY + 2, 5, 2, "h");
        rect(20, headY + 2, 5, 2, "H");
        break;
      case "twintails":
        drawBaseCrown();
        drawSideburns(7);
        rect(11, headY + 2, 14, 2, "h");
        break;
      case "sidepart":
        drawBaseCrown();
        rect(9, headY + 1, 2, 7, "h");
        rect(25, headY + 1, 2, 5, "H");
        rect(11, headY + 2, 11, 2, "h");
        break;
    }
  }

  // ── 9. Topi & Topeng — Snug Alignment Directly on headY (Zero Floating!) ──
  switch (a.headwear) {
    case "headband": {
      rect(10, headY + 1, 16, 2, "c");
      rect(22, headY + 1, 4, 2, "C");
      rect(16, headY + 1, 4, 1, "w");
      // Cute fluttering tie ends on right
      rect(26, headY + 2, 3, 1, "c");
      rect(27, headY + 3, 2, 1, "C");
      break;
    }
    case "cap": {
      // Snug rounded cap dome sitting right onto forehead (headY - 3 .. headY + 2)
      rect(12, headY - 3, 12, 1, "c");
      rect(10, headY - 2, 16, 4, "c");
      rect(12, headY - 2, 7, 1, "K");
      rect(22, headY - 1, 4, 3, "C");
      rect(16, headY - 1, 4, 2, "w"); // crisp front logo patch
      // Forward sporty brim hugging forehead cleanly
      rect(10, headY + 2, 19, 2, "C");
      rect(12, headY + 2, 14, 1, "c");
      break;
    }
    case "beanie": {
      // Cozy knit beanie hugging crown + ribbed fold + pom-pom
      rect(15, headY - 6, 6, 2, "K"); // pom-pom
      rect(12, headY - 4, 12, 2, "c");
      rect(10, headY - 2, 16, 3, "c");
      rect(22, headY - 2, 4, 3, "C");
      rect(9, headY + 1, 18, 2, "C"); // snug ribbed cuff
      for (let x = 11; x <= 25; x += 3) set(x, headY + 1, "c");
      break;
    }
    case "mascot_hat": {
      // Plush red Higround furry mascot hood sitting snugly over the head!
      rect(15, headY - 6, 6, 2, "r"); // fuzzy tuft
      rect(11, headY - 4, 14, 2, "r");
      rect(9, headY - 2, 18, 5, "r");
      rect(12, headY - 2, 4, 3, "w"); rect(13, headY - 1, 2, 2, "k"); set(13, headY - 1, "w");
      rect(20, headY - 2, 4, 3, "w"); rect(21, headY - 1, 2, 2, "k"); set(21, headY - 1, "w");
      break;
    }
    case "crown": {
      // Royal golden crown sitting flush on top of hair
      rect(11, headY - 2, 14, 3, "y");
      rect(11, headY, 14, 1, "Y");
      // 3 crown points
      rect(11, headY - 5, 3, 3, "y");
      rect(16, headY - 6, 4, 4, "y");
      rect(22, headY - 5, 3, 3, "y");
      set(17, headY - 5, "w"); // shine
      // Ruby & sapphire gems
      rect(17, headY - 2, 2, 2, "r");
      set(13, headY - 1, "i");
      set(22, headY - 1, "i");
      break;
    }
    case "helmet": {
      // Rounded safety/bike helmet sitting snugly down to temples + visor + chin strap
      rect(12, headY - 4, 12, 1, "c");
      rect(10, headY - 3, 16, 5, "c");
      rect(9, headY - 1, 18, 4, "c");
      rect(16, headY - 4, 4, 6, "w"); // center racing stripe
      rect(9, headY + 2, 18, 1, "C"); // helmet rim
      // Chin strap framing jaw
      rect(10, headY + 3, 1, 8, "C");
      rect(25, headY + 3, 1, 8, "C");
      break;
    }
    case "propeller": {
      // Playful multi-panel beanie + yellow propeller perched on top!
      rect(11, headY - 3, 14, 5, "c");
      rect(15, headY - 3, 6, 5, "y"); // yellow center panel
      rect(21, headY - 3, 4, 5, "r"); // red side panel
      rect(10, headY + 1, 16, 2, "C"); // brim band
      // Propeller stem & blades
      rect(17, headY - 5, 2, 2, "Z");
      rect(11, headY - 6, 14, 1, "y");
      rect(16, headY - 7, 4, 1, "r");
      break;
    }
    case "mask_luchador": {
      // Full wrestling mask wrapping entire head cleanly with eye cutouts & bold wings!
      rect(12, headY - 1, 12, 15, "c");
      rect(11, headY, 14, 13, "c");
      rect(10, headY + 1, 16, 11, "c");
      rect(23, headY + 2, 3, 9, "C");
      // Bold contrast forehead emblem + ear wings
      rect(16, headY + 1, 4, 4, "y");
      set(17, headY, "y"); set(18, headY, "y");
      rect(11, headY + 4, 5, 1, "w");
      rect(20, headY + 4, 5, 1, "w");
      // Eye cutouts showing fierce white/dark eyes
      rect(12, headY + 6, 4, 3, "w"); rect(13, headY + 7, 2, 2, "k");
      rect(20, headY + 6, 4, 3, "w"); rect(21, headY + 7, 2, 2, "k");
      // Mouth cutout showing chin skin & confident grin
      rect(14, headY + 10, 8, 3, "s");
      rect(16, headY + 11, 4, 1, "k");
      break;
    }
    case "mask_cat": {
      // Cute animal cat mask covering face with pointy ears, whiskers & pink nose!
      // Pointy cat ears on top
      rect(10, headY - 4, 4, 4, "c"); rect(11, headY - 3, 2, 2, "p");
      rect(22, headY - 4, 4, 4, "c"); rect(23, headY - 3, 2, 2, "p");
      // Snug cat face mask
      rect(11, headY, 14, 13, "c");
      rect(10, headY + 1, 16, 11, "c");
      rect(14, headY + 1, 8, 3, "K"); // forehead blaze
      // Big cute cat eyes
      rect(12, headY + 5, 4, 4, "y"); rect(13, headY + 6, 2, 2, "k"); set(13, headY + 6, "w");
      rect(20, headY + 5, 4, 4, "y"); rect(21, headY + 6, 2, 2, "k"); set(21, headY + 6, "w");
      // Pink nose + 'w' cat mouth
      rect(17, headY + 9, 2, 1, "p");
      set(15, headY + 11, "k"); set(16, headY + 10, "k"); set(17, headY + 11, "k");
      set(18, headY + 11, "k"); set(19, headY + 10, "k"); set(20, headY + 11, "k");
      // Whiskers
      rect(8, headY + 9, 3, 1, "w"); rect(8, headY + 11, 3, 1, "w");
      rect(25, headY + 9, 3, 1, "w"); rect(25, headY + 11, 3, 1, "w");
      break;
    }
    case "none":
    default:
      break;
  }

  // ── 10. Face Accessory: Kacamata Biasa (drawn cleanly over eyes!) ─────────
  if (a.accessory === "glasses") {
    // Crisp rectangular frames with lens glint + bridge
    rect(11, headY + 5, 6, 4, "a");
    rect(19, headY + 5, 6, 4, "a");
    rect(12, headY + 6, 4, 2, "z");
    rect(20, headY + 6, 4, 2, "z");
    set(13, headY + 6, "w");
    set(21, headY + 6, "w");
    set(14, headY + 7, "k");
    set(21, headY + 7, "k");
    rect(17, headY + 6, 2, 1, "a"); // nose bridge
    set(10, headY + 6, "A");
    set(25, headY + 6, "A");
  }

  // ── 11. Crisp 1px Warm Espresso Outline Pass ──────────────────────────────
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
