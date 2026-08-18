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
import { useEffect, useState } from "react";
import { BookOpen, Moon, Sun } from "lucide-react";
import { Link } from "react-router-dom";
import { Critical, Important, Tip, Warning } from "../features/guide/GuideCallouts";
import Introduction from "../content/guide/introduction.mdx";
import Counters from "../content/guide/counters.mdx";
import Scripting from "../content/guide/scripting.mdx";
import TallyScript from "../content/guide/tallyscript.mdx";
import TallyApi from "../content/guide/tally-api.mdx";
import Sharing from "../content/guide/sharing.mdx";
import TallySuper from "../content/guide/tally-super.mdx";
import SuperCounterEditor from "../content/guide/tally-super-counter-editor.mdx";
import SuperWorkspace from "../content/guide/tally-super-workspace.mdx";
import SuperData from "../content/guide/tally-super-data.mdx";
import Tutorial from "../content/guide/tutorial.mdx";
import TutorialCounters from "../content/guide/tutorial-counters.mdx";
import TutorialGoals from "../content/guide/tutorial-goals.mdx";
import TutorialAutomation from "../content/guide/tutorial-automation.mdx";
import TutorialAccount from "../content/guide/tutorial-account.mdx";
import TutorialSettings from "../content/guide/tutorial-settings.mdx";
import TutorialBackups from "../content/guide/tutorial-backups.mdx";
import TutorialEmbeds from "../content/guide/tutorial-embeds.mdx";
import TutorialTrashLocal from "../content/guide/tutorial-trash-local.mdx";
import TutorialSharing from "../content/guide/tutorial-sharing.mdx";
import TutorialSuper from "../content/guide/tutorial-super.mdx";
import CounterValues from "../content/guide/counter-values.mdx";
import CounterGoals from "../content/guide/counter-goals.mdx";
import CounterLimits from "../content/guide/counter-limits.mdx";
import Accounts from "../content/guide/accounts.mdx";
import AccountSecurity from "../content/guide/account-security.mdx";
import AccountSync from "../content/guide/account-sync.mdx";
import AccountManagement from "../content/guide/account-management.mdx";
import Backups from "../content/guide/backups.mdx";
import BackupExport from "../content/guide/backup-export.mdx";
import BackupImport from "../content/guide/backup-import.mdx";
import Embeds from "../content/guide/embeds.mdx";
import EmbedCustomize from "../content/guide/embed-customize.mdx";
import EmbedPublish from "../content/guide/embed-publish.mdx";
import TrashLocal from "../content/guide/trash-local.mdx";
import TrashGuide from "../content/guide/trash.mdx";
import LocalCounters from "../content/guide/local-counters.mdx";
import AppSettings from "../content/guide/app-settings.mdx";
import AppearanceSettings from "../content/guide/appearance-settings.mdx";
import StatsGuide from "../content/guide/stats.mdx";
import CopySharing from "../content/guide/copy-sharing.mdx";
import GroupSharing from "../content/guide/group-sharing.mdx";
import GroupPermissions from "../content/guide/group-permissions.mdx";
import SharingPrivacy from "../content/guide/sharing-privacy.mdx";

