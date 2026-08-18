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
import { guardedRead, guardedRawRead } from "../../shared/persistence/guardedStorage";
import type { AnyRecord } from "./model";

export const readJson = <T,>(storage: Storage, key: string, fallback: T, validate: (value: unknown) => value is T): T => guardedRead(storage, key, fallback, validate).value;
export const readRecords = (storage: Storage, key: string) => readJson<AnyRecord[]>(storage, key, [], (value): value is AnyRecord[] => Array.isArray(value)).filter((value) => value && typeof value === "object" && !Array.isArray(value));
export const readRaw = (storage: Storage, key: string) => guardedRawRead(storage, key).value;
