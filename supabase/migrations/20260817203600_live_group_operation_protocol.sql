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

-- TCD-013/TCD-014: the Live Groups database boundary.
-- Browser clients submit operation identities and typed proposals; this layer
-- resolves identity, permission, membership, versions, and activity atomically.

create table if not exists private.live_group_operation_results (
  actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  target_counter_id uuid references public.shared_counters(id) on delete cascade,
  command text not null,
  status text not null check (status in ('accepted','unchanged','reconciled')),
  result jsonb not null check (jsonb_typeof(result) = 'object'),
  created_at timestamptz not null default now(),
  request_fingerprint text,
  primary key (actor_id, operation_id)
);
alter table private.live_group_operation_results drop constraint if exists live_group_operation_results_status_check;
alter table private.live_group_operation_results add column if not exists request_fingerprint text;
alter table private.live_group_operation_results add constraint live_group_operation_results_status_check check (status in ('accepted','unchanged','reconciled'));
create index if not exists live_group_operation_group_created_idx
  on private.live_group_operation_results (group_id, created_at desc);
alter table private.live_group_operation_results
  drop constraint if exists live_group_operation_results_target_counter_id_fkey;
alter table private.live_group_operation_results
  add constraint live_group_operation_results_target_counter_id_fkey
  foreign key (target_counter_id) references public.shared_counters(id) on delete set null;
alter table private.live_group_operation_results alter column group_id drop not null;
alter table private.live_group_operation_results drop constraint if exists live_group_operation_results_group_id_fkey;
alter table private.live_group_operation_results add constraint live_group_operation_results_group_id_fkey
  foreign key (group_id) references public.counter_groups(id) on delete set null;
revoke all on private.live_group_operation_results from public, anon, authenticated;

create table if not exists public.live_group_activity_events (
  id bigint generated always as identity primary key,
  operation_actor_id uuid not null references auth.users(id) on delete cascade,
  operation_id uuid not null,
  group_id uuid not null references public.counter_groups(id) on delete cascade,
  actor_id uuid references public.profiles(id) on delete set null,
  target_counter_id uuid references public.shared_counters(id) on delete set null,
  command text not null,
  details jsonb not null default '{}'::jsonb check (jsonb_typeof(details) = 'object'),
  created_at timestamptz not null default now(),
  unique (operation_actor_id, operation_id)
);
create index if not exists live_group_activity_group_created_idx
  on public.live_group_activity_events (group_id, created_at desc);
alter table public.live_group_activity_events enable row level security;
create policy "Live group members can read activity" on public.live_group_activity_events
  for select to authenticated using ((select private.is_counter_group_member(group_id)));
revoke all on public.live_group_activity_events from public, anon, authenticated;
grant select on public.live_group_activity_events to authenticated;
alter table public.live_group_activity_events alter column group_id drop not null;
alter table public.live_group_activity_events drop constraint if exists live_group_activity_events_group_id_fkey;
alter table public.live_group_activity_events add constraint live_group_activity_events_group_id_fkey
  foreign key (group_id) references public.counter_groups(id) on delete set null;

do $$ begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='live_group_activity_events') then
    alter publication supabase_realtime add table public.live_group_activity_events;
  end if;
exception when undefined_object then null;
end $$;

do $$ declare table_name text; begin
  foreach table_name in array array['counter_groups','counter_group_members','counter_group_invites','shared_counters','counter_group_folders','live_group_activity_events','shared_counter_events'] loop
    if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename=table_name) then
      execute format('alter publication supabase_realtime add table public.%I',table_name);
    end if;
  end loop;
exception when undefined_object then null;
end $$;

-- The effective prior constraints predate the independent create_counter
-- permission. Keep the DB boundary's custom vocabulary closed and consistent.
alter table public.counter_group_members drop constraint if exists group_custom_permissions_allowed;
alter table public.counter_group_members add constraint group_custom_permissions_allowed check (
  custom_permissions is null or custom_permissions <@ array[
    'create_counter','add','subtract','reset','delete_counter','create_folder','delete_folder','settings_folder',
    'settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump',
    'settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color',
    'scripting_js','scripting_ts','superedit_embed','superedit_reset','superedit_settings','superedit_delete',
    'superedit_title','superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator',
    'superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting','superedit_max_setting',
    'superedit_color','superedit_goaldir'
  ]::text[]
);
alter table public.counter_group_invites drop constraint if exists group_invite_custom_permissions_allowed;
alter table public.counter_group_invites add constraint group_invite_custom_permissions_allowed check (
  custom_permissions is null or custom_permissions <@ array[
    'create_counter','add','subtract','reset','delete_counter','create_folder','delete_folder','settings_folder',
    'settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump',
    'settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color',
    'scripting_js','scripting_ts','superedit_embed','superedit_reset','superedit_settings','superedit_delete',
    'superedit_title','superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator',
    'superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting','superedit_max_setting',
    'superedit_color','superedit_goaldir'
  ]::text[]
);

create or replace function private.live_group_permission(
  target_group uuid, permission_key text
)
returns boolean language plpgsql stable security definer set search_path = '' as $$
declare m public.counter_group_members%rowtype;
begin
  select * into m from public.counter_group_members
    where group_id = target_group and user_id = (select auth.uid());
  if not found then return false; end if;
  if exists (select 1 from public.counter_groups where id = target_group and owner_id = (select auth.uid())) then return true; end if;
  if m.permission_preset = 'full_access' then return true; end if;
  if m.permission_preset = 'count_only' then return permission_key = any(array['add','subtract','reset']); end if;
  if m.permission_preset = 'settings_only' then return permission_key = any(array[
    'add','subtract','reset',
    'settings_name','settings_startvalue','settings_exactvalue','settings_posstep',
    'settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir',
    'settings_addgoal','settings_removegoal','settings_color']); end if;
  if m.permission_preset = 'scripting_only' then return permission_key = any(array['scripting_js','scripting_ts']); end if;
  if m.permission_preset = 'cosmetic_only' then return permission_key in ('settings_name','settings_color') or permission_key like 'superedit_%'; end if;
  return permission_key = any(coalesce(m.custom_permissions, array[]::text[]));
end; $$;

-- Shared-script runtime boundary: these wrappers retain the publication
-- migration's proposal validation, stopped-record normalization, membership
-- reauthorization, and actor/operation recovery instead of duplicating it.
create or replace function public.authorize_live_group_script_run(target_counter uuid, script_language text)
returns jsonb language sql security definer set search_path = '' as $$
  select public.authorize_shared_script_run(target_counter,script_language);
$$;

