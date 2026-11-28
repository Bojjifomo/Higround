"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SpringPop } from "@/components/SpringUI";
import { sfx } from "@/lib/audio/sfx";
import { CAFE_MENU } from "@/lib/cafe";
import type { WorldMember, WorldView } from "@/lib/data/service";
import { km } from "@/lib/format";

export type DrawerTab = "club" | "leaderboard" | "menu" | "rewards" | "events" | "online" | null;

const POI_INFO: Record<string, {
  title: string; badge: string; desc: string; tip: string;
  ctaLabel: string; ctaHref?: string; openDrawer?: DrawerTab; locked?: boolean;
  externalLabel?: string; externalHref?: string;
}> = {
  start_gate: {
    title: "START GATE · 0 KM",
    badge: "Bonus XP ×1,5",
    desc: "Titik kumpul & start resmi Higround Run Club di Harapan Indah. Setiap lari yang start dalam radius 200 m dari ruko dapat XP jarak ×1,5 + 25 XP flat!",
    tip: "Pelari yang finish hari ini meninggalkan jejak glow oranye di peta!",
    ctaLabel: "Lihat Event Aktif",
    openDrawer: "events",
    externalLabel: "📍 Google Maps & Review",
    externalHref: CAFE_MENU.googleMapsUrl,
  },
  order_counter: {
    title: "Counter ORDER HERE!",
    badge: "Menu & Check-in",
    desc: "Lihat menu kopi, burger, matcha & snack Higround langsung di sini, atau scan QR kasir saat Run + Brew (+50 XP & +1 Brew Stamp)!",
    tip: "Udah mampir ngopi? Bantu kasih bintang 5 & ulasan di Google Maps Higround ya!",
    ctaLabel: "🍔 Buka Menu Kafe",
    openDrawer: "menu",
    externalLabel: "⭐ Review Google Maps",
    externalHref: CAFE_MENU.googleMapsUrl,
  },
  gelato_kiosk: {
    title: "Kios PAPAKIBO · GELATO & POPSICLE",
    badge: "Gelato & Popsicle",
    desc: "Popsicle mulai 17k & Gelato Scoop (Will & Jerry, Barbie, Miss Lucy, Chocozilla) lengkap dengan free toppings!",
    tip: "Pendinginan abis lari paling enak sambil gelato atau popsicle dingin.",
    ctaLabel: "Cek Voucher Kafe",
    openDrawer: "rewards",
  },
  sandwich_board: {
    title: "Papan Event & Aktivasi",
    badge: "Run Club Schedule",
    desc: "Lihat jadwal Sunday Long Run (×2 XP), Run + Brew QR Check-in, dan Monthly 50K Virtual Challenge.",
    tip: "Menyelesaikan event memberi badge event eksklusif di profil!",
    ctaLabel: "Buka Panel Event",
    openDrawer: "events",
  },
  yoga_quest_board: {
    title: "Papan YOGA QUEST (28 Pose)",
    badge: "🔒 Coming Soon",
    desc: "Latihan 28 pose yoga berjenjang sedang kita siapkan! Nantinya pose terbaikmu otomatis diperagakan karaktermu di Studio Room pagi hari.",
    tip: "Fitur Yoga Quest masih dikunci sementara — pantengin pengumuman pembukaannya!",
    ctaLabel: "🔒 Coming Soon",
    locked: true,
  },
  leaderboard_board: {
    title: "Papan LEADERBOARD KM",
    badge: "Top 1–3 Medali",
    desc: "Pantau peringkat kilometer lari minggu ini (khusus Lari — Jalan Kaki tidak dihitung). Juara 1, 2, dan 3 otomatis pakai medali melayang di atas kepala di peta!",
    tip: "Klik nama pelari di leaderboard untuk langsung intip profil, PB, & badge mereka.",
    ctaLabel: "🏅 Buka Leaderboard KM",
    openDrawer: "leaderboard",
  },
  medal_wall: {
    title: "Dinding Medali & Bib Finisher",
    badge: "Upgrade Ruko",
    desc: "Setiap milestone jarak lari komunitas ikut meramaikan dinding medali dan piala di Higround Sports Hub.",
    tip: "Lihat progres upgrade ruko & misi klub di tab Klub & Quest.",
    ctaLabel: "Cek Misi & Upgrade Ruko",
    openDrawer: "club",
  },
  kids_corner: {
    title: "KIDS CORNER · Burger MVP",
    badge: "Family Friendly",
    desc: "Pojok santai ramah keluarga dengan ring basket mini, buku mewarnai, dan suasana santai bareng teman & keluarga.",
    tip: "Kumpulkan 30 km total lari untuk klaim Diskon 20% Higround Burger.",
    ctaLabel: "Lihat Reward Burger",
    openDrawer: "rewards",
  },
};

