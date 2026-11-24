-- Higround Run Club: what the app's server store needs on top of the initial schema.
--
-- The Next.js server talks to Postgres directly (DATABASE_URL, the `postgres` role, which bypasses RLS) and
-- enforces every game rule in lib/data/service.ts. RLS from the first migration still guards anything that
-- uses the anon key from a browser.

-- activities: the run's name and the provider's best efforts (for personal bests)
alter table public.activities add column if not exists name text;
alter table public.activities add column if not exists best_efforts jsonb;

-- yoga timers: the server sets started_at itself; only a signed-in client (JWT) gets it forced to now()
create or replace function public.yoga_timer_server_time() returns trigger
  language plpgsql as
$$ begin
     if auth.uid() is not null then
       new.started_at := now();
       new.claimed_at := null;
     end if;
     return new;
   end $$;

-- events: text ids (readable, template-made), and the template fields the app uses
alter table public.event_checkins drop constraint if exists event_checkins_event_id_fkey;
alter table public.events alter column id drop default;
alter table public.events alter column id type text using id::text;
alter table public.events alter column id set default gen_random_uuid()::text;
alter table public.event_checkins alter column event_id type text using event_id::text;
alter table public.event_checkins
  add constraint event_checkins_event_id_fkey foreign key (event_id) references public.events (id) on delete cascade;
alter table public.events add column if not exists template text not null default 'custom';
alter table public.events add column if not exists kind text not null default 'run'
  check (kind in ('run', 'virtual', 'brew', 'yoga'));
alter table public.events add column if not exists description text not null default '';
alter table public.events add column if not exists min_km double precision;
alter table public.events add column if not exists target_km double precision;
alter table public.events add column if not exists checkin text[] not null default '{qr}';
alter table public.events add column if not exists bonus_xp integer not null default 0;
alter table public.events add column if not exists badge_rarity text not null default 'common';

-- faster lookups the services do often
create index if not exists activities_provider_id on public.activities (provider_activity_id);
create index if not exists yoga_attempts_recent on public.yoga_attempts (created_at desc);
create index if not exists event_checkins_user on public.event_checkins (user_id);
