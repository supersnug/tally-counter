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
import { useCallback, useEffect, useState } from "react";
import { Check, Send, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { AnyRecord } from "../counters/model";

export const copySourceId = (counter: AnyRecord) => String(counter.id);

export function useCopySharing(session) {
  const [shares, setShares] = useState<AnyRecord[]>([]);
  const [settings, setSettings] = useState({
    copySharingEnabled: true,
    copySharingPinEnabled: false,
  });
  const [error, setError] = useState("");
  const userId = session?.user?.id;

  const loadSettings = useCallback(async () => {
    if (!supabase || !userId) return;
    const { data, error: settingsError } = await supabase.rpc("get_copy_sharing_settings");
    if (settingsError) { setError(settingsError.message); return; }
    if (data) setSettings({ copySharingEnabled: Boolean(data.copySharingEnabled), copySharingPinEnabled: Boolean(data.copySharingPinEnabled) });
  }, [userId]);

  const loadShares = useCallback(async () => {
    if (!supabase || !userId) {
      setShares([]);
      return;
    }
    const [incomingResult, outgoingResult] = await Promise.all([supabase.rpc("list_incoming_counter_copies"), supabase.rpc("list_outgoing_counter_copy_outcomes")]);
    if (incomingResult.error || outgoingResult.error) { setError((incomingResult.error || outgoingResult.error).message); return; }
    const incomingRows = Array.isArray(incomingResult.data) ? incomingResult.data : [];
    const outgoingRows = Array.isArray(outgoingResult.data) ? outgoingResult.data : [];
    setShares([
      ...incomingRows.map((share) => ({ ...share, kind: "incoming", senderUsername: share.senderDisplay })),
      ...outgoingRows.map((share) => ({ ...share, kind: "outgoing", recipientUsername: share.recipientDisplay, accepted: share.state === "Accepted", response_reason: share.state === "Receiving disabled" ? "sharing_disabled" : share.state === "Declined" ? "declined" : undefined })),
    ]);
    setError("");
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    void loadShares();
    void loadSettings();
    const refresh = () => { void loadShares(); void loadSettings(); };
    const settingsChanged = () => void loadSettings();
    window.addEventListener("tally-sharing-settings-changed", settingsChanged);
    window.addEventListener("focus", refresh);
    window.addEventListener("online", refresh);
    const polling = window.setInterval(refresh, 30000);
    return () => {
      window.removeEventListener(
        "tally-sharing-settings-changed",
        settingsChanged,
      );
      window.removeEventListener("focus", refresh);
      window.removeEventListener("online", refresh);
      window.clearInterval(polling);
    };
  }, [userId, loadShares, loadSettings]);

  const sendCounter = async (identifier, sourceId, pin = null, linkedData: AnyRecord = {}) => {
    if (!supabase || !userId) throw new Error("Sign in before sharing.");
    const target = identifier.trim();
    if (!target) throw new Error("Enter an email address or username.");
    const { error: sendError } = await supabase.rpc("send_counter_copy_from_source", {
      recipient_identifier: target,
      source_counter_id: copySourceId({ id: sourceId }),
      include_script: Boolean(linkedData.includeScript),
      include_customization: Boolean(linkedData.includeCustomization),
      sharing_pin: pin || null,
    });
    if (sendError) throw sendError;
    await loadShares();
  };

  const claimCounter = async (id, operationId, includeScript, includeCustomization, localOnly) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error: claimError } = await supabase.rpc("claim_counter_copy", { share_id: id, operation_id: operationId, include_script: includeScript, include_customization: includeCustomization, local_only: localOnly });
    if (claimError) throw claimError;
    await loadShares();
    return data;
  };

  const finalizeLocalCounter = async (id, operationId, destinationId, deliveryToken) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error: finalizeError } = await supabase.rpc("finalize_local_counter_copy", { share_id: id, operation_id: operationId, destination_id: destinationId, delivery_token: deliveryToken });
    if (finalizeError) throw finalizeError;
    await loadShares();
    return data;
  };

  const declineCounter = async (id) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error: declineError } = await supabase.rpc("decline_counter_copy", { share_id: id });
    if (declineError) throw declineError;
    await loadShares();
  };

  const acknowledgeShare = async (id) => {
    if (!supabase) return;
    const { error: acknowledgeError } = await supabase.rpc("acknowledge_counter_copy", { share_id: id });
    if (acknowledgeError) throw acknowledgeError;
    setShares((current) => current.filter((share) => share.id !== id));
  };

  return {
    incoming: shares.filter(
      (share) => share.kind === "incoming" && share.state === "Pending",
    ),
    outcomes: shares.filter(
      (share) => share.kind === "outgoing" && share.state !== "Pending" && !share.senderAcknowledged,
    ),
    error,
    settings,
    sendCounter,
    claimCounter,
    finalizeLocalCounter,
    declineCounter,
    acknowledgeShare,
    reloadShares: loadShares,
  };
}

