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
import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { type AnyRecord } from "../counters/model";
import { SettingChoice } from "../../shared/components/SettingsControls";
import { SettingToggle } from "../../shared/components/SettingToggle";
import {
  SuperSettings,
  SuperZoneContent,
} from "../tally-super/TallySuper";
import { createBackup } from "./backup";
import { prepareImport } from "./backupImport";

export function AppSettings({
  counters,
  history,
  preferences,
  superSettings,
  scripts,
  trash = [],
  folders = [],
  destinationRevision = "",
  onStartSuperEditor,
  onSuperSettings,
  onPreferences,
  onImport: onImportRequest,
  onClose,
}) {
  const onImport = (session, _scope, options) => onImportRequest(session, options);
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("customize");
  const [includeCounterCustomizations, setIncludeCounterCustomizations] =
    useState(false);
  const [includeScripts, setIncludeScripts] = useState(false);
  const [counterTransferAction, setCounterTransferAction] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [selectedCounterIds, setSelectedCounterIds] = useState(() => new Set(counters.map((counter) => String(counter.id))));
  const counterImportRef = useRef(null);
  const preference = (key, value) =>
    onPreferences((current) => ({ ...current, [key]: value }));
  const exportData = (scope) => {
    const data = createBackup({ counters, trash, folders, preferences, superSettings, scripts, counterCustomizations: superSettings.counterCustomizations }, scope === "counters" ? "counters" : scope === "super" ? "super" : "all", { includeCounterCustomizations, includeScripts, selectedIds: [...selectedCounterIds] });
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tally-${scope}-backup.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };
  const importData = async (event, scope) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const selectedScope = scope === "counters" ? "counters" : scope === "super" ? "super" : "all";
       const session = prepareImport(JSON.parse(await file.text()), selectedScope, destinationRevision);
         setPendingImport({ session, compatible: session, scope, options: { includeCounterCustomizations: Boolean(session.candidate.sections.counterCustomizations), includeScripts: Boolean(session.candidate.sections.scripts) } });
    } catch (error) {
      setStatus(
        error instanceof SyntaxError
          ? "That file is not valid JSON."
          : error.message,
      );
    } finally {
      event.target.value = "";
       if (scope === "counters") setCounterTransferAction("");
    }
  };
  return (
    <>
      <div
        className="modal-backdrop"
        onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      >
        <div
          className={`modal utility-modal settings-modal ${section === "super" ? "super-open" : ""}`}
        >
          <div className="modal-head">
            <div>
              <span>APP SETTINGS</span>
              <h2>Make Tally yours</h2>
            </div>
            <button onClick={onClose}>
              <X />
            </button>
          </div>
          <SuperZoneContent
            zone="settings"
            items={superSettings.uiCustomizations.items}
            counters={counters}
            history={history}
          />
          <nav className="settings-tabs">
            <button
              className={section === "customize" ? "active" : ""}
              onClick={() => setSection("customize")}
            >
              Customize
            </button>
            <button
              className={section === "super" ? "active" : ""}
              onClick={() => setSection("super")}
            >
              Tally Super
            </button>
            <button
              className={section === "backup" ? "active" : ""}
              onClick={() => setSection("backup")}
            >
              Backup & transfer
            </button>
          </nav>
          {section === "backup" ? (
            <div className="settings-section">
              <p className="utility-intro">
                Choose exactly which part of Tally to transfer. Importing
                replaces only the selected data on this device.
              </p>
              <div className="backup-groups">
                {[
                  [
                    "counters",
                    "Counters",
                    "Counter values, goals, limits, and colors",
                  ],
                  [
                    "super",
                    "Tally Super",
                    "UI customizations and app customization settings",
                  ],
                  [
                    "all",
                    "All Tally data",
                    "Counters, scripts, Super data, and customization settings",
                  ],
                ].map(([scope, title, description]) => (
                  <div className="backup-group" key={scope}>
                    <div>
                      <b>{title}</b>
                      <small>{description}</small>
                    </div>
                    <div>
                      <button
                        onClick={() =>
                          scope === "counters"
                            ? setCounterTransferAction("export")
                            : exportData(scope)
                        }
                      >
                        <Download /> Export
                      </button>
                      {scope === "counters" ? (
                        <>
                          <button
                            onClick={() => setCounterTransferAction("import")}
                          >
                            <Upload /> Import
                          </button>
                          <input
                            ref={counterImportRef}
                            type="file"
                            hidden
                            accept="application/json,.json"
                            onChange={(event) => importData(event, scope)}
                          />
                        </>
                      ) : (
                        <label>
                          <Upload /> Import
                          <input
                            type="file"
                            hidden
                            accept="application/json,.json"
                            onChange={(event) => importData(event, scope)}
                          />
                        </label>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {status && <div className="utility-status">{status}</div>}
               {pendingImport && <div className="modal-backdrop backup-option-backdrop"><div className="modal backup-option-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><span>IMPORT PREVIEW</span><h2>{pendingImport.scope === "all" ? "All Tally data" : pendingImport.scope === "super" ? "Tally Super settings" : "Counter backup"}</h2></div><button type="button" onClick={() => setPendingImport(null)}><X /></button></div><p>Exported {new Date(pendingImport.session.candidate.exportedAt).toLocaleString()}.</p><p>Included sections: {pendingImport.session.candidate.included.join(", ") || "none"}.</p><p>Replace: {pendingImport.session.replacements.join(", ")}. Preserved: {pendingImport.session.excluded.join(", ")}.</p>{pendingImport.scope === "counters" && pendingImport.session.candidate.sections.scripts && <label><input type="checkbox" checked={pendingImport.options.includeScripts} onChange={(event) => setPendingImport((current) => current && ({ ...current, options: { ...current.options, includeScripts: event.target.checked } }))} /> Import scripts</label>}{pendingImport.scope === "counters" && pendingImport.session.candidate.sections.counterCustomizations && <label><input type="checkbox" checked={pendingImport.options.includeCounterCustomizations} onChange={(event) => setPendingImport((current) => current && ({ ...current, options: { ...current.options, includeCounterCustomizations: event.target.checked } }))} /> Import counter customizations</label>}{pendingImport.options.includeScripts && <p role="alert">Included scripts are untrusted personal data and are not encrypted.</p>}<div className="modal-footer"><button type="button" className="cancel" onClick={() => setPendingImport(null)}>Cancel</button><button type="button" className="save" onClick={async () => { try { const imported = await onImport(pendingImport.compatible, pendingImport.scope, pendingImport.options); if (imported) { setStatus(`${pendingImport.scope === "all" ? "All data" : pendingImport.scope === "super" ? "Tally Super settings" : "Counters"} imported successfully.`); setPendingImport(null); } } catch (error) { setStatus(error instanceof Error ? error.message : "Import failed."); } }}>Confirm import</button></div></div></div>}
            </div>
          ) : section === "super" ? (
            <SuperSettings
              value={superSettings.uiCustomizations}
              onChange={(uiCustomizations) =>
                onSuperSettings((current) => ({ ...current, uiCustomizations }))
              }
              onStart={onStartSuperEditor}
            />
          ) : (
            <div className="settings-section customize-settings">
              <SettingChoice
                label="Card spacing"
                description="Choose how much room each counter uses."
                value={preferences.density}
                options={[
                  ["compact", "Compact"],
                  ["comfortable", "Comfortable"],
                  ["spacious", "Spacious"],
                ]}
                onChange={(value) => preference("density", value)}
              />
              <SettingChoice
                label="Grid columns"
                description="Control the dashboard layout on larger screens."
                value={preferences.columns}
                options={[
                  ["auto", "Automatic"],
                  ["2", "Two"],
                  ["3", "Three"],
                  ["4", "Four"],
                ]}
                onChange={(value) => preference("columns", value)}
              />
              <SettingChoice
                label="Number size"
                description="Adjust the main count to suit your layout."
                value={preferences.numberSize}
                options={[
                  ["small", "Small"],
                  ["standard", "Standard"],
                  ["large", "Large"],
                ]}
                onChange={(value) => preference("numberSize", value)}
              />
              <SettingToggle label="Counter details" description="Show minimum and maximum labels on cards." checked={preferences.showBounds} onChange={(checked) => preference("showBounds", checked)} />
              <SettingToggle label="Animations" description="Animate cards and progress changes." checked={preferences.animations} onChange={(checked) => preference("animations", checked)} />
              <SettingToggle label="Trash" description="Keep deleted counters for five days before removing them permanently." checked={preferences.trashEnabled} onChange={(checked) => preference("trashEnabled", checked)} />
              <SettingToggle label="Save Trash to cloud" description="Sync deleted counters between signed-in devices." checked={preferences.syncTrash} onChange={(checked) => preference("syncTrash", checked)} />
              <div className="setting-row">
                <div>
                  <b>Default counter color</b>
                  <small>Used when creating a new counter.</small>
                </div>
                <input
                  className="default-color"
                  type="color"
                  value={preferences.defaultColor}
                  onChange={(e) => preference("defaultColor", e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>
      {counterTransferAction && (
        <div
          className="modal-backdrop backup-option-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setCounterTransferAction("")
          }
        >
          <div className="modal backup-option-modal">
            <div className="modal-head">
              <div>
                <span>COUNTER {counterTransferAction.toUpperCase()}</span>
                <h2>Include linked data?</h2>
              </div>
              <button onClick={() => setCounterTransferAction("")}>
                <X />
              </button>
            </div>
            <p>
              Choose which counter-linked data should be included with this
              {` ${counterTransferAction}`}.
            </p>
            <fieldset className="backup-counter-selection">
              <legend>Active counters to include</legend>
              {counters.map((counter) => <label key={counter.id}>
                <input type="checkbox" checked={selectedCounterIds.has(String(counter.id))} onChange={(event) => setSelectedCounterIds((current) => { const next = new Set(current); if (event.target.checked) next.add(String(counter.id)); else next.delete(String(counter.id)); return next; })} />
                <span>{counter.name}</span>
              </label>)}
            </fieldset>
            <label className="backup-customization-toggle">
              <input
                type="checkbox"
                checked={includeCounterCustomizations}
                onChange={(event) =>
                  setIncludeCounterCustomizations(event.target.checked)
                }
              />
              <i></i>
              <span>
                <b>Include per-counter customizations</b>
                <small>
                  {counterTransferAction === "export"
                    ? "Add them to this counter backup."
                    : "Restore them from the selected counter backup."}
                </small>
              </span>
            </label>
            <label className="backup-customization-toggle">
              <input
                type="checkbox"
                checked={includeScripts}
                onChange={(event) => setIncludeScripts(event.target.checked)}
              />
              <i></i>
              <span>
                <b>Include scripts</b>
                <small>
                  {counterTransferAction === "export"
                    ? "Add counter-linked scripts to this backup."
                    : "Restore counter-linked scripts from this backup."}
                </small>
              </span>
            </label>
            <div className="modal-footer">
              <button
                className="cancel"
                onClick={() => setCounterTransferAction("")}
              >
                Cancel
              </button>
              <button
                className="save"
                onClick={() => {
                  if (!selectedCounterIds.size) return;
                  if (counterTransferAction === "export") {
                    exportData("counters");
                    setCounterTransferAction("");
                  } else counterImportRef.current?.click();
                }}
              >
                {counterTransferAction === "export"
                  ? "Export counters"
                  : "Choose file"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
