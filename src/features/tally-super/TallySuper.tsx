import { useEffect, useRef, useState } from "react";
import { Sparkles, Trash2, X } from "lucide-react";
import { REMOVED_SUPER_TYPES, getGoals } from "../counters/model";
import { isComplete } from "../counters/CounterCard";

const SUPER_ZONES = [
  ["workspace", "Counters page"],
  ["top", "Top bar"],
  ["bottom", "Bottom bar"],
  ["stats", "Stats menu"],
  ["settings", "Settings menu"],
];
const SUPER_STATS = [
  "Session actions",
  "Net movement",
  "Total distance",
  "Most active",
  "Active counters",
  "Goals complete",
  "Increments",
  "Decrements",
  "Resets",
];
const SUPER_TOOLBOX = [
  { type: "text", label: "Tally text", family: "normal" },
  { type: "text-alt", label: "Alternative text", family: "alternative" },
  ...SUPER_STATS.flatMap((label, index) => [
    { type: `stat-${index}`, label, family: "normal", size: "normal" },
    {
      type: `stat-${index}-mini`,
      label: `${label} · mini`,
      family: "alternative",
      size: "mini",
    },
  ]),
  {
    type: "layout-free",
    label: "Free positioning",
    layoutControl: true,
    layoutMode: "free",
    structural: true,
  },
  {
    type: "layout-row",
    label: "Arrange in a row",
    layoutControl: true,
    layoutMode: "row",
    structural: true,
  },
  {
    type: "layout-column",
    label: "Arrange in a column",
    layoutControl: true,
    layoutMode: "column",
    structural: true,
  },
];

function SuperElement({ item, counters = [], history = [], preview = false }) {
  const elementColor =
    item.color === "#24231f" ? "var(--super-text)" : item.color;
  const statMatch = item.type?.match(/^stat-(\d+)/);
  if (statMatch) {
    const index = Number(statMatch[1]),
      net = history.reduce((sum, entry) => sum + entry.to - entry.from, 0),
      distance = history.reduce(
        (sum, entry) => sum + Math.abs(entry.to - entry.from),
        0,
      );
    const counts = history.reduce<Record<string, number>>(
        (map, entry) => ({ ...map, [entry.name]: (map[entry.name] || 0) + 1 }),
        {},
      ),
      mostActive = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
    const values = [
      history.length,
      net,
      distance,
      mostActive || "—",
      counters.length,
      counters.filter(isComplete).length,
      history.filter((entry) => entry.kind === "increment").length,
      history.filter((entry) => entry.kind === "decrement").length,
      history.filter((entry) => entry.kind === "reset").length,
    ];
    const samples = [24, "+12", 38, "Morning laps", 3, 2, 15, 7, 2];
    const value = preview ? samples[index] : values[index];
    return item.size === "mini" ? (
      <div
        className="super-live-element super-stat-mini"
        style={{ color: elementColor }}
      >
        <span>{SUPER_STATS[index]}</span>
        <b>{value}</b>
      </div>
    ) : (
      <div
        className="super-live-element super-stat-normal"
        style={{ color: elementColor }}
      >
        <span>{SUPER_STATS[index]}</span>
        <strong className={index === 3 ? "text-stat" : ""}>{value}</strong>
        {index === 3 && (
          <small>
            {preview
              ? "8 actions"
              : history.length
                ? "Most actions this session"
                : "No activity yet"}
          </small>
        )}
      </div>
    );
  }
  if (item.type === "text" || item.type === "text-alt")
    return (
      <div
        className={`super-live-element super-live-text ${item.type === "text-alt" ? "super-alt" : ""} ${item.size === "mini" ? "mini" : ""}`}
        style={{ color: elementColor }}
      >
        {item.text || "Custom text"}
      </div>
    );
  if (item.type === "counter") {
    const counter = counters.find(
      (candidate) => String(candidate.id) === String(item.counterId),
    ) || {
      name: item.label || "Counter",
      value: preview ? 18 : 0,
      start: 0,
      goals: preview ? [30] : [],
      goalDirection: "more",
      color: "#2f7e70",
    };
    const goals = getGoals(counter),
      direction =
        counter.goalDirection ||
        ((counter.goal ?? 0) < counter.start ? "less" : "more"),
      finalGoal = goals.at(-1),
      complete =
        goals.length > 0 &&
        (direction === "less"
          ? counter.value <= finalGoal
          : counter.value >= finalGoal);
    const distance =
        finalGoal == null
          ? 0
          : direction === "less"
            ? counter.start - finalGoal
            : finalGoal - counter.start,
      travelled =
        finalGoal == null
          ? 0
          : direction === "less"
            ? counter.start - counter.value
            : counter.value - counter.start;
    const progress = !goals.length
      ? 0
      : distance <= 0
        ? complete
          ? 100
          : 0
        : Math.max(0, Math.min(100, (travelled / distance) * 100));
    return (
      <div
        className={`super-live-element super-live-counter ${complete ? "complete" : ""}`}
        style={{ "--accent": counter.color }}
      >
        <span>{counter.name}</span>
        <strong>{counter.value}</strong>
        <i
          title={
            goals.length
              ? complete
                ? "Final goal complete"
                : `${Math.round(progress)}% to final goal ${finalGoal}`
              : "No goal set"
          }
        >
          <em style={{ width: `${progress}%` }}></em>
        </i>
      </div>
    );
  }
  if (item.layoutControl)
    return (
      <div className={`super-layout-preview mode-${item.layoutMode}`}>
        <i></i>
        <i></i>
        <i></i>
      </div>
    );
  return (
    <div className="super-live-element super-live-layout">
      <Sparkles />
      <span>{item.label || item.text}</span>
    </div>
  );
}

