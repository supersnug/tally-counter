import { useEffect, useState } from "react";
import { Cloud, LogOut, Settings2, Trash2, User, X } from "lucide-react";
import { supabase } from "../../lib/supabase";
import { GroupSettings, GroupSettingsBoundary } from "../groups/SharedGroups";

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";
const passwordChecks = (password) => ({
  length: password.length >= 8,
  lower: /[a-z]/.test(password),
  upper: /[A-Z]/.test(password),
  digit: /\d/.test(password),
  symbol: [...password].some((character) =>
    PASSWORD_SYMBOLS.includes(character),
  ),
});
const validPassword = (password) =>
  Object.values(passwordChecks(password)).every(Boolean);
const normalizeUsername = (value) => value.trim().toLowerCase();
const validUsername = (value) =>
  /^[a-z0-9_]{3,24}$/.test(normalizeUsername(value));

function PasswordFields({
  password,
  setPassword,
  confirmation,
  setConfirmation,
  autoFocus = false,
}) {
  const checks = passwordChecks(password);
  return (
    <>
      <label>
        New password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="At least 8 characters"
          autoFocus={autoFocus}
        />
      </label>
      <label>
        Confirm password
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          placeholder="Enter it again"
        />
      </label>
      <div className="password-requirements" aria-label="Password requirements">
        <span className={checks.length ? "met" : ""}>8+ characters</span>
        <span className={checks.lower ? "met" : ""}>Lowercase</span>
        <span className={checks.upper ? "met" : ""}>Uppercase</span>
        <span className={checks.digit ? "met" : ""}>Number</span>
        <span className={checks.symbol ? "met" : ""}>Symbol</span>
      </div>
    </>
  );
}

