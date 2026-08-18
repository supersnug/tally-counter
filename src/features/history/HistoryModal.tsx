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
import { History, Redo2, RotateCcw, TrendingUp, Undo2, X } from "lucide-react";
import type { AnyRecord } from "../counters/model";

const actionLabel = (kind: string) => ({
  increment: "Added",
  decrement: "Subtracted",
  reset: "Reset",
  set: "Set value",
  undo: "Undid change",
  redo: "Redid change",
})[kind] || "Changed value";

const formatTime = (time: number) => new Intl.DateTimeFormat(undefined, {
  month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(new Date(time));

function ValueChart({ entries, counter }: AnyRecord) {
  const ordered = [...entries].sort((a, b) => a.time - b.time);
  const points = ordered.length
    ? [{ value: ordered[0].from, time: ordered[0].time - 1 }, ...ordered.map((entry) => ({ value: entry.to, time: entry.time }))]
    : [{ value: counter.value, time: Date.now() }];
  const values = points.map((point) => Number(point.value));
  let low = Math.min(...values), high = Math.max(...values);
  if (low === high) { low -= 1; high += 1; }
  const width = 600, height = 190, inset = 16;
  const path = points.map((point, index) => {
    const x = points.length === 1 ? width / 2 : inset + (index / (points.length - 1)) * (width - inset * 2);
    const y = inset + ((high - point.value) / (high - low)) * (height - inset * 2);
    return `${index ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return <div className="history-chart">
    <div><span><TrendingUp /> VALUE OVER TIME</span><b>{counter.value.toLocaleString()}</b></div>
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Value history for ${counter.name}`} preserveAspectRatio="none">
      <line x1="0" y1={height / 2} x2={width} y2={height / 2} />
      <path d={path} />
    </svg>
    <div className="history-chart-range"><span>{low.toLocaleString()}</span><span>{high.toLocaleString()}</span></div>
  </div>;
}

export function HistoryModal({ counters, history, redoStack = [], selectedId, onSelectedId, onUndo, onRedo, onClear, onClose, quarantineCount = 0, onDeleteQuarantine, onExportQuarantine, persistenceStatus = "" }: AnyRecord) {
  const counter = counters.find((item) => String(item.id) === String(selectedId)) || counters[0];
  const entries = counter
    ? history.filter((entry) => String(entry.id) === String(counter.id)).sort((a, b) => b.time - a.time)
    : [];
  const canRedo = counter && redoStack.some((entry) => String(entry.id) === String(counter.id));
  return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
    <div className="modal utility-modal history-modal">
      <div className="modal-head"><div><span>LOCAL ACTIVITY</span><h2>History & charts</h2></div><button type="button" onClick={onClose}><X /></button></div>
      {counters.length ? <>
        <label className="history-counter-picker">Counter
          <select value={counter?.id ?? ""} onChange={(event) => onSelectedId(event.target.value)}>
            {counters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </label>
        <ValueChart entries={entries} counter={counter} />
        <div className="history-actions-head"><b>Recent activity</b><div><button type="button" disabled={!entries.length} onClick={() => onUndo(counter.id)}><Undo2 /> Undo</button><button type="button" disabled={!canRedo} onClick={() => onRedo(counter.id)}><Redo2 /> Redo</button></div></div>
        <div className="history-list">
          {entries.map((entry) => <div key={entry.eventId || `${entry.time}-${entry.from}-${entry.to}`}>
            <span className={`history-kind ${entry.kind}`}><History /></span>
            <span><b>{actionLabel(entry.kind)}</b><small>{formatTime(entry.time)}</small></span>
            <strong>{entry.from.toLocaleString()} <i>→</i> {entry.to.toLocaleString()}</strong>
          </div>)}
          {!entries.length && <div className="history-empty"><History /><b>No activity yet</b><span>Count, reset, or set a value to begin this chart.</span></div>}
        </div>
      </> : <div className="history-empty"><History /><b>No counters yet</b><span>Create a counter to start recording local history.</span></div>}
      {persistenceStatus && <div role="status" className="history-recovery">{persistenceStatus}</div>}
      {quarantineCount > 0 && <div role="status" className="history-recovery"><b>{quarantineCount} malformed activity entries quarantined.</b><button type="button" onClick={onExportQuarantine}>Export recovery data</button><button type="button" onClick={onDeleteQuarantine}>Delete quarantine</button></div>}
      <div className="modal-footer"><button className="cancel" type="button" disabled={!entries.length} onClick={() => onClear(counter?.id)}><RotateCcw /> Clear counter history</button><button className="save" type="button" onClick={onClose}>Done</button></div>
    </div>
  </div>;
}
