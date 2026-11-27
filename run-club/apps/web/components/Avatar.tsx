import type { Avatar as AvatarSpec } from "@/lib/data/store";
import { renderAvatarPixels, type AnimPose } from "@/lib/world/sprite";

export type AvatarCrop = "full" | "head" | "torso" | "legs" | "feet";

function viewBoxFor(w: number, h: number, crop: AvatarCrop): { vb: string; ratio: number } {
  switch (crop) {
    case "head": {
      const y = 0, ch = Math.round(h * 0.56);
      return { vb: `2 ${y} ${w - 4} ${ch}`, ratio: ch / (w - 4) };
    }
    case "torso": {
      const y = Math.round(h * 0.44), ch = Math.round(h * 0.36);
      return { vb: `3 ${y} ${w - 6} ${ch}`, ratio: ch / (w - 6) };
    }
    case "legs": {
      const y = Math.round(h * 0.65), ch = h - y;
      return { vb: `4 ${y} ${w - 8} ${ch}`, ratio: ch / (w - 8) };
    }
    case "feet": {
      const y = Math.round(h * 0.72), ch = h - y;
      return { vb: `4 ${y} ${w - 8} ${ch}`, ratio: ch / (w - 8) };
    }
    case "full":
    default:
      return { vb: `0 0 ${w} ${h}`, ratio: h / w };
  }
}

/** Crisp pixel-art modular avatar (SVG), identical to the in-world Phaser sprites. */
export function Avatar({
  avatar,
  size = 64,
  label,
  pose = "idle",
  frame = 0,
  flip = false,
  crop = "full",
  className = "",
}: {
  avatar: AvatarSpec;
  size?: number;
  label: string;
  pose?: AnimPose;
  frame?: number;
  flip?: boolean;
  crop?: AvatarCrop;
  className?: string;
}) {
  const sprite = renderAvatarPixels(avatar, pose, frame);
  const { vb, ratio } = viewBoxFor(sprite.width, sprite.height, crop);
  const rects: React.ReactNode[] = [];
  sprite.rows.forEach((row, y) =>
    [...row].forEach((ch, x) => {
      const fill = sprite.palette[ch];
      if (fill) rects.push(<rect key={`${x}-${y}`} x={x} y={y} width={1.03} height={1.03} fill={fill} />);
    }),
  );
  return (
    <svg
      viewBox={vb}
      width={size}
      height={Math.round(size * ratio)}
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
