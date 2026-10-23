-- ===========================================================================
-- Do You Know Them - locking the database's front door
--
-- WHY THIS FILE EXISTS
--   An outsider audit on 4 September found that the public key this app ships
--   to every browser could read and write EVERY row of EVERY table, for every
--   game that has ever been played - no login, no per-game boundary, nothing.
--   Verified live: a single request with no game code and no host link
--   returned every game's `host_key` (the secret that grants full control),
--   and a second request created, rewrote and deleted a row with no
--   permission asked at any step.
--
--   The cause: `supabase-schema.sql`'s policies say "for all using (true)
--   with check (true)" on every table - everyone can do everything - because
--   the app never had any concept of "who is asking" for Postgres to check
--   against. This file gives it one, without adding a login system: every
--   sensitive action now goes through a guarded function that checks the
--   host's secret key, or that a player id actually belongs to the game it
--   claims to, before touching anything. Nothing else about how the game is
--   played changes - same room codes, same host links, same no-account feel.
--
-- HOW TO USE THIS FILE
--   1. Open the Supabase project for THIS app (isjhfqoikfbumeyxxkeg / East US),
--      not any other project you may have.
--   2. Click "SQL Editor" in the left sidebar, then "New query".
--   3. Paste this entire file in and click "Run".
--   4. You should see "Success. No rows returned".
--
--   Safe to run more than once - every statement checks first.
--
-- WHAT STAYS THE SAME
--   Every table, every column the app still uses, and the realtime "everyone's
--   screen updates live" behaviour are all untouched. Reading the ordinary
--   game state (scores, questions on screen, who has answered) is still open
--   to anyone who already holds a game's id - exactly the trust level this
--   project has always used ("anyone with the room code can join"). What
--   changes is that the two things that were never meant to be public - the
--   host's key and the live answer key - can no longer be read directly, and
--   nothing can be written or deleted without proving the right key.
--
-- WHAT THIS DOES NOT DO (said plainly, not hidden)
--   This is still not a login system. Someone who already has a game's
--   internal id can still read that game's ordinary, non-secret data (scores,
--   question text, who's in the room) directly from the database, bypassing
--   the app - the same way "anyone with the room code" already could. Closing
--   that fully needs real accounts, which would change how the app feels to
--   use, and is a separate decision. This file closes the part that let a
--   stranger take over any game or read any hidden answer, which is the part
--   that can actually ruin someone's night or leak something private.
-- ===========================================================================


-- ---------------------------------------------------------------------------
-- 1. TWO NEW TABLES FOR THE THINGS THAT MUST NEVER BE HANDED OUT DIRECTLY
--
-- The secret and the answer key move OUT of `games` / `questions` entirely,
-- into tables the public key has zero access to - not even to read a single
-- column. The only way anything comes out of these two tables is through a
-- guarded function below that has already checked who is asking.
-- ---------------------------------------------------------------------------

create table if not exists game_secrets (
  game_id  uuid primary key references games(id) on delete cascade,
  host_key uuid not null default gen_random_uuid()
);

create table if not exists question_secrets (
  question_id uuid primary key references questions(id) on delete cascade,
  true_number int,
  true_answer text,
  true_order  jsonb
);

-- Carry over anything already in the live database before the old columns
-- are removed. Harmless to re-run - `on conflict do nothing` skips rows
-- already carried over.
insert into game_secrets (game_id, host_key)
select id, host_key from games
where host_key is not null
on conflict (game_id) do nothing;

insert into question_secrets (question_id, true_number, true_answer, true_order)
select id, true_number, true_answer, true_order from questions
where true_number is not null or true_answer is not null or true_order is not null
on conflict (question_id) do nothing;

alter table games drop column if exists host_key;
alter table questions drop column if exists true_number;
alter table questions drop column if exists true_answer;
alter table questions drop column if exists true_order;

alter table game_secrets enable row level security;
alter table question_secrets enable row level security;
-- Deliberately NO policies on either table. With row level security on and
-- no policy at all, ordinary roles (including the public key) get nothing,
-- full stop. Only the guarded functions below - which run with the elevated
-- privilege of whoever pastes this file in, not with the caller's privilege -
-- can reach these two tables.
revoke all on game_secrets from anon, authenticated;
revoke all on question_secrets from anon, authenticated;

