"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { AnimatedNumber, LevelUpModal, SpringPop } from "@/components/SpringUI";
import type { StudioModeOverride, WorldGame } from "@/game/createWorldGame";
import { sfx } from "@/lib/audio/sfx";
import type { WorldMember, WorldView } from "@/lib/data/service";
import { km } from "@/lib/format";
import { SCENES, type SceneKey } from "@/lib/world/layout";
import { dayPhase, wibHour } from "@/lib/world/agents";
import { PoiPopup, WorldDrawer, type DrawerTab } from "./WorldDrawers";

const ICON: Record<string, string> = {
  shoe: "👟", road: "🛣️", medal: "🏅", pin: "📍", flame: "🔥", lotus: "🪷", star: "🌟", wave: "🌊", pose: "🤸",
};

export function WorldClient({
  world,
  meHandle,
}: {
  world: WorldView;
  meHandle: string | null;
}) {
  const { members, hud, ticker, clubQuest, rukoUpgrade, rewards } = world;
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

  useEffect(() => {
    let alive = true;
    const startZoom = 2;
    setZoom(startZoom);
    import("@/game/createWorldGame").then(({ createWorldGame }) => {
      if (!alive || !box.current) return;
      game.current = createWorldGame(box.current, {
        members: members.map((m) => ({
          id: m.id, name: m.name, avatar: m.avatar, ranToday: m.ranToday, yogaStars: m.yogaStars,
          isMe: m.isMe, level: m.level,
        })),
        initialScene: scene,
        upgrades: rukoUpgrade.unlocks,
        hasActiveEvent: Boolean(hud.event),
        onSelect: (id) => {
          setSelectedPoi(null);
          setCheered(false);
          setSelected(members.find((m) => m.id === id) ?? null);
        },
        onSelectPoi: (poiKey) => {
          setSelected(null);
          setSelectedPoi(poiKey);
        },
        onSceneCount: setCounts,
      });
      setTimeout(() => game.current?.setZoom(startZoom), 80);
    });
    return () => {
      alive = false;
      game.current?.destroy();
      game.current = null;
    };
    // created once; scene and zoom updates go through the imperative WorldGame handle
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
  const toggleBgm = async () => {
    const playing = await sfx.toggleBgm();
    setBgmOn(playing);
    if (playing) setMuted(false);
  };

  const phase = dayPhase(hour);
  const unlockedVouchers = rewards?.vouchers.filter((v) => v.unlocked).length ?? 0;
  const xpPct = hud.myXpToNext === null ? 100 : Math.round((hud.myXpIntoLevel / (hud.myXpIntoLevel + hud.myXpToNext)) * 100);

  return (
    <div className="space-y-2.5">
      {/* FULL-IMMERSIVE GAME VIEWPORT (WorkAdventure / Gather / Kairosoft / Habitica Style!) */}
      <div className="pixel-frame relative h-[76vh] min-h-[540px] w-full overflow-hidden rounded-xl bg-[#cfe4ce]">
        {/* Phaser Isometric Canvas */}
        <div ref={box} className="h-full w-full touch-none [image-rendering:pixelated]" aria-label="Dunia Higround" />

        {/* TOP-LEFT FLOATING HABITICA RPG PLAYER CARD */}
        <div className="pointer-events-none absolute left-3 top-3 z-20 flex flex-col gap-2">
          {meMember && hud.myLevel !== null ? (
            <div className="pixel-frame pointer-events-auto flex items-center gap-2.5 rounded-lg bg-[#FFF8EA]/95 px-2.5 py-2 backdrop-blur-sm">
              <Link href="/create" title="Edit karakter pixel" className="shrink-0 rounded-md border-2 border-[#2b1d17] bg-[#EFE1C4] p-1 hover:brightness-95">
                <Avatar avatar={meMember.avatar} size={36} label={meMember.name} />
              </Link>
              <div className="min-w-[138px]">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-pixel text-sm leading-none text-[#241917]">{meMember.name.split(" ")[0]}</span>
                  <button
                    type="button"
                    onClick={() => setShowLevelModal(true)}
                    title="Lihat status Level & bikin IG Story!"
                    className="rounded bg-black px-1.5 py-0.5 font-mono text-[10px] font-bold text-hg-yellow hover:bg-hg-orange hover:text-white"
                  >
                    Lv <AnimatedNumber value={hud.myLevel} /> ★
                  </button>
                </div>
                <div className="mt-1 h-2.5 w-full overflow-hidden rounded-full border border-[#2b1d17] bg-[#EFE1C4]">
                  <div className="h-full bg-gradient-to-r from-hg-orange to-hg-yellow" style={{ width: `${xpPct}%` }} />
                </div>
                <div className="mt-0.5 flex items-center justify-between text-[10px] font-bold text-neutral-700">
                  <span>{hud.myTitle}</span>
                  <span>🔥 {hud.myStreakWeeks}w · ☕ {rewards?.tier.stamps ?? 0}</span>
                </div>
              </div>
            </div>
          ) : (
            <Link href="/login" className="pixel-btn pointer-events-auto rounded-lg bg-hg-orange px-3 py-2 text-xs font-bold text-white">
              Masuk untuk Gabung Dunia →
            </Link>
          )}
        </div>

        {/* TOP-CENTER FLOATING FLOOR SWITCHER & LIVE STATUS (WorkAdventure / Gather Style) */}
        <div className="pointer-events-none absolute left-1/2 top-3 z-20 flex -translate-x-1/2 flex-col items-center gap-1.5">
          <div role="tablist" aria-label="Lantai" className="pixel-frame pointer-events-auto flex items-center gap-1 rounded-lg bg-[#FFF8EA]/95 p-1 backdrop-blur-sm">
            {SCENES.map((k) => (
              <button
                key={k}
                role="tab"
                aria-selected={scene === k}
                onClick={() => pick(k)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-colors ${
                  scene === k
                    ? "bg-hg-orange text-white shadow-[inset_0_-2px_0_rgba(0,0,0,0.2)]"
                    : "text-[#241917] hover:bg-[#EFE1C4]"
                }`}
              >
                {k === "street" ? "Teras" : k === "floor1" ? "Lt.1 Coffee" : "Lt.2 Studio"}{" "}
                <span className="opacity-80">({counts[k]})</span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-1.5">
            <div className="pixel-frame pointer-events-auto hidden items-center gap-2 rounded-lg bg-[#241917]/90 px-2.5 py-1 text-[11px] font-bold text-[#FFF8EA] md:flex">
              <span className="font-mono text-hg-yellow">{clock || "--.--"} WIB</span>
              <span className="capitalize opacity-85">{phase.name}</span>
              <span className="text-emerald-400">● {members.length} aktif</span>
            </div>

            {scene === "floor2" && (
              <div className="pixel-frame pointer-events-auto flex items-center gap-1 rounded-lg bg-[#FFF8EA]/95 px-2 py-0.5 text-[11px] font-bold">
                {(["auto", "yoga", "dine"] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => switchStudio(m)}
                    className={`rounded px-1.5 py-0.5 ${studioMode === m ? "bg-hg-navy text-white" : "hover:bg-[#EFE1C4]"}`}
                  >
                    {m === "auto" ? "Auto" : m === "yoga" ? "🧘 Yoga" : "☕ Dine"}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* TOP-RIGHT FLOATING CLUB QUEST PILL & CAMERA CONTROLS */}
        <div className="pointer-events-none absolute right-3 top-3 z-20 flex flex-col items-end gap-1.5">
          <button
            onClick={() => setDrawer((d) => (d === "club" ? null : "club"))}
            className="pixel-btn pointer-events-auto flex items-center gap-2 rounded-lg bg-[#FFF8EA]/95 px-2.5 py-1.5 text-left text-xs font-bold backdrop-blur-sm"
            title="Klik untuk lihat Misi Klub & Upgrade Ruko"
          >
            <span>🏆</span>
            <div>
              <div className="leading-none text-hg-orange">Misi Klub: {clubQuest.pct}%</div>
              <div className="font-mono text-[10px] text-neutral-700">
                {km(clubQuest.currentKm)}/{clubQuest.targetKm} km · Ruko Tier {rukoUpgrade.tier}
              </div>
            </div>
          </button>

          {hud.event && (
            <button
              onClick={() => setDrawer((d) => (d === "events" ? null : "events"))}
              className="pixel-btn pointer-events-auto rounded-lg bg-hg-violet px-2.5 py-1 text-[11px] font-bold text-white"
            >
              ★ LIVE: {hud.event.name} {hud.event.multiplier > 1 ? `×${hud.event.multiplier}` : ""}
            </button>
          )}

          <div className="pointer-events-auto flex items-center gap-1">
            <button
              type="button"
              onClick={toggleBgm}
              title={bgmOn ? "Matikan musik lo-fi kafe" : "Nyalakan musik lo-fi kafe (Tone.js)"}
              className={`pixel-btn rounded-md px-2 py-1 text-[11px] font-bold ${bgmOn ? "bg-hg-orange text-white" : "bg-[#FFF8EA]"}`}
            >
              {bgmOn ? "🎵 On" : "🎵 BGM"}
            </button>
            <button
              type="button"
              onClick={toggleMute}
              title={muted ? "Aktifkan efek suara" : "Matikan efek suara"}
              className="pixel-btn rounded-md bg-[#FFF8EA] px-2 py-1 text-[11px] font-bold"
            >
              {muted ? "🔇" : "🔊"}
            </button>
            {meHandle && (
              <button onClick={findMe} className="pixel-btn rounded-md bg-hg-yellow px-2 py-1 text-[11px] font-bold">
                📍 Cari gue
              </button>
            )}
            <div className="flex gap-0.5" aria-label="Zoom">
              {[1, 2, 3].map((z) => (
                <button
                  key={z}
                  onClick={() => zoomTo(z)}
                  aria-pressed={zoom === z}
                  className={`pixel-btn h-7 w-7 rounded-md text-xs font-bold ${
                    zoom === z ? "bg-[#241917] text-hg-yellow" : "bg-[#FFF8EA]"
                  }`}
                >
                  {z}×
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* BACKDROP SCRIM WHEN AN IN-WORLD DRAWER IS OPEN */}
        {drawer && (
          <div
            onClick={() => setDrawer(null)}
            className="absolute inset-0 z-[25] bg-black/35 backdrop-blur-[1px]"
            aria-hidden
          />
        )}

        {/* CENTER OVERLAYS: IN-WORLD DRAWERS, CLICKED POI POPUP, OR CLICKED MEMBER CARD */}
        <div className={`pointer-events-none absolute inset-x-3 z-30 flex justify-center ${
          drawer ? "bottom-24 top-4 items-center" : "bottom-24 items-end"
        }`}>
          {drawer && (
            <WorldDrawer
              tab={drawer}
              onClose={() => setDrawer(null)}
              world={world}
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
              <div className="rounded-lg border-2 border-[#2b1d17] bg-[#EFE1C4] p-1.5">
                <Avatar avatar={selected.avatar} size={46} label={selected.name} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate font-pixel text-lg leading-none">{selected.name}</span>
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
                {!selected.isMe && (
                  <button
                    onClick={() => { cheerMember(selected); setCheered(true); }}
                    className="pixel-btn rounded-md bg-hg-yellow px-2.5 py-1 text-xs font-bold"
                  >
                    {cheered ? "🔥 Terkirim!" : "👏 Semangat"}
                  </button>
                )}
                <div className="flex items-center gap-2">
                  <Link href={`/u/${selected.handle}`} className="pixel-btn rounded-md bg-hg-orange px-2.5 py-1 text-xs font-bold text-white">
                    Profil
                  </Link>
                  <button onClick={() => setSelected(null)} className="text-xs font-bold underline">Tutup</button>
                </div>
              </div>
            </SpringPop>
          )}
        </div>

        {/* BOTTOM FLOATING PIXEL GAME ACTION DOCK (Kairosoft / Gather / Habitica) */}
        <div className="pointer-events-none absolute inset-x-3 bottom-3 z-20 flex flex-col items-center gap-1.5">
          {/* Sleek live activity ticker */}
          {ticker.length > 0 && (
            <div className="pointer-events-auto w-full max-w-2xl overflow-hidden rounded-full border-2 border-[#2b1d17] bg-[#241917]/90 py-0.5 text-xs font-medium text-hg-yellow">
              <div className="ticker flex w-max gap-10 whitespace-nowrap px-4">
                {[...ticker, ...ticker].map((t, i) => (
                  <span key={i} aria-hidden={i >= ticker.length}>⚡ {t}</span>
                ))}
              </div>
            </div>
          )}

          <nav
            aria-label="Dock Dunia Higround"
            className="pixel-frame pointer-events-auto flex flex-wrap items-center justify-center gap-1 rounded-xl bg-[#FFF8EA]/95 px-2 py-1.5 backdrop-blur-sm"
          >
            <button
              onClick={() => { setDrawer(null); setSelectedPoi(null); setSelected(null); }}
              className={`pixel-btn rounded-lg px-2.5 py-1 text-xs font-bold ${drawer === null ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🗺️ Peta
            </button>
            <button
              onClick={() => setDrawer((d) => (d === "club" ? null : "club"))}
              className={`pixel-btn rounded-lg px-2.5 py-1 text-xs font-bold ${drawer === "club" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🏆 Klub &amp; Quest
            </button>
            <button
              onClick={() => setDrawer((d) => (d === "rewards" ? null : "rewards"))}
              className={`pixel-btn relative rounded-lg px-2.5 py-1 text-xs font-bold ${drawer === "rewards" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              ☕ Rewards
              {unlockedVouchers > 0 && (
                <span className="ml-1 rounded-full bg-hg-red px-1.5 text-[10px] text-white">{unlockedVouchers}</span>
              )}
            </button>
            <button
              onClick={() => setDrawer((d) => (d === "events" ? null : "events"))}
              className={`pixel-btn rounded-lg px-2.5 py-1 text-xs font-bold ${drawer === "events" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              🎟️ Event
            </button>
            <button
              onClick={() => setDrawer((d) => (d === "online" ? null : "online"))}
              className={`pixel-btn rounded-lg px-2.5 py-1 text-xs font-bold ${drawer === "online" ? "bg-hg-orange text-white" : "bg-white"}`}
            >
              👥 Aktif ({members.length})
            </button>
            <Link
              href={meHandle ? "/create" : "/login"}
              onClick={() => void sfx.select()}
              className="pixel-btn rounded-lg bg-hg-yellow px-2.5 py-1 text-xs font-bold text-[#241917]"
            >
              🎨 Karakter
            </Link>
            <Link
              href={meHandle ? "/share" : "/login"}
              onClick={() => void sfx.select()}
              className="pixel-btn rounded-lg bg-hg-navy px-2.5 py-1 text-xs font-bold text-white"
            >
              🎬 Story
            </Link>
            <Link
              href="/yoga"
              onClick={() => void sfx.select()}
              className="pixel-btn rounded-lg bg-white px-2.5 py-1 text-xs font-bold text-[#241917]"
            >
              🧘 Yoga
            </Link>
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

      <p className="text-center text-xs text-neutral-600">
        Geser kamera untuk keliling ruko · Klik <b>karakter</b> untuk profil &amp; kirim semangat · Klik <b>Start Gate, Counter ORDER HERE!, Kios Gelato, atau Papan Klub</b> untuk interaksi langsung!
      </p>
    </div>
  );
}
