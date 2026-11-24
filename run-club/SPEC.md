# Higround Run Club — Product & Technical Spec (v0.3)

> Dokumen ini untuk Claude Code. Lokasi: `run-club/SPEC.md` di repo `Bojjifomo/Higround`.
> - **[KEPUTUSAN]** = default yang sudah dipilih, masih bisa diubah pemilik.
> - **[MENUNGGU]** = input yang belum ada. Pakai placeholder/env var, jangan blokir pekerjaan lain.
>
> Isi folder `run-club/`:
> - `SPEC.md` (dokumen ini)
> - `config/xp_rules.json` → aturan XP lari & level (§7)
> - `config/yoga_quests.json` → 28 misi Yoga Quest, hasil konversi dari `reference/Yoga_Quest_Level_Misi.pdf` (§8)
> - `reference/photos/` → 11 foto Higround (§6.1)
> - `reference/brand/` → logo oranye, hitam, putih (§5)
> - `config/world_layout.json` → denah konsep (66 objek: zona, POI, ornamen, rutinitas agent) (§6)
> - `reference/floorplan.svg` / `.png` → gambar denah yang dirender dari `world_layout.json`

**Changelog v0.3** (keputusan pemilik):
- Gaya visual **isometrik ala Kairosoft + commission**, aset gratis dipakai sebagai basis/filler (§12).
- Maskot bernama **"Higround"**. **Padel tidak termasuk.**
- Lantai 2 = **Studio Room**: yoga di pagi hari dan dine-in sepanjang hari. Konsep **Sports Hub** dirancang sendiri (§6.2).
- Denah ruko **5 × 18 m, 2 lantai** (§6).
- **Yoga Quest tanpa reviewer**: sistem kejujuran (consent) + timer di app. Syarat grup WA dipasang belakangan lewat feature flag (§8).

**Changelog v0.2**: brand & warna, maskot dari Drive, koordinat Higround, layout dunia dari foto, Yoga Quest 5 tahap / 28 misi / sistem bintang, pilihan aset gratis, aturan lisensi aset untuk repo publik.

---

## 1. Ringkasan

Higround Run Club adalah web app **game simulasi pixel-art** bergaya Kairosoft (*Dorayaki Shop*, *Cafe Master Story*). Dunianya adalah **Higround Harapan Indah** (Coffee & Burger + Sports Hub).

Setiap member:
1. Login, lalu menghubungkan akun **Intervals.icu** (yang tersambung ke jam tangan).
2. Membuat karakter pixel (rambut, baju, celana, sepatu, aksesoris).
3. Karakternya "tinggal" di Higround: antre di counter, ngopi, duduk di meja panjang, baca di rak buku, yoga, jogging keluar ruko.
4. Punya profil dengan **level + title**, **XP**, **badge**, dan **dashboard lari**, yang bisa dibuka semua member yang login.
5. Naik level dari lari nyata, dengan **bonus kalau start dari Higround**.
6. Menyelesaikan **Yoga Quest** (5 tahap, 28 misi, 1–3 bintang) dengan sistem kejujuran. Nantinya ada syarat join grup WhatsApp.
7. Ikut **activation/event** dengan multiplier XP dan badge event.
8. Ditemani maskot **Higround** sebagai NPC pemandu.

Semua art harus original atau berlisensi jelas. **Dilarang memakai sprite atau aset Kairosoft.**

---

## 2. Prinsip produk
- **Dunia terasa hidup**: karakter punya rutinitas, ada bubble reaksi, siang/malam ikut jam WIB.
- **Aktivitas nyata = progres**: tidak ada XP dari klik. XP hanya dari lari, yoga, badge, dan event.
- **Higround sebagai pusat**: mekanik bonus mendorong orang start lari dan kumpul di Higround.
- **Data dulu, game kemudian**: fondasi data dibangun dulu supaya dunia game langsung terisi.

---

## 3. Sumber data lari (wajib dibaca)

**Strava API Agreement (sejak Nov 2024)** melarang data aktivitas Strava seorang user ditampilkan ke user lain, termasuk di leaderboard, feed, dan club tools. Intervals.icu **tidak mengembalikan** aktivitas bersumber Strava lewat API. Yang muncul hanya stub: `"source": "STRAVA", "_note": "STRAVA activities are not available via the API"`.

Karena itu:
- **Onboarding wajib**: member menghubungkan jam tangan **langsung** ke Intervals.icu. Garmin, Coros, Suunto, Polar, dan Wahoo langsung ke Intervals.icu. Apple Watch lewat HealthFit atau RunGap.
- App **mengabaikan** `source == "STRAVA"` dan memberi peringatan di onboarding dan profil.

**Integrasi Intervals.icu** **[KEPUTUSAN]**: pemilik akan mendaftarkan OAuth app sendiri. Kredensialnya menyusul.
- Pakai env var: `INTERVALS_CLIENT_ID`, `INTERVALS_CLIENT_SECRET`, `INTERVALS_WEBHOOK_SECRET`, `INTERVALS_REDIRECT_URI`.
- Selama belum ada: buat **mock provider** (`lib/providers/intervals.mock.ts`) dengan fixture aktivitas realistis. Seluruh pipeline XP, profil, dan dunia game harus bisa jalan di mode mock.
- OAuth + webhook aktivitas baru + cron backfill harian. Saat user disconnect: `DELETE /api/v1/disconnect-app` lalu hapus data aktivitasnya.
- Token disimpan terenkripsi (Supabase Vault), jangan plaintext.
- Verifikasi nama scope dan payload webhook di dokumentasi Intervals.icu sebelum coding (forum.intervals.icu → "Intervals.icu OAuth support").