-- Never added to the realtime publication. Nothing needs to watch these two
-- tables for changes - the app re-reads the answer key through
-- rpc_load_full_game every time it reloads, which already happens on every
-- realtime tick for the tables that DO matter.


-- ---------------------------------------------------------------------------
-- 2. LOCK THE FRONT DOOR: no more direct writes to any table
--
-- SELECT stays open on the seven original tables - this is what keeps
-- realtime working (every screen updating live, with nothing to configure)
-- and matches the trust level this app has always used for its ordinary,
-- non-secret data. INSERT / UPDATE / DELETE are revoked outright: from here
-- on, the only way to change anything is through a function below that has
-- checked the right key first.
-- ---------------------------------------------------------------------------

revoke insert, update, delete on games, categories, questions, players, answers, votes, power_ups
  from anon, authenticated;

-- The old wide-open policy is no longer doing anything useful now that writes
-- are revoked at the grant level, but it is replaced anyway so this file
-- reads honestly rather than leaving a policy around whose name says
-- "party access" and whose behaviour has quietly changed.
drop policy if exists "party access" on games;
drop policy if exists "party access" on categories;
drop policy if exists "party access" on questions;
drop policy if exists "party access" on players;
drop policy if exists "party access" on answers;
drop policy if exists "party access" on votes;
drop policy if exists "party access" on power_ups;

create policy "read only, direct" on games      for select using (true);
create policy "read only, direct" on categories for select using (true);
create policy "read only, direct" on questions  for select using (true);
create policy "read only, direct" on players    for select using (true);
create policy "read only, direct" on answers    for select using (true);
create policy "read only, direct" on votes      for select using (true);
create policy "read only, direct" on power_ups  for select using (true);


-- ---------------------------------------------------------------------------
-- 3. TWO CHECKS EVERY GUARDED FUNCTION BELOW IS BUILT ON
--
-- Both raise an error rather than returning false, so a failed check stops
-- the function immediately and the caller gets a clear "not authorized"
-- message instead of the write silently doing nothing.
--
-- `security definer` is what lets these functions do the writes at all: they
-- run with the privilege of whoever pasted this file in (the project owner),
-- not with the caller's own (now-revoked) privilege. `set search_path` on
-- every one of them is a standard safety rail for that - without it, a
-- function like this can be tricked by a same-named object placed earlier on
-- the search path. Every function in this file sets it explicitly.
-- ---------------------------------------------------------------------------

