-- ===========================================================================
-- Do You Know Them - party trivia database setup
--
-- HOW TO USE THIS FILE
--   1. Open your Supabase project in the browser
--   2. Click "SQL Editor" in the left sidebar
--   3. Click "New query"
--   4. Paste this entire file in
--   5. Click "Run"
--
-- It is safe to run more than once. Every statement checks first, so if
-- something goes wrong halfway you can just run the whole thing again.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. THE TABLES
-- ---------------------------------------------------------------------------

-- One row per game. There will only ever be one that matters.
create table if not exists games (
  id                    uuid primary key default gen_random_uuid(),
  room_code             text unique not null,
  host_key              uuid not null default gen_random_uuid(),
  status                text not null default 'setup',
  current_question_id   uuid,
  winner_answer_id      uuid,
  show_names            boolean not null default false,
  loser_support_enabled boolean not null default false,
  created_at            timestamptz not null default now(),

  -- Who this game is about. Everything that used to be hard-coded about one
  -- particular person lives here instead, typed in by the host at setup.
  -- Defaults keep an un-configured game playable.
  subject_name          text not null default 'the guest of honour',
  subject_pronouns      text not null default 'they'   -- 'she' | 'he' | 'they'
);

-- A category is one round type, e.g. "Fibbage Flip". It holds several
-- questions and has its own internal leaderboard.
create table if not exists categories (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  type        text not null,
  order_index int  not null default 0,
  included    boolean not null default true
);

create table if not exists questions (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  type        text not null,
  order_index int  not null default 0,
  text        text not null,
  points      int  not null default 1,

  -- Only some round types use these.
  true_number int,      -- Closest Guess: the host's own live answer
  true_answer text,     -- Fibbage Flip: the real answer, shuffled in with lies
  true_order  jsonb,    -- The ranking round: the host's own ordering
  items       jsonb,    -- The ranking round: the things being ranked
  topic       text      -- The Auction: shown while bidding, question is hidden
);

create table if not exists players (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  display_name text not null,
  score        int  not null default 0,
  base_score   int  not null default 0,
  joined_at    timestamptz not null default now(),

  -- Someone who leaves is switched off rather than deleted, so their answers
  -- stay put and the maths behind them never changes. They just stop counting.
  active       boolean not null default true,

  -- Two people called "Dev" would make judging impossible.
  unique (game_id, display_name)
);

-- Added after the first version of this file, so existing projects get it too.
alter table players add column if not exists active boolean not null default true;

create table if not exists answers (
  id             uuid primary key default gen_random_uuid(),
  game_id        uuid not null references games(id) on delete cascade,
  question_id    uuid not null references questions(id) on delete cascade,
  player_id      uuid not null references players(id) on delete cascade,

  text           text,
  number         int,      -- Closest Guess
  answer_order   jsonb,    -- Rank Her Favourites ("order" is a reserved word)
  wager          int,      -- Wager Final
  bid            int,      -- The Auction

  submitted      boolean not null default false,
  points_awarded int,      -- NULL means "not judged yet". 0 is a real verdict.
  submitted_at   timestamptz not null default now(),

  -- One answer per player per question.
  unique (question_id, player_id)
);

-- Fibbage Flip only: who guessed which option was the real answer.
create table if not exists votes (
  id          uuid primary key default gen_random_uuid(),
  game_id     uuid not null references games(id) on delete cascade,
  question_id uuid not null references questions(id) on delete cascade,
  player_id   uuid not null references players(id) on delete cascade,

  -- Either an answers.id, or the literal text 'truth' for the real answer.
  choice_id   text not null,

  unique (question_id, player_id)
);


-- Which power-up tier this game is playing: off / basic / advanced / mayhem.
alter table games add column if not exists power_up_tier text not null default 'off';

-- A per-question timer, added for the pulp-noir redesign's timed rounds. NULL
-- means no timer is running. Set to a future timestamp when the host starts
-- one; every client counts down from THIS timestamp rather than locally, so
-- phones in the same room cannot drift apart on how much time is left.
alter table games add column if not exists timer_ends_at timestamptz;

-- The occasion label and date, added in Phase 2, removed the same day: the
-- app stays general rather than naming what the party is for, so nothing
-- ever wrote real data into these on a live game.
alter table games drop column if exists occasion_label;
alter table games drop column if exists occasion_date;

-- A card in somebody's hand, or one they have already spent.
--
-- Cards are dealt at the start of a category and expire when it ends, so
-- `category_id` is what scopes a hand. Spent cards keep their row so the
-- reveal screen can show what was played and why the maths came out as it did.
create table if not exists power_ups (
  id           uuid primary key default gen_random_uuid(),
  game_id      uuid not null references games(id) on delete cascade,
  player_id    uuid not null references players(id) on delete cascade,
  category_id  uuid references categories(id) on delete cascade,

  -- 'power' = the Power-Up Quiz deck, 'loser' = the loser-support deck.
  deck         text not null default 'power',
  card_key     text not null,

  -- Filled in when the card is actually played.
  played_on_question_id uuid references questions(id) on delete set null,
  target_player_id      uuid references players(id) on delete set null,
  used                  boolean not null default false,

  -- Only set on payout cards (Wildcard, Bonus Question, Vote of Confidence) -
  -- what the host actually awarded, once they have decided. Added after the
  -- second audit removed the free-form score fixer these cards used to rely
  -- on; see CardPayouts.jsx.
  award_points integer,

  -- WHEN THE CARD WAS ACTUALLY PLAYED, not dealt. Cards dealt for a Power-Up
  -- Quiz round go in via one batch insert, and a single Postgres statement
  -- sees the same `now()` for every row in it - so `created_at` cannot tell
  -- two cards from the same deal apart, and the app's per-question scoring
  -- used to fall back to comparing the rows' random ids, which meant that
  -- whenever two played cards clashed on the same target in the same
  -- question (two Steals on one victim, two Swaps sharing a player), which
  -- one "won" was decided by an arbitrary string comparison invisible to
  -- everyone at the table - not by who actually tapped Play first. Set once,
  -- at play time, so resolution order can follow real play order instead.
  played_at    timestamptz,

  created_at   timestamptz not null default now()
);

