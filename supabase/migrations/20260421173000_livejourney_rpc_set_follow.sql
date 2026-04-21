-- LiveJourney: RPC for follow/unfollow (avoid REST 409 noise)
--
-- Why
-- - PostgREST insert/upsert can return 409 when row already exists.
-- - We want follow/unfollow to be idempotent and always return 200 to the client.
--
-- What
-- - public.set_follow(uuid, boolean): insert/delete in follows for current auth.uid()
-- - SECURITY DEFINER + row_security off to avoid policy-related flakiness (caller must be authenticated)

create or replace function public.set_follow(p_following_id uuid, p_follow boolean)
returns boolean
language plpgsql
security definer
set search_path to 'public'
set row_security to off
as $$
begin
  if auth.uid() is null then
    return false;
  end if;

  if p_follow then
    insert into public.follows (follower_id, following_id)
    values (auth.uid(), p_following_id)
    on conflict (follower_id, following_id) do nothing;
  else
    delete from public.follows
    where follower_id = auth.uid() and following_id = p_following_id;
  end if;

  return true;
end;
$$;

grant execute on function public.set_follow(uuid, boolean) to authenticated;

