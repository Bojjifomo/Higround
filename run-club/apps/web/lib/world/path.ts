/**
 * A* on a scene grid (4 directions, no corner cutting) and the isometric projection. Pure and synchronous,
 * so the game loop and the tests use the same code. Grids are tiny (≤ 10 × 40), so a plain array works.
 */
import { inBounds, type SceneGrid, type Tile } from "./layout";

export function astar(g: Pick<SceneGrid, "cols" | "rows" | "walkable">, from: Tile, to: Tile): Tile[] | null {
  if (!inBounds(g, from) || !inBounds(g, to) || !g.walkable[to.y][to.x]) return null;
  const key = (p: Tile) => p.y * g.cols + p.x;
  const h = (p: Tile) => Math.abs(p.x - to.x) + Math.abs(p.y - to.y);
  const open: Tile[] = [from];
  const came = new Map<number, number>();
  const gScore = new Map<number, number>([[key(from), 0]]);
  const fScore = new Map<number, number>([[key(from), h(from)]]);
  const closed = new Set<number>();
  while (open.length) {
    open.sort((a, b) => fScore.get(key(a))! - fScore.get(key(b))!);
    const cur = open.shift()!;
    const ck = key(cur);
    if (cur.x === to.x && cur.y === to.y) {
      const path: Tile[] = [cur];
      let k = ck;
      while (came.has(k)) {
        k = came.get(k)!;
        path.unshift({ x: k % g.cols, y: Math.floor(k / g.cols) });
      }
      return path.slice(1);                     // excludes the start tile
    }
    closed.add(ck);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const n = { x: cur.x + dx, y: cur.y + dy };
      const nk = key(n);
      if (!inBounds(g, n) || !g.walkable[n.y][n.x] || closed.has(nk)) continue;
      const tentative = gScore.get(ck)! + 1;
      if (tentative < (gScore.get(nk) ?? Infinity)) {
        came.set(nk, ck);
        gScore.set(nk, tentative);
        fScore.set(nk, tentative + h(n));
        if (!open.some((p) => key(p) === nk)) open.push(n);
      }
    }
  }
  return null;
}

/** Isometric tile size in screen pixels (2:1 diamond). */
export const ISO_W = 32;
export const ISO_H = 16;

/** Grid position (tiles, may be fractional) → screen position of the tile's centre. */
export function toScreen(x: number, y: number): { sx: number; sy: number } {
  return { sx: (x - y) * (ISO_W / 2), sy: (x + y) * (ISO_H / 2) };
}

/** Screen position → grid position (fractional). Inverse of toScreen. */
export function toGrid(sx: number, sy: number): { x: number; y: number } {
  return { x: sy / ISO_H + sx / ISO_W, y: sy / ISO_H - sx / ISO_W };
}
