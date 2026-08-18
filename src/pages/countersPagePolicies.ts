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
/* Pure page policy seams: kept outside the renderer so recovery and organization
 * rules can be tested without mounting the whole workspace. */
export const cleanFolderPath = (value = '') => String(value).split('/').map((part) => part.trim()).filter(Boolean).join('/');

export const folderAncestors = (value = '') => {
  const parts = cleanFolderPath(value).split('/').filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join('/'));
};

export const folderParent = (value = '') => cleanFolderPath(value).split('/').slice(0, -1).join('/');

export const unavailableStorage = {
  getItem: () => null,
  setItem: () => { throw new Error('Browser storage recovery is pending.'); },
  removeItem: () => { throw new Error('Browser storage recovery is pending.'); },
  clear: () => { throw new Error('Browser storage recovery is pending.'); },
  key: () => null,
  get length() { return 0; },
} as unknown as Storage;

export const activityStorageKeys = {
  history: 'tally-history',
  redo: 'tally-redo',
  branches: 'tally-undo-branches',
  quarantine: 'tally-history-quarantine',
} as const;

export const storageRecoveryMessage = 'Browser storage is unavailable; counting continues in memory. Retry recovery when storage is available.';
