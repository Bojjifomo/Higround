"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Avatar } from "@/components/Avatar";
import type { WorldGame } from "@/game/createWorldGame";
import type { WorldMember, WorldView } from "@/lib/data/service";
import { km } from "@/lib/format";
import { SCENE_LABEL, SCENES, type SceneKey } from "@/lib/world/layout";
import { dayPhase, wibHour } from "@/lib/world/agents";

const ICON: Record<string, string> = { shoe: "👟", road: "🛣️", medal: "🏅", pin: "📍", flame: "🔥", lotus: "🪷", star: "🌟", wave: "🌊", pose: "🤸" };

export function WorldClient({ members, hud, ticker, meHandle }: {
  members: WorldMember[]; hud: WorldView["hud"]; ticker: string[]; meHandle: string | null;
}) {
  const box = useRef<HTMLDivElement>(null);
  const game = useRef<WorldGame | null>(null);
  const hour = wibHour(Date.now());
  const [scene, setScene] = useState<SceneKey>(hour >= 5 && hour < 10 ? "street" : "floor1");
  const [zoom, setZoom] = useState(1);
  const [selected, setSelected] = useState<WorldMember | null>(null);
  const [counts, setCounts] = useState<Record<SceneKey, number>>({ street: 0, floor1: 0, floor2: 0 });
  const [clock, setClock] = useState("");

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" });
    const tickClock = () => setClock(fmt.format(new Date()));
    tickClock();
    const id = setInterval(tickClock, 15_000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let alive = true;
    const startZoom = 1;
    setZoom(startZoom);
    import("@/game/createWorldGame").then(({ createWorldGame }) => {
      if (!alive || !box.current) return;
      game.current = createWorldGame(box.current, {
        members: members.map((m) => ({ id: m.id, name: m.name, avatar: m.avatar, ranToday: m.ranToday, yogaStars: m.yogaStars,
                                       isMe: m.isMe, level: m.level })),
        initialScene: scene,
        onSelect: (id) => setSelected(members.find((m) => m.id === id) ?? null),
        onSceneCount: setCounts,
      });
      setTimeout(() => game.current?.setZoom(startZoom), 50);
    });
    return () => { alive = false; game.current?.destroy(); game.current = null; };
    // the game is created once; scene and zoom changes go through its API
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pick = (k: SceneKey) => { setScene(k); game.current?.setScene(k); setSelected(null); };
  const zoomTo = (z: number) => { setZoom(z); game.current?.setZoom(z); };
  const phase = dayPhase(hour);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border-4 border-black bg-hg-cream px-3 py-2 text-sm font-bold">
        <span className="rounded bg-black px-2 py-0.5 font-pixel text-hg-yellow">{clock || "--.--"} WIB</span>
        <span>{phase.name}</span>
        <span className="rounded bg-hg-orange px-2 py-0.5 text-white">Run Club Week {hud.week}</span>
        <span>Komunitas minggu ini: <span className="tabular-nums">{km(hud.communityKmWeek)} km</span></span>
        {hud.myXp !== null && <span className="ml-auto rounded bg-hg-yellow px-2 py-0.5">Lv {hud.myLevel} · {hud.myXp.toLocaleString("id-ID")} XP</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Lantai" className="flex flex-wrap gap-1">
          {SCENES.map((k) => (
            <button key={k} role="tab" aria-selected={scene === k} onClick={() => pick(k)}
                    className={`rounded-md border-2 border-black px-3 py-1 text-sm font-bold ${scene === k ? "bg-hg-orange text-white" : "bg-white"}`}>
              {SCENE_LABEL[k]} <span className="opacity-70">({counts[k]})</span>
            </button>
          ))}
        </div>
        <div className="ml-auto flex gap-1" aria-label="Zoom">
          {[1, 2, 3].map((z) => (
            <button key={z} onClick={() => zoomTo(z)} aria-pressed={zoom === z}
                    className={`h-8 w-8 rounded-md border-2 border-black text-sm font-bold ${zoom === z ? "bg-black text-white" : "bg-white"}`}>{z}×</button>
          ))}
        </div>
      </div>

      <div className="relative overflow-hidden rounded-lg border-4 border-black shadow-[4px_4px_0_#111]">
        <div ref={box} className="h-[62vh] min-h-[380px] w-full touch-none [image-rendering:pixelated]" aria-label="Dunia Higround" />
        {selected && (
          <div className="absolute bottom-3 left-3 right-3 mx-auto flex max-w-md items-center gap-3 rounded-lg border-4 border-hg-orange bg-[#FFFDF7] p-3 shadow-[4px_4px_0_#111]">
            <Avatar avatar={selected.avatar} size={44} label="" />
            <div className="min-w-0 flex-1">
              <div className="truncate font-pixel text-lg leading-none">{selected.name}</div>
              <div className="text-xs font-bold">Lv {selected.level} · {selected.title}</div>
              <div className="mt-1 flex flex-wrap gap-1 text-xs">
                {selected.badges.map((b) => <span key={b.name} className="rounded border px-1">{ICON[b.icon] ?? "🏷️"} {b.name}</span>)}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Link href={`/u/${selected.handle}`} className="rounded-md border-2 border-black bg-hg-orange px-2 py-1 text-xs font-bold text-white">Profil</Link>
              <button onClick={() => setSelected(null)} className="text-xs underline">Tutup</button>
            </div>
          </div>
        )}
      </div>

      <div className="overflow-hidden rounded-md border-2 border-black bg-black py-1 text-sm text-hg-yellow" aria-label="Kabar terbaru">
        {ticker.length ? (
          <div className="ticker flex w-max gap-10 whitespace-nowrap px-3">
            {[...ticker, ...ticker].map((t, i) => <span key={i} aria-hidden={i >= ticker.length}>{t}</span>)}
          </div>
        ) : <span className="px-3">Belum ada kabar 36 jam terakhir.</span>}
      </div>

      <nav className="grid grid-cols-5 gap-2 text-center text-xs font-bold sm:text-sm" aria-label="Menu dunia">
        <Link href={meHandle ? `/u/${meHandle}` : "/login"} className="rounded-md border-2 border-black bg-white py-2">Profil</Link>
        <Link href={meHandle ? `/u/${meHandle}#badge` : "/login"} className="rounded-md border-2 border-black bg-white py-2">Badge</Link>
        <Link href="/yoga" className="rounded-md border-2 border-black bg-white py-2">Yoga Quest</Link>
        <span className="rounded-md border-2 border-dashed border-neutral-400 py-2 text-neutral-500" title="Fase 5">Event (segera)</span>
        <Link href="/" className="rounded-md border-2 border-black bg-white py-2">Menu</Link>
      </nav>
      <p className="text-xs text-neutral-600">
        Geser untuk menggeser kamera, klik karakter untuk lihat profilnya. Grafis masih placeholder sampai aset pixel art jadi.
        Karakter yang muncul: member yang aktif 7 hari terakhir.
      </p>
    </div>
  );
}
