/*
 * This file is part of Tally.
 *
 * Copyright (C) 2026 Tally contributors
 *
 * Tally is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, version 3 of the
 * License.
 *
 * Tally is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with Tally. If not, see <https://www.gnu.org/licenses/>.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AnyRecord } from "../counters/model";
import { permissionsForChangedFields, presetPermissions } from "./permissions";
import { guardedRawRead, guardedRawWrite } from "../../shared/persistence/guardedStorage";

const readableError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as AnyRecord;
    const message = [value.message, value.details, value.hint]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(" — ");
    if (message) return value.code ? `${message} (${value.code})` : message;
  }
  return fallback;
    };

const record = (value: unknown): AnyRecord | null =>
  value && typeof value === "object" && !Array.isArray(value) ? value as AnyRecord : null;

const list = (value: unknown) => Array.isArray(value) ? value.map(record).filter(Boolean) as AnyRecord[] : [];

const aggregateValue = (value: unknown) => {
  const item = Array.isArray(value) ? value[0] : value;
  return record(item) || {};
};
const resultValue = (value: unknown) => Array.isArray(value) ? value[0] : value;
const resultId = (value: unknown, key: string) => { const result = resultValue(value); return record(result)?.[key] || result; };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const finite = (value: unknown) => typeof value === "number" && Number.isFinite(value);
const normalizeCounter = (value: AnyRecord) => {
  const data = record(value.counterData ?? value.counter_data);
  if (!data || typeof data.name !== "string" || !finite(data.value) || !finite(data.start) || !finite(data.plusStep) || !finite(data.minusStep) || !Array.isArray(data.goals) || data.goals.some((goal) => !finite(goal))) return null;
  const normalized: AnyRecord = { ...data, plusStep: Math.max(1, Math.abs(data.plusStep as number)), minusStep: Math.max(1, Math.abs(data.minusStep as number)), goals: [...new Set(data.goals.filter(finite))] };
  if (finite(normalized.min) && finite(normalized.max) && normalized.min > normalized.max) [normalized.min, normalized.max] = [normalized.max, normalized.min];
  return normalized;
};
const validGroup = (group: AnyRecord) => {
  if (typeof group.id !== "string" || !UUID.test(group.id) || typeof group.name !== "string") return false;
  if (!Array.isArray(group.members) || !Array.isArray(group.counters) || !Array.isArray(group.folders)) return false;
  return group.members.every((member) => { const item = record(member); return item && typeof (item.userId ?? item.user_id) === "string" && typeof (item.permissionPreset ?? item.permission_preset) === "string"; }) && group.counters.every((counter) => { const item = record(counter); return item && typeof item.id === "string" && finite(Number(item.version)) && normalizeCounter(item); }) && group.folders.every((folder) => { const item = record(folder); return item && typeof item.id === "string" && typeof item.name === "string"; });
};
const JOURNAL_KEY = "tally-live-group-operations";
const readJournal = () => { const result = guardedRawRead(localStorage, JOURNAL_KEY, "[]"); if (!result.ok || !result.value) return []; try { const value = JSON.parse(result.value); return Array.isArray(value) ? value : []; } catch { return []; } };
const JOURNAL_NAMES = new Set(["create_live_group", "invite_live_group_member", "respond_live_group_invite", "set_live_group_member_permissions", "transfer_live_group_ownership_with_permissions", "remove_live_group_member", "leave_live_group", "delete_live_group", "perform_live_group_operation", "perform_live_group_script_operation", "create_live_group_counter", "delete_live_group_counter", "move_live_group_counter", "create_live_group_folder", "delete_live_group_folder", "move_live_group_folder"]);
const writeJournal = (value) => guardedRawWrite(localStorage, JOURNAL_KEY, JSON.stringify(value), guardedRawRead(localStorage, JOURNAL_KEY).value).ok;
const validJournal = (entry) => { const item = record(entry); return item && typeof item.userId === "string" && UUID.test(item.userId) && typeof item.operationId === "string" && UUID.test(item.operationId) && JOURNAL_NAMES.has(item.name) && ["pending", "uncertain"].includes(item.stage) && record(item.args); };
const safeJournal = () => { const entries = readJournal().filter(validJournal); if (entries.length !== readJournal().length) writeJournal(entries); return entries; };

export function useSharedGroups(session) {
  const userId = session?.user?.id;
  const [groups, setGroups] = useState<AnyRecord[]>([]);
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [counters, setCounters] = useState<AnyRecord[]>([]);
  const [folders, setFolders] = useState<AnyRecord[]>([]);
  const [events, setEvents] = useState<AnyRecord[]>([]);
  const versions = useRef(new Map<string, number>());
  const [invites, setInvites] = useState<AnyRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError] = useState("");
  const [invalidGroups, setInvalidGroups] = useState<AnyRecord[]>([]);
  const [connectionStatus, setConnectionStatus] = useState(typeof navigator !== "undefined" && navigator.onLine ? "Connected" : "Reconnecting");
  const operationIds = useRef(new Map<string, string>());
  const operationId = (key: string) => {
    const existing = operationIds.current.get(key); if (existing) return existing;
    const saved = safeJournal().find((entry) => entry.key === key);
    const id = saved?.operationId || crypto.randomUUID(); operationIds.current.set(key, id); return id;
  };

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setGroups([]); setMembers([]); setCounters([]); setFolders([]); setEvents([]); setInvites([]); setInvalidGroups([]);
      return;
    }
    try {
      const { data: aggregate, error: aggregateError } = await supabase.rpc("get_live_groups_workspace");
      if (aggregateError) throw aggregateError;
      const payload = aggregateValue(aggregate);
      const candidateGroups = list(payload.groups);
      const rawGroups = candidateGroups.filter(validGroup);
      setInvalidGroups(candidateGroups.filter((group) => !validGroup(group)).map((group, index) => ({ id: group.id || `invalid-${index}`, name: typeof group.name === "string" ? group.name : "Unnamed group" })));
      const nextGroups: AnyRecord[] = rawGroups.filter((group) => typeof group.id === "string").map((group) => ({
        ...group, owner_id: group.ownerId ?? group.owner_id,
      }));
      const ids = nextGroups.map((group) => group.id as string);
      const nextMembers: AnyRecord[] = [], nextCounters: AnyRecord[] = [], nextFolders: AnyRecord[] = [], nextEvents: AnyRecord[] = [];
      rawGroups.forEach((group) => {
        const groupId = group.id;
        if (typeof groupId !== "string") return;
        list(group.members).forEach((member) => nextMembers.push({ ...member, group_id: groupId, user_id: member.userId ?? member.user_id, permission_preset: member.permissionPreset ?? member.permission_preset, custom_permissions: member.customPermissions ?? member.custom_permissions }));
         list(group.counters).forEach((counter) => nextCounters.push({ ...counter, group_id: groupId, folder_id: counter.folderId ?? counter.folder_id, counter_data: normalizeCounter(counter), updated_at: counter.updatedAt ?? counter.updated_at, script: record(counter.script) ? { source: typeof (counter.script as AnyRecord).source === "string" ? (counter.script as AnyRecord).source : "", language: (counter.script as AnyRecord).language, enabled: false } : null }));
        list(group.folders).forEach((folder) => nextFolders.push({ ...folder, group_id: groupId, parent_id: folder.parentId ?? folder.parent_id, created_by: folder.createdBy ?? folder.created_by }));
        list(group.activity).forEach((event) => nextEvents.push({ ...event, group_id: groupId, actor_id: event.actorId ?? event.actor_id, counter_id: event.counterId ?? event.counter_id, action_key: event.command ?? event.action_key, created_at: event.createdAt ?? event.created_at }));
      });
       setGroups(nextGroups); setMembers(nextMembers); setCounters(nextCounters); setFolders(nextFolders); setEvents(nextEvents);
       setInvites(list(payload.invitations).filter((invite) => /^\d+$/.test(String(invite.id)) && ["Pending", "Accepted", "Declined", "pending", "accepted", "declined"].includes(String(invite.state)) && typeof (invite.groupId ?? invite.group_id) === "string").map((invite) => ({ ...invite, group_id: invite.groupId ?? invite.group_id, group_name: invite.groupName ?? invite.group_name, inviter_id: invite.inviterId ?? invite.inviter_id, permission_preset: invite.permissionPreset ?? invite.permission_preset, custom_permissions: invite.customPermissions ?? invite.custom_permissions, created_at: invite.createdAt ?? invite.created_at })));
       versions.current = new Map(nextCounters.map((counter) => [counter.id as string, Number(counter.version || 0)]));
       setError("");
      setSelectedGroupId((current) => current && ids.includes(current) ? current : ids[0] || "");
    } catch (loadError) {
      setError(readableError(loadError, "Groups could not be loaded."));
    }
  }, [userId]);

  useEffect(() => {
    void load();
    if (!supabase || !userId) return;
    const refresh = () => void load();
    let invalidateTimer;
    const changed = () => { window.clearTimeout(invalidateTimer); invalidateTimer = window.setTimeout(() => void load(), 120); };
    const offline = () => setConnectionStatus("Reconnecting");
    const online = () => { setConnectionStatus("Connected"); refresh(); };
    const channel = supabase.channel?.(`live-groups-${userId}`);
    if (channel) {
      ["counter_groups", "counter_group_members", "counter_group_invites", "shared_counters", "counter_group_folders", "live_group_activity_events", "shared_counter_events"].forEach((table) => channel.on("postgres_changes", { event: "*", schema: "public", table }, changed));
      channel.subscribe((status) => setConnectionStatus(status === "SUBSCRIBED" ? "Connected" : status === "CHANNEL_ERROR" || status === "TIMED_OUT" ? "Error" : "Reconnecting"));
    }
    window.addEventListener("tally-groups-changed", changed);
    window.addEventListener("focus", refresh); window.addEventListener("online", online); window.addEventListener("offline", offline);
    const polling = window.setInterval(refresh, 30000);
    return () => { window.clearTimeout(invalidateTimer); if (channel?.unsubscribe) void channel.unsubscribe(); if (supabase.removeChannel && channel) void supabase.removeChannel(channel); window.removeEventListener("tally-groups-changed", changed); window.removeEventListener("focus", refresh); window.removeEventListener("online", online); window.removeEventListener("offline", offline); window.clearInterval(polling); };
  }, [userId, load]);

  useEffect(() => {
    if (!supabase || !userId) return;
    let cancelled = false;
    void (async () => {
      await load();
      const entries = safeJournal().filter((entry) => entry.userId === userId);
      for (const entry of entries) {
        if (cancelled) return;
        const { data, error: replayError } = await supabase.rpc(entry.name, { ...entry.args, operation_id: entry.operationId });
        const status = resultValue(data)?.status;
        if (!replayError && ["accepted", "reconciled", "unchanged", "recovered", "declined"].includes(status)) writeJournal(readJournal().filter((item) => item.operationId !== entry.operationId));
      }
    })();
    return () => { cancelled = true; };
  }, [userId, load]);

   const rpc = async (name, args, key = name, forcedOperationId = null) => {
     const identityKey = `${userId}:${name}:${key}:${JSON.stringify(args)}`;
     const operation = forcedOperationId || operationId(identityKey); const payload = { ...args, operation_id: operation };
     if (!userId) throw new Error("A signed-in actor is required for shared operations.");
     const journal = safeJournal().filter((entry) => entry.key !== identityKey);
     if (!JOURNAL_NAMES.has(name) || !writeJournal([...journal, { key: identityKey, userId, operationId: operation, name, args, stage: "pending" }])) throw new Error("Shared operation could not be durably recorded; nothing was submitted.");
     const { data, error: rpcError } = await supabase.rpc(name, payload);
       if (rpcError) { writeJournal([...journal, { key: identityKey, userId, operationId: operation, name, args, stage: "uncertain" }]); throw rpcError; }
     await load();
     window.dispatchEvent(new Event("tally-groups-changed"));
     const status = resultValue(data)?.status;
     if (!["accepted", "reconciled", "unchanged", "recovered", "declined"].includes(status) && name !== "get_live_groups_workspace") {
        writeJournal([...journal, { key: identityKey, userId, operationId: operation, name, args, stage: "uncertain" }]);
       return data;
     }
      writeJournal(journal); operationIds.current.delete(identityKey); return data;
    };
   const prepareEmbedCounter = async (counterId: string) => {
     if (!supabase || !userId) throw new Error("Sign in again to verify current group access.");
     const { data, error: refreshError } = await supabase.rpc("get_live_groups_workspace");
     if (refreshError) throw refreshError;
     const payload = aggregateValue(data);
     for (const group of list(payload.groups)) {
       if (!validGroup(group)) continue;
       const member = list(group.members).find((item) => (item.userId ?? item.user_id) === userId);
       const counter = list(group.counters).find((item) => item.id === counterId);
       const normalized = counter && normalizeCounter(counter);
       if (member && normalized) return normalized;
     }
     throw new Error("This shared counter is no longer available for public embedding. Refresh the group and retry.");
   };
  const membership = members.find((member) => member.group_id === selectedGroupId && member.user_id === userId);
  const permissions = useMemo(
    () => new Set(presetPermissions(membership?.permission_preset, membership?.custom_permissions)),
    [membership?.permission_preset, JSON.stringify(membership?.custom_permissions)],
  );
  return {
      groups, members, counters, folders, events, invites, invalidGroups, selectedGroupId, setSelectedGroupId, prepareEmbedCounter,
    selectedGroup: groups.find((group) => group.id === selectedGroupId),
    selectedCounters: counters.filter((counter) => counter.group_id === selectedGroupId),
    selectedFolders: folders.filter((folder) => folder.group_id === selectedGroupId),
    selectedEvents: events.filter((event) => event.group_id === selectedGroupId),
     permissions, membership, error, connectionStatus, load,
       saveCounter: async (counterId, proposed, options: AnyRecord = {}) => {
       const current = counters.find((counter) => counter.id === counterId); if (!current) throw new Error("Shared counter is no longer available.");
        const base = options.baseRecord || current.counter_data || {};
        const fields = ["value", "start", "plusStep", "minusStep", "min", "max", "goals", "goalDirection", "name", "color"].filter((field) => JSON.stringify(base?.[field]) !== JSON.stringify(proposed[field]));
         if (JSON.stringify(options.baseCustomization ?? current.customization ?? {}) !== JSON.stringify(options.proposedCustomization ?? current.customization ?? {})) fields.push("customization");
         if (JSON.stringify(options.baseScript ?? current.script ?? null) !== JSON.stringify(options.proposedScript ?? current.script ?? null)) fields.push("script");
         if ((options.baseFolderId || null) !== (options.proposedFolderId || null)) fields.push("folder_id");
            return rpc("perform_live_group_operation", { target_group: selectedGroupId, target_counter: counterId, command: "counter_save", base_version: options.baseVersion ?? current.version ?? 0, base_folder_id: options.baseFolderId || null, proposed_folder_id: options.proposedFolderId || null, changed_fields: fields, base_counter: base, proposed_counter: proposed, base_customization: options.baseCustomization || current.customization || {}, proposed_customization: options.proposedCustomization ?? current.customization ?? {}, base_script: options.baseScript ?? current.script ?? null, proposed_script: options.proposedScript ?? current.script ?? null, action_permissions: permissionsForChangedFields(base, proposed, fields) }, `edit:${counterId}`);
    },
    createGroup: (name) => rpc("create_live_group", { group_name: name }, `create:${name}`),
    invite: (groupId, identifier, preset, custom) => rpc("invite_live_group_member", { target_group: groupId, recipient_identifier: identifier, member_preset: preset, member_permissions: preset === "custom" ? custom : null }),
    respondInvite: (id, accept) => rpc("respond_live_group_invite", { invite_id: id, accept_invite: accept }),
     setPermissions: (groupId, user, preset, custom) => rpc("set_live_group_member_permissions", { target_group: groupId, target_user: user, member_preset: preset, member_permissions: preset === "custom" ? custom : [] }),
     transferOwnership: (groupId, user, preset, custom) => rpc("transfer_live_group_ownership_with_permissions", { target_group: groupId, new_owner: user, former_owner_preset: preset, former_owner_permissions: preset === "custom" ? custom : [] }),
    removeMember: (groupId, user) => rpc("remove_live_group_member", { target_group: groupId, target_user: user }),
    deleteGroup: (groupId) => rpc("delete_live_group", { target_group: groupId }),
    leaveGroup: (groupId) => rpc("leave_live_group", { target_group: groupId }),
     createCounter: async (groupId, counter) => resultId(await rpc("create_live_group_counter", { target_group: groupId, initial_counter: counter }), "counterId"),
    deleteCounter: (counterId) => rpc("delete_live_group_counter", { target_counter: counterId }),
    createFolder: (groupId, name, parentId = null) => rpc("create_live_group_folder", { target_group: groupId, folder_name: name, target_parent: parentId }),
    deleteFolder: (folderId) => rpc("delete_live_group_folder", { target_folder: folderId }),
    moveFolder: (folderId, parentId = null) => rpc("move_live_group_folder", { target_folder: folderId, target_parent: parentId }),
    moveCounter: (counterId, folderId = null) => rpc("move_live_group_counter", { target_counter: counterId, target_folder: folderId }),
     action: async (counterId, action, value = null) => {
      const current = counters.find((counter) => counter.id === counterId);
      try {
         const command = action === "add" || action === "subtract" || action === "reset" ? action : action;
           const proposed = { ...(current?.counter_data || {}) };
           if (command === "add" || command === "subtract") proposed.value = Number(current?.counter_data?.value || 0) + (command === "add" ? Math.abs(Number(value) || 1) : -Math.abs(Number(value) || 1));
           if (command === "reset") proposed.value = Number(current?.counter_data?.start || 0);
           const result = await rpc("perform_live_group_operation", { target_group: selectedGroupId, target_counter: counterId, command, base_version: versions.current.get(counterId) ?? current?.version ?? 0, base_folder_id: current?.folder_id || null, proposed_folder_id: current?.folder_id || null, changed_fields: [command], base_counter: current?.counter_data || {}, proposed_counter: proposed, base_customization: current?.customization || {}, proposed_customization: current?.customization || {}, base_script: current?.script || null, proposed_script: current?.script || null, action_permissions: [action] }, `counter:${counterId}:${action}`);
        const authoritative = Array.isArray(result) ? result[0] : result; versions.current.set(counterId, Number(authoritative?.version ?? versions.current.get(counterId) ?? 0)); return authoritative;
      } catch (actionError) {
        await load();
        throw actionError;
      }
    },
     scriptOperation: async (counterId, language, proposal) => {
      const current = counters.find((counter) => counter.id === counterId);
        const scriptOperationId = crypto.randomUUID();
        const data = await rpc("perform_live_group_script_operation", { target_counter: counterId, script_language: language, proposal: { ...proposal, operationId: scriptOperationId, counterId, authority: "group", source: proposal.source || proposal.script?.source || "", enabled: false }, expected_version: versions.current.get(counterId) ?? current?.version ?? 0 }, `script:${counterId}`, scriptOperationId);
      const authoritative = Array.isArray(data) ? data[0] : data;
      if (authoritative?.counter_data) {
        setCounters((items) => items.map((item) => item.id === counterId ? {
          ...item, counter_data: authoritative.counter_data,
          customization: authoritative.customization ?? item.customization,
          version: authoritative.version ?? item.version,
        } : item));
        versions.current.set(counterId, Number(authoritative.version ?? versions.current.get(counterId) ?? 0));
      }
       return authoritative;
     },
     patchCounter: (counterId, patch) => {
       const current = counters.find((counter) => counter.id === counterId);
       if (!current) return Promise.reject(new Error("Shared counter is no longer available."));
       return rpc("perform_live_group_operation", { target_group: selectedGroupId, target_counter: counterId, command: "counter_save", base_version: current.version ?? 0, base_folder_id: current.folder_id || null, proposed_folder_id: current.folder_id || null, changed_fields: Object.keys(patch), base_counter: current.counter_data || {}, proposed_counter: { ...current.counter_data, ...patch }, base_customization: current.customization || {}, proposed_customization: current.customization || {}, base_script: current.script || null, proposed_script: current.script || null, action_permissions: Object.keys(patch).map((key) => ({ plusStep: "settings_posstep", minusStep: "settings_negstep", min: "settings_min", max: "settings_max", goalDirection: "settings_goaldir", color: "settings_color" }[key])).filter(Boolean) }, `patch:${counterId}:${Object.keys(patch).join(",")}`);
     },
     saveCustomization: (counterId, customization, baseCustomization, permission) => {
       const current = counters.find((counter) => counter.id === counterId);
       return rpc("perform_live_group_operation", { target_group: selectedGroupId, target_counter: counterId, command: "customization_save", base_version: current?.version ?? 0, base_folder_id: current?.folder_id || null, proposed_folder_id: current?.folder_id || null, changed_fields: ["customization"], base_counter: current?.counter_data || {}, proposed_counter: current?.counter_data || {}, base_customization: baseCustomization || {}, proposed_customization: customization, base_script: current?.script || null, proposed_script: current?.script || null, action_permissions: [permission] }, `customization:${counterId}`);
     },
     scriptEdit: async (counterId, language, source) => {
       const current = counters.find((counter) => counter.id === counterId);
         return rpc("perform_live_group_operation", { target_group: selectedGroupId, target_counter: counterId, command: "script_edit", base_version: versions.current.get(counterId) ?? current?.version ?? 0, base_folder_id: current?.folder_id || null, proposed_folder_id: current?.folder_id || null, changed_fields: ["script"], base_counter: current?.counter_data || {}, proposed_counter: current?.counter_data || {}, base_customization: current?.customization || {}, proposed_customization: current?.customization || {}, base_script: current?.script || null, proposed_script: { language, source, enabled: false }, action_permissions: [language === "javascript" ? "scripting_js" : "scripting_ts"] }, `script-edit:${counterId}`);
     },
     authorizeSharedScriptRun: async (counterId, language) => {
       if (!permissions.has(language === "javascript" ? "scripting_js" : "scripting_ts")) return { status: "denied" };
       const { data, error: authorizationError } = await supabase.rpc("authorize_live_group_script_run", { target_counter: counterId, script_language: language });
       if (authorizationError) throw authorizationError;
       return Array.isArray(data) ? data[0] : data;
    },
  };
}
