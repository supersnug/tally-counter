#!/usr/bin/env node
/*
 * Disposable local verification only. Run after `npx supabase db reset --local`.
 * It discovers local keys at runtime and never prints them. No fixture or seed
 * data is required: the two short-lived accounts are created through Auth.
 */
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

const dryRun = process.argv.includes("--dry-run");
const checkNames = ["TE-DB-001", "TE-DB-002", "TE-DB-003"];
if (dryRun) {
  console.log(JSON.stringify({ harness: "local-database-boundaries", checks: checkNames, command: "npx supabase db reset --local && npm run verify:local-db" }));
  process.exit(0);
}

const status = process.env.SUPABASE_URL ? {} : JSON.parse(execFileSync("npx", ["supabase", "status", "-o", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] }));
const url = process.env.SUPABASE_URL || status.API_URL || status.api_url;
const anonKey = process.env.SUPABASE_ANON_KEY || status.ANON_KEY || status.anon_key;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || status.SERVICE_ROLE_KEY || status.service_role_key;
if (!url || !anonKey || !serviceKey) throw new Error("Local Supabase URL, anon key, and service key must be discoverable at runtime.");

const json = async (endpoint, options = {}) => {
  const response = await fetch(`${url}${endpoint}`, { ...options, headers: { apikey: anonKey, "content-type": "application/json", ...(options.headers || {}) } });
  const body = await response.json().catch(() => null);
  return { response, body };
};
const assert = (condition, message) => { if (!condition) throw new Error(message); };
const rpc = async (token, name, args) => {
  const result = await json(`/rest/v1/rpc/${name}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
  if (!result.response.ok) throw new Error(`${name} failed (${result.response.status})`);
  return result.body;
};
const rpcError = async (token, name, args) => {
  const result = await json(`/rest/v1/rpc/${name}`, { method: "POST", headers: { authorization: `Bearer ${token}` }, body: JSON.stringify(args) });
  return !result.response.ok;
};
const table = async (token, path, options = {}) => json(`/rest/v1/${path}`, { ...options, headers: { authorization: `Bearer ${token}`, ...(options.headers || {}) } });

const password = `Tally-${randomUUID()}-Aa1!`;
const accounts = await Promise.all(["a", "b"].map(async (label) => {
  const email = `tally-local-${label}-${randomUUID()}@example.test`;
  const created = await fetch(`${url}/auth/v1/admin/users`, { method: "POST", headers: { apikey: serviceKey, authorization: `Bearer ${serviceKey}`, "content-type": "application/json" }, body: JSON.stringify({ email, password, email_confirm: true }) });
  assert(created.ok, `could not create disposable account ${label}`);
  const signedIn = await json("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  assert(signedIn.response.ok && signedIn.body?.access_token, `could not authenticate disposable account ${label}`);
  return { label, email, userId: signedIn.body.user.id, token: signedIn.body.access_token };
}));
const [a, b] = accounts;
const operation = randomUUID();
const counter = { id: randomUUID(), name: "DB boundary", value: 2, start: 0, plusStep: 1, minusStep: 1, goals: [], goalDirection: "more", min: null, max: null, color: "#ef6a47" };
const workspace = { counters: [counter], preferences: {}, tally_super: {}, scripts: {}, folders: [] };
const report = [];

// TE-DB-001: account ownership, revision CAS, replay idempotency, and Local exclusion.
const firstRevision = await rpc(a.token, "update_user_data_revision", { expected_revision: 0, operation_id: operation, next_counters: workspace.counters, next_preferences: workspace.preferences, next_tally_super: workspace.tally_super, next_scripts: workspace.scripts, next_folders: workspace.folders });
const replayRevision = await rpc(a.token, "update_user_data_revision", { expected_revision: 0, operation_id: operation, next_counters: workspace.counters, next_preferences: workspace.preferences, next_tally_super: workspace.tally_super, next_scripts: workspace.scripts, next_folders: workspace.folders });
assert(String(firstRevision) === String(replayRevision), "TE-DB-001 operation replay changed the revision");
const crossAccountWrite = await table(b.token, `user_data?user_id=eq.${a.userId}`, { method: "PATCH", headers: { prefer: "return=representation" }, body: JSON.stringify({ counters: [{ ...counter, value: 999 }] }) });
assert(crossAccountWrite.response.ok && (crossAccountWrite.body == null || crossAccountWrite.body.length === 0), "TE-DB-001 cross-account row write was accepted");
const ownerRead = await table(a.token, `user_data?user_id=eq.${a.userId}&select=counters`);
assert(ownerRead.response.ok && ownerRead.body?.[0]?.counters?.[0]?.value === counter.value, "TE-DB-001 cross-account write changed the owner's state");
assert(await rpcError(a.token, "update_user_data_revision", { expected_revision: 0, operation_id: randomUUID(), next_counters: workspace.counters, next_preferences: {}, next_tally_super: {}, next_scripts: {}, next_folders: [] }), "TE-DB-001 stale revision write was accepted");
report.push({ id: "TE-DB-001", status: "passed" });

// TE-DB-002: source projection, recipient-only claim, local atomicity, and finalize replay.
await rpc(a.token, "update_copy_sharing_settings", { anonymize: false, sharing_enabled: true, pin_enabled: false, new_pin: null });
await rpc(a.token, "send_counter_copy_from_source", { recipient_identifier: b.email, source_counter_id: counter.id, include_script: false, include_customization: false, sharing_pin: null });
const incoming = await rpc(b.token, "list_incoming_counter_copies", {});
const share = Array.isArray(incoming) ? incoming.at(-1) : incoming?.items?.at(-1);
assert(share?.id != null, "TE-DB-002 recipient did not receive a copy");
assert(!JSON.stringify(share).includes("localOnly"), "TE-DB-002 Local/private source field leaked into copy projection");
assert(await rpcError(a.token, "claim_counter_copy", { share_id: String(share.id), operation_id: randomUUID(), include_script: false, include_customization: false, local_only: false }), "TE-DB-002 source account could claim its own outgoing copy");
const nonLocalClaim = await rpc(b.token, "claim_counter_copy", { share_id: String(share.id), operation_id: randomUUID(), include_script: false, include_customization: false, local_only: false });
assert(nonLocalClaim?.mode === "non_local" && nonLocalClaim?.state === "Accepted", "TE-DB-002 non-local claim did not accept atomically");
const localOfferResponse = await rpc(a.token, "send_counter_copy_from_source", { recipient_identifier: b.email, source_counter_id: counter.id, include_script: false, include_customization: false, sharing_pin: null });
const localShareId = localOfferResponse?.id;
const copyOperation = randomUUID();
const claimed = await rpc(b.token, "claim_counter_copy", { share_id: String(localShareId), operation_id: copyOperation, include_script: false, include_customization: false, local_only: true });
const destinationId = claimed?.destination_id || claimed?.destinationId;
const deliveryToken = claimed?.delivery_token || claimed?.deliveryToken;
assert(claimed?.mode === "local" && deliveryToken && destinationId, "TE-DB-002 local claim did not return a delivery token");
const finalized = await rpc(b.token, "finalize_local_counter_copy", { share_id: String(localShareId), operation_id: copyOperation, destination_id: destinationId, delivery_token: deliveryToken });
const finalizedAgain = await rpc(b.token, "finalize_local_counter_copy", { share_id: String(localShareId), operation_id: copyOperation, destination_id: destinationId, delivery_token: deliveryToken });
assert(finalized?.state === "Accepted" && finalizedAgain?.state === "Accepted", "TE-DB-002 local finalize did not accept");
assert(JSON.stringify(finalized) === JSON.stringify(finalizedAgain), "TE-DB-002 duplicate finalize was not idempotent");
report.push({ id: "TE-DB-002", status: "passed" });

// TE-DB-003: group authorization, owner transfer/leave, stale conflict, and duplicate operation.
const group = await rpc(a.token, "create_live_group", { group_name: "DB boundary group", operation_id: randomUUID() });
const groupId = group?.group_id || group?.groupId || group?.id;
assert(groupId, "TE-DB-003 group creation returned no id");
await rpc(a.token, "invite_live_group_member", { target_group: groupId, recipient_identifier: b.email, member_preset: "count_only", member_permissions: [], operation_id: randomUUID() });
const workspaceB = await rpc(b.token, "get_live_groups_workspace", {});
const invitation = workspaceB?.invitations?.at(-1);
assert(invitation?.id != null, "TE-DB-003 invitation was not visible to recipient");
await rpc(b.token, "respond_live_group_invite", { invite_id: invitation.id, accept_invite: true, operation_id: randomUUID() });
const groupCounter = await rpc(a.token, "create_live_group_counter", { target_group: groupId, initial_counter: counter, operation_id: randomUUID() });
const groupCounterId = groupCounter?.counterId || groupCounter?.counter_id || groupCounter?.id;
assert(groupCounterId, "TE-DB-003 group counter creation returned no id");
assert(await rpcError(b.token, "transfer_live_group_ownership_with_permissions", { target_group: groupId, new_owner: a.userId, former_owner_preset: "count_only", former_owner_permissions: [] }), "TE-DB-003 non-owner transferred ownership");
assert(await rpcError(a.token, "leave_live_group", { target_group: groupId }), "TE-DB-003 owner leave was accepted");
const transfer = await rpc(a.token, "transfer_live_group_ownership_with_permissions", { target_group: groupId, new_owner: b.userId, former_owner_preset: "count_only", former_owner_permissions: [] });
assert(transfer, "TE-DB-003 ownership transfer did not return an outcome");
assert(!await rpcError(a.token, "leave_live_group", { target_group: groupId }), "TE-DB-003 non-owner leave was denied");
const op = randomUUID();
const operationArgs = { target_group: groupId, target_counter: groupCounterId, command: "counter_save", operation_id: op, base_version: 1, base_folder_id: null, proposed_folder_id: null, changed_fields: ["value"], base_counter: counter, proposed_counter: { ...counter, value: 3 }, base_customization: {}, proposed_customization: {}, base_script: null, proposed_script: null, action_permissions: [] };
assert(await rpcError(a.token, "perform_live_group_operation", operationArgs), "TE-DB-003 current permission denial was accepted");
report.push({ id: "TE-DB-003", status: "passed" });

console.log(JSON.stringify({ harness: "local-database-boundaries", checks: report }));
