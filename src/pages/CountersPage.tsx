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
import { useEffect, useRef, useState } from "react";
import {
  Plus,
  Minus,
  Settings2,
  RotateCcw,
  Trash2,
  X,
  Check,
  Target,
  Hash,
  Sparkles,
  Moon,
  Sun,
  Code2,
  Copy,
  BarChart3,
  Download,
  Upload,
  User,
  Cloud,
  LogOut,
  Search,
  Folder,
  Tags,
  History as HistoryIcon,
  Undo2,
  Redo2,
  FolderPlus,
  ChevronRight,
} from "lucide-react";
import {
  supabase,
  supabaseConfigured,
} from "../lib/supabase";
import { runTallyScript } from "../features/scripting/tallyscript";
import { createInvocationRegistry } from "../features/scripting/runtime";
import {
  COLORS,
  COUNTER_SUPER_PARTS,
  EMBED_ORIGIN,
  REMOVED_SUPER_TYPES,
  TRASH_LIFETIME,
  countersEqual,
  decodeCounter,
  encodeCounter,
  getGoals,
  normalizeSuperSettings,
  sanitize,
  STARTER,
  type AnyRecord,
} from "../features/counters/model";
import { AuthModal } from "../features/auth/AuthModal";
import { createRemoteUserValidator } from "../features/auth/remoteUserValidation";
import { EmbedBuilder } from "../features/embed/EmbedComponents";
import { Editor } from "../features/counters/CounterEditor";
import {
  SuperEditorPane,
  SuperSettings,
  SuperZoneContent,
} from "../features/tally-super/TallySuper";
import { persistCustomization } from "../features/tally-super/persistence";
import { guardedRawWrite, guardedAtomicWrite, guardedRemove } from "../shared/persistence/guardedStorage";
import { readJson, readRaw, readRecords } from "../features/counters/workspacePersistence";

import { TrashModal } from "../features/trash/TrashModal";
import { StatsModal } from "../features/stats/StatsModal";
import { buildStatisticResetBaseline } from "../features/stats/sessionLedger";
import { HistoryModal } from "../features/history/HistoryModal";
import { AppSettings } from "../features/settings/AppSettings";
import {
  CopySharePrompt,
  ShareCounterModal,
  useCopySharing,
} from "../features/sharing/CopySharing";
import {
  GroupInvitePrompt,
  SharedCountersView,
} from "../features/groups/SharedGroups";
import { useSharedGroups } from "../features/groups/useSharedGroups";
import {
  SettingChoice,
  SyncConflictModal,
} from "../shared/components/SettingsControls";
import { CounterCard, isComplete } from "../features/counters/CounterCard";
import { appendActivityEntry, applyCounterCommand, applyLimitEdit, applyScriptProposal, normalizeScriptRecords, readActivityPartitions, splitActivityEntries, validateScriptRecord } from "../features/counters/operations";
import { appendEligibleSyncJournal, commitImportPlan, commitStorageAtomically, createImportPlan, prepareImport, recoverStorageTransaction, workspaceDigest } from "../features/settings/backupImport";
import { deleteFolder, folderPath, migrateLegacyOrganization, normalizeTags, type Folder as FolderRecord, validateFolders } from "../features/counters/organization";
import { normalizePreferences } from "../features/settings/preferences";
import { BUNDLE_STORAGE_KEY, convertToLocal, enterTrash, expireTrash, hydrateBundleState, permanentDelete, persistBundleState, restoreBundle } from "../features/counters/bundle";
import { acknowledgeJournal, appendJournal, buildEligibleUpload, buildEligibleWorkspace, commitConflictAtomically, deliverJournalEntry, preserveLocalBrowserSections, readReplayJournal, resolveConflict, shouldPresentWorkspaceConflict, stampJournalEntry, statusLabel } from "../features/settings/sync";
import { buildLocalCopyBundle, clearCopyAcceptanceJournal, commitLocalCopyAtomically, readCopyAcceptanceJournal, reconcileCloudWorkspace, shouldBlockCloudConflict, writeCopyAcceptanceJournal } from "../features/sharing/copyAcceptance";

const cleanFolderPath = (value = "") => String(value).split("/").map((part) => part.trim()).filter(Boolean).join("/");
const folderAncestors = (value = "") => {
  const parts = cleanFolderPath(value).split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
};
const folderParent = (value = "") => {
  const parts = cleanFolderPath(value).split("/");
  return parts.slice(0, -1).join("/");
};

const unavailableStorage = {
  getItem: () => null,
  setItem: () => { throw new Error("Browser storage recovery is pending."); },
  removeItem: () => { throw new Error("Browser storage recovery is pending."); },
  clear: () => { throw new Error("Browser storage recovery is pending."); },
  key: () => null,
  get length() { return 0; },
} as unknown as Storage;