function TransformableSuperItem({
  item,
  zone,
  counters,
  history,
  onUpdate,
  onRemove,
}) {
  const moveStart = (event) => {
    if (
      event.button !== 0 ||
      event.target.closest("button,.super-resize-handle")
    )
      return;
    event.preventDefault();
    const rect = document
      .querySelector(`[data-super-zone="${zone}"]`)
      ?.getBoundingClientRect();
    if (!rect) return;
    const origin = {
      clientX: event.clientX,
      clientY: event.clientY,
      x: item.x ?? 50,
      y: item.y ?? 50,
    };
    const move = (next) =>
      onUpdate(item.id, {
        x: Math.max(
          0,
          Math.min(
            100,
            origin.x + ((next.clientX - origin.clientX) / rect.width) * 100,
          ),
        ),
        y: Math.max(
          0,
          Math.min(
            100,
            origin.y + ((next.clientY - origin.clientY) / rect.height) * 100,
          ),
        ),
      });
    const end = () => {
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", end);
  };
  const resizeStart = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const box = event.currentTarget.parentElement.getBoundingClientRect(),
      center = { x: box.left + box.width / 2, y: box.top + box.height / 2 },
      origin = {
        x: Math.max(1, event.clientX - center.x),
        y: Math.max(1, event.clientY - center.y),
        scaleX: item.scaleX ?? item.scale ?? 1,
        scaleY: item.scaleY ?? item.scale ?? 1,
      };
    const resize = (next) =>
      onUpdate(item.id, {
        scaleX: Math.max(
          0.25,
          Math.min(4, origin.scaleX * ((next.clientX - center.x) / origin.x)),
        ),
        scaleY: Math.max(
          0.25,
          Math.min(4, origin.scaleY * ((next.clientY - center.y) / origin.y)),
        ),
      });
    const end = () => {
      document.removeEventListener("pointermove", resize);
      document.removeEventListener("pointerup", end);
    };
    document.addEventListener("pointermove", resize);
    document.addEventListener("pointerup", end);
  };
  const scaleX = item.scaleX ?? item.scale ?? 1,
    scaleY = item.scaleY ?? item.scale ?? 1;
  const uniform = (amount) =>
    onUpdate(item.id, {
      scaleX: Math.max(0.25, Math.min(4, scaleX + amount)),
      scaleY: Math.max(0.25, Math.min(4, scaleY + amount)),
    });
  const rotation = item.rotation || 0;
  return (
    <div
      className={`super-positioned-element editable custom-size ${item.width || item.height ? "resized" : ""}`}
      onPointerDown={moveStart}
      style={{
        left: `${item.x ?? 50}%`,
        top: `${item.y ?? 50}%`,
        width: item.width || "auto",
        height: item.height || "auto",
        "--super-scale-x": scaleX,
        "--super-scale-y": scaleY,
        "--super-rotation": `${rotation}deg`,
      }}
    >
      <SuperElement item={item} counters={counters} history={history} />
      <div className="super-transform-tools">
        <button onClick={() => uniform(-0.1)} title="Scale down">
          −
        </button>
        <span>
          {Math.round(scaleX * 100)}% × {Math.round(scaleY * 100)}%
        </span>
        <button onClick={() => uniform(0.1)} title="Scale up">
          +
        </button>
        <button
          onClick={() => onUpdate(item.id, { rotation: rotation - 15 })}
          title="Rotate left"
        >
          ↶
        </button>
        <span className="rotation-value">{rotation}°</span>
        <button
          onClick={() => onUpdate(item.id, { rotation: rotation + 15 })}
          title="Rotate right"
        >
          ↷
        </button>
      </div>
      <button
        className="remove-super-item"
        onClick={() => onRemove(item.id)}
        title="Remove customization"
      >
        <X />
      </button>
      <i className="super-resize-handle" onPointerDown={resizeStart}></i>
    </div>
  );
}