create or replace function public.perform_live_group_script_operation(
  target_counter uuid, script_language text, proposal jsonb, operation_id uuid, expected_version bigint default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
  if jsonb_typeof(proposal)<>'object' or proposal->>'operationId'<>operation_id::text or proposal->>'counterId'<>target_counter::text or proposal->>'authority' is distinct from 'group' then raise exception 'Script proposal identity is not bound to this operation'; end if;
  if proposal->>'language' is not null and proposal->>'language' is distinct from script_language then raise exception 'Script proposal language does not match authorization'; end if;
  select public.perform_shared_script_operation(target_counter,script_language,proposal,operation_id,expected_version) into result;
  return result;
end; $$;
revoke execute on function public.authorize_live_group_script_run(uuid,text) from public,anon;
grant execute on function public.authorize_live_group_script_run(uuid,text) to authenticated;
revoke execute on function public.perform_live_group_script_operation(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function public.perform_live_group_script_operation(uuid,text,jsonb,uuid,bigint) to authenticated;
revoke execute on function private.live_group_permission(uuid,text) from public, anon, authenticated;

create or replace function private.live_group_known_permission(permission_key text)
returns boolean language sql immutable security definer set search_path = '' as $$
  select permission_key = any(array[
    'create_group','invite','manage_members','transfer_ownership','delete_group','leave_group',
    'create_counter','delete_counter','move_counter','create_folder','delete_folder','settings_folder',
    'add','subtract','reset','settings_name','settings_startvalue','settings_exactvalue',
    'settings_posstep','settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir',
    'settings_addgoal','settings_removegoal','settings_color','scripting_js','scripting_ts',
    'superedit_embed','superedit_reset','superedit_settings','superedit_delete','superedit_title',
    'superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator',
    'superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting',
    'superedit_max_setting','superedit_color','superedit_goaldir',
    'counter_save','counter_add','counter_subtract','counter_reset','customization_save',
    'script_edit','script_publish','folder_move','counter_move'
  ]);
$$;

drop function if exists private.live_group_recover_operation(uuid,uuid,uuid,uuid,text);
create or replace function private.live_group_recover_operation(
  p_actor uuid, p_operation uuid, p_group uuid, p_target uuid, p_command text, p_fingerprint text default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior private.live_group_operation_results%rowtype;
begin
  select * into prior from private.live_group_operation_results where actor_id=p_actor and operation_id=p_operation for update;
  if not found then return null; end if;
  if (p_group is not null and coalesce(prior.group_id,(prior.result->>'groupId')::uuid) is distinct from p_group) or (p_target is not null and coalesce(prior.target_counter_id,(prior.result->>'counterId')::uuid,(prior.result->>'folderId')::uuid) is distinct from p_target) or prior.command is distinct from p_command or (p_fingerprint is not null and prior.request_fingerprint is not null and prior.request_fingerprint is distinct from p_fingerprint) then
    raise exception 'Operation identity was already used for another command or target';
  end if;
  return jsonb_set(prior.result,'{status}','"recovered"'::jsonb,true);
end; $$;
revoke execute on function private.live_group_recover_operation(uuid,uuid,uuid,uuid,text,text) from public,anon,authenticated;

create or replace function private.live_group_request_fingerprint(request jsonb)
returns text language sql immutable security definer set search_path = '' as $$
  select encode(extensions.digest(coalesce(request,'{}'::jsonb)::text,'sha256'),'hex');
$$;
revoke execute on function private.live_group_request_fingerprint(jsonb) from public,anon,authenticated;

create or replace function public.invite_live_group_member(
  target_group uuid, recipient_identifier text, member_preset text,
  member_permissions text[] default null, operation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); recipient uuid; invite public.counter_group_invites%rowtype; prior jsonb; fp text;
begin
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  if not exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Only the group owner can invite members'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'recipient',lower(trim(coalesce(recipient_identifier,''))),'preset',member_preset,'permissions',array(select distinct p from unnest(coalesce(member_permissions,array[]::text[])) p order by p)));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'invite',fp); if prior is not null then return prior; end if;
  if member_preset not in ('full_access','settings_only','scripting_only','cosmetic_only','count_only','custom') then raise exception 'Unknown permission preset'; end if;
  if member_preset='custom' and (member_permissions is null or exists(select 1 from unnest(member_permissions) p where p not in ('create_counter','add','subtract','reset','delete_counter','create_folder','delete_folder','settings_folder','settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color','scripting_js','scripting_ts','superedit_embed','superedit_reset','superedit_settings','superedit_delete','superedit_title','superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator','superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting','superedit_max_setting','superedit_color','superedit_goaldir'))) then raise exception 'Unknown custom permission'; end if;
  select id into recipient from public.profiles where username=lower(trim(recipient_identifier));
  if recipient is null and position('@' in recipient_identifier)>1 then select id into recipient from auth.users where lower(email)=lower(trim(recipient_identifier)); end if;
  if recipient is null or recipient=uid then raise exception 'Invalid recipient'; end if;
  if not coalesce((select receive_group_invites from public.profiles where id=recipient),false) then raise exception 'That account is not accepting group invites'; end if;
  if exists(select 1 from public.counter_group_members where group_id=target_group and user_id=recipient) then raise exception 'That account is already an active member'; end if;
  if exists(select 1 from public.counter_group_invites where group_id=target_group and recipient_id=recipient) then raise exception 'An invitation already exists for that account'; end if;
  insert into public.counter_group_invites(group_id,inviter_id,recipient_id,permission_preset,custom_permissions,status)
    values(target_group,uid,recipient,member_preset,case when member_preset='custom' then member_permissions end,'Pending')
    returning * into invite;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'inviteId',invite.id::text,'groupId',target_group,'recipientId',recipient,'memberPreset',member_preset,'memberPermissions',case when member_preset='custom' then member_permissions else null end);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'invite','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'invite',prior);
  return prior;
end; $$;

create or replace function public.respond_live_group_invite(invite_id bigint, accept_invite boolean, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); i public.counter_group_invites%rowtype; next_status text; prior jsonb; fp text;
begin
  select * into i from public.counter_group_invites where id=invite_id and recipient_id=uid for update;
  if not found then raise exception 'Group invitation not found'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('invite',invite_id,'accept',accept_invite));
  prior:=private.live_group_recover_operation(uid,operation_id,i.group_id,null,'respond_invite',fp); if prior is not null then return prior; end if;
  next_status:=case when accept_invite then 'Accepted' else 'Declined' end;
  if i.status='Pending' then
    if accept_invite then insert into public.counter_group_members(group_id,user_id,permission_preset,custom_permissions) values(i.group_id,uid,i.permission_preset,i.custom_permissions) on conflict(group_id,user_id) do update set permission_preset=excluded.permission_preset,custom_permissions=excluded.custom_permissions; end if;
    update public.counter_group_invites set status=next_status where id=invite_id;
  elsif i.status<>next_status then raise exception 'Invitation is already resolved with the opposite decision';
  else
    prior:=jsonb_build_object('status','unchanged','inviteId',invite_id::text,'groupId',i.group_id,'operationId',operation_id);
    insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,i.group_id,null,'respond_invite','unchanged',prior,fp);
    return prior;
  end if;
  prior:=jsonb_build_object('status',lower(next_status),'inviteId',invite_id::text,'groupId',i.group_id,'operationId',operation_id);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,i.group_id,null,'respond_invite','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,i.group_id,null,'respond_invite',prior);
  return prior;
end; $$;

