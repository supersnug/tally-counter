import { useRef, useState } from "react";
import { Download, Upload, X } from "lucide-react";
import { type AnyRecord } from "../counters/model";
import { SettingChoice } from "../../shared/components/SettingsControls";
import {
  SuperSettings,
  SuperZoneContent,
} from "../tally-super/TallySuper";

export function AppSettings({
  counters,
  history,
  preferences,
  superSettings,
  scripts,
  onStartSuperEditor,
  onSuperSettings,
  onPreferences,
  onImport,
  onClose,
}) {
  const [status, setStatus] = useState("");
  const [section, setSection] = useState("customize");
  const [includeCounterCustomizations, setIncludeCounterCustomizations] =
    useState(false);
  const [includeScripts, setIncludeScripts] = useState(false);
  const [counterTransferAction, setCounterTransferAction] = useState("");
  const counterImportRef = useRef(null);
  const preference = (key, value) =>
    onPreferences((current) => ({ ...current, [key]: value }));
  const exportData = (scope) => {
    const data: AnyRecord = {
      version: 3,
      scope,
      exportedAt: new Date().toISOString(),
    };
    if (scope === "counters" || scope === "all") data.counters = counters;
    if (scope === "counters" && includeCounterCustomizations)
      data.counterCustomizations = superSettings.counterCustomizations || {};
    if (scope === "counters" && includeScripts) data.scripts = scripts;
    if (scope === "super" || scope === "all") {
      data.tallySuper =
        scope === "super"
          ? { uiCustomizations: superSettings.uiCustomizations || {} }
          : superSettings;
      data.preferences = preferences;
    }
    if (scope === "all") data.scripts = scripts;
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
      const data = JSON.parse(await file.text());
      if (
        onImport(data, scope, {
          includeCounterCustomizations,
          includeScripts,
        })
      )
        setStatus(
          `${scope === "all" ? "All data" : scope === "super" ? "Tally Super settings" : "Counters"} imported successfully.`,
        );
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
              <div className="setting-row">
                <div>
                  <b>Counter details</b>
                  <small>Show minimum and maximum labels on cards.</small>
                </div>
                <button
                  className={`setting-switch ${preferences.showBounds ? "active" : ""}`}
                  onClick={() =>
                    preference("showBounds", !preferences.showBounds)
                  }
                >
                  <i></i>
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <b>Animations</b>
                  <small>Animate cards and progress changes.</small>
                </div>
                <button
                  className={`setting-switch ${preferences.animations ? "active" : ""}`}
                  onClick={() =>
                    preference("animations", !preferences.animations)
                  }
                >
                  <i></i>
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <b>Trash</b>
                  <small>
                    Keep deleted counters for five days before removing them
                    permanently.
                  </small>
                </div>
                <button
                  className={`setting-switch ${preferences.trashEnabled ? "active" : ""}`}
                  onClick={() =>
                    preference("trashEnabled", !preferences.trashEnabled)
                  }
                >
                  <i></i>
                </button>
              </div>
              <div className="setting-row">
                <div>
                  <b>Save Trash to cloud</b>
                  <small>
                    Sync deleted counters between signed-in devices.
                  </small>
                </div>
                <button
                  className={`setting-switch ${preferences.syncTrash ? "active" : ""}`}
                  onClick={() =>
                    preference("syncTrash", !preferences.syncTrash)
                  }
                >
                  <i></i>
                </button>
              </div>
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
