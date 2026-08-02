import { useEffect, useState } from "react";
import { Code2, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Critical, Important, Tip, Warning } from "../features/guide/GuideCallouts";
import DeveloperIntroduction from "../content/developers/introduction.mdx";
import Architecture from "../content/developers/architecture.mdx";
import Persistence from "../content/developers/persistence.mdx";
import ScriptingRuntime from "../content/developers/scripting-runtime.mdx";
import SuperInternals from "../content/developers/tally-super.mdx";
import OnlineData from "../content/developers/online-data.mdx";
import TestingDeployment from "../content/developers/testing-deployment.mdx";
import CounterEngine from "../content/developers/counter-engine.mdx";
import AuthLifecycle from "../content/developers/auth-lifecycle.mdx";
import DatabaseSecurity from "../content/developers/database-security.mdx";
import DataContracts from "../content/developers/data-contracts.mdx";
import RoutingPerformance from "../content/developers/routing-performance.mdx";

const DEVELOPER_PAGES = [
  ["/developers", "Introduction", DeveloperIntroduction, "Start here"],
  ["/developers/architecture", "Application architecture", Architecture, "Application"],
  ["/developers/counter-engine", "Counter engine", CounterEngine, "Application"],
  ["/developers/persistence", "Persistence and sync", Persistence, "Application"],
  ["/developers/auth", "Authentication lifecycle", AuthLifecycle, "Online features"],
  ["/developers/database", "Database and RLS", DatabaseSecurity, "Online features"],
  ["/developers/scripting", "Scripting runtime", ScriptingRuntime, "Feature internals"],
  ["/developers/tally-super", "Tally Super editors", SuperInternals, "Feature internals"],
  ["/developers/online-data", "Sharing and group data", OnlineData, "Online features"],
  ["/developers/data-contracts", "Data contracts", DataContracts, "Data formats"],
  ["/developers/routing", "Routing and performance", RoutingPerformance, "Development"],
  ["/developers/testing", "Testing and deployment", TestingDeployment, "Development"],
] as const;

const DEVELOPER_GROUPS = ["Start here", "Application", "Feature internals", "Online features", "Data formats", "Development"];

function DeveloperSection({ section, selectedRoute, selectedGroup }: { section: string; selectedRoute: string; selectedGroup: string }) {
  const [open, setOpen] = useState(section === selectedGroup || section === "Start here");
  useEffect(() => {
    if (section === selectedGroup) setOpen(true);
  }, [section, selectedGroup]);
  return <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}><summary>{section}</summary><div>{DEVELOPER_PAGES.filter((page) => page[3] === section).map(([route, label]) => <Link key={route} className={selectedRoute === route ? "active" : ""} to={route}>{label}</Link>)}</div></details>;
}

export function DeveloperGuidePage({ path, theme, onThemeChange }) {
  const selected = DEVELOPER_PAGES.find(([route]) => route === path) || DEVELOPER_PAGES[0];
  const Content = selected[2];
  const [sections, setSections] = useState<{ id: string; label: string; level: number }[]>([]);
  useEffect(() => {
    setSections([...document.querySelectorAll(".guide-content h2, .guide-content h3")].map((heading) => ({ id: heading.id, label: heading.textContent || "Section", level: heading.tagName === "H3" ? 3 : 2 })).filter((section) => section.id));
  }, [path]);
  return <div className="guide-page developer-guide" data-theme={theme}>
    <header className="guide-header">
      <Link className="brand" to="/"><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</Link>
      <span className="guide-title"><Code2 /> Dev Guide</span>
      <div><button type="button" aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</button><Link to="/guide">User Guide <span>→</span></Link></div>
    </header>
    <div className="guide-layout">
      <aside className="guide-sidebar"><span>DEVELOPER DOCUMENTATION</span><nav>{DEVELOPER_GROUPS.map((section) => <DeveloperSection key={section} section={section} selectedRoute={selected[0]} selectedGroup={selected[3]} />)}</nav><div><b>Repository</b><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub ↗</a><Link to="/guide">Read the User Guide →</Link></div></aside>
      <main className="guide-content"><Content components={{ Tip, Warning, Critical, Important }} /></main>
      <aside className="guide-on-this-page"><span>ON THIS PAGE</span><b>{selected[1]}</b>{sections.length ? <nav>{sections.map((section) => <a key={section.id} className={section.level === 3 ? "nested" : ""} href={`#${section.id}`}>{section.label}</a>)}</nav> : <small>This overview has no additional sections.</small>}</aside>
    </div>
  </div>;
}
