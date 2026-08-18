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
import { useEffect } from "react";
import { installFocusTrap } from "./focusTrap";
export function ModalA11yManager() {
  useEffect(() => {
    let nextId = 0;
    const active = new Map<Element, { dialog: HTMLElement; invoker: HTMLElement | null; cleanup: () => void }>();
    const ensureId = (element: HTMLElement, prefix: string) => {
      if (!element.id) element.id = `${prefix}-${++nextId}`;
      return element.id;
    };
    const restore = (record: { dialog: HTMLElement; invoker: HTMLElement | null; cleanup: () => void }) => {
      record.cleanup();
      if (record.invoker?.isConnected) record.invoker.focus();
    };
    const cleanup = (backdrop: Element) => {
      const record = active.get(backdrop);
      if (!record) return;
      active.delete(backdrop);
      restore(record);
    };
    const enhance = (backdrop: Element) => {
      if (active.has(backdrop)) return;
      const dialog = backdrop.querySelector<HTMLElement>("[role=\"dialog\"], [role=\"alertdialog\"], .modal");
      if (!dialog) return;
      const invoker = document.activeElement as HTMLElement | null;
      if (!dialog.getAttribute("role")) dialog.setAttribute("role", "dialog");
      dialog.setAttribute("aria-modal", "true");
      const title = dialog.querySelector<HTMLElement>("[data-dialog-title], .modal-head h1, .modal-head h2, .modal-head h3, h1, h2, h3");
      if (!dialog.getAttribute("aria-labelledby") && title) dialog.setAttribute("aria-labelledby", ensureId(title, "modal-title"));
      const description = dialog.querySelector<HTMLElement>("[data-dialog-description], .modal-head ~ p, .modal > p, p");
      if (!dialog.getAttribute("aria-describedby") && description) dialog.setAttribute("aria-describedby", ensureId(description, "modal-description"));
      const keydown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          const cancel = dialog.querySelector<HTMLElement>(".cancel, [data-dialog-cancel], [aria-label=\"Close\"], [title=\"Close\"]");
          if (cancel) {
            event.preventDefault();
            cancel.click();
            if (!backdrop.isConnected && invoker?.isConnected) invoker.focus();
            queueMicrotask(() => { if (!backdrop.isConnected && invoker?.isConnected) invoker.focus(); });
          }
        }
        return false;
      };
      const cleanup = installFocusTrap(dialog, keydown);
      active.set(backdrop, { dialog, invoker, cleanup });
    };
    const observer = new MutationObserver((records) => {
      records.forEach((record) => record.removedNodes.forEach((node) => {
        if (node instanceof Element) {
          active.forEach((_value, backdrop) => { if (node === backdrop || node.contains(backdrop)) cleanup(backdrop); });
        }
      }));
      document.querySelectorAll<Element>(".modal-backdrop").forEach(enhance);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    document.querySelectorAll<Element>(".modal-backdrop").forEach(enhance);
    return () => { observer.disconnect(); active.forEach(restore); active.clear(); };
  }, []);
  return null;
}