export function PoiPopup({
  poiKey,
  onClose,
  onOpenDrawer,
}: {
  poiKey: string;
  onClose: () => void;
  onOpenDrawer: (tab: DrawerTab) => void;
}) {
  const info = POI_INFO[poiKey];
  if (!info) return null;
  return (
    <SpringPop className="pixel-frame-orange pointer-events-auto mx-auto w-full max-w-md rounded-xl bg-[#FFF8EA] p-3.5 text-sm">
      <div className="flex items-start justify-between gap-2">
        <div>
          <span className="inline-block rounded bg-hg-orange px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white">
            {info.badge}
          </span>
          <h3 className="mt-1 font-pixel text-lg leading-tight text-[#241917]">{info.title}</h3>
        </div>
        <button onClick={() => { void sfx.select(); onClose(); }} className="pixel-btn rounded bg-white px-2 py-0.5 text-xs font-bold">✕</button>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-neutral-700">{info.desc}</p>
      <p className="mt-2 rounded border border-[#2b1d17]/15 bg-[#EFE1C4]/70 px-2.5 py-1.5 text-[11px] font-medium text-[#3b261c]">
        💡 {info.tip}
      </p>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">
        <button onClick={() => { void sfx.select(); onClose(); }} className="rounded px-2 py-1 text-xs font-bold underline">Tutup</button>
        {info.externalHref && info.externalLabel && (
          <a
            href={info.externalHref}
            target="_blank"
            rel="noopener noreferrer"
            className="pixel-btn rounded-md bg-hg-yellow px-2.5 py-1.5 text-xs font-bold text-[#241917]"
          >
            {info.externalLabel}
          </a>
        )}
        {info.locked ? (
          <button
            type="button"
            disabled
            className="cursor-not-allowed rounded-md border-2 border-neutral-400 bg-neutral-200 px-3 py-1.5 text-xs font-bold text-neutral-600"
          >
            {info.ctaLabel}
          </button>
        ) : info.ctaHref ? (
          <Link href={info.ctaHref} onClick={() => void sfx.select()} className="pixel-btn rounded-md bg-hg-orange px-3 py-1.5 text-xs font-bold text-white">
            {info.ctaLabel}
          </Link>
        ) : info.openDrawer ? (
          <button
            onClick={() => { void sfx.select(); onClose(); onOpenDrawer(info.openDrawer!); }}
            className="pixel-btn rounded-md bg-hg-orange px-3 py-1.5 text-xs font-bold text-white"
          >
            {info.ctaLabel}
          </button>
        ) : null}
      </div>
    </SpringPop>
  );
}

const ITEM_TAG_STYLE: Record<string, { label: string; cls: string }> = {
  favourite: { label: "★ Favorit", cls: "bg-hg-orange text-white" },
  chef: { label: "👨‍🍳 Chef Rec", cls: "bg-hg-yellow text-[#241917]" },
  barista: { label: "👍 Barista Rec", cls: "bg-hg-navy text-white" },
  new: { label: "✨ NEW", cls: "bg-emerald-600 text-white" },
};

