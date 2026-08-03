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
  supabasePublishableKey,
  supabaseUrl,
} from "../lib/supabase";
import { runTallyScript } from "../features/scripting/tallyscript";
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
  starter,
  type AnyRecord,
} from "../features/counters/model";
import { AuthModal } from "../features/auth/AuthModal";
import { EmbedBuilder } from "../features/embed/EmbedComponents";
import { Editor } from "../features/counters/CounterEditor";
import {
  SuperEditorPane,
  SuperSettings,
  SuperZoneContent,
} from "../features/tally-super/TallySuper";
import { TrashModal } from "../features/trash/TrashModal";
import { StatsModal } from "../features/stats/StatsModal";
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

const cleanFolderPath = (value = "") => String(value).split("/").map((part) => part.trim()).filter(Boolean).join("/");
const folderAncestors = (value = "") => {
  const parts = cleanFolderPath(value).split("/").filter(Boolean);
  return parts.map((_, index) => parts.slice(0, index + 1).join("/"));
};
const folderParent = (value = "") => {
  const parts = cleanFolderPath(value).split("/");
  return parts.slice(0, -1).join("/");
};

export function CountersPage({ theme, onThemeChange }) {
  const [counters, setCounters] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("tally-counters")) || [];
    } catch {
      return [];
    }
  });
  const [trash, setTrash] = useState(() => {
    try {
      return (JSON.parse(localStorage.getItem("tally-trash")) || []).filter(
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
  const [history, setHistory] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tally-history"));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const sessionStartedAt = useRef(Date.now());
  const [redoStack, setRedoStack] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tally-redo"));
      return Array.isArray(saved) ? saved : [];
    } catch {
      return [];
    }
  });
  const [historyCounterId, setHistoryCounterId] = useState("");
  const [counterSearch, setCounterSearch] = useState("");
  const [tagFilter, setTagFilter] = useState("all");
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tally-folders"));
      const paths = Array.isArray(saved) ? saved.map(cleanFolderPath) : [];
      return [...new Set([...paths, ...counters.flatMap((counter) => folderAncestors(counter.folder))].filter(Boolean))].sort();
    } catch {
      return [...new Set(counters.flatMap((counter) => folderAncestors(counter.folder)))].sort();
    }
  });
  const [draggedFolder, setDraggedFolder] = useState("");
  const [currentFolder, setCurrentFolder] = useState("");
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggedCounterId, setDraggedCounterId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [mobileHistoryOpen, setMobileHistoryOpen] = useState(false);
  const [superEditorOpen, setSuperEditorOpen] = useState(false);
  const [statResets, setStatResets] = useState({});
  const [session, setSession] = useState(null);
  const copySharing = useCopySharing(session);
  const sharedGroups = useSharedGroups(session);
  const [workspaceTab, setWorkspaceTab] = useState("mine");
  useEffect(() => {
    if (!session && workspaceTab === "shared") setWorkspaceTab("mine");
  }, [session, workspaceTab]);
  const [authOpen, setAuthOpen] = useState(false);
  const [syncReady, setSyncReady] = useState(false);
  const [syncStatus, setSyncStatus] = useState("Local only");
  const [syncConflict, setSyncConflict] = useState(null);
  const [authNotice, setAuthNotice] = useState("");
  const [superSettings, setSuperSettings] = useState(() => {
    try {
      return normalizeSuperSettings(
        JSON.parse(localStorage.getItem("tally-super")),
      );
    } catch {
      return normalizeSuperSettings({});
    }
  });
  const [scripts, setScripts] = useState<AnyRecord>(() => {
    try {
      const saved = JSON.parse(localStorage.getItem("tally-scripts"));
      return saved && typeof saved === "object" && !Array.isArray(saved)
        ? saved
        : {};
    } catch {
      return {};
    }
  });
  const scriptExecutions = useRef(new Map());
  const unloadFlushStarted = useRef(false);
  const [runningScripts, setRunningScripts] = useState(() => new Set());
  const [scriptErrors, setScriptErrors] = useState<AnyRecord>({});
  const [preferences, setPreferences] = useState(() => {
    const defaults = {
      density: "comfortable",
      columns: "auto",
      numberSize: "standard",
      showBounds: true,
      animations: true,
      defaultColor: COLORS[0],
      trashEnabled: true,
      syncTrash: true,
    };
    try {
      return {
        ...defaults,
        ...JSON.parse(localStorage.getItem("tally-preferences")),
      };
    } catch {
      return defaults;
    }
  });

  const validateRemoteUser = async () => {
    if (!supabase || !session) return true;
    const { data, error } = await supabase.auth.getUser();
    if (data?.user) return true;
    const accountIsGone =
      error?.status === 401 ||
      error?.status === 403 ||
      error?.code === "user_not_found";
    if (!accountIsGone) return null;
    await supabase.auth.signOut({ scope: "local" });
    setSession(null);
    setSyncReady(false);
    setSyncConflict(null);
    setSyncStatus("Local only");
    setAuthNotice(
      "Your account was deleted or this device is no longer authorized. You have been signed out, but your counters remain saved locally.",
    );
    return false;
  };

  useEffect(
    () => localStorage.setItem("tally-counters", JSON.stringify(counters)),
    [counters],
  );
  useEffect(
    () => localStorage.setItem("tally-trash", JSON.stringify(trash)),
    [trash],
  );
  useEffect(
    () => localStorage.setItem("tally-history", JSON.stringify(history)),
    [history],
  );
  useEffect(
    () => localStorage.setItem("tally-redo", JSON.stringify(redoStack)),
    [redoStack],
  );
  useEffect(
    () => localStorage.setItem("tally-folders", JSON.stringify(folders)),
    [folders],
  );
  useEffect(() => {
    const discovered = counters.flatMap((counter) => folderAncestors(counter.folder));
    setFolders((current) => {
      const next = [...new Set([...current, ...discovered].filter(Boolean))].sort();
      return JSON.stringify(next) === JSON.stringify(current) ? current : next;
    });
  }, [counters]);
  useEffect(() => {
    const purge = () =>
      setTrash((items) => {
        const kept = items.filter(
          (counter) => Date.now() - Number(counter.deletedAt) < TRASH_LIFETIME,
        );
        return kept.length === items.length ? items : kept;
      });
    purge();
    const timer = setInterval(purge, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(
    () =>
      localStorage.setItem("tally-preferences", JSON.stringify(preferences)),
    [preferences],
  );
  useEffect(
    () => localStorage.setItem("tally-super", JSON.stringify(superSettings)),
    [superSettings],
  );
  useEffect(
    () => localStorage.setItem("tally-scripts", JSON.stringify(scripts)),
    [scripts],
  );
  useEffect(() => {
    if (!supabase) return;
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
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
    if (!supabase || !session) {
      setSyncReady(false);
      setSyncConflict(null);
      setSyncStatus("Local only");
      return;
    }
    let cancelled = false;
    const loadCloud = async () => {
      setSyncStatus("Loading cloud data…");
      const { data, error } = await supabase
        .from("user_data")
        .select("counters,preferences,tally_super,scripts")
        .eq("user_id", session.user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        if ((await validateRemoteUser()) !== false) setSyncStatus("Sync error");
        return;
      }
      if (data) {
        const localCounters = counters
          .filter((counter) => counter.localOnly)
          .map(sanitize);
        const deviceCounters = counters
          .filter((counter) => !counter.localOnly)
          .map(sanitize);
        const cloudRows = Array.isArray(data.counters) ? data.counters : [];
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
        if (syncCloudTrash) setTrash(mergedTrash);
        const countersDiffer = !countersEqual(deviceCounters, cloudCounters);
        if (deviceCounters.length && cloudCounters.length && countersDiffer) {
          setSyncConflict({
            deviceCounters: [...localCounters, ...deviceCounters],
            cloudCounters: [...localCounters, ...cloudCounters],
            cloudPreferences: data.preferences,
            cloudSuper: data.tally_super,
            cloudScripts: data.scripts,
          });
          setSyncStatus("Choose sync data");
          return;
        }
        if (cloudCounters.length) {
          setCounters([...localCounters, ...cloudCounters]);
          if (data.preferences)
            setPreferences((current) => ({ ...current, ...data.preferences }));
          if (data.tally_super)
            setSuperSettings(normalizeSuperSettings(data.tally_super));
          if (data.scripts && typeof data.scripts === "object")
            setScripts(data.scripts);
        } else if (deviceCounters.length) {
          const { error: saveError } = await supabase.from("user_data").upsert(
            {
              user_id: session.user.id,
              counters: [
                ...deviceCounters,
                ...(syncCloudTrash
                  ? mergedTrash.filter((counter) => !counter.localOnly)
                  : []),
              ],
              preferences,
              tally_super: superSettings,
              scripts,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id" },
          );
          if (saveError) {
            if ((await validateRemoteUser()) !== false)
              setSyncStatus("Sync error");
            return;
          }
        } else {
          if (data.preferences)
            setPreferences((current) => ({ ...current, ...data.preferences }));
          if (data.tally_super)
            setSuperSettings(normalizeSuperSettings(data.tally_super));
          if (data.scripts && typeof data.scripts === "object")
            setScripts(data.scripts);
        }
      } else {
        const { error: saveError } = await supabase.from("user_data").insert({
          user_id: session.user.id,
          counters: [
            ...counters.filter((counter) => !counter.localOnly),
            ...(preferences.syncTrash
              ? trash.filter((counter) => !counter.localOnly)
              : []),
          ],
          preferences,
          tally_super: superSettings,
          scripts,
        });
        if (saveError) {
          if ((await validateRemoteUser()) !== false)
            setSyncStatus("Sync error");
          return;
        }
      }
      setSyncReady(true);
      setSyncStatus("Synced");
    };
    loadCloud();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);
  const resolveSyncConflict = (choice) => {
    if (!syncConflict) return;
    if (choice === "cloud") {
      setCounters(syncConflict.cloudCounters);
      if (syncConflict.cloudPreferences)
        setPreferences((current) => ({
          ...current,
          ...syncConflict.cloudPreferences,
        }));
      if (syncConflict.cloudSuper)
        setSuperSettings(normalizeSuperSettings(syncConflict.cloudSuper));
      if (syncConflict.cloudScripts) setScripts(syncConflict.cloudScripts);
    } else if (choice === "merge") {
      const merged = [...syncConflict.deviceCounters];
      const existing = new Map(
        merged.map((counter) => [String(counter.id), counter]),
      );
      syncConflict.cloudCounters.forEach((counter, index) => {
        const matching = existing.get(String(counter.id));
        if (!matching) {
          merged.push(counter);
          existing.set(String(counter.id), counter);
        } else if (!countersEqual([matching], [counter])) {
          merged.push({
            ...counter,
            id: `${counter.id}-cloud-${Date.now()}-${index}`,
            name: `${counter.name} (cloud)`,
          });
        }
      });
      setCounters(merged);
    }
    setSyncConflict(null);
    setSyncReady(true);
    setSyncStatus("Saving…");
  };
  useEffect(() => {
    if (!supabase || !session || !syncReady) return;
    setSyncStatus("Saving…");
    const timer = setTimeout(async () => {
      const { error } = await supabase.from("user_data").upsert(
        {
          user_id: session.user.id,
          counters: [
            ...counters.filter((counter) => !counter.localOnly),
            ...(preferences.syncTrash
              ? trash.filter((counter) => !counter.localOnly)
              : []),
          ],
          preferences,
          tally_super: superSettings,
          scripts,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" },
      );
      if (error) {
        if ((await validateRemoteUser()) !== false) setSyncStatus("Sync error");
      } else setSyncStatus("Synced");
    }, 700);
    return () => clearTimeout(timer);
  }, [
    counters,
    trash,
    preferences,
    superSettings,
    scripts,
    session?.user?.id,
    syncReady,
  ]);
  const setValue = (id, requested, kind = "set") => {
    const counter = counters.find((c) => c.id === id);
    if (!counter) return;
    const value = Math.max(
      counter.min ?? -Infinity,
      Math.min(counter.max ?? Infinity, Number(requested)),
    );
    if (!Number.isFinite(value) || value === counter.value) return;
    setRedoStack([]);
    setHistory((log) => [
      ...log.slice(-999),
      {
        eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        id,
        name: counter.name,
        from: counter.value,
        to: value,
        kind,
        time: Date.now(),
      },
    ]);
    setCounters((items) =>
      items.map((c) => (c.id === id ? { ...c, value } : c)),
    );
  };
  const change = (id, amount) => {
    const counter = counters.find((c) => c.id === id);
    if (counter)
      setValue(
        id,
        counter.value + amount,
        amount > 0 ? "increment" : "decrement",
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
    setHistory((log) => {
      let targetIndex = -1;
      for (let index = log.length - 1; index >= 0; index -= 1) {
        const counterStillExists = counters.some((counter) => String(counter.id) === String(log[index].id));
        if (counterStillExists && (counterId == null || String(log[index].id) === String(counterId))) {
          targetIndex = index;
          break;
        }
      }
      if (targetIndex < 0) return log;
      const entry = log[targetIndex];
      setCounters((items) => items.map((counter) =>
        String(counter.id) === String(entry.id)
          ? { ...counter, value: entry.from }
          : counter,
      ));
      setRedoStack((current) => [...current, entry]);
      return log.filter((_, index) => index !== targetIndex);
    });
  };
  const redoLatest = (counterId = null) => {
    setRedoStack((stack) => {
      let targetIndex = -1;
      for (let index = stack.length - 1; index >= 0; index -= 1) {
        const exists = counters.some((counter) => String(counter.id) === String(stack[index].id));
        if (exists && (counterId == null || String(stack[index].id) === String(counterId))) {
          targetIndex = index;
          break;
        }
      }
      if (targetIndex < 0) return stack;
      const original = stack[targetIndex];
      const redone = {
        ...original,
        eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        kind: "redo",
        time: Date.now(),
      };
      setCounters((items) => items.map((counter) =>
        String(counter.id) === String(original.id) ? { ...counter, value: original.to } : counter,
      ));
      setHistory((log) => [...log.slice(-999), redone]);
      return stack.filter((_, index) => index !== targetIndex);
    });
  };
  const saveScript = (id, changes) =>
    setScripts((current) => ({
      ...current,
      [String(id)]: {
        language: "tallyscript",
        source: "",
        ...current[String(id)],
        ...changes,
      },
    }));
  const applyScriptResult = (counter, result, inTrash) => {
    const key = String(counter.id);
    const clean = sanitize(result.counter);
    if (inTrash)
      setTrash((items) =>
        items.map((item) =>
          item.id === clean.id ? { ...clean, deletedAt: item.deletedAt } : item,
        ),
      );
    else
      setCounters((items) =>
        items.map((item) => (item.id === clean.id ? clean : item)),
      );
    setSuperSettings((current) => ({
      ...current,
      counterCustomizations: {
        ...current.counterCustomizations,
        [key]: result.customization,
      },
    }));
    setEditing((current) =>
      current && String(current.id) === key ? clean : current,
    );
    return clean;
  };
  const stopScript = (id, disable = true) => {
    const key = String(id);
    scriptExecutions.current.get(key)?.abort();
    scriptExecutions.current.delete(key);
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
    const controller = new AbortController();
    scriptExecutions.current.set(key, controller);
    setRunningScripts((current) => new Set(current).add(key));
    saveScript(key, { enabled: true });
    const execution = language === "javascript"
      ? import("../features/scripting/javascript").then(({ runJavaScript }) =>
        runJavaScript(source, counter, customization, {
          signal: controller.signal,
          onUpdate: (result) => applyScriptResult(counter, result, inTrash),
        }))
      : runTallyScript(source, counter, customization, {
          signal: controller.signal,
          onUpdate: (result) => applyScriptResult(counter, result, inTrash),
        });
    void execution
      .then((result) => applyScriptResult(counter, result, inTrash))
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
        if (scriptExecutions.current.get(key) !== controller) return;
        scriptExecutions.current.delete(key);
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
    for (const counter of [...counters, ...trash]) {
      const key = String(counter.id);
      const script = scripts[key];
      if (
        script?.enabled &&
        (script.language === "javascript" || script.language === "tallyscript") &&
        !scriptExecutions.current.has(key)
      )
        executeScript(
          counter,
          script.source || "",
          "javascript",
          trash.includes(counter),
        );
    }
  }, [counters, trash, scripts]);

  useEffect(
    () => () => {
      for (const controller of scriptExecutions.current.values())
        controller.abort();
      scriptExecutions.current.clear();
    },
    [],
  );

  useEffect(() => {
    if (!runningScripts.size) {
      unloadFlushStarted.current = false;
      return;
    }

    const stopAndFlush = (event?: BeforeUnloadEvent) => {
      const runningIds = new Set(
        [...scriptExecutions.current.keys()].map(String),
      );
      const stoppedScripts = Object.fromEntries(
        Object.entries(scripts).map(([id, script]) => [
          id,
          runningIds.has(id) ? { ...script, enabled: false } : script,
        ]),
      );
      for (const controller of scriptExecutions.current.values())
        controller.abort();
      scriptExecutions.current.clear();
      setRunningScripts(new Set());
      setScripts(stoppedScripts);
      localStorage.setItem("tally-counters", JSON.stringify(counters));
      localStorage.setItem("tally-trash", JSON.stringify(trash));
      localStorage.setItem("tally-super", JSON.stringify(superSettings));
      localStorage.setItem("tally-scripts", JSON.stringify(stoppedScripts));

      if (
        !session ||
        !supabaseUrl ||
        !supabasePublishableKey ||
        unloadFlushStarted.current
      )
        return;

      unloadFlushStarted.current = true;
      setSyncStatus("Saving stopped scripts…");
      const payload = {
        user_id: session.user.id,
        counters: [
          ...counters.filter((counter) => !counter.localOnly),
          ...(preferences.syncTrash
            ? trash.filter((counter) => !counter.localOnly)
            : []),
        ],
        preferences,
        tally_super: superSettings,
        scripts: stoppedScripts,
        updated_at: new Date().toISOString(),
      };
      void fetch(`${supabaseUrl}/rest/v1/user_data?on_conflict=user_id`, {
        method: "POST",
        keepalive: true,
        headers: {
          apikey: supabasePublishableKey,
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
          Prefer: "resolution=merge-duplicates",
        },
        body: JSON.stringify(payload),
      })
        .then((response) => {
          if (!response.ok)
            throw new Error(`Final cloud sync failed (${response.status}).`);
          setSyncStatus("Synced");
        })
        .catch(() => setSyncStatus("Sync error"));

      if (event) {
        event.preventDefault();
        event.returnValue = "";
      }
    };

    const beforeUnload = (event: BeforeUnloadEvent) => stopAndFlush(event);
    const pageHide = () => stopAndFlush();
    window.addEventListener("beforeunload", beforeUnload);
    window.addEventListener("pagehide", pageHide);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      window.removeEventListener("pagehide", pageHide);
    };
  }, [
    counters,
    preferences,
    runningScripts,
    scripts,
    session,
    superSettings,
    trash,
  ]);
  const importBackup = (data: AnyRecord, scope, options: AnyRecord = {}) => {
    if (!data || typeof data !== "object")
      throw new Error("This file is not a valid Tally backup.");
    let importedCounters;
    if (scope === "counters" || scope === "all") {
      if (!Array.isArray(data.counters))
        throw new Error("This backup does not contain counter data.");
      if (
        data.counters.some(
          (counter) =>
            !counter ||
            typeof counter !== "object" ||
            typeof counter.name !== "string",
        )
      )
        throw new Error("The backup contains invalid counter data.");
      importedCounters = data.counters.map((counter, index) =>
        sanitize({ ...counter, id: counter.id ?? `${Date.now()}-${index}` }),
      );
    }
    if (
      (scope === "super" || scope === "all") &&
      (!data.tallySuper ||
        typeof data.tallySuper !== "object" ||
        Array.isArray(data.tallySuper))
    )
      throw new Error("This backup does not contain Tally Super data.");
    if (
      (scope === "super" || scope === "all") &&
      (!data.preferences ||
        typeof data.preferences !== "object" ||
        Array.isArray(data.preferences))
    )
      throw new Error("This backup does not contain customization settings.");
    if (
      scope === "counters" &&
      options.includeCounterCustomizations &&
      (!data.counterCustomizations ||
        typeof data.counterCustomizations !== "object" ||
        Array.isArray(data.counterCustomizations))
    )
      throw new Error(
        "This counter backup does not contain per-counter customizations.",
      );
    if (
      scope === "counters" &&
      options.includeScripts &&
      (!data.scripts ||
        typeof data.scripts !== "object" ||
        Array.isArray(data.scripts))
    )
      throw new Error("This counter backup does not contain scripts.");
    const label =
      scope === "all"
        ? "all Tally data"
        : scope === "super"
          ? "Tally Super and customization settings"
          : "counter data";
    if (!confirm(`Replace the current ${label} with this backup?`))
      return false;
    if (importedCounters) {
      setCounters(importedCounters);
      setHistory([]);
      setRedoStack([]);
    }
    if (scope === "counters" && options.includeCounterCustomizations)
      setSuperSettings((current) => ({
        ...current,
        counterCustomizations: data.counterCustomizations,
      }));
    if (scope === "counters" && options.includeScripts)
      setScripts(data.scripts);
    if (scope === "super" || scope === "all") {
      setSuperSettings(
        normalizeSuperSettings(
          scope === "super"
            ? { uiCustomizations: data.tallySuper.uiCustomizations }
            : data.tallySuper,
        ),
      );
      if (scope === "all")
        setScripts(
          data.scripts &&
            typeof data.scripts === "object" &&
            !Array.isArray(data.scripts)
            ? data.scripts
            : {},
        );
      if (
        data.preferences &&
        typeof data.preferences === "object" &&
        !Array.isArray(data.preferences)
      )
        setPreferences((current) => ({ ...current, ...data.preferences }));
    }
    return true;
  };
  const save = (draft) => {
    const clean = sanitize(draft);
    if (editingTrash)
      setTrash((items) =>
        items.map((counter) =>
          counter.id === clean.id
            ? { ...clean, deletedAt: counter.deletedAt }
            : counter,
        ),
      );
    else {
      const previous = counters.find((counter) => String(counter.id) === String(clean.id));
      if (previous && previous.value !== clean.value) {
        setRedoStack([]);
        setHistory((log) => [...log.slice(-999), {
          eventId: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          id: clean.id,
          name: clean.name,
          from: previous.value,
          to: clean.value,
          kind: "set",
          time: Date.now(),
        }]);
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
      folder: currentFolder,
      tags: [],
    });
  };
  const removeCounter = (counter) => {
    if (!preferences.trashEnabled) {
      setPendingPermanentDelete(counter);
      return;
    }
    setCounters((items) => items.filter((item) => item.id !== counter.id));
    setTrash((items) => [
      { ...counter, deletedAt: Date.now() },
      ...items.filter((item) => item.id !== counter.id),
    ]);
  };
  const restoreCounter = (counter) => {
    const { deletedAt, ...restored } = counter;
    setTrash((items) => items.filter((item) => item.id !== counter.id));
    setCounters((items) => [
      ...items,
      {
        ...restored,
        id: items.some((item) => String(item.id) === String(restored.id))
          ? `${restored.id}-restored-${Date.now()}`
          : restored.id,
      },
    ]);
  };
  const permanentlyDeleteTrashCounters = (deletedCounters) => {
    const ids = new Set(deletedCounters.map((counter) => String(counter.id)));
    deletedCounters.forEach((counter) => stopScript(counter.id));
    setTrash((items) => items.filter((item) => !ids.has(String(item.id))));
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
  const acceptCounterCopy = async (
    share,
    { localOnly, includeScript, includeCustomization },
  ) => {
    await copySharing.answerShare(share.id, true);
    const copyId = `shared-${share.id}-${Date.now()}`;
    const copy = sanitize({
      ...share.counter_data,
      id: copyId,
      localOnly,
    });
    setCounters((items) => [...items, copy]);
    if (includeScript && share.counter_script)
      setScripts((current) => ({
        ...current,
        [copyId]: { ...share.counter_script, enabled: false },
      }));
    if (includeCustomization && share.counter_customization)
      setSuperSettings((current) => ({
        ...current,
        counterCustomizations: {
          ...current.counterCustomizations,
          [copyId]: share.counter_customization,
        },
      }));
  };
  const denyCounterCopy = (share) =>
    copySharing.answerShare(share.id, false);
  const changeTrash = (id, amount) =>
    setTrash((items) =>
      items.map((counter) =>
        counter.id === id
          ? {
              ...counter,
              value: Math.max(
                counter.min ?? -Infinity,
                Math.min(counter.max ?? Infinity, counter.value + amount),
              ),
            }
          : counter,
      ),
    );
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

  const tags: string[] = [...new Set<string>(counters.flatMap((counter) => (counter.tags || []).map(String)))].sort();
  const normalizedSearch = counterSearch.trim().toLowerCase();
  const filteringCounters = Boolean(normalizedSearch || tagFilter !== "all");
  const inCurrentTree = (folder = "") => !currentFolder || folder === currentFolder || folder.startsWith(`${currentFolder}/`);
  const visibleCounters = counters.filter((counter) => {
    const searchable = [counter.name, counter.folder, ...(counter.tags || [])].join(" ").toLowerCase();
    return (!normalizedSearch || searchable.includes(normalizedSearch)) &&
      inCurrentTree(counter.folder || "") &&
      (tagFilter === "all" || (counter.tags || []).includes(tagFilter));
  });
  const displayedCounters = filteringCounters
    ? visibleCounters
    : visibleCounters.filter((counter) => (counter.folder || "") === currentFolder);
  const childFolders = filteringCounters ? [] : folders.filter((folder) => folderParent(folder) === currentFolder);
  const folderSegments = currentFolder.split("/").filter(Boolean);
  const moveCounterToFolder = (id, folder) => {
    setCounters((items) => items.map((counter) =>
      String(counter.id) === String(id) ? sanitize({ ...counter, folder }) : counter,
    ));
    setDraggedCounterId(null);
  };
  const moveFolderToFolder = (source, destination) => {
    if (!source || source === destination || destination.startsWith(`${source}/`)) return;
    const name = source.split("/").at(-1) || "";
    const nextRoot = cleanFolderPath(destination ? `${destination}/${name}` : name);
    if (nextRoot === source || folders.includes(nextRoot)) return;
    const relocate = (value) => value === source || value.startsWith(`${source}/`)
      ? `${nextRoot}${value.slice(source.length)}`
      : value;
    setFolders((current) => current.map(relocate).sort());
    setCounters((items) => items.map((counter) => {
      const nextFolder = relocate(counter.folder || "");
      return nextFolder === counter.folder ? counter : sanitize({ ...counter, folder: nextFolder });
    }));
    setCurrentFolder((current) => relocate(current));
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
    const name = cleanFolderPath(newFolderName);
    if (!name || name.includes("/")) return;
    const path = cleanFolderPath(currentFolder ? `${currentFolder}/${name}` : name);
    setFolders((current) => current.includes(path) ? current : [...current, path].sort());
    setNewFolderName("");
    setNewFolderOpen(false);
  };
  const deleteLocalFolder = (folder) => {
    const parent = folderParent(folder);
    setFolders((current) => current.filter((item) => item !== folder && !item.startsWith(`${folder}/`)));
    setCounters((items) => items.map((counter) =>
      counter.folder === folder || counter.folder?.startsWith(`${folder}/`)
        ? sanitize({ ...counter, folder: parent })
        : counter,
    ));
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
  />;
  const sessionHistory = history.filter((entry) => entry.time >= sessionStartedAt.current);

  return (
    <div
      className={`app-shell density-${preferences.density} numbers-${preferences.numberSize} ${preferences.animations ? "" : "no-animations"} ${superEditorOpen ? "super-editing" : ""}`}
      data-theme={theme}
    >
      <header data-super-zone="top">
        <a className="brand" href={import.meta.env.BASE_URL}>
          <span className="brand-mark">
            <span></span>
            <span></span>
            <span></span>
            <span></span>
          </span>
          TALLY
        </a>
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
            <button className="header-tool desktop-history-tool" onClick={() => {
              setHistoryCounterId(String(counters[0]?.id || ""));
              setMenu("history");
            }}>
              <HistoryIcon /> <span>History</span>
            </button>
            <button className="header-tool undo-tool desktop-history-tool" disabled={!history.length} onClick={() => undoLatest()} title="Undo latest value change">
              <Undo2 /> <span>Undo</span>
            </button>
            <button className="header-tool redo-tool desktop-history-tool" disabled={!redoStack.length} onClick={() => redoLatest()} title="Redo latest undone change">
              <Redo2 /> <span>Redo</span>
            </button>
            <div className="mobile-history-actions">
              <button className="header-tool" aria-label="History actions" aria-expanded={mobileHistoryOpen} onClick={() => setMobileHistoryOpen((open) => !open)}>
                <HistoryIcon />
              </button>
              {mobileHistoryOpen && <div className="mobile-history-menu">
                <button onClick={() => { setHistoryCounterId(String(counters[0]?.id || "")); setMenu("history"); setMobileHistoryOpen(false); }}><HistoryIcon /> History</button>
                <button disabled={!history.length} onClick={() => { undoLatest(); setMobileHistoryOpen(false); }}><Undo2 /> Undo latest</button>
                <button disabled={!redoStack.length} onClick={() => { redoLatest(); setMobileHistoryOpen(false); }}><Redo2 /> Redo latest</button>
              </div>}
            </div>
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
          {workspaceTab === "shared" ? (
            <SharedCountersView groups={sharedGroups} />
          ) : <div className="counter-folders">
            <nav className="folder-breadcrumbs" aria-label="Folder path">
              <button type="button" className={!currentFolder ? "active" : ""} onClick={() => setCurrentFolder("")} onDragOver={(event) => event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, "")}><Folder /> My counters</button>
              {folderSegments.map((segment, index) => {
                const path = folderSegments.slice(0, index + 1).join("/");
                return <span key={path}><ChevronRight /><button type="button" className={path === currentFolder ? "active" : ""} onClick={() => setCurrentFolder(path)} onDragOver={(event) => event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, path)}>{segment}</button></span>;
              })}
            </nav>
            {childFolders.length > 0 && <div className="folder-grid">
              {childFolders.map((folder) => {
                const count = counters.filter((counter) => counter.folder === folder || counter.folder?.startsWith(`${folder}/`)).length;
                const name = folder.split("/").at(-1);
                return <div role="button" tabIndex={0} draggable className="folder-tile" key={folder} onClick={() => setCurrentFolder(folder)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); setCurrentFolder(folder); } }} onDragStart={(event) => { setDraggedFolder(folder); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/tally-folder", folder); }} onDragEnd={() => setDraggedFolder("")} onDragOver={(event) => { const source = draggedFolder || event.dataTransfer.getData("text/tally-folder"); if (!source || (source !== folder && !folder.startsWith(`${source}/`))) { event.preventDefault(); event.currentTarget.classList.add("drag-over"); } }} onDragLeave={(event) => event.currentTarget.classList.remove("drag-over")} onDrop={(event) => { event.currentTarget.classList.remove("drag-over"); acceptFolderDrop(event, folder); }}><span><Folder /></span><b>{name}</b><small>{count} {count === 1 ? "counter" : "counters"}</small><button type="button" className="folder-delete" aria-label={`Delete folder ${name}`} onClick={(event) => { event.stopPropagation(); if (confirm(`Delete “${name}” and its nested folders? Counters inside will move to ${currentFolder ? "this folder" : "My counters"}.`)) deleteLocalFolder(folder); }}><Trash2 /></button></div>;
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
          preferences={preferences}
          superSettings={superSettings}
          scripts={scripts}
          onStartSuperEditor={() => {
            setMenu(null);
            setSuperEditorOpen(true);
          }}
          onSuperSettings={setSuperSettings}
          onPreferences={setPreferences}
          onImport={importBackup}
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
          history={sessionHistory}
          counters={counters}
          superItems={superSettings.uiCustomizations.items}
          resets={statResets}
          onResetStat={(key) =>
            setStatResets((r) => ({ ...r, [key]: Date.now() }))
          }
          onResetAll={() => {
            const now = Date.now();
            setStatResets({ actions: now, net: now, distance: now, active: now, increments: now, decrements: now, resets: now });
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
          onClear={() => { setHistory([]); setRedoStack([]); }}
          onClose={() => setMenu(null)}
        />
      )}
      {newFolderOpen && (
        <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewFolderOpen(false)}>
          <form className="modal folder-create-modal" onSubmit={(event) => { event.preventDefault(); createFolder(); }}>
            <div className="modal-head"><div><span>NEW FOLDER</span><h2>Create a folder</h2></div><button type="button" onClick={() => setNewFolderOpen(false)}><X /></button></div>
            <p>{currentFolder ? <>This folder will be created inside <b>{currentFolder}</b>.</> : "This folder will be created in My counters."}</p>
            <label>Folder name<input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} placeholder="e.g. Fitness" /></label>
            <div className="modal-footer"><button className="cancel" type="button" onClick={() => setNewFolderOpen(false)}>Cancel</button><button className="save" type="submit" disabled={!newFolderName.trim() || newFolderName.includes("/")}><FolderPlus /> Create folder</button></div>
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
