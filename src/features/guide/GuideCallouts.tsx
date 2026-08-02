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
