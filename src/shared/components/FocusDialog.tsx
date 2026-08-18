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
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import { installFocusTrap } from "./focusTrap";

type FocusDialogProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  cancelOnEscape?: boolean;
};

export function FocusDialog({ title, onClose, children, className = "", cancelOnEscape = true }: FocusDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const invokerRef = useRef<HTMLElement | null>(document.activeElement as HTMLElement);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const removeTrap = installFocusTrap(dialog, (event) => {
      if (event.key === "Escape" && cancelOnEscape) { event.preventDefault(); onClose(); return true; }
      return false;
    });
    return () => { removeTrap(); invokerRef.current?.focus?.(); };
  }, [cancelOnEscape, onClose]);
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><div ref={dialogRef} className={`modal ${className}`} role="dialog" aria-modal="true" aria-labelledby="focus-dialog-title"><div className="sr-only" id="focus-dialog-title">{title}</div>{children}</div></div>;
}
