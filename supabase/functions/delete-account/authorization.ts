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
export type DeleteAuthorizationInput = { purpose?: unknown; sessionId?: unknown; sessionGeneration?: unknown; commandId?: unknown; issuedAt?: unknown; now?: number; expectedSessionId?: string };
export function authorizeDeletion(input: DeleteAuthorizationInput) {
  const issuedAt = Number(input.issuedAt);
  if (input.purpose !== "account_deletion") return { ok: false, reason: "purpose" } as const;
  if (!Number.isFinite(issuedAt) || issuedAt <= 0) return { ok: false, reason: "iat" } as const;
  const age = (input.now ?? Date.now()) / 1000 - issuedAt;
  if (age < 0 || age > 600) return { ok: false, reason: "iat" } as const;
  if (typeof input.expectedSessionId !== "string" || !input.expectedSessionId || input.sessionId !== input.expectedSessionId) return { ok: false, reason: "session" } as const;
  if (!Number.isInteger(input.sessionGeneration) || typeof input.commandId !== "string" || !input.commandId) return { ok: false, reason: "binding" } as const;
  return { ok: true, sessionId: input.expectedSessionId, generation: input.sessionGeneration, commandId: input.commandId } as const;
}