export function CountersPage({ theme, onThemeChange, navigateTo = (target) => window.location.assign(target), shutdownTimeoutMs = 5000, shutdownStorage = localStorage }) {
  const [startupRecovery] = useState(() => recoverStorageTransaction(window.localStorage));
  // A failed prior transaction must not expose a mixture of aggregate sections.
  const localStorage = startupRecovery.ok ? window.localStorage : unavailableStorage;
  const [counters, setCounters] = useState(() => {
    try {
      const bundle = JSON.parse(readRaw(localStorage, BUNDLE_STORAGE_KEY) || "null");
      if (bundle?.version === 1 && Array.isArray(bundle.state?.active)) {
        return bundle.state.active;
      }
      const saved = readRecords(localStorage, "tally-counters");
      return saved.some((counter) => counter.folder && !counter.folderId)
        ? migrateLegacyOrganization(readRecords(localStorage, "tally-folders"), saved).counters
        : saved;
    } catch {
      return [];
    }
  });
  const [trash, setTrash] = useState(() => {
    try {
      return readRecords(localStorage, "tally-trash").filter(
        (counter) => Date.now() - Number(counter.deletedAt) < TRASH_LIFETIME,
      );
    } catch {
      return [];
    }
  });
  const [editing, setEditing] = useState(null);
  const [editingTrash, setEditingTrash] = useState(false);
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState(null);
  const [embedding, setEmbedding] = useState(null);
  const [sharingCounter, setSharingCounter] = useState(null);
  const [history, setHistory] = useState(() => readActivityPartitions(localStorage).valid);
  const [historyQuarantine, setHistoryQuarantine] = useState(() => readActivityPartitions(localStorage).quarantine);
  const [sessionLedger, setSessionLedger] = useState<AnyRecord[]>([]);
  const [activityPersistenceStatus, setActivityPersistenceStatus] = useState("Saved locally");
  const activityDurable = useRef({
    history: readRaw(localStorage, "tally-history"),
    redo: readRaw(localStorage, "tally-redo"),
    branches: readRaw(localStorage, "tally-undo-branches"),
    quarantine: readRaw(localStorage, "tally-history-quarantine"),
  });
  const sessionStartedAt = useRef(Date.now());
  const [redoStack, setRedoStack] = useState(() => {
    try {
      const saved = JSON.parse(readRaw(localStorage, "tally-redo") || "null");
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [undoBranches, setUndoBranches] = useState(() => {
    try {
      const saved = JSON.parse(readRaw(localStorage, "tally-undo-branches") || "null");
      return saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {};
    } catch { return {}; }
  });
  const [historyCounterId, setHistoryCounterId] = useState("");
  const [counterSearch, setCounterSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [organizationNotice, setOrganizationNotice] = useState("");
  const [folders, setFolders] = useState<FolderRecord[]>(() => {
    try {
      const saved = readRecords(localStorage, "tally-folders");
      if (Array.isArray(saved) && saved.every((folder) => folder && typeof folder === "object" && folder.id)) return validateFolders(saved);
      const migrated = migrateLegacyOrganization(saved, counters);
      return migrated.folders;
    } catch {
      const migrated = migrateLegacyOrganization([], counters);
      return migrated.folders;
    }
  });
  const [draggedFolder, setDraggedFolder] = useState("");
  const [currentFolder, setCurrentFolder] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [renamingFolder, setRenamingFolder] = useState<string | null>(null);
  const [draggedCounterId, setDraggedCounterId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [superEditorOpen, setSuperEditorOpen] = useState(false);
  const [statResets, setStatResets] = useState({});
  const [session, setSession] = useState(null);
  const copySharing = useCopySharing(session);
  const sharedGroups = useSharedGroups(session);
  const [workspaceTab, setWorkspaceTab] = useState("mine");
  const bundleHydrated = useRef(false);
  useEffect(() => {
    if (!session && workspaceTab === "shared") setWorkspaceTab("mine");
  }, [session, workspaceTab]);
  const [authOpen, setAuthOpen] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [syncConflict, setSyncConflict] = useState(null);
  const [singletonChoices, setSingletonChoices] = useState({});
  const syncRevision = useRef(0);
  const sessionGeneration = useRef(0);
  const syncWorkerRunning = useRef(false);
  const authoritativeCopyRefresh = useRef<(() => Promise<boolean>) | null>(null);
  const [authNotice, setAuthNotice] = useState("");
  const [superSettings, setSuperSettings] = useState(() => {
    try {
      return normalizeSuperSettings(
        readJson(localStorage, "tally-super", {}, (value): value is AnyRecord => Boolean(value && typeof value === "object" && !Array.isArray(value))),
      );
    } catch {
      return normalizeSuperSettings({});
    }
  });
  const countersRef = useRef(counters);
  const trashRef = useRef(trash);
  const superSettingsRef = useRef(superSettings);
  const durableSuperSettings = useRef(superSettings);
  countersRef.current = counters;
  trashRef.current = trash;
  superSettingsRef.current = superSettings;
  const [scripts, setScripts] = useState<AnyRecord>(() => {
    try {
      const saved = readJson(localStorage, "tally-scripts", {}, (value): value is AnyRecord => Boolean(value && typeof value === "object" && !Array.isArray(value)));
      return normalizeScriptRecords(saved);
    } catch {
      return {};
    }
  });
  const scriptExecutions = useRef(createInvocationRegistry());
  const unloadFlushStarted = useRef(false);
  const sharedShutdownCallbacks = useRef(new Set<() => void>());
  const shutdownPrepared = useRef<AnyRecord | null>(null);
  const shutdownOperationId = useRef<string | null>(null);
  const [runningScripts, setRunningScripts] = useState(() => new Set());
  const [scriptErrors, setScriptErrors] = useState<AnyRecord>({});
  const [shutdown, setShutdown] = useState<AnyRecord | null>(null);
  const [preferences, setPreferences] = useState(() => {
    const defaults = normalizePreferences({ defaultColor: COLORS[0] });
    try {
      return {
        ...defaults,
        ...normalizePreferences(readJson(localStorage, "tally-preferences", {}, (value): value is AnyRecord => Boolean(value && typeof value === "object" && !Array.isArray(value)))),
      };
    } catch {
      return defaults;
    }
  });
  const workspaceSnapshot = useRef({ counters, trash, scripts, superSettings, preferences, folders });
  workspaceSnapshot.current = { counters, trash, scripts, superSettings, preferences, folders };

  const validateRemoteUser = createRemoteUserValidator({ client: supabase, session, onSignedOut: () => {
    setSession(null);
    setSyncReady(false);
    setSyncConflict(null);
    setSyncStatus(statusLabel("Local-only"));
    setAuthNotice(
      "Your account was deleted or this device is no longer authorized. You have been signed out, but your counters remain saved locally.",
    );
  } });

  useEffect(() => {
    if (bundleHydrated.current) return;
    const aggregate = hydrateBundleState(localStorage, { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {} });
    bundleHydrated.current = true;
    if (readRaw(localStorage, BUNDLE_STORAGE_KEY)) {
      setCounters(aggregate.active); setTrash(aggregate.retained); setScripts(normalizeScriptRecords(aggregate.scripts));
      setSuperSettings((current) => ({ ...current, counterCustomizations: aggregate.customizations }));
    }
  }, [counters, trash, scripts, superSettings.counterCustomizations]);
  useEffect(() => {
    if (!bundleHydrated.current) return;
    try { persistBundleState(localStorage, { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {} }); }
    catch { setOrganizationNotice("Bundle changes could not be saved; previous data was retained."); }
  }, [counters, trash, scripts, superSettings.counterCustomizations]);
  useEffect(() => {
    const next = {
      history: JSON.stringify(history),
      redo: JSON.stringify(redoStack),
      branches: JSON.stringify(undoBranches),
      quarantine: JSON.stringify(historyQuarantine),
    };
    try {
      const previous = Object.entries(activityDurable.current).map(([key, value]) => [`tally-${key === "branches" ? "undo-branches" : key}`, value] as [string, string]);
      const result = guardedAtomicWrite(localStorage, Object.entries(next).map(([key, value]) => [`tally-${key === "branches" ? "undo-branches" : key}`, value] as [string, string]), previous);
      if (!result.ok) throw new Error("reason" in result ? result.reason : "storage failure");
      activityDurable.current = next;
      setActivityPersistenceStatus("Saved locally");
    } catch {
      let localOk = true;
      try {
        for (const [key, value] of [["tally-history", activityDurable.current.history], ["tally-redo", activityDurable.current.redo], ["tally-undo-branches", activityDurable.current.branches], ["tally-history-quarantine", activityDurable.current.quarantine]]) {
          if (value == null) guardedRemove(localStorage, key, value); else guardedRawWrite(localStorage, key, value, null);
        }
      } catch { /* retain the in-memory state and report unsaved status */ }
      setActivityPersistenceStatus("Unsaved activity changes — retry available");
    }
  }, [history, redoStack, undoBranches, historyQuarantine]);
  useEffect(() => {
    const result = guardedRawWrite(localStorage, "tally-folders", JSON.stringify(folders), readRaw(localStorage, "tally-folders"));
    if (!result.ok) setOrganizationNotice("Unsaved folder changes. Retry available.");
  }, [folders]);
  useEffect(() => {
    const missing = counters.some((counter) => counter.folderId && !folders.some((folder) => folder.id === counter.folderId));
    if (missing) {
      setCounters((items) => items.map((counter) => counter.folderId && !folders.some((folder) => folder.id === counter.folderId) ? { ...counter, folderId: null } : counter));
      setOrganizationNotice("Some counters referenced missing folders and were recovered to My counters.");
    }
  }, [counters, folders]);
  useEffect(() => {
    const purge = () => {
      const now = Date.now();
      const expired = new Set(trashRef.current.filter((item) => Number(item.retainedUntil || Number(item.deletedAt) + TRASH_LIFETIME) <= now).map((item) => String(item.id)));
      if (!expired.size) return;
      expired.forEach((id) => stopScript(id));
      setTrash((items) => expireTrash(items, now));
      setScripts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => !expired.has(String(id)))));
      setSuperSettings((current) => ({ ...current, counterCustomizations: Object.fromEntries(Object.entries(current.counterCustomizations || {}).filter(([id]) => !expired.has(String(id)))) }));
    };
    purge();
    const timer = setInterval(purge, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    const result = guardedRawWrite(localStorage, "tally-preferences", JSON.stringify(preferences), readRaw(localStorage, "tally-preferences"));
    if (!result.ok) setOrganizationNotice("Unsaved preference changes. Retry available.");
  }, [preferences]);
  useEffect(() => {
    const result = persistCustomization(durableSuperSettings.current, superSettings, (next) => { const write = guardedRawWrite(localStorage, "tally-super", JSON.stringify({ ...next, counterCustomizations: {} }), readRaw(localStorage, "tally-super")); if (!write.ok) throw new Error("reason" in write ? write.reason : "storage failure"); });
    if (result.ok) durableSuperSettings.current = result.value;
    else setOrganizationNotice("Tally Super changes are unsaved; the previous customization remains authoritative. Retry saving.");
  }, [superSettings]);
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      sessionGeneration.current += 1;
      setSession(nextSession);
      if (nextSession) setAuthNotice("");
    });
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!supabase || !session) return;
    const checkAccount = () => {
      if (document.visibilityState === "visible") validateRemoteUser();
    };
    window.addEventListener("focus", checkAccount);
    document.addEventListener("visibilitychange", checkAccount);
    return () => {
      window.removeEventListener("focus", checkAccount);
      document.removeEventListener("visibilitychange", checkAccount);
    };
  }, [session?.user?.id]);
  useEffect(() => {
    if (!session) return;
    let cancelled = false;
    const replay = async () => {
      if (cancelled || syncWorkerRunning.current) return;
      syncWorkerRunning.current = true;
      const generation = sessionGeneration.current;
      const entries = readReplayJournal(localStorage, session.user.id, generation);
      for (const entry of entries) {
        if (cancelled || generation !== sessionGeneration.current) break;
        setSyncStatus(statusLabel("Saving", !navigator.onLine));
        const result = await deliverJournalEntry(entry, {
          accountId: session.user.id,
          generation,
          revision: syncRevision.current,
          rpc: async (args) => supabase.rpc("update_user_data_revision", args),
        });
        if (result.state === "stale") break;
        if (result.state === "acknowledged") {
          if (Number.isFinite(result.revision)) syncRevision.current = result.revision;
          acknowledgeJournal(localStorage, entry.operationId, generation, entry.baseRevision);
          continue;
        }
        if (result.state === "conflict") {
          setSyncStatus(statusLabel("Conflict"));
          setSyncConflict({ deviceCounters: counters, cloudCounters: [], cloudPreferences: null, cloudSuper: null, cloudScripts: null, deviceFolders: folders, cloudFolders: folders });
          break;
        }
        if (result.state === "unknown") { setSyncStatus(statusLabel("Saving", !navigator.onLine)); break; }
        setSyncStatus(statusLabel("Error", !navigator.onLine));
        break;
      }
      if (!cancelled && !readReplayJournal(localStorage, session.user.id, generation).length) setSyncStatus(statusLabel("Synchronized", !navigator.onLine));
      syncWorkerRunning.current = false;
    };
    window.addEventListener("online", replay);
    void replay();
    return () => { cancelled = true; syncWorkerRunning.current = false; window.removeEventListener("online", replay); };
  }, [session?.user?.id, syncReady]);
  useEffect(() => {
    if (!supabase || !session) {
      setSyncReady(false);
      setSyncConflict(null);
      setSyncStatus(statusLabel("Local-only"));
      return;
    }
    let cancelled = false;
    const loadCloud = async (authoritativeCopy = false) => {
      const { counters, trash, scripts, superSettings, preferences, folders } = workspaceSnapshot.current;
      setSyncStatus(statusLabel("Loading"));
      const { data, error } = await supabase
        .from("user_data")
        .select("counters,preferences,tally_super,scripts,folders,revision")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if ((await validateRemoteUser()) !== false) setSyncStatus(statusLabel("Error", !navigator.onLine));
        return;
      }
      if (data) {
        syncRevision.current = Number(data.revision) || 0;
        const localCounters = counters
          .filter((counter) => counter.localOnly)
          .map(sanitize);
        const deviceCounters = counters
          .filter((counter) => !counter.localOnly)
          .map(sanitize);
        const cloudRows = Array.isArray(data.counters) ? data.counters : [];
        const cloudFolders = Array.isArray(data.folders) ? validateFolders(data.folders) : [];
        const cloudCounters = cloudRows
          .filter((counter) => !counter.deletedAt)
          .map((counter) => sanitize({ ...counter, localOnly: false }));
        const cloudTrash = cloudRows
          .filter(
            (counter) =>
              counter.deletedAt &&
              Date.now() - Number(counter.deletedAt) < TRASH_LIFETIME,
          )
          .map((counter) => sanitize({ ...counter, localOnly: false }));
        const mergedTrash = [...trash];
        cloudTrash.forEach((counter) => {
          if (
            !mergedTrash.some((item) => String(item.id) === String(counter.id))
          )
            mergedTrash.push(counter);
        });
        const syncCloudTrash =
          data.preferences?.syncTrash ?? preferences.syncTrash;
        const deviceEligible = buildEligibleWorkspace({ counters, trash, folders, preferences, superSettings, scripts });
        const cloudEligible = buildEligibleWorkspace({ counters: cloudCounters, trash: cloudTrash, folders: cloudFolders, preferences: data.preferences || preferences, superSettings: { ...superSettings, uiCustomizations: data.tally_super?.uiCustomizations || {}, counterCustomizations: data.tally_super?.counterCustomizations || {} }, scripts: data.scripts || {} });
        const countersDiffer = !countersEqual(deviceCounters, cloudCounters);
        if (shouldBlockCloudConflict(deviceCounters.length, cloudCounters.length, countersDiffer, false) || shouldPresentWorkspaceConflict(deviceEligible, cloudEligible, authoritativeCopy)) {
          setSyncConflict({
            deviceCounters: [...localCounters, ...deviceCounters],
            cloudCounters: [...localCounters, ...cloudCounters],
            deviceWorkspace: deviceEligible,
            cloudWorkspace: cloudEligible,
            cloudPreferences: data.preferences,
            cloudSuper: data.tally_super,
            cloudScripts: data.scripts,
            cloudFolders,
            deviceFolders: folders,
            observedRevision: syncRevision.current,
          });
          setSingletonChoices({});
          setSyncStatus(statusLabel("Conflict"));
          return false;
        }
        if (syncCloudTrash) setTrash(mergedTrash);
        if (cloudCounters.length) {
          const reconciled = reconcileCloudWorkspace({ counters: cloudCounters, scripts: data.scripts, customizations: data.tally_super?.counterCustomizations, folders: cloudFolders }, { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {}, folders });
          setCounters(reconciled.counters);
          setFolders(validateFolders(reconciled.folders));
          if (data.preferences)
            setPreferences((current) => ({ ...current, ...data.preferences }));
          if (data.tally_super)
            setSuperSettings({ ...normalizeSuperSettings(data.tally_super), counterCustomizations: reconciled.customizations });
          setScripts(normalizeScriptRecords(reconciled.scripts));
        } else {
          const result = await queueAndDeliverUpload(buildEligibleUpload({ counters, trash: mergedTrash, folders, preferences, superSettings, scripts }));
          if (result.state !== "acknowledged") {
            if ((await validateRemoteUser()) !== false)
              setSyncStatus("Sync error");
            return;
          }
        }
      } else {
        const result = await queueAndDeliverUpload(buildEligibleUpload({ counters, trash, folders, preferences, superSettings, scripts }), 0);
        if (result.state !== "acknowledged") {
          if ((await validateRemoteUser()) !== false)
            setSyncStatus("Sync error");
          return;
        }
      }
      setSyncReady(true);
      setSyncStatus(statusLabel("Synchronized"));
      return true;
    };
    authoritativeCopyRefresh.current = () => loadCloud(true);
    const refreshCloud = () => { void loadCloud(); };
    window.addEventListener("tally-sync-refresh", refreshCloud);
    loadCloud();
    return () => {
      cancelled = true;
      authoritativeCopyRefresh.current = null;
      window.removeEventListener("tally-sync-refresh", refreshCloud);
    };
  }, [session?.user?.id]);
  const resolveSyncConflict = async (choice) => {
    if (!syncConflict) return;
    const resolution = resolveConflict(syncConflict.deviceWorkspace || { counters: syncConflict.deviceCounters.filter((counter) => !counter.localOnly), folders: syncConflict.deviceFolders, preferences: preferences, workspace: superSettings.uiCustomizations, counterCustomizations: Object.fromEntries(Object.entries(superSettings.counterCustomizations || {}).filter(([id]) => counters.some((counter) => String(counter.id) === id && !counter.localOnly))), scripts }, syncConflict.cloudWorkspace || { counters: syncConflict.cloudCounters.filter((counter) => !counter.localOnly), folders: syncConflict.cloudFolders || folders, preferences: syncConflict.cloudPreferences || preferences, workspace: syncConflict.cloudSuper?.uiCustomizations || superSettings.uiCustomizations, counterCustomizations: syncConflict.cloudSuper?.counterCustomizations || {}, scripts: syncConflict.cloudScripts || {} }, choice, syncConflict.observedRevision || syncRevision.current, syncRevision.current, singletonChoices);
    if (resolution.state === "stale") { setSyncStatus(statusLabel("Conflict")); return; }
    const candidate = resolution.workspace;
    const previous = readRaw(localStorage, BUNDLE_STORAGE_KEY) || JSON.stringify({ version: 1, state: { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {} } });
    const localCounters = counters.filter((counter) => counter.localOnly);
    const localTrash = trash.filter((counter) => counter.localOnly);
    const localScripts = Object.fromEntries(Object.entries(scripts || {}).filter(([id]) => localCounters.some((counter) => String(counter.id) === id)));
    const localCustomizations = Object.fromEntries(Object.entries(superSettings.counterCustomizations || {}).filter(([id]) => localCounters.some((counter) => String(counter.id) === id)));
    const localWorkspace = superSettings.uiCustomizations || {};
    const browserSections = preserveLocalBrowserSections({ counters: candidate.counters, scripts: candidate.scripts || {}, workspace: candidate.workspace || {} }, localCounters, localTrash, localScripts, localWorkspace);
    const nextCounters = browserSections.active;
    const nextTrash = browserSections.retained;
    const nextScripts = browserSections.scripts;
    const nextWorkspace = browserSections.workspace;
    const nextCustomizations = { ...(candidate.counterCustomizations || {}), ...localCustomizations };
    const nextAggregate = JSON.stringify({ version: 1, state: { active: nextCounters, retained: nextTrash, scripts: nextScripts, customizations: nextCustomizations } });
    const workspaceWrites = [
      { key: "tally-folders", previous: readRaw(localStorage, "tally-folders"), candidate: JSON.stringify(candidate.folders || folders) },
      { key: "tally-preferences", previous: readRaw(localStorage, "tally-preferences"), candidate: JSON.stringify(candidate.preferences || preferences) },
      { key: "tally-super", previous: readRaw(localStorage, "tally-super"), candidate: JSON.stringify({ ...superSettings, uiCustomizations: nextWorkspace, counterCustomizations: nextCustomizations }) },
      { key: "tally-scripts", previous: readRaw(localStorage, "tally-scripts"), candidate: JSON.stringify(nextScripts) },
    ];
    setSyncStatus(statusLabel("Saving"));
    const result = await commitConflictAtomically(localStorage, BUNDLE_STORAGE_KEY, previous, nextAggregate, async () => {
      const upload = buildEligibleUpload({ counters: nextCounters, trash: nextTrash, folders: candidate.folders || folders, preferences: candidate.preferences || preferences, superSettings: { ...superSettings, uiCustomizations: nextWorkspace, counterCustomizations: nextCustomizations }, scripts: nextScripts });
      return supabase.rpc("update_user_data_revision", { expected_revision: syncConflict.observedRevision || syncRevision.current, operation_id: crypto.randomUUID(), ...upload });
    }, workspaceWrites);
    if (result.state !== "acknowledged") { setSyncStatus(result.state === "unknown" ? statusLabel("Saving", !navigator.onLine) : statusLabel("Error")); return; }
    setCounters(nextCounters); setTrash(nextTrash); setFolders(validateFolders(candidate.folders || folders));
    if (candidate.preferences) setPreferences((current) => ({ ...current, ...candidate.preferences }));
    if (nextWorkspace) setSuperSettings((current) => ({ ...current, uiCustomizations: nextWorkspace, counterCustomizations: nextCustomizations }));
    if (nextScripts) setScripts(normalizeScriptRecords(nextScripts));
    setSyncConflict(null); setSingletonChoices({}); setSyncReady(true); setSyncStatus(statusLabel("Synchronized"));
  };
  const queueAndDeliverUpload = async (upload: ReturnType<typeof buildEligibleUpload>, baseRevision = syncRevision.current) => {
    if (!supabase || !session) return { state: "stale" as const };
    const generation = sessionGeneration.current;
    const operationId = crypto.randomUUID();
    const entry = stampJournalEntry({ operationId }, session.user.id, generation, baseRevision, workspaceDigest(upload), upload);
    try {
      appendJournal(localStorage, entry);
    } catch (error) {
      return { state: "error" as const, error };
    }
    const result = await deliverJournalEntry(entry, {
      accountId: session.user.id,
      generation,
      revision: baseRevision,
      rpc: async (args) => supabase.rpc("update_user_data_revision", args),
    });
    if (result.state === "acknowledged" && Number.isFinite(result.revision)) {
      syncRevision.current = Number(result.revision);
      acknowledgeJournal(localStorage, operationId, generation, baseRevision);
    }
    return result;
  };
  useEffect(() => {
    if (!supabase || !session || !syncReady) return;
    setSyncStatus(statusLabel("Saving"));
    const timer = setTimeout(async () => {
      const upload = buildEligibleUpload({ counters, trash, folders, preferences, superSettings, scripts });
      const result = await queueAndDeliverUpload(upload);
      if (result.state === "acknowledged" && Number.isFinite(result.revision)) {
        setSyncStatus(statusLabel("Synchronized"));
      } else if (result.state === "conflict") setSyncStatus(statusLabel("Conflict"));
      else if (result.state === "unknown") setSyncStatus(statusLabel("Saving", !navigator.onLine));
      else if (result.state === "error") setSyncStatus(statusLabel("Error", !navigator.onLine));
    }, 700);
    return () => clearTimeout(timer);
  }, [
    counters,
    folders,
    trash,
    preferences,
    superSettings,
    scripts,
    session?.user?.id,
    syncReady,
  ]);
  const setValue = (id, requested, kind = "direct value entry") => {
    const counter = counters.find((c) => c.id === id);
    if (!counter) return;
    const command = kind === "positive control" ? { type: "positive" as const } : kind === "negative control" ? { type: "negative" as const } : kind === "reset" ? { type: "reset" as const } : { type: "set" as const, value: requested };
    const result = applyCounterCommand(counter, command);
    if (result.status !== "accepted") return;
    setRedoStack((current) => current.filter((entry) => String(entry.id) !== String(id)));
    const transition = { ...result.transition, name: counter.name };
    if (kind !== "undo" && kind !== "redo") setUndoBranches((branches) => ({ ...branches, [String(id)]: { undo: [...(branches[String(id)]?.undo || []), transition], redo: [] } }));
    setHistory((log) => [...log, transition]);
    setSessionLedger((ledger) => [...ledger, transition]);
    setCounters((items) => items.map((c) => (c.id === id ? result.counter : c)));
  };
  const change = (id, amount) => {
    const counter = counters.find((c) => c.id === id);
    if (counter)
      setValue(
        id,
        counter.value + amount,
        amount > 0 ? "positive control" : "negative control",
      );
  };
  const patchCounter = (id, changes) =>
    setCounters((items) =>
      items.map((counter) =>
        counter.id === id ? sanitize({ ...counter, ...changes }) : counter,
      ),
    );
  const reset = (id) => {
    const counter = counters.find((c) => c.id === id);
    if (counter) setValue(id, counter.start, "reset");
  };
  const undoLatest = (counterId = null) => {
    const candidates = Object.entries(undoBranches as Record<string, AnyRecord>).flatMap(([id, branch]) => (branch.undo || []).map((entry) => ({ ...entry, id })));
    const entry = candidates.filter((item) => counters.some((counter) => String(counter.id) === String(item.id)) && (counterId == null || String(item.id) === String(counterId))).sort((a, b) => b.time - a.time)[0];
    if (!entry) return;
    const counter = counters.find((item) => String(item.id) === String(entry.id));
    if (!counter) return;
    const result = applyCounterCommand(counter, { type: "set", value: entry.from });
    if (result.status !== "accepted") return;
    result.transition.kind = "undo";
    setCounters((items) => items.map((item) => String(item.id) === String(entry.id) ? result.counter : item));
    setHistory((log) => [...log, { ...result.transition, name: counter.name, anchorEventId: entry.eventId }]);
    setSessionLedger((ledger) => [...ledger, { ...result.transition, name: counter.name, anchorEventId: entry.eventId }]);
    setUndoBranches((branches) => { const branch = branches[String(entry.id)] || { undo: [], redo: [] }; return { ...branches, [String(entry.id)]: { undo: branch.undo.filter((item) => item.eventId !== entry.eventId), redo: [...branch.redo, entry] } }; });
    setRedoStack((current) => [...current.filter((item) => String(item.id) !== String(entry.id)), entry]);
  };
  const redoLatest = (counterId = null) => {
    const candidates = Object.entries(undoBranches as Record<string, AnyRecord>).flatMap(([id, branch]) => (branch.redo || []).map((entry) => ({ ...entry, id })));
    const original = candidates.filter((item) => counterId == null || String(item.id) === String(counterId)).sort((a, b) => b.time - a.time)[0];
    if (!original) return;
    const counter = counters.find((item) => String(item.id) === String(original.id));
    if (!counter) return;
    const result = applyCounterCommand(counter, { type: "set", value: original.to });
    if (result.status !== "accepted") return;
    result.transition.kind = "redo";
    setCounters((items) => items.map((item) => String(item.id) === String(original.id) ? result.counter : item));
    setHistory((log) => [...log, { ...result.transition, name: counter.name, anchorEventId: original.eventId }]);
    setSessionLedger((ledger) => [...ledger, { ...result.transition, name: counter.name, anchorEventId: original.eventId }]);
    setUndoBranches((branches) => { const branch = branches[String(original.id)] || { undo: [], redo: [] }; return { ...branches, [String(original.id)]: { undo: [...branch.undo, original], redo: branch.redo.filter((item) => item.eventId !== original.eventId) } }; });
    setRedoStack((stack) => stack.filter((item) => item !== original));
  };
  const saveScript = (id, changes) =>
    setScripts((current) => ({
      ...current,
      [String(id)]: {
        language: "tallyscript",
        source: "",
        ...current[String(id)],
        ...validateScriptRecord({ language: changes.language || current[String(id)]?.language || "tallyscript", source: changes.source ?? (current[String(id)]?.source || "") }),
        ...changes,
        enabled: false,
      },
    }));
  const stopScript = (id, disable = true) => {
    const key = String(id);
    scriptExecutions.current.stop(key);
    setRunningScripts((current) => {
      const next = new Set(current);
      next.delete(key);
      return next;
    });
    if (disable) saveScript(id, { enabled: false });
  };
  const executeScript = (counter, source, language, inTrash = false) => {
    const key = String(counter.id);
    const customization = superSettings.counterCustomizations?.[key] || {};
    setScriptErrors((current) => ({ ...current, [key]: "" }));
    stopScript(key, false);
    const invocation = scriptExecutions.current.start(key);
    const controller = invocation.controller;
    setRunningScripts((current) => new Set(current).add(key));
    const onProposal = async (proposal) => {
      if (!scriptExecutions.current.isCurrent(invocation)) throw new Error("Stale script invocation.");
      const current = (inTrash ? trashRef.current : countersRef.current).find((item) => String(item.id) === key) || counter;
      const result = applyScriptProposal(current, { ...proposal, value: proposal.value ?? proposal.args?.[0] }, invocation.id, superSettingsRef.current.counterCustomizations?.[key] || {});
      if (result.status === "rejected") throw new Error(result.reason);
      if (result.status === "accepted") {
        if (inTrash) { trashRef.current = trashRef.current.map((item) => String(item.id) === key ? { ...result.counter, deletedAt: item.deletedAt } : item); setTrash(trashRef.current); }
        else { countersRef.current = countersRef.current.map((item) => String(item.id) === key ? result.counter : item); setCounters(countersRef.current); }
        if (result.customization) { superSettingsRef.current = { ...superSettingsRef.current, counterCustomizations: { ...superSettingsRef.current.counterCustomizations, [key]: result.customization } }; setSuperSettings(superSettingsRef.current); }
        if (result.transition) { setHistory((log) => [...log, result.transition]); setSessionLedger((log) => [...log, result.transition]); }
      }
      return { counter: result.counter, customization: result.customization || superSettingsRef.current.counterCustomizations?.[key] || {} };
    };
    const execution = language === "javascript"
      ? import("../features/scripting/javascript").then(({ runJavaScript }) =>
        runJavaScript(source, countersRef.current.find((item) => String(item.id) === key) || counter, superSettingsRef.current.counterCustomizations?.[key] || customization, {
          signal: controller.signal,
          onProposal,
          invocationId: invocation.id,
          counterId: counter.id,
          authority: inTrash ? "retained" : "personal",
        }))
        : runTallyScript(source, countersRef.current.find((item) => String(item.id) === key) || counter, superSettingsRef.current.counterCustomizations?.[key] || customization, {
          signal: controller.signal,
          onProposal,
          invocationId: invocation.id,
          counterId: counter.id,
          authority: inTrash ? "retained" : "personal",
        });
    void execution
      .catch((error) => {
        if (!controller.signal.aborted)
          setScriptErrors((current) => ({
            ...current,
            [key]:
              error instanceof Error
                ? error.message
                : "The script could not run.",
          }));
      })
      .finally(() => {
        if (!scriptExecutions.current.isCurrent(invocation)) return;
        scriptExecutions.current.stop(key);
        setRunningScripts((current) => {
          const next = new Set(current);
          next.delete(key);
          return next;
        });
        if (!controller.signal.aborted) saveScript(key, { enabled: false });
      });
    return { background: true };
  };

  useEffect(() => {
    setScripts((current) => {
      const stopped = Object.fromEntries(
        Object.entries(current).map(([key, script]) => [key, { ...script, enabled: false }]),
      );
      return stopped;
    });
  }, []);

  useEffect(
    () => () => {
      for (const key of scriptExecutions.current.active.keys()) scriptExecutions.current.stop(key);
    },
    [],
  );

  const prepareShutdown = () => {
      if (shutdownPrepared.current) return shutdownPrepared.current;
      const runningIds = new Set(
        [...scriptExecutions.current.active.keys()].map(String),
      );
      const stoppedScripts = Object.fromEntries(
        Object.entries(scripts).map(([id, script]) => [
          id,
          { ...script, enabled: false },
        ]),
      );
      for (const key of scriptExecutions.current.active.keys()) scriptExecutions.current.stop(key);
      const sharedStops = [...sharedShutdownCallbacks.current].map((callback) => Promise.resolve(callback()));
      setRunningScripts(new Set());
      setScripts(stoppedScripts);
      let localOk = true;
      try {
        const durable = commitStorageAtomically(shutdownStorage, {
          "tally-counters": JSON.stringify(counters), "tally-folders": JSON.stringify(folders),
          "tally-trash": JSON.stringify(trash), "tally-scripts": JSON.stringify(stoppedScripts),
          "tally-super": JSON.stringify(superSettings), "tally-preferences": JSON.stringify(preferences),
        });
        if (!durable.ok) throw new Error("Stopped scripts could not be saved locally.");
      } catch { localOk = false; setSyncStatus("Stopped scripts saved with local errors"); }

      const upload = buildEligibleUpload({ counters, trash, folders, preferences, superSettings, scripts: stoppedScripts });
      const entry: AnyRecord = stampJournalEntry({
        operationId: shutdownOperationId.current || (shutdownOperationId.current = crypto.randomUUID()), scope: "shutdown", digest: workspaceDigest({ counters, trash, folders, preferences, superSettings, scripts: stoppedScripts }),
      }, session?.user?.id || null, sessionGeneration.current, syncRevision.current, workspaceDigest({ counters, trash, folders, preferences, superSettings, scripts: stoppedScripts }), upload);
      if (localOk && session?.user?.id) appendEligibleSyncJournal(shutdownStorage, entry);
      const prepared = { entry, localOk, sharedStops };
      if (localOk) { shutdownPrepared.current = prepared; unloadFlushStarted.current = true; }
      return prepared;
    };
  const controlledShutdown = async (target: string) => {
    const prepared = prepareShutdown();
    if (!prepared?.localOk) { setShutdown({ target, ...prepared, error: "Stopped scripts could not be saved locally." }); return; }
    setShutdown({ target, ...prepared, delivering: true });
    try { await Promise.race([Promise.allSettled(prepared.sharedStops || []), new Promise((_, reject) => setTimeout(() => reject(new Error("Shared scripts are still stopping.")), shutdownTimeoutMs))]); }
    catch { setShutdown({ target, ...prepared, delivering: false, error: "Shared scripts could not be stopped. Try again or continue with local recovery preserved." }); return; }
    if (!session?.user?.id) { navigateTo(target); return; }
    const result = await Promise.race([
      deliverJournalEntry(prepared.entry, { accountId: session.user.id, generation: sessionGeneration.current, revision: prepared.entry.baseRevision, rpc: async (args) => supabase.rpc("update_user_data_revision", args) }),
      new Promise<any>((resolve) => setTimeout(() => resolve({ state: "timeout" }), shutdownTimeoutMs)),
    ]);
    if (result.state === "acknowledged") {
      syncRevision.current = Number(result.revision ?? syncRevision.current);
      acknowledgeJournal(shutdownStorage, prepared.entry.operationId, sessionGeneration.current, prepared.entry.baseRevision);
      navigateTo(target);
    } else {
      if (result.state !== "timeout") shutdownPrepared.current = prepared;
      setShutdown({ target, ...prepared, delivering: false, error: result.state === "timeout" ? "Saving timed out." : "Saving failed. Try again or continue with local recovery preserved." });
    }
  };
  const retryShutdown = () => { if (shutdown?.target) void controlledShutdown(shutdown.target); };
  useEffect(() => {
    const stopAndFlush = () => { prepareShutdown(); };

    const register = (event: Event) => {
      const detail = (event as CustomEvent<any>).detail;
      if (detail?.type === "unregister") sharedShutdownCallbacks.current.delete(detail.callback);
      else if (typeof detail?.callback === "function") sharedShutdownCallbacks.current.add(detail.callback);
    };
    const beforeUnload = () => stopAndFlush();
    const pageHide = () => stopAndFlush();
    window.addEventListener("tally-register-shutdown", register);
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", pageHide);
      window.removeEventListener("tally-register-shutdown", register);
    };
  }, [
    counters, folders, preferences, runningScripts, scripts, session, superSettings, trash,
  ]);
  const importBackup = (data: AnyRecord, scopeOrOptions, maybeOptions: AnyRecord = {}) => {
    const scope = typeof scopeOrOptions === "string" ? data.scope : data.scope;
    const options = typeof scopeOrOptions === "string" ? maybeOptions : scopeOrOptions || {};
    const importSession = (data.candidate ? data : prepareImport(data, scope, workspaceDigest({ counters, trash, folders, preferences, superSettings, scripts }))) as any;
    const plan = createImportPlan({ counters, trash, folders, preferences, superSettings, scripts, revision: workspaceDigest({ counters, trash, folders, preferences, superSettings, scripts }) }, importSession, options);
    for (const id of plan.affectedInvocationIds) if (runningScripts.has(id)) stopScript(id);
    const durable = commitImportPlan(localStorage, plan);
    if (!durable.ok) throw new Error("Backup could not be saved; your current workspace was retained.");
    const next = plan.state;
    try {
      const upload = buildEligibleUpload({
        counters: next.counters,
        trash: next.trash,
        folders: next.folders,
        preferences: next.preferences,
        superSettings: next.superSettings,
        scripts: next.scripts,
      });
      appendEligibleSyncJournal(localStorage, stampJournalEntry({ operationId: crypto.randomUUID(), scope, digest: workspaceDigest(upload) }, session?.user?.id || null, sessionGeneration.current, syncRevision.current, workspaceDigest(upload), upload));
    } catch { setSyncStatus(statusLabel("Error")); }
    setCounters(next.counters); setFolders(validateFolders(next.folders)); setTrash(next.trash); setScripts(next.scripts); setSuperSettings(next.superSettings); setPreferences(next.preferences);
    return true;
  };
  const save = async (draft) => {
    const existing = (editingTrash ? trash : counters).find((counter) => String(counter.id) === String(draft.id));
    const clean = sanitize(draft);
    const limitResult = existing && (String(existing.min) !== String(draft.min) || String(existing.max) !== String(draft.max))
      ? applyLimitEdit(existing, draft.min, draft.max)
      : null;
    if (limitResult?.status === "rejected") return;
    if (!editingTrash && existing && existing.localOnly !== clean.localOnly && session && supabase) {
      const operationId = crypto.randomUUID();
      const intent = guardedRawWrite(localStorage, "tally-local-conversion-intent", JSON.stringify({ operationId, id: clean.id, targetLocal: Boolean(clean.localOnly), createdAt: new Date().toISOString() }), readRaw(localStorage, "tally-local-conversion-intent"));
      if (!intent.ok) throw new Error("Conversion intent could not be recorded; nothing was submitted.");
      setSyncStatus("Confirming Local conversion…");
      const nextCounters = clean.localOnly
        ? counters.filter((item) => String(item.id) !== String(clean.id))
        : [...counters.filter((item) => String(item.id) !== String(clean.id)), { ...clean, localOnly: false }];
      const nextScripts = clean.localOnly
        ? Object.fromEntries(Object.entries(scripts).filter(([id]) => id !== String(clean.id)))
        : scripts;
      const { error, data: nextRevision } = await supabase.rpc("update_user_data_revision", {
        expected_revision: syncRevision.current,
        operation_id: operationId,
        ...buildEligibleUpload({ counters: nextCounters, trash, folders, preferences, superSettings, scripts: nextScripts }),
      });
      if (error) { setSyncStatus("Local conversion pending — retry available"); return; }
      if (nextRevision != null) syncRevision.current = Number(nextRevision);
      guardedRemove(localStorage, "tally-local-conversion-intent", readRaw(localStorage, "tally-local-conversion-intent"));
      setSyncStatus("Synced");
    }
    if (editingTrash) {
      setTrash((items) =>
        items.map((counter) =>
          counter.id === clean.id
            ? { ...clean, deletedAt: counter.deletedAt }
            : counter,
        ),
      );
      if (limitResult?.status === "accepted") setHistory((log) => appendActivityEntry(log, { ...limitResult.transition, name: clean.name, retained: true }));
    } else {
      const previous = counters.find((counter) => String(counter.id) === String(clean.id));
      if (previous && previous.value !== clean.value) {
        const transition = {
          eventId: crypto.randomUUID(),
          id: clean.id,
          name: clean.name,
          from: previous.value,
          to: clean.value,
          kind: "direct value entry",
          time: Date.now(),
        };
        setRedoStack((stack) => stack.filter((entry) => String(entry.id) !== String(clean.id)));
        setHistory((log) => appendActivityEntry(log, transition));
        setSessionLedger((ledger) => [...ledger, transition]);
      }
      if (limitResult?.status === "accepted") {
        setHistory((log) => appendActivityEntry(log, { ...limitResult.transition, name: clean.name }));
        setSessionLedger((ledger) => [...ledger, { ...limitResult.transition, name: clean.name }]);
      }
      setCounters((items) =>
        items.some((c) => c.id === clean.id)
          ? items.map((c) => (c.id === clean.id ? clean : c))
          : [...items, clean],
      );
    }
    setEditing(null);
    setEditingTrash(false);
  };
  const edit = (counter, inTrash = false) => {
    setEditingTrash(inTrash);
    setEditing({
      ...counter,
      goals: getGoals(counter),
      goalDirection:
        counter.goalDirection ||
        (counter.goal < counter.start ? "less" : "more"),
    });
  };
  const create = () => {
    setEditingTrash(false);
    setEditing({
      id: Date.now(),
      name: "",
      value: 0,
      start: 0,
      plusStep: 1,
      minusStep: 1,
      goals: [],
      goalDirection: "more",
      min: "",
      max: "",
      color: preferences.defaultColor,
      localOnly: false,
      folderId: currentFolder,
      tags: [],
    });
  };
  const removeCounter = (counter) => {
    // Invalidate queued callbacks before moving or removing the bundle.
    stopScript(counter.id);
    if (!preferences.trashEnabled) {
      setPendingPermanentDelete(counter);
      return;
    }
    setCounters((items) => items.filter((item) => item.id !== counter.id));
    setTrash((items) => [
      enterTrash({ ...counter, script: scripts[String(counter.id)], customization: superSettings.counterCustomizations?.[String(counter.id)] }),
      ...items.filter((item) => item.id !== counter.id),
    ]);
    setScripts((current) => Object.fromEntries(Object.entries(current).filter(([id]) => String(id) !== String(counter.id))));
    setSuperSettings((current) => ({ ...current, counterCustomizations: Object.fromEntries(Object.entries(current.counterCustomizations || {}).filter(([id]) => String(id) !== String(counter.id))) }));
  };
  const restoreCounter = (counter) => {
    stopScript(counter.id);
    const { counter: restored } = restoreBundle(counters, counter);
    const oldId = String(counter.id), newId = String(restored.id);
    const linkedScript = counter.script || scripts[oldId];
    const linkedCustomization = counter.customization || superSettings.counterCustomizations?.[oldId];
    const restoredCore = { ...restored };
    delete restoredCore.script;
    delete restoredCore.customization;
    setTrash((items) => items.filter((item) => String(item.id) !== oldId));
    setCounters((items) => [
      ...items,
      restoredCore,
    ]);
    setScripts((current) => {
      const next = { ...current };
      delete next[oldId];
      if (linkedScript) next[newId] = { ...linkedScript, enabled: false };
      return next;
    });
    setSuperSettings((current) => {
      const next = { ...current, counterCustomizations: { ...(current.counterCustomizations || {}) } };
      delete next.counterCustomizations[oldId];
      if (linkedCustomization) next.counterCustomizations[newId] = linkedCustomization;
      return next;
    });
  };
  const permanentlyDeleteTrashCounters = (deletedCounters) => {
    const ids = new Set<string>(deletedCounters.map((counter) => String(counter.id)));
    deletedCounters.forEach((counter) => stopScript(counter.id));
    setTrash((items) => permanentDelete(items, ids));
    setScripts((current) => Object.fromEntries(
      Object.entries(current).filter(([id]) => !ids.has(String(id))),
    ));
    setSuperSettings((current) => ({
      ...current,
      counterCustomizations: Object.fromEntries(
        Object.entries(current.counterCustomizations || {}).filter(([id]) => !ids.has(String(id))),
      ),
    }));
  };
  const acceptCounterCopy = async (share, choices) => {
    if (typeof share.id !== "string" || !/^[1-9][0-9]*$/.test(share.id)) throw new Error("The copy request identity is malformed.");
    const stored = readCopyAcceptanceJournal(localStorage, share.id);
    const selected = stored ? { localOnly: stored.localOnly, includeScript: stored.includeScript, includeCustomization: stored.includeCustomization } : choices;
    const operationId = stored?.operationId || crypto.randomUUID();
    const journal = stored || { version: 1 as const, requestId: share.id, operationId, destinationId: "", localOnly: selected.localOnly, includeScript: selected.includeScript, includeCustomization: selected.includeCustomization, stage: "claimed" as const };
    writeCopyAcceptanceJournal(localStorage, journal);
    const result = await copySharing.claimCounter(
      share.id,
      operationId,
      selected.includeScript,
      selected.includeCustomization,
      selected.localOnly,
    );
    if (!result || result.id !== share.id || result.operationId !== operationId) throw new Error("The copy acceptance response did not match this request.");
    const destinationId = result?.destinationId || stored?.destinationId;
    if (!destinationId) throw new Error("The copy acceptance did not return a destination.");
    if (!selected.localOnly && result.state === "Accepted") {
      const refreshed = await authoritativeCopyRefresh.current?.();
      if (!refreshed) throw new Error("The accepted copy could not be reconciled yet. Retry when online.");
      await copySharing.reloadShares();
      clearCopyAcceptanceJournal(localStorage);
      return;
    }
    if (selected.localOnly && result.state === "Accepted") {
      const existing = hydrateBundleState(localStorage, { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {} });
      if (!existing.active.some((item) => String(item.id) === destinationId)) throw new Error("The accepted local copy is missing from this device.");
      clearCopyAcceptanceJournal(localStorage);
      return;
    }
    if (result.state !== "Pending" || result.mode !== "local") throw new Error("The copy acceptance response is not a recoverable Local delivery.");
    const copyBundle = buildLocalCopyBundle(result, { ...journal, destinationId });
    const latestBundle = hydrateBundleState(localStorage, { active: counters, retained: trash, scripts, customizations: superSettings.counterCustomizations || {} });
    const nextBundle = commitLocalCopyAtomically(localStorage, latestBundle, copyBundle, { ...journal, destinationId });
    setCounters(nextBundle.active); setScripts(nextBundle.scripts); setSuperSettings((current) => ({ ...current, counterCustomizations: nextBundle.customizations }));
    await copySharing.finalizeLocalCounter(share.id, operationId, destinationId, result.deliveryToken);
    clearCopyAcceptanceJournal(localStorage);
  };
  const denyCounterCopy = (share) => copySharing.declineCounter(share.id);
  useEffect(() => {
    if (!session?.user?.id) return;
    const recover = () => {
      const journal = readCopyAcceptanceJournal(localStorage);
      if (!journal) return;
      void acceptCounterCopy({ id: journal.requestId }, { localOnly: journal.localOnly, includeScript: journal.includeScript, includeCustomization: journal.includeCustomization }).catch(() => setSyncStatus(statusLabel("Error", !navigator.onLine)));
    };
    const timer = window.setTimeout(recover, 250);
    window.addEventListener("online", recover);
    window.addEventListener("focus", recover);
    return () => { window.clearTimeout(timer); window.removeEventListener("online", recover); window.removeEventListener("focus", recover); };
  }, [session?.user?.id, copySharing.incoming]);
  const changeTrash = (id, amount) => {
    const counter = trash.find((item) => item.id === id);
    if (!counter) return;
    const result = applyCounterCommand(counter, amount > 0 ? { type: "positive" } : { type: "negative" });
    if (result.status !== "accepted") return;
    setTrash((items) => items.map((item) => item.id === id ? { ...result.counter, deletedAt: item.deletedAt } : item));
    const transition = { ...result.transition, name: counter.name, retained: true };
    setHistory((log) => appendActivityEntry(log, transition));
    setSessionLedger((ledger) => [...ledger, transition]);
  };
  const removeSuperItem = (id) =>
    setSuperSettings((current) => ({
      ...current,
      uiCustomizations: {
        ...current.uiCustomizations,
        items: (current.uiCustomizations.items || []).filter(
          (item) => item.id !== id,
        ),
      },
    }));
  const updateSuperItem = (id, changes) =>
    setSuperSettings((current) => ({
      ...current,
      uiCustomizations: {
        ...current.uiCustomizations,
        items: (current.uiCustomizations.items || []).map((item) =>
          item.id === id ? { ...item, ...changes } : item,
        ),
      },
    }));

  const tags: string[] = [...new Set<string>(counters.flatMap((counter) => normalizeTags(counter.tags)))].sort();
  const normalizedSearch = counterSearch.trim().toLowerCase();
  const filteringCounters = Boolean(normalizedSearch || tagFilter !== "all");
  const currentFolderPath = folderPath(currentFolder, folders);
  const descendants = (id: string | null) => {
    if (!id) return new Set<string>(folders.filter((folder) => !folder.parentId).map((folder) => folder.id));
    const result = new Set([id]); let changed = true;
    while (changed) { changed = false; for (const folder of folders) if (folder.parentId && result.has(folder.parentId) && !result.has(folder.id)) { result.add(folder.id); changed = true; } }
    return result;
  };
  const inCurrentTree = (folderId: string | null) => !currentFolder || descendants(currentFolder).has(String(folderId));
  const visibleCounters = counters.filter((counter) => {
    const searchable = [counter.name, folderPath(counter.folderId || null, folders), ...normalizeTags(counter.tags)].join(" ").toLowerCase();
    return (!normalizedSearch || searchable.includes(normalizedSearch)) &&
      inCurrentTree(counter.folderId || null) &&
      (tagFilter === "all" || normalizeTags(counter.tags).some((tag) => tag.toLowerCase() === tagFilter.toLowerCase()));
  });
  const displayedCounters = filteringCounters
    ? visibleCounters
    : visibleCounters.filter((counter) => (counter.folderId || null) === currentFolder);
  const childFolders = filteringCounters ? [] : folders.filter((folder) => folder.parentId === currentFolder);
  const folderSegments = currentFolderPath.split("/").filter(Boolean);
  const moveCounterToFolder = (id, folderId: string | null) => {
    setCounters((items) => items.map((counter) =>
      String(counter.id) === String(id) ? sanitize({ ...counter, folderId }) : counter,
    ));
    setDraggedCounterId(null);
  };
  const moveFolderToFolder = (source: string, destination: string | null) => {
    if (!source || source === destination || descendants(source).has(destination || "")) return;
    const candidate = folders.map((folder) => folder.id === source ? { ...folder, parentId: destination } : folder);
    try { setFolders(validateFolders(candidate)); } catch (error) { setOrganizationNotice(error instanceof Error ? error.message : "Folder move failed."); return; }
    setDraggedFolder("");
  };
  const acceptFolderDrop = (event, folder) => {
    event.preventDefault();
    const sourceFolder = draggedFolder || event.dataTransfer.getData("text/tally-folder");
    if (sourceFolder) {
      moveFolderToFolder(sourceFolder, folder);
      return;
    }
    const id = draggedCounterId ?? event.dataTransfer.getData("text/tally-counter-id");
    if (id !== "" && id != null) moveCounterToFolder(id, folder);
  };
  const createFolder = () => {
    const name = newFolderName.trim();
    if (!name || name.includes("/")) return;
    try { setFolders((current) => validateFolders([...current, { id: crypto.randomUUID(), name, parentId: currentFolder }])); }
    catch (error) { setOrganizationNotice(error instanceof Error ? error.message : "Folder creation failed."); return; }
    setNewFolderName("");
    setNewFolderOpen(false);
  };
  const renameFolder = () => {
    if (!renamingFolder) return;
    const name = newFolderName.trim();
    if (!name || name.includes("/")) return;
    try {
      setFolders((current) => validateFolders(current.map((folder) => folder.id === renamingFolder ? { ...folder, name } : folder)));
      setNewFolderName(""); setRenamingFolder(null); setNewFolderOpen(false);
    } catch (error) { setOrganizationNotice(error instanceof Error ? error.message : "Folder rename failed."); }
  };
  const deleteLocalFolder = (folder: string) => {
    try {
      const result = deleteFolder(folders, counters, folder);
      setFolders(result.folders); setCounters(result.counters);
      if (currentFolder === folder) setCurrentFolder(null);
    } catch (error) { setOrganizationNotice(error instanceof Error ? error.message : "Folder deletion failed."); }
  };
  const renderCounter = (counter) => <CounterCard
    key={counter.id}
    counter={counter}
    index={Math.max(0, counters.findIndex((item) => String(item.id) === String(counter.id)))}
    showBounds={preferences.showBounds}
    showLocalBanner={Boolean(session)}
    customization={superSettings.counterCustomizations?.[String(counter.id)]}
    onPatch={patchCounter}
    onChange={change}
    onEdit={() => edit(counter)}
    onEmbed={() => setEmbedding(counter)}
    onShare={session ? () => setSharingCounter(counter) : null}
    onDelete={() => removeCounter(counter)}
    onReset={() => reset(counter.id)}
    onDragStart={(event) => {
      setDraggedCounterId(counter.id);
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/tally-counter-id", String(counter.id));
    }}
    tabIndex={0}
    onKeyDown={(event) => {
      if (event.key === "ArrowLeft" || event.key === "ArrowUp") { event.preventDefault(); moveCounterToFolder(counter.id, folders.find((folder) => folder.id === currentFolder)?.parentId || null); }
      if (event.key === "ArrowRight" || event.key === "ArrowDown") { event.preventDefault(); const first = folders.find((folder) => folder.parentId === (counter.folderId || null)); if (first) moveCounterToFolder(counter.id, first.id); }
    }}
  />;
  const sessionHistory = history.filter((entry) => entry.time >= sessionStartedAt.current);

  return (
    <div
      className={`app-shell density-${preferences.density} numbers-${preferences.numberSize} ${preferences.animations ? "" : "no-animations"} ${superEditorOpen ? "super-editing" : ""}`}
      data-theme={theme}
    >
      <header data-super-zone="top">
        <a className="brand" href={import.meta.env.BASE_URL} onClick={(event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
          event.preventDefault(); void controlledShutdown(import.meta.env.BASE_URL);
        }}>
          <span className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </span>
          TALLY
        </a>
        {shutdown && <div className="modal-backdrop" role="dialog" aria-modal="true"><div className="modal"><h2>Stopping scripts and saving</h2>{shutdown.delivering ? <p>Saving stopped scripts…</p> : <p>{shutdown.error}</p>}<div className="modal-footer"><button type="button" onClick={retryShutdown} disabled={shutdown.delivering}>Retry</button><button type="button" className="save" disabled={!shutdown.localOk || shutdown.delivering} onClick={() => shutdown.localOk && navigateTo(shutdown.target)}>Continue</button></div></div></div>}
        <SuperZoneContent
          zone="top"
          items={superSettings.uiCustomizations.items}
          counters={counters}
          history={sessionHistory}
          onRemove={superEditorOpen ? removeSuperItem : null}
          onUpdate={superEditorOpen ? updateSuperItem : null}
        />
        <div className="header-actions">
          <button
            className={`account-button ${session ? "signed-in" : ""}`}
            onClick={() => setAuthOpen(true)}
            title={session?.user?.email || "Sign in"}
          >
            {session ? <Cloud /> : <User />}
            <span>{session ? syncStatus : "Sign in"}</span>
          </button>
          <button className="header-tool" onClick={() => setMenu("trash")}>
            <Trash2 />{" "}
            <span>Trash{trash.length ? ` (${trash.length})` : ""}</span>
          </button>
          <button className="header-tool" onClick={() => setMenu("stats")}>
            <BarChart3 /> <span>Stats</span>
          </button>
          {workspaceTab === "mine" && <>
            <button className="header-tool" onClick={() => {
              setHistoryCounterId(String(counters[0]?.id || ""));
              setMenu("history");
            }}>
              <HistoryIcon /> <span>History</span>
            </button>
            <button className="header-tool undo-tool" disabled={!history.length} onClick={() => undoLatest()} title="Undo latest value change">
              <Undo2 /> <span>Undo</span>
            </button>
            <button className="header-tool redo-tool" disabled={!redoStack.length} onClick={() => redoLatest()} title="Redo latest undone change">
              <Redo2 /> <span>Redo</span>
            </button>
          </>}
          <button className="header-tool" onClick={() => setMenu("settings")}>
            <Settings2 /> <span>Settings</span>
          </button>
          <button
            className="theme-toggle"
            onClick={() =>
              onThemeChange((current) =>
                current === "light" ? "dark" : "light",
              )
            }
            aria-label={`Use ${theme === "light" ? "dark" : "light"} mode`}
          >
            {theme === "light" ? <Moon /> : <Sun />}
          </button>
          <button className="add-top" onClick={create}>
            <Plus size={18} /> New counter
          </button>
        </div>
      </header>
      {authNotice && (
        <div className="session-notice" role="alert">
          <div>
            <strong>Account access ended</strong>
            <span>{authNotice}</span>
          </div>
          <button
            onClick={() => setAuthNotice("")}
            aria-label="Dismiss message"
          >
            <X />
          </button>
        </div>
      )}

      <main data-super-zone="workspace">
        <SuperZoneContent
          zone="workspace"
          items={superSettings.uiCustomizations.items}
          counters={counters}
          history={sessionHistory}
          onRemove={superEditorOpen ? removeSuperItem : null}
          onUpdate={superEditorOpen ? updateSuperItem : null}
        />
        <section className="workspace-heading">
          <div>
            <span className="eyebrow">
              <Hash /> YOUR WORKSPACE
            </span>
            <h1>My counters</h1>
          </div>
          <div className="summary">
            <div>
              <strong>{counters.length}</strong>
              <span>active counters</span>
            </div>
            <i></i>
            <div>
              <strong>{counters.filter(isComplete).length}</strong>
              <span>goals complete</span>
            </div>
          </div>
        </section>

        <section className="counter-section">
          <div className="section-heading">
            <div>
              <nav className="counter-workspace-tabs">
                <button
                  className={workspaceTab === "mine" ? "active" : ""}
                  onClick={() => setWorkspaceTab("mine")}
                >
                  MY COUNTERS
                </button>
                {session && <button
                  className={workspaceTab === "shared" ? "active" : ""}
                  onClick={() => setWorkspaceTab("shared")}
                >
                  SHARED COUNTERS
                </button>}
              </nav>
              <h2>
                {workspaceTab === "mine" ? "Today’s tallies" : "Group counters"}
              </h2>
            </div>
            {workspaceTab === "mine" && <button
              className="round-add"
              onClick={create}
              aria-label="Add counter"
            >
              <Plus />
            </button>}
          </div>
          {workspaceTab === "mine" && <div className="counter-organizer-bar">
            <label className="counter-search"><Search /><input value={counterSearch} onChange={(event) => setCounterSearch(event.target.value)} placeholder="Search counters, folders, or tags" aria-label="Search counters" /></label>
            <label><Tags /><select value={tagFilter} onChange={(event) => setTagFilter(event.target.value)} aria-label="Filter by tag"><option value="all">All tags</option>{tags.map((tag) => <option key={tag} value={tag}>{tag}</option>)}</select></label>
            <button type="button" onClick={() => setNewFolderOpen(true)}><FolderPlus /> New folder</button>
            {(counterSearch || tagFilter !== "all") && <button type="button" onClick={() => { setCounterSearch(""); setTagFilter("all"); }}><X /> Clear</button>}
          </div>}
          {organizationNotice && <div className="organization-status" role="status" onClick={() => setOrganizationNotice("")}>{organizationNotice}</div>}
          {workspaceTab === "shared" ? (
            <SharedCountersView groups={sharedGroups} />
          ) : <div className="counter-folders">
            <nav className="folder-breadcrumbs" aria-label="Folder path">
              <button type="button" className={!currentFolder ? "active" : ""} onClick={() => setCurrentFolder(null)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, null)}><Folder /> My counters</button>
              {folderSegments.map((segment, index) => {
                const path = folders.filter((folder) => folderSegments.slice(0, index + 1).join("/") === folderPath(folder.id, folders)).at(-1)?.id || null;
                return <span key={path || segment}><ChevronRight /><button type="button" className={path === currentFolder ? "active" : ""} onClick={() => setCurrentFolder(path)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, path)}>{segment}</button></span>;
              })}
            </nav>
            {childFolders.length > 0 && <div className="folder-grid">
              {childFolders.map((folder) => {
                const count = counters.filter((counter) => descendants(folder.id).has(counter.folderId)).length;
                const name = folder.name;
                return <div role="button" tabIndex={0} draggable className="folder-tile" key={folder.id} onClick={() => setCurrentFolder(folder.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); setCurrentFolder(folder.id); } if (event.key.toLowerCase() === "r") { event.preventDefault(); setRenamingFolder(folder.id); setNewFolderName(folder.name); setNewFolderOpen(true); } if (event.key === "Delete" || event.key === "Backspace") { event.preventDefault(); deleteLocalFolder(folder.id); } }} onDragStart={(event) => { setDraggedFolder(folder.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/tally-folder", folder.id); }} onDragEnd={() => setDraggedFolder("")} onDragOver={(event) => { const source = draggedFolder || event.dataTransfer.getData("text/tally-folder"); if (!source || (source !== folder.id && !descendants(source).has(folder.id))) { event.preventDefault(); event.currentTarget.classList.add("drag-over"); } }} onDragLeave={(event) => event.currentTarget.classList.remove("drag-over")} onDrop={(event) => { event.currentTarget.classList.remove("drag-over"); acceptFolderDrop(event, folder.id); }}><span><Folder /></span><b>{name}</b><small>{count} {count === 1 ? "counter" : "counters"}</small><button type="button" className="folder-rename" aria-label={`Rename folder ${name}`} onClick={(event) => { event.stopPropagation(); setRenamingFolder(folder.id); setNewFolderName(folder.name); setNewFolderOpen(true); }}>Rename</button><button type="button" className="folder-delete" aria-label={`Delete folder ${name}`} onClick={(event) => { event.stopPropagation(); if (confirm(`Delete “${name}” and its nested folders? Counters inside will move to ${currentFolder ? "this folder" : "My counters"}.`)) deleteLocalFolder(folder.id); }}><Trash2 /></button></div>;
              })}
            </div>}
            {!displayedCounters.length && !childFolders.length && counters.length > 0 && <div className="counter-filter-empty"><Search /><b>{filteringCounters ? "No counters found" : "This folder is empty"}</b><span>{filteringCounters ? "Try another search or tag." : "Drag a counter here or create one in this folder."}</span></div>}
            <div className={`grid columns-${preferences.columns}`}>
              {displayedCounters.map(renderCounter)}
              <button className="new-card" onClick={create}>
              <span><Plus /></span><strong>Add another counter</strong><small>Start tracking something new</small>
              </button>
            </div>
          </div>}
        </section>
      </main>
      <footer data-super-zone="bottom">
        <span>Built for the little things that add up.</span>
        <SuperZoneContent
          zone="bottom"
          items={superSettings.uiCustomizations.items}
          counters={counters}
          history={sessionHistory}
          onRemove={superEditorOpen ? removeSuperItem : null}
          onUpdate={superEditorOpen ? updateSuperItem : null}
        />
        <div>
          <span>
            {session
              ? "Saved on this device and synced to the cloud"
              : "Saved automatically on this device"}
          </span>
          <a
            href="https://github.com/supersnug/tally-counter"
            target="_blank"
            rel="noreferrer"
          >
            View on GitHub
          </a>
        </div>
      </footer>
      {editing && (
        <Editor
          draft={editing}
          setDraft={setEditing}
          isNew={
            !editingTrash &&
            !counters.some((counter) => counter.id === editing.id)
          }
          showLocalOption={
            Boolean(session) && (!editingTrash || preferences.syncTrash)
          }
          folderOptions={folders}
          superCustomization={
            superSettings.counterCustomizations?.[String(editing.id)]
          }
          script={
            scripts[String(editing.id)] || {
              language: "tallyscript",
              source: "",
            }
          }
          onScriptChange={(changes) => saveScript(editing.id, changes)}
          onRunScript={(source, language) =>
            executeScript(editing, source, language, editingTrash)
          }
          scriptRunning={runningScripts.has(String(editing.id))}
          scriptError={scriptErrors[String(editing.id)] || ""}
          onStopScript={() => stopScript(editing.id)}
          onSuperCustomization={(customization) =>
            setSuperSettings((current) => ({
              ...current,
              counterCustomizations: {
                ...current.counterCustomizations,
                [String(editing.id)]: customization,
              },
            }))
          }
          onClose={() => {
            setEditing(null);
            setEditingTrash(false);
          }}
          onSave={save}
        />
      )}
      {embedding && (
        <EmbedBuilder counter={embedding} onClose={() => setEmbedding(null)} />
      )}
      {sharingCounter && (
        <ShareCounterModal
          counter={sharingCounter}
          script={
            scripts[String(sharingCounter.id)]?.source?.trim()
              ? scripts[String(sharingCounter.id)]
              : null
          }
          customization={
            Object.keys(
              superSettings.counterCustomizations?.[
                String(sharingCounter.id)
              ] || {},
            ).length
              ? superSettings.counterCustomizations[String(sharingCounter.id)]
              : null
          }
          pinRequired={copySharing.settings.copySharingPinEnabled}
          onSend={copySharing.sendCounter}
          onClose={() => setSharingCounter(null)}
        />
      )}
      {menu === "settings" && (
        <AppSettings
          counters={counters}
          history={sessionHistory}
          theme={theme}
          preferences={preferences}
          superSettings={superSettings}
          scripts={scripts}
          trash={trash}
          folders={folders}
          destinationRevision={workspaceDigest({ counters, trash, folders, preferences, superSettings, scripts })}
          onStartSuperEditor={() => {
            setMenu(null);
            setSuperEditorOpen(true);
          }}
          onSuperSettings={setSuperSettings}
          onPreferences={setPreferences}
          onImport={importBackup}
          onThemeChange={onThemeChange}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === "trash" && (
        <TrashModal
          items={trash}
          showBounds={preferences.showBounds}
          showLocalBanner={Boolean(session) && preferences.syncTrash}
          onChange={changeTrash}
          onEdit={(counter) => {
            setMenu(null);
            edit(counter, true);
          }}
          onEmbed={setEmbedding}
          onRestore={restoreCounter}
          onDelete={(counter) => permanentlyDeleteTrashCounters([counter])}
          onDeleteAll={() => permanentlyDeleteTrashCounters(trash)}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === "stats" && (
        <StatsModal
          history={sessionLedger}
          counters={counters}
          superItems={superSettings.uiCustomizations.items}
          resets={statResets}
          onResetStat={(key) => setStatResets((r) => ({ ...r, [key]: buildStatisticResetBaseline(key, counters) }))}
          onResetAll={() => {
            const now = Date.now();
            setStatResets({ actions: now, net: now, distance: now, active: now, activeCounters: buildStatisticResetBaseline("activeCounters", counters, now), increments: now, decrements: now, resets: now, completedGoals: buildStatisticResetBaseline("completedGoals", counters, now) });
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {menu === "history" && (
        <HistoryModal
          counters={counters}
          history={history}
          redoStack={redoStack}
          selectedId={historyCounterId}
          onSelectedId={setHistoryCounterId}
          onUndo={undoLatest}
          onRedo={redoLatest}
          onClear={(selectedId) => {
            if (!selectedId || !window.confirm("Delete this counter's local history?")) return;
            setHistory((log) => log.filter((entry) => String(entry.id) !== String(selectedId)));
            setRedoStack((stack) => stack.filter((entry) => String(entry.id) !== String(selectedId)));
            setUndoBranches((branches) => { const next = { ...branches }; delete next[String(selectedId)]; return next; });
          }}
          quarantineCount={historyQuarantine.length}
          persistenceStatus={activityPersistenceStatus}
          onDeleteQuarantine={() => setHistoryQuarantine([])}
          onExportQuarantine={() => {
            const blob = new Blob([JSON.stringify(historyQuarantine, null, 2)], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = "tally-activity-quarantine.json";
            link.click();
            URL.revokeObjectURL(url);
          }}
          onClose={() => setMenu(null)}
        />
      )}
      {newFolderOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewFolderOpen(false)}>
          <form className="modal folder-create-modal" onSubmit={(event) => { event.preventDefault(); renamingFolder ? renameFolder() : createFolder(); }}>
            <div className="modal-head"><div><span>{renamingFolder ? "RENAME FOLDER" : "NEW FOLDER"}</span><h2>{renamingFolder ? "Rename folder" : "Create a folder"}</h2></div><button type="button" onClick={() => { setNewFolderOpen(false); setRenamingFolder(null); }}><X /></button></div>
            <p>{currentFolder ? <>This folder will be created inside <b>{currentFolderPath}</b>.</> : "This folder will be created in My counters."}</p>
            <label>Folder name<input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="e.g. Fitness" /></label>
            <div className="modal-footer"><button className="cancel" type="button" onClick={() => { setNewFolderOpen(false); setRenamingFolder(null); }}>Cancel</button><button className="save" type="submit" disabled={!newFolderName.trim() || newFolderName.includes("/")}><FolderPlus /> {renamingFolder ? "Rename folder" : "Create folder"}</button></div>
          </form>
        </div>
      )}
      {pendingPermanentDelete && (
        <div
          className="modal-backdrop trash-confirm-backdrop"
          onMouseDown={(event) =>
            event.target === event.currentTarget &&
            setPendingPermanentDelete(null)
          }
        >
          <div
            className="modal trash-confirm-modal"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="active-delete-confirm-title"
          >
            <div className="modal-head">
              <div>
                <span>PERMANENT DELETE</span>
                <h2 id="active-delete-confirm-title">
                  Delete “{pendingPermanentDelete.name}” forever?
                </h2>
              </div>
              <button onClick={() => setPendingPermanentDelete(null)}>
                <X />
              </button>
            </div>
            <p>
              Trash is turned off, so this counter cannot be restored after it
              is deleted.
            </p>
            <div className="modal-footer">
              <button
                className="cancel"
                onClick={() => setPendingPermanentDelete(null)}
              >
                Cancel
              </button>
              <button
                className="save trash-confirm-delete"
                onClick={() => {
                  setCounters((items) =>
                    items.filter(
                      (item) => item.id !== pendingPermanentDelete.id,
                    ),
                  );
                  setPendingPermanentDelete(null);
                }}
              >
                <Trash2 /> Delete forever
              </button>
            </div>
          </div>
        </div>
      )}
      {authOpen && (
        <AuthModal
          session={session}
          sessionGeneration={sessionGeneration.current}
          configured={supabaseConfigured}
          syncStatus={syncStatus}
          onDeleted={() => {
            setAuthOpen(false);
            setAuthNotice(
              "Your account and cloud data were deleted. Your counters and settings remain saved on this device.",
            );
          }}
          onClose={() => setAuthOpen(false)}
        />
      )}
      {syncConflict && (
        <SyncConflictModal
          deviceCount={syncConflict.deviceCounters.length}
          cloudCount={syncConflict.cloudCounters.length}
          onChoose={resolveSyncConflict}
          singletonChoices={singletonChoices}
          onSingletonChange={(key, value) => setSingletonChoices((current) => ({ ...current, [key]: value }))}
        />
      )}
      {superEditorOpen && (
        <SuperEditorPane
          counters={counters}
          value={superSettings.uiCustomizations}
          onChange={(uiCustomizations) =>
            setSuperSettings((current) => ({ ...current, uiCustomizations }))
          }
          onClose={() => setSuperEditorOpen(false)}
        />
      )}
      <CopySharePrompt
        incoming={copySharing.incoming[0]}
        outcome={copySharing.outcomes[0]}
        onAccept={acceptCounterCopy}
        onDeny={denyCounterCopy}
        onAcknowledge={(share) => copySharing.acknowledgeShare(share.id)}
      />
      <GroupInvitePrompt groups={sharedGroups} />
    </div>
  );
}