---

## 4. Alur user
```
Landing (preview dunia Higround animasi, tombol Join)
  → Sign up / Login (Google atau email magic link)
  → Connect Intervals.icu (OAuth)  ── belum ada aktivitas non-Strava? → panduan connect jam
  → Character Creator (dipandu maskot)
  → Dunia Higround
       ├ klik karakter → mini card → Profil
       ├ panel: Profil | Badge | Yoga Quest | Event | (fase 6) Leaderboard
       └ notifikasi "+XP" / "LEVEL UP!" saat aktivitas tersinkron
```

---

## 5. Brand

| Elemen | Nilai | Sumber |
|---|---|---|
| Wordmark | "HIGROUND", sans-serif bold/black, huruf O bulat | `reference/brand/logo_*.png` (4500×4500, transparan) |
| **Warna utama** | **Higround Orange `#FF5F0E`** | diambil langsung dari `logo_orange.png` |
| Hitam / Putih | `#000000` / `#FFFFFF` | logo |
| Tagline | "One bite says it all", "Coffee & Burger" | banner maskot, kaca depan |

Palet pendukung **[KEPUTUSAN — perkiraan dari foto, sesuaikan jika ada brand guide]**:

| Peran | Hex | Dari mana |
|---|---|---|
| Krem dinding | `#F3E9D2` | dinding interior |
| Abu beton | `#8B8883` | lantai semen poles |
| Kayu hangat | `#B07A4A` | wood slat, meja panjang, rak buku |
| Navy | `#2E3A8C` | panel "ORDER HERE!" |
| Kuning signage | `#F7D046` | papan "HIGROUND COFFEE / POPSICLE GELATO" |
| Merah maskot | `#E0352B` | bulu maskot |
| Biru-ungu | `#4B4FB8` | background wrap kulkas maskot |

**UI game**: panel krem dengan border oranye tebal ala Kairosoft, angka XP kuning, tombol utama oranye. Font pixel untuk heading (mis. *Pixelify Sans* / *Silkscreen*), font biasa untuk angka panjang di dashboard. Logo asli dipakai di landing dan header web. Di dalam game, logo dibuat ulang sebagai pixel signage.

### 5.1 Maskot: "Higround"
Nama sementara maskot: **Higround**. Wujudnya makhluk berbulu merah dengan mata besar dan kaki kecil. Aset sumber ada di Google Drive folder **"Mascot [new]"** (owner `higround.business@gmail.com`, ID `1541k2NiV_DSffof8DN_LUm2fbhbfarVH`).

**Padel tidak termasuk dalam game.** File padel hanya dipakai sebagai referensi pose dinamis, lalu digambar ulang menjadi **lari** dan **stretching** (raket diganti sepatu/botol minum).

| File (subfolder `PNG/`) | Drive ID | Dipakai sebagai |
|---|---|---|
| `higround_illust mascot_base.png` | `1YKpsg7NQZatToDBrA662oy1TBhheJ_0i` | pose idle / referensi pixel |
| `…_excited.png` | `14vHlJFF7XqK5WH3MHsBGyP3O-5JMacZB` | emote level up, badge baru |
| `…_shock.png` | `1YgSlU0-cOU4ytHBP3Qyn7Re1LjO60uxL` | emote personal best |
| `…_lemes.png` | `1AgrNOmiygdMuj7eoJl7AzAUrBCeUeUm9` | emote streak putus |
| `…_ngomel.png` | `1qBSmLP2g48oFZVphqSu3C-J0nENTC3e8` | nudge member yang tidak aktif > 7 hari |
| `…_kentut.png` | `1hrVIL9mEB37gDvLkxju4iXGixeuGkKHz` | easter egg acak |
| `…_padel1/2/3.png` | `1UJMhoCeYop3SX8YzO8cOZZKVnuRYBDDu`, `1xPQqY0YeXOwfk1yFr2vUvqAsBTq4XhDA`, `1lxD17nbOdqXLyVAGaxTZzlqUjWEtqZnV` | **hanya referensi pose** → digambar ulang jadi lari/stretch |
| `Higround_Padel.psd` (root folder) | `1k3-g3NWxnxwNgXT6YwUY79hgCC8Z8F0U` | file sumber berlayer (referensi anatomi maskot) |

Peran maskot di game:
- **NPC pemandu**: tutorial onboarding, menjelaskan cara dapat XP dan cara klaim Yoga Quest.
- **Reaksi**: bubble ekspresi sesuai tabel di atas.
- **Roaming**: jaga Start Gate di pagi hari, nongkrong di bar, ikut stretching di Run Club Lounge.
- **Kostum event**: ikat kepala Run Club, medali finisher, topi Santa, dll.

Di UI, maskot disebut "Higround" (contoh: *"Higround: Kamu baru buka Tahap 2!"*). Ilustrasi asli dikonversi menjadi sprite pixel isometrik (§12).

---

## 6. Dunia game

### 6.1 Referensi lokasi (foto di `reference/photos/`)
Higround menempati **ruko 2 lantai, 5 × 18 m** di Harapan Indah: fasad putih dengan signage vertikal "HIGROUND", kanopi seng, dan teras berisi tanaman serta parkir motor.

