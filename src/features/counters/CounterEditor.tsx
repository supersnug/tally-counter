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
import { Check, Plus, RotateCcw, Sparkles, Trash2, X } from "lucide-react";
import { COLORS, COUNTER_SUPER_PARTS, getGoals, type AnyRecord } from "./model";
import { CounterCard } from "./CounterCard";
import { TallyScriptEditor } from "../scripting/TallyScriptEditor";
import { SettingToggle } from "../../shared/components/SettingToggle";

const superPermissionForPart = (key) => ({
  embed: "superedit_embed", reset: "superedit_reset",
  settings: "superedit_settings", delete: "superedit_delete",
  title: "superedit_title", count: "superedit_count", goal: "superedit_goal",
  add: "superedit_add", subtract: "superedit_sub",
  minimum: "superedit_min_indicator", maximum: "superedit_max_indicator",
  "quick-plusStep": "superedit_posstep", "quick-minusStep": "superedit_negstep",
  "quick-min": "superedit_min_setting", "quick-max": "superedit_max_setting",
  "quick-color": "superedit_color", "quick-goalDirection": "superedit_goaldir",
})[key];

function CounterSuperInspector({
  value = {},
  onChange,
  selectedFromStage,
  permissions,
}: AnyRecord) {
  const canEdit = (key) => !permissions || permissions.has(superPermissionForPart(key));
  const activeQuick = value.quickSettings || [];
  const quickLabels = {
    plusStep: "Positive step",
    minusStep: "Negative step",
    min: "Minimum",
    max: "Maximum",
    color: "Color",
    goalDirection: "Goal direction",
  };
  const [selected, setSelected] = useState(
      selectedFromStage || COUNTER_SUPER_PARTS.find(([key]) => canEdit(key))?.[0] || "title",
    ),
    parts = value.parts || {},
    definition = COUNTER_SUPER_PARTS.find(([key]) => key === selected),
    part = parts[selected] || {};
  useEffect(() => {
    if (selectedFromStage) setSelected(selectedFromStage);
  }, [selectedFromStage]);
  useEffect(() => {
    if (
      selected.startsWith("quick-") &&
      !activeQuick.includes(selected.slice(6))
    )
      setSelected("title");
  }, [activeQuick.join("|"), selected]);
  const update = (changes) => {
    if (selected.startsWith("quick-") && changes.hidden) {
      const key = selected.slice(6);
      onChange?.({
        ...value,
        quickSettings: activeQuick.filter((item) => item !== key),
        parts: { ...parts, [selected]: {} },
      });
      setSelected("title");
      return;
    }
    onChange?.({
      ...value,
      parts: { ...parts, [selected]: { ...part, ...changes } },
    });
  };
  const quick = value.quickSettings || [];
  const toggleQuick = (key) => {
    const partKey = `quick-${key}`,
      enabled = quick.includes(key);
    onChange?.({
      ...value,
      quickSettings: enabled
        ? quick.filter((item) => item !== key)
        : [...quick, key],
      parts: {
        ...parts,
        [partKey]: enabled ? {} : { ...parts[partKey], hidden: false },
      },
    });
  };
  return (
    <div className="counter-super-editor">
      <div className="counter-super-toolbox">
        <span className="super-logo">
          <Sparkles /> TALLY SUPER
        </span>
        <small>Choose a counter element to transform.</small>
        {COUNTER_SUPER_PARTS.map(([key, label, deletable, fixed]) => {
          const quickKey = key.startsWith("quick-") ? key.slice(6) : "";
          const visibleLabel = quickKey
            ? activeQuick.includes(quickKey) ? `Quick setting · ${quickLabels[quickKey]}` : ""
            : label;
          return (
          <button
            type="button"
            key={key}
            disabled={!canEdit(key)}
            className={`${selected === key ? "active" : ""} ${part.hidden ? "hidden" : ""}`}
            onClick={() => setSelected(key)}
          >
            <span>{visibleLabel}</span>
            <small>
              {fixed ? "Fixed size" : deletable ? "Optional" : "Required"}
            </small>
          </button>
          );
        })}
      </div>
      <div className="counter-super-inspector">
        <div
          className="counter-part-preview"
          style={{
            transform: `translate(${part.x || 0}px,${part.y || 0}px) rotate(${part.rotation || 0}deg) scale(${part.scaleX || 1},${part.scaleY || 1})`,
          }}
        >
          {definition?.[1]}
        </div>
        <div className="counter-transform-grid">
          <label>
            X position
            <input
              type="range"
              min="-120"
              max="120"
              value={part.x || 0}
              onChange={(event) => update({ x: Number(event.target.value) })}
            />
            <b>{part.x || 0}px</b>
          </label>
          <label>
            Y position
            <input
              type="range"
              min="-120"
              max="120"
              value={part.y || 0}
              onChange={(event) => update({ y: Number(event.target.value) })}
            />
            <b>{part.y || 0}px</b>
          </label>
          <label>
            Rotation
            <input
              type="range"
              min="-180"
              max="180"
              value={part.rotation || 0}
              onChange={(event) =>
                update({ rotation: Number(event.target.value) })
              }
            />
            <b>{part.rotation || 0}°</b>
          </label>
          {!definition?.[3] &&
            selected !== "add" &&
            selected !== "subtract" && (
              <>
                <label>
                  Width scale
                  <input
                    type="range"
                    min="25"
                    max="400"
                    value={(part.scaleX || 1) * 100}
                    onChange={(event) =>
                      update({ scaleX: Number(event.target.value) / 100 })
                    }
                  />
                  <b>{Math.round((part.scaleX || 1) * 100)}%</b>
                </label>
                <label>
                  Height scale
                  <input
                    type="range"
                    min="25"
                    max="400"
                    value={(part.scaleY || 1) * 100}
                    onChange={(event) =>
                      update({ scaleY: Number(event.target.value) / 100 })
                    }
                  />
                  <b>{Math.round((part.scaleY || 1) * 100)}%</b>
                </label>
              </>
            )}
          {(selected === "add" || selected === "subtract") && (
            <>
              <label>
                Button width
                <input
                  type="range"
                  min="70"
                  max="280"
                  value={part.width || 140}
                  onChange={(event) =>
                    update({ width: Number(event.target.value) })
                  }
                />
                <b>{part.width || 140}px</b>
              </label>
              <label>
                Button height
                <input
                  type="range"
                  min="40"
                  max="140"
                  value={part.height || 62}
                  onChange={(event) =>
                    update({ height: Number(event.target.value) })
                  }
                />
                <b>{part.height || 62}px</b>
              </label>
            </>
          )}
        </div>
        <div className="counter-part-actions">
          {definition?.[2] && (
            <button
              type="button"
              className={part.hidden ? "restore" : ""}
              onClick={() => update({ hidden: !part.hidden })}
            >
              {part.hidden ? (
                <>
                  <Plus /> Restore element
                </>
              ) : (
                <>
                  <Trash2 /> Delete element
                </>
              )}
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              onChange?.({ ...value, parts: { ...parts, [selected]: {} } })
            }
          >
            <RotateCcw /> Reset transform
          </button>
        </div>
        <div className="quick-settings-builder">
          <b>Quick settings</b>
          <small>Add live controls directly to this counter.</small>
          <div>
            {[
              ["plusStep", "Positive step"],
              ["minusStep", "Negative step"],
              ["min", "Minimum"],
              ["max", "Maximum"],
              ["color", "Color"],
              ["goalDirection", "Goal direction"],
            ].map(([key, label]) => (
              <button
                type="button"
                key={key}
                disabled={!canEdit(`quick-${key}`)}
                className={quick.includes(key) ? "active" : ""}
                onClick={() => toggleQuick(key)}
              >
                {quick.includes(key) ? <Check /> : <Plus />}
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CounterSuperCustomization({
  counter,
  value = {},
  onChange,
  onDone,
  permissions,
}: AnyRecord) {
  const [selected, setSelected] = useState(
    COUNTER_SUPER_PARTS.find(([key]) =>
      !permissions || permissions.has(superPermissionForPart(key)),
    )?.[0] || "title",
  );
  const [sourceStyle, setSourceStyle] = useState(null);
  useEffect(() => {
    const source = [
      ...document.querySelectorAll(`[data-counter-id="${counter.id}"]`),
    ].find((element) => !element.closest(".counter-super-card-wrap"));
    if (!source) return;
    const cardStyle = getComputedStyle(source),
      numberStyle = getComputedStyle(source.querySelector(".number")),
      buttonStyle = getComputedStyle(source.querySelector(".count-button")),
      box = source.getBoundingClientRect();
    setSourceStyle({
      width: box.width,
      height: box.height,
      padding: cardStyle.padding,
      fontSize: numberStyle.fontSize,
      buttonHeight: buttonStyle.height,
    });
  }, [counter.id]);
  useEffect(() => {
    const editor = document.querySelector(".counter-super-fullscreen");
    if (!editor || !sourceStyle) return;
    const editorElement = editor as HTMLElement;
    editorElement.style.setProperty(
      "--editor-counter-width",
      `${sourceStyle.width}px`,
    );
    editorElement.style.setProperty(
      "--editor-counter-height",
      `${sourceStyle.height}px`,
    );
    editorElement.style.setProperty(
      "--editor-counter-padding",
      sourceStyle.padding,
    );
    editorElement.style.setProperty(
      "--editor-number-size",
      sourceStyle.fontSize,
    );
    editorElement.style.setProperty(
      "--editor-button-height",
      sourceStyle.buttonHeight,
    );
  }, [sourceStyle]);
  const dragPart = (event) => {
    const target = event.target.closest("[data-counter-part]");
    if (!target || event.button !== 0) return;
    const key = target.dataset.counterPart;
    if (permissions && !permissions.has(superPermissionForPart(key))) return;
    setSelected(key);
    if (
      event.target.closest("input,select") ||
      (key.startsWith("quick-") && event.target.closest("button"))
    )
      return;
    const card = target.closest(".counter-card"),
      cardBox = card.getBoundingClientRect(),
      targetBox = target.getBoundingClientRect(),
      part = value.parts?.[key] || {},
      origin = {
        clientX: event.clientX,
        clientY: event.clientY,
        x: part.x || 0,
        y: part.y || 0,
      };
    event.preventDefault();
    const move = (next) => {
      const dx = Math.max(
          cardBox.left - targetBox.left,
          Math.min(
            cardBox.right - targetBox.right,
            next.clientX - origin.clientX,
          ),
        ),
        dy = Math.max(
          cardBox.top - targetBox.top,
          Math.min(
            cardBox.bottom - targetBox.bottom,
            next.clientY - origin.clientY,
          ),
        );
      onChange({
        ...value,
        parts: {
          ...(value.parts || {}),
          [key]: { ...part, x: origin.x + dx, y: origin.y + dy },
        },
      });
    };
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
  };
  return (
    <div className="counter-super-fullscreen">
      <main className="counter-super-stage">
        <div className="counter-super-stage-head">
          <span className="super-logo">
            <Sparkles /> COUNTER EDITOR
          </span>
          <small>Drag any highlighted counter element to move it.</small>
        </div>
        <div className="counter-super-card-wrap" onPointerDown={dragPart}>
          <CounterCard
            counter={counter}
            index={0}
            showBounds
            customization={value}
            onPatch={() => {}}
            onChange={() => {}}
            onEdit={() => {}}
            onEmbed={() => {}}
            onDelete={() => {}}
            onReset={() => {}}
          />
        </div>
      </main>
      <aside className="counter-super-side">
        <div className="counter-super-side-head">
          <b>Tally Super</b>
          <button type="button" onClick={onDone}>
            <X />
          </button>
        </div>
        <CounterSuperInspector
          value={value}
          onChange={onChange}
          selectedFromStage={selected}
          permissions={permissions}
        />
        <button type="button" className="super-editor-done" onClick={onDone}>
          Done
        </button>
      </aside>
    </div>
  );
}

export function Editor({
  draft,
  setDraft,
  isNew,
  showLocalOption = false,
  superCustomization = {},
  onSuperCustomization = null,
  script = { language: "tallyscript", source: "" },
  onScriptChange = null,
  onRunScript = null,
  scriptRunning = false,
  scriptError = "",
  onStopScript = null,
  permissions = null,
  folderOptions = [],
  onClose,
  onSave,
}) {
  const can = (permission) => !permissions || permissions.has(permission);
  const field = (key, value) =>
    setDraft((d) => ({
      ...d,
      [key]: value,
      ...(isNew && key === "start" ? { value } : {}),
    }));
  const [goalInput, setGoalInput] = useState("");
  const [tagsInput, setTagsInput] = useState(() => (draft.tags || []).join(", "));
  const [tab, setTab] = useState("counter");
  const addGoal = () => {
    const goal = Number(goalInput);
    if (!Number.isFinite(goal) || goalInput.trim() === "") return;
    field("goals", [...new Set([...(draft.goals || []), goal])]);
    setGoalInput("");
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <form
        className="modal"
        onSubmit={(e) => {
          e.preventDefault();
          if (tab === "counter") onSave(draft);
        }}
      >
        <div className="modal-head">
          <div>
            <span>COUNTER SETTINGS</span>
            <h2>{isNew ? "Create a new counter" : "Fine-tune your tally"}</h2>
          </div>
          <button type="button" onClick={onClose}>
            <X />
          </button>
        </div>
        {!isNew && (
          <nav className="counter-settings-tabs">
            <button
              type="button"
              className={tab === "counter" ? "active" : ""}
              onClick={() => setTab("counter")}
            >
              Counter
            </button>
            {(can("scripting_js") || can("scripting_ts")) && <button
              type="button"
              className={tab === "scripting" ? "active" : ""}
              onClick={() => setTab("scripting")}
            >
              Scripting
            </button>}
            {(!permissions || [...permissions].some((key) => key.startsWith("superedit_"))) && <button
              type="button"
              className={tab === "super" ? "active" : ""}
              onClick={() => setTab("super")}
            >
              Tally Super
            </button>}
          </nav>
        )}
        {tab === "counter" ? (
          <>
            <label className="wide">
              Counter name
              <input
                autoFocus
                disabled={!can("settings_name")}
                value={draft.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="e.g. Water glasses"
              />
            </label>
            <div className="form-grid counter-organization-fields">
              <label className="editor-folder-select">
                Folder
                <select
                  disabled={!can("settings_folder")}
                  value={draft.folderId || ""}
                  onChange={(event) => field("folderId", event.target.value || null)}
                >
                  <option value="">No folder</option>
                  {folderOptions.map((folder) => {
                    const value = typeof folder === "string" ? folder : folder.id;
                    const label = typeof folder === "string" ? folder.replaceAll("/", " / ") : folder.label || folder.name;
                    return <option key={value} value={value}>{label}</option>;
                  })}
                </select>
              </label>
              <label>
                Tags
                <input
                  disabled={!can("settings_name")}
                  value={tagsInput}
                  onChange={(e) => {
                    setTagsInput(e.target.value);
                    field("tags", e.target.value.split(",").map((tag) => tag.trim()).filter(Boolean));
                  }}
                  placeholder="daily, health"
                />
                <small>Separate tags with commas.</small>
              </label>
            </div>
            <div className="form-grid">
              <label className={isNew ? "editor-start-wide" : ""}>
                Starting value
                <input
                  type="number"
                  disabled={!can("settings_startvalue")}
                  value={draft.start}
                  onChange={(e) => field("start", e.target.value)}
                />
              </label>
              {!isNew && (
                <label>
                  Exact value
                  <input
                    type="number"
                    disabled={!can("settings_exactvalue")}
                    value={draft.value}
                    onChange={(e) => field("value", e.target.value)}
                  />
                </label>
              )}
              <label>
                Positive step
                <input
                  type="number"
                  disabled={!can("settings_posstep")}
                  min="0.000001"
                  step="any"
                  value={draft.plusStep}
                  onChange={(e) => field("plusStep", e.target.value)}
                />
              </label>
              <label>
                Negative step
                <input
                  type="number"
                  disabled={!can("settings_negstep")}
                  min="0.000001"
                  step="any"
                  value={draft.minusStep}
                  onChange={(e) => field("minusStep", e.target.value)}
                />
              </label>
            </div>
            {!isNew && (
              <label className="jump-select">
                Jump to saved value
                <select
                  disabled={!can("settings_jump")}
                  value=""
                  onChange={(e) => {
                    if (e.target.value !== "")
                      field("value", Number(e.target.value));
                  }}
                >
                  <option value="">Choose a value…</option>
                  {[draft.start, draft.min, draft.max, ...getGoals(draft)]
                    .filter(
                      (v, i, a) => v !== "" && v != null && a.indexOf(v) === i,
                    )
                    .map((value) => (
                      <option value={value} key={value}>
                        {value === draft.start
                          ? "Start"
                          : getGoals(draft).includes(Number(value))
                            ? "Goal"
                            : value === draft.min
                              ? "Minimum"
                              : "Maximum"}{" "}
                        · {value}
                      </option>
                    ))}
                </select>
              </label>
            )}
            <div className="form-divider">
              <span>Optional limits & goals</span>
            </div>
            <div className="form-grid">
              <label>
                Minimum
                <input
                  type="number"
                  disabled={!can("settings_min")}
                  value={draft.min ?? ""}
                  onChange={(e) => field("min", e.target.value)}
                  placeholder="None"
                />
              </label>
              <label>
                Maximum
                <input
                  type="number"
                  disabled={!can("settings_max")}
                  value={draft.max ?? ""}
                  onChange={(e) => field("max", e.target.value)}
                  placeholder="None"
                />
              </label>
            </div>
            <div className="goal-builder">
              <label>
                Goal direction
                <div className="direction-toggle">
                  <button
                    type="button"
                    disabled={!can("settings_goaldir")}
                    className={draft.goalDirection === "more" ? "active" : ""}
                    onClick={() => field("goalDirection", "more")}
                  >
                    More than ↑
                  </button>
                  <button
                    type="button"
                    disabled={!can("settings_goaldir")}
                    className={draft.goalDirection === "less" ? "active" : ""}
                    onClick={() => field("goalDirection", "less")}
                  >
                    Less than ↓
                  </button>
                </div>
              </label>
              <label>
                Milestone values
                <div className="goal-input">
                  <input
                    type="number"
                    disabled={!can("settings_addgoal")}
                    value={goalInput}
                    onChange={(e) => setGoalInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addGoal();
                      }
                    }}
                    placeholder="Enter a goal"
                  />
                  <button type="button" disabled={!can("settings_addgoal")} onClick={addGoal}>
                    <Plus /> Add
                  </button>
                </div>
              </label>
            </div>
            <div className="goal-chips">
              {getGoals(draft).map((goal, i) => (
                <button
                  type="button"
                  disabled={!can("settings_removegoal")}
                  key={goal}
                  onClick={() =>
                    field(
                      "goals",
                      draft.goals.filter((x) => Number(x) !== goal),
                    )
                  }
                >
                  <small>{i + 1}</small>
                  {goal}
                  <X />
                </button>
              ))}
              {!getGoals(draft).length && <span>No goals added yet</span>}
            </div>
            <label className="color-label">
              Counter color
              <div className="swatches">
                {COLORS.map((color) => (
                  <button
                    aria-label={color}
                    type="button"
                    disabled={!can("settings_color")}
                    key={color}
                    className={draft.color === color ? "selected" : ""}
                    style={{ background: color }}
                    onClick={() => field("color", color)}
                  >
                    {draft.color === color && <Check />}
                  </button>
                ))}
                <span className="custom-color">
                  <input
                    type="color"
                    disabled={!can("settings_color")}
                    value={draft.color || COLORS[0]}
                    onChange={(e) => field("color", e.target.value)}
                  />
                  <em>Custom</em>
                </span>
              </div>
            </label>
            {showLocalOption && (
              <div className="counter-local-setting">
                <div>
                  <b>Local counter</b>
                  <small>
                    Keep this counter on this device and remove its cloud copy.
                  </small>
                </div>
                <SettingToggle label="Local counter" description="Keep this counter on this device and remove its cloud copy." checked={Boolean(draft.localOnly)} onChange={(checked) => field("localOnly", checked)} />
              </div>
            )}
          </>
        ) : tab === "super" ? (
          <CounterSuperCustomization
            counter={draft}
            value={superCustomization}
            onChange={onSuperCustomization}
            onDone={() => setTab("counter")}
            permissions={permissions}
          />
        ) : (
          <TallyScriptEditor
            source={script.source || ""}
            language={script.language || "tallyscript"}
            running={scriptRunning}
            externalError={scriptError}
            onChange={onScriptChange}
            onStop={onStopScript}
            allowedLanguages={permissions ? [
              ...(can("scripting_ts") ? ["tallyscript"] : []),
              ...(can("scripting_js") ? ["javascript"] : []),
            ] : undefined}
            onRun={() => {
              const execution = onRunScript?.(
                script.source || "",
                script.language || "tallyscript",
              );
              return execution;
            }}
          />
        )}
        <div className="modal-footer">
          <button type="button" className="cancel" onClick={onClose}>
            {tab === "counter" ? "Cancel" : "Done"}
          </button>
          {tab === "counter" && (
            <button className="save">
              <Check /> Save counter
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
