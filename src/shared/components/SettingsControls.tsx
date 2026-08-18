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
import type { ReactNode } from "react";

export function SettingChoice({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="setting-row choice-row">
      <div>
        <b>{label}</b>
        <small>{description}</small>
      </div>
      <div className="setting-choice">
        {options.map(([key, text]) => (
          <button
            key={key}
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SyncConflictModal({
  deviceCount,
  cloudCount,
  onChoose,
  singletonChoices = {},
  onSingletonChange = () => {},
}: {
  deviceCount: number;
  cloudCount: number;
  onChoose: (choice: "device" | "cloud" | "merge") => void;
  singletonChoices?: { preferences?: "device" | "cloud"; workspace?: "device" | "cloud"; folders?: "device" | "cloud" };
  onSingletonChange?: (key: "preferences" | "workspace" | "folders", value: "device" | "cloud") => void;
}) {
  const mergeReady = singletonChoices.preferences && singletonChoices.workspace && singletonChoices.folders;
  return (
    <div className="modal-backdrop sync-conflict-backdrop">
      <div
        className="modal sync-conflict-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
      >
        <div className="modal-head">
          <div>
            <span>SYNC CONFLICT</span>
            <h2 id="sync-conflict-title">Which counters should Tally keep?</h2>
          </div>
        </div>
        <p className="sync-conflict-intro">
          This device and your account both contain counters. Nothing will be
          overwritten until you choose.
        </p>
        <div className="sync-conflict-options">
          <label>Preferences<select aria-label="Conflict preferences" value={singletonChoices.preferences || ""} onChange={(event) => onSingletonChange("preferences", event.target.value as "device" | "cloud")}><option value="">Choose…</option><option value="device">Keep device</option><option value="cloud">Use cloud</option></select></label>
          <label>Workspace customization<select aria-label="Conflict workspace customization" value={singletonChoices.workspace || ""} onChange={(event) => onSingletonChange("workspace", event.target.value as "device" | "cloud")}><option value="">Choose…</option><option value="device">Keep device</option><option value="cloud">Use cloud</option></select></label>
          <label>Folder collisions<select aria-label="Conflict folder collisions" value={singletonChoices.folders || ""} onChange={(event) => onSingletonChange("folders", event.target.value as "device" | "cloud")}><option value="">Choose…</option><option value="device">Keep device</option><option value="cloud">Use cloud</option></select></label>
          <button onClick={() => onChoose("device")}>
            <strong>Keep device version</strong>
            <span>
              Upload these {deviceCount} counter
              {deviceCount === 1 ? "" : "s"} and replace the cloud copy.
            </span>
          </button>
          <button onClick={() => onChoose("cloud")}>
            <strong>Use cloud version</strong>
            <span>
              Load the {cloudCount} counter{cloudCount === 1 ? "" : "s"} from
              your account onto this device.
            </span>
          </button>
          <button disabled={!mergeReady} onClick={() => onChoose("merge")}>
            <strong>Merge both</strong>
            <span>
              Keep counters from both places. Conflicting cloud copies are
              clearly labeled.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
