alter table public.counter_shares
  add column response_reason text;

alter table public.counter_shares
  add constraint counter_shares_response_reason check (
    response_reason is null
    or response_reason in ('declined', 'sharing_disabled')
  );

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
