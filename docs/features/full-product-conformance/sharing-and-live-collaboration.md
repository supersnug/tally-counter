# Sharing and Live Collaboration

## Purpose

Close the report findings that let client-supplied Counter Copy data cross trust boundaries, separate request acceptance from bundle creation, leave group ownership unsafe, or make group editing, scripts, quick settings, permissions, and retry behavior incomplete.

## Existing Feature Sources

- [Counter Copy Sharing](../counter-copy-sharing.md)
- [Live Groups](../live-groups.md)
- [Accounts and Personal Synchronization](../accounts-and-personal-sync.md)
- [Core Counter Engine](../core-counter-engine.md)
- [Automation Runtime](../automation-runtime.md)
- [Tally Super](../tally-super.md)
- [Snapshot Embeds](../snapshot-embeds.md)
- [Experience, Security, and Verification](../experience-security-verification.md)

## Shared Contract

Account identity enables addressing but never substitutes for source ownership, recipient authority, group membership, or effective permission. Copy and group operations validate current authoritative records, use stable operation identities, commit their complete user-level outcome atomically, and never report uncertain or partial work as success.

## Findings and Required Behavior

### GAP-004 Account Deletion and Group Ownership

**Current evidence:** Account deletion accepts an existing session and typed `DELETE` without fresh reauthentication; group ownership cascades with profile deletion and has no transfer workflow. See `src/features/auth/AuthModal.tsx:419-433`, `835-875`, `supabase/functions/delete-account/index.ts:12-31`, and `supabase/migrations/20260802172745_shared_counter_groups.sql:6-15`.

**Required behavior:** Account deletion requires deliberate confirmation and reauthentication appropriate to session age and credential type. Before deletion, every owned group must be explicitly transferred to an eligible member or deliberately deleted through the group lifecycle. Database constraints and deletion service prevent account deletion from cascading an attended group merely because its profile disappears. Browser personal data remains available after successful account deletion.

**Acceptance:** A stale or stolen session cannot delete the account; an owner with any unresolved group is blocked with actionable choices; transfer preserves all group data and memberships; deliberate group deletion remains separately confirmed.

### GAP-010 Trusted Counter Copy Projection

**Current evidence:** The browser submits a complete counter object; the server authenticates the sender but does not verify source ownership or exact core fields. See `src/pages/CountersPage.tsx:1390-1408`, `src/features/sharing/CopySharing.tsx:90-109`, and `supabase.sql:372-446`.

**Required behavior:** The send boundary identifies a sender-owned active personal source, reads or verifies it authoritatively, and constructs an allowlisted snapshot containing only name, current/start values, positive/negative steps, limits, goals, direction, and color. Source identity, folder, tags, Local status, Trash metadata, ownership, and unknown fields never transfer. Optional script and customization are included only from linked sender-owned records and remain independently selectable.

**Acceptance:** Forged source identity, foreign source, malformed JSON, extra fields, and mismatched linked records are rejected without a pending request; a valid recipient sees no sender organization or Local status.

### GAP-011 Idempotent Atomic Copy Acceptance

**Current evidence:** The server marks a request accepted before the browser separately creates core, script, and customization state. See `src/pages/CountersPage.tsx:991-1015`, `src/features/sharing/CopySharing.tsx:113-124`, and `supabase.sql:156-170`.

**Required behavior:** One retry-safe acceptance operation verifies the pending recipient role and choices, transitions the request once, allocates one new personal identity, and creates exactly one complete recipient bundle or leaves the request pending. Included scripts are stopped. Recipient Local status and omit/include choices apply within the same operation. A repeated operation identity returns the original result without duplication.

**Acceptance:** Failure injected at every boundary creates neither accepted-without-counter nor partial bundle; uncertain response and retry return the same one bundle; concurrent acceptance attempts cannot duplicate it.

### GAP-019 Shared Script Execution

**Current evidence:** Group editors expose script editing without Run/Stop handlers, and the editor can report success with no run callback. See `src/features/groups/SharedGroups.tsx:174-184` and `src/features/scripting/TallyScriptEditor.tsx:15-29`.

**Required behavior:** A member with effective permission for the recorded language can explicitly run and stop that shared script in the browser. Run cannot report success without starting an execution. Every published Tally API operation passes through current group membership, language authority, normalization, operation identity, version/concurrency, and activity boundaries. Permission revocation or membership loss prevents subsequent publication and stops with a visible error.

**Acceptance:** TallyScript and JavaScript run, yield, stop, hit resource limits, encounter revocation, and retry operations without bypassing group authorization or creating unattended server work. This also closes SPEC-003.