create or replace function public.remove_live_group_member(target_group uuid, target_user uuid, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior jsonb; fp text;
begin
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  if target_user=(select auth.uid()) then raise exception 'Use leave_group or delete_group for owner membership'; end if;
  if not exists(select 1 from public.counter_groups where id=target_group and owner_id=(select auth.uid())) then raise exception 'Only the group owner can remove members'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'member',target_user));
  prior:=private.live_group_recover_operation((select auth.uid()),operation_id,target_group,null,'remove_member',fp); if prior is not null then return prior; end if;
  delete from public.counter_group_members where group_id=target_group and user_id=target_user;
  if not found then raise exception 'Active group membership required'; end if;
  prior:=jsonb_build_object('status','accepted','groupId',target_group,'userId',target_user,'operationId',operation_id);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values((select auth.uid()),operation_id,target_group,null,'remove_member','accepted',prior,fp);
  perform private.live_group_record_activity((select auth.uid()),operation_id,target_group,null,'remove_member',prior);
  return prior;
end; $$;
revoke execute on function private.live_group_known_permission(text) from public, anon, authenticated;

create or replace function private.live_group_record_activity(
  p_actor uuid, p_operation uuid, p_group uuid, p_counter uuid, p_command text, p_details jsonb
)
returns void language sql security definer set search_path = '' as $$
  insert into public.live_group_activity_events(operation_actor_id,operation_id,group_id,actor_id,target_counter_id,command,details)
  values (p_actor,p_operation,p_group,(select auth.uid()),p_counter,p_command,coalesce(p_details,'{}'::jsonb))
  on conflict (operation_actor_id,operation_id) do nothing;
$$;
revoke execute on function private.live_group_record_activity(uuid,uuid,uuid,uuid,text,jsonb) from public, anon, authenticated;

create or replace function public.create_live_group(group_name text, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); gid uuid; prior jsonb; fp text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  if group_name is null or char_length(trim(group_name)) not between 1 and 60 then raise exception 'Group name must be 1 to 60 characters'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('name',trim(group_name),'command','create_group'));
  prior:=private.live_group_recover_operation(uid,operation_id,null,null,'create_group',fp); if prior is not null then return prior; end if;
  insert into public.counter_groups(name,owner_id) values (trim(group_name),uid) returning id into gid;
  insert into public.counter_group_members(group_id,user_id,permission_preset) values(gid,uid,'full_access');
  prior:=jsonb_build_object('status','accepted','groupId',gid,'operationId',operation_id,'name',trim(group_name));
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,gid,null,'create_group','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,gid,null,'create_group',jsonb_build_object('groupId',gid));
  return prior;
end; $$;

create or replace function public.transfer_live_group_ownership(
  target_group uuid, new_owner uuid, former_owner_preset text default 'full_access', operation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); prior jsonb; fp text;
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'newOwner',new_owner,'formerPreset',former_owner_preset));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'transfer_ownership',fp); if prior is not null then return prior; end if;
  if uid is null then raise exception 'Authentication required'; end if;
  if not exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Only the current owner can transfer ownership'; end if;
  if new_owner=uid or not exists(select 1 from public.counter_group_members where group_id=target_group and user_id=new_owner) then raise exception 'The new owner must be another active member'; end if;
  if former_owner_preset not in ('full_access','settings_only','scripting_only','cosmetic_only','count_only','custom') then raise exception 'Invalid former-owner access'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  update public.counter_groups set owner_id=new_owner where id=target_group and owner_id=uid;
  if not found then raise exception 'Ownership changed; retry'; end if;
  update public.counter_group_members set permission_preset=former_owner_preset, custom_permissions=case when former_owner_preset='custom' then custom_permissions else null end where group_id=target_group and user_id=uid;
  prior:=jsonb_build_object('status','accepted','groupId',target_group,'newOwnerId',new_owner,'operationId',operation_id);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'transfer_ownership','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'transfer_ownership',prior);
  return prior;
end; $$;

create or replace function public.set_live_group_member_permissions(
  target_group uuid, target_user uuid, member_preset text,
  member_permissions text[] default null, operation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); prior jsonb; fp text;
begin
  if uid is null or not exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Only the group owner can change permissions'; end if;
  if target_user=uid then raise exception 'Owner permissions cannot be changed'; end if;
  if member_preset not in ('full_access','settings_only','scripting_only','cosmetic_only','count_only','custom') then raise exception 'Unknown permission preset'; end if;
  if member_preset='custom' and (member_permissions is null or exists(select 1 from unnest(member_permissions) p where p not in ('create_counter','add','subtract','reset','delete_counter','create_folder','delete_folder','settings_folder','settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color','scripting_js','scripting_ts','superedit_embed','superedit_reset','superedit_settings','superedit_delete','superedit_title','superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator','superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting','superedit_max_setting','superedit_color','superedit_goaldir'))) then raise exception 'Unknown custom permission'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'member',target_user,'preset',member_preset,'permissions',array(select distinct p from unnest(coalesce(member_permissions,array[]::text[])) p order by p)));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'set_permissions',fp); if prior is not null then return prior; end if;
  update public.counter_group_members set permission_preset=member_preset,custom_permissions=case when member_preset='custom' then member_permissions else null end where group_id=target_group and user_id=target_user;
  if not found then raise exception 'Active group membership required'; end if;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'groupId',target_group,'userId',target_user,'permissionPreset',member_preset,'customPermissions',case when member_preset='custom' then member_permissions else null end);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'set_permissions','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'set_permissions',prior);
  return prior;
end; $$;

create or replace function public.transfer_live_group_ownership_with_permissions(
  target_group uuid, new_owner uuid, former_owner_preset text,
  former_owner_permissions text[] default null, operation_id uuid default gen_random_uuid()
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); prior jsonb; fp text;
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'newOwner',new_owner,'formerPreset',former_owner_preset,'formerPermissions',array(select distinct p from unnest(coalesce(former_owner_permissions,array[]::text[])) p order by p)));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'transfer_ownership_with_permissions',fp); if prior is not null then return prior; end if;
  if uid is null or not exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Only the current owner can transfer ownership'; end if;
  if new_owner=uid or not exists(select 1 from public.counter_group_members where group_id=target_group and user_id=new_owner) then raise exception 'The new owner must be another active member'; end if;
  if former_owner_preset='custom' and (former_owner_permissions is null or exists(select 1 from unnest(former_owner_permissions) p where p not in ('create_counter','add','subtract','reset','delete_counter','create_folder','delete_folder','settings_folder','settings_name','settings_startvalue','settings_exactvalue','settings_posstep','settings_negstep','settings_jump','settings_min','settings_max','settings_goaldir','settings_addgoal','settings_removegoal','settings_color','scripting_js','scripting_ts','superedit_embed','superedit_reset','superedit_settings','superedit_delete','superedit_title','superedit_count','superedit_goal','superedit_add','superedit_sub','superedit_min_indicator','superedit_max_indicator','superedit_posstep','superedit_negstep','superedit_min_setting','superedit_max_setting','superedit_color','superedit_goaldir'))) then raise exception 'Unknown custom permission'; end if;
  if former_owner_preset not in ('full_access','settings_only','scripting_only','cosmetic_only','count_only','custom') then raise exception 'Invalid former-owner access'; end if;
  update public.counter_groups set owner_id=new_owner where id=target_group and owner_id=uid;
  if not found then raise exception 'Ownership changed; retry'; end if;
  update public.counter_group_members set permission_preset=former_owner_preset,custom_permissions=case when former_owner_preset='custom' then former_owner_permissions else null end where group_id=target_group and user_id=uid;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'groupId',target_group,'newOwnerId',new_owner,'formerOwnerPreset',former_owner_preset,'formerOwnerPermissions',case when former_owner_preset='custom' then former_owner_permissions else null end);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'transfer_ownership_with_permissions','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'transfer_ownership_with_permissions',prior);
  return prior;
