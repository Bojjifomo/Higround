"use client";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SpringPop } from "@/components/SpringUI";
import { sfx } from "@/lib/audio/sfx";
import type { WorldMember, WorldView } from "@/lib/data/service";
import { km } from "@/lib/format";

export type DrawerTab = "club" | "rewards" | "events" | "online" | null;

const POI_INFO: Record<string, {
  title: string; badge: string; desc: string; tip: string;
  ctaLabel: string; ctaHref?: string; openDrawer?: DrawerTab; locked?: boolean;
}> = {
  start_gate: {
    title: "START GATE · 0 KM",
    badge: "Bonus XP ×1,5",
    desc: "Titik kumpul & start resmi Higround Run Club. Setiap lari yang start dalam radius 200 m dari ruko dapat XP jarak ×1,5 + 25 XP flat!",
    tip: "Terinspirasi NIKELAND & Pikmin Bloom: pelari yang finish hari ini meninggalkan jejak glow oranye di peta!",
    ctaLabel: "Lihat Event Aktif",
    openDrawer: "events",
  },
  order_counter: {
    title: "Counter ORDER HERE!",
    badge: "Pokémon GO Check-in",
    desc: "Scan QR yang berganti tiap 60 detik di kasir untuk check-in Run + Brew (+50 XP & +1 Brew Stamp), atau tukarkan voucher kopi kamu!",
    tip: "Setiap 5 Brew Stamp membuka progres reward minuman kafe.",
    ctaLabel: "Buka Voucher Kafe",
    openDrawer: "rewards",
  },
  gelato_kiosk: {
    title: "Kios HIGROUND · POPSICLE GELATO",
    badge: "Reward Yoga",
    desc: "Selesaikan Yoga Quest Tahap 1 (Fondasi Clear) untuk membuka voucher Free Popsicle Gelato langsung di kios ini!",
    tip: "Pendinginan abis lari paling enak sambil gelato.",
    ctaLabel: "Cek Voucher Gelato",
    openDrawer: "rewards",
  },
  sandwich_board: {
    title: "Papan Event & Aktivasi",
    badge: "Runaddicts Format",
    desc: "Lihat jadwal Sunday Long Run (×2 XP), Run + Brew QR Check-in, Monthly 50K Virtual Challenge, dan Yoga Saturday.",
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
    title: "Papan RUN CLUB WEEK",
    badge: "Habitica Party Quest",
    desc: "Pantau Misi Klub Mingguan (150 km bareng) dan top runner minggu ini. Makin tinggi total km klub, makin banyak dekor ruko yang terbuka!",
    tip: "Tier 2 nyalain lampu gantung, Tier 3 pasang Balon Maskot, Tier 4 buka Piala Emas!",
    ctaLabel: "Buka Papan Klub",
    openDrawer: "club",
  },
  medal_wall: {
    title: "Dinding Medali & Bib Finisher",
    badge: "Zombies, Run! Upgrade",
    desc: "Setiap milestone jarak lari komunitas ikut meramaikan dinding medali dan piala di Higround Sports Hub.",
    tip: "Lihat progres upgrade ruko di tab Klub & Quest.",
    ctaLabel: "Cek Progres Upgrade Ruko",
    openDrawer: "club",
  },
  kids_corner: {
    title: "KIDS CORNER · Burger MVP",
    badge: "Family Friendly",
    desc: "Pojok santai dengan lemari mesh merah, buku mewarnai, ring basket mini, dan papan vote Burger MVP!",
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
      <div className="mt-3 flex items-center justify-end gap-2">
        <button onClick={() => { void sfx.select(); onClose(); }} className="rounded px-2.5 py-1 text-xs font-bold underline">Tutup</button>
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

  return (
    <SpringPop className="pixel-frame pointer-events-auto flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-xl bg-[#FFF8EA]">
      <div className="flex shrink-0 items-center justify-between border-b-2 border-[#2b1d17] bg-[#EFE1C4] px-4 py-2.5">
        <h2 className="font-pixel text-lg leading-none text-[#241917]">
          {tab === "club" && "🏆 Klub, Misi Mingguan & Upgrade Ruko"}
          {tab === "rewards" && "☕ Higround Cafe Rewards & Voucher"}
          {tab === "events" && "🎟️ Event & Check-in QR Ruko"}
          {tab === "online" && `👥 Member Aktif di Peta (${world.members.length})`}
        </h2>
        <button onClick={() => { void sfx.select(); onClose(); }} className="pixel-btn rounded bg-white px-2.5 py-0.5 text-xs font-bold">✕</button>
      </div>

      <div className="overflow-y-auto p-4 text-sm space-y-4">
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

            {/* Runaddicts Weekly Mileage Leaderboard */}
            <div>
              <h3 className="mb-2 font-pixel text-base">🔥 Papan Klub Minggu Ini</h3>
              <ol className="divide-y divide-[#EFE1C4] rounded-lg border-2 border-[#2b1d17] bg-white">
                {world.weeklyLeaders.map((l, i) => (
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

              {/* Chipotle-style Real Cafe Vouchers */}
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
                Belum ada event yang sedang live jam ini. Cek jadwal Sunday Long Run, Run + Brew, dan Yoga Saturday di halaman Event!
              </div>
            )}
            <div className="rounded-lg border-2 border-[#2b1d17]/20 bg-[#EFE1C4]/70 p-3 text-xs space-y-1">
              <div className="font-bold text-[#241917]">Cara dapat bonus di Event Higround:</div>
              <p>• <b>Auto Check-in (NIKELAND / Pokémon GO):</b> Start lari dalam radius 200 m dari ruko Higround saat jadwal event.</p>
              <p>• <b>QR Kasir:</b> Scan QR dinamis di Counter <b>ORDER HERE!</b> saat Run + Brew atau Yoga Saturday.</p>
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
                <Avatar avatar={m.avatar} size={34} label={m.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold leading-tight">
                    {m.name} {m.isMe && <span className="rounded bg-hg-yellow px-1 text-[10px]">KAMU</span>}
                  </div>
                  <div className="text-[11px] text-neutral-600">
                    Lv {m.level} · {m.title} · {km(m.weekKm)} km minggu ini
                  </div>
                </div>
                <div className="flex gap-1">
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
                      {cheeredId === m.id ? "Terkirim! 🔥" : "👏 Semangat"}
                    </button>
                  )}
                  <button
                    onClick={() => { onJumpMember(m); onClose(); }}
                    className="pixel-btn rounded bg-white px-2 py-1 text-[11px] font-bold"
                  >
                    Cari
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </SpringPop>
  );
}