alter table power_ups add column if not exists award_points integer;
alter table power_ups add column if not exists played_at timestamptz;

-- ---------------------------------------------------------------------------
-- 2. INDEXES
-- Small tables, but these keep the realtime lookups snappy.
-- ---------------------------------------------------------------------------

create index if not exists idx_categories_game on categories(game_id);
create index if not exists idx_questions_game  on questions(game_id);
create index if not exists idx_questions_cat   on questions(category_id);
create index if not exists idx_players_game    on players(game_id);
create index if not exists idx_answers_game    on answers(game_id);
create index if not exists idx_answers_q       on answers(question_id);
create index if not exists idx_votes_game      on votes(game_id);
create index if not exists idx_votes_q         on votes(question_id);
create index if not exists idx_powerups_game   on power_ups(game_id);
create index if not exists idx_powerups_player on power_ups(player_id);


-- ---------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY
--
-- THIS SECTION USED TO SAY "for all using (true) with check (true)" ON EVERY
-- TABLE - wide open, no login, anyone with the public key could read or write
-- anything. That was written for a one-night throwaway project ("DELETE THIS
-- PROJECT AFTER THE PARTY") and was never revisited once the app became
-- something hosts keep reusing indefinitely. An outside audit on 4 September
-- found it live and verified it: a single request with no game code returned
-- every game's host key, and a second request rewrote and deleted a row with
-- no permission asked at any step.
--
-- The actual fix lives in `supabase-rls-hardening.sql`, run once against the
-- live project on 5 September. RUN THAT FILE, NOT THE POLICIES THAT USED TO
-- BE HERE - re-running the old three-line "for all using (true)" version
-- would silently undo the fix. What is below is what that file leaves in
-- place: reading the ordinary, non-secret game state is still open to anyone
-- who already holds a game's id (the same trust level this app has always
-- used - "anyone with the room code can join"), and the host's key plus the
-- live answer key live in two separate tables the public key cannot read at
-- all. Every write goes through a guarded function in that file instead of
-- a raw insert/update/delete.
-- ---------------------------------------------------------------------------

alter table games      enable row level security;
alter table categories enable row level security;
alter table questions  enable row level security;
alter table players    enable row level security;
alter table answers    enable row level security;
alter table votes      enable row level security;
alter table power_ups  enable row level security;

drop policy if exists "party access" on games;
drop policy if exists "party access" on categories;
drop policy if exists "party access" on questions;
drop policy if exists "party access" on players;
drop policy if exists "party access" on answers;
drop policy if exists "party access" on votes;
drop policy if exists "party access" on power_ups;
drop policy if exists "read only, direct" on games;
drop policy if exists "read only, direct" on categories;
drop policy if exists "read only, direct" on questions;
drop policy if exists "read only, direct" on players;
drop policy if exists "read only, direct" on answers;
drop policy if exists "read only, direct" on votes;
drop policy if exists "read only, direct" on power_ups;

create policy "read only, direct" on games      for select using (true);
create policy "read only, direct" on categories for select using (true);
create policy "read only, direct" on questions  for select using (true);
create policy "read only, direct" on players    for select using (true);
create policy "read only, direct" on answers    for select using (true);
create policy "read only, direct" on votes      for select using (true);
create policy "read only, direct" on power_ups  for select using (true);

-- Direct insert/update/delete is revoked outright below - a fresh project
-- following this file alone starts secured, rather than open until someone
-- remembers to run the hardening file as a second step.
revoke insert, update, delete on games, categories, questions, players, answers, votes, power_ups
  from anon, authenticated;

-- Now run `supabase-rls-hardening.sql` to create the two secret tables
-- (`game_secrets`, `question_secrets`) and every guarded function the app
-- actually calls - without it, nothing can be created, joined, or played,
-- because there is no longer any direct way to write to these tables at all.


-- ---------------------------------------------------------------------------
-- 4. REALTIME
-- This is what makes everyone's screen change at the same moment without
-- anyone refreshing. Every table needs it.
-- ---------------------------------------------------------------------------

do $$
begin
  begin execute 'alter publication supabase_realtime add table games';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table categories'; exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table questions';  exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table players';    exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table answers';    exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table votes';      exception when duplicate_object then null; end;
  begin execute 'alter publication supabase_realtime add table power_ups';  exception when duplicate_object then null; end;
end $$;

-- Realtime needs the full old row on updates so clients can tell what changed.
alter table games      replica identity full;
alter table categories replica identity full;
alter table questions  replica identity full;
alter table players    replica identity full;
alter table answers    replica identity full;
alter table votes      replica identity full;
alter table power_ups  replica identity full;


-- ---------------------------------------------------------------------------
-- Done. You should see "Success. No rows returned" - that is what we want.
-- ---------------------------------------------------------------------------