export function AuthModal({
  session,
  configured,
  syncStatus,
  onDeleted,
  onClose,
}) {
  const [mode, setMode] = useState("signin");
  const [flow, setFlow] = useState("");
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [verificationEmail, setVerificationEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [accountSettingsOpen, setAccountSettingsOpen] = useState(false);
  const [accountSettingsTab, setAccountSettingsTab] = useState("sharing");
  const [sharingPin, setSharingPin] = useState("");
  const [hasSharingPin, setHasSharingPin] = useState(false);
  const [sharingPreferences, setSharingPreferences] = useState({
    anonymizeShares: false,
    copySharingEnabled: true,
    copySharingPinEnabled: false,
    receiveGroupInvites: true,
  });
  useEffect(() => {
    if (!session || !supabase) {
      setUsername("");
      return;
    }
    void supabase
      .from("profiles")
      .select(
        "username,anonymize_shares,copy_sharing_enabled,copy_sharing_pin_enabled,receive_group_invites",
      )
      .eq("id", session.user.id)
      .maybeSingle()
      .then(({ data }) => {
        setUsername(data?.username || "");
        if (data) {
          setSharingPreferences({
            anonymizeShares: data.anonymize_shares,
            copySharingEnabled: data.copy_sharing_enabled,
            copySharingPinEnabled: data.copy_sharing_pin_enabled,
            receiveGroupInvites: data.receive_group_invites,
          });
          setHasSharingPin(data.copy_sharing_pin_enabled);
        }
      });
  }, [session?.user?.id]);
  const clearForm = () => {
    setPassword("");
    setConfirmation("");
    setToken("");
    setStatus("");
  };
  const passwordError = () =>
    !validPassword(password)
      ? "Password must meet every requirement."
      : password !== confirmation
        ? "Passwords do not match."
        : "";
  const submit = async (event) => {
    event.preventDefault();
    if (!supabase) return;
    if (mode === "signup") {
      const error = passwordError();
      if (error) {
        setStatus(error);
        return;
      }
      if (!validUsername(username)) {
        setStatus(
          "Username must be 3–24 lowercase letters, numbers, or underscores.",
        );
        return;
      }
    }
    setBusy(true);
    setStatus("");
    let result;
    if (mode === "signup")
      result = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: normalizeUsername(username) } },
      });
    else if (email.includes("@"))
      result = await supabase.auth.signInWithPassword({ email, password });
    else {
      const login = await supabase.functions.invoke("username-login", {
        body: { username: normalizeUsername(email), password },
      });
      if (login.error || !login.data?.access_token) {
        setBusy(false);
        setStatus(login.data?.error || "Invalid username or password.");
        return;
      }
      result = await supabase.auth.setSession({
        access_token: login.data.access_token,
        refresh_token: login.data.refresh_token,
      });
    }
    setBusy(false);
    if (result.error) setStatus(result.error.message);
    else if (mode === "signup" && !result.data.session) {
      setPendingEmail(email);
      setFlow("signup-token");
      setToken("");
    } else onClose();
  };
  const verifySignup = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: token.trim(),
      type: "email",
    });
    setBusy(false);
    if (error) setStatus(error.message);
    else onClose();
  };
  const requestRecovery = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      setPendingEmail(email);
      setToken("");
      setFlow("recovery-token");
    }
  };
  const verifyRecovery = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.verifyOtp({
      email: pendingEmail,
      token: token.trim(),
      type: "recovery",
    });
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      clearForm();
      setFlow("recovery-password");
    }
  };
  const updateRecoveredPassword = async (event) => {
    event.preventDefault();
    const message = passwordError();
    if (message) {
      setStatus(message);
      return;
    }
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      clearForm();
      setFlow("");
      setStatus("Password updated successfully.");
    }
  };
  const changePassword = async (event) => {
    event.preventDefault();
    const message = passwordError();
    if (message) {
      setStatus(message);
      return;
    }
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.updateUser({ password });
    if (
      error?.code === "reauth_nonce_missing" ||
      error?.code === "reauthentication_needed"
    ) {
      const { error: reauthError } = await supabase.auth.reauthenticate();
      setBusy(false);
      if (reauthError) setStatus(reauthError.message);
      else {
        setToken("");
        setFlow("reauth-password");
        setStatus("Enter the reauthentication code sent to your email.");
      }
      return;
    }
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      clearForm();
      setFlow("");
      setStatus("Password updated successfully.");
    }
  };
  const finishSecurePasswordChange = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.updateUser({
      password,
      nonce: token.trim(),
    });
    setBusy(false);
    if (error) setStatus(error.message);
    else {
      clearForm();
      setFlow("");
      setStatus("Password updated successfully.");
    }
  };
  const requestEmailChange = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { data, error } = await supabase.auth.updateUser({ email: newEmail });
    setBusy(false);
    if (error) setStatus(error.message);
    else if (data.user?.email === newEmail) {
      setFlow("");
      setStatus("Email updated successfully.");
    } else {
      setVerificationEmail(newEmail);
      setToken("");
      setFlow("email-token");
      setStatus(
        "Enter the code sent by Supabase. Secure email change may require a code from both inboxes.",
      );
    }
  };
  const saveUsername = async () => {
    if (!session || !supabase || !validUsername(username)) {
      setStatus(
        "Username must be 3–24 lowercase letters, numbers, or underscores.",
      );
      return;
    }
    setBusy(true);
    setStatus("");
    const normalized = normalizeUsername(username);
    const { error } = await supabase
      .from("profiles")
      .update({ username: normalized })
      .eq("id", session.user.id);
    setBusy(false);
    if (error)
      setStatus(
        error.code === "23505" ? "That username is already taken." : error.message,
      );
    else {
      setUsername(normalized);
      setStatus("Username updated successfully.");
    }
  };
  const saveAccountSettings = async () => {
    if (!supabase) return;
    if (
      sharingPreferences.copySharingPinEnabled &&
      !hasSharingPin &&
      !/^\d{6}$/.test(sharingPin)
    ) {
      setStatus("Enter a 6-digit PIN to enable the sharing lock.");
      return;
    }
    if (sharingPin && !/^\d{6}$/.test(sharingPin)) {
      setStatus("The sharing PIN must contain exactly 6 digits.");
      return;
    }
    setBusy(true);
    setStatus("");
    const { error } = await supabase.rpc("update_copy_sharing_settings", {
      anonymize: sharingPreferences.anonymizeShares,
      sharing_enabled: sharingPreferences.copySharingEnabled,
      pin_enabled: sharingPreferences.copySharingPinEnabled,
      new_pin: sharingPin || null,
    });
    if (error) {
      setBusy(false);
      setStatus(error.message);
    } else {
      const { error: inviteSettingError } = await supabase
        .from("profiles")
        .update({
          receive_group_invites: sharingPreferences.receiveGroupInvites,
        })
        .eq("id", session.user.id);
      setBusy(false);
      if (inviteSettingError) {
        setStatus(inviteSettingError.message);
        return;
      }
      setHasSharingPin(sharingPreferences.copySharingPinEnabled);
      setSharingPin("");
      setStatus("Account settings saved.");
      window.dispatchEvent(new Event("tally-sharing-settings-changed"));
    }
  };
  const verifyEmailChange = async (event) => {
    event.preventDefault();
    setBusy(true);
    setStatus("");
    const { error } = await supabase.auth.verifyOtp({
      email: verificationEmail,
      token: token.trim(),
      type: "email_change",
    });
    if (error) {
      setBusy(false);
      setStatus(error.message);
      return;
    }
    const { data } = await supabase.auth.getUser();
    setBusy(false);
    setToken("");
    if (data.user?.email === newEmail) {
      setFlow("");
      setStatus("Email updated successfully.");
    } else
      setStatus(
        "That address is confirmed. Enter the code from the other inbox and change the email field to match it.",
      );
  };
  const resendSignup = async () => {
    setBusy(true);
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: pendingEmail,
    });
    setBusy(false);
    setStatus(error ? error.message : "A new verification code was sent.");
  };
  const signOut = async () => {
    setBusy(true);
    await supabase?.auth.signOut();
    setBusy(false);
    onClose();
  };
  const deleteAccount = async () => {
    if (deleteText !== "DELETE" || !supabase) return;
    setBusy(true);
    setStatus("");
    const { error } = await supabase.functions.invoke("delete-account", {
      body: { confirmation: "DELETE" },
    });
    if (error) {
      setStatus(error.message || "Account deletion failed.");
      setBusy(false);
      return;
    }
    await supabase.auth.signOut({ scope: "local" });
    onDeleted();
  };
  const back = () => {
    clearForm();
    setFlow("");
    setDeleting(false);
  };
  const title =
    accountSettingsOpen
      ? "Account settings"
      : flow === "signup-token"
      ? "Enter verification code"
      : flow === "recovery-request"
        ? "Reset your password"
        : flow === "recovery-token"
          ? "Enter recovery code"
          : flow === "recovery-password"
            ? "Choose a new password"
            : flow === "change-password"
              ? "Change password"
              : flow === "reauth-password"
                ? "Confirm it’s you"
                : flow === "change-email"
                  ? "Change email address"
                  : flow === "email-token"
                    ? "Confirm email change"
                    : session
                      ? "Your Tally account"
                      : mode === "signin"
                        ? "Sign in to sync"
                        : "Create an account";
  let content;
  if (!configured)
    content = (
      <div className="auth-notice">
        <b>Supabase is not configured yet.</b>
        <p>
          Add your project URL and publishable key to a local <code>.env</code>{" "}
          file, then restart the development server.
        </p>
      </div>
    );
  else if (flow === "signup-token")
    content = (
      <>
        <p className="auth-code-intro">
          We sent a verification code to <strong>{pendingEmail}</strong>.
        </p>
        <form className="auth-form" onSubmit={verifySignup}>
          <TokenField token={token} setToken={setToken} />
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy || !token}>
            {busy ? "Verifying…" : "Verify account"}
          </button>
        </form>
        <div className="auth-code-actions">
          <button onClick={resendSignup} disabled={busy}>
            Resend code
          </button>
          <button onClick={back}>Change email</button>
        </div>
      </>
    );
  else if (flow === "recovery-request")
    content = (
      <>
        <p className="auth-code-intro">
          Enter your account email and we’ll send a password-reset code.
        </p>
        <form className="auth-form" onSubmit={requestRecovery}>
          <label>
            Email address
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
            />
          </label>
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy}>
            {busy ? "Sending…" : "Send reset code"}
          </button>
        </form>
        <BackButton onClick={back} />
      </>
    );
  else if (flow === "recovery-token")
    content = (
      <>
        <p className="auth-code-intro">
          Enter the recovery code sent to <strong>{pendingEmail}</strong>.
        </p>
        <form className="auth-form" onSubmit={verifyRecovery}>
          <TokenField token={token} setToken={setToken} />
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy || !token}>
            {busy ? "Verifying…" : "Continue"}
          </button>
        </form>
        <BackButton onClick={() => setFlow("recovery-request")} />
      </>
    );
  else if (flow === "recovery-password")
    content = (
      <form className="auth-form" onSubmit={updateRecoveredPassword}>
        <PasswordFields
          password={password}
          setPassword={setPassword}
          confirmation={confirmation}
          setConfirmation={setConfirmation}
          autoFocus
        />
        {status && <div className="auth-status">{status}</div>}
        <button className="save" disabled={busy}>
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    );
  else if (flow === "change-password")
    content = (
      <>
        <form className="auth-form" onSubmit={changePassword}>
          <PasswordFields
            password={password}
            setPassword={setPassword}
            confirmation={confirmation}
            setConfirmation={setConfirmation}
            autoFocus
          />
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy}>
            {busy ? "Updating…" : "Change password"}
          </button>
        </form>
        <BackButton onClick={back} />
      </>
    );
  else if (flow === "reauth-password")
    content = (
      <>
        <p className="auth-code-intro">
          Your session is more than 24 hours old, so Supabase sent a
          reauthentication code to your email.
        </p>
        <form className="auth-form" onSubmit={finishSecurePasswordChange}>
          <TokenField token={token} setToken={setToken} />
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy || !token}>
            {busy ? "Updating…" : "Confirm and change password"}
          </button>
        </form>
        <BackButton onClick={back} />
      </>
    );
  else if (flow === "change-email")
    content = (
      <>
        <p className="auth-code-intro">
          Your current email is <strong>{session?.user?.email}</strong>.
        </p>
        <form className="auth-form" onSubmit={requestEmailChange}>
          <label>
            New email address
            <input
              type="email"
              required
              autoComplete="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              autoFocus
            />
          </label>
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy}>
            {busy ? "Sending…" : "Send confirmation code"}
          </button>
        </form>
        <BackButton onClick={back} />
      </>
    );
  else if (flow === "email-token")
    content = (
      <>
        <p className="auth-code-intro">
          Enter a code and the exact email address where you received it.
        </p>
        <form className="auth-form" onSubmit={verifyEmailChange}>
          <label>
            Email receiving this code
            <input
              type="email"
              required
              value={verificationEmail}
              onChange={(e) => setVerificationEmail(e.target.value)}
            />
          </label>
          <TokenField token={token} setToken={setToken} />
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy || !token}>
            {busy ? "Verifying…" : "Verify email"}
          </button>
        </form>
        <BackButton onClick={back} />
      </>
    );
  else if (session && accountSettingsOpen)
    content = (
      <div className="account-settings-view">
        <nav className="account-settings-tabs">
          <button className={accountSettingsTab === "sharing" ? "active" : ""} onClick={() => setAccountSettingsTab("sharing")}>Sharing</button>
          <button className={accountSettingsTab === "groups" ? "active" : ""} onClick={() => setAccountSettingsTab("groups")}>Groups</button>
        </nav>
        {accountSettingsTab === "groups" ? (
          <>
            <GroupSettingsBoundary>
              <GroupSettings session={session} />
            </GroupSettingsBoundary>
            <div className="account-settings-actions">
              <button
                type="button"
                onClick={() => {
                  setAccountSettingsOpen(false);
                  setAccountSettingsTab("sharing");
                }}
              >
                Back
              </button>
            </div>
          </>
        ) : <>
        <div className="account-setting-row">
          <div>
            <b>Anonymize shares</b>
            <small>Recipients will see “A Tally user” instead of your username.</small>
          </div>
          <button
            type="button"
            className={`setting-switch ${sharingPreferences.anonymizeShares ? "active" : ""}`}
            onClick={() =>
              setSharingPreferences((current) => ({
                ...current,
                anonymizeShares: !current.anonymizeShares,
              }))
            }
            aria-pressed={sharingPreferences.anonymizeShares}
          >
            <i />
          </button>
        </div>
        <div className="account-setting-row">
          <div>
            <b>Lock sending with a PIN</b>
            <small>Require a 6-digit PIN whenever you send a counter copy.</small>
          </div>
          <button
            type="button"
            className={`setting-switch ${sharingPreferences.copySharingPinEnabled ? "active" : ""}`}
            onClick={() =>
              setSharingPreferences((current) => ({
                ...current,
                copySharingPinEnabled: !current.copySharingPinEnabled,
              }))
            }
            aria-pressed={sharingPreferences.copySharingPinEnabled}
          >
            <i />
          </button>
        </div>
        {sharingPreferences.copySharingPinEnabled && (
          <label className="account-pin-field">
            {hasSharingPin ? "New sharing PIN (optional)" : "Sharing PIN"}
            <input
              type="password"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={sharingPin}
              onChange={(event) =>
                setSharingPin(
                  event.target.value.replace(/\D/g, "").slice(0, 6),
                )
              }
              placeholder={hasSharingPin ? "Leave blank to keep it" : "6 digits"}
              autoComplete="off"
            />
          </label>
        )}
        <div className="account-setting-row account-sharing-disable">
          <div>
            <b>Receive counter copies</b>
            <small>
              Turn this off to decline incoming copies. You can still send
              copies to other users.
            </small>
          </div>
          <button
            type="button"
            className={`setting-switch ${sharingPreferences.copySharingEnabled ? "active" : ""}`}
            onClick={() =>
              setSharingPreferences((current) => ({
                ...current,
                copySharingEnabled: !current.copySharingEnabled,
              }))
            }
            aria-pressed={sharingPreferences.copySharingEnabled}
          >
            <i />
          </button>
        </div>
        <div className="account-setting-row">
          <div>
            <b>Receive group invitations</b>
            <small>Allow group owners to invite you to shared counters.</small>
          </div>
          <button type="button" className={`setting-switch ${sharingPreferences.receiveGroupInvites ? "active" : ""}`} onClick={() => setSharingPreferences((current) => ({ ...current, receiveGroupInvites: !current.receiveGroupInvites }))} aria-pressed={sharingPreferences.receiveGroupInvites}><i /></button>
        </div>
        {status && <div className="auth-status">{status}</div>}
        <div className="account-settings-actions">
          <button
            type="button"
            onClick={() => {
              setAccountSettingsOpen(false);
              setStatus("");
              setSharingPin("");
            }}
          >
            Back
          </button>
          <button className="save" disabled={busy} onClick={saveAccountSettings}>
            {busy ? "Saving…" : "Save settings"}
          </button>
        </div>
        </>}
      </div>
    );
  else if (session)
    content = (
      <div className="account-view">
        <div className="account-avatar">
          <User />
        </div>
        <div className="account-email-row">
          <strong>{session.user.email}</strong>
          <button
            type="button"
            title="Account settings"
            aria-label="Account settings"
            onClick={() => {
              setStatus("");
              setAccountSettingsTab("sharing");
              setAccountSettingsOpen(true);
            }}
          >
            <Settings2 />
          </button>
        </div>
        <div className="account-username">
          <label>
            Username
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="your_username"
              autoComplete="username"
            />
          </label>
          <button onClick={saveUsername} disabled={busy || !username}>
            Save username
          </button>
        </div>
        <span>
          <Cloud /> {syncStatus}
        </span>
        <p>
          Your counters and preferences sync automatically while you’re signed
          in. They also remain saved on this device.
        </p>
        {status && <div className="auth-status account-status">{status}</div>}
        <div className="account-security-actions">
          <button
            onClick={() => {
              clearForm();
              setFlow("change-password");
            }}
          >
            Change password
          </button>
          <button
            onClick={() => {
              clearForm();
              setNewEmail("");
              setFlow("change-email");
            }}
          >
            Change email
          </button>
        </div>
        <button onClick={signOut} disabled={busy}>
          <LogOut /> Sign out
        </button>
        {!deleting ? (
          <button
            className="delete-account-link"
            onClick={() => setDeleting(true)}
            disabled={busy}
          >
            <Trash2 /> Delete account
          </button>
        ) : (
          <div className="delete-account-panel">
            <b>Permanently delete this account?</b>
            <p>
              This removes the account and its cloud data. Counters and
              settings saved in this browser will remain available without an
              account. Type <strong>DELETE</strong> to continue.
            </p>
            <input
              value={deleteText}
              onChange={(e) => setDeleteText(e.target.value)}
              placeholder="Type DELETE"
              autoComplete="off"
            />
            {status && <div className="auth-status">{status}</div>}
            <div>
              <button
                onClick={() => {
                  setDeleting(false);
                  setDeleteText("");
                  setStatus("");
                }}
              >
                Cancel
              </button>
              <button
                className="confirm-delete"
                disabled={deleteText !== "DELETE" || busy}
                onClick={deleteAccount}
              >
                {busy ? "Deleting…" : "Delete forever"}
              </button>
            </div>
          </div>
        )}
      </div>
    );
  else
    content = (
      <>
        <div className="auth-tabs">
          <button
            className={mode === "signin" ? "active" : ""}
            onClick={() => {
              setMode("signin");
              clearForm();
            }}
          >
            Sign in
          </button>
          <button
            className={mode === "signup" ? "active" : ""}
            onClick={() => {
              setMode("signup");
              clearForm();
            }}
          >
            Create account
          </button>
        </div>
        <form className="auth-form" onSubmit={submit}>
          <label>
            {mode === "signin" ? "Email or username" : "Email address"}
            <input
              type={mode === "signin" ? "text" : "email"}
              required
              autoComplete={mode === "signin" ? "username" : "email"}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                mode === "signin" ? "you@example.com or username" : "you@example.com"
              }
            />
          </label>
          {mode === "signup" && (
            <label>
              Username
              <input
                type="text"
                required
                minLength={3}
                maxLength={24}
                pattern="[a-z0-9_]+"
                autoComplete="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="lowercase_letters_123"
              />
              <small>3–24 lowercase letters, numbers, or underscores.</small>
            </label>
          )}
          <label>
            Password
            <input
              type="password"
              required
              minLength={mode === "signup" ? 8 : 1}
              autoComplete={
                mode === "signin" ? "current-password" : "new-password"
              }
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={
                mode === "signin" ? "Your password" : "At least 8 characters"
              }
            />
          </label>
          {mode === "signup" && (
            <>
              <label>
                Confirm password
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  value={confirmation}
                  onChange={(e) => setConfirmation(e.target.value)}
                  placeholder="Enter it again"
                />
              </label>
              <PasswordRequirements password={password} />
            </>
          )}
          {status && <div className="auth-status">{status}</div>}
          <button className="save" disabled={busy}>
            {busy
              ? "Please wait…"
              : mode === "signin"
                ? "Sign in"
                : "Create account"}
          </button>
        </form>
        {mode === "signin" && (
          <button
            className="forgot-password"
            onClick={() => {
              clearForm();
              setFlow("recovery-request");
            }}
          >
            Forgot your password?
          </button>
        )}
        <p className="auth-privacy">
          Accounts are optional. Without one, counters stay only in this
          browser.
        </p>
      </>
    );
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="modal auth-modal">
        <div className="modal-head">
          <div>
            <span>OPTIONAL ACCOUNT</span>
            <h2>{title}</h2>
          </div>
          <button onClick={onClose}>
            <X />
          </button>
        </div>
        {content}
      </div>
    </div>
  );
}

function PasswordRequirements({ password }) {
  const checks = passwordChecks(password);
  return (
    <div className="password-requirements">
      <span className={checks.length ? "met" : ""}>8+ characters</span>
      <span className={checks.lower ? "met" : ""}>Lowercase</span>
      <span className={checks.upper ? "met" : ""}>Uppercase</span>
      <span className={checks.digit ? "met" : ""}>Number</span>
      <span className={checks.symbol ? "met" : ""}>Symbol</span>
    </div>
  );
}
function TokenField({ token, setToken }) {
  return (
    <label>
      Verification code
      <input
        className="auth-code-input"
        required
        inputMode="numeric"
        autoComplete="one-time-code"
        value={token}
        onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
        placeholder="Enter your code"
        autoFocus
      />
    </label>
  );
}
function BackButton({ onClick }) {
  return (
    <div className="auth-code-actions">
      <button type="button" onClick={onClick}>
        Back
      </button>
    </div>
  );
}
