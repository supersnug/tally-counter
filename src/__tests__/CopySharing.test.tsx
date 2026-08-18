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
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CopySharePrompt, ShareCounterModal } from "../features/sharing/CopySharing";
import { buildLocalCopyBundle, commitLocalCopyAtomically, readCopyAcceptanceJournal, reconcileCloudWorkspace, shouldBlockCloudConflict, writeCopyAcceptanceJournal } from "../features/sharing/copyAcceptance";

afterEach(cleanup);

describe("copy sharing prompts", () => {
  it("sends only the selected linked data", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const counter = { id: "automated", name: "Automated", value: 4 };
    const script = { language: "tallyscript", source: "add 1" };
    const customization = { parts: { count: { scaleX: 1.2 } } };
    render(
      <ShareCounterModal
        counter={counter}
        script={script}
        customization={customization}
        onSend={onSend}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("Recipient email or username"),
      "friend",
    );
    await user.click(screen.getByText("Include this counter’s script"));
    await user.click(
      screen.getByRole("button", { name: /send counter copy/i }),
    );

    expect(onSend).toHaveBeenCalledWith("friend", "automated", null, { includeScript: true, includeCustomization: false });
  });

  it("requires and forwards the sharing PIN when locked", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn().mockResolvedValue(undefined);
    const counter = { id: "locked", name: "Locked counter", value: 3 };
    render(
      <ShareCounterModal
        counter={counter}
        pinRequired
        onSend={onSend}
        onClose={vi.fn()}
      />,
    );

    await user.type(
      screen.getByLabelText("Recipient email or username"),
      "friend",
    );
    await user.type(screen.getByLabelText("Sharing PIN"), "123456");
    await user.click(
      screen.getByRole("button", { name: /send counter copy/i }),
    );

    expect(onSend).toHaveBeenCalledWith("friend", "locked", "123456", { includeScript: false, includeCustomization: false });
    expect(
      screen.getByText("Include this counter’s script"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/does not have a script to include/i),
    ).toBeInTheDocument();
  });

  it("accepts an incoming counter as local when selected", async () => {
    const user = userEvent.setup();
    const onAccept = vi.fn().mockResolvedValue(undefined);
    const incoming = {
      id: 4,
      senderUsername: "counter_friend",
      counter_data: { name: "Shared laps", value: 12 },
    };
    render(
      <CopySharePrompt
        incoming={incoming}
        outcome={null}
        onAccept={onAccept}
        onDeny={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("checkbox"));
    await user.click(screen.getByRole("button", { name: "Accept copy" }));

    expect(onAccept).toHaveBeenCalledWith(incoming, {
      localOnly: true,
       includeScript: false,
       includeCustomization: false,
    });
  });

  it("acknowledges a sender outcome", async () => {
    const user = userEvent.setup();
    const onAcknowledge = vi.fn().mockResolvedValue(undefined);
    const outcome = {
      id: 8,
      accepted: false,
      recipientUsername: "other_user",
    };
    render(
      <CopySharePrompt
        incoming={null}
        outcome={outcome}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
        onAcknowledge={onAcknowledge}
      />,
    );

    await user.click(screen.getByRole("button", { name: "OK" }));

    expect(onAcknowledge).toHaveBeenCalledWith(outcome);
  });

  it("distinguishes disabled receiving from an explicit decline", () => {
    render(
      <CopySharePrompt
        incoming={null}
        outcome={{
          id: 9,
          accepted: false,
          response_reason: "sharing_disabled",
          recipientUsername: "private_user",
        }}
        onAccept={vi.fn()}
        onDeny={vi.fn()}
        onAcknowledge={vi.fn()}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Copy could not be delivered" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/turned off incoming counter copies/i),
    ).toBeInTheDocument();
  });
});