end; $$;

create or replace function public.leave_live_group(target_group uuid, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); prior jsonb; fp text;
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'command','leave_group'));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'leave_group',fp); if prior is not null then return prior; end if;
  if exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Transfer ownership or delete the group before leaving'; end if;
  if not exists(select 1 from public.counter_group_members where group_id=target_group and user_id=uid) then raise exception 'Active group membership required'; end if;
  delete from public.counter_group_members where group_id=target_group and user_id=uid;
  prior:=jsonb_build_object('status','accepted','groupId',target_group,'operationId',operation_id);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'leave_group','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'leave_group',prior);
  return prior;
end; $$;

create or replace function public.delete_live_group(target_group uuid, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('targetGroup',target_group,'command','delete_group'));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'delete_group',fp); if prior is not null then return prior; end if;
  if not exists(select 1 from public.counter_groups where id=target_group and owner_id=uid) then raise exception 'Only the group owner can delete this group'; end if;
  prior:=jsonb_build_object('status','accepted','groupId',target_group,'operationId',operation_id);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'delete_group','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'delete_group',prior);
  delete from public.counter_groups where id=target_group;
  return prior;
end; $$;

create or replace function private.normalize_live_counter(candidate jsonb)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare v numeric; s numeric; ps numeric; ns numeric; lo numeric; hi numeric; swap_value numeric; goals jsonb; normalized_goals jsonb := '[]'::jsonb; goal_item jsonb;
begin
  if jsonb_typeof(candidate)<>'object' then raise exception 'Counter candidate must be an object'; end if;
  if candidate->>'value' is null or candidate->>'start' is null or candidate->>'value' !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' or candidate->>'start' !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception 'Counter values must be finite numbers'; end if;
  v:=(candidate->>'value')::numeric; s:=(candidate->>'start')::numeric;
  if candidate->>'plusStep' is null or candidate->>'minusStep' is null or candidate->>'plusStep' !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' or candidate->>'minusStep' !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception 'Step values must be finite numbers'; end if;
  ps:=abs((candidate->>'plusStep')::numeric);
  ns:=abs((candidate->>'minusStep')::numeric);
  if ps=0 then ps:=1; end if; if ns=0 then ns:=1; end if;
  if candidate ? 'min' and candidate->'min' <> 'null'::jsonb and (candidate->>'min') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception 'Minimum must be finite'; end if;
  if candidate ? 'max' and candidate->'max' <> 'null'::jsonb and (candidate->>'max') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception 'Maximum must be finite'; end if;
  lo:=case when candidate->>'min' is not null then (candidate->>'min')::numeric end;
  hi:=case when candidate->>'max' is not null then (candidate->>'max')::numeric end;
  if lo is not null and hi is not null and lo>hi then swap_value:=lo; lo:=hi; hi:=swap_value; end if;
  if lo is not null then v:=greatest(v,lo); s:=greatest(s,lo); end if;
  if hi is not null then v:=least(v,hi); s:=least(s,hi); end if;
  goals:=case when jsonb_typeof(candidate->'goals')='array' then candidate->'goals' else '[]'::jsonb end;
  if exists(select 1 from jsonb_array_elements(goals) goal_row where goal_row #>> '{}' !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$') then raise exception 'Goals must be finite numbers'; end if;
  for goal_item in select value from jsonb_array_elements(goals) loop
    if not exists(select 1 from jsonb_array_elements(normalized_goals) prior_goal where (prior_goal #>> '{}')::numeric=(goal_item #>> '{}')::numeric) then normalized_goals:=normalized_goals||jsonb_build_array((goal_item #>> '{}')::numeric); end if;
  end loop;
  if candidate ? 'goalDirection' and candidate->>'goalDirection' not in ('more','less') then raise exception 'Goal direction is invalid'; end if;
  if candidate ? 'color' and candidate->>'color' !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color must be a six-digit hex value'; end if;
  if candidate ? 'name' and nullif(trim(candidate->>'name'),'') is null then raise exception 'Name must be nonblank'; end if;
  return jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(jsonb_set(candidate,'{value}',to_jsonb(v),true),'{start}',to_jsonb(s),true),'{plusStep}',to_jsonb(ps),true),'{minusStep}',to_jsonb(ns),true),'{min}',case when lo is null then 'null'::jsonb else to_jsonb(lo) end,true),'{max}',case when hi is null then 'null'::jsonb else to_jsonb(hi) end,true),'{goals}',normalized_goals,true);
end; $$;
revoke execute on function private.normalize_live_counter(jsonb) from public,anon,authenticated;

create or replace function private.validate_live_customization(candidate jsonb)
returns boolean language plpgsql immutable security definer set search_path = '' as $$
declare part_key text;
begin
  if jsonb_typeof(candidate)<>'object' then raise exception 'Customization must be an object'; end if;
  if exists(select 1 from jsonb_object_keys(candidate) candidate_key where candidate_key not in ('parts','quickSettings')) then raise exception 'Unsupported customization key'; end if;
  if candidate ? 'parts' and jsonb_typeof(candidate->'parts')<>'object' then raise exception 'Customization parts must be an object'; end if;
  if candidate ? 'quickSettings' and jsonb_typeof(candidate->'quickSettings')<>'array' then raise exception 'Quick settings must be an array'; end if;
  if candidate ? 'parts' then
    for part_key in select jsonb_object_keys(candidate->'parts') loop
      if part_key not in ('embed','reset','settings','delete','title','count','goal','add','subtract','minimum-indicator','maximum-indicator','positiveStep','negativeStep','minimum','maximum','color','goalDirection') then raise exception 'Unsupported customization part'; end if;
    end loop;
  end if;
  return true;
end; $$;
revoke execute on function private.validate_live_customization(jsonb) from public,anon,authenticated;

