# Handoff Context — Higround Run Club (Sesi v1–v3 → Lanjut v4)

Dokumen ini merangkum 100% konteks, keputusan desain, arsitektur, aturan repo publik, dan status live deploy dari sesi pengembangan sebelumnya agar agent di Cloud Project (`Bojjifomo/Higround`) bisa langsung melanjutkan tanpa kehilangan konteks.

---

## 1. Visi Produk & Referensi yang Disepakati User

### A. Visual & Rasa Game
- **Kairosoft** (feel cozy, hidup, animasi chibi, SFX retro crispy)
- **WorkAdventure / Gather.town** (dunia pixel 2D custom, member online kelihatan di peta, klik karakter buka profil)
- **Habitica** (RPG pixel yang mengubah kebiasaan nyata jadi XP, party quest, modal level-up)
- **SnowHex Pixel Character Maker** (layout character creator: preview tengah dengan pose, palet warna di kanan/atas, tab kategori + grid ikon visual di bawah)
- **Akurasi Ruko Asli**: semua layout lantai 1 & lantai 2 mengacu pada 10 foto ruko Higround Harapan Indah di `run-club/reference/photos/`.

### B. Referensi Game Loop & Integrasi Kafe
- **NIKELAND**: event dunia aktif saat member benar-benar olahraga.
- **Chipotle Burrito Builder & Starbucks Rewards**: quest/tier di game berujung hadiah/voucher kafe yang bisa ditukar di kasir atau giveaway.
- **Pokémon GO × McDonald's Indonesia**: bonus check-in QR di lokasi ruko fisik.
- **Zombies, Run!**: akumulasi lari komunitas mengisi/meng-upgrade prop dekorasi di ruko (lampu string, balon maskot, piala emas).
- **Pikmin Bloom**: jejak visual langkah kaki di peta setelah lari.
- **Zwift**: dunia terlihat ramai saat orang aktif.
- **Runaddicts**: format event lokal & papan klub mingguan Indonesia.

### C. Stack Motion, Audio & 3D yang Sudah Diintegrasikan (dari Diskusi Tools Muse)
1. **Tone.js (`lib/audio/sfx.ts`)**: SFX retro 8-bit (`pop`, `select`, `dice`, `cheer`, `cashier`, `starDing`, `levelUp`) + BGM toggle + ding bintang timer Yoga (+ Screen Wake Lock API). *(Catatan v4: BGM akan di-upgrade ke Playlist Higround.)*
2. **`@react-spring/web` (`components/SpringUI.tsx`)**: fisika pegas (`SpringPop`, `SpringBounce`, `AnimatedNumber`, `LevelUpModal`).
3. **Blender 2:1 Orthographic Pixel Studio (`run-club/tools/blender_higround_studio.py`)**: mendukung native Blender 4.x `bpy` DAN mode `--standalone` pure-Python 3D ortho rasterizer; menghasilkan 4 render 3D ruko di `public/assets/world/blender/`.
4. **Remotion (`remotion/RunStoryVideo.tsx`, `app/share/`)**: studio preview & export IG Story 9:16 (PNG 1080×1920 + WebM). *(Catatan v4: akan diperluas ke Share per Run & finalisasi layout.)*

---

## 2. Apa yang Sudah Dibangun & Live (Commit `ae2fe81`)

Branch utama repo: **`claude/lucid-meitner-sectkx`**.  
App Next.js berada di: **`run-club/apps/web`**.

- **Commit `2aea88d` (v1)**:
  - Pipeline aset `run-club/tools/build_world_assets.py` (memakai aset CC0 `PtDesigns` & `intellikat` + landmark/maskot Higround).
  - Onboarding flow: `/login` → `/onboarding` → `/onboarding/connect` → `/create` (SnowHex Character Creator) → `/world`.
  - Cookie `hg_iv_next` pada `app/api/intervals/connect/route.ts` & `callback/route.ts`.
- **Commit `dd1f38f` (v2)**:
  - 66 shaded pixel sprites (`public/assets/world/manifest.json`) mencakup seluruh furnitur ruko L1 & L2.
  - Chibi sprite engine 28×36 (`lib/world/sprite.ts`, `components/Avatar.tsx`) dengan 6 pose animasi (`idle`, `walk`, `run`, `sit`, `stretch`, `yoga`). 100% backward-compatible dengan kolom Supabase `profiles.avatar` JSONB (tanpa butuh migrasi SQL baru).
  - Diorama interaktif (`game/createWorldGame.ts`), RPG HUD (`app/world/WorldClient.tsx`, `WorldDrawers.tsx`), Club Party Quest, Leaderboard mingguan, dan sistem Cafe Rewards (`lib/rewards/index.ts`).
