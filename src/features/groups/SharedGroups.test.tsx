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
import userEvent from "@testing-library/user-event";
import { afterEach, expect, test, vi } from "vitest";
import { SharedCountersView } from "./SharedGroups";

const counter = (name: string) => ({
  id: crypto.randomUUID(), name, value: 0, start: 0, plusStep: 1,
  minusStep: 1, goals: [], goalDirection: "more", min: null, max: null,
  color: "#ef6a47",
});

const groupsModel = () => ({
  groups: [{ id: "group-1", name: "Team tallies" }],
  selectedGroupId: "group-1",
  selectedGroup: { id: "group-1", name: "Team tallies" },
  selectedFolders: [
    { id: "folder-1", group_id: "group-1", parent_id: null, name: "Projects" },
    { id: "folder-2", group_id: "group-1", parent_id: null, name: "Archive" },
  ],
  selectedCounters: [
    { id: "shared-root", group_id: "group-1", folder_id: null, counter_data: counter("Root tally"), script: { language: "tallyscript", source: "Tally.value.add()", enabled: true } },
    { id: "shared-child", group_id: "group-1", folder_id: "folder-1", counter_data: counter("Project tally"), script: { language: "javascript", source: "Tally.value.add()", enabled: true } },
  ],
  selectedEvents: [{ id: 1, group_id: "group-1", counter_id: "shared-root", actor_id: "user-1", action_key: "add", created_at: "2026-08-02T20:00:00Z" }],
  members: [{ group_id: "group-1", user_id: "user-1", username: "Sam" }],
  permissions: new Set(["add", "subtract", "reset", "settings_folder", "create_folder", "delete_folder"]),
  membership: { permission_preset: "custom" },
  setSelectedGroupId: vi.fn(), createCounter: vi.fn(), deleteCounter: vi.fn(),
  action: vi.fn(), saveCounter: vi.fn().mockResolvedValue(undefined), saveCustomization: vi.fn().mockResolvedValue(undefined), moveCounter: vi.fn().mockResolvedValue(undefined),
  moveFolder: vi.fn().mockResolvedValue(undefined),
  createFolder: vi.fn().mockResolvedValue(undefined), deleteFolder: vi.fn().mockResolvedValue(undefined),
  scriptOperation: vi.fn().mockResolvedValue({ counter_data: counter("Root tally"), customization: {}, version: 1 }),
  authorizeSharedScriptRun: vi.fn((_counterId, language) => Promise.resolve({ status: "authorized", script: { language, source: "", enabled: false }, counter_data: counter("Root tally"), customization: {}, version: 1 })),
});

const dataTransfer = () => {
  const values = new Map<string, string>();
  return {
    effectAllowed: "",
    setData(type, value) { values.set(type, value); },
    getData(type) { return values.get(type) || ""; },
  };
};

afterEach(() => vi.restoreAllMocks());

test("opens shared folders and moves counters into them by dragging", async () => {
  const groups = groupsModel() as any;
  const user = userEvent.setup();
  const { container } = render(<SharedCountersView groups={groups} />);
  const folder = container.querySelector(".folder-tile")!;
  const transfer = dataTransfer();

  fireEvent.dragStart(container.querySelector(".counter-card")!, { dataTransfer: transfer });
  fireEvent.dragOver(folder, { dataTransfer: transfer });
  fireEvent.drop(folder, { dataTransfer: transfer });
  expect(groups.moveCounter).toHaveBeenCalledWith("shared-root", "folder-1");

  await user.click(folder);
  expect(screen.getByRole("heading", { name: "Project tally" })).toBeVisible();
});

test("keeps valid groups visible beside malformed groups and denies stale embed access without mutations", async () => {
  const groups = groupsModel() as any;
  groups.invalidGroups = [{ id: "bad", name: "Broken group" }];
  groups.prepareEmbedCounter = vi.fn().mockRejectedValue(new Error("This shared counter is no longer available for public embedding."));
  groups.permissions.clear();
  const action = groups.action;
  const activity = groups.selectedEvents;
  render(<SharedCountersView groups={groups} />);
  expect(screen.getByRole("alert")).toHaveTextContent(/could not be loaded/i);
  fireEvent.click(screen.getAllByTitle("Embed")[0]);
  await waitFor(() => expect(screen.getAllByRole("alert").at(-1)).toHaveTextContent(/no longer available/i));
  expect(groups.prepareEmbedCounter).toHaveBeenCalledWith("shared-root");
  expect(action).not.toHaveBeenCalled();
  expect(groups.saveCounter).not.toHaveBeenCalled();
  expect(groups.selectedEvents).toBe(activity);
});

