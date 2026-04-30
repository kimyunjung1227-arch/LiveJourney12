-- LiveJourney: make accept_help_answer RPC never raise (avoid HTTP 400)
-- Supabase PostgREST returns HTTP 400 when a function raises an exception.
-- We return { success: false, error, code } instead so the client can show the reason.

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
  -- auth
  if uid is null then
    return jsonb_build_object('success', false, 'error', 'auth required', 'code', 'AUTH_REQUIRED');
  end if;

  -- post must exist and be a question
  select p.user_id, p.category into post_owner, post_category
  from public.posts p
  where p.id = post;

  if post_owner is null then
    return jsonb_build_object('success', false, 'error', 'post not found', 'code', 'POST_NOT_FOUND');
  end if;
  if coalesce(post_category, '') <> 'question' then
    return jsonb_build_object('success', false, 'error', 'not a question post', 'code', 'NOT_QUESTION');
  end if;
  if post_owner <> uid then
    return jsonb_build_object('success', false, 'error', 'only post owner can accept', 'code', 'NOT_OWNER');
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
    return jsonb_build_object('success', false, 'error', 'comment not found', 'code', 'COMMENT_NOT_FOUND');
  end if;

  -- persist accept
  insert into public.help_answer_accepts(post_id, comment_id, accepted_by, accepted_user_id)
  values (post, comment, uid, answer_user);

  -- ticket/grant logic
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
exception
  when unique_violation then
    -- help_answer_accepts_one_per_post 등 중복 채택 레이스: 이미 채택된 값 반환 시도
    select h.comment_id into existing_comment
    from public.help_answer_accepts h
    where h.post_id = post;
    return jsonb_build_object('success', true, 'alreadyAccepted', true, 'commentId', existing_comment);
  when others then
    return jsonb_build_object('success', false, 'error', sqlerrm, 'code', sqlstate);
end;
$$;

grant execute on function public.accept_help_answer(uuid, uuid) to authenticated;
revoke execute on function public.accept_help_answer(uuid, uuid) from anon;
revoke execute on function public.accept_help_answer(uuid, uuid) from public;

