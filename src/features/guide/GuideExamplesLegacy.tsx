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
import { useEffect, useRef, useState } from "react";
import { Check, Cloud, Copy, Download, LockKeyhole, Pause, Play, RotateCcw, Send, Settings2, Sparkles, Trash2, Upload, UserRound, X } from "lucide-react";
import { CounterCard } from "../counters/CounterCard";
import { COLORS, getGoals, type AnyRecord } from "../counters/model";
import { EmbedPreview } from "../embed/EmbedComponents";
import { ShareCounterModal } from "../sharing/CopySharing";
import { SuperEditorPane, SuperSettings, SuperZoneContent } from "../tally-super/TallySuper";

const tutorialCounter = (overrides: AnyRecord = {}) => ({
  id: "guide-demo",
  name: "My first tally",
  value: 0,
  start: 0,
  plusStep: 1,
  minusStep: 1,
  goals: [5, 10],
  goalDirection: "more",
  min: 0,
  max: null,
  color: COLORS[1],
  ...overrides,
});

export function LiveCounterLesson() {
  const [counter, setCounter] = useState(() => tutorialCounter());
  const change = (amount) => setCounter((current) => ({
    ...current,
    value: Math.max(current.min ?? -Infinity, Math.min(current.max ?? Infinity, current.value + amount)),
  }));
  return <div className="guide-live-example"><div className="guide-live-head"><span>LIVE COUNTER</span><button type="button" onClick={() => setCounter(tutorialCounter())}><RotateCcw /> Restart lesson</button></div><CounterCard counter={counter} index={0} showBounds onChange={(_id, amount) => change(amount)} onReset={() => setCounter((current) => ({ ...current, value: current.start }))} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /><p>{counter.value >= 5 ? <><Check /> First goal complete—keep going to 10.</> : <>Press + until the counter reaches its first goal at 5.</>}</p></div>;
}

export function LiveGoalLesson() {
  const [direction, setDirection] = useState("more");
  const [value, setValue] = useState(0);
  const counter = tutorialCounter({ id: "guide-goals", name: direction === "more" ? "Upward goals" : "Downward goals", value, start: 0, goals: direction === "more" ? [5, 10, 20] : [-5, -10, -20], goalDirection: direction, min: direction === "more" ? 0 : -25, max: direction === "more" ? 25 : 0, color: COLORS[4] });
  const switchDirection = (next) => { setDirection(next); setValue(0); };
  return <div className="guide-live-example"><div className="guide-live-head"><span>GOAL PLAYGROUND</span><div className="guide-live-choice"><button type="button" className={direction === "more" ? "active" : ""} onClick={() => switchDirection("more")}>More than</button><button type="button" className={direction === "less" ? "active" : ""} onClick={() => switchDirection("less")}>Less than</button></div></div><CounterCard counter={counter} index={0} showBounds onChange={(_id, amount) => setValue((current) => Math.max(counter.min, Math.min(counter.max, current + amount)))} onReset={() => setValue(0)} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /><p>Goals are ordered in the direction the counter is traveling: {getGoals(counter).join(" → ")}.</p></div>;
}

export function LiveAutomationLesson() {
  const [value, setValue] = useState(0);
  const [running, setRunning] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => {
    if (!running) return;
    timer.current = window.setInterval(() => setValue((current) => current + 1), 700);
    return () => { if (timer.current) window.clearInterval(timer.current); };
  }, [running]);
  useEffect(() => () => { if (timer.current) window.clearInterval(timer.current); }, []);
  return <div className="guide-automation-demo"><div><span>SIMULATED TALLYSCRIPT</span><strong>{value}</strong><small>{running ? "Incrementing in the background" : "Script stopped"}</small></div><pre><code>while true{"\n"}  sleep 700 ms{"\n"}  add{"\n"}end</code></pre><div><button type="button" className={running ? "stop" : ""} onClick={() => setRunning((current) => !current)}>{running ? <><Pause /> Stop script</> : <><Play /> Run script</>}</button><button type="button" onClick={() => { setRunning(false); setValue(0); }}><RotateCcw /> Reset</button></div></div>;
}