export function ShareCounterModal({
  counter,
  script = null,
  customization = null,
  pinRequired = false,
  onSend,
  onClose,
}) {
  const [identifier, setIdentifier] = useState("");
  const [pin, setPin] = useState("");
  const [includeScript, setIncludeScript] = useState(false);
  const [includeCustomization, setIncludeCustomization] = useState(false);
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    try {
      await onSend(identifier, counter.id, pinRequired ? pin : null, { includeScript, includeCustomization });
      setStatus("Counter copy sent. You’ll be notified when they respond.");
    } catch (sendError) {
      setStatus(
        sendError instanceof Error ? sendError.message : "Unable to send counter.",
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="modal share-counter-modal">
        <div className="modal-head">
          <div>
            <span>SEND A COPY</span>
            <h2>Share “{counter.name}”</h2>
          </div>
          <button onClick={onClose} aria-label="Close"><X /></button>
        </div>
        <p>The recipient gets an independent copy. Future changes are not shared.</p>
        <form className="auth-form" onSubmit={submit}>
          <label>
            Recipient email or username
            <input
              required
              value={identifier}
              onChange={(event) => setIdentifier(event.target.value)}
              placeholder="username or person@example.com"
              autoFocus
            />
          </label>
          {pinRequired && (
            <label>
              Sharing PIN
              <input
                type="password"
                required
                inputMode="numeric"
                pattern="[0-9]{6}"
                maxLength={6}
                value={pin}
                onChange={(event) =>
                  setPin(event.target.value.replace(/\D/g, "").slice(0, 6))
                }
                placeholder="6 digits"
                autoComplete="off"
              />
            </label>
          )}
          <div className="share-linked-options">
            <label
              className={`backup-customization-toggle ${script ? "" : "unavailable"}`}
            >
              <input
                type="checkbox"
                checked={includeScript}
                disabled={!script}
                onChange={(event) => setIncludeScript(event.target.checked)}
              />
              <i aria-hidden="true" />
              <span>
                <b>Include this counter’s script</b>
                <small>
                  {script
                    ? "No scripts from other counters are included."
                    : "This counter does not have a script to include."}
                </small>
              </span>
            </label>
            <label
              className={`backup-customization-toggle ${customization ? "" : "unavailable"}`}
            >
              <input
                type="checkbox"
                checked={includeCustomization}
                disabled={!customization}
                onChange={(event) =>
                  setIncludeCustomization(event.target.checked)
                }
              />
              <i aria-hidden="true" />
              <span>
                <b>Include this counter’s customization</b>
                <small>
                  {customization
                    ? "Only its Tally Super layout is included."
                    : "This counter has no Tally Super customization to include."}
                </small>
              </span>
            </label>
          </div>
          {status && <div className="auth-status">{status}</div>}
          <button
            className="save"
            disabled={
              busy || !identifier.trim() || (pinRequired && pin.length !== 6)
            }
          >
            <Send /> {busy ? "Sending…" : "Send counter copy"}
          </button>
        </form>
      </div>
    </div>
  );
}

export function CopySharePrompt({ incoming, outcome, onAccept, onDeny, onAcknowledge }) {
  const [localOnly, setLocalOnly] = useState(false);
  const [includeScript, setIncludeScript] = useState(Boolean(incoming?.offeredScript && incoming?.script));
  const [includeCustomization, setIncludeCustomization] = useState(Boolean(incoming?.offeredCustomization && incoming?.customization));
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    setLocalOnly(false);
    setIncludeScript(Boolean(incoming?.offeredScript && incoming?.script));
    setIncludeCustomization(Boolean(incoming?.offeredCustomization && incoming?.customization));
    setBusy(false);
    setStatus("");
  }, [incoming?.id, outcome?.id]);
  const run = async (action) => {
    setBusy(true);
    setStatus("");
    try {
      await action();
    } catch (actionError) {
      setStatus(
        actionError instanceof Error ? actionError.message : "Unable to update this share.",
      );
      setBusy(false);
    }
  };
  if (!incoming && !outcome) return null;
  if (outcome)
    {
      const receivingDisabled =
        !outcome.accepted && outcome.response_reason === "sharing_disabled";
    return (
      <div className="modal-backdrop share-notification-backdrop">
        <div className="modal share-notification-modal" role="alertdialog" aria-modal="true">
          <div className={`share-result-icon ${outcome.accepted ? "accepted" : "denied"}`}>
            {outcome.accepted ? <Check /> : <X />}
          </div>
          <span>COUNTER COPY</span>
          <h2>
            {outcome.accepted
              ? "Copy accepted"
              : receivingDisabled
                ? "Copy could not be delivered"
                : "Copy declined"}
          </h2>
          <p>
            {outcome.recipientUsername || "The recipient"}{" "}
            {outcome.accepted
              ? "added your counter copy."
              : receivingDisabled
                ? "has turned off incoming counter copies."
                : "declined your counter copy."}
          </p>
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy} onClick={() => run(() => onAcknowledge(outcome))}>
            OK
          </button>
        </div>
      </div>
    );
    }
  return (
    <div className="modal-backdrop share-notification-backdrop">
      <div className="modal share-notification-modal" role="dialog" aria-modal="true">
        <span>COUNTER COPY</span>
        <h2>{incoming.senderUsername || "A Tally user"} sent you a counter</h2>
         <div className="shared-counter-summary">
           <b>{incoming.counter?.name || "Untitled counter"}</b>
           <strong>{Number(incoming.counter?.value || 0).toLocaleString()}</strong>
        </div>
        <label className="backup-customization-toggle">
          <input
            type="checkbox"
            checked={localOnly}
            onChange={(event) => setLocalOnly(event.target.checked)}
          />
          <i aria-hidden="true" />
          <span>
            <b>Save as a local counter</b>
            <small>Keep this copy on this device instead of syncing it.</small>
          </span>
        </label>
        {(incoming.offeredScript || incoming.offeredCustomization) && (
          <div className="share-linked-options receive-options">
            {incoming.offeredScript && incoming.script && (
              <label className="backup-customization-toggle">
                <input
                  type="checkbox"
                   checked={includeScript}
                  onChange={(event) => setIncludeScript(event.target.checked)}
                />
                <i aria-hidden="true" />
                <span>
                  <b>Add included script</b>
                  <small>The script will be imported stopped.</small>
                </span>
              </label>
            )}
            {incoming.offeredCustomization && incoming.customization && (
              <label className="backup-customization-toggle">
                <input
                  type="checkbox"
                   checked={includeCustomization}
                  onChange={(event) =>
                    setIncludeCustomization(event.target.checked)
                  }
                />
                <i aria-hidden="true" />
                <span>
                  <b>Add included customization</b>
                  <small>Apply the sender’s layout to this copy.</small>
                </span>
              </label>
            )}
          </div>
        )}
        {status && <div className="auth-status">{status}</div>}
        <div className="share-decision-actions">
          <button disabled={busy} onClick={() => run(() => onDeny(incoming))}>Decline</button>
          <button
            className="save"
            disabled={busy}
            onClick={() =>
              run(() =>
                onAccept(incoming, {
                  localOnly,
                  includeScript,
                  includeCustomization,
                }),
              )
            }
          >
            Accept copy
          </button>
        </div>
      </div>
    </div>
  );
}
