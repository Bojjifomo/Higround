"use client";
import { useActionState, useEffect, useState } from "react";
import { Avatar } from "@/components/Avatar";
import { SpringBounce } from "@/components/SpringUI";
import { Button } from "@/components/ui";
import { saveAvatar, type FormState } from "@/app/actions";
import { sfx } from "@/lib/audio/sfx";
import {
  ANIM_FRAMES, AVATAR_OPTIONS, AVATAR_PALETTES, normalizeAvatar, randomAvatar,
  type AnimPose, type AvatarColors, type NormalizedAvatar,
} from "@/lib/world/sprite";

type TabKey = "face" | "hair" | "top" | "bottom" | "shoes" | "headwear" | "accessory";

const TABS: { key: TabKey; label: string; icon: string; colorField: keyof typeof AVATAR_PALETTES; colorLabel: string }[] = [
  { key: "face", label: "Wajah", icon: "🙂", colorField: "skin", colorLabel: "Warna Kulit" },
  { key: "hair", label: "Rambut", icon: "💇", colorField: "hair", colorLabel: "Warna Rambut" },
  { key: "top", label: "Atasan", icon: "👕", colorField: "top", colorLabel: "Warna Baju" },
  { key: "bottom", label: "Bawahan", icon: "🩳", colorField: "bottom", colorLabel: "Warna Celana" },
  { key: "shoes", label: "Sepatu", icon: "👟", colorField: "shoes", colorLabel: "Warna Sepatu" },
  { key: "headwear", label: "Topi", icon: "🧢", colorField: "headwearColor", colorLabel: "Warna Topi" },
  { key: "accessory", label: "Aksesori", icon: "🕶️", colorField: "accessoryColor", colorLabel: "Warna Aksesori" },
];

const POSES: { id: AnimPose; label: string }[] = [
  { id: "idle", label: "Idle" },
  { id: "walk", label: "Jalan" },
  { id: "run", label: "Lari" },
  { id: "sit", label: "Ngopi" },
  { id: "stretch", label: "Stretch" },
  { id: "yoga", label: "Yoga" },
];

