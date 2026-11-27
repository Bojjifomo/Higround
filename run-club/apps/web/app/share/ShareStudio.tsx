"use client";
/**
 * Higround IG Story Share Studio — powered by @remotion/player + Canvas 1080x1920 PNG & WebM exporter.
 * Lets any member preview their live animated 6s Remotion story and download a crisp IG Story card or video
 * directly in the browser with zero render-farm cost.
 */
import Link from "next/link";
import { useState } from "react";
import { Player } from "@remotion/player";
import { SpringPop } from "@/components/SpringUI";
import { sfx } from "@/lib/audio/sfx";
import { renderAvatarPixels } from "@/lib/world/sprite";
import { RunStoryVideo, type RunStoryProps, type StoryTemplate } from "@/remotion/RunStoryVideo";

const TEMPLATES: { id: StoryTemplate; label: string; icon: string }[] = [
  { id: "run", label: "Lari di Higround", icon: "🏃" },
  { id: "levelup", label: "Level Up!", icon: "⭐" },
  { id: "yoga", label: "Yoga Quest", icon: "🧘" },
];

export function ShareStudio({ baseProps }: { baseProps: Omit<RunStoryProps, "template" | "caption"> }) {
  const [template, setTemplate] = useState<StoryTemplate>("run");
  const [caption, setCaption] = useState("Pace santai, kopi kencang di Higround! ☕🔥");
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const storyProps: RunStoryProps = { ...baseProps, template, caption };

  /** Render a crisp pixel-perfect 1080x1920 IG Story frame to canvas for PNG or 6s WebM video download. */
  const drawStoryFrame = (
    ctx: CanvasRenderingContext2D,
    frame: number,
    gateImg: HTMLImageElement | null,
    mascotImg: HTMLImageElement | null,
  ) => {
    const W = 540, H = 960;
    const isDark = template === "levelup";
    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (template === "run") { grad.addColorStop(0, "#FFE8C8"); grad.addColorStop(1, "#F5D2A4"); }
    else if (template === "levelup") { grad.addColorStop(0, "#2E3A8C"); grad.addColorStop(1, "#4B4FB8"); }
    else { grad.addColorStop(0, "#F3E9D2"); grad.addColorStop(1, "#E6D5B8"); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = "center";
    ctx.fillStyle = isDark ? "#F7D046" : "#FF5F0E";
    ctx.font = "900 36px system-ui, sans-serif";
    ctx.fillText("HIGROUND RUN CLUB", W / 2, 102);
    ctx.fillStyle = isDark ? "#FFF8EA" : "#241917";
    ctx.font = "700 16px system-ui, sans-serif";
    ctx.fillText("Harapan Indah · Coffee & Sports Hub", W / 2, 130);

    // Card frame
    ctx.fillStyle = "#241917";
    ctx.fillRect(40, 168, 468, 430);
    ctx.fillStyle = "#FFF8EA";
    ctx.fillRect(32, 160, 468, 430);
    ctx.strokeStyle = "#241917";
    ctx.lineWidth = 5;
    ctx.strokeRect(32, 160, 468, 430);

    // Stage sky & asphalt
    ctx.fillStyle = isDark ? "#5E64CE" : "#C8E6FA";
    ctx.fillRect(52, 180, 428, 175);
    ctx.fillStyle = "#6B6660";
    ctx.fillRect(52, 355, 428, 95);
    ctx.strokeRect(52, 180, 428, 270);

    // Scrolling yellow road dashes
    ctx.fillStyle = "#F7D046";
    const shift = (frame * 6) % 64;
    for (let rx = 52 - shift; rx < 480; rx += 64) {
      ctx.fillRect(Math.max(52, rx), 400, 28, 6);
    }

    ctx.imageSmoothingEnabled = false;
    if (gateImg) ctx.drawImage(gateImg, 68, 282, 138, 125);
    const hop = Math.abs(Math.sin(frame * 0.25)) * 8;
    if (mascotImg) ctx.drawImage(mascotImg, 352, 300 - hop, 108, 108);

    // Draw live custom pixel character pixel-by-pixel!
    const pose = template === "run" ? "run" : template === "levelup" ? "stretch" : "yoga";
    const spr = renderAvatarPixels(baseProps.avatar, pose, Math.floor(frame / 4));
    const pxSize = Math.max(3, Math.round(180 / spr.height));
    const ox = Math.round(W / 2 - (spr.width * pxSize) / 2);
    const bob = template === "run" ? Math.abs(Math.sin(frame * 0.42)) * 10 : 0;
    const oy = Math.round(424 - spr.height * pxSize - bob);
    spr.rows.forEach((row, y) => {
      [...row].forEach((ch, x) => {
        const col = spr.palette[ch];
        if (col) {
          ctx.fillStyle = col;
          ctx.fillRect(ox + x * pxSize, oy + y * pxSize, pxSize, pxSize);
        }
      });
    });

    // Runner info
    ctx.textAlign = "left";
    ctx.fillStyle = "#241917";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.fillText(baseProps.displayName, 54, 494);
    ctx.fillStyle = "#6B5B4B";
    ctx.font = "700 14px system-ui, sans-serif";
    ctx.fillText(`@${baseProps.handle} · Lv ${baseProps.level} ${baseProps.title}`, 54, 518);

    if (caption) {
      ctx.fillStyle = "#EFE1C4";
      ctx.fillRect(52, 534, 428, 38);
      ctx.fillStyle = "#3B261C";
      ctx.font = "700 14px system-ui, sans-serif";
      ctx.fillText(`"${caption.slice(0, 48)}"`, 64, 558);
    }

    // 4 Stat boxes
    const stats = [
      { l: "MINGGU INI", v: `${baseProps.weekKm.toFixed(1)} km`, bg: "#FF5F0E", fg: "#FFF8EA", x: 32, y: 620 },
      { l: "TOTAL XP", v: `${baseProps.totalXp.toLocaleString("id-ID")} XP`, bg: "#F7D046", fg: "#241917", x: 276, y: 620 },
      { l: "START HIGROUND", v: `${baseProps.higroundStarts}x`, bg: "#FFF8EA", fg: "#241917", x: 32, y: 722 },
      { l: "TOTAL LARI", v: `${baseProps.totalKm.toFixed(0)} km`, bg: "#FFF8EA", fg: "#241917", x: 276, y: 722 },
    ];
    for (const s of stats) {
      ctx.fillStyle = "#241917";
      ctx.fillRect(s.x + 4, s.y + 4, 232, 84);
      ctx.fillStyle = s.bg;
      ctx.fillRect(s.x, s.y, 232, 84);
      ctx.strokeRect(s.x, s.y, 232, 84);
      ctx.fillStyle = s.fg;
      ctx.font = "800 12px system-ui, sans-serif";
      ctx.fillText(s.l, s.x + 14, s.y + 28);
      ctx.font = "900 24px system-ui, sans-serif";
      ctx.fillText(s.v, s.x + 14, s.y + 64);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = isDark ? "#FFF8EA" : "#241917";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText("@HIGROUND.COFFEE · ONE BITE SAYS IT ALL", W / 2, 890);
  };

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const exportPng = async () => {
    void sfx.cashier();
    setExportStatus("Merender PNG 1080×1920...");
    const [gate, mascot] = await Promise.all([
      loadImg("/assets/world/landmarks/start_gate.png"),
      loadImg("/assets/world/mascot/guide_cheer.png"),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);
    drawStoryFrame(ctx, 18, gate, mascot);
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `higround-story-${baseProps.handle}-${template}.png`;
    a.click();
    setExportStatus("PNG IG Story berhasil didownload!");
  };

  const exportWebm = async () => {
    if (typeof MediaRecorder === "undefined") {
      setExportStatus("Browser tidak mendukung perekaman video langsung — gunakan Download PNG.");
      return;
    }
    void sfx.levelUp();
    setExportStatus("Merekam video animasi 5 detik...");
    const [gate, mascot] = await Promise.all([
      loadImg("/assets/world/landmarks/start_gate.png"),
      loadImg("/assets/world/mascot/guide_cheer.png"),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 960;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm" });
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data); };
    rec.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `higround-story-${baseProps.handle}-${template}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
      setExportStatus("Video animasi IG Story (.webm) berhasil didownload!");
    };
    rec.start();
    let f = 0;
    const totalFrames = 120; // 4 seconds smooth loop
    const tick = () => {
      drawStoryFrame(ctx, f, gate, mascot);
      f++;
      if (f < totalFrames) setTimeout(tick, 33);
      else rec.stop();
    };
    tick();
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
      {/* Live Remotion 9:16 Player inside a cozy pixel phone frame */}
      <SpringPop className="mx-auto w-full max-w-[340px]">
        <div className="pixel-frame-orange overflow-hidden rounded-[26px] bg-[#241917] p-2.5">
          <div className="overflow-hidden rounded-[18px] border-2 border-[#241917]">
            <Player
              component={RunStoryVideo}
              inputProps={storyProps}
              durationInFrames={180}
              fps={30}
              compositionWidth={540}
              compositionHeight={960}
              style={{ width: "100%", aspectRatio: "9 / 16" }}
              controls
              loop
              autoPlay
            />
          </div>
        </div>
      </SpringPop>

      {/* Controls & Export Panel */}
      <div className="space-y-4">
        <div className="pixel-frame rounded-xl bg-[#FFF8EA] p-4 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="rounded bg-hg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                Powered by Remotion
              </span>
              <h2 className="mt-1 font-pixel text-2xl leading-none">Studio Video IG Story 9:16</h2>
            </div>
            <Link href="/world" className="pixel-btn rounded-md bg-white px-3 py-1 text-xs font-bold">
              ← Kembali ke Dunia
            </Link>
          </div>

          <p className="text-sm text-neutral-700">
            Karakter pixel kamu, statistik lari minggu ini, dan maskot Higround langsung dirangkai jadi animasi IG Story siap pamer!
          </p>

          {/* Template Picker */}
          <div>
            <label className="mb-1.5 block font-pixel text-sm">Pilih Tema Story</label>
            <div className="grid grid-cols-3 gap-2">
              {TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => { void sfx.pop(); setTemplate(t.id); }}
                  className={`pixel-btn rounded-lg px-2.5 py-2 text-xs font-bold ${
                    template === t.id ? "bg-hg-orange text-white" : "bg-white text-[#241917]"
                  }`}
                >
                  <span className="block text-lg">{t.icon}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Caption Input */}
          <div>
            <label className="mb-1 block font-pixel text-sm" htmlFor="story-caption">
              Caption di Kartu
            </label>
            <input
              id="story-caption"
              value={caption}
              maxLength={60}
              onChange={(e) => setCaption(e.target.value)}
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-2 text-sm font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={exportWebm}
              className="pixel-btn rounded-lg bg-hg-orange px-4 py-2.5 font-pixel text-sm text-white"
            >
              🎬 Download Video Animasi (.webm)
            </button>
            <button
              type="button"
              onClick={exportPng}
              className="pixel-btn rounded-lg bg-hg-yellow px-4 py-2.5 font-pixel text-sm text-[#241917]"
            >
              📸 Download Kartu PNG (1080×1920)
            </button>
          </div>

          {exportStatus && (
            <p role="status" className="rounded-md border-2 border-[#2b1d17] bg-[#EFE1C4] px-3 py-2 text-xs font-bold text-[#241917]">
              ✅ {exportStatus}
            </p>
          )}
        </div>

        <div className="pixel-frame rounded-xl bg-[#EFE1C4]/80 p-3.5 text-xs text-neutral-700 space-y-1">
          <div className="font-bold text-[#241917]">Tips Render MP4 Resolusi Penuh (Remotion CLI):</div>
          <p>
            Komposisi Remotion tersimpan di <code>remotion/RunStoryVideo.tsx</code> &amp; <code>remotion/Root.tsx</code> — bisa juga dirender ke MP4 lewat{" "}
            <code>npx remotion render remotion/Root.tsx HigroundRunStory out.mp4</code>.
          </p>
        </div>
      </div>
    </div>
  );
}
