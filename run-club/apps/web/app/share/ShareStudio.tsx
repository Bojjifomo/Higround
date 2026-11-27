"use client";
/**
 * Higround IG Story Share Studio v2 (Roadmap v4 — Fase C):
 * - Mode Layout (Opsi C):
 *   1. Card Pixel (9:16): Live Remotion player + 1080x1920 PNG & animated WebM exporter
 *   2. Stiker Transparan (PNG): True alpha-channel 1080x1920 PNG overlay ala Strava/NRC
 * - Supports Profile Summary, Per-Run Log (`/share?run=<id>`), and Run Buddy Squad ("Lari bareng")
 */
import Link from "next/link";
import { useState } from "react";
import { Player } from "@remotion/player";
import { Avatar } from "@/components/Avatar";
import { SpringPop } from "@/components/SpringUI";
import { sfx } from "@/lib/audio/sfx";
import { renderAvatarPixels, type AnimPose, type AvatarColors } from "@/lib/world/sprite";
import {
  RunStoryVideo,
  type RunStoryProps,
  type ShareRunItem,
  type StoryTemplate,
} from "@/remotion/RunStoryVideo";

type LayoutMode = "card" | "sticker";
type StickerInk = "light" | "dark";

const TEMPLATES: { id: Exclude<StoryTemplate, "yoga">; label: string; icon: string }[] = [
  { id: "run", label: "Lari di Higround", icon: "🏃" },
  { id: "levelup", label: "Level Up!", icon: "⭐" },
];

