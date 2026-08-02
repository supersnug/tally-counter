alter table public.counter_shares
  add column counter_script jsonb,
  add column counter_customization jsonb;

alter table public.counter_shares
  add constraint counter_shares_script_object check (
    counter_script is null or (
      jsonb_typeof(counter_script) = 'object'
      and octet_length(counter_script::text) <= 65536
    )
  ),
  add constraint counter_shares_customization_object check (
    counter_customization is null or (
      jsonb_typeof(counter_customization) = 'object'
      and octet_length(counter_customization::text) <= 65536
    )
  );

create function public.send_counter_copy_with_data(
  recipient_identifier text,
  shared_counter jsonb,
  sharing_pin text default null,
  shared_script jsonb default null,
  shared_customization jsonb default null
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
  if shared_script is not null and (
    jsonb_typeof(shared_script) <> 'object'
    or octet_length(shared_script::text) > 65536
  ) then raise exception 'Invalid counter script'; end if;
  if shared_customization is not null and (
    jsonb_typeof(shared_customization) <> 'object'
    or octet_length(shared_customization::text) > 65536
  ) then raise exception 'Invalid counter customization'; end if;

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
    sender_id,
    recipient_id,
    counter_data,
    counter_script,
    counter_customization,
    sender_anonymous
  ) values (
    sender,
    recipient,
    shared_counter,
    shared_script,
    shared_customization,
    sender_profile.anonymize_shares
  ) returning id into share_id;
  return share_id;
end;
$$;

revoke execute on function public.send_counter_copy_with_data(text, jsonb, text, jsonb, jsonb)
from public, anon;
grant execute on function public.send_counter_copy_with_data(text, jsonb, text, jsonb, jsonb)
to authenticated;
