"use client";
/**
 * Spring-physics game UI primitives powered by @react-spring/web.
 * Brings Kairosoft / Habitica / Animal Crossing bouncy tactility to drawers, character creator, XP counters,
 * and Level-Up celebration modals.
 */
import Link from "next/link";
import { useEffect, useState } from "react";
import { animated, useSpring } from "@react-spring/web";
import { sfx } from "@/lib/audio/sfx";

/** Spring pop-in wrapper for in-world drawers, POI cards, and member popups. */
export function SpringPop({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const styles = useSpring({
    from: { opacity: 0, transform: "translateY(14px) scale(0.94)" },
    to: { opacity: 1, transform: "translateY(0px) scale(1)" },
    config: { tension: 340, friction: 22 },
  });
  return (
    <animated.div style={styles} className={className}>
      {children}
    </animated.div>
  );
}

/** Playful squash-and-stretch spring bounce whenever `triggerKey` changes (great for Character Creator!). */
export function SpringBounce({
  triggerKey,
  children,
  className = "",
}: {
  triggerKey: string | number;
  children: React.ReactNode;
  className?: string;
}) {
  const [styles, api] = useSpring(() => ({
    scaleX: 1,
    scaleY: 1,
    y: 0,
    config: { tension: 420, friction: 16 },
  }));

  useEffect(() => {
    api.start({
      from: { scaleX: 1.14, scaleY: 0.88, y: 4 },
      to: { scaleX: 1, scaleY: 1, y: 0 },
    });
  }, [triggerKey, api]);

  return (
    <animated.div
      style={{
        transform: styles.scaleX.to(
          (sx) => `translateY(${styles.y.get()}px) scale(${sx}, ${styles.scaleY.get()})`,
        ),
      }}
      className={className}
    >
      {children}
    </animated.div>
  );
}

/** Smoothly rolling RPG counter for XP / km stats. */
export function AnimatedNumber({
  value,
  decimals = 0,
  locale = "id-ID",
}: {
  value: number;
  decimals?: number;
  locale?: string;
}) {
  const { n } = useSpring({
    from: { n: 0 },
    to: { n: value },
    config: { tension: 120, friction: 20 },
  });
  return (
    <animated.span className="tabular-nums">
      {n.to((v) =>
        decimals > 0
          ? v.toLocaleString(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
          : Math.round(v).toLocaleString(locale),
      )}
    </animated.span>
  );
}

/** Habitica / Kairosoft-style Level-Up & Milestone Celebration Modal with Remotion IG Story CTA! */
export function LevelUpModal({
  level,
  title,
  totalXp,
  weekKm,
  onClose,
}: {
  level: number;
  title: string;
  totalXp: number;
  weekKm: number;
  onClose: () => void;
}) {
  const [confetti] = useState(() =>
    Array.from({ length: 14 }, (_, i) => ({
      left: `${6 + ((i * 7) % 88)}%`,
      delay: `${(i % 5) * 90}ms`,
      color: ["#FF5F0E", "#F7D046", "#E0352B", "#4B4FB8", "#2F7D4B"][i % 5],
    })),
  );

  useEffect(() => {
    void sfx.levelUp();
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-[2px]">
      <SpringPop className="pixel-frame-orange relative w-full max-w-sm overflow-hidden rounded-2xl bg-[#FFF8EA] p-5 text-center">
        {/* Pixel confetti dots */}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-14 overflow-hidden" aria-hidden>
          {confetti.map((c, i) => (
            <span
              key={i}
              className="absolute top-2 h-2.5 w-2.5 animate-bounce rounded-sm border border-black"
              style={{ left: c.left, backgroundColor: c.color, animationDelay: c.delay }}
            />
          ))}
        </div>

        <span className="inline-block rounded-full border-2 border-black bg-hg-yellow px-3 py-0.5 font-pixel text-xs uppercase tracking-wider">
          ★ MILESTONE &amp; LEVEL STATUS ★
        </span>

        <div className="mt-3 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/assets/world/mascot/guide_cheer.png"
            alt="Maskot Higround bersorak"
            width={88}
            height={88}
            className="animate-bounce [image-rendering:pixelated]"
          />
        </div>

        <h2 className="mt-1 font-pixel text-3xl leading-none text-hg-orange">LEVEL {level}!</h2>
        <p className="mt-1 font-pixel text-lg text-[#241917]">{title}</p>

        <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg border-2 border-[#2b1d17] bg-[#EFE1C4] p-2.5 text-xs font-bold">
          <div>
            <div className="text-[10px] uppercase text-neutral-600">Total XP</div>
            <div className="font-mono text-base text-[#241917]">
              <AnimatedNumber value={totalXp} /> XP
            </div>
          </div>
          <div>
            <div className="text-[10px] uppercase text-neutral-600">Minggu Ini</div>
            <div className="font-mono text-base text-hg-orange">
              <AnimatedNumber value={weekKm} decimals={1} /> km
            </div>
          </div>
        </div>

        <p className="mt-3 text-xs text-neutral-700">
          Higround: <i>&ldquo;Keren banget! Pamerin progres lari &amp; karakter pixel kamu ke IG Story yuk!&rdquo;</i>
        </p>

        <div className="mt-4 flex flex-col gap-2">
          <Link
            href="/share"
            onClick={() => void sfx.select()}
            className="pixel-btn rounded-lg bg-hg-orange px-4 py-2 font-pixel text-sm text-white"
          >
            🎬 Bikin Video IG Story (Remotion) →
          </Link>
          <button
            onClick={() => { void sfx.select(); onClose(); }}
            className="pixel-btn rounded-lg bg-white px-4 py-1.5 text-xs font-bold"
          >
            Lanjut Jelajah Ruko
          </button>
        </div>
      </SpringPop>
    </div>
  );
}
