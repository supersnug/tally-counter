import { useEffect, useRef, useState } from "react";
import {
  Check,
  Code2,
  Hash,
  Minus,
  Plus,
  RotateCcw,
  Send,
  Settings2,
  Target,
  Trash2,
} from "lucide-react";
import { getGoals, type AnyRecord } from "./model";

export function isComplete(c) {
  const goals = getGoals(c);
  if (!goals.length) return false;
  const finalGoal = goals.at(-1);
  const direction = c.goalDirection || (c.goal < c.start ? "less" : "more");
  return direction === "less" ? c.value <= finalGoal : c.value >= finalGoal;
}

const counterPartStyle = (
  customization,
  type,
  { button = false, fixed = false } = {},
) => {
  const part = customization?.parts?.[type] || {};
  if (part.hidden) return { display: "none" };
  const x = part.x || 0,
    y = part.y || 0,
    rotation = part.rotation || 0,
    scaleX = part.scaleX || 1,
    scaleY = part.scaleY || 1;
  if (button && !fixed)
    return {
      transform: `translate(${x}px,${y}px) rotate(${rotation}deg)`,
      width: part.width || undefined,
      height: part.height || undefined,
    };
  return {
    transform: `translate(${x}px,${y}px) rotate(${rotation}deg) scale(${fixed ? 1 : scaleX},${fixed ? 1 : scaleY})`,
  };
};

