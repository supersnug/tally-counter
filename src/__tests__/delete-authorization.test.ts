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
import { authorizeDeletion } from "../../supabase/functions/delete-account/authorization";

const base = { purpose: "account_deletion", sessionId: "session", sessionGeneration: 4, commandId: "command", issuedAt: 1000, now: 1000 * 1000 };
describe("account deletion authorization", () => {
  it.each([
    [{ ...base, issuedAt: undefined }, "iat"], [{ ...base, issuedAt: 0 }, "iat"], [{ ...base, issuedAt: 1 }, "iat"], [{ ...base, issuedAt: 1100 }, "iat"],
    [{ ...base, purpose: "email_change" }, "purpose"], [{ ...base, sessionId: "other" }, "session"], [{ ...base, expectedSessionId: "other" }, "session"], [{ ...base, sessionGeneration: "4" }, "binding"], [{ ...base, commandId: "" }, "binding"],
  ])("rejects invalid binding %#", (input, reason) => expect(authorizeDeletion({ ...input, expectedSessionId: (input as any).expectedSessionId || "session" })).toEqual({ ok: false, reason }));
  it("accepts one fresh purpose-bound identity", () => expect(authorizeDeletion({ ...base, expectedSessionId: "session" })).toEqual({ ok: true, sessionId: "session", generation: 4, commandId: "command" }));
});
