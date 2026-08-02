create or replace function public.send_counter_copy(
  recipient_identifier text,
  shared_counter jsonb,
  sharing_pin text default null
)
returns bigint
language plpgsql
security definer
set search_path = ''
as $$
declare
  sender uuid := (select auth.uid());
  recipient uuid;
  sender_profile public.profiles%rowtype;
  recipient_enabled boolean;
  secret_hash text;
  share_id bigint;
begin
  if sender is null then raise exception 'Authentication required'; end if;
  if jsonb_typeof(shared_counter) <> 'object'
     or octet_length(shared_counter::text) > 65536 then
    raise exception 'Invalid counter data';
  end if;

  select * into sender_profile from public.profiles where id = sender;
  if sender_profile.copy_sharing_pin_enabled then
    select pin_hash into secret_hash
    from private.copy_sharing_secrets where user_id = sender;
    if sharing_pin is null
       or secret_hash is null
       or extensions.crypt(sharing_pin, secret_hash) <> secret_hash then
      raise exception 'Incorrect sharing PIN';
    end if;
  end if;

  select id into recipient from public.profiles
  where username = lower(trim(recipient_identifier)) limit 1;
  if recipient is null and position('@' in recipient_identifier) > 1 then
    select id into recipient from auth.users
    where lower(email) = lower(trim(recipient_identifier)) limit 1;
  end if;
  if recipient is null then raise exception 'No Tally account matches that recipient'; end if;
  if recipient = sender then raise exception 'You cannot send a counter to yourself'; end if;

  select copy_sharing_enabled into recipient_enabled
  from public.profiles where id = recipient;
  if not coalesce(recipient_enabled, false) then
    raise exception 'That account is not accepting counter copies';
  end if;

  insert into public.counter_shares (
    sender_id, recipient_id, counter_data, sender_anonymous
  ) values (
    sender, recipient, shared_counter, sender_profile.anonymize_shares
  ) returning id into share_id;
  return share_id;
end;
$$;
