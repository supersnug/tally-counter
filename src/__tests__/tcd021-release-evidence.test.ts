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
import { allowlistedAnalyticsPayload, isPrivateAnalyticsKey } from "../lib/analytics";
import { TCD021_FIXTURES } from "../test-fixtures/tcd021";

describe("TCD-021 deterministic release evidence", () => {
  it("keeps multi-user fixtures isolated and duplicate operations deterministic", () => {
    expect(TCD021_FIXTURES.users.map((user) => user.id)).toEqual(["user-a", "user-b"]);
    expect(TCD021_FIXTURES.operations[0]).toEqual(TCD021_FIXTURES.operations[1]);
    expect(TCD021_FIXTURES.workspaces[0].members["user-b"]).toBe("counting_only");
  });
  it("records rollback without activity on transactional failure", () => expect(TCD021_FIXTURES.failure).toEqual({ rollback: true, activity: false }));
  it("excludes query content and private fields from analytics", () => {
    expect(allowlistedAnalyticsPayload("embed_view", "/embed?data=secret")).toEqual({ event: "embed_view", route: "/embed" });
    expect(isPrivateAnalyticsKey("email")).toBe(true);
    expect(isPrivateAnalyticsKey("route")).toBe(false);
  });
});
