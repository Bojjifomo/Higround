-- Higround Run Club: initial schema (SPEC §13.1, adapted to v0.3).
--
-- Who writes what:
--   * members (role `authenticated`) write only their own profile and start their own yoga timers;
--   * everything that pays XP or proves something (activities, xp_ledger, yoga_attempts, badges awarded,
--     event check-ins, integrations) is written by the server with the service role, which bypasses RLS.
-- Access tokens never sit in a table: integrations.access_token_secret_id points at a Supabase Vault secret.


-- ── helpers ──────────────────────────────────────────────────────────────────

create table public.profiles (
  id                    uuid primary key references auth.users (id) on delete cascade,
  handle                text not null unique check (handle ~ '^[a-z0-9_]{3,24}$'),
  display_name          text not null check (char_length(display_name) between 1 and 40),
  avatar                jsonb not null default '{}'::jsonb,          -- paper-doll layers (SPEC §12.3)
  pinned_badges         text[] not null default '{}' check (cardinality(pinned_badges) <= 3),
  is_dashboard_public   boolean not null default true,
  wa_number             text,
  wa_verified_at        timestamptz,                                 -- set by an admin (no WhatsApp API)
  yoga_consent_version  integer,                                     -- accepted safety/honesty consent
  role                  text not null default 'member' check (role in ('member', 'instructor', 'admin')),
  created_at            timestamptz not null default now()
);

create function public.is_admin() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') $$;

create function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as
$$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('instructor', 'admin')) $$;

/** Profile visible to the caller: their own, a public one, or anyone's for an admin. */
create function public.can_see(owner uuid) returns boolean
  language sql stable security definer set search_path = public as
$$ select owner = auth.uid()
       or public.is_admin()
       or exists (select 1 from public.profiles p where p.id = owner and p.is_dashboard_public) $$;

-- ── integrations & activities ────────────────────────────────────────────────

create table public.integrations (
  user_id                 uuid not null references public.profiles (id) on delete cascade,
  provider                text not null check (provider in ('intervals')),
  athlete_id              text not null,
  access_token_secret_id  uuid,                 -- vault.secrets.id; never exposed to clients
  scopes                  text not null default '',
  connected_at            timestamptz not null default now(),
  revoked_at              timestamptz,
  last_synced_at          timestamptz,
  sync_error              text,
  primary key (user_id, provider),
  unique (provider, athlete_id)
);

create table public.activities (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null references public.profiles (id) on delete cascade,
  provider_activity_id  text not null,
  source                text,
  device_name           text,
  type                  text not null,
  start_time            timestamptz not null,
  distance_m            double precision not null default 0,
  moving_time_s         integer not null default 0,
  elev_gain_m           double precision not null default 0,
  avg_pace_s_per_km     double precision,
  max_speed_kmh         double precision,
  start_lat             double precision,   -- server-only: never shown to other members (privacy)
  start_lng             double precision,
  is_higround_start     boolean not null default false,
  counted               boolean not null default true,   -- false: Strava stub, no device, wrong type
  flagged               boolean not null default false,
  flag_reason           text[] not null default '{}',
  review_status         text not null default 'none' check (review_status in ('none', 'pending', 'approved', 'rejected')),
  raw                   jsonb,
  created_at            timestamptz not null default now(),
  unique (user_id, provider_activity_id)
);
create index activities_user_time on public.activities (user_id, start_time desc);
create index activities_review on public.activities (review_status) where review_status = 'pending';

-- ── XP ───────────────────────────────────────────────────────────────────────

create table public.xp_ledger (
  id               bigint generated always as identity primary key,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  amount           integer not null check (amount <> 0),
  rule_key         text not null,
  source_type      text not null check (source_type in ('activity', 'week', 'yoga', 'badge', 'event', 'adjustment')),
  source_id        text not null,
  idempotency_key  text not null unique,          -- the rule engine's key: one payout per (rule, source)
  created_at       timestamptz not null default now()
);
create index xp_ledger_user on public.xp_ledger (user_id);

-- ── badges & cosmetics ───────────────────────────────────────────────────────

