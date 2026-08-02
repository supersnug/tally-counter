import type { ReactNode } from "react";

export function SettingChoice({
  label,
  description,
  value,
  options,
  onChange,
}: {
  label: string;
  description: string;
  value: string;
  options: [string, string][];
  onChange: (value: string) => void;
}) {
  return (
    <div className="setting-row choice-row">
      <div>
        <b>{label}</b>
        <small>{description}</small>
      </div>
      <div className="setting-choice">
        {options.map(([key, text]) => (
          <button
            key={key}
            className={value === key ? "active" : ""}
            onClick={() => onChange(key)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function SyncConflictModal({
  deviceCount,
  cloudCount,
  onChoose,
}: {
  deviceCount: number;
  cloudCount: number;
  onChoose: (choice: "device" | "cloud" | "merge") => void;
}) {
  return (
    <div className="modal-backdrop sync-conflict-backdrop">
      <div
        className="modal sync-conflict-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="sync-conflict-title"
      >
        <div className="modal-head">
          <div>
            <span>SYNC CONFLICT</span>
            <h2 id="sync-conflict-title">Which counters should Tally keep?</h2>
          </div>
        </div>
        <p className="sync-conflict-intro">
          This device and your account both contain counters. Nothing will be
          overwritten until you choose.
        </p>
        <div className="sync-conflict-options">
          <button onClick={() => onChoose("device")}>
            <strong>Keep this device</strong>
            <span>
              Upload these {deviceCount} counter
              {deviceCount === 1 ? "" : "s"} and replace the cloud copy.
            </span>
          </button>
          <button onClick={() => onChoose("cloud")}>
            <strong>Use cloud counters</strong>
            <span>
              Load the {cloudCount} counter{cloudCount === 1 ? "" : "s"} from
              your account onto this device.
            </span>
          </button>
          <button onClick={() => onChoose("merge")}>
            <strong>Merge both</strong>
            <span>
              Keep counters from both places. Conflicting cloud copies are
              clearly labeled.
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
