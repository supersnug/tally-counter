import { fireEvent, render, screen } from "@testing-library/react";
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
    { id: "shared-root", group_id: "group-1", folder_id: null, counter_data: counter("Root tally") },
    { id: "shared-child", group_id: "group-1", folder_id: "folder-1", counter_data: counter("Project tally") },
  ],
  selectedEvents: [{ id: 1, group_id: "group-1", counter_id: "shared-root", actor_id: "user-1", action_key: "add", created_at: "2026-08-02T20:00:00Z" }],
  members: [{ group_id: "group-1", user_id: "user-1", username: "Sam" }],
  permissions: new Set(["add", "subtract", "reset", "settings_folder", "create_folder", "delete_folder"]),
  membership: { permission_preset: "custom" },
  setSelectedGroupId: vi.fn(), createCounter: vi.fn(), deleteCounter: vi.fn(),
  action: vi.fn(), moveCounter: vi.fn().mockResolvedValue(undefined),
  moveFolder: vi.fn().mockResolvedValue(undefined),
  createFolder: vi.fn().mockResolvedValue(undefined), deleteFolder: vi.fn().mockResolvedValue(undefined),
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
  const groups = groupsModel();
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