export function SuperZoneContent({
  zone,
  items = [],
  counters,
  history,
  onRemove = null,
  onUpdate = null,
}) {
  const zoneItems = (Array.isArray(items) ? items : []).filter(
      (item) => item.zone === zone && !REMOVED_SUPER_TYPES.has(item.type),
    ),
    layout = zoneItems.find((item) => item.layoutControl)?.layoutMode || "free";
  const placed = zoneItems.filter((item) => !item.layoutControl);
  if (!placed.length) return null;
  return (
    <div
      className={`super-zone-content super-zone-${zone} super-layout-${layout}`}
    >
      {placed.map((item) =>
        onUpdate ? (
          <TransformableSuperItem
            key={item.id}
            item={item}
            zone={zone}
            counters={counters}
            history={history}
            onUpdate={onUpdate}
            onRemove={onRemove}
          />
        ) : (
          <div
            className="super-positioned-element"
            key={item.id}
            style={{
              left: `${item.x ?? 50}%`,
              top: `${item.y ?? 50}%`,
              width: item.width || "auto",
              height: item.height || "auto",
              "--super-scale-x": item.scaleX ?? item.scale ?? 1,
              "--super-scale-y": item.scaleY ?? item.scale ?? 1,
              "--super-rotation": `${item.rotation || 0}deg`,
            }}
          >
            <SuperElement item={item} counters={counters} history={history} />
          </div>
        ),
      )}
    </div>
  );
}

export function SuperSettings({ value, onChange, onStart }) {
  const setting = (key, next) => onChange({ ...value, [key]: next });
  const removeAll = () => {
    if (
      confirm(
        "Remove every Tally Super UI customization? This cannot be undone.",
      )
    )
      onChange({ ...value, items: [] });
  };
  return (
    <div className="settings-section super-settings">
      <div className="super-title">
        <span className="super-logo">
          <Sparkles /> TALLY SUPER
        </span>
        <p>Rearrange Tally with a drag-and-drop workspace.</p>
      </div>
      <div className="customize-settings">
        <div className="setting-row">
          <div>
            <b>Snap to interface zones</b>
            <small>Highlight compatible places while dragging.</small>
          </div>
          <button
            className={`setting-switch ${value?.snapToZones !== false ? "active" : ""}`}
            onClick={() => setting("snapToZones", value?.snapToZones === false)}
          >
            <i />
          </button>
        </div>
        <div className="setting-row">
          <div>
            <b>Editor labels</b>
            <small>Show the names of drop zones over the page.</small>
          </div>
          <button
            className={`setting-switch ${value?.showEditorLabels !== false ? "active" : ""}`}
            onClick={() =>
              setting("showEditorLabels", value?.showEditorLabels === false)
            }
          >
            <i />
          </button>
        </div>
      </div>
      <button className="start-super-editor" onClick={onStart}>
        <Sparkles /> Start editor
      </button>
      <button
        className="remove-super-customizations"
        disabled={!value?.items?.length}
        onClick={removeAll}
      >
        <Trash2 /> Remove all UI customizations
      </button>
    </div>
  );
}

