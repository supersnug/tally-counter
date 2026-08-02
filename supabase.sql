create table if not exists public.user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  counters jsonb not null default '[]'::jsonb,
  preferences jsonb not null default '{}'::jsonb,
  tally_super jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_data enable row level security;

create policy "Users can read their own tally data"
on public.user_data for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can create their own tally data"
on public.user_data for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own tally data"
on public.user_data for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own tally data"
on public.user_data for delete
to authenticated
using ((select auth.uid()) = user_id);

create index if not exists user_data_user_id_idx on public.user_data(user_id);

grant select, insert, update, delete on public.user_data to authenticated;
