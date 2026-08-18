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
import { describe, expect, it } from 'vitest';
import { activityStorageKeys, cleanFolderPath, folderAncestors, folderParent, unavailableStorage } from '../pages/countersPagePolicies';

describe('CountersPage policy seams', () => {
  it('normalizes folder paths without changing hierarchy semantics', () => {
    expect(cleanFolderPath(' Work / Daily / ')).toBe('Work/Daily');
    expect(folderAncestors('Work/Daily')).toEqual(['Work', 'Work/Daily']);
    expect(folderParent('Work/Daily')).toBe('Work');
  });

  it('keeps activity persistence keys centralized and recovery storage inert', () => {
    expect(activityStorageKeys).toEqual({ history: 'tally-history', redo: 'tally-redo', branches: 'tally-undo-branches', quarantine: 'tally-history-quarantine' });
    expect(() => unavailableStorage.setItem('x', 'y')).toThrow();
  });
});
