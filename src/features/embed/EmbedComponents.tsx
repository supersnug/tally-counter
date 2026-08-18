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
import {
  Check,
  Copy,
  Minus,
  Plus,
  RotateCcw,
  Settings2,
  X,
} from "lucide-react";
import {
  COLORS,
  EMBED_ORIGIN,
  EMBED_OPTION_DEFAULTS,
  decodeCounter,
  encodeCounter,
  getGoals,
  sanitize,
} from "../counters/model";

export function EmbedBuilder({ counter, onClose }) {
  const [options, setOptions] = useState<{ watermark: boolean; compact: boolean; reset: boolean; settings: boolean; theme: "auto" | "light" | "dark" }>({ ...EMBED_OPTION_DEFAULTS });
  const [copyState, setCopyState] = useState<"idle" | "success" | "failure">("idle");
  const [previewValue, setPreviewValue] = useState(counter.value);
  const set = (key) => setOptions((o) => ({ ...o, [key]: !o[key] }));
  let encodedCandidate = "";
  let candidate = null;
  let projectionError = "";
  try {
    encodedCandidate = encodeCounter({ ...counter, embedOptions: options });
    candidate = decodeCounter(encodedCandidate);
    if (!candidate) projectionError = "The encoded snapshot could not be decoded.";
  } catch (error) {
    projectionError = error instanceof Error ? error.message : "This counter cannot be published as a public snapshot.";
  }
  useEffect(() => { setPreviewValue(candidate?.value ?? counter.value); }, [encodedCandidate, counter.value]);
  const height = options.compact ? 210 : 310;
  const escapeAttribute = (value) => String(value).replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[character]));
  const code = candidate && encodedCandidate ? `<iframe src="${escapeAttribute(`${EMBED_ORIGIN}/embed?data=${encodeURIComponent(encodedCandidate)}`)}" width="100%" height="${height}" frameborder="0" title="${escapeAttribute(`${candidate.name} tally counter`)}" sandbox="allow-scripts" referrerpolicy="no-referrer"></iframe>` : "";
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopyState("success");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      setCopyState("failure");
    }
  };
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal embed-modal">
        <div className="modal-head">
          <div>
            <span>EMBED COUNTER</span>
            <h2>Make it fit anywhere</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        <div className="embed-layout">
          <div className="embed-options">
            <div className="embed-switches">
              {[
                ["watermark", "Powered by Tally"],
                ["compact", "Compact size"],
                ["reset", "Show reset"],
                ["settings", "Show settings"],
              ].map(([key, label]) => (
                <label key={key}>
                  <span>{label}</span>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={() => set(key)}
                  />
                  <i></i>
                </label>
              ))}
            </div>
            <label className="embed-theme">
              Embed theme
              <select
                value={options.theme}
                onChange={(e) =>
                  setOptions((o) => ({ ...o, theme: e.target.value as "auto" | "light" | "dark" }))
                }
              >
                <option value="auto">Match device</option>
                <option value="light">Light</option>
                <option value="dark">Dark</option>
              </select>
            </label>
            <label className="code-label">
              Embed code
              <div className="code-box">
                  <code>{code || projectionError}</code>
                  <button onClick={copy} disabled={!code}>
                  {copyState === "success" ? <Check /> : <Copy />}
                  {copyState === "success" ? "Copied" : copyState === "failure" ? "Copy failed — retry" : "Copy"}
                </button>
              </div>
            </label>
          </div>
          <div className="preview-wrap">
            <span>PUBLIC · INSPECTABLE · NON-LIVE · NOT FOR HIGH-STAKES USE</span>
            {candidate ? <EmbedPreview counter={{ ...candidate, value: previewValue }} options={options} onChange={setPreviewValue} /> : <div role="alert" className="embed-error">{projectionError}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function EmbedPreview({ counter: c, options, onChange = null }) {
  const change = (amount) => onChange?.(Math.max(c.min ?? -Infinity, Math.min(c.max ?? Infinity, c.value + amount)));
  return (
    <div
      className={`embed-preview ${options.compact ? "compact" : ""} theme-${options.theme}`}
      style={{ "--accent": c.color }}
    >
      <div className="embed-preview-head">
        <span>{c.name}</span>
        {options.settings && <Settings2 />}
      </div>
      <strong>{c.value.toLocaleString()}</strong>
      {!options.compact && (
        <small>
          {getGoals(c).length
            ? `${getGoals(c).filter((g) => (c.goalDirection === "less" ? c.value <= g : c.value >= g)).length} of ${getGoals(c).length} goals`
            : "Ready to count"}
        </small>
      )}
      <div className="embed-controls">
        <button onClick={() => change(-c.minusStep)} disabled={!onChange}>
          <Minus /> {c.minusStep}
        </button>
        <button onClick={() => change(c.plusStep)} disabled={!onChange}>
          <Plus /> {c.plusStep}
        </button>
      </div>
      <div className="embed-bottom">
        {options.reset ? (
          <button onClick={() => onChange?.(c.start)} disabled={!onChange}>
            <RotateCcw /> Reset
          </button>
        ) : (
          <span></span>
        )}
        {options.watermark && (
          <b>
            <span className="brand-mark">
              <span></span>
              <span></span>
              <span></span>
              <span></span>
            </span>
            Powered by Tally
          </b>
        )}
      </div>
    </div>
  );
}

export function EmbeddedCounter({ initial, params }) {
  const [counter, setCounter] = useState(initial);
  const [details, setDetails] = useState(false);
  const options = initial.embedOptions || EMBED_OPTION_DEFAULTS;
  const compact = options.compact;
  const watermark = options.watermark;
  const showReset = options.reset;
  const showSettings = options.settings;
  const embedTheme = options.theme;
  const change = (amount) =>
    setCounter((c) => ({
      ...c,
      value: Math.max(
        c.min ?? -Infinity,
        Math.min(c.max ?? Infinity, c.value + amount),
      ),
    }));
  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)") || { matches: false, addEventListener: () => {}, removeEventListener: () => {} };
    const applyTheme = () => {
      const dark =
        embedTheme === "dark" || (embedTheme === "auto" && media.matches);
      document.documentElement.dataset.theme = dark ? "dark" : "light";
    };
    applyTheme();
    if (embedTheme === "auto") media.addEventListener("change", applyTheme);
    return () => media.removeEventListener("change", applyTheme);
  }, [embedTheme]);
  return (
    <main className="embed-page">
      <div
        className={`embed-preview real-embed ${compact ? "compact" : ""}`}
        style={{ "--accent": counter.color }}
      >
        <div className="embed-preview-head">
          <span>{counter.name}</span>
          {showSettings && (
            <button
              onClick={() => setDetails((x) => !x)}
              title="Counter details"
            >
              <Settings2 />
            </button>
          )}
        </div>
        <strong>{counter.value.toLocaleString()}</strong>
        {!compact && (
          <small>
            {getGoals(counter).length
              ? `${getGoals(counter).filter((g) => (counter.goalDirection === "less" ? counter.value <= g : counter.value >= g)).length} of ${getGoals(counter).length} goals complete`
              : "Ready to count"}
          </small>
        )}
        {details && (
          <div className="embed-details">
            <span>
              − step <b>{counter.minusStep}</b>
            </span>
            <span>
              + step <b>{counter.plusStep}</b>
            </span>
            {counter.min != null && (
              <span>
                Minimum <b>{counter.min}</b>
              </span>
            )}
            {counter.max != null && (
              <span>
                Maximum <b>{counter.max}</b>
              </span>
            )}
          </div>
        )}
        <div className="embed-controls">
          <button
            disabled={counter.min != null && counter.value <= counter.min}
            onClick={() => change(-counter.minusStep)}
          >
            <Minus /> {counter.minusStep}
          </button>
          <button
            disabled={counter.max != null && counter.value >= counter.max}
            onClick={() => change(counter.plusStep)}
          >
            <Plus /> {counter.plusStep}
          </button>
        </div>
        <div className="embed-bottom">
          {showReset ? (
            <button
              onClick={() => setCounter((c) => ({ ...c, value: c.start }))}
            >
              <RotateCcw /> Reset
            </button>
          ) : (
            <span></span>
          )}
          {watermark && (
            <b>
              <span className="brand-mark">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </span>
              Powered by Tally
            </b>
          )}
        </div>
      </div>
    </main>
  );
}