| Foto | Area | Elemen penting untuk pixel art |
|---|---|---|
| 01 | Fasad ruko | papan vertikal HIGROUND hitam, balkon besi, kanopi, cone, sandwich board |
| 02 | Depan | jendela **lengkung** "COFFEE & BURGER" + ilustrasi rusa, pintu kaca, pilar kayu, tanaman besar |
| 03, 04 | Counter + kios | counter putih, panel navy **"ORDER HERE!"**, tablet POS, tip jar, 2 grinder, mesin espresso merah, kios kuning-biru **"HIGROUND COFFEE / POPSICLE GELATO"**, dinding wood slat |
| 05, 06 | Bar di bawah tangga | counter **melengkung**, plafon miring, sink, **2 kulkas wrap maskot**, maneki-neko, gumball, papan "In case of emergency: BREAKDANCE" |
| 05 | Samping bar | chiller minuman, poster "Guest Check" |
| 07 | Belakang | **meja kayu jati panjang** di bawah skylight, bangku berisi tanaman, cermin bulat |
| 08 | Rak buku | rak ledge dengan buku menghadap depan, label oranye, kotak puzzle |
| 09 | Kids Corner | lemari mesh merah, poster KIDS CORNER, board vote "Burger MVP", ring basket mini |
| 10 | Dinding maskot | banner kain maskot oranye "One bite says it all" |
| 11 | Lantai 2 | **Studio Room**: dinding krem, lantai beton gelap, meja putih, jendela dengan pohon, rak vinyl, meja tempel dinding + lampu |

**Catatan IP**: beberapa dekorasi asli di café memakai karakter pihak ketiga (mis. pigura Studio Ghibli, balok "?" ala Mario, poster dengan karakter berlisensi). **Jangan digambar ulang di game.** Ganti dengan ilustrasi original bertema Higround.

### 6.2 Denah konsep **[KEPUTUSAN]**
Sumber kebenaran: `config/world_layout.json` (koordinat meter, 1 tile = 0,5 m → **10 × 36 tile per lantai**). Gambar: `reference/floorplan.png`.

**Teras & jalan (scene "street")**
- **START GATE Higround Run Club**: gerbang lengkung oranye `#FF5F0E` dengan papan "0 KM". Ini titik start dan finish lari di dunia game (bonus XP Higround divisualisasikan di sini).
- Spot stretching, galon air Run Club, sandwich board (membuka panel Event), cone oranye, motor parkir, tanaman pot besar, kanopi seng (overhead).
- Fasad di atas teras: signage vertikal HIGROUND + balkon besi lantai 2.

**Lantai 1 — Coffee & Burger** (depan → belakang)
1. Pintu kaca, pilar kayu, jendela lengkung "COFFEE & BURGER".
2. **Area makan depan**: 3 meja atas hitam dengan kursi putih, monstera dekat jendela.
3. **Kios HIGROUND COFFEE | POPSICLE GELATO** (dinding kanan), chiller minuman + poster Guest Check.
4. **Counter ORDER HERE!** (dinding kiri, wood slat di belakang): titik antre dan bayar, barista NPC.
5. **Bar melengkung bawah tangga**: ambil minuman, 2 kulkas maskot, sink, maneki-neko, papan BREAKDANCE.
6. **Area makan tengah**: 3 meja, banner maskot oranye, pigura poster Run Club.
7. Tangga ke lantai 2 (dinding kiri) + toilet.
8. **Kids Corner** dan **rak buku ledge** (dinding kanan).
9. Belakang: **dapur burger** (staff only; oven, deep fryer, rice cooker) dan **meja jati panjang di bawah skylight** (6 kursi, bangku tanaman, cermin bulat).

**Lantai 2 — Studio Room + Sports Hub**
1. Balkon besi (depan), jendela besar dengan pohon, rak vinyl + speaker.
2. **Studio Room** (setengah depan) dengan **dua mode** yang berganti otomatis:
   - **Mode Yoga**: 06.00–10.00 WIB (Sabtu–Minggu sampai 11.00). 6 mat, **yoga wall** (untuk Headstand di tembok), rak props, cermin panjang, **papan YOGA QUEST** (grid 28 pose + bintang member).
   - **Mode Dine-in** (10.00–22.00): mat digulung, 3 meja putih + meja tempel dinding dengan lampu.
   - Transisi ala Kairosoft: NPC staf menggulung mat dan menata meja dengan animasi singkat.
3. **RUN CLUB LOUNGE = Sports Hub** (setengah belakang):
   - Papan **RUN CLUB WEEK** (km komunitas minggu ini, top mileage, event berikutnya).
   - Loker/cubby tas, rak sepatu, bangku ganti sepatu.
   - Matras stretching + foam roller, hydration station (air + elektrolit).
   - **Dinding medali & bib** member + piala maskot Higround.
   - Pojok event (backdrop foto), bilik ganti, toilet, gudang.

**Konsep Sports Hub — "seirama dengan Higround"**
- Material sama dengan café: krem, beton, kayu, aksen oranye. Tidak terasa seperti gym.
- Humor khas Higround, mengikuti gaya papan "In case of emergency: BREAKDANCE". Contoh: "In case of PB: TRAKTIR KOPI", "Pace santai, kopi kencang", "Cooldown wajib, gelato opsional".
- Garis lintasan oranye tipis di lantai, dari tangga ke Start Gate. Ini jalur "pre-run" agent di game.
- Sports Hub tersebar di 3 titik: **Start Gate** (teras), **Studio Room** (yoga), dan **Run Club Lounge**. Ketiganya disebut sebagai satu ekosistem: **Higround Sports Hub**.