export function CharacterCreator({
  initial,
  displayName,
  handle,
  welcome,
  intervalsNote,
  nextPath,
}: {
  initial: AvatarColors;
  displayName: string;
  handle: string;
  welcome: boolean;
  intervalsNote?: string;
  nextPath: string;
}) {
  const [avatar, setAvatar] = useState<NormalizedAvatar>(() => normalizeAvatar(initial));
  const [bounceTick, setBounceTick] = useState(0);
  const [tab, setTab] = useState<TabKey>("hair");
  const [pose, setPose] = useState<AnimPose>("walk");
  const [flip, setFlip] = useState(false);
  const [frame, setFrame] = useState(0);
  const [mascotLine, setMascotLine] = useState<string>(() =>
    intervalsNote === "connected"
      ? "Mantap! Jam kamu udah nyambung & lari 12 minggu terakhir ditarik. Sekarang bikin karakter pixel kamu buat masuk Dunia Higround!"
      : welcome
        ? `Halo ${displayName}! Yuk pilih gaya rambut, outfit lari, dan aksesori karakter pixel kamu sebelum masuk Dunia Higround.`
        : "Mau ganti outfit lari atau gaya rambut? Perubahan langsung tampil di Dunia Higround!",
  );
  const [state, formAction, pending] = useActionState<FormState, FormData>(saveAvatar, null);

  useEffect(() => {
    const ms = pose === "run" ? 115 : pose === "walk" ? 165 : 420;
    const id = setInterval(() => {
      setFrame((f) => (f + 1) % ANIM_FRAMES[pose]);
    }, ms);
    return () => clearInterval(id);
  }, [pose]);

  const activeTab = TABS.find((t) => t.key === tab)!;
  const swatches = AVATAR_PALETTES[activeTab.colorField];
  const currentColor = avatar[activeTab.colorField];

  const patch = (p: Partial<NormalizedAvatar>, note?: string) => {
    setAvatar((prev) => ({ ...prev, ...p }));
    setBounceTick((n) => {
      void sfx.pop(n + 1);
      return n + 1;
    });
    if (note) setMascotLine(note);
  };

  const handleRandom = () => {
    setAvatar(randomAvatar());
    setBounceTick((n) => n + 1);
    void sfx.dice();
    const quips = [
      "Kece banget! Siap start dari Higround nih!",
      "Wih, gaya barunya bikin pace makin kencang!",
      "Cocok buat ngopi abis Sunday Long Run!",
      "Outfit baru, semangat PB baru!",
    ];
    setMascotLine(quips[Math.floor(Math.random() * quips.length)]);
  };

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="avatar" value={JSON.stringify(avatar)} />
      <input type="hidden" name="next" value={nextPath} />

      {/* Mascot guide bar */}
      <div className="flex items-center gap-3 rounded-lg border-4 border-black bg-[#FFFDF7] p-3 shadow-[4px_4px_0_#111]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={intervalsNote === "connected" ? "/assets/world/mascot/guide_cheer.png" : "/assets/world/mascot/guide_idle.png"}
          alt="Maskot Higround"
          width={58}
          height={58}
          className="shrink-0 [image-rendering:pixelated]"
        />
        <div className="min-w-0 flex-1 text-sm">
          <div className="font-pixel text-base leading-none text-hg-orange">HIGROUND</div>
          <p className="mt-1 text-neutral-800">&ldquo;{mascotLine}&rdquo;</p>
        </div>
      </div>

      {/* Main SnowHex-inspired pixel creator frame */}
      <div className="pixel-frame overflow-hidden rounded-xl bg-[#D9B88C] p-3 sm:p-4">
        <div className="grid gap-4 lg:grid-cols-[1.05fr_1fr]">
          {/* LEFT: Checkerboard Live Preview Stage */}
          <div className="pixel-frame flex flex-col justify-between rounded-lg bg-[#F5E7CE] p-3">
            {/* Top stage bar */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="rounded border-2 border-[#3B261C] bg-[#FFFDF7] px-2.5 py-0.5 font-pixel text-sm leading-tight">
                {displayName} <span className="font-sans text-xs font-bold text-neutral-500">@{handle}</span>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => setFlip((f) => !f)}
                  className="rounded border-2 border-[#3B261C] bg-[#FFFDF7] px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_#3B261C] hover:bg-hg-cream active:translate-y-[1px]"
                  title="Putar arah karakter"
                >
                  ⇄ Putar
                </button>
                <button
                  type="button"
                  onClick={handleRandom}
                  className="rounded border-2 border-[#3B261C] bg-hg-yellow px-2.5 py-1 text-xs font-bold shadow-[2px_2px_0_#3B261C] hover:brightness-95 active:translate-y-[1px]"
                  title="Acak karakter"
                >
                  🎲 Acak
                </button>
              </div>
            </div>

            {/* Pixel checkerboard stage */}
            <div
              className="relative my-3 flex min-h-[250px] flex-col items-center justify-center rounded-md border-4 border-[#5C3A28]"
              style={{
                backgroundImage:
                  "repeating-conic-gradient(#EFE0C4 0% 25%, #E3CFAF 0% 50%)",
                backgroundSize: "24px 24px",
              }}
            >
              {/* Soft ground shadow + Kairosoft squash-and-stretch spring bounce! */}
              <div className="relative flex flex-col items-center">
                <SpringBounce triggerKey={bounceTick}>
                  <Avatar
                    avatar={avatar}
                    size={138}
                    pose={pose}
                    frame={frame}
                    flip={flip}
                    label={`Preview karakter ${displayName}`}
                  />
                </SpringBounce>
                <div className="-mt-3 h-4 w-24 rounded-full bg-black/20" />
              </div>

              <span className="absolute bottom-2 right-2 rounded border border-[#5C3A28] bg-[#FFFDF7]/90 px-2 py-0.5 font-pixel text-xs text-[#3B261C]">
                PREVIEW: {POSES.find((p) => p.id === pose)?.label.toUpperCase()}
              </span>
            </div>

            {/* Animation pose switcher */}
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              {POSES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => { setPose(p.id); setFrame(0); }}
                  className={`rounded border-2 border-[#3B261C] px-2.5 py-1 text-xs font-bold transition-colors ${
                    pose === p.id
                      ? "bg-hg-orange text-white shadow-[2px_2px_0_#3B261C]"
                      : "bg-[#FFFDF7] text-[#3B261C] hover:bg-hg-cream"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* RIGHT: Color Palette + Style Picker Grid */}
          <div className="flex flex-col gap-3">
            {/* Color Swatches Panel (SnowHex style with corner selection brackets!) */}
            <div className="rounded-lg border-4 border-[#3B261C] bg-[#F5E7CE] p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-pixel text-sm uppercase tracking-wide text-[#3B261C]">
                  {activeTab.colorLabel}
                </span>
                <span className="rounded border border-[#3B261C]/30 bg-white px-1.5 py-0.5 font-mono text-[10px] font-bold">
                  {currentColor}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {swatches.map((hex) => {
                  const selected = currentColor.toLowerCase() === hex.toLowerCase();
                  return (
                    <button
                      key={hex}
                      type="button"
                      onClick={() => patch({ [activeTab.colorField]: hex } as Partial<NormalizedAvatar>)}
                      aria-label={`Pilih warna ${hex}`}
                      aria-pressed={selected}
                      className={`relative h-9 w-9 rounded-md border-2 border-[#3B261C] transition-transform ${
                        selected ? "scale-110 ring-2 ring-white shadow-[2px_2px_0_#3B261C]" : "hover:scale-105"
                      }`}
                      style={{ backgroundColor: hex }}
                    >
                      {selected && (
                        <>
                          <span className="pointer-events-none absolute -left-1 -top-1 h-2 w-2 border-l-2 border-t-2 border-black" />
                          <span className="pointer-events-none absolute -right-1 -top-1 h-2 w-2 border-r-2 border-t-2 border-black" />
                          <span className="pointer-events-none absolute -bottom-1 -left-1 h-2 w-2 border-b-2 border-l-2 border-black" />
                          <span className="pointer-events-none absolute -bottom-1 -right-1 h-2 w-2 border-b-2 border-r-2 border-black" />
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Category Tabs + Visual Option Grid (like SnowHex Screenshot 3!) */}
            <div className="flex-1 rounded-lg border-4 border-[#3B261C] bg-[#F5E7CE] p-3">
              {/* Cozy folder-style tabs */}
              <div role="tablist" aria-label="Kategori karakter" className="mb-3 flex flex-wrap gap-1">
                {TABS.map((t) => {
                  const active = tab === t.key;
                  return (
                    <button
                      key={t.key}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => setTab(t.key)}
                      className={`rounded-t-md border-2 border-[#3B261C] px-2.5 py-1 text-xs font-bold transition-all ${
                        active
                          ? "bg-hg-orange text-white shadow-[2px_2px_0_#3B261C]"
                          : "bg-[#EAD4B0] text-[#3B261C] hover:bg-[#FFFDF7]"
                      }`}
                    >
                      <span className="mr-1" aria-hidden>{t.icon}</span>
                      {t.label}
                    </button>
                  );
                })}
              </div>

              {/* Visual Tile Grid */}
              <StyleOptionGrid tab={tab} avatar={avatar} onPatch={patch} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Save Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border-4 border-black bg-[#FFFDF7] p-3 shadow-[4px_4px_0_#111]">
        <p className="text-xs text-neutral-600">
          Karakter kamu langsung dipakai di <b>Dunia Higround (/world)</b>, profil, dan papan member.
        </p>
        <div className="flex items-center gap-2">
          {state && !state.ok && <span role="alert" className="text-xs font-bold text-hg-red">{state.message}</span>}
          <Button disabled={pending} className="px-5 py-2 text-base font-pixel tracking-wide">
            {pending
              ? "Menyimpan..."
              : welcome
                ? "Simpan & Masuk Dunia Higround →"
                : "Simpan Karakter"}
          </Button>
        </div>
      </div>
    </form>
  );
}

function StyleOptionGrid({
  tab,
  avatar,
  onPatch,
}: {
  tab: TabKey;
  avatar: NormalizedAvatar;
  onPatch: (p: Partial<NormalizedAvatar>, note?: string) => void;
}) {
  if (tab === "shoes") {
    return (
      <div className="rounded-md border-2 border-dashed border-[#5C3A28]/40 bg-[#FFFDF7] p-4 text-center text-sm">
        <p className="font-bold text-[#3B261C]">Pilih warna sepatu lari kamu di palet warna di atas!</p>
        <p className="mt-1 text-xs text-neutral-600">
          Coba klik pose <b>Lari</b> di kiri buat lihat gaya sepatu kamu pas sprint di depan Start Gate.
        </p>
      </div>
    );
  }

  const configMap = {
    face: { field: "eyeStyle" as const, options: AVATAR_OPTIONS.eyeStyle },
    hair: { field: "hairStyle" as const, options: AVATAR_OPTIONS.hairStyle },
    top: { field: "topStyle" as const, options: AVATAR_OPTIONS.topStyle },
    bottom: { field: "bottomStyle" as const, options: AVATAR_OPTIONS.bottomStyle },
    headwear: { field: "headwear" as const, options: AVATAR_OPTIONS.headwear },
    accessory: { field: "accessory" as const, options: AVATAR_OPTIONS.accessory },
  };
  const { field, options } = configMap[tab];

  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-3 xl:grid-cols-4">
      {options.map((opt) => {
        const selected = avatar[field] === opt.id;
        const previewAvatar: NormalizedAvatar = { ...avatar, [field]: opt.id };
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => onPatch({ [field]: opt.id } as Partial<NormalizedAvatar>)}
            aria-pressed={selected}
            className={`relative flex flex-col items-center rounded-md border-2 p-2 text-center transition-all ${
              selected
                ? "border-hg-orange bg-[#FFFDF7] shadow-[3px_3px_0_#FF5F0E]"
                : "border-[#5C3A28]/50 bg-[#EFE0C4] hover:border-[#3B261C] hover:bg-[#FFFDF7]"
            }`}
          >
            {selected && (
              <>
                <span className="pointer-events-none absolute left-0.5 top-0.5 h-2 w-2 border-l-2 border-t-2 border-black" />
                <span className="pointer-events-none absolute right-0.5 top-0.5 h-2 w-2 border-r-2 border-t-2 border-black" />
                <span className="pointer-events-none absolute bottom-0.5 left-0.5 h-2 w-2 border-b-2 border-l-2 border-black" />
                <span className="pointer-events-none absolute bottom-0.5 right-0.5 h-2 w-2 border-b-2 border-r-2 border-black" />
              </>
            )}
            <Avatar avatar={previewAvatar} size={46} label={opt.label} />
            <span className="mt-1 line-clamp-1 text-[11px] font-bold leading-tight text-[#3B261C]">
              {opt.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
