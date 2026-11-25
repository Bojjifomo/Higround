/**
 * Static sprite manifest for /world (SPEC §12.4).
 * Generated/kept in sync with public/assets/world/manifest.json by run-club/tools/build_world_assets.py.
 * All files listed here are either CC0 (PtDesigns Cozy Shops / Town Environments) or Higround-owned.
 */
import rawManifest from "../../public/assets/world/manifest.json";

export interface SpriteEntry {
  file: string;
  anchorX: number;
  anchorY: number;
  source?: string;
}

export interface WorldAssetManifest {
  tileW: number;
  tileH: number;
  sprites: Record<string, SpriteEntry>;
}

export const WORLD_MANIFEST = rawManifest as WorldAssetManifest;

export function spriteEntry(key: string): SpriteEntry | undefined {
  return WORLD_MANIFEST.sprites[key];
}