export function WorldDrawer({
  tab,
  onClose,
  world,
  onJumpMember,
  onCheerMember,
}: {
  tab: Exclude<DrawerTab, null>;
  onClose: () => void;
  world: WorldView;
  onJumpMember: (m: WorldMember) => void;
  onCheerMember: (m: WorldMember) => void;
}) {
  const [claimedKey, setClaimedKey] = useState<string | null>(null);
  const [cheeredId, setCheeredId] = useState<string | null>(null);
  const [menuCat, setMenuCat] = useState<string>("all");
  const [menuQuery, setMenuQuery] = useState<string>("");

  const filteredCategories = CAFE_MENU.categories
    .filter((c) => menuCat === "all" || c.id === menuCat)
    .map((c) => ({
      ...c,
      items: menuQuery.trim()
        ? c.items.filter((it) =>
            `${it.name} ${it.desc}`.toLowerCase().includes(menuQuery.trim().toLowerCase()),
          )
        : c.items,
    }))
    .filter((c) => c.items.length > 0);

  const podium = world.weeklyLeaders.slice(0, 3);

  return (
    <SpringPop className="pixel-frame pointer-events-auto flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#FFF8EA]">
      <div className="flex shrink-0 items-center justify-between border-b-2 border-[#2b1d17] bg-[#EFE1C4] px-4 py-2.5">
        <h2 className="font-pixel text-lg leading-none text-[#241917]">
          {tab === "club" && "🏆 Klub, Misi Mingguan & Upgrade Ruko"}
          {tab === "leaderboard" && "🏅 Leaderboard KM Lari Minggu Ini"}
          {tab === "menu" && "🍔 Menu Higround & Google Maps"}
          {tab === "rewards" && "☕ Higround Cafe Rewards & Voucher"}
          {tab === "events" && "🎟️ Event & Check-in QR Ruko"}
          {tab === "online" && `👥 Member Online di Peta (${world.members.length})`}
        </h2>
        <button onClick={() => { void sfx.select(); onClose(); }} className="pixel-btn rounded bg-white px-2.5 py-0.5 text-xs font-bold">✕</button>
      </div>

      <div className="overflow-y-auto p-4 text-sm space-y-4">
        {tab === "leaderboard" && (
          <>
            <div className="rounded-lg border-2 border-[#2b1d17] bg-[#FFF1E6] px-3 py-2 text-xs text-[#241917]">
              <b>Khusus Lari (Run)</b> · Jalan kaki tidak masuk leaderboard. Juara 1–3 otomatis mendapat <b>medali melayang 🥇🥈🥉</b> di atas kepala karakter di peta!
            </div>

            {/* Top 3 Podium */}
            {podium.length > 0 && (
              <div className="grid grid-cols-3 items-end gap-2 pt-2">
                {[podium[1], podium[0], podium[2]].map((entry, slot) => {
                  if (!entry) return <div key={`empty-${slot}`} />;
                  const rank = slot === 1 ? 1 : slot === 0 ? 2 : 3;
                  const medal = rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉";
                  const bg = rank === 1 ? "bg-[#FFF4CC] border-[#D97706]" : rank === 2 ? "bg-[#F3F4F6] border-neutral-500" : "bg-[#FDE8D7] border-[#B45309]";
                  return (
                    <Link
                      key={entry.handle}
                      href={`/u/${entry.handle}`}
                      className={`flex flex-col items-center rounded-xl border-2 p-2 text-center shadow-[2px_2px_0_#111] transition-transform hover:-translate-y-0.5 ${bg} ${
                        rank === 1 ? "pb-3 pt-3" : "pb-2 pt-2"
                      }`}
                    >
                      <span className="text-lg leading-none">{medal}</span>
                      <div className="mt-1">
                        <Avatar avatar={entry.avatar} size={rank === 1 ? 46 : 38} label={entry.name} />
                      </div>
                      <span className="mt-1 max-w-full truncate text-xs font-black text-[#241917]">
                        {entry.name.split(" ")[0]}
                      </span>
                      <span className="rounded bg-[#241917] px-1.5 py-0.5 font-mono text-[11px] font-bold text-hg-yellow">
                        {km(entry.weekKm)} km
                      </span>
                    </Link>
                  );
                })}
              </div>
            )}

            {/* Full Clickable Mileage Leaderboard */}
            <div>
              <h3 className="mb-2 font-pixel text-sm text-neutral-700">Klik nama untuk buka profil member →</h3>
              {world.weeklyLeaders.length === 0 ? (
                <p className="rounded-lg border-2 border-[#2b1d17] bg-white p-3 text-xs text-neutral-500">
                  Belum ada catatan lari minggu ini.
                </p>
              ) : (
                <ol className="divide-y divide-[#EFE1C4] rounded-lg border-2 border-[#2b1d17] bg-white">
                  {world.weeklyLeaders.map((l, i) => (
                    <li key={l.handle}>
                      <Link
                        href={`/u/${l.handle}`}
                        className="flex items-center gap-2.5 px-3 py-2 transition-colors hover:bg-[#FFF8EA]"
                      >
                        <span className={`w-6 text-center font-pixel text-base ${i < 3 ? "text-hg-orange" : "text-neutral-500"}`}>
                          {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                        </span>
                        <Avatar avatar={l.avatar} size={30} label={l.name} />
                        <div className="min-w-0 flex-1">
                          <div className="truncate font-bold text-[#241917]">
                            {l.name} {l.ranToday && <span title="Lari hari ini!">🔥</span>}
                          </div>
                          <div className="text-[11px] text-neutral-500">Lv {l.level} · @{l.handle}</div>
                        </div>
                        <span className="rounded bg-hg-cream px-2 py-0.5 font-mono text-xs font-black text-[#241917]">
                          {km(l.weekKm)} km
                        </span>
                        <span className="text-xs font-bold text-hg-orange">→</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}

        {tab === "menu" && (
          <>
            {/* Google Maps Review & Official Menu PDF Action Banner */}
            <div className="pixel-frame-orange rounded-xl bg-white p-3 space-y-2.5">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-pixel text-base text-[#241917]">{CAFE_MENU.cafeName}</div>
                  <div className="text-xs text-neutral-600">{CAFE_MENU.location} · {CAFE_MENU.tagline}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={CAFE_MENU.googleMapsUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pixel-btn inline-flex items-center gap-1 rounded-lg bg-hg-orange px-3 py-1.5 text-xs font-bold text-white"
                >
                  📍 Lokasi &amp; Kasih Review Google Maps ⭐
                </a>
                <a
                  href={CAFE_MENU.menuPdfUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="pixel-btn inline-flex items-center gap-1 rounded-lg bg-hg-yellow px-3 py-1.5 text-xs font-bold text-[#241917]"
                >
                  📄 Lihat PDF Menu Lengkap
                </a>
              </div>
            </div>

            {/* Search & Category Filter Chips */}
            <div className="space-y-2">
              <input
                type="search"
                value={menuQuery}
                onChange={(e) => setMenuQuery(e.target.value)}
                placeholder="Cari The OG, Berycano, Matcha, Gelato..."
                className="w-full rounded-lg border-2 border-[#2b1d17] bg-white px-3 py-1.5 text-xs font-medium"
              />
              <div className="flex gap-1.5 overflow-x-auto pb-1">
                <button
                  type="button"
                  onClick={() => { void sfx.pop(); setMenuCat("all"); }}
                  className={`shrink-0 rounded-full border-2 border-[#2b1d17] px-2.5 py-1 text-[11px] font-bold ${
                    menuCat === "all" ? "bg-[#241917] text-hg-yellow" : "bg-white text-[#241917]"
                  }`}
                >
                  Semua
                </button>
                {CAFE_MENU.categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { void sfx.pop(); setMenuCat(c.id); }}
                    className={`shrink-0 rounded-full border-2 border-[#2b1d17] px-2.5 py-1 text-[11px] font-bold ${
                      menuCat === c.id ? "bg-hg-orange text-white" : "bg-white text-[#241917]"
                    }`}
                  >
                    {c.icon} {c.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Menu Category Lists */}
            {filteredCategories.length === 0 ? (
              <p className="rounded-lg border-2 border-[#2b1d17] bg-white p-3 text-center text-xs text-neutral-500">
                Menu &ldquo;{menuQuery}&rdquo; tidak ditemukan.
              </p>
            ) : (
              <div className="space-y-3">
                {filteredCategories.map((cat) => (
                  <div key={cat.id} className="rounded-xl border-2 border-[#2b1d17] bg-white overflow-hidden">
                    <div className="flex items-center justify-between gap-2 border-b border-[#EFE1C4] bg-[#EFE1C4]/70 px-3 py-1.5">
                      <h3 className="font-pixel text-sm text-[#241917]">{cat.icon} {cat.name}</h3>
                      <span className="text-[11px] font-semibold text-neutral-600">{cat.items.length} item</span>
                    </div>
                    {cat.note && (
                      <div className="border-b border-[#EFE1C4] bg-[#FFF8EA] px-3 py-1 text-[11px] font-semibold text-hg-orange">
                        ✨ {cat.note}
                      </div>
                    )}
                    <ul className="divide-y divide-[#EFE1C4]">
                      {cat.items.map((it) => {
                        const tag = it.tag ? ITEM_TAG_STYLE[it.tag] : null;
                        return (
                          <li key={it.name} className="flex items-start justify-between gap-2.5 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span className="font-bold text-[#241917]">{it.name}</span>
                                {tag && (
                                  <span className={`rounded px-1.5 py-0.5 text-[9px] font-black uppercase ${tag.cls}`}>
                                    {tag.label}
                                  </span>
                                )}
                              </div>
                              <p className="mt-0.5 text-[11px] leading-snug text-neutral-600">{it.desc}</p>
                            </div>
                            <span className="shrink-0 rounded-md border border-[#2b1d17]/25 bg-[#FFF8EA] px-2 py-0.5 font-mono text-xs font-black text-hg-orange">
                              {it.price}
                            </span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {tab === "club" && (
          <>
            {/* Habitica Weekly Party Quest */}
            <div className="pixel-frame rounded-lg bg-white p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-pixel text-base text-hg-orange">{world.clubQuest.title}</span>
                <span className="rounded bg-black px-2 py-0.5 font-mono text-xs font-bold text-hg-yellow">
                  {km(world.clubQuest.currentKm)} / {world.clubQuest.targetKm} km
                </span>
              </div>
              <p className="mt-1 text-xs text-neutral-700">{world.clubQuest.subtitle}</p>
              <div className="mt-2 h-4 w-full overflow-hidden rounded-full border-2 border-[#2b1d17] bg-[#EFE1C4]">
                <div
                  className="h-full bg-gradient-to-r from-hg-orange to-hg-yellow transition-all"
                  style={{ width: `${world.clubQuest.pct}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] font-bold text-[#3b261c]">
                🎁 Hadiah Klub: {world.clubQuest.rewardText}
              </p>
            </div>

            {/* Zombies, Run! Ruko Visual Upgrade Progression */}
            <div className="pixel-frame rounded-lg bg-[#EFE1C4]/70 p-3">
              <div className="flex items-center justify-between">
                <span className="font-pixel text-base">🏗️ Upgrade Ruko · Tier {world.rukoUpgrade.tier}/4</span>
                <span className="text-xs font-bold text-hg-navy">{km(world.rukoUpgrade.clubTotalKm)} km total klub</span>
              </div>
              <p className="mt-1 text-xs font-bold text-[#241917]">{world.rukoUpgrade.name}</p>
              <p className="text-xs text-neutral-700">{world.rukoUpgrade.description}</p>
              <div className="mt-2 grid grid-cols-3 gap-1.5 text-center text-[11px] font-bold">
                <div className={`rounded border-2 p-1.5 ${world.rukoUpgrade.unlocks.stringLights ? "border-hg-orange bg-white" : "border-dashed border-neutral-400 opacity-50"}`}>
                  ✨ Lampu String<br /><span className="text-[10px] font-normal">50 km</span>
                </div>
                <div className={`rounded border-2 p-1.5 ${world.rukoUpgrade.unlocks.mascotBalloon ? "border-hg-orange bg-white" : "border-dashed border-neutral-400 opacity-50"}`}>
                  🎈 Balon Maskot<br /><span className="text-[10px] font-normal">150 km</span>
                </div>
                <div className={`rounded border-2 p-1.5 ${world.rukoUpgrade.unlocks.goldTrophy ? "border-hg-orange bg-white" : "border-dashed border-neutral-400 opacity-50"}`}>
                  🏆 Piala Emas<br /><span className="text-[10px] font-normal">400 km</span>
                </div>
              </div>
            </div>

            {/* Compact Weekly Mileage Leaderboard Preview */}
            <div>
              <h3 className="mb-2 font-pixel text-base">🔥 Top Runner Minggu Ini (Khusus Lari)</h3>
              <ol className="divide-y divide-[#EFE1C4] rounded-lg border-2 border-[#2b1d17] bg-white">
                {world.weeklyLeaders.slice(0, 5).map((l, i) => (
                  <li key={l.handle} className="flex items-center gap-2.5 px-3 py-2">
                    <span className={`w-5 text-center font-pixel text-base ${i < 3 ? "text-hg-orange" : "text-neutral-500"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1}
                    </span>
                    <Avatar avatar={l.avatar} size={28} label={l.name} />
                    <Link href={`/u/${l.handle}`} className="min-w-0 flex-1 truncate font-bold hover:underline">
                      {l.name} {l.ranToday && <span title="Lari hari ini!">🔥</span>}
                    </Link>
                    <span className="rounded bg-hg-cream px-2 py-0.5 font-mono text-xs font-bold">
                      {km(l.weekKm)} km
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          </>
        )}

        {tab === "rewards" && (
          world.rewards ? (
            <>
              {/* Starbucks Rewards Loyalty Tier + Brew Stamp Punch Card */}
              <div className="pixel-frame rounded-lg bg-white p-3">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-500">Tier Loyalitas Kafe</span>
                    <div className="font-pixel text-xl leading-tight" style={{ color: world.rewards.tier.color }}>
                      ★ {world.rewards.tier.name}
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="font-bold">Brew Stamps: {world.rewards.tier.stamps} ☕</div>
                    {world.rewards.tier.nextName && (
                      <div className="text-[11px] text-neutral-500">
                        {world.rewards.tier.xpToNext.toLocaleString("id-ID")} XP ke {world.rewards.tier.nextName}
                      </div>
                    )}
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-1.5">
                  {Array.from({ length: world.rewards.tier.stampsPerFreeDrink }, (_, i) => {
                    const filled = i < (world.rewards!.tier.stamps % world.rewards!.tier.stampsPerFreeDrink);
                    return (
                      <div
                        key={i}
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#2b1d17] text-sm ${
                          filled ? "bg-hg-orange text-white" : "bg-[#EFE1C4] text-neutral-400"
                        }`}
                      >
                        ☕
                      </div>
                    );
                  })}
                  <span className="ml-1 text-[11px] text-neutral-600">
                    Start lari dari Higround / QR check-in = +1 Stamp!
                  </span>
                </div>
              </div>

              {/* Cafe Vouchers */}
              <div className="space-y-2">
                {world.rewards.vouchers.map((v) => (
                  <div
                    key={v.key}
                    className={`rounded-lg border-2 p-3 ${
                      v.unlocked ? "border-hg-orange bg-white shadow-[2px_2px_0_#FF5F0E]" : "border-[#2b1d17]/25 bg-[#EFE1C4]/45"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <span className="text-2xl">{v.icon}</span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-[#241917]">{v.name}</span>
                          <span className="font-mono text-[11px] font-bold text-neutral-600">{v.progressLabel}</span>
                        </div>
                        <p className="text-xs text-neutral-600">{v.requirement}</p>
                        {!v.unlocked ? (
                          <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full border border-[#2b1d17]/40 bg-white">
                            <div className="h-full bg-hg-orange" style={{ width: `${Math.round(v.progress * 100)}%` }} />
                          </div>
                        ) : (
                          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[11px] font-medium text-neutral-700">{v.perk}</span>
                            {claimedKey === v.key ? (
                              <span className="rounded border-2 border-black bg-hg-yellow px-2.5 py-0.5 font-mono text-xs font-black">
                                KODE KASIR: {v.code}
                              </span>
                            ) : (
                              <button
                                onClick={() => { void sfx.cashier(); setClaimedKey(v.key); }}
                                className="pixel-btn rounded bg-hg-orange px-2.5 py-1 text-xs font-bold text-white"
                              >
                                Tunjukkan ke Kasir
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="rounded-lg border-2 border-[#2b1d17] bg-white p-4 text-center">
              <p className="font-bold">Masuk dulu untuk melihat Brew Stamps &amp; Voucher Kafe kamu!</p>
              <Link href="/login" className="pixel-btn mt-3 inline-block rounded-md bg-hg-orange px-4 py-1.5 text-xs font-bold text-white">
                Masuk Sekarang
              </Link>
            </div>
          )
        )}

        {tab === "events" && (
          <div className="space-y-3">
            {world.hud.event ? (
              <div className="pixel-frame-orange rounded-lg bg-white p-3.5">
                <span className="rounded bg-hg-violet px-2 py-0.5 text-[10px] font-bold uppercase text-white">
                  ● EVENT SEDANG BERLANGSUNG
                </span>
                <h3 className="mt-1 font-pixel text-xl">{world.hud.event.name}</h3>
                <p className="mt-1 text-xs text-neutral-700">{world.hud.event.description}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Link href={`/events/${world.hud.event.id}`} className="pixel-btn rounded-md bg-hg-orange px-3 py-1.5 text-xs font-bold text-white">
                    Detail &amp; QR Check-in →
                  </Link>
                  <Link href="/events" className="pixel-btn rounded-md bg-white px-3 py-1.5 text-xs font-bold">
                    Semua Event
                  </Link>
                </div>
              </div>
            ) : (
              <div className="rounded-lg border-2 border-[#2b1d17] bg-white p-3.5 text-xs text-neutral-700">
                Belum ada event yang sedang live jam ini. Cek jadwal Sunday Long Run dan Run + Brew di halaman Event!
              </div>
            )}
            <div className="rounded-lg border-2 border-[#2b1d17]/20 bg-[#EFE1C4]/70 p-3 text-xs space-y-1">
              <div className="font-bold text-[#241917]">Cara dapat bonus di Event Higround:</div>
              <p>• <b>Auto Check-in:</b> Start lari dalam radius 200 m dari ruko Higround saat jadwal event.</p>
              <p>• <b>QR Kasir:</b> Scan QR dinamis di Counter <b>ORDER HERE!</b> saat Run + Brew.</p>
            </div>
            <Link href="/events" className="pixel-btn block rounded-md bg-hg-navy py-2 text-center text-xs font-bold text-white">
              Buka Kalender Event Lengkap →
            </Link>
          </div>
        )}

        {tab === "online" && (
          <ul className="divide-y divide-[#EFE1C4] rounded-lg border-2 border-[#2b1d17] bg-white">
            {world.members.map((m) => (
              <li key={m.id} className="flex items-center gap-2.5 px-3 py-2">
                <Link href={`/u/${m.handle}`} className="shrink-0">
                  <Avatar avatar={m.avatar} size={34} label={m.name} />
                </Link>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 truncate font-bold leading-tight">
                    <Link href={`/u/${m.handle}`} className="truncate hover:underline">
                      {m.name}
                    </Link>
                    {m.weeklyRank && (
                      <span title={`Top #${m.weeklyRank} Minggu Ini`}>
                        {m.weeklyRank === 1 ? "🥇" : m.weeklyRank === 2 ? "🥈" : "🥉"}
                      </span>
                    )}
                    {m.isMe && <span className="rounded bg-hg-yellow px-1 text-[10px]">KAMU</span>}
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    Lv {m.level} · {m.title} · {km(m.weekKm)} km minggu ini
                  </div>
                </div>
                <div className="flex shrink-0 gap-1">
                  {!m.isMe && (
                    <button
                      onClick={() => {
                        void sfx.cheer();
                        onCheerMember(m);
                        setCheeredId(m.id);
                        setTimeout(() => setCheeredId((cur) => (cur === m.id ? null : cur)), 1500);
                      }}
                      className="pixel-btn rounded bg-hg-yellow px-2 py-1 text-[11px] font-bold"
                      title="Kirim semangat langsung ke karakternya di peta!"
                    >
                      {cheeredId === m.id ? "🔥" : "👏"}
                    </button>
                  )}
                  <button
                    onClick={() => { onJumpMember(m); onClose(); }}
                    className="pixel-btn rounded bg-white px-2 py-1 text-[11px] font-bold"
                  >
                    Cari
                  </button>
                  <Link
                    href={`/u/${m.handle}`}
                    className="pixel-btn rounded bg-hg-orange px-2 py-1 text-[11px] font-bold text-white"
                  >
                    Profil
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SpringPop>
  );
}
