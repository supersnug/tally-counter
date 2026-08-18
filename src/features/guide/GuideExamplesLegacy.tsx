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
import { Check, Cloud, Pause, Play, RotateCcw, Trash2, UserRound } from "lucide-react";
import { CounterCard } from "../counters/CounterCard";
import { COLORS, getGoals, type AnyRecord } from "../counters/model";
import { EmbedPreview } from "../embed/EmbedComponents";
import { ShareCounterModal } from "../sharing/CopySharing";
import { SuperEditorPane, SuperSettings, SuperZoneContent } from "../tally-super/TallySuper";
import { SettingToggle } from "../../shared/components/SettingToggle";
// Shared toggle markup is checkbox, empty track, then text: <input type="checkbox" /><i aria-hidden="true" /><span>{label}</span>.

const tutorialCounter = (overrides: AnyRecord = {}) => ({ id: "guide-demo", name: "My first tally", value: 0, start: 0, plusStep: 1, minusStep: 1, goals: [5, 10], goalDirection: "more", min: 0, max: null, color: COLORS[1], ...overrides });

export function LiveCounterLesson() {
  const [counter, setCounter] = useState(() => tutorialCounter());
  const change = (amount: number) => setCounter((current) => ({ ...current, value: Math.max(current.min ?? -Infinity, Math.min(current.max ?? Infinity, current.value + amount)) }));
  return <div className="guide-live-example"><div className="guide-live-head"><span>LIVE COUNTER</span><button type="button" onClick={() => setCounter(tutorialCounter())}><RotateCcw /> Restart lesson</button></div><CounterCard counter={counter} index={0} showBounds onChange={(_id, amount) => change(amount)} onReset={() => setCounter((current) => ({ ...current, value: current.start }))} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /><p>{counter.value >= 5 ? <><Check /> First goal complete—keep going to 10.</> : <>Press + until the counter reaches its first goal at 5.</>}</p></div>;
}

export function LiveGoalLesson() {
  const [direction, setDirection] = useState("more"); const [value, setValue] = useState(0);
  const counter = tutorialCounter({ id: "guide-goals", name: direction === "more" ? "Upward goals" : "Downward goals", value, goals: direction === "more" ? [5, 10, 20] : [-5, -10, -20], goalDirection: direction, min: direction === "more" ? 0 : -25, max: direction === "more" ? 25 : 0, color: COLORS[4] });
  return <div className="guide-live-example"><div className="guide-live-head"><span>GOAL PLAYGROUND</span><div className="guide-live-choice"><button type="button" className={direction === "more" ? "active" : ""} onClick={() => { setDirection("more"); setValue(0); }}>More than</button><button type="button" className={direction === "less" ? "active" : ""} onClick={() => { setDirection("less"); setValue(0); }}>Less than</button></div></div><CounterCard counter={counter} index={0} showBounds onChange={(_id, amount) => setValue((current) => Math.max(counter.min, Math.min(counter.max, current + amount)))} onReset={() => setValue(0)} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /><p>Goals are ordered in the direction the counter is traveling: {getGoals(counter).join(" → ")}.</p></div>;
}

export function LiveAutomationLesson() {
  const [value, setValue] = useState(0); const [running, setRunning] = useState(false); const timer = useRef<number | null>(null);
  useEffect(() => { if (!running) return; timer.current = window.setInterval(() => setValue((current) => current + 1), 700); return () => { if (timer.current) window.clearInterval(timer.current); }; }, [running]);
  return <div className="guide-automation-demo"><div><span>SIMULATED TALLYSCRIPT</span><strong>{value}</strong><small>{running ? "Incrementing in the background" : "Script stopped"}</small></div><button type="button" onClick={() => setRunning((current) => !current)}>{running ? <><Pause /> Stop script</> : <><Play /> Run script</>}</button><button type="button" onClick={() => { setRunning(false); setValue(0); }}><RotateCcw /> Reset</button></div>;
}