create table public.cosmetics (
  id      text primary key,
  slot    text not null,
  key     text not null,
  unlock  jsonb not null default '{}'::jsonb
);

create table public.badges (
  id                  text primary key,                      -- e.g. 'first_10k', 'yoga_clear_1'
  name                text not null,
  category            text not null,
  rarity              text not null default 'common' check (rarity in ('common', 'rare', 'epic', 'legendary')),
  icon                text,
  xp_reward           integer not null default 0,
  criteria            jsonb not null default '{}'::jsonb,
  unlock_cosmetic_id  text references public.cosmetics (id)
);

create table public.user_badges (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  badge_id    text not null references public.badges (id),
  awarded_at  timestamptz not null default now(),
  awarded_by  uuid references public.profiles (id),           -- null = automatic
  primary key (user_id, badge_id)
);

create table public.user_cosmetics (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  cosmetic_id  text not null references public.cosmetics (id),
  primary key (user_id, cosmetic_id)
);

-- ── Yoga Quest (v0.3: honor system, server-timed) ────────────────────────────

create table public.yoga_timers (
  id                  uuid primary key default gen_random_uuid(),
  user_id             uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  mission_key         text not null,
  side                text not null check (side in ('both', 'left', 'right')),
  form_cues_ack       boolean not null default false,
  started_at          timestamptz not null default now(),
  claimed_at          timestamptz
);

/** The start time is the server's, whatever the client sends. */
create function public.yoga_timer_server_time() returns trigger
  language plpgsql as
$$ begin
     new.started_at := now();
     new.claimed_at := null;
     return new;
   end $$;
create trigger yoga_timers_server_time before insert on public.yoga_timers
  for each row execute function public.yoga_timer_server_time();

create table public.yoga_attempts (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  timer_id       uuid unique references public.yoga_timers (id) on delete set null,
  mission_key    text not null,
  side           text not null check (side in ('both', 'left', 'right')),
  measured_s     integer not null check (measured_s >= 0),
  stars          smallint not null check (stars between 1 and 3),
  mode           text not null default 'timer' check (mode in ('timer', 'class')),
  status         text not null default 'approved' check (status in ('approved', 'rejected')),
  label          text not null default 'self_reported',
  reviewer_id    uuid references public.profiles (id),    -- only when staff overrides a claim
  reason         text,
  created_at     timestamptz not null default now()
);
create index yoga_attempts_user on public.yoga_attempts (user_id, mission_key, side);

-- ── events ───────────────────────────────────────────────────────────────────

create table public.events (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  starts_at   timestamptz not null,
  ends_at     timestamptz not null check (ends_at > starts_at),
  lat         double precision not null default -6.1692868660954705,
  lng         double precision not null default 106.97518796135917,
  radius_m    integer not null default 200,
  multiplier  numeric(4, 2) not null default 2,
  badge_id    text references public.badges (id),
  rules       jsonb not null default '{}'::jsonb
);

