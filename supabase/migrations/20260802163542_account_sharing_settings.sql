alter table public.profiles
  add column if not exists anonymize_shares boolean not null default false,
  add column if not exists copy_sharing_enabled boolean not null default true,
  add column if not exists copy_sharing_pin_enabled boolean not null default false;

alter table public.counter_shares
  add column if not exists sender_anonymous boolean not null default false;

revoke insert on public.counter_shares from authenticated;

alter policy "Share participants can read profile names"
on public.profiles
using (
  exists (
    select 1
    from public.counter_shares
    where (
      sender_id = profiles.id
      and recipient_id = (select auth.uid())
      and not sender_anonymous
    ) or (
      recipient_id = profiles.id
      and sender_id = (select auth.uid())
    )
  )
);

create extension if not exists pgcrypto with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table private.copy_sharing_secrets (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pin_hash text not null
);
revoke all on private.copy_sharing_secrets from public, anon, authenticated;

create function public.update_copy_sharing_settings(
  anonymize boolean,
  sharing_enabled boolean,
  pin_enabled boolean,
  new_pin text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := (select auth.uid());
begin
  if current_user_id is null then
    raise exception 'Authentication required';
  end if;
  if pin_enabled then
    if new_pin is not null then
      if new_pin !~ '^[0-9]{6}$' then
        raise exception 'The sharing PIN must contain exactly 6 digits';
      end if;
      insert into private.copy_sharing_secrets (user_id, pin_hash)
      values (
        current_user_id,
        extensions.crypt(new_pin, extensions.gen_salt('bf'))
      )
      on conflict (user_id) do update set pin_hash = excluded.pin_hash;
    elsif not exists (
      select 1 from private.copy_sharing_secrets
      where user_id = current_user_id
    ) then
      raise exception 'Enter a 6-digit sharing PIN';
    end if;
  else
    delete from private.copy_sharing_secrets where user_id = current_user_id;
  end if;

  update public.profiles
  set anonymize_shares = anonymize,
      copy_sharing_enabled = sharing_enabled,
      copy_sharing_pin_enabled = pin_enabled
  where id = current_user_id;

  if not sharing_enabled then
    update public.counter_shares
    set accepted = false
    where recipient_id = current_user_id and accepted is null;
  end if;
end;
$$;

revoke execute on function public.update_copy_sharing_settings(boolean, boolean, boolean, text)
from public, anon;
grant execute on function public.update_copy_sharing_settings(boolean, boolean, boolean, text)
to authenticated;

create function public.send_counter_copy(
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
  if not sender_profile.copy_sharing_enabled then
    raise exception 'Copy sharing is disabled in Account Settings';
  end if;
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

revoke execute on function public.send_counter_copy(text, jsonb, text)
from public, anon;
grant execute on function public.send_counter_copy(text, jsonb, text)
to authenticated;