### 6.3 Rendering isometrik
- **Phaser 3** + tilemap **isometrik** dari Tiled (JSON). Tile diamond **32×16 px** (1 tile = 0,5 m).
- Kamera ala Kairosoft: bangunan dipotong (cutaway), dinding depan dan samping kanan disembunyikan atau dibuat transparan. Ada tombol **pilih lantai** (Teras+L1 / L2) dan auto-follow ke karakter milik user.
- Depth sorting per objek berdasarkan `(x + y)` tile. Objek `overhead` (kanopi, track light) dirender di layer atas dengan alpha.
- Mobile-first: drag untuk pan, zoom ×2/×3 integer, `image-rendering: pixelated`.
- Generator: script `tools/layout-to-tiled.ts` mengubah `world_layout.json` menjadi file Tiled awal (zona → object layer, POI → object dengan properti `actions`, `seats`, `slots`). Setelah itu art bisa dirapikan manual di Tiled.

### 6.4 Karakter hidup
- Agent = state machine + A* (`easystarjs`) di grid tile. `walkable` dihitung dari objek non-zona.
- **Rutinitas** ada di `world_layout.json → agent_routines`: `coffee_visit`, `post_run`, `pre_run`, `yoga_session`, `chill`, `family`. Bobotnya mengikuti data nyata:
  - Lari hari ini → `post_run` (finish di Start Gate, minum di hydration, ngobrol di meja panjang).
  - Punya bintang Yoga Quest → `yoga_session` di mode yoga, melakukan pose dengan bintang terbaiknya.
  - Member lama yang tidak aktif → `chill` dan dapat bubble "ngomel" dari maskot.
- Jam dunia mengikuti WIB nyata (pagi ramai teras dan studio, siang ramai counter, malam lampu hangat), dengan percepatan visual animasi ala Kairosoft.
- Bubble: "Perfect!", "Enak!", "+XP", "PB!", ikon kopi/sepatu/gelato.
- Populasi maksimal ±25 agent per lantai, dirotasi dari member yang aktif 7 hari terakhir. Karakter user yang login selalu ada.
- Klik agent → mini card → Profil.

### 6.5 HUD
- Atas: jam WIB, "Run Club Week N", km komunitas minggu ini, XP saya, toggle lantai.
- Bawah: **Profil**, **Badge**, **Yoga Quest**, **Event**, **Menu**.
- Ticker: "Rina baru lari 10K dari Higround! +75 XP".

---

## 7. Sistem XP & Level lari
Semua angka ada di `config/xp_rules.json` **[KEPUTUSAN — bisa di-tune]**.

| Sumber | XP |
|---|---|
| Jarak | 10 XP/km (per 0,1 km) |
| Elevasi | 1 XP / 10 m (Run, TrailRun) |
| Long run (tier tertinggi) | ≥10 km +30 · ≥21,1 km +100 · ≥42,2 km +300 |
| Mileage mingguan (kumulatif per tier, Senin–Minggu WIB) | 10 km +50 · 20 km +100 · 30 km +150 · 50 km +250 · 80 km +400 |
| Konsistensi | ≥3 hari lari per minggu +40 |
| Streak | +10 × N minggu berturut-turut (maks +100) |
| **Start dari Higround** | XP jarak **×1,5** + 25 flat, kalau titik start GPS dalam **200 m** dari **(-6.1692868660954705, 106.97518796135917)**; maks 1×/hari; tidak berlaku untuk VirtualRun |
| Personal best | 5K +50 · 10K +75 · HM +150 · FM +300 |

**Level**: `XP_kumulatif(n) = 40 × (n − 1)²`, maks Lv 50. Title: Rookie (1) · Jogger (5) · Pacer (10) · Strider (20) · Road Warrior (30) · Ultra (40) · Higround Legend (50).

**Anti-cheat**: flag jika pace rata-rata < 3:00/km, kecepatan maksimum > 25 km/jam, atau jarak > 100 km. Aktivitas tanpa device dan aktivitas `source == STRAVA` tidak dihitung. XP dari aktivitas yang di-flag ditahan sampai di-review.

**Implementasi**: `xp_ledger` append-only dengan `idempotency_key`. Level adalah view yang diturunkan dari ledger. Bonus mingguan dihitung oleh job setiap Senin 00:05 WIB. Rule engine `lib/xp` berupa fungsi murni dan wajib punya unit test.

---

## 8. Yoga Quest
Sumber: `reference/Yoga_Quest_Level_Misi.pdf` → `config/yoga_quests.json` (angka sudah dicocokkan 1:1 dengan PDF).

Supaya tidak tertukar dengan **Level** pemain, tingkatan yoga disebut **Tahap**.

### 8.1 Struktur
| Tahap | Nama | XP per misi | Misi | Syarat buka tahap berikutnya |
|---|---|---|---|---|
| 1 | Fondasi | 10 | Mountain, Child's Pose, Cat-Cow (gerak terus), Downward Dog, Baby Cobra | 4 dari 5 misi ≥2★ |
| 2 | Dasar | 20 | Warrior I*, Warrior II*, Triangle*, Tree*, Bridge, Low Lunge* | 5 dari 6 |
| 3 | Intermediate | 40 | Warrior III*, Half Moon*, Chair + Twist, Pigeon*, Plank, Chaturanga, Boat | 6 dari 7 |
| 4 | Advanced | 80 | Crow, Side Crow*, Wheel⚠, Headstand di tembok⚠, King Pigeon* | 4 dari 5 |
| 5 | Expert | 160 | Handstand⚠, Forearm Stand⚠, Firefly, Eight-Angle*, Scorpion⚠ | — |

`*` = per sisi: harus selesai di sisi kiri **dan** kanan. `⚠` = inversi/backbend: **bentuk benar lebih penting dari durasi**, wajib centang cue keamanan sebelum timer (§8.2-C6).

