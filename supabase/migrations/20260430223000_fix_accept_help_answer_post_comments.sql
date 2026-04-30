-- LiveJourney: fix Q&A accept_help_answer to work with post_comments
-- Problem:
-- - accept_help_answer() was implemented against public.comments, but the app stores Q&A answers in public.post_comments.
-- - This caused RPC /rest/v1/rpc/accept_help_answer to return HTTP 400 (comment not found / FK violations).

do $$
declare
  fk_name text;
begin
  -- Ensure dependencies exist; if not, skip safely.
  if to_regclass('public.posts') is null then
    raise notice 'public.posts not found; skipping accept_help_answer fix.';
    return;
  end if;
  if to_regclass('public.post_comments') is null then
    raise notice 'public.post_comments not found; skipping accept_help_answer fix.';
    return;
  end if;
  if to_regclass('public.help_answer_accepts') is null then
    raise notice 'public.help_answer_accepts not found; skipping accept_help_answer fix.';
    return;
  end if;

  -- 1) Fix FK: help_answer_accepts.comment_id should reference post_comments(id)
  -- Drop any existing FK on comment_id (name differs per environment).
  begin
    fk_name := null;
    select con.conname into fk_name
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'help_answer_accepts'
      and con.contype = 'f'
      and (
        -- constraint includes column 'comment_id'
        exists (
          select 1
          from unnest(con.conkey) with ordinality as k(attnum, ord)
          join pg_attribute a on a.attrelid = rel.oid and a.attnum = k.attnum
          where a.attname = 'comment_id'
        )
      )
    limit 1;

    if fk_name is not null then
      execute format('alter table public.help_answer_accepts drop constraint if exists %I', fk_name);
    end if;
  exception when others then
    -- best-effort; continue
    null;
  end;

  begin
    alter table public.help_answer_accepts
      add constraint help_answer_accepts_comment_id_fkey
      foreign key (comment_id) references public.post_comments(id) on delete cascade;
  exception when duplicate_object then
    -- already in desired state
    null;
  end;
end $$;

-- 2) Update accept_help_answer() to validate against post_comments
create or replace function public.accept_help_answer(post uuid, comment uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  post_owner uuid;
  post_category text;
  answer_user uuid;
  cooldown int := 0;
  recharge int := 0;
  existing_comment uuid;
begin
  if uid is null then
    raise exception 'auth required';
  end if;

  select p.user_id, p.category into post_owner, post_category
  from public.posts p
  where p.id = post;

  if post_owner is null then
    raise exception 'post not found';
  end if;
  if post_owner <> uid then
    raise exception 'only post owner can accept';
  end if;
  if coalesce(post_category,'') <> 'question' then
    raise exception 'not a question post';
  end if;

  -- already accepted?
  select h.comment_id into existing_comment
  from public.help_answer_accepts h
  where h.post_id = post;

  if existing_comment is not null then
    return jsonb_build_object('success', true, 'alreadyAccepted', true, 'commentId', existing_comment);
  end if;

  -- find answer author from post_comments
  select c.user_id into answer_user
  from public.post_comments c
  where c.id = comment and c.post_id = post;

  if answer_user is null then
    raise exception 'comment not found';
  end if;

  insert into public.help_answer_accepts(post_id, comment_id, accepted_by, accepted_user_id)
  values (post, comment, uid, answer_user);

  -- ticket/grant logic (same as before)
  insert into public.raffle_user_state(user_id)
  values (answer_user)
  on conflict (user_id) do nothing;

  insert into public.raffle_activity_balances(user_id)
  values (answer_user)
  on conflict (user_id) do nothing;

  update public.raffle_activity_balances
    set balance = balance + 1
  where user_id = answer_user;

  select s.badge_cooldown_raffles_remaining, s.recharge_help_accepted_count
    into cooldown, recharge
  from public.raffle_user_state s
  where s.user_id = answer_user;

  if cooldown > 0 then
    recharge := recharge + 1;
    if recharge >= 5 then
      update public.raffle_user_state
        set badge_cooldown_raffles_remaining = 0,
            recharge_help_accepted_count = 0
      where user_id = answer_user;
    else
      update public.raffle_user_state
        set recharge_help_accepted_count = recharge
      where user_id = answer_user;
    end if;
  end if;

  return jsonb_build_object(
    'success', true,
    'acceptedUserId', answer_user,
    'commentId', comment,
    'activityTicketGranted', 1,
    'cooldownRafflesRemaining', cooldown,
    'rechargeHelpAcceptedCount', case when cooldown > 0 then least(recharge, 5) else 0 end
  );
end;
$$;

grant execute on function public.accept_help_answer(uuid, uuid) to authenticated;
revoke execute on function public.accept_help_answer(uuid, uuid) from anon;
revoke execute on function public.accept_help_answer(uuid, uuid) from public;