export function LiveAccountLesson() {
  const [step, setStep] = useState<"signed-out" | "conflict" | "synced">("signed-out");
  const email = "demo@tally.local";
  return <div className="guide-account-demo">
    <div className="guide-live-head"><span>SIMULATED ACCOUNT</span><button type="button" onClick={() => setStep("signed-out")}><RotateCcw /> Restart lesson</button></div>
    {step === "signed-out" ? <form onSubmit={(event) => { event.preventDefault(); setStep("conflict"); }}>
      <span className="guide-account-icon"><UserRound /></span><strong>Sign in to Tally</strong><small>This form is a simulation. Nothing is transmitted or stored.</small>
      <label>Email or username<input aria-label="Tutorial email or username" value={email} readOnly /></label>
      <label>Password<input aria-label="Tutorial password" type="password" value="Tally-demo-1!" readOnly /></label>
      <button type="submit"><LockKeyhole /> Simulate sign in</button>
    </form> : step === "conflict" ? <div className="guide-sync-choice">
      <span className="guide-account-icon"><Cloud /></span><strong>Choose which counters to synchronize</strong><p>This device has 3 counters. The simulated account has 2 cloud counters.</p>
      <button type="button" onClick={() => setStep("synced")}>Merge both</button><button type="button" onClick={() => setStep("synced")}>Keep this device's counters</button><button type="button" onClick={() => setStep("synced")}>Use cloud counters</button>
    </div> : <div className="guide-sync-complete"><Check /><strong>Signed in and synchronized</strong><p>{email} is now shown as connected for this simulation.</p></div>}
  </div>;
}

