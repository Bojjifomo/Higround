"use client";
/**
 * Remotion 9:16 IG Story Video Composition (540x960 @ 30fps, 180 frames = 6 seconds).
 * Plays live in the browser via @remotion/player and also exports cleanly via `npx remotion render`.
 * Features the member's real custom 28x36 pixel character animated past Higround's Start Gate & Mascot!
 */
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { Avatar } from "@/components/Avatar";
import type { AvatarColors, AnimPose } from "@/lib/world/sprite";

export type StoryTemplate = "run" | "levelup" | "yoga";

export interface RunStoryProps {
  template: StoryTemplate;
  displayName: string;
  handle: string;
  avatar: AvatarColors;
  level: number;
  title: string;
  totalXp: number;
  weekKm: number;
  totalKm: number;
  higroundStarts: number;
  yogaStars: number;
  caption: string;
  badges: string[];
}

const THEME: Record<StoryTemplate, {
  bgTop: string; bgBottom: string; accent: string; pill: string; pose: AnimPose;
  headline: string;
}> = {
  run: {
    bgTop: "#FFE8C8",
    bgBottom: "#F5D2A4",
    accent: "#FF5F0E",
    pill: "SUNDAY RUN · HIGROUND",
    pose: "run",
    headline: "START DARI HIGROUND!",
  },
  levelup: {
    bgTop: "#2E3A8C",
    bgBottom: "#4B4FB8",
    accent: "#F7D046",
    pill: "★ LEVEL UP ACHIEVEMENT ★",
    pose: "stretch",
    headline: "NAIK LEVEL!",
  },
  yoga: {
    bgTop: "#F3E9D2",
    bgBottom: "#E6D5B8",
    accent: "#FF5F0E",
    pill: "YOGA QUEST · STUDIO LT.2",
    pose: "yoga",
    headline: "MINDFUL & STRONG",
  },
};

