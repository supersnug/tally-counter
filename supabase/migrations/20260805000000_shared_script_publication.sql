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

-- Server-authoritative shared-script publication.
-- A script invocation may delegate its API, but never its direct UI
-- permissions. Every proposal is revalidated against current group state.

create or replace function private.script_proposal_number(value jsonb, label text)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare raw text;
begin
  if value is null or jsonb_typeof(value) not in ('number', 'string') then
    raise exception '% must be finite', label;
  end if;
  raw := value #>> '{}';
  if raw !~ '^-?(0|[1-9][0-9]*)(\.[0-9]+)?([eE][+-]?[0-9]+)?$' then
    raise exception '% must be finite', label;
  end if;
  begin
    return raw::numeric;
  exception when numeric_value_out_of_range then
    raise exception '% must be finite', label;
  end;
end;
$$;
revoke execute on function private.script_proposal_number(jsonb, text)
  from public, anon, authenticated;

-- Shared script records are durable source only. Invocation state is never
-- persisted, and every future write is normalized to stopped.
update public.shared_counters
set script = jsonb_set(script, '{enabled}', 'false'::jsonb, true)
where script is not null and jsonb_typeof(script) = 'object';

create or replace function private.normalize_shared_script_record()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.script is null then return new; end if;
  if jsonb_typeof(new.script) <> 'object'
     or new.script->'source' is null
     or jsonb_typeof(new.script->'source') <> 'string'
     or new.script->>'language' is null
     or new.script->>'language' not in ('tallyscript', 'javascript') then
    raise exception 'Shared script must contain a recorded language and string source';
  end if;
  new.script := jsonb_set(new.script, '{enabled}', 'false'::jsonb, true);
  return new;
end;
$$;
drop trigger if exists normalize_shared_script_record on public.shared_counters;
create trigger normalize_shared_script_record
before insert or update of script on public.shared_counters
for each row execute function private.normalize_shared_script_record();
revoke execute on function private.normalize_shared_script_record()
  from public, anon, authenticated;

