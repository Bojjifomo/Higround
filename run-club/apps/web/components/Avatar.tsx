import type { Avatar as AvatarSpec } from "@/lib/data/store";

/**
 * Placeholder pixel avatar (16 × 20 grid) drawn from the paper-doll colours, until the real sprites from
 * SPEC §12 arrive. Rendered as crisp SVG rects, scaled by `size`.
 */
const ROWS = [
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

export function Avatar({ avatar, size = 64, label }: { avatar: AvatarSpec; size?: number; label: string }) {
  const color: Record<string, string> = {
    h: avatar.hair, s: avatar.skin, S: avatar.skin, k: "#1b1b1b", m: "#9a4a3a", t: avatar.top, b: avatar.bottom, f: avatar.shoes,
  };
  const rects: React.ReactNode[] = [];
  ROWS.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      if (color[ch]) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.02} height={1.02} fill={color[ch]} />);
    }));
  return (
    <svg viewBox="0 0 16 20" width={size} height={(size * 20) / 16} role="img" aria-label={label}
         shapeRendering="crispEdges" className="drop-shadow-[2px_2px_0_rgba(0,0,0,0.15)]">
      {rects}
    </svg>
  );
}