const GUIDE_PAGES = [
  ["/guide", "Introduction", Introduction, "Start here"],
  ["/guide/tutorial", "Tutorial overview", Tutorial, "Tutorial"],
  ["/guide/tutorial/counters", "Your first counter", TutorialCounters, "Tutorial"],
  ["/guide/tutorial/goals", "Goals and direction", TutorialGoals, "Tutorial"],
  ["/guide/tutorial/account", "Account and sync", TutorialAccount, "Tutorial"],
  ["/guide/tutorial/settings", "Customize Tally", TutorialSettings, "Tutorial"],
  ["/guide/tutorial/backups", "Back up your data", TutorialBackups, "Tutorial"],
  ["/guide/tutorial/embeds", "Create an embed", TutorialEmbeds, "Tutorial"],
  ["/guide/tutorial/trash-local", "Trash and local data", TutorialTrashLocal, "Tutorial"],
  ["/guide/tutorial/sharing", "Copies and groups", TutorialSharing, "Tutorial"],
  ["/guide/tutorial/super", "Try Tally Super", TutorialSuper, "Tutorial"],
  ["/guide/tutorial/automation", "Run an automation", TutorialAutomation, "Tutorial"],
  ["/guide/counters", "Overview", Counters, "Counters & goals"],
  ["/guide/counters/values", "Values and steps", CounterValues, "Counters & goals"],
  ["/guide/counters/goals", "Goals and progress", CounterGoals, "Counters & goals"],
  ["/guide/counters/limits", "Limits and reset", CounterLimits, "Counters & goals"],
  ["/guide/accounts", "Overview", Accounts, "Accounts & sync"],
  ["/guide/accounts/security", "Sign-in and security", AccountSecurity, "Accounts & sync"],
  ["/guide/accounts/sync", "Sync and conflicts", AccountSync, "Accounts & sync"],
  ["/guide/accounts/manage", "Manage your account", AccountManagement, "Accounts & sync"],
  ["/guide/backups", "Overview", Backups, "Backups"],
  ["/guide/backups/export", "Export a backup", BackupExport, "Backups"],
  ["/guide/backups/import", "Import and transfer", BackupImport, "Backups"],
  ["/guide/embeds", "Overview", Embeds, "Embeds"],
  ["/guide/embeds/customize", "Customize an embed", EmbedCustomize, "Embeds"],
  ["/guide/embeds/publish", "Publish an embed", EmbedPublish, "Embeds"],
  ["/guide/trash-local", "Overview", TrashLocal, "Trash & local"],
  ["/guide/trash-local/trash", "Trash and recovery", TrashGuide, "Trash & local"],
  ["/guide/trash-local/local", "Local counters", LocalCounters, "Trash & local"],
  ["/guide/settings", "Overview", AppSettings, "App settings"],
  ["/guide/settings/appearance", "Appearance", AppearanceSettings, "App settings"],
  ["/guide/settings/stats", "Stats", StatsGuide, "App settings"],
  ["/guide/scripting", "Overview", Scripting, "Scripting"],
  ["/guide/scripting/tallyscript", "TallyScript language", TallyScript, "Scripting"],
  ["/guide/scripting/api", "Tally API reference", TallyApi, "Scripting"],
  ["/guide/sharing", "Overview", Sharing, "Sharing & groups"],
  ["/guide/sharing/copies", "Counter copies", CopySharing, "Sharing & groups"],
  ["/guide/sharing/groups", "Shared groups", GroupSharing, "Sharing & groups"],
  ["/guide/sharing/permissions", "Group permissions", GroupPermissions, "Sharing & groups"],
  ["/guide/sharing/privacy", "Privacy and controls", SharingPrivacy, "Sharing & groups"],
  ["/guide/tally-super", "Overview", TallySuper, "Tally Super"],
  ["/guide/tally-super/counter-editor", "Counter editor", SuperCounterEditor, "Tally Super"],
  ["/guide/tally-super/workspace", "Workspace editor", SuperWorkspace, "Tally Super"],
  ["/guide/tally-super/data", "Data and backups", SuperData, "Tally Super"],
] as const;

const GUIDE_GROUPS = ["Start here", "Tutorial", "Counters & goals", "Accounts & sync", "Backups", "Embeds", "Trash & local", "App settings", "Scripting", "Sharing & groups", "Tally Super"];

function GuideSection({ section, selectedRoute, selectedGroup }: { section: string; selectedRoute: string; selectedGroup: string }) {
  const [open, setOpen] = useState(section === selectedGroup || section === "Start here");
  useEffect(() => {
    if (section === selectedGroup) setOpen(true);
  }, [section, selectedGroup]);
  return (
    <details open={open} onToggle={(event) => setOpen(event.currentTarget.open)}>
      <summary>{section}</summary>
      <div>{GUIDE_PAGES.filter((page) => page[3] === section).map(([route, label]) => <Link key={route} className={selectedRoute === route ? "active" : ""} to={route}>{label}</Link>)}</div>
    </details>
  );
}

export function GuidePage({ path, theme, onThemeChange }) {
  const selected = GUIDE_PAGES.find(([route]) => route === path) || GUIDE_PAGES[0];
  const Content = selected[2];
  const [sections, setSections] = useState<{ id: string; label: string; level: number }[]>([]);
  useEffect(() => {
    setSections([...document.querySelectorAll(".guide-content h2, .guide-content h3")].map((heading) => ({ id: heading.id, label: heading.textContent || "Section", level: heading.tagName === "H3" ? 3 : 2 })).filter((section) => section.id));
  }, [path]);
  return (
    <div className="guide-page" data-theme={theme}>
      <header className="guide-header">
        <Link className="brand" to="/"><span className="brand-mark"><span></span><span></span><span></span><span></span></span>TALLY</Link>
        <span className="guide-title"><BookOpen /> Guide</span>
        <div>
          <button type="button" aria-label={theme === "dark" ? "Use light mode" : "Use dark mode"} onClick={() => onThemeChange(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun /> : <Moon />}</button>
          <Link to="/counters">Open Tally <span>→</span></Link>
        </div>
      </header>
      <div className="guide-layout">
        <aside className="guide-sidebar">
          <span>EXPLORE TALLY</span>
          <nav>{GUIDE_GROUPS.map((section) => <GuideSection key={section} section={section} selectedRoute={selected[0]} selectedGroup={selected[3]} />)}</nav>
          <div><b>Building Tally?</b><Link to="/developers">Open the Dev Guide →</Link><a href="https://github.com/supersnug/tally-counter" target="_blank" rel="noreferrer">View on GitHub ↗</a></div>
        </aside>
        <main className="guide-content"><Content components={{ Tip, Warning, Critical, Important }} /></main>
        <aside className="guide-on-this-page"><span>IN THIS GUIDE</span><b>{selected[1]}</b>{sections.length ? <nav>{sections.map((section) => <a key={section.id} className={section.level === 3 ? "nested" : ""} href={`#${section.id}`}>{section.label}</a>)}</nav> : <small>This short overview has no additional sections.</small>}</aside>
      </div>
    </div>
  );
}