function drawPixelSprite(
  ctx: CanvasRenderingContext2D,
  avatar: AvatarColors,
  pose: AnimPose,
  step: number,
  centerX: number,
  bottomY: number,
  targetHeight: number,
) {
  const spr = renderAvatarPixels(avatar, pose, step);
  const pxSize = Math.max(2, Math.round(targetHeight / spr.height));
  const ox = Math.round(centerX - (spr.width * pxSize) / 2);
  const oy = Math.round(bottomY - spr.height * pxSize);
  spr.rows.forEach((row, y) => {
    [...row].forEach((ch, x) => {
      const col = spr.palette[ch];
      if (col) {
        ctx.fillStyle = col;
        ctx.fillRect(ox + x * pxSize, oy + y * pxSize, pxSize, pxSize);
      }
    });
  });
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function ShareStudio({
  baseProps,
  recentRuns = [],
  initialRunId = null,
}: {
  baseProps: Omit<RunStoryProps, "template" | "caption" | "selectedRun" | "showBuddies">;
  recentRuns?: ShareRunItem[];
  initialRunId?: string | null;
}) {
  const validInitial = initialRunId && recentRuns.some((r) => r.id === initialRunId) ? initialRunId : "";
  const [selectedRunId, setSelectedRunId] = useState<string>(validInitial);
  const [layoutMode, setLayoutMode] = useState<LayoutMode>("card");
  const [stickerInk, setStickerInk] = useState<StickerInk>("light");
  const [template, setTemplate] = useState<Exclude<StoryTemplate, "yoga">>("run");
  const [showBuddies, setShowBuddies] = useState<boolean>(true);
  const [caption, setCaption] = useState<string>(() => {
    const picked = recentRuns.find((r) => r.id === validInitial);
    if (picked && picked.buddies.length > 0) return "Lari bareng squad Higround! ☕🤝🔥";
    if (picked) return "Selesai lari, lanjut ngopi di Higround! ☕🏃";
    return "Pace santai, kopi kencang di Higround! ☕🔥";
  });
  const [exportStatus, setExportStatus] = useState<string | null>(null);

  const selectedRun = recentRuns.find((r) => r.id === selectedRunId) ?? null;
  const activeBuddies = showBuddies && selectedRun ? selectedRun.buddies : [];
  const hasBuddies = activeBuddies.length > 0;
  const storyProps: RunStoryProps = {
    ...baseProps,
    template,
    caption,
    selectedRun,
    showBuddies,
  };

  const handleSelectRun = (nextId: string) => {
    void sfx.pop();
    setSelectedRunId(nextId);
    const picked = recentRuns.find((r) => r.id === nextId);
    if (picked && picked.buddies.length > 0) {
      setCaption("Lari bareng squad Higround! ☕🤝🔥");
    } else if (picked?.isWalk) {
      setCaption("Jalan santai sore, tetap aktif! 🚶🌿");
    } else if (picked) {
      setCaption("Selesai lari, lanjut ngopi di Higround! ☕🏃");
    }
  };

  /** Draw 540x960 Card Pixel frame (scaled 2x to 1080x1920 for crisp PNG export). */
  const drawStoryFrame = (
    ctx: CanvasRenderingContext2D,
    frame: number,
    gateImg: HTMLImageElement | null,
    mascotImg: HTMLImageElement | null,
  ) => {
    const W = 540, H = 960;
    const isDark = template === "levelup";
    const isWalk = Boolean(selectedRun?.isWalk);
    const pose: AnimPose = template === "levelup" ? "stretch" : isWalk ? "walk" : "run";

    const grad = ctx.createLinearGradient(0, 0, 0, H);
    if (template === "run") { grad.addColorStop(0, "#FFE8C8"); grad.addColorStop(1, "#F5D2A4"); }
    else { grad.addColorStop(0, "#2E3A8C"); grad.addColorStop(1, "#4B4FB8"); }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, W, H);

    // Header pill + title
    const pill = selectedRun
      ? hasBuddies
        ? "LARI BARENG · HIGROUND SQUAD"
        : isWalk
          ? "JALAN KAKI · HIGROUND"
          : selectedRun.isHigroundStart
            ? "START HIGROUND · RUN LOG"
            : "RUN LOG · HIGROUND"
      : isDark
        ? "LEVEL UP ACHIEVEMENT"
        : "HIGROUND RUN CLUB";

    ctx.fillStyle = "#241917";
    drawRoundedRect(ctx, 110, 36, 320, 30, 15);
    ctx.fill();
    ctx.strokeStyle = "#FF5F0E";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.fillStyle = "#F7D046";
    ctx.font = "900 12px system-ui, sans-serif";
    ctx.fillText(pill, W / 2, 56);

    ctx.fillStyle = isDark ? "#F7D046" : "#FF5F0E";
    ctx.font = "900 35px system-ui, sans-serif";
    ctx.fillText("HIGROUND RUN CLUB", W / 2, 108);
    ctx.fillStyle = isDark ? "#FFF8EA" : "#241917";
    ctx.font = "700 15px system-ui, sans-serif";
    ctx.fillText(
      selectedRun ? `${selectedRun.name} · ${selectedRun.dateLabel}` : "Harapan Indah · Coffee & Sports Hub",
      W / 2,
      134,
    );

    // Card frame
    ctx.fillStyle = "#241917";
    ctx.fillRect(40, 164, 468, 434);
    ctx.fillStyle = "#FFF8EA";
    ctx.fillRect(32, 156, 468, 434);
    ctx.strokeStyle = "#241917";
    ctx.lineWidth = 5;
    ctx.strokeRect(32, 156, 468, 434);

    // Stage sky & asphalt
    ctx.fillStyle = isDark ? "#5E64CE" : "#C8E6FA";
    ctx.fillRect(52, 176, 428, 172);
    ctx.fillStyle = "#6B6660";
    ctx.fillRect(52, 348, 428, 94);
    ctx.strokeRect(52, 176, 428, 266);

    // Scrolling yellow road dashes
    ctx.fillStyle = "#F7D046";
    const shift = (frame * (isWalk ? 3 : 6)) % 64;
    for (let rx = 52 - shift; rx < 480; rx += 64) {
      ctx.fillRect(Math.max(52, rx), 392, 28, 6);
    }

    ctx.imageSmoothingEnabled = false;
    if (gateImg) ctx.drawImage(gateImg, 62, 276, 130, 118);
    const hop = Math.abs(Math.sin(frame * 0.25)) * 8;
    if (mascotImg && activeBuddies.length < 2) ctx.drawImage(mascotImg, 358, 294 - hop, 102, 102);

    // Characters (main + up to 2 buddies)
    const step = Math.floor(frame / (pose === "run" ? 4 : 8));
    const bob = pose === "run" ? Math.abs(Math.sin(frame * 0.42)) * 10 : 0;
    if (activeBuddies[0]) {
      const bBob = Math.abs(Math.sin(frame * 0.42 + 1.4)) * 8;
      drawPixelSprite(ctx, activeBuddies[0].avatar, pose, step + 1, W / 2 - 92, 418 - bBob, 128);
    }
    if (activeBuddies[1]) {
      const bBob = Math.abs(Math.sin(frame * 0.42 + 2.8)) * 8;
      drawPixelSprite(ctx, activeBuddies[1].avatar, pose, step + 2, W / 2 + 92, 418 - bBob, 128);
    }
    drawPixelSprite(ctx, baseProps.avatar, pose, step, W / 2, 420 - bob, hasBuddies ? 156 : 172);

    // Runner info
    ctx.textAlign = "left";
    ctx.fillStyle = "#241917";
    ctx.font = "900 24px system-ui, sans-serif";
    ctx.fillText(baseProps.displayName, 54, 480);
    ctx.fillStyle = "#6B5B4B";
    ctx.font = "700 13px system-ui, sans-serif";
    ctx.fillText(`@${baseProps.handle} · Lv ${baseProps.level} ${baseProps.title}`, 54, 502);

    let nextY = 514;
    if (hasBuddies) {
      ctx.fillStyle = "#FFF1E6";
      ctx.fillRect(52, nextY, 428, 30);
      ctx.strokeStyle = "#FF5F0E";
      ctx.lineWidth = 2;
      ctx.strokeRect(52, nextY, 428, 30);
      ctx.fillStyle = "#241917";
      ctx.font = "800 13px system-ui, sans-serif";
      const names = activeBuddies.slice(0, 3).map((b) => b.displayName.split(" ")[0]).join(", ");
      const more = activeBuddies.length > 3 ? ` +${activeBuddies.length - 3}` : "";
      ctx.fillText(`Lari bareng: ${names}${more}`, 62, nextY + 20);
      nextY += 36;
    }

    if (caption) {
      ctx.fillStyle = "#EFE1C4";
      ctx.fillRect(52, nextY, 428, 32);
      ctx.fillStyle = "#3B261C";
      ctx.font = "700 13px system-ui, sans-serif";
      ctx.fillText(`"${caption.slice(0, 48)}"`, 62, nextY + 21);
    }

    // 4 Stat boxes
    ctx.strokeStyle = "#241917";
    ctx.lineWidth = 4;
    const stats = selectedRun
      ? [
          { l: isWalk ? "JARAK JALAN" : "JARAK LARI", v: `${selectedRun.distanceKm.toFixed(2).replace(".", ",")} km`, bg: isWalk ? "#2F7D4B" : "#FF5F0E", fg: "#FFF8EA", x: 32, y: 616 },
          { l: "PACE RATA-RATA", v: selectedRun.paceLabel, bg: "#F7D046", fg: "#241917", x: 276, y: 616 },
          { l: "DURASI", v: selectedRun.durationLabel, bg: "#FFF8EA", fg: "#241917", x: 32, y: 718 },
          {
            l: hasBuddies ? "SQUAD LARI" : selectedRun.isHigroundStart ? "LOKASI START" : "MINGGU INI",
            v: hasBuddies ? `${activeBuddies.length + 1} Pelari` : selectedRun.isHigroundStart ? "Higround" : `${baseProps.weekKm.toFixed(1).replace(".", ",")} km`,
            bg: "#FFF8EA", fg: "#241917", x: 276, y: 718,
          },
        ]
      : [
          { l: "MINGGU INI", v: `${baseProps.weekKm.toFixed(1).replace(".", ",")} km`, bg: "#FF5F0E", fg: "#FFF8EA", x: 32, y: 616 },
          { l: "TOTAL XP", v: `${baseProps.totalXp.toLocaleString("id-ID")} XP`, bg: "#F7D046", fg: "#241917", x: 276, y: 616 },
          { l: "START HIGROUND", v: `${baseProps.higroundStarts}x`, bg: "#FFF8EA", fg: "#241917", x: 32, y: 718 },
          { l: "TOTAL LARI", v: `${baseProps.totalKm.toFixed(0)} km`, bg: "#FFF8EA", fg: "#241917", x: 276, y: 718 },
        ];

    for (const s of stats) {
      ctx.fillStyle = "#241917";
      ctx.fillRect(s.x + 4, s.y + 4, 232, 84);
      ctx.fillStyle = s.bg;
      ctx.fillRect(s.x, s.y, 232, 84);
      ctx.strokeRect(s.x, s.y, 232, 84);
      ctx.fillStyle = s.fg;
      ctx.font = "800 11px system-ui, sans-serif";
      ctx.fillText(s.l, s.x + 14, s.y + 28);
      ctx.font = "900 22px system-ui, sans-serif";
      ctx.fillText(s.v, s.x + 14, s.y + 62);
    }

    // PB pills / badges
    const pills = selectedRun && selectedRun.pbLabels.length > 0 ? selectedRun.pbLabels : baseProps.badges.slice(0, 3);
    if (pills.length > 0) {
      ctx.textAlign = "center";
      ctx.fillStyle = isDark ? "#F7D046" : "#241917";
      ctx.font = "800 13px system-ui, sans-serif";
      ctx.fillText(pills.join("  ·  "), W / 2, 846);
    }

    ctx.textAlign = "center";
    ctx.fillStyle = isDark ? "#FFF8EA" : "#241917";
    ctx.font = "800 14px system-ui, sans-serif";
    ctx.fillText("@HIGROUND.COFFEE · ONE BITE SAYS IT ALL", W / 2, 896);
  };

  /**
   * Draw TRUE transparent 540x960 sticker overlay (scaled 2x to 1080x1920 PNG).
   * Zero background fill so the exported PNG pastes cleanly over any IG Story photo!
   */
  const drawStickerFrame = (ctx: CanvasRenderingContext2D) => {
    const W = 540, H = 960;
    ctx.clearRect(0, 0, W, H);
    ctx.imageSmoothingEnabled = false;

    const fg = stickerInk === "light" ? "#FFFFFF" : "#181412";
    const stroke = stickerInk === "light" ? "rgba(0,0,0,0.85)" : "rgba(255,255,255,0.9)";
    const accent = "#FF5F0E";
    const isWalk = Boolean(selectedRun?.isWalk);
    const pose: AnimPose = isWalk ? "walk" : "run";

    const outlineText = (text: string, x: number, y: number, font: string, color = fg, lw = 7) => {
      ctx.font = font;
      ctx.lineJoin = "round";
      ctx.lineWidth = lw;
      ctx.strokeStyle = stroke;
      ctx.strokeText(text, x, y);
      ctx.fillStyle = color;
      ctx.fillText(text, x, y);
    };

    ctx.textAlign = "center";

    // Top brand tag pill
    ctx.fillStyle = "#241917";
    drawRoundedRect(ctx, 130, 86, 280, 34, 17);
    ctx.fill();
    ctx.strokeStyle = accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = "#F7D046";
    ctx.font = "900 13px system-ui, sans-serif";
    ctx.fillText("HIGROUND RUN CLUB", W / 2, 108);

    // Date / activity subtitle
    outlineText(
      selectedRun ? `${selectedRun.name.toUpperCase()} · ${selectedRun.dateLabel}` : `MINGGU INI · LV ${baseProps.level} ${baseProps.title.toUpperCase()}`,
      W / 2,
      152,
      "800 14px system-ui, sans-serif",
      fg,
      5,
    );

    // Hero KM figure
    const heroNum = selectedRun
      ? selectedRun.distanceKm.toFixed(2).replace(".", ",")
      : baseProps.weekKm.toFixed(1).replace(".", ",");
    outlineText(`${heroNum} KM`, W / 2, 248, "900 84px system-ui, sans-serif", fg, 12);

    // Secondary metrics row (Pace & Duration for single run; Total KM & Start HG for summary)
    if (selectedRun) {
      outlineText("PACE", 150, 304, "800 13px system-ui, sans-serif", "#F7D046", 5);
      outlineText(selectedRun.paceLabel, 150, 344, "900 32px system-ui, sans-serif", fg, 8);

      outlineText("DURASI", 390, 304, "800 13px system-ui, sans-serif", "#F7D046", 5);
      outlineText(selectedRun.durationLabel, 390, 344, "900 32px system-ui, sans-serif", fg, 8);
    } else {
      outlineText("TOTAL LARI", 150, 304, "800 13px system-ui, sans-serif", "#F7D046", 5);
      outlineText(`${baseProps.totalKm.toFixed(0)} KM`, 150, 344, "900 32px system-ui, sans-serif", fg, 8);

      outlineText("START HIGROUND", 390, 304, "800 13px system-ui, sans-serif", "#F7D046", 5);
      outlineText(`${baseProps.higroundStarts}×`, 390, 344, "900 32px system-ui, sans-serif", fg, 8);
    }

    // Center Pixel Character + Optional Run Buddy Squad!
    const feetY = 670;
    if (activeBuddies[0]) {
      drawPixelSprite(ctx, activeBuddies[0].avatar, pose, 1, W / 2 - 125, feetY - 6, 176);
      outlineText(activeBuddies[0].displayName.split(" ")[0], W / 2 - 125, feetY + 26, "900 14px system-ui, sans-serif", fg, 5);
    }
    if (activeBuddies[1]) {
      drawPixelSprite(ctx, activeBuddies[1].avatar, pose, 2, W / 2 + 125, feetY - 6, 176);
      outlineText(activeBuddies[1].displayName.split(" ")[0], W / 2 + 125, feetY + 26, "900 14px system-ui, sans-serif", fg, 5);
    }
    drawPixelSprite(ctx, baseProps.avatar, pose, 0, W / 2, feetY, hasBuddies ? 210 : 230);
    outlineText(baseProps.displayName, W / 2, feetY + 30, "900 18px system-ui, sans-serif", fg, 6);

    // Pills: Start Higround, PB, Run Buddy Squad
    let pillY = 730;
    if (selectedRun?.isHigroundStart) {
      ctx.fillStyle = accent;
      drawRoundedRect(ctx, 165, pillY, 210, 34, 17);
      ctx.fill();
      ctx.strokeStyle = "#241917";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "900 14px system-ui, sans-serif";
      ctx.fillText("START DARI HIGROUND", W / 2, pillY + 22);
      pillY += 44;
    }

    if (selectedRun && selectedRun.pbLabels.length > 0) {
      ctx.fillStyle = "#F7D046";
      drawRoundedRect(ctx, 150, pillY, 240, 34, 17);
      ctx.fill();
      ctx.strokeStyle = "#241917";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = "#241917";
      ctx.font = "900 14px system-ui, sans-serif";
      ctx.fillText(`NEW ${selectedRun.pbLabels.slice(0, 2).join(" · ")}`, W / 2, pillY + 22);
      pillY += 44;
    }

    if (hasBuddies) {
      const names = activeBuddies.slice(0, 3).map((b) => `@${b.handle}`).join(" ");
      const more = activeBuddies.length > 3 ? ` +${activeBuddies.length - 3}` : "";
      outlineText(`LARI BARENG ${names}${more}`, W / 2, pillY + 18, "900 16px system-ui, sans-serif", "#F7D046", 6);
      pillY += 36;
    }

    if (caption) {
      outlineText(`"${caption.slice(0, 44)}"`, W / 2, Math.min(846, pillY + 18), "700 15px system-ui, sans-serif", fg, 5);
    }

    outlineText("@HIGROUND.COFFEE · HARAPAN INDAH", W / 2, 898, "900 14px system-ui, sans-serif", fg, 5);
  };

  const loadImg = (src: string) =>
    new Promise<HTMLImageElement | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });

  const renderPngBlob = async (): Promise<{ blob: Blob; filename: string }> => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1920;
    const ctx = canvas.getContext("2d")!;
    ctx.scale(2, 2);

    if (layoutMode === "sticker") {
      drawStickerFrame(ctx);
    } else {
      const [gate, mascot] = await Promise.all([
        loadImg("/assets/world/landmarks/start_gate.png"),
        loadImg("/assets/world/mascot/guide_cheer.png"),
      ]);
      drawStoryFrame(ctx, 18, gate, mascot);
    }

    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Gagal membuat PNG"))), "image/png");
    });
    const suffix = layoutMode === "sticker" ? "stiker" : template;
    const runSlug = selectedRun ? `-${selectedRun.distanceKm.toFixed(1)}km` : "";
    return { blob, filename: `higround-${baseProps.handle}${runSlug}-${suffix}.png` };
  };

  const downloadPng = async () => {
    void sfx.cashier();
    setExportStatus(layoutMode === "sticker" ? "Merender Stiker Transparan 1080×1920..." : "Merender Kartu PNG 1080×1920...");
    const { blob, filename } = await renderPngBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setExportStatus(
      layoutMode === "sticker"
        ? "Stiker Transparan PNG berhasil didownload! Tempel langsung di atas foto IG Story kamu."
        : "Kartu PNG IG Story (1080×1920) berhasil didownload!",
    );
  };

  const nativeSharePng = async () => {
    void sfx.pop();
    setExportStatus("Menyiapkan gambar untuk Share...");
    const { blob, filename } = await renderPngBlob();
    const file = new File([blob], filename, { type: "image/png" });
    if (typeof navigator !== "undefined" && navigator.share && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Higround Run Club",
          text: caption || "Higround Run Club Story",
        });
        setExportStatus("Berhasil dibagikan!");
        return;
      } catch {
        // User canceled or unsupported — fall through cleanly
      }
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 3000);
    setExportStatus("Gambar disimpan ke perangkat (siap upload ke IG Story).");
  };

  const exportWebm = async () => {
    if (typeof MediaRecorder === "undefined") {
      setExportStatus("Browser tidak mendukung perekaman video langsung — gunakan Download PNG.");
      return;
    }
    void sfx.levelUp();
    setExportStatus("Merekam video animasi 4 detik...");
    const [gate, mascot] = await Promise.all([
      loadImg("/assets/world/landmarks/start_gate.png"),
      loadImg("/assets/world/mascot/guide_cheer.png"),
    ]);
    const canvas = document.createElement("canvas");
    canvas.width = 540;
    canvas.height = 960;
    const ctx = canvas.getContext("2d")!;
    const stream = canvas.captureStream(30);
    const rec = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm",
    });
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
    const totalFrames = 120;
    const tick = () => {
      drawStoryFrame(ctx, f, gate, mascot);
      f++;
      if (f < totalFrames) setTimeout(tick, 33);
      else rec.stop();
    };
    tick();
  };

  const previewTextShadow =
    stickerInk === "light"
      ? "0 2px 6px rgba(0,0,0,0.9), 0 0 2px rgba(0,0,0,0.95)"
      : "0 2px 6px rgba(255,255,255,0.95), 0 0 2px rgba(255,255,255,0.95)";

  return (
    <div className="grid gap-6 lg:grid-cols-[360px_1fr] items-start">
      {/* 9:16 Live Preview Frame (Card Pixel Remotion Player OR Transparent Sticker Preview) */}
      <SpringPop className="mx-auto w-full max-w-[340px]">
        <div className="pixel-frame-orange overflow-hidden rounded-[26px] bg-[#241917] p-2.5">
          <div className="overflow-hidden rounded-[18px] border-2 border-[#241917]">
            {layoutMode === "card" ? (
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
            ) : (
              /* Live Transparent Sticker Preview on a checkerboard backdrop */
              <div
                className="relative flex flex-col items-center justify-between px-4 py-6 text-center"
                style={{
                  width: "100%",
                  aspectRatio: "9 / 16",
                  backgroundColor: stickerInk === "light" ? "#2a2b32" : "#e9e5dc",
                  backgroundImage:
                    stickerInk === "light"
                      ? "linear-gradient(45deg, #353740 25%, transparent 25%), linear-gradient(-45deg, #353740 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #353740 75%), linear-gradient(-45deg, transparent 75%, #353740 75%)"
                      : "linear-gradient(45deg, #dcd7cc 25%, transparent 25%), linear-gradient(-45deg, #dcd7cc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #dcd7cc 75%), linear-gradient(-45deg, transparent 75%, #dcd7cc 75%)",
                  backgroundSize: "20px 20px",
                  backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
                  color: stickerInk === "light" ? "#FFFFFF" : "#181412",
                }}
              >
                <div className="space-y-1.5">
                  <span className="inline-block rounded-full border-2 border-hg-orange bg-[#241917] px-3 py-0.5 text-[10px] font-black tracking-wider text-hg-yellow">
                    HIGROUND RUN CLUB
                  </span>
                  <div className="text-[11px] font-extrabold uppercase tracking-wide" style={{ textShadow: previewTextShadow }}>
                    {selectedRun ? `${selectedRun.name} · ${selectedRun.dateLabel}` : `Minggu Ini · Lv ${baseProps.level} ${baseProps.title}`}
                  </div>
                  <div className="text-4xl font-black tracking-tight tabular-nums leading-none" style={{ textShadow: previewTextShadow }}>
                    {selectedRun
                      ? `${selectedRun.distanceKm.toFixed(2).replace(".", ",")} KM`
                      : `${baseProps.weekKm.toFixed(1).replace(".", ",")} KM`}
                  </div>
                  <div className="flex items-center justify-center gap-6 pt-1">
                    {selectedRun ? (
                      <>
                        <div>
                          <div className="text-[9px] font-extrabold text-hg-yellow" style={{ textShadow: previewTextShadow }}>PACE</div>
                          <div className="text-lg font-black tabular-nums" style={{ textShadow: previewTextShadow }}>{selectedRun.paceLabel}</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-extrabold text-hg-yellow" style={{ textShadow: previewTextShadow }}>DURASI</div>
                          <div className="text-lg font-black tabular-nums" style={{ textShadow: previewTextShadow }}>{selectedRun.durationLabel}</div>
                        </div>
                      </>
                    ) : (
                      <>
                        <div>
                          <div className="text-[9px] font-extrabold text-hg-yellow" style={{ textShadow: previewTextShadow }}>TOTAL LARI</div>
                          <div className="text-lg font-black tabular-nums" style={{ textShadow: previewTextShadow }}>{baseProps.totalKm.toFixed(0)} KM</div>
                        </div>
                        <div>
                          <div className="text-[9px] font-extrabold text-hg-yellow" style={{ textShadow: previewTextShadow }}>START HG</div>
                          <div className="text-lg font-black tabular-nums" style={{ textShadow: previewTextShadow }}>{baseProps.higroundStarts}×</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Squad / Character Sprite */}
                <div className="flex flex-col items-center">
                  <div className="flex items-end justify-center gap-1">
                    {activeBuddies[0] && (
                      <Avatar avatar={activeBuddies[0].avatar} size={78} pose={selectedRun?.isWalk ? "walk" : "run"} frame={1} label={activeBuddies[0].displayName} />
                    )}
                    <Avatar avatar={baseProps.avatar} size={hasBuddies ? 96 : 112} pose={selectedRun?.isWalk ? "walk" : "run"} frame={0} label={baseProps.displayName} />
                    {activeBuddies[1] && (
                      <Avatar avatar={activeBuddies[1].avatar} size={78} pose={selectedRun?.isWalk ? "walk" : "run"} frame={2} label={activeBuddies[1].displayName} />
                    )}
                  </div>
                  <div className="mt-1 text-xs font-black" style={{ textShadow: previewTextShadow }}>
                    {baseProps.displayName}
                  </div>
                </div>

                {/* Bottom Pills + Watermark */}
                <div className="space-y-1.5">
                  <div className="flex flex-wrap justify-center gap-1">
                    {selectedRun?.isHigroundStart && (
                      <span className="rounded-full border-2 border-[#241917] bg-hg-orange px-2.5 py-0.5 text-[10px] font-black text-white">
                        START DARI HIGROUND
                      </span>
                    )}
                    {selectedRun?.pbLabels.slice(0, 2).map((l) => (
                      <span key={l} className="rounded-full border-2 border-[#241917] bg-hg-yellow px-2.5 py-0.5 text-[10px] font-black text-[#241917]">
                        ⚡ {l}
                      </span>
                    ))}
                  </div>
                  {hasBuddies && (
                    <div className="text-[11px] font-black text-hg-yellow" style={{ textShadow: previewTextShadow }}>
                      🤝 Lari bareng {activeBuddies.slice(0, 3).map((b) => `@${b.handle}`).join(" ")}
                      {activeBuddies.length > 3 ? ` +${activeBuddies.length - 3}` : ""}
                    </div>
                  )}
                  {caption && (
                    <div className="text-[11px] font-bold" style={{ textShadow: previewTextShadow }}>
                      &ldquo;{caption.slice(0, 44)}&rdquo;
                    </div>
                  )}
                  <div className="text-[10px] font-black tracking-wider opacity-90" style={{ textShadow: previewTextShadow }}>
                    @HIGROUND.COFFEE · HARAPAN INDAH
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        {layoutMode === "sticker" && (
          <p className="mt-2 text-center text-[11px] text-neutral-500">
            Kotak catur = area <b>transparan</b> (tidak ikut terekspor di PNG).
          </p>
        )}
      </SpringPop>

      {/* Controls & Export Panel */}
      <div className="space-y-4">
        <div className="pixel-frame rounded-xl bg-[#FFF8EA] p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <span className="rounded bg-hg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
                IG Story Studio v2 · 9:16
              </span>
              <h2 className="mt-1 font-pixel text-2xl leading-none">Share Lari &amp; Squad ke IG Story</h2>
            </div>
            <div className="flex gap-2">
              <Link href={`/u/${baseProps.handle}`} className="pixel-btn rounded-md bg-white px-3 py-1 text-xs font-bold">
                ← Profil
              </Link>
              <Link href="/world" className="pixel-btn rounded-md bg-white px-3 py-1 text-xs font-bold">
                Dunia
              </Link>
            </div>
          </div>

          {/* 1. Layout Mode Toggle: Card Pixel vs Stiker Transparan (Opsi C) */}
          <div>
            <label className="mb-1.5 block font-pixel text-sm">1. Pilih Format Story</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => { void sfx.pop(); setLayoutMode("card"); }}
                className={`pixel-btn rounded-lg px-3 py-2.5 text-left text-xs font-bold ${
                  layoutMode === "card" ? "bg-hg-orange text-white" : "bg-white text-[#241917]"
                }`}
              >
                <span className="block text-base">🖼️ Card Pixel</span>
                <span className="block text-[11px] font-normal opacity-90">Kartu diorama full + video animasi</span>
              </button>
              <button
                type="button"
                onClick={() => { void sfx.pop(); setLayoutMode("sticker"); }}
                className={`pixel-btn rounded-lg px-3 py-2.5 text-left text-xs font-bold ${
                  layoutMode === "sticker" ? "bg-hg-navy text-white" : "bg-white text-[#241917]"
                }`}
              >
                <span className="block text-base">✨ Stiker Transparan</span>
                <span className="block text-[11px] font-normal opacity-90">PNG transparan ala Strava/NRC</span>
              </button>
            </div>
          </div>

          {/* 2. Activity / Data Source Picker */}
          <div>
            <label className="mb-1.5 block font-pixel text-sm" htmlFor="story-source">
              2. Pilih Data / Sesi Lari
            </label>
            <select
              id="story-source"
              value={selectedRunId}
              onChange={(e) => handleSelectRun(e.target.value)}
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-2 text-sm font-bold text-[#241917]"
            >
              <option value="">📊 Ringkasan Profil (Minggu ini {baseProps.weekKm.toFixed(1).replace(".", ",")} km)</option>
              {recentRuns.map((r) => {
                const tags = [
                  r.buddies.length > 0 ? `🤝 +${r.buddies.length}` : "",
                  r.isWalk ? "🚶" : "🏃",
                  r.pbLabels.length > 0 ? `⚡${r.pbLabels[0]}` : "",
                  r.isHigroundStart ? "☕HG" : "",
                ].filter(Boolean).join(" ");
                return (
                  <option key={r.id} value={r.id}>
                    {tags} {r.name} · {r.distanceKm.toFixed(2).replace(".", ",")} km ({r.dateLabel})
                  </option>
                );
              })}
            </select>

            {/* Squad Lari Bareng toggle when buddies are detected */}
            {selectedRun && selectedRun.buddies.length > 0 && (
              <label className="mt-2 flex cursor-pointer items-center gap-2 rounded-md border-2 border-hg-orange bg-[#FFF1E6] px-3 py-2 text-xs font-bold text-[#241917]">
                <input
                  type="checkbox"
                  checked={showBuddies}
                  onChange={(e) => setShowBuddies(e.target.checked)}
                  className="h-4 w-4 accent-[#FF5F0E]"
                />
                <span>
                  🤝 Tampilkan squad Lari Bareng ({selectedRun.buddies.map((b) => b.displayName).join(", ")})
                </span>
              </label>
            )}
          </div>

          {/* 3. Theme / Ink Options */}
          {layoutMode === "card" ? (
            <div>
              <label className="mb-1.5 block font-pixel text-sm">3. Tema Kartu Pixel</label>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => { void sfx.pop(); setTemplate(t.id); }}
                    className={`pixel-btn rounded-lg px-2.5 py-2 text-xs font-bold ${
                      template === t.id ? "bg-hg-orange text-white" : "bg-white text-[#241917]"
                    }`}
                  >
                    <span className="mr-1 text-base">{t.icon}</span>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="mb-1.5 block font-pixel text-sm">3. Warna Teks Stiker</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { void sfx.pop(); setStickerInk("light"); }}
                  className={`pixel-btn rounded-lg px-3 py-2 text-xs font-bold ${
                    stickerInk === "light" ? "bg-[#241917] text-white" : "bg-white text-[#241917]"
                  }`}
                >
                  ☀️ Teks Putih (untuk foto gelap/outdoor)
                </button>
                <button
                  type="button"
                  onClick={() => { void sfx.pop(); setStickerInk("dark"); }}
                  className={`pixel-btn rounded-lg px-3 py-2 text-xs font-bold ${
                    stickerInk === "dark" ? "bg-hg-yellow text-[#241917]" : "bg-white text-[#241917]"
                  }`}
                >
                  🌑 Teks Gelap (untuk foto terang)
                </button>
              </div>
            </div>
          )}

          {/* 4. Caption Input */}
          <div>
            <label className="mb-1 block font-pixel text-sm" htmlFor="story-caption">
              4. Caption Singkat
            </label>
            <input
              id="story-caption"
              value={caption}
              maxLength={60}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Tulis caption opsional..."
              className="w-full rounded-md border-2 border-[#2b1d17] bg-white px-3 py-2 text-sm font-medium"
            />
          </div>

          {/* Export / Share Buttons */}
          <div className="flex flex-wrap gap-2.5 pt-1">
            <button
              type="button"
              onClick={downloadPng}
              className="pixel-btn rounded-lg bg-hg-orange px-4 py-2.5 font-pixel text-sm text-white"
            >
              {layoutMode === "sticker" ? "✨ Download Stiker Transparan (PNG)" : "📸 Download Kartu PNG (1080×1920)"}
            </button>
            <button
              type="button"
              onClick={nativeSharePng}
              className="pixel-btn rounded-lg bg-hg-yellow px-4 py-2.5 font-pixel text-sm text-[#241917]"
            >
              📤 Share / Simpan ke Foto
            </button>
            {layoutMode === "card" && (
              <button
                type="button"
                onClick={exportWebm}
                className="pixel-btn rounded-lg bg-white px-4 py-2.5 font-pixel text-sm text-[#241917]"
              >
                🎬 Download Video (.webm)
              </button>
            )}
          </div>

          {exportStatus && (
            <p role="status" className="rounded-md border-2 border-[#2b1d17] bg-[#EFE1C4] px-3 py-2 text-xs font-bold text-[#241917]">
              ✅ {exportStatus}
            </p>
          )}
        </div>

        <div className="pixel-frame rounded-xl bg-[#EFE1C4]/80 p-3.5 text-xs text-neutral-700 space-y-1">
          <div className="font-bold text-[#241917]">Cara pakai Stiker Transparan di Instagram Story (iPhone):</div>
          <p>
            1. Pilih <b>✨ Stiker Transparan</b> → tap <b>📤 Share / Simpan ke Foto</b> (Save Image).
            <br />
            2. Buka IG Story → pilih foto lari atau kopi kamu → tap ikon <b>Stiker → Foto</b> → pilih PNG stiker Higround!
          </p>
        </div>
      </div>
    </div>
  );
}