describe("copy acceptance persistence", () => {
  const storage = () => { const values = new Map<string, string>(); return { getItem: (key: string) => values.get(key) || null, setItem: (key: string, value: string) => values.set(key, value), removeItem: (key: string) => values.delete(key) } as unknown as Storage; };
  const counter = { name: "Copied", value: 2, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" };
  it("journals choices without delivery secrets and stopped local bundle", () => {
    const target = storage();
    const journal = { version: 1 as const, requestId: "123", operationId: "11111111-1111-4111-8111-111111111111", destinationId: "22222222-2222-4222-8222-222222222222", localOnly: true, includeScript: true, includeCustomization: true, stage: "claimed" as const };
    writeCopyAcceptanceJournal(target, journal);
    expect(readCopyAcceptanceJournal(target, "123")).toEqual(journal);
    const bundle = buildLocalCopyBundle({ state: "Pending", mode: "local", operationId: journal.operationId, destinationId: journal.destinationId, offeredScript: true, offeredCustomization: true, counter, script: { language: "javascript", source: "1", enabled: true }, customization: { x: 1 }, deliveryToken: "secret" }, journal);
    expect(bundle.script?.enabled).toBe(false);
    expect(JSON.stringify(target)).not.toContain("secret");
  });
  it("atomically upserts one destination without altering retained bundles", () => {
    const target = storage();
    const next = commitLocalCopyAtomically(target, { active: [], retained: [{ id: "retained" }], scripts: {}, customizations: {} }, buildLocalCopyBundle({ state: "Pending", mode: "local", operationId: "33333333-3333-4333-8333-333333333333", destinationId: "44444444-4444-4444-8444-444444444444", offeredScript: false, offeredCustomization: false, counter }, { version: 1, requestId: "r", operationId: "33333333-3333-4333-8333-333333333333", destinationId: "44444444-4444-4444-8444-444444444444", localOnly: true, includeScript: false, includeCustomization: false, stage: "claimed" }));
    expect(next.active).toHaveLength(1);
    expect(next.retained).toEqual([{ id: "retained" }]);
  });
  it("quarantines journals with extra keys and accepts an offered-but-deselected section", async () => {
    const target = storage();
    target.setItem("tally-copy-acceptance-journal", "{malformed");
    expect(readCopyAcceptanceJournal(target)).toBeNull();
    expect(target.getItem("tally-copy-acceptance-journal")).toBeNull();
    target.setItem("tally-copy-acceptance-journal", JSON.stringify({ version: 1, requestId: "123", operationId: "11111111-1111-4111-8111-111111111111", destinationId: "", localOnly: true, includeScript: false, includeCustomization: false, stage: "claimed", token: "secret" }));
    expect(readCopyAcceptanceJournal(target)).toBeNull();
    expect(target.getItem("tally-copy-acceptance-journal")).toBeNull();
    const user = userEvent.setup(); const onAccept = vi.fn().mockResolvedValue(undefined);
    const incoming = { id: "123", counter: { name: "Shared", value: 1 }, offeredScript: true, offeredCustomization: false, script: { source: "add 1", language: "tallyscript" } };
    render(<CopySharePrompt incoming={incoming} outcome={null} onAccept={onAccept} onDeny={vi.fn()} onAcknowledge={vi.fn()} />);
    const checks = screen.getAllByRole("checkbox"); await user.click(checks[0]); await user.click(checks[1]); await user.click(screen.getByRole("button", { name: "Accept copy" }));
    expect(onAccept).toHaveBeenCalledWith(incoming, { localOnly: true, includeScript: false, includeCustomization: false });
  });
  it("preserves Local active and retained links through the cloud reconciliation seam", () => {
    const cloud = { counters: [{ id: "cloud", name: "Cloud" }], scripts: { cloud: { source: "cloud", language: "tallyscript", enabled: false } }, customizations: { cloud: { color: "red" } }, folders: [{ id: "cloud-folder", name: "Cloud", parentId: null }] };
    const local = { active: [{ id: "local", localOnly: true, folderId: "local-child" }], retained: [{ id: "retained", localOnly: true, folderId: "local-child" }], scripts: { local: { source: "local", language: "javascript", enabled: true }, retained: { source: "retained", language: "tallyscript", enabled: true } }, customizations: { local: { size: 1 }, retained: { size: 2 } }, folders: [{ id: "local-root", name: "Local", parentId: null }, { id: "local-child", name: "Child", parentId: "local-root" }] };
    const merged = reconcileCloudWorkspace(cloud, local);
    expect(merged.counters.map((item) => item.id)).toEqual(["local", "cloud"]);
    expect(merged.retained.map((item) => item.id)).toEqual(["retained"]);
    expect(merged.scripts.local.enabled).toBe(false);
    expect(merged.customizations.retained).toEqual({ size: 2 });
    expect(merged.folders.some((folder) => folder.name === "Local")).toBe(true);
    expect(merged.folders.some((folder) => folder.name === "Child")).toBe(true);
    local.active.push({ id: "post-mount", localOnly: true, folderId: "local-child" }); local.scripts["post-mount"] = { source: "post", language: "tallyscript", enabled: true }; local.customizations["post-mount"] = { size: 3 };
    const refreshed = reconcileCloudWorkspace(cloud, local);
    expect(refreshed.counters.map((item) => item.id)).toContain("post-mount");
    expect(refreshed.scripts["post-mount"].enabled).toBe(false);
  });
  it("bypasses only the copy-authoritative conflict gate", () => {
    expect(shouldBlockCloudConflict(1, 2, true, false)).toBe(true);
    expect(shouldBlockCloudConflict(1, 2, true, true)).toBe(false);
    expect(shouldBlockCloudConflict(1, 2, false, true)).toBe(false);
  });
});