export function LiveAccountLesson() {
  const [step, setStep] = useState<"signed-out" | "conflict" | "synced">("signed-out");
  return <div className="guide-account-demo">{step === "signed-out" ? <form onSubmit={(event) => { event.preventDefault(); setStep("conflict"); }}><UserRound /><strong>Sign in to Tally</strong><small>This form is a simulation. Nothing is transmitted or stored.</small><label>Email or username<input aria-label="Tutorial email or username" value="demo@tally.local" readOnly /></label><label>Password<input aria-label="Tutorial password" type="password" value="Tally-demo-1!" readOnly /></label><button type="submit">Simulate sign in</button></form> : step === "conflict" ? <div className="guide-sync-choice"><Cloud /><strong>Choose which counters to synchronize</strong><p>This device has 3 counters. The simulated account has 2 cloud counters.</p><button type="button" onClick={() => setStep("synced")}>Merge both</button><button type="button" onClick={() => setStep("synced")}>Keep this device's counters</button><button type="button" onClick={() => setStep("synced")}>Use cloud counters</button></div> : <div className="guide-sync-complete"><Check /><strong>Signed in and synchronized</strong></div>}</div>;
}

export function LiveBackupLesson() {
  const [action, setAction] = useState("");
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>APP SETTINGS · BACKUP &amp; TRANSFER</span><button type="button" onClick={() => setAction("")}><RotateCcw /> Reset</button></div><p className="utility-intro">Choose exactly which part of Tally to transfer. Importing replaces only the selected data on this device.</p><button type="button" onClick={() => setAction("export")}>Export</button><button type="button" onClick={() => setAction("import")}>Import</button>{action && <div className="modal-backdrop"><div className="modal backup-option-modal" role="dialog" aria-modal="true"><h2>Include linked data?</h2><p>Choose which counter-linked data should be included with this {action}.</p><label><input type="checkbox" /> <span>Include scripts</span></label><label><input type="checkbox" /> <span>Include per-counter customizations</span></label><button type="button" onClick={() => setAction("")}>Cancel</button></div></div>}</div>;
}

export function LiveEmbedLesson() {
  const [options, setOptions] = useState({ watermark: true, compact: false, reset: true, settings: false, theme: "auto" }); const [copied, setCopied] = useState(false); const counter = tutorialCounter({ id: "guide-embed", name: "Water intake", value: 6, goals: [8], color: "#2f7e70" });
  const toggle = (key: string) => setOptions((current) => ({ ...current, [key]: !current[key] }));
  const code = `<iframe src="https://tally.example/embed?data=…" width="100%" height="${options.compact ? 210 : 310}" frameborder="0" title="Water intake tally counter"></iframe>`;
  return <div className="guide-feature-demo modal embed-modal"><div className="embed-switches">{[["watermark", "Powered by Tally"], ["compact", "Compact size"], ["reset", "Show reset"], ["settings", "Show settings"]].map(([key, label]) => <SettingToggle key={key} checked={Boolean(options[key])} label={label} onChange={() => toggle(key)} />)}</div><label>Embed theme<select value={options.theme} onChange={(event) => setOptions((current) => ({ ...current, theme: event.target.value }))}><option value="auto">Match device</option><option value="light">Light</option><option value="dark">Dark</option></select></label><code>{code}</code><button type="button" onClick={() => setCopied(true)}>{copied ? "Copied" : "Copy"}</button><EmbedPreview counter={counter} options={options} /></div>;
}

export function LiveTrashLesson() {
  const [trashed, setTrashed] = useState(false); const [localOnly, setLocalOnly] = useState(false); const [deleted, setDeleted] = useState(false); const [confirming, setConfirming] = useState(false); const [counter, setCounter] = useState(() => tutorialCounter({ id: "guide-storage", name: "Practice tally", value: 4 }));
  const shown = { ...counter, localOnly }; const reset = () => { setTrashed(false); setDeleted(false); setLocalOnly(false); setCounter(tutorialCounter({ id: "guide-storage", name: "Practice tally", value: 4 })); };
  return <div className="guide-feature-demo"><div className="guide-live-head"><span>{trashed || deleted ? "TRASH" : "MY COUNTERS"}</span><button type="button" onClick={reset}><RotateCcw /> Reset</button></div>{!trashed && !deleted && <SettingToggle checked={localOnly} label="Local counter" onChange={setLocalOnly} />}{deleted ? <div className="trash-empty"><Trash2 /><b>Trash is empty</b></div> : <div className={trashed ? "trash-item" : "guide-trash-preview"}>{trashed && <div className="trash-toolbar"><span><Trash2 /> Deletes in <b>4 days 23 hours</b></span><button type="button" onClick={() => setTrashed(false)}>Restore</button></div>}<CounterCard counter={shown} index={0} showBounds showLocalBanner={!trashed} onChange={(_id, amount) => setCounter((current) => ({ ...current, value: current.value + amount }))} onReset={() => setCounter((current) => ({ ...current, value: current.start }))} onEdit={() => {}} onEmbed={() => {}} onDelete={() => trashed ? setConfirming(true) : setTrashed(true)} /></div>}{confirming && <div className="modal-backdrop"><div className="modal trash-confirm-modal" role="alertdialog" aria-modal="true" aria-label="Delete “Practice tally” forever"><p>This counter cannot be restored after it is permanently deleted.</p><button type="button" onClick={() => setConfirming(false)}>Cancel</button><button type="button" onClick={() => { setDeleted(true); setConfirming(false); }}>Delete forever</button></div></div>}</div>;
}

export function LiveSharingLesson() { const [sharing, setSharing] = useState(false); const counter = tutorialCounter({ id: "guide-share", name: "Team tally", value: 12 }); return <div className="guide-feature-demo"><span>ONLINE SHARING</span><CounterCard counter={counter} index={0} showBounds onChange={() => {}} onReset={() => {}} onEdit={() => {}} onEmbed={() => {}} onShare={() => setSharing(true)} onDelete={() => {}} />{sharing && <ShareCounterModal counter={counter} script={{ language: "tallyscript", source: "add" }} customization={{}} onSend={viableSend} onClose={() => setSharing(false)} />}</div>; }
const viableSend = async () => undefined;
export function LiveSuperLesson() { const [editing, setEditing] = useState(false); const [value, setValue] = useState({ snapToZones: true, showEditorLabels: true, items: [] }); const counters = [tutorialCounter({ id: "guide-super-counter", name: "Goals this week", value: 7 })]; return <div className="guide-feature-demo"><span>APP SETTINGS · TALLY SUPER</span><SuperSettings value={value} onChange={setValue} onStart={() => setEditing(true)} />{editing && <SuperEditorPane counters={counters} value={value} onChange={setValue} onClose={() => setEditing(false)} /> }<SuperZoneContent zone="workspace" items={value.items} counters={counters} history={[]} onUpdate={() => {}} onRemove={() => {}} /></div>; }
