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
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthModal } from "../features/auth/AuthModal";

const mocked = vi.hoisted(() => ({
  signInWithPassword: vi.fn(), updateUser: vi.fn(), refreshSession: vi.fn(),
  functions: { invoke: vi.fn() },
  from: vi.fn(() => ({ select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }) })),
}));
vi.mock("../lib/supabase", () => ({ supabase: { auth: mocked, functions: mocked.functions, from: mocked.from }, supabaseConfigured: true }));

const session = { user: { id: "user-1", email: "person@example.com" } };
const freshSession = { access_token: "eyJhbGciOiJub25lIn0.eyJzaWRfaWQiOiJzZXNzaW9uLTEiLCJpYXQiOjIwMDB9.sig", user: session.user };
describe("AuthModal current-password reauthentication", () => {
  beforeEach(() => { vi.clearAllMocks(); mocked.signInWithPassword.mockResolvedValue({ data: { user: session.user, session: freshSession }, error: null }); mocked.updateUser.mockResolvedValue({ data: { user: { ...session.user, email: "new@example.com" } }, error: null }); mocked.functions.invoke.mockResolvedValue({ data: { deleted: true }, error: null }); });
  it("rejects wrong password without email update", async () => {
    mocked.signInWithPassword.mockResolvedValue({ data: { user: null, session: null }, error: new Error("Invalid login credentials") });
    render(<AuthModal session={session} configured syncStatus="Synchronized" onDeleted={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /send confirmation/i }));
    await screen.findByText(/invalid login credentials/i);
    expect(mocked.updateUser).not.toHaveBeenCalled();
  });
  it("reauthenticates email change with the current password", async () => {
    render(<AuthModal session={session} configured syncStatus="Synchronized" onDeleted={vi.fn()} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Change email" }));
    fireEvent.change(screen.getByLabelText("New email address"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("Current password"), { target: { value: "correct" } });
    fireEvent.click(screen.getByRole("button", { name: /send confirmation/i }));
    await waitFor(() => expect(mocked.updateUser).toHaveBeenCalledWith({ email: "new@example.com" }));
    expect(mocked.signInWithPassword).toHaveBeenCalledWith({ email: session.user.email, password: "correct" });
  });
});
