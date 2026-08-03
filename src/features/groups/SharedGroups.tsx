import { Component, useEffect, useState } from "react";
import { Activity, ChevronRight, Folder, FolderPlus, Plus, Trash2, Users, X } from "lucide-react";
import { CounterCard } from "../counters/CounterCard";
import { Editor } from "../counters/CounterEditor";
import { COLORS, sanitize, type AnyRecord } from "../counters/model";
import {
  GROUP_PERMISSION_OPTIONS,
  GROUP_PERMISSION_SECTIONS,
  GROUP_PRESETS,
} from "./permissions";
import { useSharedGroups } from "./useSharedGroups";

const readableError = (error: unknown, fallback: string) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const value = error as AnyRecord;
    const message = [value.message, value.details, value.hint]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(" — ");
    if (message) return value.code ? `${message} (${value.code})` : message;
  }
  return fallback;
};

export function SharedCountersView({ groups }: AnyRecord) {
  const [editing, setEditing] = useState<AnyRecord | null>(null);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [draggedCounterId, setDraggedCounterId] = useState<string | null>(null);
  const [draggedFolderId, setDraggedFolderId] = useState<string | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const can = (key) => groups.permissions.has(key);
  const folders = groups.selectedFolders || [];
  const folderById = new Map<string, AnyRecord>(folders.map((folder) => [folder.id, folder]));
  const folderPath = (folder: AnyRecord) => {
    const names: string[] = [];
    const seen = new Set();
    let current = folder;
    while (current && !seen.has(current.id)) {
      seen.add(current.id); names.unshift(current.name);
      current = current.parent_id ? folderById.get(current.parent_id) : null;
    }
    return names.join(" / ");
  };
  const folderOptions = folders
    .map((folder) => ({ value: folder.id, label: folderPath(folder) }))
    .sort((first, second) => first.label.localeCompare(second.label));
  const currentFolder = currentFolderId ? folderById.get(currentFolderId) : null;
  const childFolders = folders.filter((folder) => (folder.parent_id || null) === currentFolderId);
  const visibleCounters = groups.selectedCounters.filter((counter) => (counter.folder_id || null) === currentFolderId);
  const breadcrumbs: AnyRecord[] = [];
  const breadcrumbSeen = new Set();
  let breadcrumbFolder = currentFolder;
  while (breadcrumbFolder && !breadcrumbSeen.has(breadcrumbFolder.id)) {
    breadcrumbSeen.add(breadcrumbFolder.id); breadcrumbs.unshift(breadcrumbFolder);
    breadcrumbFolder = breadcrumbFolder.parent_id ? folderById.get(breadcrumbFolder.parent_id) : null;
  }
  useEffect(() => {
    if (currentFolderId && !folders.some((folder) => folder.id === currentFolderId)) setCurrentFolderId(null);
  }, [groups.selectedGroupId, currentFolderId, folders.map((folder) => folder.id).join("|")]);
  const create = async () => {
    const name = prompt("Shared counter name");
    if (!name || !groups.selectedGroupId) return;
    const id = await groups.createCounter(groups.selectedGroupId, {
      id: crypto.randomUUID(), name, value: 0, start: 0, plusStep: 1,
      minusStep: 1, goals: [], goalDirection: "more", min: null, max: null,
      color: COLORS[0],
    });
    if (currentFolderId) await groups.moveCounter(id, currentFolderId);
  };
  const createFolder = async () => {
    if (!newFolderName.trim()) return;
    await groups.createFolder(groups.selectedGroupId, newFolderName.trim(), currentFolderId);
    setNewFolderName(""); setNewFolderOpen(false);
  };
  const acceptFolderDrop = (event, targetFolderId: string | null) => {
    event.preventDefault();
    const folderId = draggedFolderId || event.dataTransfer.getData("text/tally-folder-id");
    if (folderId) {
      if (can("settings_folder") && folderId !== targetFolderId)
        void groups.moveFolder(folderId, targetFolderId);
      setDraggedFolderId(null);
      return;
    }
    const counterId = draggedCounterId || event.dataTransfer.getData("text/tally-counter-id");
    if (counterId && can("settings_folder")) void groups.moveCounter(counterId, targetFolderId);
    setDraggedCounterId(null);
  };
  const save = async (draft) => {
    const original = editing.counter_data;
    const clean = sanitize(draft);
    if ((editing.folder_id || "") !== (draft.folder || ""))
      await groups.moveCounter(editing.id, draft.folder || null);
    const mappings = [
      ["name", "settings_name"], ["start", "settings_startvalue"],
      ["value", can("settings_exactvalue") ? "settings_exactvalue" : "settings_jump"], ["plusStep", "settings_posstep"],
      ["minusStep", "settings_negstep"], ["min", "settings_min"],
      ["max", "settings_max"], ["goalDirection", "settings_goaldir"],
      ["color", "settings_color"],
    ];
    for (const [field, permission] of mappings)
      if (JSON.stringify(clean[field]) !== JSON.stringify(original[field]))
        await groups.action(editing.id, permission, { [field]: clean[field] });
    if (JSON.stringify(clean.goals) !== JSON.stringify(original.goals)) {
      const added = clean.goals.filter((goal) => !(original.goals || []).includes(goal));
      const removed = (original.goals || []).filter((goal) => !clean.goals.includes(goal));
      for (const goal of added) await groups.action(editing.id, "settings_addgoal", { goal });
      for (const goal of removed) await groups.action(editing.id, "settings_removegoal", { goal });
    }
    setEditing(null);
  };
  const saveSuper = async (next) => {
    const previous = editing.customization || {};
    const permissionByPart = {
      embed: "superedit_embed", reset: "superedit_reset",
      settings: "superedit_settings", delete: "superedit_delete",
      title: "superedit_title", count: "superedit_count", goal: "superedit_goal",
      add: "superedit_add", subtract: "superedit_sub",
      minimum: "superedit_min_indicator", maximum: "superedit_max_indicator",
      "quick-plusStep": "superedit_posstep", "quick-minusStep": "superedit_negstep",
      "quick-min": "superedit_min_setting", "quick-max": "superedit_max_setting",
      "quick-color": "superedit_color", "quick-goalDirection": "superedit_goaldir",
    };
    const changed = Object.keys(permissionByPart).filter((partKey) =>
      JSON.stringify(previous.parts?.[partKey] || {}) !== JSON.stringify(next.parts?.[partKey] || {}) ||
      (partKey.startsWith("quick-") && previous.quickSettings?.includes(partKey.slice(6)) !== next.quickSettings?.includes(partKey.slice(6))),
    );
    for (const partKey of changed) {
      const permission = permissionByPart[partKey];
      if (!can(permission)) continue;
      await groups.action(editing.id, permission, {
        partKey, part: next.parts?.[partKey] || {},
        enabled: next.quickSettings?.includes(partKey.slice(6)) || false,
      });
    }
    setEditing((current) => ({ ...current, customization: next }));
  };
  if (!groups.groups.length)
    return <div className="shared-empty"><Users /><b>No shared groups yet</b><span>Create or join a group from Account Settings.</span></div>;
  return (
    <>
      <div className="shared-group-toolbar">
        <div><b>{groups.selectedGroup?.name}</b><span>{groups.selectedCounters.length} shared counters</span></div>
        {groups.groups.length > 1 && <select value={groups.selectedGroupId} onChange={(event) => groups.setSelectedGroupId(event.target.value)}>{groups.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>}
        <button onClick={() => setActivityOpen(true)}><Activity /> Activity</button>
        {can("create_folder") && <button onClick={() => setNewFolderOpen(true)}><FolderPlus /> New folder</button>}
        {groups.membership?.permission_preset === "full_access" && <button onClick={create}><Plus /> New shared counter</button>}
      </div>
      <nav className="folder-breadcrumbs shared-folder-breadcrumbs" aria-label="Shared folder path">
        <button type="button" className={currentFolderId == null ? "active" : ""} onClick={() => setCurrentFolderId(null)} onDragOver={(event) => can("settings_folder") && event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, null)}><Folder /> {groups.selectedGroup?.name}</button>
        {breadcrumbs.map((folder) => <span key={folder.id}><ChevronRight /><button type="button" className={folder.id === currentFolderId ? "active" : ""} onClick={() => setCurrentFolderId(folder.id)} onDragOver={(event) => can("settings_folder") && event.preventDefault()} onDrop={(event) => acceptFolderDrop(event, folder.id)}>{folder.name}</button></span>)}
      </nav>
      {childFolders.length > 0 && <div className="folder-grid shared-folder-grid">{childFolders.map((folder) => {
        const count = groups.selectedCounters.filter((counter) => counter.folder_id === folder.id).length;
        return <div role="button" tabIndex={0} draggable={can("settings_folder")} className="folder-tile" key={folder.id} onClick={() => setCurrentFolderId(folder.id)} onKeyDown={(event) => { if ((event.key === "Enter" || event.key === " ") && event.target === event.currentTarget) { event.preventDefault(); setCurrentFolderId(folder.id); } }} onDragStart={(event) => { setDraggedFolderId(folder.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/tally-folder-id", folder.id); }} onDragEnd={() => setDraggedFolderId(null)} onDragOver={(event) => { if (can("settings_folder") && draggedFolderId !== folder.id) { event.preventDefault(); event.currentTarget.classList.add("drag-over"); } }} onDragLeave={(event) => event.currentTarget.classList.remove("drag-over")} onDrop={(event) => { event.currentTarget.classList.remove("drag-over"); acceptFolderDrop(event, folder.id); }}><span><Folder /></span><b>{folder.name}</b><small>{count} direct {count === 1 ? "counter" : "counters"}</small>{can("delete_folder") && <button type="button" className="folder-delete" aria-label={`Delete folder ${folder.name}`} onClick={(event) => { event.stopPropagation(); if (confirm(`Delete “${folder.name}” and its nested folders? Counters inside will move to the group root.`)) void groups.deleteFolder(folder.id); }}><Trash2 /></button>}</div>;
      })}</div>}
      <div className="grid">
        {visibleCounters.map((shared, index) => (
          <CounterCard key={shared.id} counter={shared.counter_data} index={index} showBounds
            customization={shared.customization || {}}
            canAdd={can("add")} canSubtract={can("subtract")} canReset={can("reset")}
            canEdit={[...groups.permissions].some((key: string) => key.startsWith("settings_") || key.startsWith("scripting_") || key.startsWith("superedit_"))}
            canDelete={can("delete_counter")}
            onChange={(_id, amount) => groups.action(shared.id, amount > 0 ? "add" : "subtract")}
            onReset={() => groups.action(shared.id, "reset")}
            onEdit={() => setEditing(shared)} onEmbed={() => {}}
            onDelete={() => confirm("Permanently delete this shared counter?") && groups.deleteCounter(shared.id)}
            onDragStart={can("settings_folder") ? (event) => { setDraggedCounterId(shared.id); event.dataTransfer.effectAllowed = "move"; event.dataTransfer.setData("text/tally-counter-id", shared.id); } : null}
          />
        ))}
      </div>
      {!visibleCounters.length && !childFolders.length && <div className="shared-empty"><Folder /><b>This folder is empty</b><span>Add a shared counter or create a nested folder.</span></div>}
      {editing && <Editor draft={{ ...editing.counter_data, folder: editing.folder_id || "" }} setDraft={(update) => setEditing((current) => ({ ...current, counter_data: typeof update === "function" ? update({ ...current.counter_data, folder: current.folder_id || "" }) : update }))}
        isNew={false} showLocalOption={false} superCustomization={editing.customization || {}} script={editing.script || { language: "tallyscript", source: "" }}
        folderOptions={folderOptions}
        onScriptChange={(changes) => {
          const next = { ...(editing.script || {}), ...changes, enabled: false };
          setEditing((current) => ({ ...current, script: next }));
          return groups.action(editing.id, next.language === "javascript" ? "scripting_js" : "scripting_ts", next);
        }}
        permissions={groups.permissions}
        onSuperCustomization={saveSuper}
        onClose={() => setEditing(null)} onSave={save} />}
      {newFolderOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setNewFolderOpen(false)}><form className="modal folder-create-modal" onSubmit={(event) => { event.preventDefault(); void createFolder(); }}><div className="modal-head"><div><span>SHARED FOLDER</span><h2>Create a folder</h2></div><button type="button" onClick={() => setNewFolderOpen(false)}><X /></button></div><p>{currentFolder ? <>This folder will be created inside <b>{folderPath(currentFolder)}</b>.</> : <>This folder will be created in <b>{groups.selectedGroup?.name}</b>.</>}</p><label>Folder name<input autoFocus value={newFolderName} onChange={(event) => setNewFolderName(event.target.value)} maxLength={60} /></label><div className="modal-footer"><button className="cancel" type="button" onClick={() => setNewFolderOpen(false)}>Cancel</button><button className="save" type="submit" disabled={!newFolderName.trim() || newFolderName.includes("/")}><FolderPlus /> Create folder</button></div></form></div>}
      {activityOpen && <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && setActivityOpen(false)}><div className="modal shared-activity-modal"><div className="modal-head"><div><span>REALTIME AUDIT LOG</span><h2>Shared activity</h2></div><button onClick={() => setActivityOpen(false)}><X /></button></div><div className="shared-activity-list">{(groups.selectedEvents || []).map((event) => { const counter = groups.selectedCounters.find((item) => item.id === event.counter_id); const member = groups.members.find((item) => item.user_id === event.actor_id); return <div key={event.id}><Activity /><span><b>{member?.username || "A Tally user"}</b><small>{event.action_key.replaceAll("_", " ")} · {counter?.counter_data?.name || event.before_data?.name || "Deleted counter"}</small></span><time>{new Date(event.created_at).toLocaleString()}</time></div>; })}{!groups.selectedEvents?.length && <div className="shared-activity-empty">No shared activity yet.</div>}</div><div className="modal-footer"><button className="save" onClick={() => setActivityOpen(false)}>Done</button></div></div></div>}
    </>
  );
}

export function GroupInvitePrompt({ groups }: AnyRecord) {
  const invite = groups.invites[0];
  if (!invite) return null;
  return <div className="modal-backdrop group-invite-backdrop"><div className="modal group-invite-modal"><Users /><span>GROUP INVITATION</span><h2>You were invited to a shared counter group</h2><p>Access level: {GROUP_PRESETS.find(([key]) => key === invite.permission_preset)?.[1]}</p><div><button onClick={() => groups.respondInvite(invite.id, false)}>Decline</button><button className="save" onClick={() => groups.respondInvite(invite.id, true)}>Join group</button></div></div></div>;
}

export function GroupSettings({ session }: AnyRecord) {
  const groups = useSharedGroups(session);
  const [newName, setNewName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [preset, setPreset] = useState("count_only");
  const [custom, setCustom] = useState<string[]>([]);
  const [editingMember, setEditingMember] = useState<AnyRecord | null>(null);
  const [status, setStatus] = useState("");
  const run = async (action) => { try { setStatus(""); await action(); } catch (error) { setStatus(readableError(error, "Group action failed.")); } };
  const owner = groups.selectedGroup?.owner_id === session?.user?.id;
  return <div className="group-settings-panel">
    {groups.error && <div className="auth-status">{groups.error}</div>}
    <form onSubmit={(event) => { event.preventDefault(); if (!newName.trim()) { setStatus("Enter a group name."); return; } void run(async () => { await groups.createGroup(newName.trim()); setNewName(""); }); }}><input required value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="New group name" /><button className="save"><Plus /> Create group</button></form>
    {groups.groups.length > 0 && <>
      <select value={groups.selectedGroupId} onChange={(event) => groups.setSelectedGroupId(event.target.value)}>{groups.groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select>
      <div className="group-member-list">{groups.members.filter((member) => member.group_id === groups.selectedGroupId).map((member) => <div key={member.user_id}><span><b>{member.username || "Tally user"}</b><small>{GROUP_PRESETS.find(([key]) => key === member.permission_preset)?.[1]}</small></span>{owner && member.user_id !== session.user.id && <><button type="button" onClick={() => setEditingMember({ ...member, custom_permissions: member.custom_permissions || [] })}>Permissions</button><button type="button" aria-label={`Remove ${member.username || "member"}`} onClick={() => run(() => groups.removeMember(groups.selectedGroupId, member.user_id))}><Trash2 /></button></>}</div>)}</div>
      {owner && <div className="group-invite-builder"><input value={identifier} onChange={(event) => setIdentifier(event.target.value)} placeholder="Username or email" /><select value={preset} onChange={(event) => setPreset(event.target.value)}>{GROUP_PRESETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{preset === "custom" && <PermissionChoices selected={custom} onChange={setCustom} />}<button className="save" onClick={() => run(async () => { await groups.invite(groups.selectedGroupId, identifier, preset, custom); setIdentifier(""); })}>Invite member</button><button className="group-delete" onClick={() => confirm("Delete this group and all shared counters?") && run(() => groups.deleteGroup(groups.selectedGroupId))}>Delete group</button></div>}
    </>}
    {status && <div className="auth-status">{status}</div>}
    {editingMember && <div className="group-permission-editor"><div className="modal-head"><div><span>MEMBER ACCESS</span><h3>{editingMember.username || "Tally user"}</h3></div><button type="button" onClick={() => setEditingMember(null)}><X /></button></div><select value={editingMember.permission_preset} onChange={(event) => setEditingMember((current) => ({ ...current, permission_preset: event.target.value, custom_permissions: event.target.value === "custom" ? current.custom_permissions : [] }))}>{GROUP_PRESETS.map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>{editingMember.permission_preset === "custom" && <PermissionChoices selected={editingMember.custom_permissions} onChange={(next) => setEditingMember((current) => ({ ...current, custom_permissions: next }))} />}<button className="save" type="button" onClick={() => run(async () => { await groups.setPermissions(groups.selectedGroupId, editingMember.user_id, editingMember.permission_preset, editingMember.custom_permissions); setEditingMember(null); })}>Save permissions</button></div>}
  </div>;
}

function PermissionChoices({ selected, onChange }: AnyRecord) {
  const labels = new Map(GROUP_PERMISSION_OPTIONS);
  return <div className="group-custom-permissions">{GROUP_PERMISSION_SECTIONS.map(([section, keys]) => <section key={section}><h4>{section}</h4>{keys.map((key) => <label key={key}><input type="checkbox" checked={selected.includes(key)} onChange={() => onChange(selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key])} /><span>{labels.get(key)}</span></label>)}</section>)}</div>;
}

export class GroupSettingsBoundary extends Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error)
      return (
        <div className="group-settings-error" role="alert">
          <b>Groups couldn’t be opened</b>
          <span>{this.state.error.message}</span>
          <button type="button" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    return this.props.children;
  }
}