/* Removed duplicate LiveSettingsLesson; GuideExamples.tsx owns the production lesson.
export function LiveSettingsLesson() {
  const [preferences, setPreferences] = useState({ density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true });
  const set = (key, value) => setPreferences((current) => ({ ...current, [key]: value }));
  const counter = tutorialCounter({ id: "guide-settings", name: "Reading tracker", value: 24, goals: [30], max: 40 });
  return <div className="guide-feature-demo guide-settings-demo"><div className="guide-live-head"><span>APP SETTINGS · CUSTOMIZE</span><button type="button" onClick={() => setPreferences({ density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true })}><RotateCcw /> Reset</button></div><div className="guide-settings-layout"><div className="settings-section customize-settings"><SettingChoice label="Card spacing" description="Choose how much room each counter uses." value={preferences.density} options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]]} onChange={(value) => set("density", value)} /><SettingChoice label="Grid columns" description="Control the dashboard layout on larger screens." value={preferences.columns} options={[["auto", "Automatic"], ["2", "Two"], ["3", "Three"]]} onChange={(value) => set("columns", value)} /><SettingChoice label="Number size" description="Adjust the main count to suit your layout." value={preferences.numberSize} options={[["small", "Small"], ["standard", "Standard"], ["large", "Large"]]} onChange={(value) => set("numberSize", value)} /><div className="setting-row"><div><b>Counter details</b><small>Show minimum and maximum labels on cards.</small></div><button type="button" className={`setting-switch ${preferences.showBounds ? "active" : ""}`} onClick={() => set("showBounds", !preferences.showBounds)}><i /></button></div><div className="setting-row"><div><b>Animations</b><small>Animate cards and progress changes.</small></div><button type="button" className={`setting-switch ${preferences.animations ? "active" : ""}`} onClick={() => set("animations", !preferences.animations)}><i /></button></div></div><div className={`guide-settings-counter density-${preferences.density} number-${preferences.numberSize}`}><CounterCard counter={counter} index={0} showBounds={preferences.showBounds} onChange={() => {}} onReset={() => {}} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /></div></div></div>;
}

*/
export function LiveBackupLesson() {
  const [action, setAction] = useState("");
  const [includeCustomizations, setIncludeCustomizations] = useState(false);
  const [includeScripts, setIncludeScripts] = useState(false);
  const [status, setStatus] = useState("");
  const finish = (scope, transfer) => scope === "counters" ? setAction(transfer) : setStatus(`${scope === "all" ? "All Tally data" : "Tally Super"} ${transfer === "export" ? "export prepared" : "import simulated"}.`);
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>APP SETTINGS · BACKUP & TRANSFER</span><button type="button" onClick={() => { setAction(""); setStatus(""); }}><RotateCcw /> Reset</button></div><p className="utility-intro">Choose exactly which part of Tally to transfer. Importing replaces only the selected data on this device.</p><div className="backup-groups">{[["counters", "Counters", "Counter values, goals, limits, and colors"], ["super", "Tally Super", "UI customizations and app customization settings"], ["all", "All Tally data", "Counters, scripts, Super data, and customization settings"]].map(([scope, title, description]) => <div className="backup-group" key={scope}><div><b>{title}</b><small>{description}</small></div><div><button type="button" onClick={() => finish(scope, "export")}><Download /> Export</button><button type="button" onClick={() => finish(scope, "import")}><Upload /> Import</button></div></div>)}</div>{status && <div className="utility-status">{status}</div>}{action && <div className="modal-backdrop backup-option-backdrop"><div className="modal backup-option-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span>COUNTER {action.toUpperCase()}</span><h2>Include linked data?</h2></div><button type="button" onClick={() => setAction("")}><X /></button></div><p>Choose which counter-linked data should be included with this {action}.</p>{[[includeCustomizations, setIncludeCustomizations, "Include per-counter customizations", action === "export" ? "Add them to this counter backup." : "Restore them from the selected counter backup."], [includeScripts, setIncludeScripts, "Include scripts", action === "export" ? "Add counter-linked scripts to this backup." : "Restore counter-linked scripts from this backup."]].map(([checked, setter, title, description]) => <label className="backup-customization-toggle" key={String(title)}><input type="checkbox" checked={Boolean(checked)} onChange={(event) => (setter as Function)(event.target.checked)} /><i /><span><b>{String(title)}</b><small>{String(description)}</small></span></label>)}<div className="modal-footer"><button type="button" className="cancel" onClick={() => setAction("")}>Cancel</button><button type="button" className="save" onClick={() => { setStatus(`Counter ${action} simulated.`); setAction(""); }}>{action === "export" ? <Download /> : <Upload />} Continue</button></div></div></div>}</div>;
}

export function LiveEmbedLesson() {
  const [options, setOptions] = useState({ watermark: true, compact: false, reset: true, settings: false, theme: "auto" });
  const [copied, setCopied] = useState(false);
  const set = (key) => setOptions((current) => ({ ...current, [key]: !current[key] }));
  const counter = tutorialCounter({ id: "guide-embed", name: "Water intake", value: 6, goals: [8], color: "#2f7e70" });
  const code = `<iframe src="https://tally.example/embed?data=…" width="100%" height="${options.compact ? 210 : 310}" frameborder="0" title="Water intake tally counter"></iframe>`;
  return <div className="guide-feature-demo modal embed-modal"><div className="modal-head"><div><span>EMBED COUNTER</span><h2>Make it fit anywhere</h2></div><button type="button" title="Reset tutorial" onClick={() => { setCopied(false); setOptions({ watermark: true, compact: false, reset: true, settings: false, theme: "auto" }); }}><RotateCcw /></button></div><div className="embed-layout"><div className="embed-options"><div className="embed-switches">{[["watermark", "Powered by Tally"], ["compact", "Compact size"], ["reset", "Show reset"], ["settings", "Show settings"]].map(([key, label]) => <label key={key}><span>{label}</span><input type="checkbox" checked={options[key]} onChange={() => set(key)} /><i /></label>)}</div><label className="embed-theme">Embed theme<select value={options.theme} onChange={(event) => setOptions((current) => ({ ...current, theme: event.target.value }))}><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label><label className="code-label">Embed code<div className="code-box"><code>{code}</code><button type="button" onClick={() => setCopied(true)}>{copied ? <Check /> : <Copy />}{copied ? "Copied" : "Copy"}</button></div></label></div><div className="preview-wrap"><span>LIVE PREVIEW</span><EmbedPreview counter={counter} options={options} /></div></div></div>;
}

export function LiveTrashLesson() {
  const [trashed, setTrashed] = useState(false);
  const [localOnly, setLocalOnly] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [permanentlyDeleted, setPermanentlyDeleted] = useState(false);
  const [counter, setCounter] = useState(() => tutorialCounter({ id: "guide-storage", name: "Practice tally", value: 4, localOnly: false }));
  const shown = { ...counter, localOnly };
  const reset = () => { setTrashed(false); setLocalOnly(false); setConfirming(false); setPermanentlyDeleted(false); setCounter(tutorialCounter({ id: "guide-storage", name: "Practice tally", value: 4 })); };
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>{trashed || permanentlyDeleted ? "TRASH" : "MY COUNTERS"}</span><button type="button" onClick={reset}><RotateCcw /> Reset</button></div>{!trashed && !permanentlyDeleted && <label className="guide-local-setting"><span><b>Local counter</b><small>Keep this counter on this device only</small></span><input type="checkbox" checked={localOnly} onChange={(event) => setLocalOnly(event.target.checked)} /><i /></label>}{permanentlyDeleted ? <div className="trash-empty"><Trash2 /><b>Trash is empty</b><span>Deleted counters will appear here for five days.</span></div> : <div className={trashed ? "trash-item guide-trash-preview" : "guide-trash-preview"}>{trashed && <div className="trash-toolbar"><span><Trash2 /> Deletes in <b>4 days 23 hours</b></span><button type="button" onClick={() => setTrashed(false)}><RotateCcw /> Restore</button></div>}<CounterCard counter={shown} index={0} showBounds showLocalBanner={!trashed} onChange={(_id, amount) => setCounter((current) => ({ ...current, value: current.value + amount }))} onReset={() => setCounter((current) => ({ ...current, value: current.start }))} onEdit={() => {}} onEmbed={() => {}} onDelete={() => trashed ? setConfirming(true) : setTrashed(true)} /></div>}{confirming && <div className="modal-backdrop trash-confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setConfirming(false)}><div className="modal trash-confirm-modal" role="alertdialog" aria-modal="true" aria-labelledby="guide-trash-confirm-title"><div className="modal-head"><div><span>PERMANENT DELETE</span><h2 id="guide-trash-confirm-title">Delete “Practice tally” forever?</h2></div><button type="button" onClick={() => setConfirming(false)}><X /></button></div><p>This counter cannot be restored after it is permanently deleted.</p><div className="modal-footer"><button className="cancel" type="button" onClick={() => setConfirming(false)}>Cancel</button><button className="save trash-confirm-delete" type="button" onClick={() => { setConfirming(false); setTrashed(false); setPermanentlyDeleted(true); }}><Trash2 /> Delete forever</button></div></div></div>}</div>;
}

export function LiveSharingLesson() {
  const [tab, setTab] = useState("copy");
  const [sharing, setSharing] = useState(false);
  const [sent, setSent] = useState(false);
  const counter = tutorialCounter({ id: "guide-share", name: "Team tally", value: 12 });
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>ONLINE SHARING</span><button type="button" onClick={() => { setSharing(false); setSent(false); }}><RotateCcw /> Reset</button></div><nav className="settings-tabs"><button type="button" className={tab === "copy" ? "active" : ""} onClick={() => setTab("copy")}>Send a copy</button><button type="button" className={tab === "group" ? "active" : ""} onClick={() => setTab("group")}>Group</button></nav>{tab === "copy" ? <div className="guide-copy-start"><CounterCard counter={counter} index={0} showBounds onChange={() => {}} onReset={() => {}} onEdit={() => {}} onEmbed={() => {}} onShare={() => setSharing(true)} onDelete={() => {}} />{sent && <div className="auth-status">Counter copy sent. You’ll be notified when they respond.</div>}<p>Use the paper-plane button on the counter to open the real copy form.</p></div> : <div className="group-settings-panel guide-group-settings"><form onSubmit={(event) => event.preventDefault()}><input value="Weekend walkers" readOnly /><button type="button" className="save">Create group</button></form><select defaultValue="weekend"><option value="weekend">Weekend walkers</option></select><div className="group-member-list"><div><span><b>Demo owner</b><small>Full Access</small></span></div><div><span><b>Alex</b><small>Counting Only</small></span><button type="button">Permissions</button><button type="button" aria-label="Remove Alex"><Trash2 /></button></div></div><div className="group-invite-builder"><input value="friend@example.com" readOnly /><select defaultValue="count_only"><option value="count_only">Counting Only</option><option value="full_access">Full Access</option><option value="custom">Custom</option></select><button type="button" className="save">Invite member</button><button type="button" className="group-delete">Delete group</button></div></div>}{sharing && <ShareCounterModal counter={counter} script={{ language: "tallyscript", source: "add" }} customization={{ parts: {} }} onSend={async () => { setSharing(false); setSent(true); }} onClose={() => setSharing(false)} />}</div>;
}

export function LiveSuperLesson() {
  const [value, setValue] = useState({ snapToZones: true, showEditorLabels: true, items: [] });
  const [editing, setEditing] = useState(false);
  const counters = [tutorialCounter({ id: "guide-super-counter", name: "Goals this week", value: 7, goals: [10] })];
  const update = (id, changes) => setValue((current) => ({ ...current, items: current.items.map((item) => item.id === id ? { ...item, ...changes } : item) }));
  const remove = (id) => setValue((current) => ({ ...current, items: current.items.filter((item) => item.id !== id) }));
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>APP SETTINGS · TALLY SUPER</span><button type="button" onClick={() => { setEditing(false); setValue({ snapToZones: true, showEditorLabels: true, items: [] }); }}><RotateCcw /> Reset</button></div><SuperSettings value={value} onChange={setValue} onStart={() => setEditing(true)} /><div className="guide-super-sandbox"><div data-super-zone="top"><small>TOP BAR</small><SuperZoneContent zone="top" items={value.items} counters={counters} history={[]} onUpdate={update} onRemove={remove} /></div><div data-super-zone="workspace"><small>COUNTERS PAGE</small><SuperZoneContent zone="workspace" items={value.items} counters={counters} history={[]} onUpdate={update} onRemove={remove} /></div><div data-super-zone="bottom"><small>BOTTOM BAR</small><SuperZoneContent zone="bottom" items={value.items} counters={counters} history={[]} onUpdate={update} onRemove={remove} /></div></div>{editing && <SuperEditorPane counters={counters} value={value} onChange={setValue} onClose={() => setEditing(false)} />}</div>;
}