create table public.event_checkins (
  event_id    uuid not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  method      text not null check (method in ('qr', 'activity', 'class')),
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

-- ── views ────────────────────────────────────────────────────────────────────

/** Best stars per mission side (approved claims only). */
create view public.yoga_progress with (security_invoker = true) as
  select user_id, mission_key, side, max(stars) as best_stars, count(*) as attempts
  from public.yoga_attempts
  where status = 'approved'
  group by user_id, mission_key, side;

/** Level from XP: 40 × (n − 1)² per level, max 50 (keep in step with lib/xp levelFor). */
create view public.v_user_level with (security_invoker = true) as
  with t as (
    select p.id as user_id, coalesce(sum(x.amount), 0)::integer as total_xp
    from public.profiles p
    left join public.xp_ledger x on x.user_id = p.id
    group by p.id
  ), l as (
    select user_id, total_xp, least(50, floor(sqrt(greatest(total_xp, 0) / 40.0))::integer + 1) as level
    from t
  )
  select user_id, total_xp, level,
         case when level >= 50 then 'Higround Legend' when level >= 40 then 'Ultra'
              when level >= 30 then 'Road Warrior' when level >= 20 then 'Strider'
              when level >= 10 then 'Pacer' when level >= 5 then 'Jogger' else 'Rookie' end as title,
         case when level >= 50 then null else 40 * level * level - total_xp end as xp_to_next
  from l;

-- ── row level security ───────────────────────────────────────────────────────

alter table public.profiles        enable row level security;
alter table public.integrations    enable row level security;
alter table public.activities      enable row level security;
alter table public.xp_ledger       enable row level security;
alter table public.badges          enable row level security;
alter table public.user_badges     enable row level security;
alter table public.cosmetics       enable row level security;
alter table public.user_cosmetics  enable row level security;
alter table public.yoga_timers     enable row level security;
alter table public.yoga_attempts   enable row level security;
alter table public.events          enable row level security;
alter table public.event_checkins  enable row level security;

-- Clients reach tables only through these grants; the service role keeps full access.
revoke all on all tables in schema public from anon, authenticated;

-- profiles: readable when visible; a member edits their own, but never their role or WA verification.
grant select on public.profiles to authenticated;
grant insert (id, handle, display_name, avatar, pinned_badges, is_dashboard_public, wa_number, yoga_consent_version)
  on public.profiles to authenticated;
grant update (handle, display_name, avatar, pinned_badges, is_dashboard_public, wa_number, yoga_consent_version)
  on public.profiles to authenticated;
create policy profiles_read on public.profiles for select to authenticated using (public.can_see(id));
create policy profiles_insert_own on public.profiles for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- integrations: a member sees that they are connected, never the token reference.
grant select (user_id, provider, athlete_id, scopes, connected_at, revoked_at, last_synced_at, sync_error)
  on public.integrations to authenticated;
create policy integrations_read_own on public.integrations for select to authenticated using (user_id = auth.uid());

-- activities: start coordinates and the raw payload stay on the server.
grant select (id, user_id, provider_activity_id, source, device_name, type, start_time, distance_m, moving_time_s,
              elev_gain_m, avg_pace_s_per_km, max_speed_kmh, is_higround_start, counted, flagged, flag_reason,
              review_status, created_at)
  on public.activities to authenticated;
create policy activities_read on public.activities for select to authenticated using (public.can_see(user_id));

grant select on public.xp_ledger to authenticated;
create policy xp_ledger_read on public.xp_ledger for select to authenticated using (public.can_see(user_id));

grant select on public.badges, public.cosmetics to authenticated;
create policy badges_read on public.badges for select to authenticated using (true);
create policy cosmetics_read on public.cosmetics for select to authenticated using (true);

grant select on public.user_badges, public.user_cosmetics to authenticated;
create policy user_badges_read on public.user_badges for select to authenticated using (public.can_see(user_id));
create policy user_cosmetics_read on public.user_cosmetics for select to authenticated using (public.can_see(user_id));

-- yoga: a member starts their own timer; the server checks the claim and writes the attempt.
grant select, insert (mission_key, side, form_cues_ack) on public.yoga_timers to authenticated;
create policy yoga_timers_own_read on public.yoga_timers for select to authenticated using (user_id = auth.uid());
create policy yoga_timers_own_insert on public.yoga_timers for insert to authenticated with check (user_id = auth.uid());

grant select on public.yoga_attempts to authenticated;
create policy yoga_attempts_read on public.yoga_attempts for select to authenticated
  using (public.can_see(user_id) or public.is_staff());

-- events: everyone signed in reads them; admins manage them; check-ins come from the server.
grant select, insert, update, delete on public.events to authenticated;
create policy events_read on public.events for select to authenticated using (true);
create policy events_admin_insert on public.events for insert to authenticated with check (public.is_admin());
create policy events_admin_update on public.events for update to authenticated using (public.is_admin());
create policy events_admin_delete on public.events for delete to authenticated using (public.is_admin());

grant select on public.event_checkins to authenticated;
create policy event_checkins_read on public.event_checkins for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

grant select on public.yoga_progress, public.v_user_level to authenticated;