### GAP-020 Complete Group Lifecycle and Permissions

**Current evidence:** Ownership transfer is absent; self-removal lacks confirmed UI; Custom cannot grant counter creation; Settings Only receives folder movement. See `src/features/groups/useSharedGroups.ts:112-123`, `src/features/groups/permissions.ts:1-61`, `supabase/migrations/20260802172745_shared_counter_groups.sql:285-324`, and `supabase/migrations/20260802215607_shared_counter_folders.sql:102-108`.

**Required behavior:** Owners atomically transfer ownership to eligible members and cannot leave while owner. Non-owners leave after confirmation. Custom independently controls shared-counter creation. Full Access includes creation; Settings Only has listed counting/settings rights but no folder, script, Super, delete, or creation rights; Scripts Only and Super Only match their exact contracts. UI reflects but never replaces data-boundary enforcement.

**Acceptance:** Every preset and representative custom combination is enforced identically in UI, RPC, stale client, script, and constructed-request paths; transfer and leave preserve group continuity; no user becomes trapped or leaves ownership unattended.

### GAP-021 Authoritative Group Editor Saves

**Current evidence:** Editing replaces `editing.counter_data`, then Save compares the submitted draft against itself, producing no actions. See `src/features/groups/SharedGroups.tsx:90-111` and `174-184`.

**Required behavior:** Editing retains an immutable authoritative base/version and a separate draft. Save validates all changed fields against effective permissions and normalized counter rules, then submits one coherent versioned user-level operation or explicit atomic operation set. Success reflects confirmed authoritative state; rejection retains the draft and explains refresh, conflict, or permission recovery.

**Acceptance:** Every editable setting persists when authorized, unauthorized fields do not partially apply, no-change save is identified, stale overlap is explicit, and a multi-field save cannot falsely succeed or expose a half-applied record. This also closes SPEC-002.

### GAP-022 Retry-Safe Group Concurrency

**Current evidence:** Backend event IDs and locking exist, but the client creates a new ID on each call; stale non-overlapping edits reject; multi-field saves split; realtime/error status is incomplete. See `src/features/groups/useSharedGroups.ts:77-90`, `124-136`, `src/features/groups/SharedGroups.tsx:90-186`, and `supabase/migrations/20260802223315_shared_counter_activity_events.sql:88-141`.

**Required behavior:** A user action allocates one stable operation identity retained through retry. Duplicate delivery returns the prior result. Counts serialize without loss; coherent saves commit atomically; non-overlapping stale edits reconcile where safely possible; overlapping edits reject with authoritative refresh and retained draft. Realtime connectivity, pending, confirmed, rejected, and uncertain states remain visible.

**Acceptance:** Duplicate, reordered, delayed, disconnected, timed-out, and concurrent operations produce exactly-once accepted activity, preserve every accepted count, reconcile non-overlap, expose overlap, and never imply success from realtime disconnection.

### GAP-033 Authorized Group Quick Settings

**Current evidence:** Shared cards have no `onPatch` while quick settings call that optional handler. See `src/features/groups/SharedGroups.tsx:158-170` and `src/features/counters/CounterCard.tsx:119-155`.

**Required behavior:** Visible group quick settings submit the corresponding authorized, normalized, versioned group operation for positive step, negative step, minimum, maximum, color, and goal direction. Each control requires its exact setting or Super quick-setting authority, shows pending/error/confirmed state, and never mutates an optimistic value into authority after rejection.

**Acceptance:** Each quick setting works for owners and specifically authorized Custom/Super users, remains unavailable or rejects for others, obeys limits and normalization, records group activity where applicable, and recovers from stale/disconnected state.

## Combined Acceptance

Two accounts send and accept a projected Counter Copy under uncertain delivery and receive exactly one independent stopped bundle. They create a group, invite members under every preset and custom creation choice, edit multi-field settings, count concurrently, use quick settings, run both shared languages, lose and regain connectivity, transfer ownership, leave, and finally delete the group. Every accepted operation occurs once, every rejected action leaves authoritative state intact, and account deletion cannot bypass group continuity.

## Sources

- [PRD: Counter Copy Sharing Requirements](../../product-specification.md#counter-copy-sharing-requirements)
- [PRD: Live Group Requirements](../../product-specification.md#live-group-requirements)
- [PRD: Account Lifecycle](../../product-specification.md#account-lifecycle)
- Target-to-Codebase Gap Report findings 4, 10, 11, 19, 20, 21, 22, and 33
- Code-Problems Report SPEC-002 and SPEC-003
