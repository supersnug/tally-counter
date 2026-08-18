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
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const USER = "11111111-1111-4111-8111-111111111111";
const GROUP = "22222222-2222-4222-8222-222222222222";
const COUNTER = "33333333-3333-4333-8333-333333333333";
const { rpc, channel, subscriptions } = vi.hoisted(() => {
  const subscriptions: any[] = [];
  const channel = { on: vi.fn((_event, filter, callback) => { subscriptions.push({ filter, callback }); return channel; }), subscribe: vi.fn((callback) => { callback("SUBSCRIBED"); return channel; }), unsubscribe: vi.fn(async () => undefined) };
  const workspace = { groups: [{ id: "22222222-2222-4222-8222-222222222222", name: "Team", ownerId: "11111111-1111-4111-8111-111111111111", members: [{ userId: "11111111-1111-4111-8111-111111111111", username: "sam", permissionPreset: "full_access", customPermissions: [] }], counters: [{ id: "33333333-3333-4333-8333-333333333333", version: 2, counterData: { name: "Count", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#fff" }, customization: { parts: {} }, script: { language: "tallyscript", source: "add", enabled: false } }], folders: [], activity: [] }], invitations: [] };
  const rpc: any = vi.fn(async (name) => name === "get_live_groups_workspace" ? { data: workspace, error: null } : { data: { status: "accepted", operationId: "44444444-4444-4444-8444-444444444444", counterId: COUNTER, version: 3 }, error: null });
  return { rpc, channel, subscriptions };
});
vi.mock("../lib/supabase", () => ({ supabase: { rpc, channel: vi.fn(() => channel), removeChannel: vi.fn() } }));

import { useSharedGroups } from "../features/groups/useSharedGroups";

describe("production Live Groups transport", () => {
  beforeEach(() => { rpc.mockClear(); channel.on.mockClear(); subscriptions.length = 0; localStorage.clear(); });

  it("registers the seven invalidation tables and exact lifecycle payloads", async () => {
    const { result } = renderHook(() => useSharedGroups({ user: { id: USER } }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_live_groups_workspace"));
    expect(channel.on).toHaveBeenCalledTimes(7);
    await act(async () => {
      await result.current.createGroup("Team");
      await result.current.invite(GROUP, "other@example.com", "count_only", []);
      await result.current.respondInvite("17", false);
      await result.current.setPermissions(GROUP, USER, "custom", ["add"]);
      await result.current.removeMember(GROUP, USER);
    });
    expect(rpc).toHaveBeenCalledWith("create_live_group", expect.objectContaining({ group_name: "Team", operation_id: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("invite_live_group_member", expect.objectContaining({ target_group: GROUP, recipient_identifier: "other@example.com", operation_id: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("respond_live_group_invite", expect.objectContaining({ invite_id: "17", accept_invite: false, operation_id: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("set_live_group_member_permissions", expect.objectContaining({ target_group: GROUP, target_user: USER, operation_id: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("remove_live_group_member", expect.objectContaining({ target_group: GROUP, target_user: USER, operation_id: expect.any(String) }));
    await act(async () => { await result.current.action(COUNTER, "add", 1); });
    const firstOperation = rpc.mock.calls.filter((call) => call[0] === "perform_live_group_operation").at(-1)?.[1]?.operation_id;
    await act(async () => { await result.current.action(COUNTER, "add", 1); });
    const secondOperation = rpc.mock.calls.filter((call) => call[0] === "perform_live_group_operation").at(-1)?.[1]?.operation_id;
    expect(firstOperation).toEqual(expect.any(String));
    expect(secondOperation).toEqual(expect.any(String));
    expect(secondOperation).not.toBe(firstOperation);
    expect(rpc).toHaveBeenCalledWith("perform_live_group_operation", expect.objectContaining({ command: "add", changed_fields: ["add"], base_folder_id: null, proposed_folder_id: null }));
    await act(async () => { await result.current.respondInvite("17", false); });
    expect(JSON.parse(localStorage.getItem("tally-live-group-operations") || "[]").some((entry) => entry.name === "respond_live_group_invite")).toBe(false);
  });

  it("uses coherent counter/script payloads and exact script runtime adapters", async () => {
    const { result } = renderHook(() => useSharedGroups({ user: { id: USER } }));
    await waitFor(() => expect(result.current.selectedCounters).toHaveLength(1));
    await act(async () => {
      await result.current.saveCounter(COUNTER, { name: "Count", value: 4, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#fff" }, { baseVersion: 2, baseRecord: { name: "Count", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#fff" }, baseScript: { language: "tallyscript", source: "add", enabled: false }, proposedScript: { language: "tallyscript", source: "add", enabled: false } });
      await result.current.authorizeSharedScriptRun(COUNTER, "tallyscript");
      await result.current.scriptOperation(COUNTER, "tallyscript", { source: "add", operationId: "55555555-5555-4555-8555-555555555555", counterId: COUNTER, authority: "group" });
    });
    expect(rpc).toHaveBeenCalledWith("perform_live_group_operation", expect.objectContaining({ command: "counter_save", changed_fields: expect.arrayContaining(["value"]), action_permissions: expect.any(Array), operation_id: expect.any(String) }));
    expect(rpc).toHaveBeenCalledWith("authorize_live_group_script_run", { target_counter: COUNTER, script_language: "tallyscript" });
    const scriptCall = rpc.mock.calls.find((call) => call[0] === "perform_live_group_script_operation");
    expect(scriptCall?.[1]).toEqual(expect.objectContaining({ target_counter: COUNTER, script_language: "tallyscript", proposal: expect.objectContaining({ operationId: scriptCall?.[1]?.operation_id, enabled: false }), expected_version: expect.any(Number), operation_id: expect.any(String) }));
  });

  it("sends independent normalized goal permissions through the versioned save seam", async () => {
    const { result } = renderHook(() => useSharedGroups({ user: { id: USER } }));
    await waitFor(() => expect(result.current.selectedCounters).toHaveLength(1));
    const base = { name: "Count", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [1, 2], goalDirection: "more", min: null, max: null, color: "#fff" };
    const proposed = { ...base, goals: [2, 1, 3] };
    await act(async () => { await result.current.saveCounter(COUNTER, proposed, { baseVersion: 2, baseRecord: base }); });
    const call = rpc.mock.calls.find((entry) => entry[0] === "perform_live_group_operation" && entry[1]?.command === "counter_save");
    expect(call?.[1]).toEqual(expect.objectContaining({ base_version: 2, changed_fields: ["goals"], action_permissions: ["settings_addgoal"], operation_id: expect.any(String) }));
    await act(async () => { await result.current.saveCounter(COUNTER, { ...base, goals: [2, 3] }, { baseVersion: 2, baseRecord: base }); });
    const calls = rpc.mock.calls.filter((entry) => entry[0] === "perform_live_group_operation" && entry[1]?.command === "counter_save");
    expect(calls.at(-1)?.[1]).toEqual(expect.objectContaining({ action_permissions: ["settings_addgoal", "settings_removegoal"] }));
  });

  it("does not replay malformed or cross-account journal entries", async () => {
    localStorage.setItem("tally-live-group-operations", JSON.stringify([{ userId: "99999999-9999-4999-8999-999999999999", operationId: "66666666-6666-4666-8666-666666666666", name: "delete_everything", args: {}, stage: "pending" }]));
    renderHook(() => useSharedGroups({ user: { id: USER } }));
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(rpc).not.toHaveBeenCalledWith("delete_everything", expect.anything());
  });
});
