import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { SuperZoneContent } from "../tally-super/TallySuper";

export function StatsModal({
  history,
  counters,
  superItems,
  resets,
  onResetStat,
  onResetAll,
  onClose,
}) {
  const since = (key) =>
    history.filter((item) => item.time > (resets[key] || 0));
  const net = since("net").reduce((sum, item) => sum + item.to - item.from, 0);
  const distance = since("distance").reduce(
    (sum, item) => sum + Math.abs(item.to - item.from),
    0,
  );
  const increments = since("increments").filter(
    (item) => item.kind === "increment",
  ).length;
  const decrements = since("decrements").filter(
    (item) => item.kind === "decrement",
  ).length;
  const resetCount = since("resets").filter(
    (item) => item.kind === "reset",
  ).length;
  const counts: Record<string, number> = since("active").reduce(
    (map, item) => ({ ...map, [item.name]: (map[item.name] || 0) + 1 }),
    {},
  );
  const mostActive = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const resettable = (key, children, className = "") => (
    <button
      type="button"
      className={className}
      title="Click to reset"
      onClick={() => onResetStat(key)}
    >
      {children}
    </button>
  );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal utility-modal stats-modal">
        <div className="modal-head">
          <div>
            <span>THIS SESSION</span>
            <h2>Counting stats</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <SuperZoneContent
          zone="stats"
          items={superItems}
          counters={counters}
          history={history}
        />
        <div className="stats-grid">
          {resettable(
            "actions",
            <>
              <span>Session actions</span>
              <strong>{since("actions").length}</strong>
            </>,
          )}
          {resettable(
            "net",
            <>
              <span>Net movement</span>
              <strong>
                {net > 0 ? "+" : ""}
                {net}
              </strong>
            </>,
          )}
          {resettable(
            "distance",
            <>
              <span>Total distance</span>
              <strong>{distance}</strong>
            </>,
          )}
          {resettable(
            "active",
            <>
              <span>Most active</span>
              <strong className="text-stat">{mostActive?.[0] || "—"}</strong>
              <small>
                {mostActive ? `${mostActive[1]} actions` : "No activity yet"}
              </small>
            </>,
          )}
        </div>
        <div className="stats-breakdown">
          {resettable(
            "increments",
            <>
              <Plus /> Increments <b>{increments}</b>
            </>,
          )}
          {resettable(
            "decrements",
            <>
              <Minus /> Decrements <b>{decrements}</b>
            </>,
          )}
          {resettable(
            "resets",
            <>
              <RotateCcw /> Resets <b>{resetCount}</b>
            </>,
          )}
        </div>
        <div className="modal-footer">
          <button
            className="cancel"
            disabled={!history.length}
            onClick={onResetAll}
          >
            Reset all stats
          </button>
          <button className="save" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