export function SuperEditorPane({ counters, value, onChange, onClose }) {
  const items = (Array.isArray(value?.items) ? value.items : []).filter(
    (item) => !REMOVED_SUPER_TYPES.has(item.type),
  );
  const templates = [
    ...SUPER_TOOLBOX,
    ...counters.map((counter) => ({
      type: "counter",
      counterId: counter.id,
      label: counter.name,
      component: true,
    })),
  ];
  const [expanded, setExpanded] = useState(null);
  const [presets, setPresets] = useState({});
  const [dragging, setDragging] = useState(null);
  const [reminder, setReminder] = useState("");
  const clickRef = useRef({ type: "", count: 0, timer: null });
  const draggedRef = useRef(false);
  const templateKey = (template) =>
    template.counterId
      ? `${template.type}-${template.counterId}`
      : template.type;
  useEffect(() => () => clearTimeout(clickRef.current.timer), []);
  const preset = (template) =>
    presets[templateKey(template)] || {
      text:
        template.type === "text" || template.type === "text-alt"
          ? "Custom text"
          : template.label,
      color: "#24231f",
      size: template.size || "normal",
    };
  const setPreset = (template, changes) =>
    setPresets((current) => ({
      ...current,
      [templateKey(template)]: { ...preset(template), ...changes },
    }));
  const add = (template, zone, position = { x: 50, y: 50 }) => {
    const settings = preset(template);
    const next = {
      ...template,
      ...settings,
      id: template.layoutControl
        ? `layout-${zone}`
        : `super-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      zone,
      ...position,
    };
    onChange({
      ...value,
      items: template.layoutControl
        ? [
            ...items.filter(
              (item) => !(item.layoutControl && item.zone === zone),
            ),
            next,
          ]
        : [...items, next],
    });
  };
  const clicked = (template) => {
    if (draggedRef.current) {
      draggedRef.current = false;
      return;
    }
    const key = templateKey(template),
      same = clickRef.current.type === key;
    const count = same ? clickRef.current.count + 1 : 1;
    clearTimeout(clickRef.current.timer);
    setReminder("");
    setExpanded(key);
    clickRef.current = {
      type: key,
      count,
      timer: setTimeout(() => {
        clickRef.current = { type: "", count: 0, timer: null };
        setReminder("");
      }, 2000),
    };
    if (same && count >= 3) setReminder(key);
  };
  const drop = (event, zone) => {
    event.preventDefault();
    const destination = document.querySelector(`[data-super-zone="${zone}"]`),
      rect =
        destination?.getBoundingClientRect() ||
        event.currentTarget.getBoundingClientRect();
    const position = {
      x: Math.max(
        0,
        Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
      ),
      y: Math.max(
        0,
        Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
      ),
    };
    if (dragging) add(dragging, zone, position);
    setDragging(null);
  };
  const remove = (id) =>
    onChange({ ...value, items: items.filter((item) => item.id !== id) });
  return (
    <>
      <div className={`super-drop-layer ${dragging ? "active" : ""}`}>
        {[
          ["top", "Top bar"],
          ["workspace", "Counters page"],
          ["bottom", "Bottom bar"],
        ].map(([zone, label]) => (
          <div
            key={zone}
            className={`super-drop-${zone}`}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, zone)}
          >
            {value?.showEditorLabels !== false && <span>{label}</span>}
          </div>
        ))}
      </div>
      <aside className="super-editor-pane">
        <div className="super-pane-head">
          <span className="super-logo">
            <Sparkles /> TALLY SUPER
          </span>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <p>Drag an element from the toolbox onto the page.</p>
        <div className="super-menu-drops">
          <span
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, "stats")}
          >
            Stats menu
          </span>
          <span
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => drop(event, "settings")}
          >
            Settings menu
          </span>
        </div>
        <div className="super-pane-tools">
          {templates.map((template) => {
            const key = templateKey(template),
              open = expanded === key,
              settings = preset(template);
            return (
              <section
                key={key}
                className={open ? "expanded" : ""}
                draggable
                onDragStart={(event) => {
                  draggedRef.current = true;
                  setDragging(template);
                  event.dataTransfer.effectAllowed = "copy";
                }}
                onDragEnd={() => {
                  setDragging(null);
                  setTimeout(() => {
                    draggedRef.current = false;
                  }, 0);
                }}
                onClick={() => clicked(template)}
              >
                <div>
                  <b>{template.label}</b>
                  <small>
                    {template.structural
                      ? "Layout"
                      : template.size === "mini"
                        ? "Mini"
                        : "Element"}
                  </small>
                </div>
                {reminder === key && (
                  <em>Drag this element onto the screen to add it.</em>
                )}
                {open && (
                  <div
                    className="super-tool-details"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <div className="super-tool-preview">
                      <SuperElement
                        item={{ ...template, ...settings }}
                        counters={counters}
                        preview
                      />
                    </div>
                    {!template.structural && (
                      <>
                        <label>
                          Size
                          <select
                            value={settings.size}
                            onChange={(event) =>
                              setPreset(template, { size: event.target.value })
                            }
                          >
                            <option value="mini">Mini</option>
                            <option value="normal">Normal</option>
                          </select>
                        </label>
                        <label>
                          Color
                          <input
                            type="color"
                            value={settings.color}
                            onChange={(event) =>
                              setPreset(template, { color: event.target.value })
                            }
                          />
                        </label>
                      </>
                    )}
                    {(template.type === "text" ||
                      template.type === "text-alt") && (
                      <label className="super-preset-text">
                        Text
                        <input
                          value={settings.text}
                          onChange={(event) =>
                            setPreset(template, { text: event.target.value })
                          }
                        />
                      </label>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
        <button className="super-editor-done" onClick={onClose}>
          Done
        </button>
      </aside>
    </>
  );
}
