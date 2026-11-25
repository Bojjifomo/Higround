import type { Avatar as AvatarSpec } from "@/lib/data/store";
import { renderAvatarPixels, type AnimPose } from "@/lib/world/sprite";

/** Crisp pixel-art modular avatar (SVG), identical to the in-world Phaser sprites. */
export function Avatar({
  avatar,
  size = 64,
  label,
  pose = "idle",
  frame = 0,
  flip = false,
  className = "",
}: {
  avatar: AvatarSpec;
  size?: number;
  label: string;
  pose?: AnimPose;
  frame?: number;
  flip?: boolean;
  className?: string;
}) {
  const sprite = renderAvatarPixels(avatar, pose, frame);
  const rects: React.ReactNode[] = [];
  sprite.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = sprite.palette[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.03} height={1.03} fill={fill} />);
    }),
  );
  return (
    <svg
      viewBox={`0 0 ${sprite.width} ${sprite.height}`}
      width={size}
      height={Math.round((size * sprite.height) / sprite.width)}
      role="img"
      aria-label={label}
      shapeRendering="crispEdges"
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      className={`drop-shadow-[2px_2px_0_rgba(0,0,0,0.18)] ${className}`}
    >
      {rects}
    </svg>
  );
}
