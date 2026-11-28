"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber, LevelUpModal, SpringPop } from "@/components/SpringUI";
import type { StudioModeOverride, WorldGame } from "@/game/createWorldGame";
import { sfx } from "@/lib/audio/sfx";
import { CAFE_MENU, resolvePlaylistEmbed } from "@/lib/cafe";
import type { WorldMember, WorldView } from "@/lib/data/service";
import { km } from "@/lib/format";
import { SCENES, type SceneKey } from "@/lib/world/layout";
import { dayPhase, wibHour } from "@/lib/world/agents";
import { PoiPopup, WorldDrawer, type DrawerTab } from "./WorldDrawers";

const ICON: Record<string, string> = {
  shoe: "👟", road: "🛣️", medal: "🏅", pin: "📍", flame: "🔥", lotus: "🪷", star: "🌟", wave: "🌊", pose: "🤸",
};

const PLAYLIST = resolvePlaylistEmbed(process.env.NEXT_PUBLIC_HIGROUND_PLAYLIST_URL);

export function WorldClient({
  world,
  meHandle,
}: {
  world: WorldView;
  meHandle: string | null;
}) {
  const { hud, ticker, clubQuest, rukoUpgrade, rewards } = world;
  const [members, setMembers] = useState<WorldMember[]>(world.members);
  const membersRef = useRef<WorldMember[]>(world.members);
  membersRef.current = members;
  const meMember = members.find((m) => m.isMe) ?? null;

  const box = useRef<HTMLDivElement>(null);
  const game = useRef<WorldGame | null>(null);
  const hour = wibHour(Date.now());
  const [scene, setScene] = useState<SceneKey>(hour >= 5 && hour < 10 ? "street" : "floor1");
  const [zoom, setZoom] = useState(2);
  const [studioMode, setStudioMode] = useState<StudioModeOverride>("auto");
  const [selected, setSelected] = useState<WorldMember | null>(null);
  const [selectedPoi, setSelectedPoi] = useState<string | null>(null);
  const [drawer, setDrawer] = useState<DrawerTab>(null);
  const [cheered, setCheered] = useState(false);
  const [showLevelModal, setShowLevelModal] = useState(false);
  const [muted, setMuted] = useState(false);
  const [bgmOn, setBgmOn] = useState(false);
  const [musicOpen, setMusicOpen] = useState(false);
  const [musicLoaded, setMusicLoaded] = useState(false);
  const [showGamepad, setShowGamepad] = useState(true);
  const [controlMode, setControlMode] = useState<"auto" | "manual">("auto");
  const [activeDir, setActiveDir] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<SceneKey, number>>({ street: 0, floor1: 0, floor2: 0 });
  const [clock, setClock] = useState("");

  useEffect(() => {
    setMuted(sfx.isMuted());
    return () => { sfx.stopBgm(); };
  }, []);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    const tickClock = () => setClock(fmt.format(new Date()));
    tickClock();
    const id = setInterval(tickClock, 15_000);
    return () => clearInterval(id);
  }, []);

  // Live online presence heartbeat: only online members stay on the map & in Online drawer
  useEffect(() => {
    let alive = true;
    const ping = async () => {
      try {
        const res = await fetch("/api/world/presence", { method: "POST", cache: "no-store" });
        if (!res.ok || !alive) return;
        const data = (await res.json()) as { ok?: boolean; members?: WorldMember[] };
        if (!data.ok || !Array.isArray(data.members) || !alive) return;
        setMembers(data.members);
        game.current?.syncMembers(
          data.members.map((m) => ({
            id: m.id, name: m.name, avatar: m.avatar, ranToday: m.ranToday, yogaStars: m.yogaStars,
            isMe: m.isMe, level: m.level, weeklyRank: m.weeklyRank,
          })),
        );
      } catch {
        // transient network hiccup — next heartbeat will recover
      }
    };
    const sendOffline = () => {
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/world/presence?offline=1");
      }
    };
    const id = setInterval(ping, 15_000);
    const onVisible = () => { if (document.visibilityState === "visible") void ping(); };
    window.addEventListener("pagehide", sendOffline);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      alive = false;
      clearInterval(id);
      window.removeEventListener("pagehide", sendOffline);
      document.removeEventListener("visibilitychange", onVisible);
      sendOffline();
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const startZoom = 2;
    setZoom(startZoom);
    import("@/game/createWorldGame").then(({ createWorldGame }) => {
      if (!alive || !box.current) return;
      game.current = createWorldGame(box.current, {
        members: membersRef.current.map((m) => ({
          id: m.id, name: m.name, avatar: m.avatar, ranToday: m.ranToday, yogaStars: m.yogaStars,
          isMe: m.isMe, level: m.level, weeklyRank: m.weeklyRank,
        })),
        initialScene: scene,
        initialZoom: startZoom,
        upgrades: rukoUpgrade.unlocks,
        hasActiveEvent: Boolean(hud.event),
        onSelect: (id) => {
          setSelectedPoi(null);
          setCheered(false);
          setSelected(membersRef.current.find((m) => m.id === id) ?? null);
        },
        onSelectPoi: (poiKey) => {
          setSelected(null);
          setSelectedPoi(poiKey);
        },
        onSceneCount: setCounts,
        onControlMode: setControlMode,
      });
    });
    return () => {
      alive = false;
      game.current?.destroy();
      game.current = null;
    };
    // created once; scene, zoom and member presence updates go through the imperative WorldGame handle
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Desktop Arrow Keys / WASD steering (with automatic 4s Auto-Walk fallback on release)
  useEffect(() => {
    if (!meHandle) return;
    const pressed = new Set<string>();
    const syncKeys = () => {
      let dx = 0;
      let dy = 0;
      if (pressed.has("ArrowLeft") || pressed.has("a") || pressed.has("A")) dx -= 1;
      if (pressed.has("ArrowRight") || pressed.has("d") || pressed.has("D")) dx += 1;
      if (pressed.has("ArrowUp") || pressed.has("w") || pressed.has("W")) dy -= 1;
      if (pressed.has("ArrowDown") || pressed.has("s") || pressed.has("S")) dy += 1;
      game.current?.setMoveInput(dx, dy);
    };
    const isMoveKey = (k: string) =>
      ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "w", "a", "s", "d", "W", "A", "S", "D"].includes(k);
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
      if (!isMoveKey(e.key)) return;
      e.preventDefault();
      pressed.add(e.key);
      syncKeys();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      if (!pressed.has(e.key)) return;
      pressed.delete(e.key);
      syncKeys();
    };
    const onBlur = () => {
      if (pressed.size > 0) {
        pressed.clear();
        syncKeys();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", onBlur);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", onBlur);
    };
  }, [meHandle]);

  const holdDir = useCallback((key: string, dx: number, dy: number) => {
    setActiveDir(key);
    game.current?.setMoveInput(dx, dy);
  }, []);

  const releaseDir = useCallback(() => {
    setActiveDir(null);
    game.current?.setMoveInput(0, 0);
  }, []);

  const pick = (k: SceneKey) => { void sfx.select(); setScene(k); game.current?.setScene(k); setSelected(null); setSelectedPoi(null); };
  const zoomTo = (z: number) => { void sfx.pop(z); setZoom(z); game.current?.setZoom(z); };
  const switchStudio = (m: StudioModeOverride) => { void sfx.select(); setStudioMode(m); game.current?.setStudioMode(m); };
  const findMe = () => {
    void sfx.select();
    const target = game.current?.focusMe();
    if (target) setScene(target);
  };
  const jumpToMember = (m: WorldMember) => {
    void sfx.select();
    const target = game.current?.focusMember(m.id);
    if (target) setScene(target);
    setSelected(m);
  };
  const cheerMember = (m: WorldMember) => {
    void sfx.cheer();
    game.current?.cheerMember(m.id);
  };
  const toggleMute = () => {
    const next = !muted;
    sfx.setMuted(next);
    setMuted(next);
    if (next) setBgmOn(false);
    else void sfx.pop(2);
  };
  const toggleSynthBgm = async () => {
    const playing = await sfx.toggleBgm();
    setBgmOn(playing);
    if (playing) setMuted(false);
  };
  const toggleMusicDrawer = () => {
    void sfx.select();
    setMusicLoaded(true);
    setMusicOpen((o) => !o);
  };

  const phase = dayPhase(hour);
  const unlockedVouchers = rewards?.vouchers.filter((v) => v.unlocked).length ?? 0;
  const xpPct = hud.myXpToNext === null ? 100 : Math.round((hud.myXpIntoLevel / (hud.myXpIntoLevel + hud.myXpToNext)) * 100);

  const floorTabs = (compact = false) => (
    <div
      role="tablist"
      aria-label="Lantai"
      className="pixel-frame pointer-events-auto flex items-center gap-0.5 rounded-lg bg-[#FFF8EA]/95 p-0.5 backdrop-blur-sm sm:gap-1 sm:p-1"
    >
      {SCENES.map((k) => (
        <button
          key={k}
          role="tab"
          aria-selected={scene === k}
          onClick={() => pick(k)}
          className={`rounded-md font-bold transition-colors ${
            compact ? "px-2 py-1 text-[11px]" : "px-2.5 py-1 text-xs"
          } ${
            scene === k
              ? "bg-hg-orange text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]"
              : "text-[#241917] hover:bg-[#EFE1C4]"
          }`}
        >
          {k === "street"
            ? "Teras"
            : k === "floor1"
              ? (compact ? "Lt.1" : "Lt.1 Coffee")
              : (compact ? "Lt.2" : "Lt.2 Studio")}{" "}
          <span className="opacity-80">({counts[k]})</span>
        </button>
      ))}
    </div>
  );

  return (
    <div className="space-y-2.5">
      {/* FULL-IMMERSIVE GAME VIEWPORT */}
      <div className="pixel-frame relative h-[78dvh] min-h-[540px] w-full overflow-hidden rounded-xl bg-[#cfe4ce] sm:h-[76vh]">
        {/* Phaser Isometric Canvas */}
        <div
          ref={box}
          className="h-full w-full touch-none select-none [image-rendering:pixelated]"
          aria-label="Dunia Higround"
        />

        {/* UNIFIED NON-OVERLAPPING TOP HUD STACK (Responsive Mobile Portrait + Desktop) */}
        <div className="pointer-events-none absolute inset-x-2 top-2 z-20 flex flex-col gap-1.5 sm:inset-x-3 sm:top-3">
          {/* ROW 1: Player Card (Left) + Desktop Floor Switcher (Center) + Club Quest (Right) */}
          <div className="flex items-start justify-between gap-1.5">
            {/* TOP-LEFT PLAYER CARD */}
            {meMember && hud.myLevel !== null ? (
              <div className="pixel-frame pointer-events-auto flex min-w-0 max-w-[58%] items-center gap-2 rounded-lg bg-[#FFF8EA]/95 px-2 py-1.5 backdrop-blur-sm sm:max-w-none sm:gap-2.5 sm:px-2.5 sm:py-2">
                <Link
                  href="/create?next=%2Fworld"
                  title="Ganti karakter pixel"
                  className="shrink-0 rounded-md border-2 border-[#2b1d17] bg-[#EFE1C4] p-0.5 hover:brightness-95 sm:p-1"
                >
                  <Avatar avatar={meMember.avatar} size={32} label={meMember.name} />
                </Link>
                <div className="min-w-0 flex-1 sm:min-w-[138px]">
                  <div className="flex items-center gap-1">
                    <Link
                      href={`/u/${meMember.handle}`}
                      className="truncate font-pixel text-xs leading-none text-[#241917] hover:underline sm:text-sm"
                    >
                      {meMember.name.split(" ")[0]}
                    </Link>
                    {meMember.weeklyRank && (
                      <span title={`Top #${meMember.weeklyRank} Minggu Ini`} className="text-xs leading-none">
                        {meMember.weeklyRank === 1 ? "🥇" : meMember.weeklyRank === 2 ? "🥈" : "🥉"}
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowLevelModal(true)}
                      title="Lihat status Level & bikin IG Story!"
                      className="shrink-0 rounded bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-hg-yellow hover:bg-hg-orange hover:text-white"
                    >
                      Lv <AnimatedNumber value={hud.myLevel} /> ★
                    </button>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full border border-[#2b1d17] bg-[#EFE1C4] sm:h-2.5">
                    <div className="h-full bg-gradient-to-r from-hg-orange to-hg-yellow" style={{ width: `${xpPct}%` }} />
                  </div>
                  <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] font-bold text-neutral-700">
                    <span className="truncate">{hud.myTitle}</span>
                    <Link
                      href="/create?next=%2Fworld"
                      className="shrink-0 rounded bg-hg-yellow/80 px-1 text-[9px] font-bold text-[#241917] hover:bg-hg-yellow"
                    >
                      🎨 Ganti
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <Link href="/login" className="pixel-btn pointer-events-auto rounded-lg bg-hg-orange px-3 py-2 text-xs font-bold text-white">
                Masuk untuk Gabung →
              </Link>
            )}

            {/* DESKTOP FLOOR SWITCHER & LIVE STATUS */}
            <div className="hidden flex-col items-center gap-1 lg:flex">
              {floorTabs(false)}
              <div className="pixel-frame pointer-events-auto flex items-center gap-2 rounded-lg bg-[#241917]/90 px-2.5 py-0.5 text-[11px] font-bold text-[#FFF8EA]">
                <span className="font-mono text-hg-yellow">{clock || "--.--"} WIB</span>
                <span className="capitalize opacity-85">{phase.name}</span>
                <span className="text-emerald-400">● {members.length} online</span>
              </div>
            </div>

            {/* TOP-RIGHT CLUB QUEST PILL */}
            <div className="flex shrink-0 flex-col items-end gap-1">
              <button
                onClick={() => setDrawer((d) => (d === "club" ? null : "club"))}
                className="pixel-btn pointer-events-auto flex items-center gap-1.5 rounded-lg bg-[#FFF8EA]/95 px-2 py-1.5 text-left text-[11px] font-bold backdrop-blur-sm sm:gap-2 sm:px-2.5 sm:text-xs"
                title="Klik untuk lihat Misi Klub & Upgrade Ruko"
              >
                <span className="text-sm">🏆</span>
                <div>
                  <div className="leading-none text-hg-orange">Misi {clubQuest.pct}%</div>
                  <div className="font-mono text-[9px] text-neutral-700 sm:text-[10px]">
                    {km(clubQuest.currentKm)}/{clubQuest.targetKm} km · T{rukoUpgrade.tier}
                  </div>
                </div>
              </button>

              {hud.event && (
                <button
                  onClick={() => setDrawer((d) => (d === "events" ? null : "events"))}
                  className="pixel-btn pointer-events-auto max-w-[160px] truncate rounded-lg bg-hg-violet px-2 py-0.5 text-[10px] font-bold text-white sm:max-w-none sm:px-2.5 sm:py-1 sm:text-[11px]"
                >
                  ★ {hud.event.name} {hud.event.multiplier > 1 ? `×${hud.event.multiplier}` : ""}
                </button>
              )}
            </div>
          </div>

          {/* ROW 2: Mobile Floor Tabs (Left) + Gamepad / Cari gue / Playlist / Audio / Zoom (Right) */}
          <div className="flex flex-wrap items-center justify-between gap-1.5">
            <div className="flex lg:hidden">{floorTabs(true)}</div>

            <div className="pointer-events-auto ml-auto flex items-center gap-1">
              {meHandle && (
                <>
                  <button
                    type="button"
                    onClick={findMe}
                    className="pixel-btn rounded-md bg-hg-yellow px-2 py-1 text-[11px] font-bold text-[#241917]"
                  >
                    📍 Cari
                  </button>
                  <button
                    type="button"
                    onClick={() => { void sfx.pop(); setShowGamepad((v) => !v); }}
                    title={showGamepad ? "Sembunyikan Gamepad" : "Tampilkan Gamepad"}
                    aria-pressed={showGamepad}
                    className={`pixel-btn rounded-md px-1.5 py-1 text-[11px] font-bold sm:px-2 ${
                      showGamepad ? "bg-hg-navy text-white" : "bg-[#FFF8EA] text-[#241917]"
                    }`}
                  >
                    🎮
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={toggleMusicDrawer}
                title="Playlist Musik Higround (Spotify / YouTube)"
                aria-expanded={musicOpen}
                className={`pixel-btn rounded-md px-1.5 py-1 text-[11px] font-bold sm:px-2 ${
                  musicOpen || bgmOn ? "bg-hg-orange text-white" : "bg-[#FFF8EA] text-[#241917]"
                }`}
              >
                🎵
              </button>
              <button
                type="button"
                onClick={toggleMute}
                title={muted ? "Aktifkan efek suara" : "Matikan efek suara"}
                className="pixel-btn rounded-md bg-[#FFF8EA] px-1.5 py-1 text-[11px] font-bold sm:px-2"
              >
                {muted ? "🔇" : "🔊"}
              </button>
              <div className="flex gap-0.5" aria-label="Zoom">
                {[1, 2, 3].map((z) => (
                  <button
                    key={z}
                    type="button"
                    onClick={() => zoomTo(z)}
                    aria-pressed={zoom === z}
                    className={`pixel-btn h-7 w-6 rounded-md text-[11px] font-bold sm:w-7 sm:text-xs ${
                      zoom === z ? "bg-[#241917] text-hg-yellow" : "bg-[#FFF8EA]"
                    }`}
                  >
                    {z}×
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ROW 3 (only on Floor 2): Studio Mode Toggle */}
          {scene === "floor2" && (
            <div className="flex justify-center">
              <div className="pixel-frame pointer-events-auto flex items-center gap-1 rounded-lg bg-[#FFF8EA]/95 px-2 py-0.5 text-[11px] font-bold">
                {(["auto", "yoga", "dine"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => switchStudio(m)}
                    className={`rounded px-1.5 py-0.5 ${studioMode === m ? "bg-hg-navy text-white" : "hover:bg-[#EFE1C4]"}`}
                  >
                    {m === "auto" ? "Auto" : m === "yoga" ? "🧘 Yoga" : "☕ Dine"}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FLOATING EMBED BGM PLAYLIST MINI-DRAWER (Opsi B: Spotify/YouTube + optional 8-bit synth) */}
        {musicLoaded && (
          <div
            className={`pixel-frame absolute right-2 top-[116px] z-30 w-[300px] max-w-[calc(100%-16px)] rounded-xl bg-[#FFF8EA]/98 p-2.5 shadow-lg transition-all sm:right-3 sm:top-[108px] ${
              musicOpen ? "block" : "hidden"
            }`}
          >
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate font-pixel text-sm leading-none text-[#241917]">🎵 {PLAYLIST.label}</div>
                <div className="mt-0.5 text-[10px] text-neutral-600">Vibes ngopi &amp; lari bareng Higround</div>
              </div>
              <button
                type="button"
                onClick={() => setMusicOpen(false)}
                className="pixel-btn rounded bg-white px-2 py-0.5 text-[11px] font-bold"
              >
                ✕
              </button>
            </div>
            <iframe
              src={PLAYLIST.embedUrl}
              width="100%"
              height="152"
              allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
              loading="lazy"
              title={PLAYLIST.label}
              className="rounded-lg border-2 border-[#2b1d17] bg-[#181818]"
            />
            <div className="mt-2 flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
              <button
                type="button"
                onClick={toggleSynthBgm}
                className={`pixel-btn rounded px-2 py-1 font-bold ${
                  bgmOn ? "bg-hg-orange text-white" : "bg-white text-[#241917]"
                }`}
              >
                {bgmOn ? "🎹 8-Bit BGM: ON" : "🎹 8-Bit BGM"}
              </button>
              <a
                href={PLAYLIST.openUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="font-bold text-hg-navy underline"
              >
                Buka Playlist ↗
              </a>
            </div>
            {PLAYLIST.provider === "spotify" && (
              <p className="mt-1 text-[10px] text-neutral-500">
                Login Spotify di browser untuk putar lagu penuh (non-login: preview 30 dtk).
              </p>
            )}
          </div>
        )}

        {/* ON-SCREEN VIRTUAL GAMEPAD (D-PAD) + AUTO-WALK STATUS (Bottom-Left) */}
        {meMember && showGamepad && !drawer && !selected && !selectedPoi && (
          <div className="pointer-events-auto absolute bottom-24 left-2.5 z-20 flex flex-col items-center gap-1 select-none sm:bottom-24 sm:left-3">
            <span
              className={`rounded-full border border-[#2b1d17] px-2 py-0.5 text-[9px] font-black tracking-wide shadow-sm ${
                controlMode === "manual"
                  ? "bg-hg-orange text-white"
                  : "bg-[#FFF8EA]/90 text-[#241917]"
              }`}
            >
              {controlMode === "manual" ? "🎮 MANUAL" : "🤖 AUTO-WALK"}
            </span>
            <div
              className="grid grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-[#2b1d17]/75 bg-[#241917]/45 p-1.5 backdrop-blur-[2px]"
              role="group"
              aria-label="Virtual Gamepad"
            >
              <div />
              <button
                type="button"
                aria-label="Jalan ke atas"
                onPointerDown={(e) => { e.preventDefault(); holdDir("up", 0, -1); }}
                onPointerUp={releaseDir}
                onPointerLeave={releaseDir}
                onPointerCancel={releaseDir}
                className={`flex h-9 w-9 touch-none items-center justify-center rounded-lg border-2 border-[#2b1d17] text-sm font-black shadow-[0_2px_0_#111] ${
                  activeDir === "up" ? "translate-y-0.5 bg-hg-orange text-white" : "bg-[#FFF8EA]/95 text-[#241917]"
                }`}
              >
                ▲
              </button>
              <div />
              <button
                type="button"
                aria-label="Jalan ke kiri"
                onPointerDown={(e) => { e.preventDefault(); holdDir("left", -1, 0); }}
                onPointerUp={releaseDir}
                onPointerLeave={releaseDir}
                onPointerCancel={releaseDir}
                className={`flex h-9 w-9 touch-none items-center justify-center rounded-lg border-2 border-[#2b1d17] text-sm font-black shadow-[0_2px_0_#111] ${
                  activeDir === "left" ? "translate-y-0.5 bg-hg-orange text-white" : "bg-[#FFF8EA]/95 text-[#241917]"
                }`}
              >
                ◀
              </button>
              <button
                type="button"
                aria-label="Pusatkan kamera ke karakterku"
                onClick={findMe}
                className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#2b1d17] bg-hg-yellow text-xs font-black text-[#241917]"
              >
                ●
              </button>
              <button
                type="button"
                aria-label="Jalan ke kanan"
                onPointerDown={(e) => { e.preventDefault(); holdDir("right", 1, 0); }}
                onPointerUp={releaseDir}
                onPointerLeave={releaseDir}
                onPointerCancel={releaseDir}
                className={`flex h-9 w-9 touch-none items-center justify-center rounded-lg border-2 border-[#2b1d17] text-sm font-black shadow-[0_2px_0_#111] ${
                  activeDir === "right" ? "translate-y-0.5 bg-hg-orange text-white" : "bg-[#FFF8EA]/95 text-[#241917]"
                }`}
              >
                ▶
              </button>
              <div />
              <button
                type="button"
                aria-label="Jalan ke bawah"
                onPointerDown={(e) => { e.preventDefault(); holdDir("down", 0, 1); }}
                onPointerUp={releaseDir}
                onPointerLeave={releaseDir}
                onPointerCancel={releaseDir}
                className={`flex h-9 w-9 touch-none items-center justify-center rounded-lg border-2 border-[#2b1d17] text-sm font-black shadow-[0_2px_0_#111] ${
                  activeDir === "down" ? "translate-y-0.5 bg-hg-orange text-white" : "bg-[#FFF8EA]/95 text-[#241917]"
                }`}
              >
                ▼
              </button>
              <div />
            </div>
          </div>
        )}

        {/* BACKDROP SCRIM WHEN AN IN-WORLD DRAWER IS OPEN */}
        {drawer && (
          <div
            onClick={() => setDrawer(null)}
            className="absolute inset-0 z-[35] bg-black/40 backdrop-blur-[1px]"
            aria-hidden
          />
        )}

        {/* CENTER OVERLAYS: IN-WORLD DRAWERS, CLICKED POI POPUP, OR CLICKED MEMBER CARD */}
        <div className={`pointer-events-none absolute inset-x-3 z-40 flex justify-center ${
          drawer ? "bottom-24 top-3 items-center" : "bottom-24 items-end"
        }`}>
          {drawer && (
            <WorldDrawer
              tab={drawer}
              onClose={() => setDrawer(null)}
              world={{ ...world, members }}
              onJumpMember={jumpToMember}
              onCheerMember={cheerMember}
            />
          )}

          {!drawer && selectedPoi && (
            <PoiPopup
              poiKey={selectedPoi}
              onClose={() => setSelectedPoi(null)}
              onOpenDrawer={(tab) => setDrawer(tab)}
            />
          )}

          {!drawer && !selectedPoi && selected && (
            <SpringPop className="pixel-frame-orange pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl bg-[#FFF8EA] p-3">
              <Link href={`/u/${selected.handle}`} className="rounded-lg border-2 border-[#2b1d17] bg-[#EFE1C4] p-1.5 hover:brightness-95">
                <Avatar avatar={selected.avatar} size={46} label={selected.name} />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Link href={`/u/${selected.handle}`} className="truncate font-pixel text-lg leading-none hover:underline">
                    {selected.name}
                  </Link>
                  {selected.weeklyRank && (
                    <span className="rounded border border-black bg-hg-yellow px-1.5 py-0.5 text-[10px] font-black text-[#241917]">
                      {selected.weeklyRank === 1 ? "🥇 TOP #1" : selected.weeklyRank === 2 ? "🥈 TOP #2" : "🥉 TOP #3"}
                    </span>
                  )}
                  {selected.ranToday && (
                    <span className="rounded bg-hg-orange px-1.5 py-0.5 text-[10px] font-bold text-white">LARI HARI INI 🔥</span>
                  )}
                </div>
                <div className="mt-0.5 text-xs font-bold text-neutral-700">
                  Lv {selected.level} · {selected.title} · {km(selected.weekKm)} km minggu ini
                </div>
                <div className="mt-1 flex flex-wrap gap-1 text-[11px]">
                  {selected.badges.map((b) => (
                    <span key={b.name} className="rounded border border-[#2b1d17]/30 bg-white px-1.5 py-0.5 font-medium">
                      {ICON[b.icon] ?? "🏷️"} {b.name}
                    </span>
                  ))}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                {!selected.isMe ? (
                  <button
                    onClick={() => { cheerMember(selected); setCheered(true); }}
                    className="pixel-btn rounded-md bg-hg-yellow px-2.5 py-1 text-xs font-bold"
                  >
                    {cheered ? "🔥 Terkirim!" : "👏 Semangat"}
                  </button>
                ) : (
                  <Link
                    href="/create?next=%2Fworld"
                    className="pixel-btn rounded-md bg-hg-yellow px-2.5 py-1 text-xs font-bold text-[#241917]"
                  >
                    🎨 Ganti Karakter
                  </Link>
                )}
                <div className="flex items-center gap-2">
                  <Link href={`/u/${selected.handle}`} className="pixel-btn rounded-md bg-hg-orange px-2.5 py-1 text-xs font-bold text-white">
                    Lihat Profil
                  </Link>
                  <button onClick={() => setSelected(null)} className="text-xs font-bold underline">Tutup</button>
                </div>
              </div>
            </SpringPop>
          )}
        </div>

        {/* BOTTOM FLOATING PIXEL GAME ACTION DOCK */}
        <div className="pointer-events-none absolute inset-x-2 bottom-2 z-20 flex flex-col items-center gap-1.5 sm:inset-x-3 sm:bottom-3">
          {/* Sleek live activity ticker */}
          {ticker.length > 0 && (
            <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-full border-2 border-[#2b1d17] bg-[#241917]/90 py-0.5 text-[11px] font-medium text-hg-yellow sm:text-xs">
              <div className="ticker flex w-max gap-10 whitespace-nowrap px-4">
                {[...ticker, ...ticker].map((t, i) => (
                  <span key={i} aria-hidden={i >= ticker.length}>⚡ {t}</span>
                ))}
              </div>
            </div>
          )}

          <nav
            aria-label="Dock Dunia Higround"
            className="pixel-frame pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-xl bg-[#FFF8EA]/95 px-1.5 py-1 backdrop-blur-sm sm:px-2 sm:py-1.5"
          >
            <button
              type="button"
              onClick={() => { setDrawer(null); setSelectedPoi(null); setSelected(null); }}
              className={`pixel-btn rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === null ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🗺️ Peta
            </button>
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "leaderboard" ? null : "leaderboard"))}
              className={`pixel-btn rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === "leaderboard" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🏅 Ranking
            </button>
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "menu" ? null : "menu"))}
              className={`pixel-btn rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === "menu" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🍔 Menu
            </button>
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "club" ? null : "club"))}
              className={`pixel-btn rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === "club" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🏆 Klub
            </button>
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "rewards" ? null : "rewards"))}
              className={`pixel-btn relative rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === "rewards" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              ☕ Rewards
              {unlockedVouchers > 0 && (
                <span className="ml-1 rounded-full bg-hg-red px-1.5 text-[10px] text-white">{unlockedVouchers}</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDrawer((d) => (d === "online" ? null : "online"))}
              className={`pixel-btn rounded-lg px-2 py-1 text-[11px] font-bold sm:px-2.5 sm:text-xs ${drawer === "online" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              👥 Online ({members.length})
            </button>
            <Link
              href={meHandle ? "/share" : "/login"}
              onClick={() => void sfx.select()}
              className="pixel-btn rounded-lg bg-hg-navy px-2 py-1 text-[11px] font-bold text-white sm:px-2.5 sm:text-xs"
            >
              🎬 Story
            </Link>
            <button
              type="button"
              disabled
              title="Yoga Quest — Coming Soon"
              className="cursor-not-allowed rounded-lg border-2 border-neutral-400 bg-neutral-200 px-2 py-1 text-[11px] font-bold text-neutral-500 sm:px-2.5 sm:text-xs"
            >
              🔒 Yoga
            </button>
          </nav>
        </div>
      </div>

      {showLevelModal && meMember && hud.myLevel !== null && hud.myXp !== null && (
        <LevelUpModal
          level={hud.myLevel}
          title={hud.myTitle ?? "Runner"}
          totalXp={hud.myXp}
          weekKm={meMember.weekKm}
          onClose={() => setShowLevelModal(false)}
        />
      )}

      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-center text-xs text-neutral-600">
        <span>
          Pakai <b>Gamepad 🎮 / WASD</b> untuk jalan (idle 4 dtk → Auto-Walk) · Klik <b>karakter</b> untuk buka profil ·{" "}
        </span>
        <a
          href={CAFE_MENU.googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="font-bold text-hg-orange underline hover:brightness-90"
        >
          📍 Kasih Review Higround di Google Maps ⭐
        </a>
      </div>
    </div>
  );
}