test("commits folder and counter edits through one immutable save", async () => {
  const groups = groupsModel() as any;
  groups.permissions = new Set(["settings_name", "settings_exactvalue", "settings_folder"]);
  groups.selectedCounters = [{ ...groups.selectedCounters[0], version: 4, customization: { parts: {} }, script: { language: "tallyscript", source: "add", enabled: false } }];
  const user = userEvent.setup();
  render(<SharedCountersView groups={groups} />);
  await user.click(screen.getByTitle("Settings"));
  await user.clear(screen.getByLabelText("Counter name"));
  await user.type(screen.getByLabelText("Counter name"), "Renamed");
  await user.selectOptions(screen.getByLabelText("Folder"), "folder-1");
  await user.click(screen.getByRole("button", { name: "Save counter" }));
  expect(groups.saveCounter).toHaveBeenCalledTimes(1);
  expect(groups.moveCounter).not.toHaveBeenCalled();
  expect(groups.saveCustomization || vi.fn()).not.toHaveBeenCalled();
  expect(groups.saveCounter.mock.calls[0][2]).toEqual(expect.objectContaining({ baseVersion: 4, baseFolderId: null, proposedFolderId: "folder-1", baseRecord: expect.any(Object), proposedScript: expect.any(Object) }));
});

test("nests shared folders by dragging one onto another", () => {
  const groups = groupsModel();
  const { container } = render(<SharedCountersView groups={groups} />);
  const [projects, archive] = [...container.querySelectorAll(".folder-tile")];
  const transfer = dataTransfer();

  fireEvent.dragStart(projects, { dataTransfer: transfer });
  fireEvent.dragOver(archive, { dataTransfer: transfer });
  fireEvent.drop(archive, { dataTransfer: transfer });

  expect(groups.moveFolder).toHaveBeenCalledWith("folder-1", "folder-2");
  expect(groups.moveCounter).not.toHaveBeenCalled();
});

test("creates and deletes shared folders when permissions allow it", async () => {
  vi.spyOn(window, "confirm").mockReturnValue(true);
  const groups = groupsModel();
  const user = userEvent.setup();
  render(<SharedCountersView groups={groups} />);

  await user.click(screen.getByRole("button", { name: /new folder/i }));
  await user.type(screen.getByLabelText("Folder name"), "Archive");
  await user.click(screen.getByRole("button", { name: /create folder/i }));
  expect(groups.createFolder).toHaveBeenCalledWith("group-1", "Archive", null);

  await user.click(screen.getByRole("button", { name: "Delete folder Projects" }));
  expect(groups.deleteFolder).toHaveBeenCalledWith("folder-1");
});

test("shows the realtime shared-counter audit log", async () => {
  const user = userEvent.setup();
  render(<SharedCountersView groups={groupsModel()} />);

  await user.click(screen.getByRole("button", { name: /activity/i }));
  expect(screen.getByRole("heading", { name: "Shared activity" })).toBeVisible();
  expect(screen.getByText("Sam")).toBeVisible();
  expect(screen.getByText(/add · root tally/i)).toBeVisible();
});

test("registers and unregisters one aggregate shutdown callback", () => {
  const events: CustomEvent[] = [];
  const listener = (event: Event) => events.push(event as CustomEvent);
  window.addEventListener("tally-register-shutdown", listener);
  const view = render(<SharedCountersView groups={groupsModel()} />);
  view.unmount();
  window.removeEventListener("tally-register-shutdown", listener);
  expect(events).toHaveLength(2);
  expect(events[0].detail.type).toBe("register");
  expect(events[1].detail.type).toBe("unregister");
});

