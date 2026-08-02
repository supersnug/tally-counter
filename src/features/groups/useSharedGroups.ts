import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../lib/supabase";
import type { AnyRecord } from "../counters/model";
import { presetPermissions } from "./permissions";

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

export function useSharedGroups(session) {
  const userId = session?.user?.id;
  const [groups, setGroups] = useState<AnyRecord[]>([]);
  const [members, setMembers] = useState<AnyRecord[]>([]);
  const [counters, setCounters] = useState<AnyRecord[]>([]);
  const [invites, setInvites] = useState<AnyRecord[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!supabase || !userId) {
      setGroups([]); setMembers([]); setCounters([]); setInvites([]);
      return;
    }
    try {
      const [groupResult, inviteResult] = await Promise.all([
        supabase.from("counter_groups").select("id,name,owner_id,created_at").order("created_at"),
        supabase.from("counter_group_invites").select("id,group_id,inviter_id,recipient_id,permission_preset,custom_permissions,created_at").eq("recipient_id", userId),
      ]);
      if (groupResult.error) throw groupResult.error;
      if (inviteResult.error) throw inviteResult.error;
      const nextGroups = Array.isArray(groupResult.data) ? groupResult.data : [];
      const ids = nextGroups.map((group) => group.id);
      let nextMembers: AnyRecord[] = [], nextCounters: AnyRecord[] = [];
      if (ids.length) {
        const [memberResult, counterResult] = await Promise.all([
          supabase.from("counter_group_members").select("group_id,user_id,permission_preset,custom_permissions,joined_at").in("group_id", ids),
          supabase.from("shared_counters").select("id,group_id,counter_data,script,customization,created_by,updated_at").in("group_id", ids).order("updated_at"),
        ]);
        if (memberResult.error) throw memberResult.error;
        if (counterResult.error) throw counterResult.error;
        nextMembers = memberResult.data || [];
        nextCounters = counterResult.data || [];
        const userIds = [...new Set(nextMembers.map((member) => member.user_id))];
        if (userIds.length) {
          const profileResult = await supabase.from("profiles").select("id,username").in("id", userIds);
          if (profileResult.error) throw profileResult.error;
          const names = new Map((profileResult.data || []).map((profile) => [profile.id, profile.username]));
          nextMembers = nextMembers.map((member) => ({ ...member, username: names.get(member.user_id) }));
        }
      }
      setGroups(nextGroups); setMembers(nextMembers); setCounters(nextCounters);
      setInvites(Array.isArray(inviteResult.data) ? inviteResult.data : []); setError("");
      setSelectedGroupId((current) => current && ids.includes(current) ? current : ids[0] || "");
    } catch (loadError) {
      setError(readableError(loadError, "Groups could not be loaded."));
    }
  }, [userId]);

  useEffect(() => {
    void load();
    if (!supabase || !userId) return;
    const channel = supabase.channel(`shared-groups-${userId}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "shared_counters" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "counter_group_invites" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "counter_groups" }, () => void load())
      .on("postgres_changes", { event: "*", schema: "public", table: "counter_group_members" }, () => void load())
      .subscribe();
    const changed = () => void load();
    window.addEventListener("tally-groups-changed", changed);
    return () => { window.removeEventListener("tally-groups-changed", changed); void supabase.removeChannel(channel); };
  }, [userId, load]);

  const rpc = async (name, args) => {
    const { data, error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) throw rpcError;
    await load();
    window.dispatchEvent(new Event("tally-groups-changed"));
    return data;
  };
  const membership = members.find((member) => member.group_id === selectedGroupId && member.user_id === userId);
  const permissions = useMemo(
    () => new Set(presetPermissions(membership?.permission_preset, membership?.custom_permissions)),
    [membership?.permission_preset, JSON.stringify(membership?.custom_permissions)],
  );
  return {
    groups, members, counters, invites, selectedGroupId, setSelectedGroupId,
    selectedGroup: groups.find((group) => group.id === selectedGroupId),
    selectedCounters: counters.filter((counter) => counter.group_id === selectedGroupId),
    permissions, membership, error, load,
    createGroup: (name) => rpc("create_counter_group", { group_name: name }),
    invite: (groupId, identifier, preset, custom) => rpc("invite_counter_group_member", { target_group: groupId, recipient_identifier: identifier, member_preset: preset, member_permissions: preset === "custom" ? custom : null }),
    respondInvite: (id, accept) => rpc("respond_counter_group_invite", { invite_id: id, accept_invite: accept }),
    setPermissions: (groupId, user, preset, custom) => rpc("set_counter_group_member_permissions", { target_group: groupId, target_user: user, member_preset: preset, member_permissions: preset === "custom" ? custom : null }),
    removeMember: (groupId, user) => rpc("remove_counter_group_member", { target_group: groupId, target_user: user }),
    deleteGroup: (groupId) => rpc("delete_counter_group", { target_group: groupId }),
    createCounter: (groupId, counter) => rpc("create_shared_counter", { target_group: groupId, initial_counter: counter }),
    deleteCounter: (counterId) => rpc("delete_shared_counter", { target_counter: counterId }),
    action: (counterId, action, value = null) => rpc("perform_shared_counter_action", { target_counter: counterId, action_key: action, action_value: value }),
  };
}
