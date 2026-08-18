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
import { describe, expect, it } from "vitest";
import { eligibleCloudBundles } from "../features/counters/bundle";

describe("Local conversion contract", () => {
  it("removes a Local active/retained bundle and its references from every eligible payload", () => {
    const local = { id: "local", name: "Device", value: 1, localOnly: true, script: { source: "add 1" }, customization: { parts: {} } };
    const remote = { id: "remote", name: "Cloud", value: 2, localOnly: false };
    expect(eligibleCloudBundles([local, remote], [{ ...local, deletedAt: 1 }], true)).toHaveLength(1);
    expect(eligibleCloudBundles([local, remote], [{ ...local, deletedAt: 1 }], true)[0]).toMatchObject({ id: "remote" });
    expect(eligibleCloudBundles([local], [{ ...local, deletedAt: 1 }], false)).toEqual([]);
  });
  it("keeps retained non-local eligibility controlled by cloud Trash", () => {
    const retained = { id: "retained", name: "R", value: 0, localOnly: false, deletedAt: 1 };
    expect(eligibleCloudBundles([], [retained], false)).toEqual([]);
    expect(eligibleCloudBundles([], [retained], true)).toHaveLength(1);
  });
});