export function CounterCard({
  counter: c,
  index,
  showBounds,
  showLocalBanner = false,
  customization = {},
  onPatch = null,
  onChange,
  onEdit,
  onEmbed,
  onShare,
  onDelete,
  onReset,
  canAdd = true,
  canSubtract = true,
  canReset = true,
  canEdit = true,
  canDelete = true,
  onDragStart = null,
}: AnyRecord) {
  const goals = getGoals(c);
  const [visualValue, setVisualValue] = useState(c.value);
  const animationQueue = useRef([]);
  useEffect(() => {
    if (visualValue === c.value) return;
    const boundaries = goals
      .filter((goal) =>
        c.value > visualValue
          ? goal > visualValue && goal < c.value
          : goal < visualValue && goal > c.value,
      )
      .sort((a, b) => (c.value > visualValue ? a - b : b - a));
    animationQueue.current = [...boundaries, c.value];
    setVisualValue(animationQueue.current.shift());
  }, [c.value]);
  const continueProgressAnimation = (event) => {
    if (event.propertyName !== "width" || !animationQueue.current.length)
      return;
    setVisualValue(animationQueue.current.shift());
  };
  const direction = c.goalDirection || (c.goal < c.start ? "less" : "more");
  const finalGoal = goals.at(-1);
  const complete =
    goals.length > 0 &&
    (direction === "less"
      ? visualValue <= finalGoal
      : visualValue >= finalGoal);
  const hasGoal = goals.length > 0;
  const reached = (goal) =>
    direction === "less" ? visualValue <= goal : visualValue >= goal;
  const completedCount = goals.filter(reached).length;
  const nextGoal = goals.find((goal) => !reached(goal));
  const directedProgress = (value, from, to) => {
    const distance = direction === "less" ? from - to : to - from;
    const travelled = direction === "less" ? from - value : value - from;
    if (distance <= 0) return reached(to) ? 100 : 0;
    return (travelled / distance) * 100;
  };
  const boundedProgress = (value) => Math.max(0, Math.min(100, value));
  const activeIndex = complete ? goals.length : completedCount;
  const activeOrigin = activeIndex > 0 ? goals[activeIndex - 1] : c.start;
  const nextProgress =
    nextGoal == null
      ? 100
      : directedProgress(visualValue, activeOrigin, nextGoal);
  const finalProgress = directedProgress(visualValue, c.start, goals.at(-1));
  const maximumProgress =
    c.max == null || c.max === c.start
      ? null
      : ((visualValue - c.start) / (c.max - c.start)) * 100;
  const atMin = c.min != null && c.value <= c.min;
  const atMax = c.max != null && c.value >= c.max;
  const renderQuickSetting = (raw) => {
    const key = typeof raw === "string" ? raw : raw.type,
      control =
        key === "color" ? (
          <input
            type="color"
            value={c.color}
            title="Counter color"
            onChange={(event) => onPatch?.(c.id, { color: event.target.value })}
          />
        ) : key === "goalDirection" ? (
          <button
            type="button"
            onClick={() =>
              onPatch?.(c.id, {
                goalDirection: c.goalDirection === "less" ? "more" : "less",
              })
            }
          >
            Goal: {c.goalDirection}
          </button>
        ) : (
          <label>
            {key}
            <input
              type="number"
              value={c[key] ?? ""}
              onChange={(event) =>
                onPatch?.(c.id, {
                  [key]:
                    event.target.value === ""
                      ? null
                      : Number(event.target.value),
                })
              }
            />
          </label>
        );
    return (
      <div
        key={key}
        data-counter-part={`quick-${key}`}
        style={counterPartStyle(customization, `quick-${key}`)}
      >
        {control}
      </div>
    );
  };
  return (
    <article
      className="counter-card"
      data-counter-id={c.id}
      draggable={Boolean(onDragStart)}
      onDragStart={(event) => onDragStart?.(event, c)}
      style={{ "--accent": c.color, "--delay": `${index * 60}ms` }}
    >
      {c.localOnly && showLocalBanner && (
        <div className="local-counter-banner">Local counter</div>
      )}
      <div className="card-top">
        <span className="counter-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <div className="card-actions">
          <button
            data-counter-part="embed"
            style={counterPartStyle(customization, "embed", { fixed: true })}
            onClick={onEmbed}
            title="Embed"
          >
            <Code2 />
          </button>
          {onShare && (
            <button onClick={onShare} title="Send a copy">
              <Send />
            </button>
          )}
          <button
            data-counter-part="reset"
            style={counterPartStyle(customization, "reset", { fixed: true })}
            onClick={onReset}
            disabled={!canReset}
            title="Reset"
          >
            <RotateCcw />
          </button>
          <button
            data-counter-part="settings"
            style={counterPartStyle(customization, "settings", { fixed: true })}
            onClick={onEdit}
            disabled={!canEdit}
            title="Settings"
          >
            <Settings2 />
          </button>
          <button
            data-counter-part="delete"
            style={counterPartStyle(customization, "delete", { fixed: true })}
            onClick={onDelete}
            disabled={!canDelete}
            title="Delete"
          >
            <Trash2 />
          </button>
        </div>
      </div>
      <h3
        data-counter-part="title"
        style={counterPartStyle(customization, "title")}
      >
        {c.name}
      </h3>
      {c.tags?.length > 0 && <div className="counter-organizers">
        {(c.tags || []).slice(0, 3).map((tag) => <span key={tag}>{tag}</span>)}
        {(c.tags || []).length > 3 && <span>+{c.tags.length - 3}</span>}
      </div>}
      <div
        className="number"
        data-counter-part="count"
        style={counterPartStyle(customization, "count")}
      >
        {c.value.toLocaleString()}
      </div>
      {hasGoal ? (
        <div
          data-counter-part="goal"
          className={`goal direction-${direction} ${complete ? "complete" : ""}`}
          style={counterPartStyle(customization, "goal")}
        >
          <div className="goal-label">
            <span>
              {complete ? (
                <>
                  <Check /> All goals complete
                </>
              ) : (
                <>
                  <Target /> Next: {nextGoal.toLocaleString()} or {direction}
                </>
              )}
            </span>
            <div className="progress-detail" tabIndex={0}>
              <b>{Math.round(nextProgress)}%</b>
              <div className="progress-tooltip">
                <span>
                  To next goal<strong>{Math.round(nextProgress)}%</strong>
                </span>
                <span>
                  To final goal<strong>{Math.round(finalProgress)}%</strong>
                </span>
                {maximumProgress != null && (
                  <span>
                    To maximum<strong>{Math.round(maximumProgress)}%</strong>
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className={`track sliced direction-${direction}`}>
            {goals.map((goal, i) => {
              const from = i > 0 ? goals[i - 1] : c.start;
              const fill = reached(goal)
                ? 100
                : i === activeIndex
                  ? boundedProgress(directedProgress(visualValue, from, goal))
                  : 0;
              return (
                <span
                  key={goal}
                  className={reached(goal) ? "reached" : ""}
                  title={`Goal ${i + 1}: ${goal}`}
                >
                  <em
                    style={{ width: `${fill}%` }}
                    onTransitionEnd={continueProgressAnimation}
                  ></em>
                  <i>{goal}</i>
                </span>
              );
            })}
          </div>
        </div>
      ) : (
        <div
          className="no-goal"
          data-counter-part="goal"
          style={counterPartStyle(customization, "goal")}
        >
          <Hash /> No goal set
        </div>
      )}
      <div className="controls">
        <button
          type="button"
          data-counter-part="subtract"
          className="count-button negative"
          style={counterPartStyle(customization, "subtract", { button: true })}
          disabled={atMin || !canSubtract}
          onClick={() => onChange(c.id, -c.minusStep)}
        >
          <Minus />
          <span>−{c.minusStep}</span>
        </button>
        <button
          type="button"
          data-counter-part="add"
          className="count-button positive"
          style={counterPartStyle(customization, "add", { button: true })}
          disabled={atMax || !canAdd}
          onClick={() => onChange(c.id, c.plusStep)}
        >
          <Plus />
          <span>+{c.plusStep}</span>
        </button>
      </div>
      {showBounds && (
        <div className="bounds">
          <span
            data-counter-part="minimum"
            style={counterPartStyle(customization, "minimum")}
          >
            {c.min == null ? "No minimum" : `Min ${c.min}`}
            {atMin && " · reached"}
          </span>
          <span
            data-counter-part="maximum"
            style={counterPartStyle(customization, "maximum")}
          >
            {c.max == null ? "No maximum" : `Max ${c.max}`}
            {atMax && " · reached"}
          </span>
        </div>
      )}
      {customization.quickSettings?.length > 0 && (
        <div className="counter-quick-settings">
          {customization.quickSettings.map(renderQuickSetting)}
        </div>
      )}
    </article>
  );
}
