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
export type PersistenceResult<T> =
  | { ok: true; value: T; recovered: false }
  | { ok: false; value: T; recovered: true; error: unknown };

export function persistCustomization<T>(previous: T, next: T, write: (value: T) => void): PersistenceResult<T> {
  try {
    write(next);
    return { ok: true, value: next, recovered: false };
  } catch (error) {
    return { ok: false, value: previous, recovered: true, error };
  }
}
