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
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn(async (name: string) => name === "get_copy_sharing_settings" ? { data: { copySharingEnabled: true, copySharingPinEnabled: false }, error: null } : { data: [], error: null }) }));
vi.mock("../../lib/supabase", () => ({ supabase: { rpc } }));

import { useCopySharing } from "./CopySharing";

describe("copy sharing RPC boundary", () => {
  it("uses role projections and sends only source identity and choices", async () => {
    const { result } = renderHook(() => useCopySharing({ user: { id: "recipient" } }));
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("list_incoming_counter_copies"));
    await result.current.sendCounter("friend", "source-id", "123456", { includeScript: true, includeCustomization: false });
    expect(rpc).toHaveBeenCalledWith("send_counter_copy_from_source", { recipient_identifier: "friend", source_counter_id: "source-id", include_script: true, include_customization: false, sharing_pin: "123456" });
    await result.current.claimCounter("7", "operation", true, false, true);
    expect(rpc).toHaveBeenCalledWith("claim_counter_copy", { share_id: "7", operation_id: "operation", include_script: true, include_customization: false, local_only: true });
    await result.current.finalizeLocalCounter("7", "operation", "destination", "token");
    expect(rpc).toHaveBeenCalledWith("finalize_local_counter_copy", { share_id: "7", operation_id: "operation", destination_id: "destination", delivery_token: "token" });
    await result.current.declineCounter("7");
    await result.current.acknowledgeShare("7");
    expect(rpc).toHaveBeenCalledWith("decline_counter_copy", { share_id: "7" });
    expect(rpc).toHaveBeenCalledWith("acknowledge_counter_copy", { share_id: "7" });
    expect((result.current as any).from).toBeUndefined();
  });
});
