# Higround Run Club — notes for Claude Code

Read `SPEC.md` first. It is the source of truth; items marked **[KEPUTUSAN]** are owner decisions:
ask before changing them. **[MENUNGGU]** = input that does not exist yet: use a placeholder or env var.

## Layout

```
run-club/
  SPEC.md                 product + technical spec (v0.3)
  config/                 rule data read by the code — never hardcode these numbers
    xp_rules.json         run XP, level curve, titles, anti-cheat, Higround coordinates (§7)
    yoga_quests.json      5 tahap, 28 misi, stars, claim rules (§8)
    world_layout.json     floor plan for the game world (§6)
  reference/              Higround's own photos, logos, PDF (safe in this public repo)
  supabase/migrations/    SQL schema + RLS (§13.1)
  apps/web/               Next.js app (App Router, TypeScript, Tailwind)
    lib/xp/               run XP rule engine — pure functions + tests
    lib/yoga/             Yoga Quest stars / unlocks / claims — pure functions + tests
    lib/providers/        Intervals.icu provider (real + mock)
    lib/supabase/         browser / server / service-role clients
    supabase-tests/       applies the migrations to PGlite and checks RLS
  assets/vendor/          GITIGNORED: third-party art (licences forbid redistribution)
```

## Run it

```bash
cd run-club/apps/web
npm install
cp .env.example .env.local      # may stay empty: mock provider, no Supabase
npm test                        # vitest: xp, yoga, providers, migrations + RLS
npm run dev                     # http://localhost:3000
npm run typecheck && npm run lint && npm run build
```

Supabase: create a cloud project (or `supabase start` with Docker), then `supabase link` and
`supabase db push` from `run-club/` to apply `supabase/migrations`. Put the URL and keys in `.env.local`.

## Demo mode (no Supabase yet)

While `NEXT_PUBLIC_SUPABASE_URL` is empty the app runs on `lib/data` with an **in-memory demo store**
(`lib/data/demo.ts`): 8 made-up members, 12 weeks of mock runs, some yoga claims, all XP synced through the
real rules. `/login` lets you pick a member (admin "Demo Owner", instructor "Sari", a private member "Gita").
Data resets when the server restarts. Pages only talk to `lib/data/service.ts`, which talks to a `Store`;
the Supabase store (same interface) comes with Supabase Auth.

Pages: `/` (members by XP), `/login`, `/u/[handle]` (profile + run dashboard + yoga + badges + XP history),
`/yoga` (consent, server-timed claims, flow challenge), `/admin` (flagged runs, yoga claims, WhatsApp),
`/admin/class` (instructor gives stars).

## The world (`/world`, Sesi 3)

- `lib/world/layout.ts` turns `config/world_layout.json` into three 0.5 m grids (street, floor 1, floor 2):
  furniture blocks the tiles whose centre it covers; mats, gate, stretch areas, door and stairs are walk-on.
  Portals: front door (street ↔ floor 1) and stairs (floor 1 ↔ floor 2).
- `lib/world/path.ts`: A* (4 directions) and the 32 × 16 isometric projection. Own A* instead of easystarjs:
  synchronous, pure, tested; the grids are tiny.
- `lib/world/agents.ts`: routine picked from real data (ran today → post_run, yoga stars → yoga_session,
  morning → pre_run, else coffee/chill/family), walk → use (bubble) → … → leave, then respawn. The mascot
  "Higround" loops forever. Day phase from the WIB hour tints the scene.
- `game/createWorldGame.ts`: Phaser 3 renderer, loaded only in the browser. Placeholder art drawn in code
  (iso floor, furniture boxes, back walls, pixel people from `lib/world/sprite.ts`). Rows are flipped so the
  street is at the front. Integer zoom 1–3×, drag to pan, click a character for its mini card.
- Who is shown: public members active in the last 7 days (max 25) and you. HUD and ticker come from
  `worldView()` in `lib/data/service.ts`.
- Concept-plan note: on floor 2 the storage, changing booth and toilet wall off the event corner; the
  changing booth is walk-through for now. Owner to check the real layout.

## Rules of the road

- **Data first, game later** (§2). XP only comes from real activity, yoga, badges and events.
- `lib/xp` and `lib/yoga` stay pure: rules in, entries out, no clock, no I/O. Every ledger entry has an
  idempotency key; `xp_ledger.idempotency_key` is unique, so recomputing never pays twice.
- Anything that pays XP or proves something is written by the server with the service role
  (`lib/supabase/admin.ts`). Members only write their profile and start yoga timers (RLS).
- Never show GPS routes or start coordinates to other members. Clients cannot even select those columns.
- Strava-sourced activities are stubs in the Intervals.icu API: they are dropped (`source == "STRAVA"`).
- Intervals.icu: empty `INTERVALS_CLIENT_ID` or `INTERVALS_REDIRECT_URI` → mock provider. Prefer a
  **public client** (tick "Public Client" + "Require PKCE" on the intervals.icu app, no secret).
- Yoga Quest v0.3: honor system, server-timed claims, no reviewer, no video. The WhatsApp gate is
  behind `YOGA_WA_GATE` (off until `WA_GROUP_URL` exists).
- Repo is **public**: never commit third-party assets (`assets/vendor/`), secrets, or photos of people
  who have not agreed. `reference/photos/05_curved_counter_barista.jpg` is left out on purpose.
- UI copy is Indonesian (casual), code and comments English.

## Choices made in code that the spec leaves open (owner may change)

- A personal best pays XP only when it beats an earlier best (the first effort sets the baseline), so a
  12-week backfill does not flood XP.
- A streak week = a week (Mon–Sun WIB) with at least one counted run.
- Flow Challenge opens once Tahap 2 is cleared ("terbuka setelah Tahap 2").
- Yoga cooldown is per mission **and side**, so the left and right holds can be claimed back to back.
- Yoga XP is reconciled per mission (should hold − already paid), so an admin can cancel a claim and its XP,
  and the member can earn it back later.
- Badge list and XP rewards: `config/badges.json` ([KEPUTUSAN] default).
- Form cues for the five inversion/backbend poses were written by Claude Code: **to be checked by the
  owner or the instructor** before launch.
