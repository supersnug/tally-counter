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
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const harness = vi.hoisted(() => {
  const counter = { id: "counter-1", name: "Visible counter", value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47", localOnly: false };
  const rpcCalls: any[] = [];
  const state = { mode: "ack" as "ack" | "error" | "conflict" | "unknown" };
  const supabase = {
    auth: {
      getSession: vi.fn(async () => ({ data: { session: { user: { id: "account-1" } } } })),
      onAuthStateChange: vi.fn((callback: (event: string, session: any) => void) => {
        queueMicrotask(() => callback("SIGNED_IN", { user: { id: "account-1" } }));
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      }),
      getUser: vi.fn(async () => ({ data: { user: { id: "account-1" } }, error: null })),
      signOut: vi.fn(async () => ({ error: null })),
    },
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: vi.fn(async () => ({ data: null, error: null })) })),
      })),
    })),
    rpc: vi.fn(async (name: string, args: any) => {
      const call = { name, args, journalAtDispatch: localStorage.getItem("tally-sync-journal") };
      rpcCalls.push(call);
      if (state.mode === "error") return { data: null, error: { message: "validation failed" } };
      if (state.mode === "conflict") return { data: null, error: { message: "revision conflict" } };
      if (state.mode === "unknown") throw new Error("offline");
      return { data: 5, error: null };
    }),
  };
  return { counter, rpcCalls, state, supabase };
});

vi.mock("../lib/supabase", () => ({ supabase: harness.supabase, supabaseConfigured: true }));
vi.mock("../features/sharing/CopySharing", () => ({
  CopySharePrompt: () => null,
  ShareCounterModal: () => null,
  useCopySharing: () => ({ incoming: [], outcomes: [], outgoing: [], refresh: vi.fn() }),
}));
vi.mock("../features/groups/SharedGroups", () => ({ GroupInvitePrompt: () => null, SharedCountersView: () => null }));
vi.mock("../features/groups/useSharedGroups", () => ({ useSharedGroups: () => ({ groups: [], refresh: vi.fn() }) }));

import { CountersPage } from "../pages/CountersPage";

const renderPreloaded = async () => {
  localStorage.setItem("tally-counter-bundle", JSON.stringify({ version: 1, state: { active: [harness.counter], retained: [], scripts: {}, customizations: {} } }));
  const view = render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  await waitFor(() => expect(screen.getByText("Visible counter")).toBeInTheDocument());
  await waitFor(() => expect(harness.rpcCalls.length).toBeGreaterThan(0));
  harness.rpcCalls.length = 0;
  return view;
};

const mutate = async () => {
  fireEvent.click(document.querySelector("[data-counter-part=\"add\"]")!);
  await waitFor(() => expect(harness.rpcCalls.length).toBeGreaterThan(0), { timeout: 2000 });
  return harness.rpcCalls.at(-1)!;
};

describe("CountersPage ordinary synchronization", () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    harness.rpcCalls.length = 0;
    harness.state.mode = "ack";
    vi.clearAllMocks();
  });

  it("journals before dispatches and removes only after matching acknowledgement", async () => {
    await renderPreloaded();
    const call = await mutate();
    const journal = JSON.parse(call.journalAtDispatch);
    expect(journal).toHaveLength(1);
    expect(journal[0]).toMatchObject({ accountId: "account-1", sessionGeneration: expect.any(Number), baseRevision: 5, digest: expect.any(String), operationId: expect.any(String), workspace: expect.objectContaining({ next_counters: expect.any(Array) }) });
    expect(call.args.operation_id).toBe(journal[0].operationId);
    expect(call.args.expected_revision).toBe(journal[0].baseRevision);
    expect(call.args.next_counters).toEqual(journal[0].workspace.next_counters);
    await waitFor(() => expect(localStorage.getItem("tally-sync-journal")).toBe("[]"));
  });

  it.each(["error", "conflict"] as const)("retains the exact journal on confirmed %s", async (mode) => {
    await renderPreloaded();
    harness.state.mode = mode;
    const call = await mutate();
    const journal = JSON.parse(call.journalAtDispatch);
    expect(localStorage.getItem("tally-sync-journal")).toBe(call.journalAtDispatch);
    expect(journal[0].operationId).toBe(call.args.operation_id);
    expect(journal[0].workspace).toEqual(expect.objectContaining({ next_counters: call.args.next_counters }));
  });

  it("replays an unknown outcome online with the same operation and payload", async () => {
    await renderPreloaded();
    harness.state.mode = "unknown";
    const first = await mutate();
    const pending = JSON.parse(first.journalAtDispatch)[0];
    harness.state.mode = "ack";
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(harness.rpcCalls.some((call) => call.args.operation_id === pending.operationId)).toBe(true));
    const replay = harness.rpcCalls.find((call) => call.args.operation_id === pending.operationId);
    expect(replay.args).toEqual(expect.objectContaining({ operation_id: pending.operationId, next_counters: pending.workspace.next_counters, next_tally_super: pending.workspace.next_tally_super, next_scripts: pending.workspace.next_scripts }));
    await waitFor(() => expect(localStorage.getItem("tally-sync-journal")).toBe("[]"));
  });

  it("replays the same pending operation after unmount and remount", async () => {
    const firstView = await renderPreloaded();
    harness.state.mode = "unknown";
    const first = await mutate();
    const pending = JSON.parse(first.journalAtDispatch)[0];
    firstView.unmount();
    harness.state.mode = "ack";
    await renderPreloaded();
    await waitFor(() => expect(harness.rpcCalls.some((call) => call.args.operation_id === pending.operationId)).toBe(true), { timeout: 3000 });
    await waitFor(() => expect(localStorage.getItem("tally-sync-journal")).toBe("[]"));
  });
});