drop function if exists private.authorize_live_customization(uuid,jsonb);
create or replace function private.authorize_live_customization(target_group uuid, candidate jsonb, base jsonb default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare key text; permission_key text;
begin
  perform private.validate_live_customization(candidate);
  if candidate ? 'quickSettings' and (base is null or base->'quickSettings' is distinct from candidate->'quickSettings') and not (select private.live_group_permission(target_group,'superedit_settings')) then raise exception 'You do not have permission for quick settings'; end if;
  if candidate ? 'parts' then
    for key in select jsonb_object_keys(candidate->'parts') loop
      if base is not null and base->'parts'->key is not distinct from candidate->'parts'->key then continue; end if;
      permission_key:=case key when 'embed' then 'superedit_embed' when 'reset' then 'superedit_reset' when 'settings' then 'superedit_settings' when 'delete' then 'superedit_delete' when 'title' then 'superedit_title' when 'count' then 'superedit_count' when 'goal' then 'superedit_goal' when 'add' then 'superedit_add' when 'subtract' then 'superedit_sub' when 'minimum-indicator' then 'superedit_min_indicator' when 'maximum-indicator' then 'superedit_max_indicator' when 'positiveStep' then 'superedit_posstep' when 'negativeStep' then 'superedit_negstep' when 'minimum' then 'superedit_min_setting' when 'maximum' then 'superedit_max_setting' when 'color' then 'superedit_color' when 'goalDirection' then 'superedit_goaldir' end;
      if not (select private.live_group_permission(target_group,permission_key)) then raise exception 'You do not have permission for every customization part'; end if;
    end loop;
  end if;
  return true;
end; $$;
revoke execute on function private.authorize_live_customization(uuid,jsonb,jsonb) from public,anon,authenticated;

-- Stable operation endpoint. changed_fields is a closed field vocabulary and
-- stale non-overlapping fields are reconciled onto the latest locked row.
drop function if exists public.perform_live_group_operation(uuid,uuid,text,uuid,bigint,text[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text);
drop function if exists public.perform_live_group_operation(uuid,uuid,text,uuid,bigint,text[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text[]);
drop function if exists public.perform_live_group_operation(uuid,uuid,text,uuid,bigint,uuid,uuid,text[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text[]);
create or replace function public.perform_live_group_operation(
  target_group uuid, target_counter uuid, command text, operation_id uuid,
  base_version bigint, base_folder_id uuid, proposed_folder_id uuid, changed_fields text[], base_counter jsonb, proposed_counter jsonb,
  base_customization jsonb, proposed_customization jsonb, base_script jsonb, proposed_script jsonb,
  action_permissions text[] default null
)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); c public.shared_counters%rowtype; r jsonb; candidate jsonb; key text; perm text; amount numeric; reconciled boolean := false; request_fingerprint text;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if operation_id is null then raise exception 'An operation identity is required'; end if;
  if action_permissions is not null then null; end if; -- compatibility input is intentionally ignored; permissions are derived below.
  request_fingerprint:=encode(extensions.digest(jsonb_build_object('targetCounter',target_counter,'command',command,'baseVersion',base_version,'baseFolderId',base_folder_id,'proposedFolderId',proposed_folder_id,'changedFields',changed_fields,'baseCounter',base_counter,'proposedCounter',proposed_counter,'baseCustomization',base_customization,'proposedCustomization',proposed_customization,'baseScript',base_script,'proposedScript',proposed_script)::text,'sha256'),'hex');
  if not exists(select 1 from public.counter_groups where id=target_group) then raise exception 'Group not found'; end if;
  if not exists(select 1 from public.counter_group_members where group_id=target_group and user_id=uid) then raise exception 'Active group membership required'; end if;
  if command not in ('add','subtract','reset','counter_save','customization_save','script_edit','script_publish','quick_setting.add','quick_setting.remove') then raise exception 'Unknown group command'; end if;
  if command='counter_save' then
    if changed_fields is null or cardinality(changed_fields)=0 then raise exception 'A counter save requires changed fields'; end if;
    foreach key in array changed_fields loop
      if key='folder_id' then
        perm:='settings_folder';
      elsif key='script' then
        perm:=case when proposed_script->>'language'='tallyscript' then 'scripting_ts' when proposed_script->>'language'='javascript' then 'scripting_js' else null end;
      elsif key='customization' then
        perform private.authorize_live_customization(target_group,proposed_customization,base_customization);
        perm:='superedit_settings';
      else
        perm:=case key when 'value' then 'settings_exactvalue' when 'start' then 'settings_startvalue' when 'plusStep' then 'settings_posstep' when 'minusStep' then 'settings_negstep' when 'min' then 'settings_min' when 'max' then 'settings_max' when 'goals' then 'settings_addgoal' when 'goalDirection' then 'settings_goaldir' when 'name' then 'settings_name' when 'color' then 'settings_color' else null end;
      end if;
      if perm is null then raise exception 'Counter save contains an unsupported field'; end if;
      if not (select private.live_group_known_permission(perm)) or not (select private.live_group_permission(target_group,perm)) then raise exception 'You do not have permission for every changed field'; end if;
      if key='goals' and not (select private.live_group_permission(target_group,'settings_removegoal')) then raise exception 'You do not have permission for every changed field'; end if;
    end loop;
  elsif command in ('customization_save','quick_setting.add','quick_setting.remove') then
    if cardinality(changed_fields)<>1 or changed_fields[1]<>'customization' then raise exception 'Customization save requires one projection'; end if;
    perform private.authorize_live_customization(target_group,proposed_customization,base_customization);
  elsif command in ('script_edit','script_publish') then
    if cardinality(changed_fields)<>1 or changed_fields[1]<>'script' then raise exception 'Script operation requires one script field'; end if;
    perm:=case when proposed_script->>'language'='tallyscript' then 'scripting_ts' when proposed_script->>'language'='javascript' then 'scripting_js' else null end;
    if perm is null or not (select private.live_group_permission(target_group,perm)) then raise exception 'You do not have permission for script language'; end if;
  else
    perm:=command;
    if not (select private.live_group_known_permission(perm)) or not (select private.live_group_permission(target_group,perm)) then raise exception 'You do not have permission for this operation'; end if;
  end if;
  r:=private.live_group_recover_operation(uid,operation_id,target_group,target_counter,command,request_fingerprint);
  if r is not null then return r; end if;
  if target_counter is null then raise exception 'A target counter is required'; end if;
  select * into c from public.shared_counters where id=target_counter and group_id=target_group for update;
  if not found then raise exception 'Shared counter not found in this group'; end if;
  if 'folder_id'=any(changed_fields) and proposed_folder_id is not null and not exists(select 1 from public.counter_group_folders where id=proposed_folder_id and group_id=target_group) then raise exception 'Folder not found in this group'; end if;
  if changed_fields is null or exists(select 1 from unnest(changed_fields) f where f not in ('add','subtract','reset','value','start','plusStep','minusStep','min','max','goals','goalDirection','name','color','folder_id','customization','script')) then raise exception 'Unknown changed field'; end if;
  candidate:=c.counter_data;
  if command='add' or command='subtract' then
    if proposed_counter ? 'amount' and (proposed_counter->>'amount') !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then raise exception 'Amount must be finite'; end if;
    amount:=case when proposed_counter ? 'amount' then (proposed_counter->>'amount')::numeric else case when command='add' then (c.counter_data->>'plusStep')::numeric else (c.counter_data->>'minusStep')::numeric end end;
    if amount<0 then amount:=abs(amount); end if;
    candidate:=jsonb_set(candidate,'{value}',to_jsonb((c.counter_data->>'value')::numeric + case when command='add' then amount else -amount end),true);
  elsif command='reset' then candidate:=jsonb_set(candidate,'{value}',candidate->'start',true);
  elsif 'value'=any(changed_fields) or 'start'=any(changed_fields) or 'plusStep'=any(changed_fields) or 'minusStep'=any(changed_fields) or 'min'=any(changed_fields) or 'max'=any(changed_fields) or 'goals'=any(changed_fields) or 'goalDirection'=any(changed_fields) or 'name'=any(changed_fields) or 'color'=any(changed_fields) then
     foreach key in array changed_fields loop if key not in ('customization','script','folder_id') then candidate:=jsonb_set(candidate,array[key],proposed_counter->key,true); end if; end loop;
  end if;
  candidate:=private.normalize_live_counter(candidate);
  if base_version is not null and c.version<>base_version then
    foreach key in array changed_fields loop
      if key='reset' and (c.counter_data->'value') is distinct from (base_counter->'value') then raise exception using errcode='40001',message='Overlapping counter change; reload and retry'; end if;
      if key='folder_id' and c.folder_id is distinct from base_folder_id then raise exception using errcode='40001',message='Overlapping folder change; reload and retry'; end if;
      if key not in ('add','subtract','reset','customization','script') and (c.counter_data->key) is distinct from (base_counter->key) then raise exception using errcode='40001',message='Overlapping counter change; reload and retry'; end if;
      if key='customization' and c.customization is distinct from base_customization then raise exception using errcode='40001',message='Overlapping customization change; reload and retry'; end if;
      if key='script' and c.script is distinct from base_script then raise exception using errcode='40001',message='Overlapping script change; reload and retry'; end if;
    end loop;
    reconciled:=true;
  end if;
  if 'script'=any(changed_fields) and (proposed_script is null or jsonb_typeof(proposed_script)<>'object' or proposed_script->>'language' not in ('tallyscript','javascript') or proposed_script->>'source' is null) then raise exception 'Invalid recorded script'; end if;
  if command in ('customization_save','quick_setting.add','quick_setting.remove') and proposed_customization is not null and jsonb_typeof(proposed_customization)<>'object' then raise exception 'Invalid customization'; end if;
  if command in ('script_edit','script_publish') then candidate:=c.counter_data; end if;
  if candidate is not distinct from c.counter_data and (('folder_id'=any(changed_fields) and proposed_folder_id is not distinct from c.folder_id) or not ('folder_id'=any(changed_fields))) and (('customization'=any(changed_fields) and proposed_customization is not distinct from c.customization) or not ('customization'=any(changed_fields))) and (('script'=any(changed_fields) and proposed_script is not distinct from c.script) or not ('script'=any(changed_fields))) then r:=jsonb_build_object('status','unchanged','operationId',operation_id,'counterId',target_counter,'version',c.version,'folderId',c.folder_id,'counterData',c.counter_data,'customization',c.customization,'script',c.script);
  else
    perform set_config('tally.action_key','live group '||command,true);
    perform set_config('tally.client_event_id',operation_id::text,true);
    update public.shared_counters set folder_id=case when 'folder_id'=any(changed_fields) then proposed_folder_id else c.folder_id end, counter_data=case when command not in ('script_edit','script_publish','customization_save','quick_setting.add','quick_setting.remove') then candidate else c.counter_data end, customization=case when 'customization'=any(changed_fields) or command in ('customization_save','quick_setting.add','quick_setting.remove') then proposed_customization else c.customization end, script=case when 'script'=any(changed_fields) or command in ('script_edit','script_publish') then jsonb_set(coalesce(proposed_script,'{}'::jsonb),'{enabled}','false'::jsonb,true) else c.script end, updated_at=now() where id=target_counter and version=c.version;
    if not found then raise exception using errcode='40001',message='Concurrent group change; retry'; end if;
    select * into c from public.shared_counters where id=target_counter;
    r:=jsonb_build_object('status',case when reconciled then 'reconciled' else 'accepted' end,'operationId',operation_id,'counterId',target_counter,'version',c.version,'folderId',c.folder_id,'counterData',c.counter_data,'customization',c.customization,'script',c.script);
  end if;
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,target_counter,command,r->>'status',r,request_fingerprint);
  return r;
end; $$;

do $$ declare f regprocedure; begin foreach f in array array[
  'public.create_live_group(text,uuid)'::regprocedure,
  'public.transfer_live_group_ownership(uuid,uuid,text,uuid)'::regprocedure,
  'public.leave_live_group(uuid,uuid)'::regprocedure,
  'public.delete_live_group(uuid,uuid)'::regprocedure,
  'public.perform_live_group_operation(uuid,uuid,text,uuid,bigint,uuid,uuid,text[],jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,text[])'::regprocedure
] loop execute format('revoke execute on function %s from public, anon',f); execute format('grant execute on function %s to authenticated',f); end loop; end $$;

do $$ declare f regprocedure; begin foreach f in array array[
  'public.set_live_group_member_permissions(uuid,uuid,text,text[],uuid)'::regprocedure,
  'public.transfer_live_group_ownership_with_permissions(uuid,uuid,text,text[],uuid)'::regprocedure
] loop execute format('revoke execute on function %s from public, anon',f); execute format('grant execute on function %s to authenticated',f); end loop; end $$;

-- Role-safe read boundary.  The aggregate is deliberately built from the
-- caller's active memberships and returns usernames only (never auth fields,
-- email addresses, or unrelated profile columns).
create or replace function public.get_live_groups_workspace()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'Authentication required'; end if;
  return jsonb_build_object(
    'groups', coalesce((select jsonb_agg(jsonb_build_object(
      'id',g.id,'name',g.name,'ownerId',g.owner_id,
      'role',case when g.owner_id=uid then 'owner' else 'member' end,
      'members',coalesce((select jsonb_agg(jsonb_build_object(
        'userId',m.user_id,'username',coalesce(p.username,'Tally user'),
        'permissionPreset',m.permission_preset,'customPermissions',m.custom_permissions
      ) order by m.joined_at) from public.counter_group_members m join public.profiles p on p.id=m.user_id where m.group_id=g.id),'[]'::jsonb),
      'counters',coalesce((select jsonb_agg(jsonb_build_object(
        'id',c.id,'version',c.version,'counterData',case when jsonb_typeof(c.counter_data)='object' then c.counter_data else '{}'::jsonb end,
        'customization',case when c.customization is null or jsonb_typeof(c.customization)='object' then c.customization else '{}'::jsonb end,
        'script',case when c.script is null or jsonb_typeof(c.script)='object' then jsonb_set(c.script,'{enabled}','false'::jsonb,true) else null end,
        'folderId',c.folder_id,'updatedAt',c.updated_at
      ) order by c.updated_at desc) from public.shared_counters c where c.group_id=g.id),'[]'::jsonb),
      'folders',coalesce((select jsonb_agg(jsonb_build_object('id',f.id,'parentId',f.parent_id,'name',f.name,'createdBy',f.created_by) order by f.created_at) from public.counter_group_folders f where f.group_id=g.id),'[]'::jsonb),
      'activity',coalesce((select jsonb_agg(activity_row.payload order by activity_row.created_at desc) from (
        select jsonb_build_object('source','group','id','group:'||a.id::text,'actorId',a.actor_id,'actorUsername',coalesce(ap.username,'Tally user'),'counterId',a.target_counter_id,'command',a.command,'details',case when jsonb_typeof(a.details)='object' then a.details else '{}'::jsonb end,'createdAt',a.created_at) payload,a.created_at
          from public.live_group_activity_events a left join public.profiles ap on ap.id=a.actor_id where a.group_id=g.id
        union all
        select jsonb_build_object('source','counter','id','counter:'||e.id::text,'actorId',e.actor_id,'actorUsername',coalesce(ep.username,'Tally user'),'counterId',e.counter_id,'command',e.action_key,'details',jsonb_build_object('before',e.before_data,'after',e.after_data,'baseVersion',e.base_version,'resultingVersion',e.resulting_version),'createdAt',e.created_at) payload,e.created_at
          from public.shared_counter_events e left join public.profiles ep on ep.id=e.actor_id where e.group_id=g.id
      ) activity_row),'[]'::jsonb)
    ) order by g.created_at) from public.counter_groups g where exists(select 1 from public.counter_group_members mine where mine.group_id=g.id and mine.user_id=uid)),'[]'::jsonb),
    'invitations',coalesce((select jsonb_agg(jsonb_build_object(
      'id',i.id::text,'groupId',i.group_id,'groupName',coalesce(g.name,'Unavailable group'),
      'state',i.status,'inviterId',i.inviter_id,'inviterUsername',coalesce(p.username,'Tally user'),
      'permissionPreset',i.permission_preset,'customPermissions',i.custom_permissions,'createdAt',i.created_at
    ) order by i.created_at desc) from public.counter_group_invites i left join public.counter_groups g on g.id=i.group_id left join public.profiles p on p.id=i.inviter_id where i.recipient_id=uid),'[]'::jsonb)
  );
end; $$;

revoke execute on function public.get_live_groups_workspace() from public, anon;
grant execute on function public.get_live_groups_workspace() to authenticated;

create or replace function private.assert_account_deletion_allowed(target_user uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if exists(select 1 from public.counter_groups where owner_id=target_user) then
    raise exception using errcode='23514', message='Account owns groups; transfer ownership or delete each group first';
  end if;
end; $$;
revoke execute on function private.assert_account_deletion_allowed(uuid) from public, anon, authenticated;
grant execute on function private.assert_account_deletion_allowed(uuid) to service_role;

-- PostgREST exposes public-schema RPCs only. This deliberately non-overloaded
-- wrapper is service-role-only; a successful call is a closed, harmless result
-- and ownership violations retain the guard's SQLSTATE/message.
create or replace function public.assert_account_deletion_allowed(target_user uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_account_deletion_allowed(target_user);
  return jsonb_build_object('allowed',true);
end; $$;
revoke execute on function public.assert_account_deletion_allowed(uuid) from public, anon, authenticated;
grant execute on function public.assert_account_deletion_allowed(uuid) to service_role;

create or replace function public.get_account_deletion_preflight()
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); owned jsonb;
begin
  if uid is null then raise exception 'Authentication required'; end if;
  select coalesce(jsonb_agg(id::text order by created_at),'[]'::jsonb) into owned from public.counter_groups where owner_id=uid;
  return jsonb_build_object('canDelete',jsonb_array_length(owned)=0,'ownedGroupCount',jsonb_array_length(owned),'ownedGroupIds',owned);
end; $$;
revoke execute on function public.get_account_deletion_preflight() from public, anon;
grant execute on function public.get_account_deletion_preflight() to authenticated;

create or replace function private.prevent_owned_group_profile_delete()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  perform private.assert_account_deletion_allowed(old.id);
  return old;
end; $$;
revoke execute on function private.prevent_owned_group_profile_delete() from public, anon, authenticated;

-- The profile trigger covers auth.users cascading profile deletion. Edge
-- Functions must call the same private guard in their deletion transaction;
-- the preflight is advisory UI state, never the authorization check.
drop trigger if exists prevent_owned_group_profile_delete on public.profiles;
create trigger prevent_owned_group_profile_delete before delete on public.profiles
  for each row execute function private.prevent_owned_group_profile_delete();

grant execute on function private.assert_account_deletion_allowed(uuid) to service_role;

do $$ declare f regprocedure; begin foreach f in array array[
  'public.invite_live_group_member(uuid,text,text,text[],uuid)'::regprocedure,
  'public.respond_live_group_invite(bigint,boolean,uuid)'::regprocedure,
  'public.remove_live_group_member(uuid,uuid,uuid)'::regprocedure
] loop execute format('revoke execute on function %s from public, anon',f); execute format('grant execute on function %s to authenticated',f); end loop; end $$;

-- Superseded browser mutation paths are revoked; SELECT/RLS remains available.
do $$ declare f regprocedure; begin foreach f in array array[
  'public.create_counter_group(text)'::regprocedure,
  'public.invite_counter_group_member(uuid,text,text,text[])'::regprocedure,
  'public.respond_counter_group_invite(bigint,boolean)'::regprocedure,
  'public.leave_counter_group(uuid)'::regprocedure,
  'public.transfer_counter_group_ownership(uuid,uuid,text)'::regprocedure,
  'public.set_counter_group_member_permissions(uuid,uuid,text,text[])'::regprocedure,
  'public.remove_counter_group_member(uuid,uuid)'::regprocedure,
  'public.delete_counter_group(uuid)'::regprocedure,
  'public.create_shared_counter(uuid,jsonb)'::regprocedure,
  'public.delete_shared_counter(uuid)'::regprocedure,
  'public.create_counter_group_folder(uuid,text,uuid)'::regprocedure,
  'public.delete_counter_group_folder(uuid)'::regprocedure,
  'public.move_shared_counter_to_folder(uuid,uuid)'::regprocedure,
  'public.move_counter_group_folder(uuid,uuid)'::regprocedure
] loop execute format('revoke execute on function %s from authenticated',f); end loop; end $$;

create or replace function public.create_live_group_counter(target_group uuid, initial_counter jsonb, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare uid uuid := (select auth.uid()); cid uuid; prior jsonb; fp text;
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  if jsonb_typeof(initial_counter)<>'object' then raise exception 'Invalid counter data'; end if;
  initial_counter:=private.normalize_live_counter(initial_counter-'localOnly');
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'candidate',initial_counter,'command','create_counter'));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'create_counter',fp);
  if prior is not null then return prior; end if;
  if not (select private.live_group_permission(target_group,'create_counter')) then raise exception 'You do not have permission to create counters'; end if;
  perform set_config('tally.action_key','live group create counter',true);
  perform set_config('tally.client_event_id',operation_id::text,true);
  insert into public.shared_counters(group_id,counter_data,created_by) values(target_group,initial_counter-'localOnly',uid) returning id into cid;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'counterId',cid,'version',(select version from public.shared_counters where id=cid),'counterData',(select counter_data from public.shared_counters where id=cid));
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,cid,'create_counter','accepted',prior,fp);
  return prior;