- **Commit `ae2fe81` (v3)**:
  - Integrasi `tone`, `@react-spring/web`, `remotion`, `@remotion/player`.
  - Blender 2:1 ortho studio pipeline + 4 sprite 3D arsitektur ruko.
  - Halaman `/share` (Remotion IG Story Studio).
- **Baseline Verifikasi terakhir**:
  - `npm test`: 125 passed, 1 skipped (termasuk PGlite SQL store + RLS + sprite/manifest/rewards).
  - `npm run typecheck`: 0 errors.
  - `npm run lint`: 0 warnings/errors.
  - `npm run build`: clean production build.

---

## 3. Aturan Wajib & Batasan Penting

1. **Repo ini PUBLIC (`Bojjifomo/Higround`)**:
   - **JANGAN PERNAH** commit atau push aset vendor non-redistributable (`run-club/assets/vendor/` — Cryovex, Kabukidanshi, dotplays). Folder tersebut sengaja di-gitignore. Lihat `run-club/ASSET_LICENSES.md`.
   - **JANGAN PERNAH** commit `.env.local`, API key, database URL, atau data pribadi (email pribadi, IP internal).
   - Hanya aset berlisensi **CC0** (`PtDesigns`, `intellikat`) dan aset original Higround yang boleh masuk repo.
2. **Jangan sentuh folder di luar `run-club/`** (misalnya `finance/`).
3. **Kompatibilitas Supabase**:
   - Perubahan pada `profiles.avatar` JSONB sebaiknya tetap opsional & backward-compatible dengan `normalizeAvatar()` di `lib/world/sprite.ts` agar member lama tidak error.
   - Jika butuh tabel/kolom baru (mis. untuk Chat, Giveaway, atau Walk tracking), buat file SQL migration baru di `run-club/supabase/migrations/` dan infokan user untuk menjalankannya di Supabase SQL Editor.

---

## 4. Infrastruktur & Cara Deploy di Mac Mini

- **Host produksi**: Mac mini (running Next.js di port `3000`, diekspos lewat Tailscale Funnel HTTPS).
- **Folder produksi di Mac mini**: `~/higround-runclub-web/run-club/apps/web` (branch `claude/lucid-meitner-sectkx`).
- **Process manager**: **PM2** dengan nama app **`runclub`** (auto-start via `pm2.andreas.plist`).
  - *Catatan*: Jangan suruh user menjalankan `npm run start` manual karena port `3000` sudah dipegang PM2 `runclub`.
- **Command update standar di Mac mini setelah push ke GitHub**:
  ```bash
  cd ~/higround-runclub-web && git pull origin claude/lucid-meitner-sectkx && cd run-club/apps/web && npm ci && npm run build && pm2 restart runclub --update-env
  ```
- **Env produksi**: `.env.local` sudah ada di Mac mini (`NEXT_PUBLIC_SITE_URL` sudah diset ke URL Tailscale HTTPS dan Google OAuth login sudah berhasil dites di HP).

---

## 5. Status Saat Ini & Langkah Berikutnya

- **Hasil QA Live Pertama (27 Nov 2026)**:
  - Login Google via Supabase + Tailscale Funnel di HP: **BERHASIL**.
  - Seluruh temuan bug mobile (HUD atas numpuk, peta tidak bisa touch-pan, player tidak ketemu, Intervals.icu belum connect) + permintaan rombak UX/fitur sudah dikompilasi lengkap di **`run-club/REVISI_ROADMAP_V4.md`**.
- **Aturan Mulai Sesi Baru**:
  - Baca **`run-club/REVISI_ROADMAP_V4.md`** dan **`run-club/SPEC.md`**.
  - **Jangan langsung eksekusi coding sebelum user mengonfirmasi** 6 pertanyaan terbuka di Bagian 4 `REVISI_ROADMAP_V4.md` atau memberi instruksi langsung untuk mulai mengerjakan **Fase A**.
  - Gunakan gaya komunikasi Bahasa Indonesia santai ("gue/lu"), ringkas, dan jujur soal trade-off teknis.
