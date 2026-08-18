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
import {
  BadgeAlert,
  CircleX,
  Lightbulb,
  TriangleAlert,
} from "lucide-react";
import type { ReactNode } from "react";

function GuideCallout({ kind, title, icon, children }: {
  kind: string;
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <aside className={`guide-callout ${kind}`}>
      <span>{icon}</span>
      <div><b>{title}</b><div>{children}</div></div>
    </aside>
  );
}

export function Tip({ children }: { children: ReactNode }) {
  return <GuideCallout kind="tip" title="Tip" icon={<Lightbulb />}>{children}</GuideCallout>;
}

export function Warning({ children }: { children: ReactNode }) {
  return <GuideCallout kind="warning" title="Warning" icon={<TriangleAlert />}>{children}</GuideCallout>;
}

export function Critical({ children }: { children: ReactNode }) {
  return <GuideCallout kind="critical" title="Critical" icon={<CircleX />}>{children}</GuideCallout>;
}

export function Important({ children }: { children: ReactNode }) {
  return <GuideCallout kind="important" title="Important" icon={<BadgeAlert />}>{children}</GuideCallout>;
}