end; $$;

create or replace function public.delete_live_group_counter(target_counter uuid, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare gid uuid; prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('targetCounter',target_counter,'command','delete_counter'));
  prior:=private.live_group_recover_operation(uid,operation_id,null,target_counter,'delete_counter',fp); if prior is not null then return prior; end if;
  select group_id into gid from public.shared_counters where id=target_counter;
  if gid is null then raise exception 'Shared counter not found'; end if;
  if not (select private.live_group_permission(gid,'delete_counter')) then raise exception 'You do not have permission to delete this counter'; end if;
  perform set_config('tally.action_key','live group delete counter',true);
  perform set_config('tally.client_event_id',operation_id::text,true);
  delete from public.shared_counters where id=target_counter;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'counterId',target_counter);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,gid,target_counter,'delete_counter','accepted',prior,fp);
  return prior;
end; $$;

create or replace function public.move_live_group_counter(target_counter uuid, target_folder uuid default null, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare gid uuid; prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('counter',target_counter,'folder',target_folder,'command','move_counter'));
  prior:=private.live_group_recover_operation(uid,operation_id,null,target_counter,'move_counter',fp); if prior is not null then return prior; end if;
  select group_id into gid from public.shared_counters where id=target_counter;
  if gid is null or (target_folder is not null and not exists(select 1 from public.counter_group_folders where id=target_folder and group_id=gid)) then raise exception 'Counter or folder not found'; end if;
  if not (select private.live_group_permission(gid,'settings_folder')) then raise exception 'You do not have permission to move counters'; end if;
  perform set_config('tally.action_key','live group move counter',true);
  perform set_config('tally.client_event_id',operation_id::text,true);
  update public.shared_counters set folder_id=target_folder,updated_at=now() where id=target_counter;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'counterId',target_counter,'folderId',target_folder);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,gid,target_counter,'move_counter','accepted',prior,fp);
  return prior;
