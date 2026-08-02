import { useCallback, useEffect, useState } from "react";
import { Check, Send, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import type { AnyRecord } from "../counters/model";

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
    const { data } = await supabase
      .from("profiles")
      .select("copy_sharing_enabled,copy_sharing_pin_enabled")
      .eq("id", userId)
      .maybeSingle();
    if (data)
      setSettings({
        copySharingEnabled: data.copy_sharing_enabled,
        copySharingPinEnabled: data.copy_sharing_pin_enabled,
      });
  }, [userId]);

  const loadShares = useCallback(async () => {
    if (!supabase || !userId) {
      setShares([]);
      return;
    }
    const { data, error: loadError } = await supabase
      .from("counter_shares")
      .select("id,sender_id,recipient_id,counter_data,counter_script,counter_customization,sender_anonymous,accepted,response_reason,created_at")
      .order("created_at", { ascending: true });
    if (loadError) {
      setError(loadError.message);
      return;
    }
    const participantIds = [
      ...new Set(
        (data || []).flatMap((share) => [share.sender_id, share.recipient_id]),
      ),
    ];
    let names = new Map<string, string>();
    if (participantIds.length) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id,username")
        .in("id", participantIds);
      names = new Map(
        (profiles || []).map((profile) => [profile.id, profile.username]),
      );
    }
    setShares(
      (data || []).map((share) => ({
        ...share,
        senderUsername: names.get(share.sender_id),
        recipientUsername: names.get(share.recipient_id),
      })),
    );
    setError("");
  }, [userId]);

  useEffect(() => {
    if (!supabase || !userId) return;
    void loadShares();
    void loadSettings();
    const settingsChanged = () => void loadSettings();
    window.addEventListener("tally-sharing-settings-changed", settingsChanged);
    const channel = supabase
      .channel(`counter-copy-shares-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "counter_shares" },
        () => void loadShares(),
      )
      .subscribe();
    return () => {
      window.removeEventListener(
        "tally-sharing-settings-changed",
        settingsChanged,
      );
      void supabase.removeChannel(channel);
    };
  }, [userId, loadShares, loadSettings]);

  const sendCounter = async (
    identifier,
    counter,
    pin = null,
    linkedData: AnyRecord = {},
  ) => {
    if (!supabase || !userId) throw new Error("Sign in before sharing.");
    const target = identifier.trim();
    if (!target) throw new Error("Enter an email address or username.");
    const { error: sendError } = await supabase.rpc(
      "send_counter_copy_with_data",
      {
      recipient_identifier: target,
      shared_counter: counter,
      sharing_pin: pin || null,
        shared_script: linkedData.script || null,
        shared_customization: linkedData.customization || null,
      },
    );
    if (sendError) throw sendError;
    await loadShares();
  };

  const answerShare = async (id, accepted) => {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { error: answerError } = await supabase
      .from("counter_shares")
      .update({
        accepted,
        response_reason: accepted ? null : "declined",
      })
      .eq("id", id);
    if (answerError) throw answerError;
    await loadShares();
  };

  const acknowledgeShare = async (id) => {
    if (!supabase) return;
    const { data: deletedShare, error: deleteError } = await supabase
      .from("counter_shares")
      .delete()
      .eq("id", id)
      .select("id")
      .maybeSingle();
    if (deleteError) throw deleteError;
    if (!deletedShare)
      throw new Error(
        "This notification could not be cleared. Refresh and try again.",
      );
    setShares((current) => current.filter((share) => share.id !== id));
  };

  return {
    incoming: shares.filter(
      (share) => share.recipient_id === userId && share.accepted == null,
    ),
    outcomes: shares.filter(
      (share) => share.sender_id === userId && share.accepted != null,
    ),
    error,
    settings,
    sendCounter,
    answerShare,
    acknowledgeShare,
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
      await onSend(identifier, counter, pinRequired ? pin : null, {
        script: includeScript ? script : null,
        customization: includeCustomization ? customization : null,
      });
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
  const [includeScript, setIncludeScript] = useState(true);
  const [includeCustomization, setIncludeCustomization] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  useEffect(() => {
    setLocalOnly(false);
    setIncludeScript(true);
    setIncludeCustomization(true);
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
          <b>{incoming.counter_data?.name || "Untitled counter"}</b>
          <strong>{Number(incoming.counter_data?.value || 0).toLocaleString()}</strong>
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
        {(incoming.counter_script || incoming.counter_customization) && (
          <div className="share-linked-options receive-options">
            {incoming.counter_script && (
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
            {incoming.counter_customization && (
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
