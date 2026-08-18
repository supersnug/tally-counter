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
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { SuperZoneContent } from "../tally-super/TallySuper";
import { calculateSessionStats } from "./sessionLedger";

export function StatsModal({
  history,
  counters,
  superItems,
  resets,
  onResetStat,
  onResetAll,
  onClose,
}) {
  const stats = calculateSessionStats(history, counters, resets);
  const net = stats.net;
  const distance = stats.distance;
  const increments = stats.increments;
  const decrements = stats.decrements;
  const resetCount = stats.resets;
  const mostActive = stats.mostActiveId ? [stats.mostActiveId, stats.mostActiveCount] : null;
  const activeCounters = stats.activeCounters;
  const completedGoals = stats.completedGoals;
  const mostActiveName = counters.find((item) => String(item.id) === mostActive?.[0])?.name;
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
              <strong>{stats.actions}</strong>
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
                <strong className="text-stat">{mostActiveName || "—"}</strong>
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
          {resettable("activeCounters", <><span>Active counters</span><strong>{activeCounters}</strong></>)}
          {resettable("completedGoals", <><span>Completed goals</span><strong>{completedGoals}</strong></>)}
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
