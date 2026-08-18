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
type RemoteValidationContext = {
  client: { auth: { getUser: () => Promise<{ data?: { user?: unknown }; error?: { status?: number; code?: string } }>; signOut: (options: { scope: "local" }) => Promise<unknown> } } | null;
  session: unknown;
  onSignedOut: () => void;
};

/** Keeps authorization-loss policy out of the workspace renderer. */
export function createRemoteUserValidator({ client, session, onSignedOut }: RemoteValidationContext) {
  return async () => {
    if (!client || !session) return true;
    const { data, error } = await client.auth.getUser();
    if (data?.user) return true;
    const accountIsGone = error?.status === 401 || error?.status === 403 || error?.code === "user_not_found";
    if (!accountIsGone) return null;
    await client.auth.signOut({ scope: "local" });
    onSignedOut();
    return false;
  };
}