export const RunStoryVideo: React.FC<RunStoryProps> = ({
  template,
  displayName,
  handle,
  avatar,
  level,
  title,
  totalXp,
  weekKm,
  totalKm,
  higroundStarts,
  yogaStars,
  caption,
  badges,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = THEME[template];

  const headerSpring = spring({ frame, fps, config: { damping: 14, stiffness: 180 } });
  const cardSpring = spring({ frame: Math.max(0, frame - 12), fps, config: { damping: 15, stiffness: 160 } });
  const statsSpring = spring({ frame: Math.max(0, frame - 24), fps, config: { damping: 16, stiffness: 150 } });
  const footerOpacity = interpolate(frame, [30, 50], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

  // Animated runner sprite frame & horizontal jog bounce
  const animStep = Math.floor(frame / (template === "run" ? 4 : 10));
  const roadScroll = (frame * 6) % 64;
  const runnerBob = template === "run" ? Math.abs(Math.sin(frame * 0.42)) * 10 : Math.sin(frame * 0.16) * 5;
  const mascotHop = Math.abs(Math.sin(frame * 0.25)) * 8;
  const isDark = template === "levelup";

  return (
    <AbsoluteFill
      style={{
        background: `linear-gradient(180deg, ${t.bgTop} 0%, ${t.bgBottom} 100%)`,
        fontFamily: "system-ui, -apple-system, sans-serif",
        padding: 32,
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        color: isDark ? "#FFF8EA" : "#241917",
      }}
    >
      {/* Subtle pixel grid texture */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: isDark ? 0.14 : 0.22,
          backgroundImage: "radial-gradient(#2b1d17 1.2px, transparent 1.2px)",
          backgroundSize: "18px 18px",
          pointerEvents: "none",
        }}
      />

      {/* TOP BRAND HEADER */}
      <div
        style={{
          position: "relative",
          transform: `translateY(${(1 - headerSpring) * -36}px) scale(${0.92 + headerSpring * 0.08})`,
          opacity: headerSpring,
          textAlign: "center",
        }}
      >
        <div
          style={{
            display: "inline-block",
            background: "#241917",
            color: "#F7D046",
            padding: "6px 16px",
            borderRadius: 999,
            fontSize: 14,
            fontWeight: 900,
            letterSpacing: 1.5,
            border: "3px solid #FF5F0E",
          }}
        >
          {t.pill}
        </div>
        <div
          style={{
            marginTop: 12,
            fontSize: 38,
            fontWeight: 900,
            letterSpacing: 1,
            color: isDark ? "#F7D046" : "#FF5F0E",
            textShadow: "3px 3px 0 #241917",
          }}
        >
          HIGROUND RUN CLUB
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, opacity: 0.85, marginTop: 2 }}>
          {t.headline} · Harapan Indah
        </div>
      </div>

      {/* CENTER ANIMATED PIXEL DIORAMA STAGE */}
      <div
        style={{
          position: "relative",
          transform: `scale(${0.86 + cardSpring * 0.14})`,
          opacity: cardSpring,
          background: "#FFF8EA",
          border: "5px solid #241917",
          borderRadius: 22,
          boxShadow: "8px 8px 0 #241917",
          padding: 20,
          overflow: "hidden",
          color: "#241917",
        }}
      >
        {/* Pixel sky & scrolling running track stage */}
        <div
          style={{
            position: "relative",
            height: 290,
            borderRadius: 14,
            border: "4px solid #241917",
            background: template === "levelup"
              ? "linear-gradient(180deg, #4B4FB8 0%, #8388E6 65%, #77726B 65%, #5C5752 100%)"
              : "linear-gradient(180deg, #C8E6FA 0%, #EAF7E6 65%, #77726B 65%, #5C5752 100%)",
            overflow: "hidden",
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
        >
          {/* Animated road dashes */}
          <div
            style={{
              position: "absolute",
              bottom: 34,
              left: -64,
              right: -64,
              height: 6,
              backgroundImage: "repeating-linear-gradient(90deg, #F7D046 0 28px, transparent 28px 64px)",
              transform: `translateX(${-roadScroll}px)`,
            }}
          />

          {/* Real Higround Start Gate Sprite on Left */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/world/landmarks/start_gate.png"
            alt=""
            style={{
              position: "absolute",
              left: 16,
              bottom: 42,
              width: 148,
              imageRendering: "pixelated",
            }}
          />

          {/* Cheering Higround Mascot Sprite on Right */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/world/mascot/guide_cheer.png"
            alt=""
            style={{
              position: "absolute",
              right: 22,
              bottom: 42 + mascotHop,
              width: 112,
              imageRendering: "pixelated",
            }}
          />

          {/* Member's Live Animated 28x36 Custom Pixel Character in Center! */}
          <div
            style={{
              position: "relative",
              marginBottom: 24 + runnerBob,
              zIndex: 4,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
            }}
          >
            <div
              style={{
                background: "#F7D046",
                border: "2px solid #241917",
                borderRadius: 8,
                padding: "2px 10px",
                fontSize: 13,
                fontWeight: 900,
                marginBottom: 4,
              }}
            >
              {template === "run" ? "+XP! 🔥" : template === "levelup" ? `LV ${level}! ★` : "PERFECT! 🧘"}
            </div>
            <Avatar avatar={avatar} size={136} pose={t.pose} frame={animStep} label={displayName} />
          </div>
        </div>

        {/* Runner Identity Bar */}
        <div style={{ marginTop: 16, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div>
            <div style={{ fontSize: 26, fontWeight: 900, lineHeight: 1.05 }}>{displayName}</div>
            <div style={{ fontSize: 14, fontWeight: 700, color: "#6B5B4B" }}>@{handle}</div>
          </div>
          <div
            style={{
              background: "#241917",
              color: "#F7D046",
              padding: "8px 14px",
              borderRadius: 10,
              textAlign: "right",
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 900, lineHeight: 1 }}>Lv {level}</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#FFF8EA" }}>{title}</div>
          </div>
        </div>

        {/* Custom Caption */}
        {caption && (
          <div
            style={{
              marginTop: 12,
              background: "#EFE1C4",
              border: "2px solid #241917",
              borderRadius: 10,
              padding: "8px 12px",
              fontSize: 14,
              fontWeight: 700,
              color: "#3B261C",
            }}
          >
            &ldquo;{caption}&rdquo;
          </div>
        )}
      </div>

      {/* STATS GRID */}
      <div
        style={{
          position: "relative",
          transform: `translateY(${(1 - statsSpring) * 28}px)`,
          opacity: statsSpring,
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
        }}
      >
        {[
          { label: "MINGGU INI", val: `${weekKm.toFixed(1)} km`, bg: "#FF5F0E", fg: "#FFF8EA" },
          { label: "TOTAL XP", val: `${totalXp.toLocaleString("id-ID")} XP`, bg: "#F7D046", fg: "#241917" },
          { label: "START HIGROUND", val: `${higroundStarts}× ☕`, bg: "#FFF8EA", fg: "#241917" },
          { label: template === "yoga" ? "BINTANG YOGA" : "TOTAL LARI", val: template === "yoga" ? `${yogaStars} ★` : `${totalKm.toFixed(0)} km`, bg: "#FFF8EA", fg: "#241917" },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              background: s.bg,
              color: s.fg,
              border: "4px solid #241917",
              borderRadius: 14,
              boxShadow: "4px 4px 0 #241917",
              padding: "10px 14px",
            }}
          >
            <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.85, letterSpacing: 1 }}>{s.label}</div>
            <div style={{ fontSize: 24, fontWeight: 900, marginTop: 2 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* FOOTER BADGES + TAG */}
      <div
        style={{
          position: "relative",
          opacity: footerOpacity,
          textAlign: "center",
        }}
      >
        {badges.length > 0 && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
            {badges.slice(0, 3).map((b) => (
              <span
                key={b}
                style={{
                  background: "#FFF8EA",
                  color: "#241917",
                  border: "2px solid #241917",
                  borderRadius: 8,
                  padding: "3px 10px",
                  fontSize: 12,
                  fontWeight: 800,
                }}
              >
                🏅 {b}
              </span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.2, opacity: 0.9 }}>
          @HIGROUND.COFFEE · ONE BITE SAYS IT ALL
        </div>
      </div>
    </AbsoluteFill>
  );
};
