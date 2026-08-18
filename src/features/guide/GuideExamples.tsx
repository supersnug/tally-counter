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
import { useState } from "react";
import { RotateCcw } from "lucide-react";
import { CounterCard } from "../counters/CounterCard";
import { COLORS } from "../counters/model";
import { SettingChoice } from "../../shared/components/SettingsControls";
import { SettingToggle } from "../../shared/components/SettingToggle";
export { LiveCounterLesson, LiveGoalLesson, LiveAutomationLesson, LiveAccountLesson, LiveBackupLesson, LiveEmbedLesson, LiveTrashLesson, LiveSharingLesson, LiveSuperLesson } from "./GuideExamplesLegacy";

export function LiveSettingsLesson() {
  const [preferences, setPreferences] = useState({ density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true });
  const set = (key: string, value: string | boolean) => setPreferences((current) => ({ ...current, [key]: value }));
  const counter = { id: "guide-settings", name: "Reading tracker", value: 24, start: 0, plusStep: 1, minusStep: 1, goals: [30], goalDirection: "more", min: 0, max: 40, color: COLORS[1] };
  return <div className="guide-feature-demo guide-settings-demo"><div className="guide-live-head"><span>APP SETTINGS · CUSTOMIZE</span><button type="button" onClick={() => setPreferences({ density: "comfortable", columns: "auto", numberSize: "standard", showBounds: true, animations: true })}><RotateCcw /> Reset</button></div><div className="guide-settings-layout"><div className="settings-section customize-settings"><SettingChoice label="Card spacing" description="Choose how much room each counter uses." value={preferences.density} options={[["compact", "Compact"], ["comfortable", "Comfortable"], ["spacious", "Spacious"]]} onChange={(value) => set("density", value)} /><SettingChoice label="Grid columns" description="Control the dashboard layout on larger screens." value={preferences.columns} options={[["auto", "Automatic"], ["2", "Two"], ["3", "Three"]]} onChange={(value) => set("columns", value)} /><SettingChoice label="Number size" description="Adjust the main count to suit your layout." value={preferences.numberSize} options={[["small", "Small"], ["standard", "Standard"], ["large", "Large"]]} onChange={(value) => set("numberSize", value)} /><SettingToggle label="Counter details" description="Show minimum and maximum labels on cards." checked={preferences.showBounds} onChange={(checked) => set("showBounds", checked)} /><SettingToggle label="Animations" description="Animate cards and progress changes." checked={preferences.animations} onChange={(checked) => set("animations", checked)} /></div><div className={`guide-settings-counter density-${preferences.density} number-${preferences.numberSize}`}><CounterCard counter={counter} index={0} showBounds={preferences.showBounds} onChange={() => {}} onReset={() => {}} onEdit={() => {}} onEmbed={() => {}} onDelete={() => {}} /></div></div></div>;
}
