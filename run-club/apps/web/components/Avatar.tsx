import type { Avatar as AvatarSpec } from "@/lib/data/store";
import { PERSON, personPalette } from "@/lib/world/sprite";

/** Placeholder pixel avatar from the paper-doll colours (same pattern as the world sprites). */
export function Avatar({ avatar, size = 64, label }: { avatar: AvatarSpec; size?: number; label: string }) {
  const color = personPalette(avatar);
  const rects: React.ReactNode[] = [];
  PERSON.forEach((row, y) =>
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