- **Bintang**: 1★ = 50% target, 2★ = 100% target, 3★ = 150% target (detik per misi ada di JSON).
- **Unlock**: tahap berikutnya terbuka kalau minimal 80% misi di tahap ini mencapai ≥2★.
- **XP** **[KEPUTUSAN]**: `xp_per_misi × rasio bintang terbaik` (1★ 50%, 2★ 100%, 3★ 150%). Naik bintang membayar selisihnya. Total di 2★ untuk semua misi = **1.650 XP**.
- **Misi bonus Flow Challenge**: Warrior I → Warrior II → Triangle tanpa jeda, total 75 detik, terbuka setelah Tahap 2. XP **[KEPUTUSAN]** 60.
- Yoga XP masuk ke **pool XP yang sama** dengan lari (satu level pemain).
- Di dunia game, karakter memakai pose dengan **bintang tertinggi** miliknya saat sesi yoga di Studio Room.

### 8.2 Klaim tanpa reviewer: sistem kejujuran **[KEPUTUSAN]**
Tidak ada instruktur atau admin yang mereview. Member menyatakan sendiri hasilnya dengan **consent**, dan app memastikan durasinya nyata lewat timer yang divalidasi server.

**A. Pernyataan kejujuran & keselamatan (sekali, sebelum klaim pertama)**
Member mencentang dan menyetujui (disimpan di `consents` beserta versi teks dan waktu):
1. "Saya hanya mengklaim pose yang benar-benar saya lakukan dengan bentuk yang benar."
2. "Saya memahami risiko yoga, terutama inversi dan backbend, dan bertanggung jawab atas keselamatan saya sendiri. Kalau ragu, saya berlatih dengan pengawasan."
3. "Badge Yoga Quest bersifat self-reported dan bisa dicabut kalau terbukti tidak jujur."

**B. Syarat grup WhatsApp: feature flag, dipasang belakangan**
- Flag `YOGA_WA_GATE` (default **off**) dan env `WA_GROUP_URL` (kosong sampai pemilik mengisinya).
- Saat flag **on**, muncul checklist sebelum klaim: tombol "Join grup WhatsApp" (klik dicatat), lalu centang "Saya sudah join grup Higround Yoga" (honor). Field `profiles.wa_joined_at` terisi.
- Saat flag **off**: checklist disembunyikan dan klaim langsung bisa dilakukan. Kode dan UI checklist tetap dibuat dari awal supaya tinggal dinyalakan.
- Member yang klaim saat flag masih off **tidak** kehilangan badge setelah flag dinyalakan. Mereka cukup melengkapi checklist sebelum klaim berikutnya.

**C. Quest Timer (inti verifikasi)**
1. Pilih misi → layar panduan (ilustrasi pixel pose, cue bentuk, target 1/2/3 bintang dalam detik).
2. Tekan **Mulai** → hitung mundur 3 detik → klien meminta **`attempt_token`** ke server. Server mencatat `started_at` dengan jam server.
3. Timer berjalan dengan penanda bintang yang menyala saat 50% / 100% / 150% target tercapai. Layar tetap menyala (Wake Lock API), dan suara "ding" di tiap bintang supaya HP bisa ditaruh di lantai.
4. Tekan **Selesai** → server mencatat `ended_at`. **Durasi yang dipakai = min(durasi klien, ended_at − started_at server)**, jadi waktu tidak bisa dipalsukan dengan mengubah jam HP.
5. Pose per sisi (`per_side: true`): jalankan timer untuk **kiri** lalu **kanan**. Bintang misi = bintang **terendah** dari kedua sisi.
6. Untuk pose ⚠ (inversi/backbend): sebelum timer mulai, wajib centang 2–3 **cue bentuk/keamanan** khusus pose itu (mis. Headstand di tembok: "lengan bawah & kepala membentuk segitiga", "punggung dekat tembok", "turun pelan"). Cue disimpan di `yoga_quests.json` (`form_cues`, diisi Claude Code dari sumber yoga umum, lalu dicek pemilik).
7. Konfirmasi akhir: "Saya melakukan pose ini dengan bentuk yang benar" → bintang dan XP langsung masuk.
8. Opsional: foto selfie pose untuk ditampilkan di profil (tidak wajib, tidak dinilai).

**D. Pengaman ringan (tanpa reviewer)**
- Cooldown **10 menit** per misi per member, dan maksimal **10 klaim misi per hari**.
- Tahap terkunci tetap terkunci (aturan unlock 80% ≥2★).
- Badge yoga ditandai **"Self-reported"** di profil.
- Tombol **Laporkan** di profil member lain (masuk ke antrian admin). Admin (pemilik) hanya bisa **mencabut** bintang/badge dan memberi catatan. Tidak ada review rutin.

### 8.3 Badge yoga
- **Tahap Clear** ×5: "Fondasi Clear" … "Expert Clear" (saat syarat unlock tahap tercapai; Tahap 5 = 80% misi ≥2★).
- **Perfect Tahap** ×5: semua misi di satu tahap 3★ (rarity Epic/Legendary).
- **Flow Master**: menyelesaikan Flow Challenge.
- **Pose badge** untuk misi Tahap 4–5 (mis. "Crow Pose", "Handstand"), memakai ikon pixel pose.

---

## 9. Badge lain
| Kategori | Contoh | Cara dapat |
|---|---|---|
| Running milestone | First Run, 50 / 100 / 500 / 1.000 km total | otomatis |
| Distance | First 10K, Half Marathon, Marathon, Ultra | otomatis |
| Higround | Home Base (5× start dari Higround), Regular (25×), Local Legend (100×) | otomatis |
| Streak | 4 Week Streak, 12 Week Streak | otomatis |
| Event | unik per activation | check-in / ikut event |
| Yoga | §8.3 | verifikasi |

