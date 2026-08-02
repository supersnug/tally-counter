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
  encodeCounter,
  getGoals,
  sanitize,
} from "../counters/model";

export function EmbedBuilder({ counter, onClose }) {
  const [options, setOptions] = useState({
    watermark: true,
    compact: false,
    reset: true,
    settings: false,
    theme: "auto",
  });
  const [copied, setCopied] = useState(false);
  const set = (key) => setOptions((o) => ({ ...o, [key]: !o[key] }));
  const params = new URLSearchParams({
    data: encodeCounter(counter),
    compact: String(options.compact),
    watermark: String(options.watermark),
    reset: String(options.reset),
    settings: String(options.settings),
    theme: options.theme,
  });
  const height = options.compact ? 210 : 310;
  const code = `<iframe src="${EMBED_ORIGIN}/embed?${params}" width="100%" height="${height}" frameborder="0" title="${counter.name} tally counter"></iframe>`;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {}
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
                  setOptions((o) => ({ ...o, theme: e.target.value }))
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
                <code>{code}</code>
                <button onClick={copy}>
                  {copied ? <Check /> : <Copy />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </label>
          </div>
          <div className="preview-wrap">
            <span>LIVE PREVIEW</span>
            <EmbedPreview counter={counter} options={options} />
          </div>
        </div>
      </div>
    </div>
  );
}

function EmbedPreview({ counter: c, options }) {
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
        <button>
          <Minus /> {c.minusStep}
        </button>
        <button>
          <Plus /> {c.plusStep}
        </button>
      </div>
      <div className="embed-bottom">
        {options.reset ? (
          <button>
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
  const compact = params.get("compact") === "true";
  const watermark = params.get("watermark") !== "false";
  const showReset = params.get("reset") !== "false";
  const showSettings = params.get("settings") === "true";
  const embedTheme = params.get("theme") || "auto";
  const change = (amount) =>
    setCounter((c) => ({
      ...c,
      value: Math.max(
        c.min ?? -Infinity,
        Math.min(c.max ?? Infinity, c.value + amount),
      ),
    }));
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
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
            <span>
              Range{" "}
              <b>
                {counter.min ?? "∞"} → {counter.max ?? "∞"}
              </b>
            </span>
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
