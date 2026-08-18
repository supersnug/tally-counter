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
import { describe, expect, it, vi } from "vitest";
import { AppSettings } from "../features/settings/AppSettings";
import { createBackup } from "../features/settings/backup";

describe("backup settings rendered import", () => {
  it("uploads a real counter file and confirms one validated session", async () => {
    const onImport = vi.fn(() => true);
    const backup = createBackup({ counters: [{ id: "a", name: "A", value: 1, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" }], folders: [], scripts: { a: { source: "add 1", language: "tallyscript" } }, counterCustomizations: { a: { enabled: true } } }, "counters", { selectedIds: ["a"], includeScripts: true, includeCounterCustomizations: true });
    const view = render(<AppSettings counters={[]} history={[]} preferences={{}} superSettings={{ uiCustomizations: { items: [] }, counterCustomizations: {} }} scripts={{}} folders={[]} trash={[]} destinationRevision="revision" onStartSuperEditor={vi.fn()} onSuperSettings={vi.fn()} onPreferences={vi.fn()} onImport={onImport} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Backup & transfer" }));
    const input = view.container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File([JSON.stringify(backup)], "counter.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByRole("heading", { name: "Counter backup" })).toBeInTheDocument());
    expect(screen.getByText("Import scripts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await waitFor(() => expect(onImport).toHaveBeenCalledTimes(1));
    const call = (onImport.mock.calls as any[])[0];
    expect(call[0].candidate).toBeDefined();
    expect(call[1]).toEqual({ includeScripts: true, includeCounterCustomizations: true });
  });
  it("applies the imported dark theme after confirming All Tally Data", async () => {
    const onImport = vi.fn(() => true);
    const onThemeChange = vi.fn();
    const backup = createBackup({ counters: [], trash: [], folders: [], preferences: { density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true, defaultColor: "#ef6a47", trashEnabled: true, syncTrash: true, theme: "dark" }, superSettings: { uiCustomizations: { items: [] }, counterCustomizations: {} }, scripts: {} }, "all");
    const view = render(<AppSettings counters={[]} history={[]} preferences={{}} superSettings={{ uiCustomizations: { items: [] }, counterCustomizations: {} }} scripts={{}} folders={[]} trash={[]} onStartSuperEditor={vi.fn()} onSuperSettings={vi.fn()} onPreferences={vi.fn()} onImport={onImport} onThemeChange={onThemeChange} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Backup & transfer" }));
    const inputs = view.container.querySelectorAll('input[type="file"]');
    fireEvent.change(inputs[inputs.length - 1], { target: { files: [new File([JSON.stringify(backup)], "all.json", { type: "application/json" })] } });
    await waitFor(() => expect(screen.getByRole("heading", { name: "All Tally data" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Confirm import" }));
    await waitFor(() => expect(onThemeChange).toHaveBeenCalledWith("dark"));
  });
});