Setiap badge punya ikon pixel 24×24, rarity, XP reward, dan unlock kosmetik opsional (mis. "Kaos Run Club oranye #FF5F0E" di Lv 10, "Topi maskot" dari Local Legend).

---

## 10. Activation / Event
- Admin membuat event: nama, waktu, lokasi (default koordinat Higround, radius 200 m), multiplier (default ×2), badge, syarat.
- Check-in lewat **QR** (token berotasi) di counter **atau** otomatis dari aktivitas yang start di lokasi dalam jendela waktu event.
- Template: **Sunday Long Run @Higround** (≥10 km, ×2), **Monthly Virtual Challenge** (50 km/bulan), **Run + Brew** (check-in QR di kasir setelah lari), **Yoga Saturday** (sesi di Studio Room + bonus XP check-in QR).
- Di game: banner event di sandwich board, start gate dihias, maskot memakai kostum event.

---

## 11. Profil & Dashboard
Terbuka untuk semua user yang login (toggle privat tersedia).
- **Header**: sprite animasi, nama, `Lv 12 · Pacer`, XP bar, 3 badge pin.
- **Lari**: total km, km minggu/bulan ini, jumlah lari, elevasi, jumlah start dari Higround, grafik mileage 12 minggu, tren pace, heatmap kalender, PB 5K/10K/HM/FM, aktivitas terbaru (tanpa peta).
- **Yoga**: progress per Tahap, total bintang, pose yang sudah dikuasai.
- **Badge** (yang belum didapat tampil abu-abu) dan **riwayat XP**.
- **Privasi**: jangan pernah tampilkan rute GPS ke user lain. Hapus akun = hapus semua data + revoke token Intervals.icu + hapus foto yoga.

---

## 12. Art direction & sumber aset **[KEPUTUSAN: isometrik ala Kairosoft + commission]**

### 12.1 Aturan dasar
- **Satu gaya, satu palet.** Kualitas Kairosoft datang dari konsistensi. Aset gratis dari berbagai author **wajib di-recolor** ke palet Higround (§5) dan outline-nya disamakan. Kalau tidak bisa disamakan, aset itu hanya dipakai sebagai placeholder.
- **Repo `Bojjifomo/Higround` PUBLIK.** Aset yang lisensinya melarang redistribusi **tidak boleh di-commit**. Simpan di `run-club/assets/vendor/` (gitignored), sinkronkan dari Supabase Storage privat, dan catat semuanya di `ASSET_LICENSES.md`.
- Aset **CC0** dan **hasil commission milik Higround** boleh masuk repo (`assets/own/`).
- Tile diamond **32×16 px**, karakter ±32–40 px tinggi, outline gelap 1 px, shading 2–3 tingkat, cahaya dari kiri atas.

### 12.2 Aset gratis terpilih
| Kebutuhan | Aset | Lisensi | Peran |
|---|---|---|---|
| **Base karakter isometrik** | **intellikat — 32px Isometric Modern Character Template** (gratis) | **CC0**: bebas dipakai dan dimodifikasi; author menyarankan (tidak mewajibkan) karakter turunannya juga CC0 | **Fondasi sistem paper doll**. Artist commission membangun layer rambut/baju/sepatu/aksesori dan animasi di atas template ini. Karena CC0, semua turunannya aman di repo publik. Catatan: sheet asli tidak berskala 1:1, jadi perlu di-downscale/dirapikan dulu. |
| Furnitur & dekor modern | **Cryovex — Pixel Isometric Modern Interior** (versi Free) | Boleh komersial, boleh dimodifikasi, **dilarang redistribusi**; kredit tidak wajib | Filler furnitur (kursi, meja, lampu, tanaman). Recolor ke palet Higround. |
| Furnitur rumah/peralatan | **Kabukidanshi — Isometric Pixel Art Home Interior Pack** | Gratis untuk komersial **dengan atribusi**; dilarang redistribusi/jual ulang | Filler dinding, peralatan, sebagian furnitur. |
| Dekor kecil | **lumeish — Tiny Interior Decoration (Isometric)** (150 item) | Tercantum CC BY-SA 4.0, tapi halaman tidak konsisten → **konfirmasi ke author sebelum dipakai** | Ornamen kecil (buku, gelas, pot). Kalau lisensi belum jelas, jangan dipakai. |
| Placeholder layout | **Kenney — Isometric Miniature** series | CC0 | Hanya untuk blocking/prototipe sebelum art jadi (bukan pixel art). |

Aset yang **tidak dipakai**: aset top-down (LimeZu, Mana Seed) karena sudutnya berbeda, dan LPC (lisensi ShareAlike + gaya RPG fantasi).

### 12.3 Commission (bagian yang membuat game terasa Higround)
Urutan prioritas. Setiap item dikirim sebagai `.aseprite` + PNG spritesheet + JSON (format Aseprite "Array"), dengan kepemilikan penuh untuk Higround.