end; $$;

create or replace function public.create_live_group_folder(target_group uuid, folder_name text, target_parent uuid default null, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare fid uuid; prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('group',target_group,'name',trim(folder_name),'parent',target_parent,'command','create_folder'));
  prior:=private.live_group_recover_operation(uid,operation_id,target_group,null,'create_folder',fp); if prior is not null then return prior; end if;
  if not (select private.live_group_permission(target_group,'create_folder')) then raise exception 'You do not have permission to create folders'; end if;
  if folder_name is null or char_length(trim(folder_name)) not between 1 and 60 or position('/' in folder_name)>0 then raise exception 'Invalid folder name'; end if;
  if target_parent is not null and not exists(select 1 from public.counter_group_folders where id=target_parent and group_id=target_group) then raise exception 'Parent folder not found'; end if;
  insert into public.counter_group_folders(group_id,parent_id,name,created_by) values(target_group,target_parent,trim(folder_name),(select auth.uid())) returning id into fid;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'folderId',fid);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,target_group,null,'create_folder','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,target_group,null,'create_folder',prior);
  return prior;
exception when unique_violation then raise exception 'A folder with that name already exists here';
end; $$;

create or replace function public.delete_live_group_folder(target_folder uuid, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare gid uuid; prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('targetFolder',target_folder,'command','delete_folder'));
  prior:=private.live_group_recover_operation(uid,operation_id,null,target_folder,'delete_folder',fp); if prior is not null then return prior; end if;
  select group_id into gid from public.counter_group_folders where id=target_folder;
  if gid is null then raise exception 'Shared folder not found'; end if;
  if not (select private.live_group_permission(gid,'delete_folder')) then raise exception 'You do not have permission to delete folders'; end if;
  if exists(select 1 from public.shared_counters where folder_id=target_folder)
     or exists(with recursive descendants(id) as (select id from public.counter_group_folders where parent_id=target_folder union all select f.id from public.counter_group_folders f join descendants d on f.parent_id=d.id) select 1 from descendants) then
    raise exception 'Folder contains counters or subfolders; move them before deletion';
  end if;
  delete from public.counter_group_folders where id=target_folder;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'folderId',target_folder);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,gid,null,'delete_folder','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,gid,null,'delete_folder',prior);
  return prior;
