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
export type ScriptRecord = { source: string; language: "tallyscript" | "javascript"; enabled: false };
export type Invocation = { id: string; counterId: string; controller: AbortController };

export function createInvocationRegistry() {
  const active = new Map<string, Invocation>();
  const start = (counterId: string) => {
    active.get(counterId)?.controller.abort();
    const invocation = { id: crypto.randomUUID(), counterId, controller: new AbortController() };
    active.set(counterId, invocation);
    return invocation;
  };
  const stop = (counterId: string) => { const invocation = active.get(counterId); invocation?.controller.abort(); active.delete(counterId); return invocation; };
  const isCurrent = (invocation: Invocation) => active.get(invocation.counterId)?.id === invocation.id && !invocation.controller.signal.aborted;
  return { active, start, stop, isCurrent };
}