**P1 — wajib untuk MVP dunia**
1. **Sistem karakter modular** di atas template CC0: 2 arah gambar (SE, NE) yang di-mirror jadi 4. Animasi: idle, walk, run, sit, drink, stretch, cheer. Layer: 6 skin tone (palette swap), 10 rambut (+ palette swap warna), 12 atasan, 8 bawahan, 8 sepatu, 6 headwear, 4 kacamata, 6 aksesori (jam, hydration vest, earphone, botol, tote Higround, medali).
2. **Maskot Higround**: idle, walk, run, stretch, dan 6 emote (base, excited, shock, lemes, ngomel, kentut) dari ilustrasi Drive.
3. **Tileset Higround**: lantai beton poles, dinding krem, wood slat, tangga, jendela lengkung, pintu kaca, fasad ruko + signage vertikal, kanopi seng, trotoar.
4. **Prop landmark** (± 14): counter ORDER HERE!, bar melengkung bawah tangga, kios HIGROUND COFFEE | POPSICLE GELATO, kulkas wrap maskot (2 varian), mesin espresso merah + grinder, meja jati panjang + skylight, rak buku ledge, Kids Corner, banner maskot, Start Gate Run Club, papan RUN CLUB WEEK, papan YOGA QUEST, dinding medali, sandwich board.

**P2 — Yoga & UI**
5. **28 pose yoga** pada base karakter (1 frame statis per pose, sisi kiri saja; kanan = mirror) + ikon 24×24 per pose.
6. **Ikon badge** (± 25) dan elemen UI pixel: panel krem berbingkai oranye, tombol, angka XP, bubble.

**P3 — Polish**
7. Variasi musiman/event (dekor Natal, Ramadan, Lari 17 Agustus), kostum maskot, efek cuaca (hujan di teras).

**Brief untuk artist**: sertakan `reference/photos/`, `reference/floorplan.png`, `reference/brand/`, file maskot Drive, screenshot game Kairosoft **sebagai referensi rasa saja** (jangan menjiplak), template intellikat, dan palet §5.

**Sambil menunggu commission**: Claude Code memakai placeholder (Kenney + Cryovex + kotak berwarna berlabel dari `world_layout.json`), sehingga gameplay bisa dibangun dan dites lebih dulu.

### 12.4 Pipeline teknis
- Semua sprite dimuat lewat `assets/manifest.json` (id → file, frame, anchor, footprint tile). Mengganti placeholder dengan art final cukup dengan mengganti file + manifest.
- Paper doll: layer `shadow → body → bottom → shoes → top → face → hair_back → hair_front → headwear → glasses → accessory`, dengan layout frame identik. Warna lewat palette swap (pre-bake ke texture saat avatar disimpan, supaya ringan di HP).
- Saat avatar disimpan, render **composite spritesheet** per user (di klien atau Edge Function) dan simpan di Storage. Dunia game cukup memuat 1 texture per agent.

---

## 13. Arsitektur
| Lapisan | Pilihan |
|---|---|
| Frontend | Next.js (App Router) + TypeScript + Tailwind |
| Game | Phaser 3 (isometric) + Tiled + easystarjs |
| Backend | Supabase: Postgres, Auth, Storage (aset vendor privat, composite avatar, foto profil yoga opsional), Edge Functions, Realtime, pg_cron |
| Hosting | Vercel + Supabase |
| Chart | Recharts dengan styling pixel |

```
run-club/
  SPEC.md  CLAUDE.md  ASSET_LICENSES.md
  apps/web/
    app/            # /, /login, /onboarding, /create, /world, /u/[handle], /yoga, /yoga/[mission], /admin
    game/           # scenes (street+floor1, floor2), projection (iso), agents, routines, depth sort
    lib/xp/         # rule engine murni + test
    lib/yoga/       # bintang, per-sisi, unlock, XP selisih, cooldown — murni + test
    lib/providers/  # intervals.ts, intervals.mock.ts
  tools/            # layout-to-tiled.ts, palette-check.ts
  supabase/migrations/  supabase/functions/   # intervals-oauth, intervals-webhook, sync-backfill, weekly-xp, yoga-attempt
  config/           # xp_rules.json, yoga_quests.json, world_layout.json, badges.json, cosmetics.json, flags.json
  reference/        # foto, logo, PDF, floorplan (milik Higround, aman di repo)
  assets/
    own/            # CC0 template + hasil commission (aman di repo)
    vendor/         # GITIGNORED: aset itch.io berlisensi no-redistribution
    manifest.json
```

### 13.1 Model data
```
profiles(id, handle, display_name, avatar jsonb, avatar_sheet_url, pinned_badges, is_dashboard_public,
         wa_joined_at, role('member'|'admin'))
consents(user_id, kind('yoga_honor'), version, accepted_at)
integrations(user_id, provider, athlete_id, access_token_enc, scopes, connected_at, revoked_at)
activities(id, user_id, provider_activity_id, source, type, start_time, distance_m, moving_time_s, elev_gain_m,
           avg_pace_s_per_km, max_speed_kmh, start_lat, start_lng, is_higround_start, flagged, flag_reason, review_status, raw jsonb)
xp_ledger(id, user_id, amount, rule_key, source_type, source_id, idempotency_key unique, created_at)
badges(id, key, name, category, rarity, icon, xp_reward, criteria jsonb, unlock_cosmetic_id, self_reported bool)
user_badges(user_id, badge_id, awarded_at, revoked_at, revoke_note)
yoga_attempts(id, user_id, mission_key, side('both'|'left'|'right'), attempt_token, server_started_at, server_ended_at,
              client_s, counted_s, stars, cues_checked jsonb, confirmed bool, photo_path, revoked_at, created_at)
yoga_progress   -- view: bintang terbaik per misi (min kiri/kanan), tahap terbuka
reports(id, reporter_id, target_user_id, target_kind, target_id, note, status, created_at)
events(id, name, starts_at, ends_at, lat, lng, radius_m, multiplier, badge_id, rules jsonb)
event_checkins(event_id, user_id, method, created_at)
cosmetics(id, slot, key, unlock jsonb)   user_cosmetics(user_id, cosmetic_id)
v_user_level    -- view: total_xp, level, title, xp_to_next
```
**RLS**: user hanya bisa menulis datanya sendiri. `yoga_attempts` hanya boleh dibuat lewat Edge Function `yoga-attempt` (yang memvalidasi token, durasi server, cooldown, dan batas harian), bukan insert langsung dari klien. Profil bisa dibaca semua user `authenticated` (kecuali yang privat).