test("script-only permission does not enable direct counter controls", async () => {
  const groups = groupsModel();
  groups.permissions = new Set(["scripting_ts"]);
  groups.selectedFolders = [];
  render(<SharedCountersView groups={groups} />);
  expect(screen.getByTitle("Settings")).toBeEnabled();
  expect(screen.getByRole("button", { name: /\+1/ })).toBeDisabled();
  expect(screen.getByTitle("Reset")).toBeDisabled();
  await userEvent.setup().click(screen.getAllByTitle("Settings")[0]);
  await userEvent.setup().click(screen.getByRole("button", { name: "Scripting" }));
  expect(screen.getByRole("button", { name: "Run script" })).toBeEnabled();
});

test("recorded JavaScript cannot run with only TallyScript permission", async () => {
  const groups = groupsModel();
  groups.selectedCounters = [{ ...groups.selectedCounters[1], folder_id: null }];
  groups.permissions = new Set(["scripting_ts"]);
  render(<SharedCountersView groups={groups} />);
  await userEvent.setup().click(screen.getByTitle("Settings"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Scripting" }));
  expect(screen.getByRole("button", { name: "Run script" })).toBeDisabled();
  expect(groups.scriptOperation).not.toHaveBeenCalled();
});

test("enabled shared scripts load stopped and do not auto-run", async () => {
  const groups = groupsModel();
  groups.permissions = new Set(["scripting_ts"]);
  render(<SharedCountersView groups={groups} />);
  await userEvent.setup().click(screen.getByTitle("Settings"));
  await userEvent.setup().click(screen.getByRole("button", { name: "Scripting" }));
  expect(screen.getByRole("button", { name: "Run script" })).toBeVisible();
  expect(screen.queryByRole("button", { name: "Stop script" })).toBeNull();
  expect(groups.action).not.toHaveBeenCalled();
});

test("aggregate shutdown callback returns an awaitable completion", async () => {
  let callback: (() => Promise<unknown>) | undefined;
  const listener = (event: Event) => { callback = (event as CustomEvent).detail.callback; };
  window.addEventListener("tally-register-shutdown", listener);
  const groups = groupsModel();
  render(<SharedCountersView groups={groups} />);
  window.removeEventListener("tally-register-shutdown", listener);
  expect(callback).toBeTypeOf("function");
  await expect(callback?.()).resolves.toEqual([]);
});

test("runs two shared counters independently and aggregate-stops the remaining one", async () => {
  const groups = groupsModel();
  groups.selectedFolders = [];
  groups.permissions = new Set(["scripting_ts"]);
  groups.selectedCounters = groups.selectedCounters.map((item) => ({ ...item, folder_id: null, script: { language: "tallyscript", source: "sleep 100000 ms", enabled: false } }));
  groups.action.mockResolvedValue(undefined);
  const user = userEvent.setup();
  let aggregate: any;
  const listener = (event: Event) => { aggregate = (event as CustomEvent).detail.callback; };
  window.addEventListener("tally-register-shutdown", listener);
  render(<SharedCountersView groups={groups} />);
  await user.click(screen.getAllByTitle("Settings")[0]);
  await user.click(screen.getByRole("button", { name: "Scripting" }));
  await user.click(screen.getByRole("button", { name: "Run script" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getAllByTitle("Settings")[1]);
  await user.click(screen.getByRole("button", { name: "Scripting" }));
  await user.click(screen.getByRole("button", { name: "Run script" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getAllByTitle("Settings")[0]);
  await user.click(screen.getByRole("button", { name: "Scripting" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop script" })).toBeVisible());
  await user.click(screen.getByRole("button", { name: "Stop script" }));
  await user.click(screen.getByRole("button", { name: "Done" }));
  await user.click(screen.getAllByTitle("Settings")[1]);
  await user.click(screen.getByRole("button", { name: "Scripting" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop script" })).toBeVisible());
  await aggregate();
  expect(groups.action).toHaveBeenCalledWith(groups.selectedCounters[1].id, "scripting_ts", { enabled: false });
  window.removeEventListener("tally-register-shutdown", listener);
});

test("rapid same-counter replacement ignores stale finally", async () => {
  const groups = groupsModel();
  groups.selectedFolders = [];
  groups.selectedCounters = [groups.selectedCounters[0]];
  groups.permissions = new Set(["scripting_ts"]);
  groups.selectedCounters[0].script = { language: "tallyscript", source: "sleep 100000 ms", enabled: false };
  groups.action.mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<SharedCountersView groups={groups} />);
  const open = async () => { await user.click(screen.getByTitle("Settings")); await user.click(screen.getByRole("button", { name: "Scripting" })); };
  await open(); await user.click(screen.getByRole("button", { name: "Run script" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop script" })).toBeVisible());
  await user.click(screen.getByRole("button", { name: "Stop script" }));
  const stoppedCalls = groups.action.mock.calls.filter((call) => call[1] === "scripting_ts" && call[2]?.enabled === false).length;
  await user.click(screen.getByRole("button", { name: "Run script" }));
  await Promise.resolve();
  expect(screen.getByRole("button", { name: "Stop script" })).toBeVisible();
  expect(groups.action.mock.calls.filter((call) => call[1] === "scripting_ts" && call[2]?.enabled === false)).toHaveLength(stoppedCalls);
});

test("stopping during sleep prevents later proposals and returns Run", async () => {
  const groups = groupsModel();
  groups.selectedFolders = [];
  groups.selectedCounters = [{ ...groups.selectedCounters[0], folder_id: null, script: { language: "tallyscript", source: "sleep 100000 ms\nadd", enabled: false } }];
  groups.permissions = new Set(["scripting_ts"]);
  groups.action.mockResolvedValue(undefined);
  const user = userEvent.setup();
  render(<SharedCountersView groups={groups} />);
  await user.click(screen.getByTitle("Settings")); await user.click(screen.getByRole("button", { name: "Scripting" }));
  await user.click(screen.getByRole("button", { name: "Run script" }));
  await waitFor(() => expect(screen.getByRole("button", { name: "Stop script" })).toBeVisible());
  await user.click(screen.getByRole("button", { name: "Stop script" }));
  expect(groups.scriptOperation).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.getByRole("button", { name: "Run script" })).toBeVisible());
   expect(groups.action).not.toHaveBeenCalledWith(groups.selectedCounters[0].id, "scripting_ts", { enabled: false });
});

test("permission revocation before a proposal stops the invocation with guidance", async () => {
  const groups = groupsModel();
  groups.selectedFolders = [];
  groups.selectedCounters = [{ ...groups.selectedCounters[0], folder_id: null, script: { language: "tallyscript", source: "sleep 100 ms\nadd", enabled: false } }];
  groups.permissions = new Set(["scripting_ts"]);
  groups.action.mockResolvedValue(undefined);
  const user = userEvent.setup();
  const { rerender } = render(<SharedCountersView groups={groups} />);
  await user.click(screen.getByTitle("Settings")); await user.click(screen.getByRole("button", { name: "Scripting" }));
  await user.click(screen.getByRole("button", { name: "Run script" }));
  groups.permissions = new Set(); rerender(<SharedCountersView groups={groups} />);
  await new Promise((resolve) => setTimeout(resolve, 150));
   expect(groups.action).not.toHaveBeenCalledWith(groups.selectedCounters[0].id, "scripting_ts", { enabled: false });
  expect(groups.scriptOperation).not.toHaveBeenCalled();
});

test("version conflict stops the script and shows retry guidance", async () => {
  const groups = groupsModel();
  groups.selectedFolders = [];
  groups.selectedCounters = [{ ...groups.selectedCounters[0], folder_id: null, script: { language: "tallyscript", source: "add", enabled: false } }];
  groups.permissions = new Set(["scripting_ts"]);
  groups.action.mockResolvedValue(undefined);
  groups.scriptOperation.mockRejectedValue(new Error("Version conflict: the counter changed; reload and retry."));
  const user = userEvent.setup();
  render(<SharedCountersView groups={groups} />);
  await user.click(screen.getByTitle("Settings")); await user.click(screen.getByRole("button", { name: "Scripting" }));
  await user.click(screen.getByRole("button", { name: "Run script" }));
  await waitFor(() => expect(screen.getAllByText(/changed|reload|retry/i).length).toBeGreaterThan(0));
  expect(screen.getByRole("button", { name: "Run script" })).toBeVisible();
   expect(groups.action).not.toHaveBeenCalledWith(groups.selectedCounters[0].id, "scripting_ts", { enabled: false });
});
