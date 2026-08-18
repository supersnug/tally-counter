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
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";

const supabaseMock = vi.hoisted(() => ({
  rpc: vi.fn().mockResolvedValue({ data: 2, error: null }),
  from: vi.fn(() => {
    const chain: any = { select: () => chain, eq: () => chain, in: () => chain, order: () => chain, limit: () => chain, maybeSingle: () => Promise.resolve({ data: null, error: null }) };
    return chain;
  }),
  channel: vi.fn(() => { const channel: any = { on: () => channel, subscribe: vi.fn() }; return channel; }),
  removeChannel: vi.fn(),
  auth: {
    getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: "user-1" }, access_token: "token" } } }),
    getUser: vi.fn().mockResolvedValue({ data: { user: { id: "user-1" } }, error: null }),
    onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
  },
}));
vi.mock("../lib/supabase.js", () => ({ supabase: supabaseMock, supabaseConfigured: true, supabaseUrl: "https://example.test", supabasePublishableKey: "key" }));
import { CountersPage } from "../pages/CountersPage";

const memoryStorage = () => {
  const values = new Map<string, string>();
  let armed = false;
  return {
    get length() { return values.size; },
    key: (index: number) => [...values.keys()][index] ?? null,
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
    setItem: (key: string, value: string) => { if (armed) throw new Error("quota"); values.set(key, value); },
    arm: () => { armed = true; },
    disarm: () => { armed = false; },
  } as Storage & { arm: () => void; disarm: () => void };
};

afterEach(() => vi.restoreAllMocks());
beforeEach(() => { localStorage.clear(); supabaseMock.rpc.mockReset().mockResolvedValue({ data: 2, error: null }); });

test("preserves modified brand clicks without opening shutdown", () => {
  render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  const brand = screen.getByRole("link", { name: /tally/i });
  fireEvent.click(brand, { button: 0, ctrlKey: true });
  expect(brand).toHaveAttribute("href", import.meta.env.BASE_URL);
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("uncontrolled pagehide does not show a navigation modal", () => {
  render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  window.dispatchEvent(new Event("pagehide"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("pagehide durably stops every persisted script record", () => {
  localStorage.setItem("tally-scripts", JSON.stringify({
    first: { language: "tallyscript", source: "Tally.value.add()", enabled: true },
    second: { language: "javascript", source: "Tally.value.add()", enabled: true },
  }));
  render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  window.dispatchEvent(new Event("pagehide"));
  const saved = JSON.parse(localStorage.getItem("tally-scripts") || "{}");
  expect(Object.values(saved).every((script: any) => script.enabled === false)).toBe(true);
});

test("ordinary brand click preserves modified and new-tab semantics", () => {
  render(<CountersPage theme="light" onThemeChange={vi.fn()} />);
  const brand = screen.getByRole("link", { name: /tally/i });
  fireEvent.click(brand, { button: 1 });
  fireEvent.click(brand, { button: 0, metaKey: true });
  expect(screen.queryByRole("dialog")).toBeNull();
});

test("signed-in acknowledgment removes the stamped journal and navigates", async () => {
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} />);
  await new Promise((resolve) => setTimeout(resolve, 0));
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(navigateTo).toHaveBeenCalled();
  expect(supabaseMock.rpc).toHaveBeenCalledWith("update_user_data_revision", expect.objectContaining({ next_counters: expect.anything(), next_preferences: expect.anything(), next_tally_super: expect.anything(), next_scripts: expect.anything(), next_folders: expect.anything() }));
});

test("timeout keeps the journal, shows both actions, and ignores late completion", async () => {
  let resolveLate: (value: any) => void = () => {};
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} shutdownTimeoutMs={1} />);
  await waitFor(() => expect(screen.getByRole("link", { name: /tally/i })).toBeVisible());
  await waitFor(() => expect(JSON.parse(localStorage.getItem("tally-sync-journal") || "[]")).toHaveLength(0));
  supabaseMock.rpc.mockImplementation(() => new Promise((resolve) => { resolveLate = resolve; }));
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  expect(await screen.findByRole("heading", { name: "Stopping scripts and saving" })).toBeVisible();
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled());
  expect(screen.getByRole("button", { name: "Continue" })).toBeEnabled();
  expect(JSON.parse(localStorage.getItem("tally-sync-journal") || "[]")).toHaveLength(1);
  resolveLate({ data: 3, error: null });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(navigateTo).not.toHaveBeenCalled();
  expect(JSON.parse(localStorage.getItem("tally-sync-journal") || "[]")).toHaveLength(1);
});

test("RPC error Retry reuses operation ID and acknowledges once", async () => {
  let clickCalls = 0;
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} />);
  await waitFor(() => expect(screen.getByRole("link", { name: /tally/i })).toBeVisible());
  await new Promise((resolve) => setTimeout(resolve, 20));
  supabaseMock.rpc.mockReset().mockImplementation(() => {
    clickCalls += 1;
    return Promise.resolve(clickCalls === 1 ? { data: null, error: { message: "temporary failure" } } : { data: 4, error: null });
  });
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  await screen.findByRole("heading", { name: "Stopping scripts and saving" });
  const firstOperation = supabaseMock.rpc.mock.calls.map((call) => call[1]?.operation_id).find(Boolean);
  await waitFor(() => expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled());
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(navigateTo).toHaveBeenCalledTimes(1));
  expect(supabaseMock.rpc.mock.calls.at(-1)?.[1]?.operation_id).toBe(firstOperation);
  expect(localStorage.getItem("tally-sync-journal")).toBe("[]");
});

test("RPC error Continue navigates while retaining the journal", async () => {
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} />);
  await waitFor(() => expect(screen.getByRole("link", { name: /tally/i })).toBeVisible());
  await waitFor(() => expect(JSON.parse(localStorage.getItem("tally-sync-journal") || "[]")).toHaveLength(0));
  supabaseMock.rpc.mockResolvedValue({ data: null, error: { message: "offline" } });
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  await screen.findByRole("heading", { name: "Stopping scripts and saving" });
  fireEvent.click(screen.getByRole("button", { name: "Continue" }));
  expect(navigateTo).toHaveBeenCalledTimes(1);
  expect(JSON.parse(localStorage.getItem("tally-sync-journal") || "[]")).toHaveLength(1);
});

test("shutdown storage failure enables Retry, then persists and navigates", async () => {
  const storage = memoryStorage();
  const navigateTo = vi.fn();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={navigateTo} shutdownStorage={storage} />);
  storage.arm();
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  await screen.findByRole("heading", { name: "Stopping scripts and saving" });
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  expect(screen.getByRole("button", { name: "Continue" })).toBeDisabled();
  expect(supabaseMock.rpc).not.toHaveBeenCalled();
  storage.disarm();
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  await waitFor(() => expect(navigateTo).toHaveBeenCalledTimes(1));
  expect(JSON.parse(storage.getItem("tally-sync-journal") || "[]")).toHaveLength(0);
});

test("repeated shutdown storage failures keep the journal absent", async () => {
  const storage = memoryStorage();
  storage.arm();
  render(<CountersPage theme="light" onThemeChange={vi.fn()} navigateTo={vi.fn()} shutdownStorage={storage} />);
  fireEvent.click(screen.getByRole("link", { name: /tally/i }));
  await screen.findByRole("heading", { name: "Stopping scripts and saving" });
  fireEvent.click(screen.getByRole("button", { name: "Retry" }));
  expect(screen.getByRole("button", { name: "Retry" })).toBeEnabled();
  expect(storage.getItem("tally-sync-journal")).toBeNull();
});