`config/flags.json`: `{ "YOGA_WA_GATE": false, "LEADERBOARD": false, "REALTIME_PRESENCE": false }`.

### 13.2 Sync pipeline
OAuth → backfill 12 minggu → webhook aktivitas baru → upsert `activities` (ambil titik start dari stream latlng kalau perlu) → `lib/xp` → `xp_ledger` → cek badge → Realtime push "+XP" ke klien. Cron harian: backfill 3 hari terakhir. Cron Senin: bonus mingguan.

---

## 14. Roadmap
| Fase | Isi | Butuh dari pemilik |
|---|---|---|
| 0 | Scaffold, Supabase, Vercel, `.gitignore` aset vendor, mock provider, flags | akun Supabase/Vercel |
| 1 | Auth, Intervals (mock dulu), `lib/xp` + test, level, badge otomatis, profil & dashboard | kredensial OAuth (menyusul) |
| 2 | `lib/yoga` + test, consent, Quest Timer (server-timed), checklist WA di belakang flag, laporan + cabut badge | link WA (menyusul) |
| 3 | Dunia isometrik dengan **placeholder**: `layout-to-tiled`, 2 scene, cutaway, depth sort, agent & rutinitas, mode Studio yoga/dine, HUD | — |
| 4 | Character Creator (paper doll) + composite spritesheet | commission P1 #1 (bisa mulai dari template CC0 mentah) |
| 5 | Ganti placeholder dengan art commission; maskot NPC + emote | commission P1 #2–4 |
| 6 | Activation: event, QR, multiplier, dekorasi | daftar event |
| 7 | Polish: pose yoga di dunia, presence realtime, leaderboard, PWA, share card IG Story | commission P2–P3 |

Fase 0–3 tidak menunggu art apa pun.

---

## 15. Masih dibutuhkan dari pemilik
- [ ] Kredensial OAuth Intervals.icu → env `INTERVALS_*`.
- [ ] Link grup WhatsApp → env `WA_GROUP_URL`, lalu nyalakan `YOGA_WA_GATE`.
- [ ] Artist commission + budget (brief §12.3).
- [ ] Review denah konsep (`reference/floorplan.png`), terutama posisi tangga, toilet, dan dapur dibandingkan kondisi asli.
- [ ] Daftar event pertama.
- [ ] Cek isi `form_cues` pose ⚠ setelah diisi Claude Code.

## 16. Pertanyaan terbuka
1. Treadmill (`VirtualRun`) dapat XP penuh atau dikurangi?
2. Leaderboard publik, atau cukup profil + badge? (default: off lewat flag)
3. Reward nyata di café (mis. free drink di level tertentu)? Kalau ya, perlu alur voucher dan validasi di kasir.
4. Bahasa UI: Indonesia, Inggris, atau toggle? (default: Indonesia)
5. Apakah peserta kelas yoga berbayar (tiket Rp75 rb, lihat `finance/config.json`) dapat bonus XP?
6. Nama final maskot (sementara "Higround").

---

## 17. Prompt pembuka untuk Claude Code
> Baca `run-club/SPEC.md`, semua file di `run-club/config/`, dan `run-club/reference/` (termasuk `floorplan.png`). Kerjakan **Fase 0–3**:
> 1. Scaffold struktur §13 (Next.js + TS + Tailwind + Supabase). Tambahkan `run-club/assets/vendor/` ke `.gitignore`, buat `ASSET_LICENSES.md`, `config/flags.json`, dan `run-club/CLAUDE.md` (ringkasan konteks, konvensi, cara menjalankan). Tambahkan baris `run-club/` di `README.md` root.
> 2. `lib/xp` dan `lib/yoga` sebagai modul murni dari JSON di `config/`, dengan unit test untuk semua aturan §7 dan §8: bonus Higround (koordinat di config), tier mingguan, streak, anti-cheat, bintang per sisi = min(kiri, kanan), unlock 80%, XP selisih saat bintang naik, cooldown, dan batas harian. Isi `form_cues` untuk pose ⚠ dari sumber yoga umum, lalu tandai untuk dicek pemilik.
> 3. Migration §13.1 + RLS. Edge Function `yoga-attempt` dengan token dan durasi berbasis jam server.
> 4. Provider Intervals.icu nyata + **mock** (env kosong → mock). Abaikan `source == "STRAVA"`. Verifikasi endpoint dan scope di dokumentasi Intervals.icu.
> 5. Halaman `/u/[handle]`, `/yoga`, `/yoga/[mission]` (consent + checklist WA di belakang flag + Quest Timer), dan `/admin` (laporan, cabut badge, flag aktivitas). Pakai brand §5.
> 6. Dunia isometrik dengan **placeholder**: `tools/layout-to-tiled.ts` dari `world_layout.json`, scene Teras+Lantai 1 dan Lantai 2, cutaway, depth sort, agent dengan `agent_routines`, mode Studio yoga/dine sesuai jam WIB, HUD, dan klik agent → profil. Sprite placeholder berupa kotak berwarna berlabel atau aset CC0.
> Jangan commit aset pihak ketiga yang dilarang diredistribusi (repo publik). Tanyakan dulu sebelum mengubah keputusan bertanda [KEPUTUSAN].