create or replace function public.authorize_shared_script_run(
  target_counter uuid,
  script_language text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  shared public.shared_counters%rowtype;
  permission_key text;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if script_language is null or script_language not in ('tallyscript', 'javascript') then
    raise exception 'Script language is invalid';
  end if;
  select * into shared from public.shared_counters where id = target_counter for update;
  if not found then raise exception 'Shared counter not found'; end if;
  if shared.script is null or shared.script->>'language' is distinct from script_language then
    raise exception 'Recorded script language does not match Run request';
  end if;
  permission_key := case when script_language = 'tallyscript' then 'scripting_ts' else 'scripting_js' end;
  if not (select private.group_permission(shared.group_id, permission_key)) then
    raise exception 'Current member is not authorized to run this script language';
  end if;
  return jsonb_build_object(
    'status', 'authorized',
    'version', shared.version,
    'script', jsonb_set(shared.script, '{enabled}', 'false'::jsonb, true),
    'counter_data', shared.counter_data,
    'customization', shared.customization
  );
end;
$$;
revoke execute on function public.authorize_shared_script_run(uuid, text)
  from public, anon;
grant execute on function public.authorize_shared_script_run(uuid, text)
  to authenticated;

create table if not exists private.shared_script_operation_results (
  actor_id uuid not null references auth.users(id) on delete cascade,
  client_event_id uuid not null,
  counter_id uuid not null references public.shared_counters(id) on delete cascade,
  status text not null check (status in ('accepted', 'unchanged')),
  version bigint not null,
  counter_data jsonb not null,
  customization jsonb,
  created_at timestamptz not null default now(),
  primary key (actor_id, client_event_id)
);
revoke all on private.shared_script_operation_results from public, anon, authenticated;

create or replace function public.perform_shared_script_operation(
  target_counter uuid,
  script_language text,
  proposal jsonb,
  client_event_id uuid,
  expected_version bigint default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  shared public.shared_counters%rowtype;
  prior_event public.shared_counter_events%rowtype;
  prior_result private.shared_script_operation_results%rowtype;
  command text;
  operation text;
  expected_path text;
  proposal_counter text;
  proposal_operation text;
  invocation_id text;
  proposal_path text;
  authority text;
  args jsonb;
  part text;
  requested numeric;
  normalized numeric;
  minimum numeric;
  maximum numeric;
  start_value numeric;
  current_value numeric;
  step_value numeric;
  goals jsonb;
  next_counter jsonb;
  next_customization jsonb;
  changed boolean := false;
  commutative boolean := false;
  permission_key text;
  current_version bigint;
begin
  if actor is null then raise exception 'Authentication required'; end if;
  if client_event_id is null then raise exception 'An operation identity is required'; end if;
  if coalesce(jsonb_typeof(proposal), '') <> 'object' then raise exception 'Invalid script proposal'; end if;
  if script_language is null or script_language not in ('tallyscript', 'javascript') then
    raise exception 'Script language is invalid';
  end if;

  select * into shared from public.shared_counters
    where id = target_counter for update;
  if not found then raise exception 'Shared counter not found'; end if;

  permission_key := case when script_language = 'tallyscript' then 'scripting_ts' else 'scripting_js' end;
  if not (select private.group_permission(shared.group_id, permission_key)) then
    raise exception 'Current member is not authorized for this script language';
  end if;

  select * into prior_result from private.shared_script_operation_results
    where actor_id = actor and shared_script_operation_results.client_event_id = perform_shared_script_operation.client_event_id;
  if found then
    if prior_result.counter_id <> target_counter then raise exception 'Operation identity belongs to another counter'; end if;
    return jsonb_build_object('status',prior_result.status,'version',prior_result.version,
      'counter_data',prior_result.counter_data,'customization',prior_result.customization);
  end if;

  select * into prior_event from public.shared_counter_events
    where actor_id = actor and shared_counter_events.client_event_id = perform_shared_script_operation.client_event_id;
  if found and prior_event.counter_id is not null then
    raise exception 'Original script operation result is unavailable';
  end if;

  invocation_id := proposal->>'invocationId';
  proposal_operation := proposal->>'operationId';
  proposal_counter := proposal->>'counterId';
  proposal_path := proposal->>'path';
  command := proposal->>'command';
  authority := proposal->>'authority';
  args := proposal->'args';
  operation := proposal->>'operation';
  if nullif(invocation_id, '') is null or proposal_operation is null or proposal_operation <> client_event_id::text
     or proposal_counter is null or proposal_counter <> target_counter::text or authority is null or authority <> 'group'
     or operation is null or operation not in ('value.add','value.subtract','value.set','value.exact','value.jump','value.reset','starting.set','step.positive','step.negative','goal.add','goal.remove','goal.clear','direction.set','limit.minimum.set','limit.minimum.remove','limit.maximum.set','limit.maximum.remove','name.set','color.set','super.hide','super.show','super.reset','super.move','super.scale','super.rotate','super.resize','quick-setting.add','quick-setting.remove')
     or proposal_path is null or proposal_path !~ '^Tally\.(value\.(set|exact|jump|add|subtract|reset)|startingValue\.set|steps\.(positive|negative)\.set|goals\.(add|remove|clear)|goalDirection\.set|minimum\.(set|remove)|maximum\.(set|remove)|reset|cosmetic\.preferences\.(name|color)\.set|cosmetic\.super\.(move|scale|rotate|resize|show|hide|reset|quickSettings\.(add|remove)))$'
     or command is null or coalesce(jsonb_typeof(args), '') <> 'array'
     or exists (select 1 from jsonb_object_keys(proposal) as proposal_key
       where proposal_key not in ('invocationId','operationId','counterId','authority','path','operation','command','args')) then
    raise exception 'Script proposal identity or shape is invalid';
  end if;

  expected_path := case operation
    when 'value.add' then 'Tally.value.add'
    when 'value.subtract' then 'Tally.value.subtract'
    when 'value.set' then 'Tally.value.set'
    when 'value.exact' then 'Tally.value.exact'
    when 'value.jump' then 'Tally.value.jump'
    when 'value.reset' then 'Tally.value.reset'
    when 'starting.set' then 'Tally.startingValue.set'
    when 'step.positive' then 'Tally.steps.positive.set'
    when 'step.negative' then 'Tally.steps.negative.set'
    when 'goal.add' then 'Tally.goals.add'
    when 'goal.remove' then 'Tally.goals.remove'
    when 'goal.clear' then 'Tally.goals.clear'
    when 'direction.set' then 'Tally.goalDirection.set'
    when 'limit.minimum.set' then 'Tally.minimum.set'
    when 'limit.minimum.remove' then 'Tally.minimum.remove'
    when 'limit.maximum.set' then 'Tally.maximum.set'
    when 'limit.maximum.remove' then 'Tally.maximum.remove'
    when 'name.set' then 'Tally.cosmetic.preferences.name.set'
    when 'color.set' then 'Tally.cosmetic.preferences.color.set'
    when 'super.hide' then 'Tally.cosmetic.super.hide'
    when 'super.show' then 'Tally.cosmetic.super.show'
    when 'super.reset' then 'Tally.cosmetic.super.reset'
    when 'super.move' then 'Tally.cosmetic.super.move'
    when 'super.scale' then 'Tally.cosmetic.super.scale'
    when 'super.rotate' then 'Tally.cosmetic.super.rotate'
    when 'super.resize' then 'Tally.cosmetic.super.resize'
    when 'quick-setting.add' then 'Tally.cosmetic.super.quickSettings.add'
    when 'quick-setting.remove' then 'Tally.cosmetic.super.quickSettings.remove'
  end;
  if proposal_path <> expected_path then raise exception 'Script operation path does not match its discriminator'; end if;
  command := case operation
    when 'value.add' then 'add' when 'value.subtract' then 'subtract'
    when 'value.set' then 'set' when 'value.exact' then 'exact' when 'value.jump' then 'jump'
    when 'value.reset' then 'reset' when 'starting.set' then 'setStart'
    when 'step.positive' then 'setPositiveStep' when 'step.negative' then 'setNegativeStep'
    when 'goal.add' then 'addGoal' when 'goal.remove' then 'removeGoal' when 'goal.clear' then 'clearGoals'
    when 'direction.set' then 'setDirection' when 'limit.minimum.set' then 'setMinimum'
    when 'limit.minimum.remove' then 'removeMinimum' when 'limit.maximum.set' then 'setMaximum'
    when 'limit.maximum.remove' then 'removeMaximum' when 'name.set' then 'setName'
    when 'color.set' then 'setColor' when 'super.hide' then 'hide' when 'super.show' then 'show'
    when 'super.reset' then 'resetPart' when 'super.move' then 'move' when 'super.scale' then 'scale'
    when 'super.rotate' then 'rotate' when 'super.resize' then 'resize'
    when 'quick-setting.add' then 'quickSettingAdd' when 'quick-setting.remove' then 'quickSettingRemove'
  end;

  if expected_version is not null and expected_version <> shared.version then
    commutative := command in ('add', 'subtract');
    if not commutative then
      raise exception using errcode = '40001',
        message = 'This shared counter changed; reload before publishing the script operation';
    end if;
  end if;

  next_counter := shared.counter_data;
  next_customization := coalesce(shared.customization, '{}'::jsonb);
  current_value := private.script_proposal_number(next_counter->'value', 'Current value');
  start_value := private.script_proposal_number(next_counter->'start', 'Starting value');
  minimum := case when next_counter->'min' is null or next_counter->'min' = 'null'::jsonb then null else private.script_proposal_number(next_counter->'min', 'Minimum') end;
  maximum := case when next_counter->'max' is null or next_counter->'max' = 'null'::jsonb then null else private.script_proposal_number(next_counter->'max', 'Maximum') end;
  if minimum is not null and maximum is not null and minimum > maximum then
    requested := minimum; minimum := maximum; maximum := requested;
    next_counter := jsonb_set(next_counter, '{min}', to_jsonb(minimum), true);
    next_counter := jsonb_set(next_counter, '{max}', to_jsonb(maximum), true);
    changed := true;
  end if;

  if command in ('add', 'subtract', 'set', 'exact', 'jump', 'reset', 'start', 'setMinimum', 'setMaximum', 'removeMinimum', 'removeMaximum', 'setName', 'setColor', 'setDirection', 'setStart', 'setPositiveStep', 'setNegativeStep', 'addGoal', 'removeGoal', 'clearGoals', 'resetPart', 'hide', 'show', 'move', 'scale', 'rotate', 'resize', 'quickSettingAdd', 'quickSettingRemove') then
    null;
  else
    raise exception 'Unsupported script command';
  end if;

  if command = 'add' or command = 'subtract' then
    commutative := true;
    if jsonb_array_length(args) > 1 then raise exception 'Add and subtract accept at most one finite argument'; end if;
    step_value := case when jsonb_array_length(args) = 0 then private.script_proposal_number(case when command = 'add' then next_counter->'plusStep' else next_counter->'minusStep' end, 'Step') else private.script_proposal_number(args->0, 'Amount') end;
    if step_value < 0 then step_value := abs(step_value); end if;
    requested := case when command = 'add' then current_value + step_value else current_value - step_value end;
    normalized := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), requested));
    if normalized <> current_value then
      next_counter := jsonb_set(next_counter, '{value}', to_jsonb(normalized), true); changed := true;
    end if;
  elsif command in ('set', 'exact', 'jump') then
    if jsonb_array_length(args) <> 1 then raise exception 'This script command requires one finite argument'; end if;
    requested := private.script_proposal_number(args->0, 'Value');
    normalized := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), requested));
    if normalized <> current_value then next_counter := jsonb_set(next_counter, '{value}', to_jsonb(normalized), true); changed := true; end if;
  elsif command in ('reset', 'start') then
    if jsonb_array_length(args) <> 0 then raise exception 'Reset takes no arguments'; end if;
    normalized := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), start_value));
    if normalized <> current_value then next_counter := jsonb_set(next_counter, '{value}', to_jsonb(normalized), true); changed := true; end if;
  elsif command in ('setMinimum', 'setMaximum', 'removeMinimum', 'removeMaximum') then
    if command in ('removeMinimum', 'removeMaximum') then
      if jsonb_array_length(args) <> 0 then raise exception 'Removing a limit takes no arguments'; end if;
      if command = 'removeMinimum' then minimum := null; else maximum := null; end if;
    else
      if jsonb_array_length(args) <> 1 then raise exception 'A limit command requires one finite argument'; end if;
      requested := private.script_proposal_number(args->0, 'Limit');
      if command = 'setMinimum' then minimum := requested; else maximum := requested; end if;
    end if;
    if minimum is not null and maximum is not null and minimum > maximum then
      requested := minimum; minimum := maximum; maximum := requested;
    end if;
    normalized := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), current_value));
    next_counter := jsonb_set(jsonb_set(next_counter, '{min}', case when minimum is null then 'null'::jsonb else to_jsonb(minimum) end, true), '{max}', case when maximum is null then 'null'::jsonb else to_jsonb(maximum) end, true);
    if normalized <> current_value then next_counter := jsonb_set(next_counter, '{value}', to_jsonb(normalized), true); changed := true; end if;
    start_value := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), start_value));
    next_counter := jsonb_set(next_counter, '{start}', to_jsonb(start_value), true);
    changed := true;
  elsif command = 'setStart' then
    if jsonb_array_length(args) <> 1 then raise exception 'Starting value requires one finite argument'; end if;
    start_value := greatest(coalesce(minimum, '-Infinity'::numeric), least(coalesce(maximum, 'Infinity'::numeric), private.script_proposal_number(args->0, 'Starting value')));
    next_counter := jsonb_set(next_counter, '{start}', to_jsonb(start_value), true); changed := true;
  elsif command = 'setPositiveStep' or command = 'setNegativeStep' then
    if jsonb_array_length(args) <> 1 then raise exception 'Step requires one finite argument'; end if;
    step_value := abs(private.script_proposal_number(args->0, 'Step'));
    if step_value = 0 then step_value := 1; end if;
    next_counter := jsonb_set(next_counter, case when command = 'setPositiveStep' then ARRAY['plusStep'] else ARRAY['minusStep'] end, to_jsonb(step_value), true); changed := true;
  elsif command = 'resetPart' then
    if jsonb_array_length(args) <> 1 or jsonb_typeof(args->0) <> 'string' then raise exception 'A Tally Super element is required'; end if;
    part := args->>0;
    if part not in ('title','count','add','settings','delete','subtract','reset','embed','goal-bar','minimum-indicator','maximum-indicator','positiveStep','negativeStep','minimum','maximum','color','goalDirection') then raise exception 'Unsupported Tally Super element'; end if;
    next_customization := jsonb_set(next_customization, array['parts',part], '{}'::jsonb, true); changed := true;
  elsif command = 'setName' then
    if jsonb_array_length(args) <> 1 or jsonb_typeof(args->0) <> 'string' or nullif(trim(args->>0), '') is null then raise exception 'Name must be nonblank'; end if;
    next_counter := jsonb_set(next_counter, '{name}', to_jsonb(trim(args->>0)), true); changed := true;
  elsif command = 'setColor' then
    if jsonb_array_length(args) <> 1 or args->>0 !~ '^#[0-9a-fA-F]{6}$' then raise exception 'Color must be a six-digit hex value'; end if;
    next_counter := jsonb_set(next_counter, '{color}', to_jsonb(args->>0), true); changed := true;
  elsif command = 'setDirection' then
    if jsonb_array_length(args) <> 1 or args->>0 not in ('more', 'less') then raise exception 'Goal direction is invalid'; end if;
    next_counter := jsonb_set(next_counter, '{goalDirection}', to_jsonb(args->>0), true); changed := true;
  elsif command in ('addGoal', 'removeGoal') then
    if jsonb_array_length(args) <> 1 then raise exception 'Goal command requires one finite argument'; end if;
    requested := private.script_proposal_number(args->0, 'Goal');
    goals := case when jsonb_typeof(next_counter->'goals') = 'array' then next_counter->'goals' else '[]'::jsonb end;
    if command = 'addGoal' and not exists (select 1 from jsonb_array_elements(goals) g where private.script_proposal_number(g, 'Goal') = requested) then goals := goals || jsonb_build_array(requested); end if;
    if command = 'removeGoal' then goals := coalesce((select jsonb_agg(g) from jsonb_array_elements(goals) g where private.script_proposal_number(g, 'Goal') <> requested), '[]'::jsonb); end if;
    next_counter := jsonb_set(next_counter, '{goals}', goals, true); changed := true;
  elsif command = 'clearGoals' then
    if jsonb_array_length(args) <> 0 then raise exception 'Clearing goals takes no arguments'; end if;
    next_counter := jsonb_set(next_counter, '{goals}', '[]'::jsonb, true); changed := true;
  elsif command in ('quickSettingAdd', 'quickSettingRemove') then
    if jsonb_array_length(args) <> 1 or args->>0 not in ('positiveStep','negativeStep','minimum','maximum','color','goalDirection') then
      raise exception 'Unsupported quick setting';
    end if;
    goals := case when jsonb_typeof(next_customization->'quickSettings') = 'array' then next_customization->'quickSettings' else '[]'::jsonb end;
    if command = 'quickSettingAdd' and not exists (select 1 from jsonb_array_elements_text(goals) setting where setting = args->>0) then
      goals := goals || jsonb_build_array(args->>0);
    elsif command = 'quickSettingRemove' then
      goals := coalesce((select jsonb_agg(setting) from jsonb_array_elements_text(goals) setting where setting <> args->>0), '[]'::jsonb);
    end if;
    next_customization := jsonb_set(next_customization, '{quickSettings}', goals, true); changed := true;
  elsif command = 'hide' or command = 'show' then
    if jsonb_array_length(args) <> 1 or jsonb_typeof(args->0) <> 'string' then raise exception 'A Tally Super element is required'; end if;
    part := args->>0;
    if part not in ('title','count','add','settings','delete','subtract','reset','embed','goal-bar','minimum-indicator','maximum-indicator','positiveStep','negativeStep','minimum','maximum','color','goalDirection') then raise exception 'Unsupported Tally Super element'; end if;
    if command = 'hide' and part in ('title','count','add','settings','delete') then raise exception 'Required Tally Super elements cannot be hidden'; end if;
    next_customization := jsonb_set(next_customization, array['parts',part,'hidden'], to_jsonb(command = 'hide'), true); changed := true;
  elsif command in ('move','scale','rotate','resize') then
    if (command in ('move','scale','resize') and jsonb_array_length(args) <> 3)
       or (command = 'rotate' and jsonb_array_length(args) <> 2)
       or jsonb_typeof(args->0) <> 'string' then raise exception 'A Tally Super element and typed finite arguments are required'; end if;
    part := args->>0;
    if command = 'resize' and part not in ('add','subtract') then raise exception 'Only add and subtract accept dimensions'; end if;
    if part not in ('title','count','add','settings','delete','subtract','reset','embed','goal-bar','minimum-indicator','maximum-indicator','positiveStep','negativeStep','minimum','maximum','color','goalDirection') then raise exception 'Unsupported Tally Super element'; end if;
    perform private.script_proposal_number(args->1, 'Transform');
    if command in ('move','scale','resize') then perform private.script_proposal_number(args->2, 'Transform'); end if;
    if command in ('scale','resize') and (private.script_proposal_number(args->1, 'Transform') <= 0 or private.script_proposal_number(args->2, 'Transform') <= 0) then
      raise exception 'Scale and dimensions must be positive';
    end if;
    if command = 'move' then next_customization := jsonb_set(jsonb_set(next_customization, array['parts',part,'x'], args->1, true), array['parts',part,'y'], args->2, true);
    elsif command = 'scale' then next_customization := jsonb_set(jsonb_set(next_customization, array['parts',part,'scaleX'], args->1, true), array['parts',part,'scaleY'], args->2, true);
    elsif command = 'rotate' then next_customization := jsonb_set(next_customization, array['parts',part,'rotation'], args->1, true);
    else next_customization := jsonb_set(jsonb_set(next_customization, array['parts',part,'width'], args->1, true), array['parts',part,'height'], args->2, true); end if;
    changed := true;
  end if;

  -- A proposal that normalizes to the current aggregate is a true no-op,
  -- regardless of which typed command produced it.
  changed := next_counter is distinct from shared.counter_data
    or next_customization is distinct from coalesce(shared.customization, '{}'::jsonb);

  if not changed then
    insert into private.shared_script_operation_results(
      actor_id, client_event_id, counter_id, status, version, counter_data, customization
    ) values (
      actor, client_event_id, target_counter, 'unchanged', shared.version,
      shared.counter_data, shared.customization
    );
    return jsonb_build_object('status','unchanged','version',shared.version,
      'counter_data',shared.counter_data,'customization',shared.customization);
  end if;

  perform set_config('tally.action_key', 'script-published change', true);
  perform set_config('tally.client_event_id', client_event_id::text, true);
  update public.shared_counters set counter_data = next_counter,
    customization = next_customization, updated_at = now()
    where id = target_counter;
  select version, counter_data, customization into current_version, next_counter, next_customization
    from public.shared_counters where id = target_counter;
  insert into private.shared_script_operation_results(
    actor_id, client_event_id, counter_id, status, version, counter_data, customization
  ) values (
    actor, client_event_id, target_counter, 'accepted', current_version,
    next_counter, next_customization
  );
  return jsonb_build_object('status','accepted','version',current_version,
    'counter_data',next_counter,'customization',next_customization);
end;
$$;

revoke execute on function public.perform_shared_script_operation(uuid,text,jsonb,uuid,bigint)
  from public, anon;
grant execute on function public.perform_shared_script_operation(uuid,text,jsonb,uuid,bigint)
  to authenticated;
