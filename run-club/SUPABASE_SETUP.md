# Setup Supabase + login (langkah demi langkah)

Selama env Supabase belum diisi, app jalan di **mode demo** (club palsu di memori). Setelah langkah di bawah
selesai, app otomatis pindah ke **mode Supabase**: login Google / email, data tersimpan permanen, dan lari
ditarik dari Intervals.icu.

> Jangan pernah kirim key, password, atau secret ke chat. Isi semuanya di `.env.local` (lokal) atau di
> Environment Variables Vercel.

## 1. Bikin project Supabase

1. Buka https://supabase.com → **New project**.
2. Region: **Southeast Asia (Singapore)**. Simpan **database password** di password manager.
3. Tunggu project siap (±2 menit).

## 2. Pasang tabel (migration)

Pilih salah satu:

- **SQL Editor** (paling gampang): buka **SQL Editor → New query**, tempel isi
  `run-club/supabase/migrations/20261124000000_init.sql`, **Run**. Ulangi untuk
  `20261125000000_app_store.sql`. Urutannya harus begitu.
- **Supabase CLI**: dari folder `run-club/`, jalankan `supabase link --project-ref <ref>` lalu `supabase db push`.

Token Intervals.icu disimpan terenkripsi di **Vault**. Biasanya sudah aktif di project baru; kalau belum,
buka **Database → Extensions** dan aktifkan `supabase_vault`.

## 3. Atur login

**Authentication → URL Configuration**
- *Site URL*: alamat app, mis. `https://run.higround.id` (lokal: `http://localhost:3000`).
- *Redirect URLs*: tambahkan `https://<alamat-app>/auth/callback` (dan `http://localhost:3000/auth/callback` untuk lokal).

**Authentication → Providers**
- **Email**: aktif (dipakai untuk magic link).
- **Google**: aktifkan, isi Client ID + Secret dari Google Cloud Console (OAuth client "Web application",
  *Authorized redirect URI* = `https://<project-ref>.supabase.co/auth/v1/callback`).

## 4. Isi environment variables

Salin `run-club/apps/web/.env.example` ke `.env.local` (lokal) atau isi di Vercel → Settings → Environment
Variables. Yang wajib untuk mode Supabase:

| Variable | Dari mana |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Project Settings → API → `anon` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Project Settings → API → `service_role` key (rahasia, server saja; dipakai untuk hapus akun) |
| `DATABASE_URL` | **Connect** → *Session pooler* connection string, ganti `[YOUR-PASSWORD]` |
| `NEXT_PUBLIC_SITE_URL` | alamat app, tanpa `/` di akhir |
| `ADMIN_EMAILS` | email lu (koma kalau lebih dari satu): akun ini jadi admin saat daftar pertama kali |
| `INSTRUCTOR_EMAILS` | email instruktur yoga |
| `CRON_SECRET`, `EVENT_QR_SECRET` | string acak panjang, mis. hasil `openssl rand -base64 32` |

Opsional: `DATABASE_CA_CERT` (Database → SSL configuration → download certificate, tempel isinya) supaya
sertifikat server Postgres diverifikasi.

> Variabel `NEXT_PUBLIC_*` dibaca saat **build**. Isi dulu, baru build / deploy.

## 5. Intervals.icu

Di app OAuth Intervals.icu (Settings → Apps → app lu):
- Redirect URL: `https://<alamat-app>/api/intervals/callback` (persis).
- Centang **Public Client** + **Require PKCE**.
- Webhook URL (opsional tapi disarankan): `https://<alamat-app>/api/intervals/webhook`, centang
  `ACTIVITY_UPLOADED`, `ACTIVITY_UPDATED`, `ACTIVITY_DELETED`; salin *Webhook Secret*.

Env: `INTERVALS_CLIENT_ID`, `INTERVALS_REDIRECT_URI` (URL di atas), `INTERVALS_WEBHOOK_SECRET`.
`INTERVALS_CLIENT_SECRET` biarkan kosong (public client).

## 6. Deploy

- **Vercel**: import repo, *Root Directory* = `run-club/apps/web`, isi env, deploy. `vercel.json` sudah
  menjadwalkan `/api/cron/sync` tiap hari 00:05 WIB (Vercel mengirim `CRON_SECRET` otomatis).
- **Mac mini**: `npm run build && npm start` di `run-club/apps/web`, pasang Tailscale Funnel seperti app
  HiGround sebelumnya, dan jadwalkan `curl -H "Authorization: Bearer $CRON_SECRET" https://<alamat>/api/cron/sync`
  tiap hari.

## 7. Cek

1. Buka app → **Masuk** → Google atau email.
2. Isi nama + username di halaman onboarding.
3. Di profil: **Sambungkan Intervals.icu** → Allow → lari 12 minggu terakhir masuk.
4. Akun dengan email di `ADMIN_EMAILS` melihat menu **Admin** dan bisa bikin event.
