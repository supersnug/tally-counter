-- This file is part of Tally.
--
-- Copyright (C) 2026 Tally contributors
--
-- Tally is free software: you can redistribute it and/or modify
-- it under the terms of the GNU Affero General Public License as
-- published by the Free Software Foundation, version 3 of the
-- License.
--
-- Tally is distributed in the hope that it will be useful,
-- but WITHOUT ANY WARRANTY; without even the implied warranty of
-- MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
-- GNU Affero General Public License for more details.
--
-- You should have received a copy of the GNU Affero General Public License
-- along with Tally. If not, see <https://www.gnu.org/licenses/>.

alter table public.counter_shares
  add column if not exists response_reason text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'counter_shares_response_reason'
      and conrelid = 'public.counter_shares'::regclass
  ) then
    alter table public.counter_shares add constraint counter_shares_response_reason check (
      response_reason is null or response_reason in ('declined', 'sharing_disabled')
    );
  end if;
end;
$$;

alter policy "Recipients can answer counter shares"
on public.counter_shares
using (
  (select auth.uid()) = recipient_id
  and accepted is null
)
with check (
  (select auth.uid()) = recipient_id
  and accepted is not null
  and (
    (accepted = true and response_reason is null)
    or (accepted = false and response_reason = 'declined')
  )
);

grant update (response_reason) on public.counter_shares to authenticated;

create or replace function public.update_copy_sharing_settings(
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
    set accepted = false, response_reason = 'sharing_disabled'
    where recipient_id = current_user_id and accepted is null;
  end if;
end;
$$;