create or replace function assert_host(p_game_id uuid, p_host_key uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_host_key is null or not exists (
    select 1 from game_secrets where game_id = p_game_id and host_key = p_host_key
  ) then
    raise exception 'Not authorized: that is not the host key for this game.';
  end if;
end;
$$;

create or replace function assert_player_in_game(p_game_id uuid, p_player_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_player_id is null or not exists (
    select 1 from players where id = p_player_id and game_id = p_game_id
  ) then
    raise exception 'Not authorized: that player is not in this game.';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- 4. READING - no secret required, same trust level as today
--
-- Knowing a game's id (or room code, or host key) is what this app has always
-- treated as "being allowed in" - the schema's own original comment says so.
-- These three just make sure that door is the ONLY door: nobody can list
-- every game the way the audit did, because none of these functions can be
-- called without already holding a specific code or key.
-- ---------------------------------------------------------------------------

create or replace function rpc_find_game_by_room_code(p_room_code text)
returns games
language sql
security definer
set search_path = public, pg_temp
as $$
  select * from games where room_code = upper(trim(p_room_code));
$$;

create or replace function rpc_find_game_by_host_key(p_host_key uuid)
returns games
language sql
security definer
set search_path = public, pg_temp
as $$
  select g.* from games g
  join game_secrets s on s.game_id = g.id
  where s.host_key = p_host_key;
$$;

-- The whole game, shaped the way the app wants it. Pass p_host_key as null
-- for a player. Only when it matches this exact game does the answer key for
-- the CURRENT question come back - otherwise the same rule as before: a
-- player only ever sees a past or present answer once the game has actually
-- reached the reveal for it.
create or replace function rpc_load_full_game(p_game_id uuid, p_host_key uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game games;
  v_is_host boolean;
  v_revealed boolean;
begin
  select * into v_game from games where id = p_game_id;
  if not found then
    return null;
  end if;

  v_is_host := p_host_key is not null and exists (
    select 1 from game_secrets where game_id = p_game_id and host_key = p_host_key
  );
  v_revealed := v_game.status in ('reveal', 'category_results', 'finished');

  return jsonb_build_object(
    'game', to_jsonb(v_game),
    'is_host', v_is_host,
    'categories', (
      select coalesce(jsonb_agg(to_jsonb(c) order by c.order_index), '[]'::jsonb)
      from categories c where c.game_id = p_game_id
    ),
    'questions', (
      select coalesce(jsonb_agg(
        to_jsonb(q) || jsonb_build_object(
          'true_number', case when v_is_host or (v_revealed and q.id = v_game.current_question_id)
                               then qs.true_number else null end,
          'true_answer', case when v_is_host or (v_revealed and q.id = v_game.current_question_id)
                               then qs.true_answer else null end,
          'true_order',  case when v_is_host or (v_revealed and q.id = v_game.current_question_id)
                               then qs.true_order else null end
        )
        order by q.order_index
      ), '[]'::jsonb)
      from questions q left join question_secrets qs on qs.question_id = q.id
      where q.game_id = p_game_id
    ),
    'players', (
      select coalesce(jsonb_agg(to_jsonb(p) order by p.joined_at), '[]'::jsonb)
      from players p where p.game_id = p_game_id
    ),
    'answers', (
      select coalesce(jsonb_agg(to_jsonb(a) order by a.submitted_at, a.id), '[]'::jsonb)
      from answers a where a.game_id = p_game_id
    ),
    'votes', (
      select coalesce(jsonb_agg(to_jsonb(v) order by v.id), '[]'::jsonb)
      from votes v where v.game_id = p_game_id
    ),
    'power_ups', (
      select coalesce(jsonb_agg(to_jsonb(pu) order by pu.played_at nulls first, pu.created_at, pu.id), '[]'::jsonb)
      from power_ups pu where pu.game_id = p_game_id
    )
  );
end;
$$;


-- ---------------------------------------------------------------------------
-- 5. CREATING A GAME AND JOINING ONE - open to anyone, as today
--
-- Starting a brand new game, or joining one you already have the code for,
-- needs no proof of anything - that is the same "no login" front door this
-- app has always had. What is new: joining is now one atomic step, which
-- closes a small existing gap where two people submitting the identical name
-- at the exact same instant could both slip through before either row
-- existed for the other to collide with.
-- ---------------------------------------------------------------------------

create or replace function rpc_create_game(
  p_room_code text,
  p_category_rows jsonb,   -- [{type, order_index, included}, ...]
  p_question_rows jsonb    -- [{category_index, type, order_index, text, points, items, topic}, ...]
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_game games;
  v_host_key uuid;
  v_category_ids uuid[] := array[]::uuid[];
  v_cat jsonb;
  v_q jsonb;
  v_cat_id uuid;
begin
  insert into games (room_code, status) values (p_room_code, 'setup') returning * into v_game;
  insert into game_secrets (game_id) values (v_game.id) returning host_key into v_host_key;

  for v_cat in select * from jsonb_array_elements(p_category_rows) loop
    insert into categories (game_id, type, order_index, included)
    values (
      v_game.id,
      v_cat->>'type',
      (v_cat->>'order_index')::int,
      coalesce((v_cat->>'included')::boolean, true)
    )
    returning id into v_cat_id;
    v_category_ids := array_append(v_category_ids, v_cat_id);
  end loop;

  for v_q in select * from jsonb_array_elements(p_question_rows) loop
    insert into questions (game_id, category_id, type, order_index, text, points, items, topic)
    values (
      v_game.id,
      v_category_ids[((v_q->>'category_index')::int) + 1],
      v_q->>'type',
      (v_q->>'order_index')::int,
      v_q->>'text',
      coalesce((v_q->>'points')::int, 1),
      v_q->'items',
      v_q->>'topic'
    );
  end loop;

  return jsonb_build_object('game', to_jsonb(v_game), 'host_key', v_host_key);
end;
$$;

create or replace function rpc_join_game(p_game_id uuid, p_display_name text)
returns players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_status text;
  v_existing players;
  v_result players;
begin
  select status into v_status from games where id = p_game_id;
  if v_status is null then
    raise exception 'That game no longer exists.';
  end if;
  if v_status = 'finished' then
    raise exception 'That game has already finished. Ask the host for the code to a new one.';
  end if;

  select * into v_existing from players
  where game_id = p_game_id and lower(trim(display_name)) = lower(trim(p_display_name));

  if found then
    if v_existing.active = false then
      update players set active = true where id = v_existing.id returning * into v_result;
      return v_result;
    end if;
    raise exception 'Somebody already joined with that name. Try adding your last initial.';
  end if;

  insert into players (game_id, display_name) values (p_game_id, p_display_name)
  returning * into v_result;
  return v_result;
exception
  when unique_violation then
    raise exception 'Somebody already joined with that name. Try adding your last initial.';
end;
$$;

create or replace function rpc_leave_game(p_player_id uuid)
returns players
language sql
security definer
set search_path = public, pg_temp
as $$
  update players set active = false where id = p_player_id returning *;
$$;


-- ---------------------------------------------------------------------------
-- 6. PLAYER-OWNED WRITES - your own answer, your own vote, your own card
--
-- No host key here - only proof that the player id given actually belongs to
-- this game, which is a real check that did not exist before at all (today,
-- literally any id could be written against any game). This matches the
-- trust level the app already uses for players everywhere else.
-- ---------------------------------------------------------------------------

create or replace function rpc_save_answer(
  p_game_id uuid, p_question_id uuid, p_player_id uuid, p_fields jsonb
) returns answers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row answers;
begin
  perform assert_player_in_game(p_game_id, p_player_id);
  if not exists (select 1 from questions where id = p_question_id and game_id = p_game_id) then
    raise exception 'Not authorized: that question is not in this game.';
  end if;

  insert into answers (game_id, question_id, player_id, text, number, answer_order, wager, bid, submitted)
  values (
    p_game_id, p_question_id, p_player_id,
    p_fields->>'text',
    (p_fields->>'number')::int,
    p_fields->'answer_order',
    (p_fields->>'wager')::int,
    (p_fields->>'bid')::int,
    coalesce((p_fields->>'submitted')::boolean, false)
  )
  on conflict (question_id, player_id) do update set
    text = coalesce(excluded.text, answers.text),
    number = coalesce(excluded.number, answers.number),
    answer_order = coalesce(excluded.answer_order, answers.answer_order),
    wager = coalesce(excluded.wager, answers.wager),
    bid = coalesce(excluded.bid, answers.bid),
    submitted = case when p_fields ? 'submitted' then excluded.submitted else answers.submitted end
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_save_vote(
  p_game_id uuid, p_question_id uuid, p_player_id uuid, p_choice_id text
) returns votes
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row votes;
begin
  perform assert_player_in_game(p_game_id, p_player_id);
  if not exists (select 1 from questions where id = p_question_id and game_id = p_game_id) then
    raise exception 'Not authorized: that question is not in this game.';
  end if;

  insert into votes (game_id, question_id, player_id, choice_id)
  values (p_game_id, p_question_id, p_player_id, p_choice_id)
  on conflict (question_id, player_id) do update set choice_id = excluded.choice_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_play_power_up(
  p_game_id uuid, p_power_up_id uuid, p_player_id uuid, p_question_id uuid, p_target_player_id uuid
) returns power_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row power_ups;
begin
  perform assert_player_in_game(p_game_id, p_player_id);
  if not exists (
    select 1 from power_ups where id = p_power_up_id and game_id = p_game_id and player_id = p_player_id
  ) then
    raise exception 'Not authorized: that is not your card.';
  end if;

  update power_ups set
    used = true,
    played_on_question_id = p_question_id,
    target_player_id = p_target_player_id,
    played_at = now()
  where id = p_power_up_id
  returning * into v_row;
  return v_row;
end;
$$;


-- ---------------------------------------------------------------------------
-- 7. HOST-ONLY WRITES - every one of these needs the real host key
-- ---------------------------------------------------------------------------

create or replace function rpc_update_game(p_game_id uuid, p_host_key uuid, p_fields jsonb)
returns games
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row games;
begin
  perform assert_host(p_game_id, p_host_key);
  update games set
    status = coalesce(p_fields->>'status', status),
    current_question_id = case when p_fields ? 'current_question_id'
                                then nullif(p_fields->>'current_question_id','')::uuid
                                else current_question_id end,
    winner_answer_id = case when p_fields ? 'winner_answer_id'
                             then nullif(p_fields->>'winner_answer_id','')::uuid
                             else winner_answer_id end,
    show_names = coalesce((p_fields->>'show_names')::boolean, show_names),
    loser_support_enabled = coalesce((p_fields->>'loser_support_enabled')::boolean, loser_support_enabled),
    power_up_tier = coalesce(p_fields->>'power_up_tier', power_up_tier),
    subject_name = coalesce(p_fields->>'subject_name', subject_name),
    subject_pronouns = coalesce(p_fields->>'subject_pronouns', subject_pronouns),
    timer_ends_at = case when p_fields ? 'timer_ends_at'
                          then nullif(p_fields->>'timer_ends_at','')::timestamptz
                          else timer_ends_at end
  where id = p_game_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_delete_game(p_game_id uuid, p_host_key uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform assert_host(p_game_id, p_host_key);
  delete from games where id = p_game_id;
end;
$$;

create or replace function rpc_remove_player(p_game_id uuid, p_host_key uuid, p_player_id uuid)
returns players
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row players;
begin
  perform assert_host(p_game_id, p_host_key);
  update players set active = false where id = p_player_id and game_id = p_game_id
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_set_category_included(
  p_game_id uuid, p_host_key uuid, p_category_id uuid, p_included boolean
) returns categories
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row categories;
begin
  perform assert_host(p_game_id, p_host_key);
  update categories set included = p_included
  where id = p_category_id and game_id = p_game_id
  returning * into v_row;
  return v_row;
end;
$$;

-- Grows or shrinks a round's questions to exactly p_target. p_draw_pool is a
-- batch of freshly-drawn candidate rows from the app's own question bank -
-- the bank text itself lives in the app's code, not the database, so drawing
-- has to happen there; this function decides, INSIDE one transaction, how
-- many of those candidates are actually still needed and inserts only that
-- many - which is what makes this safe against two hosts (or one impatient
-- thumb) changing the same round's length at the same instant. Whichever
-- write reaches Postgres first sets the real count; the second reads that
-- fresh count in the same statement rather than a stale one from before
-- either write happened, so the two can never both insert a full batch on
-- top of an already-correct number.
create or replace function rpc_set_category_question_count(
  p_game_id uuid, p_host_key uuid, p_category_id uuid, p_target int, p_draw_pool jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_current int;
  v_needed int;
  v_q jsonb;
  v_next_order int;
begin
  perform assert_host(p_game_id, p_host_key);
  if not exists (select 1 from categories where id = p_category_id and game_id = p_game_id) then
    raise exception 'Not authorized: that round is not in this game.';
  end if;

  select count(*) into v_current from questions where category_id = p_category_id;

  if p_target < v_current then
    delete from questions where id in (
      select id from questions where category_id = p_category_id
      order by order_index desc limit (v_current - p_target)
    );
  elsif p_target > v_current then
    v_needed := p_target - v_current;
    select coalesce(max(order_index), -1) + 1 into v_next_order from questions where category_id = p_category_id;

    for v_q in select * from jsonb_array_elements(p_draw_pool) limit v_needed loop
      insert into questions (game_id, category_id, type, order_index, text, points, items, topic)
      values (
        p_game_id, p_category_id, v_q->>'type', v_next_order,
        v_q->>'text', coalesce((v_q->>'points')::int, 1), v_q->'items', v_q->>'topic'
      );
      v_next_order := v_next_order + 1;
    end loop;
  end if;

  return jsonb_build_object('current', v_current, 'target', p_target);
end;
$$;

create or replace function rpc_add_own_question(
  p_game_id uuid, p_host_key uuid, p_category_id uuid, p_input jsonb
) returns questions
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_row questions;
  v_type text;
  v_order int;
begin
  perform assert_host(p_game_id, p_host_key);
  select type into v_type from categories where id = p_category_id and game_id = p_game_id;
  if v_type is null then
    raise exception 'Not authorized: that round is not in this game.';
  end if;

  select coalesce(max(order_index), -1) + 1 into v_order from questions where category_id = p_category_id;

  insert into questions (game_id, category_id, type, order_index, text, points, items, topic)
  values (
    p_game_id, p_category_id, v_type, v_order,
    p_input->>'text', coalesce((p_input->>'points')::int, 1), p_input->'items', p_input->>'topic'
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_remove_question(p_game_id uuid, p_host_key uuid, p_question_id uuid)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform assert_host(p_game_id, p_host_key);
  delete from questions where id = p_question_id and game_id = p_game_id;
end;
$$;

-- Handles both the public columns (text, points, items, topic) and the secret
-- ones (true_number, true_answer, true_order - the last of which The Alibi
-- also uses to carry its published ballot's key) in one call, exactly as the
-- app's own `questionFieldsToRow` already mixes them in a single write today.
create or replace function rpc_set_question_fields(
  p_game_id uuid, p_host_key uuid, p_question_id uuid, p_fields jsonb
) returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_q questions; v_s question_secrets;
begin
  perform assert_host(p_game_id, p_host_key);
  if not exists (select 1 from questions where id = p_question_id and game_id = p_game_id) then
    raise exception 'Not authorized: that question is not in this game.';
  end if;

  update questions set
    text = coalesce(p_fields->>'text', text),
    points = coalesce((p_fields->>'points')::int, points),
    items = case when p_fields ? 'items' then p_fields->'items' else items end,
    topic = case when p_fields ? 'topic' then p_fields->>'topic' else topic end
  where id = p_question_id
  returning * into v_q;

  if (p_fields ? 'true_number') or (p_fields ? 'true_answer') or (p_fields ? 'true_order') then
    insert into question_secrets (question_id, true_number, true_answer, true_order)
    values (
      p_question_id,
      (p_fields->>'true_number')::int,
      p_fields->>'true_answer',
      p_fields->'true_order'
    )
    on conflict (question_id) do update set
      true_number = case when p_fields ? 'true_number' then excluded.true_number else question_secrets.true_number end,
      true_answer = case when p_fields ? 'true_answer' then excluded.true_answer else question_secrets.true_answer end,
      true_order  = case when p_fields ? 'true_order'  then excluded.true_order  else question_secrets.true_order  end
    returning * into v_s;
  else
    select * into v_s from question_secrets where question_id = p_question_id;
  end if;

  return to_jsonb(v_q) || jsonb_build_object(
    'true_number', v_s.true_number, 'true_answer', v_s.true_answer, 'true_order', v_s.true_order
  );
end;
$$;

create or replace function rpc_set_answer_points(p_game_id uuid, p_host_key uuid, p_answer_id uuid, p_points int)
returns answers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row answers;
begin
  perform assert_host(p_game_id, p_host_key);
  update answers set points_awarded = p_points where id = p_answer_id and game_id = p_game_id
  returning * into v_row;
  return v_row;
end;
$$;

-- p_points is {"<answer id>": <points>, ...}.
create or replace function rpc_set_many_answer_points(p_game_id uuid, p_host_key uuid, p_points jsonb)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_key text;
begin
  perform assert_host(p_game_id, p_host_key);
  for v_key in select jsonb_object_keys(p_points) loop
    update answers set points_awarded = (p_points->>v_key)::int
    where id = v_key::uuid and game_id = p_game_id;
  end loop;
end;
$$;

create or replace function rpc_create_empty_answers(
  p_game_id uuid, p_host_key uuid, p_question_id uuid, p_player_ids uuid[]
) returns setof answers
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform assert_host(p_game_id, p_host_key);
  return query
    insert into answers (game_id, question_id, player_id, submitted)
    select p_game_id, p_question_id, unnest(p_player_ids), false
    on conflict (question_id, player_id) do nothing
    returning *;
end;
$$;

create or replace function rpc_deal_power_ups(
  p_game_id uuid, p_host_key uuid, p_category_id uuid, p_deck text, p_dealt jsonb
) returns setof power_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  perform assert_host(p_game_id, p_host_key);

  delete from power_ups
  where game_id = p_game_id and category_id = p_category_id and deck = p_deck and used = false;

  return query
    insert into power_ups (game_id, player_id, category_id, deck, card_key)
    select p_game_id, (card->>'playerId')::uuid, p_category_id, p_deck, card->>'key'
    from jsonb_array_elements(p_dealt) as card
    returning *;
end;
$$;

create or replace function rpc_grant_power_up(
  p_game_id uuid, p_host_key uuid, p_player_id uuid, p_category_id uuid, p_deck text, p_card_key text
) returns power_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row power_ups;
begin
  perform assert_host(p_game_id, p_host_key);
  insert into power_ups (game_id, player_id, category_id, deck, card_key)
  values (p_game_id, p_player_id, p_category_id, p_deck, p_card_key)
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function rpc_set_power_up_award(p_game_id uuid, p_host_key uuid, p_power_up_id uuid, p_points int)
returns power_ups
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare v_row power_ups;
begin
  perform assert_host(p_game_id, p_host_key);
  update power_ups set award_points = p_points where id = p_power_up_id and game_id = p_game_id
  returning * into v_row;
  return v_row;
end;
$$;


-- ---------------------------------------------------------------------------
-- 8. GRANTS - explicitly allow the public key to call these, and only these
-- ---------------------------------------------------------------------------

grant execute on function
  rpc_find_game_by_room_code(text),
  rpc_find_game_by_host_key(uuid),
  rpc_load_full_game(uuid, uuid),
  rpc_create_game(text, jsonb, jsonb),
  rpc_join_game(uuid, text),
  rpc_leave_game(uuid),
  rpc_save_answer(uuid, uuid, uuid, jsonb),
  rpc_save_vote(uuid, uuid, uuid, text),
  rpc_play_power_up(uuid, uuid, uuid, uuid, uuid),
  rpc_update_game(uuid, uuid, jsonb),
  rpc_delete_game(uuid, uuid),
  rpc_remove_player(uuid, uuid, uuid),
  rpc_set_category_included(uuid, uuid, uuid, boolean),
  rpc_set_category_question_count(uuid, uuid, uuid, int, jsonb),
  rpc_add_own_question(uuid, uuid, uuid, jsonb),
  rpc_remove_question(uuid, uuid, uuid),
  rpc_set_question_fields(uuid, uuid, uuid, jsonb),
  rpc_set_answer_points(uuid, uuid, uuid, int),
  rpc_set_many_answer_points(uuid, uuid, jsonb),
  rpc_create_empty_answers(uuid, uuid, uuid, uuid[]),
  rpc_deal_power_ups(uuid, uuid, uuid, text, jsonb),
  rpc_grant_power_up(uuid, uuid, uuid, uuid, text, text),
  rpc_set_power_up_award(uuid, uuid, uuid, int)
to anon, authenticated;

-- The two checks used internally by the functions above are deliberately NOT
-- granted here - nothing outside this file ever needs to call them directly.

-- ---------------------------------------------------------------------------
-- Done. You should see "Success. No rows returned".
--
-- After this runs, the OLD way of talking to the database (supabase-js's
-- .from('games').select()/.insert()/.update()/.delete(), used directly on a
-- table) will start failing for anon - that is the point. The app's own code
-- is being updated in the same change to call these functions instead
-- (supabase.rpc('rpc_...', {...})), so once both are in place together the
-- app keeps working exactly as before and the direct-table door is shut.
-- ---------------------------------------------------------------------------
