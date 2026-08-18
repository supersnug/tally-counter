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
export const FOCUSABLE_SELECTOR = "button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex]:not([tabindex=\"-1\"])";

export function installFocusTrap(dialog: HTMLElement, onKeyDown?: (event: KeyboardEvent) => boolean) {
  dialog.querySelector<HTMLElement>(FOCUSABLE_SELECTOR)?.focus();
  const handler = (event: KeyboardEvent) => {
    if (onKeyDown?.(event)) return;
    if (event.key !== "Tab") return;
    const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)];
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  dialog.addEventListener("keydown", handler);
  return () => dialog.removeEventListener("keydown", handler);
}