end; $$;

create or replace function public.move_live_group_folder(target_folder uuid, target_parent uuid default null, operation_id uuid default gen_random_uuid())
returns jsonb language plpgsql security definer set search_path = '' as $$
declare gid uuid; prior jsonb; fp text; uid uuid := (select auth.uid());
begin
  if uid is null or operation_id is null then raise exception 'Authentication and operation identity are required'; end if;
  select group_id into gid from public.counter_group_folders where id=target_folder;
  if gid is null or target_parent=target_folder or (target_parent is not null and not exists(select 1 from public.counter_group_folders where id=target_parent and group_id=gid)) then raise exception 'Invalid folder move'; end if;
  fp:=private.live_group_request_fingerprint(jsonb_build_object('folder',target_folder,'parent',target_parent,'command','folder_move'));
  prior:=private.live_group_recover_operation(uid,operation_id,gid,null,'folder_move',fp); if prior is not null then return prior; end if;
  if not (select private.live_group_permission(gid,'settings_folder')) then raise exception 'You do not have permission to move folders'; end if;
  if target_parent is not null and exists(with recursive descendants(id) as (select id from public.counter_group_folders where parent_id=target_folder union all select f.id from public.counter_group_folders f join descendants d on f.parent_id=d.id) select 1 from descendants where id=target_parent) then raise exception 'A folder cannot be moved into its descendant'; end if;
  update public.counter_group_folders set parent_id=target_parent where id=target_folder;
  prior:=jsonb_build_object('status','accepted','operationId',operation_id,'folderId',target_folder,'parentId',target_parent);
  insert into private.live_group_operation_results(actor_id,operation_id,group_id,target_counter_id,command,status,result,request_fingerprint) values(uid,operation_id,gid,null,'folder_move','accepted',prior,fp);
  perform private.live_group_record_activity(uid,operation_id,gid,null,'folder_move',prior);
  return prior;
end; $$;

do $$ declare f regprocedure; begin foreach f in array array[
  'public.create_live_group_counter(uuid,jsonb,uuid)'::regprocedure,
  'public.delete_live_group_counter(uuid,uuid)'::regprocedure,
  'public.move_live_group_counter(uuid,uuid,uuid)'::regprocedure,
  'public.create_live_group_folder(uuid,text,uuid,uuid)'::regprocedure,
  'public.delete_live_group_folder(uuid,uuid)'::regprocedure,
  'public.move_live_group_folder(uuid,uuid,uuid)'::regprocedure
] loop execute format('revoke execute on function %s from public, anon',f); execute format('grant execute on function %s to authenticated',f); end loop; end $$;
