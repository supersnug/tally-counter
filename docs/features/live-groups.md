# Live Groups

## Purpose

Live Groups let signed-in users collaborate on counters that are owned by a group, remain separate from every member's personal workspace, and update for authorized active members. Ownership, membership, permissions, shared-script authority, concurrency, and destructive actions have explicit boundaries.

## User Outcomes

- A user can create and own multiple groups, invite existing users, and deliberately select an active group.
- Invitees can accept or decline invitations and can independently disable future group invitations.
- Owners can administer membership, ownership, permissions, folders, counters, and group deletion.
- Members can understand and exercise only their effective permissions, leave safely, and see authorized changes without a full reload.
- Concurrent counting preserves every accepted add or subtract exactly once, while stale non-counting edits never silently overwrite newer work.
- Authorized members can edit and invoke shared scripts without turning those scripts into unattended server automation or receiving broader direct-interface rights.

## Scope

- Group creation, ownership transfer, deletion, and active-group selection.
- Invitations, acceptance, decline, invitation preference, member removal, and member departure.
- Group-owned counters, nested folders, linked scripts, per-counter customization, and group activity.
- Permission presets and granular custom permissions.
- Realtime visibility, operation idempotency, concurrent counting, and stale-edit handling.
- Shared TallyScript and JavaScript authorization and browser execution.
- Independent snapshot embeds made from visible group counters.

## Out of Scope

- Storing group counters in personal counter data, personal synchronization, personal Trash, or personal backups.
- Counter Copy transfer behavior.
- Live synchronized public embeds.
- Server-hosted unattended scripts.
- Granting group permissions through interface visibility alone.
- Allowing an owner to leave a group without first transferring ownership or deleting the group.

## Domain and Data Boundaries

### Group and Ownership

A group is the owner of its shared workspace. Exactly one signed-in member is the group owner at a time. The owner has full administrative and counter access and is responsible for preserving ownership continuity.

Ownership can transition from the current owner to an eligible member through an explicit transfer. Transfer atomically makes the recipient the owner and the former owner a non-owner member with the resulting assigned access. An owner cannot leave or be removed while still owning the group.

### Group Workspace

Group counters, folders, scripts, per-counter Tally Super customization, and group activity are group-owned records. They do not become personal counters, personal synchronization records, Local Counter bundles, personal Activity History, personal Trash, or personal backup content.

A group counter changes for all authorized members. It is not an independent copy. A member's departure or removal ends that member's access but does not move or delete group data and does not alter the member's personal counters.

### Membership and Active Group

Membership grants visibility of a group subject to effective permissions. A user may belong to multiple groups, but actions are always scoped to one deliberately selected active group. Selecting another group changes context; it does not transfer or merge records.

### Group Activity

Group activity is separate from personal Activity History. Each accepted group operation records the actor, action, affected counter when applicable, and time. A rejected or duplicate operation must not be recorded as a second accepted action.

## Detailed Behavior

### Group Lifecycle

1. A signed-in user can create multiple groups and becomes the owner of each created group.
2. The owner can invite an existing user by username or email identity and assign initial access.
3. An invitation can be accepted or declined once. Acceptance creates membership; decline creates none.
4. A user who disables incoming group invitations receives no new invitation. This preference does not end existing memberships and does not change incoming-copy preference.
5. A non-owner member can leave after explicit confirmation.
6. An owner must transfer ownership or permanently delete the group before leaving.
7. The owner can remove a non-owner member without altering either party's personal counters.
8. Group deletion permanently removes the group-owned workspace for every member and requires clear confirmation.
9. Shared-counter deletion is permanent, does not use personal Trash, and requires clear confirmation when initiated from the interface.

### Invitations and Membership States

An invitation transitions from `Pending` to either `Accepted` or `Declined`. A blocked invitation is not pending. Repeated processing of the same invitation must not create duplicate memberships or alter its terminal decision.

A membership is `Active` until the member leaves, is removed, or the group is deleted. Permission changes affect the active membership without creating another membership.

### Shared Folders and Counters

Authorized members can create group counters and create, delete, or move nested shared folders according to effective permissions. Counter and folder operations apply only to the active group. A group counter may be moved within the active group's hierarchy but never silently moved into personal storage or another group.

Authorized changes become visible to other active members without a full page reload. Realtime visibility communicates accepted stored changes; it is not itself proof that a submitted local change succeeded.

### Ownership and Administrative Authority

Only the owner has full group administration, including ownership transfer, member removal, permission assignment, and permanent group deletion. A non-owner's counter permissions, including Full Access, do not grant ownership administration or group deletion.

An actor cannot grant, retain, or delegate authority beyond the actor's own administrative authority. Permission and membership checks occur at the data boundary for every protected operation.

### Permission Presets

Owners can assign these presets:

| Preset | Granted authority |
| --- | --- |
| Full Access | Every group counter, folder, settings, scripting, and Tally Super permission, including shared-counter creation. It does not confer ownership administration or group deletion. |
| Settings Only | Add, subtract, reset, and all listed counter-setting permissions. It grants no folder, scripting, Tally Super, delete, or create-counter permission. |
| Scripts Only | Edit, run, and stop both TallyScript and JavaScript. It grants no other direct counter or folder mutation. |
| Super Only | Change counter name and color and use every listed Tally Super counter-element and quick-setting permission. It grants no other direct counter or folder mutation. |
| Counting Only | Add, subtract, and reset only. |
| Custom | The exact independently selected permissions described below. |

### Custom Permissions

Custom access independently controls:

- shared-counter creation;
- add, subtract, reset, and shared-counter deletion;
- folder creation, folder deletion, and folder or counter movement;
- counter name, starting value, exact current value, positive step, negative step, saved-value jumps, minimum, maximum, goal direction, goal addition, goal removal, and color;
- TallyScript authorization and JavaScript authorization separately;
- each counter element and each quick setting listed under Counter Customization.

Controls reflect effective permissions, but hidden or disabled controls are not an authorization boundary. A request made outside the ordinary interface receives the same checks and is rejected when unauthorized.

### Shared Scripts and Authorization

Each group counter can have one shared script represented as TallyScript or JavaScript source.

- A member needs permission for the script's recorded language to edit, run, or stop it.
- Language permission authorizes that shared script to invoke every operation in the common Tally API against its own group counter.
- Script authority does not grant the invoking member equivalent direct-interface permissions. For example, Scripts Only can run a script that sets a limit while the member still cannot set that limit directly.
- Script source must be loaded and validated as its recorded language and never interpreted as the other language.
- The script executes in the invoking member's browser only while Tally remains open.
- Every published result passes through membership, language authorization, group scope, normalization, hard limits, idempotency, and concurrency handling before acceptance.
- If membership or relevant language permission is revoked, subsequent shared-script operations are rejected and the affected invocation cannot continue publishing authorized changes.
- Starting a script does not create a server job. Reloading, closing, or navigating stops it.
- Runtime CPU, memory, stack, loop, and stop limits remain applicable, and failures preserve the latest valid accepted group state.

### Concurrency and Idempotency

Each submitted shared operation has a stable operation identity within its group. Re-delivery of the same operation returns or recovers its prior result and does not apply it twice.

Add and subtract operations are accepted against the latest stored value so concurrent accepted counts are not lost. Limits still apply: an operation that cannot move beyond a hard limit may be accepted as no value transition only according to ordinary counter rules, and it must not invent movement.

Non-counting mutations use the current authoritative version of the affected record. A stale mutation that changes a field also changed since the submitted base version, or whose result depends on stale field state, is rejected with refreshed authoritative state. A stale mutation may be reconciled only when every field it changes is unchanged from the submitted base and the operation can be applied without overwriting another accepted field change; the response explicitly identifies the reconciled authoritative version. Neither path silently replaces a newer edit.

Permission, membership, deletion, and ownership changes are evaluated against current authoritative state. A stale client view cannot preserve revoked authority.

### Realtime and Activity

Accepted changes are delivered to other active members without requiring a full reload. Clients reconcile notifications by record and operation identity so duplicate or out-of-order delivery does not duplicate effects or regress newer state.

Group activity records the accepted actor and operation. Script effects identify the invoking member as actor. Activity visibility follows group membership and does not enter personal analytics or personal Activity History.

### Group Counter Embeds

A member who can view a group counter can create an independent snapshot embed. Snapshot creation grants no group access. Embed interactions do not persist, do not update the group counter, and do not become group activity.

## Validation and Normalization

- Trim invitation identifiers and resolve them to an existing account; reject empty, nonexistent, already-active, or otherwise invalid targets without creating duplicate membership.
- Validate that an ownership-transfer recipient is an eligible active member and that exactly one owner remains after transfer.
- Validate every preset or custom permission against the complete known permission set. Unknown permissions grant no authority.
- Validate every operation's group, actor membership, effective permission, target record, operation identity, and expected version where required.
- Apply ordinary counter normalization to direct and script-published changes: finite numeric values, positive step magnitudes, ordered limits, clamped current and starting values, unique numeric goals, valid goal direction, valid colors, and supported customization properties.
- Reject malformed group, membership, permission, counter, folder, activity, or script records without treating malformed fields as authorization.
- Validate script source under its recorded language and retain it in a stopped state after loading.

## Failure and Recovery

- Invitation, membership, ownership, permission, counter, folder, script, and deletion failures produce visible, action-specific states and a safe next action.
- A realtime disconnection never implies success. An unconfirmed operation is shown as pending or failed until authoritative state resolves it.
- On reconnection, the active group refreshes authoritative membership, permissions, records, versions, and operation outcomes before uncertain changes are retried.
- Retrying an operation with the same operation identity cannot apply it more than once.
- Unauthorized operations are rejected without partial mutation.
- A stale edit returns refreshed or explicitly reconciled state rather than reporting false success.
- A failed ownership transfer leaves the original owner in place.
- A failed group or counter deletion does not present the record as permanently deleted.
- Malformed group data is isolated behind a recoverable error and does not prevent unrelated local personal counting or other valid groups from opening.
- Optional online failure never disables local personal counters.

## Integrations and Dependencies

- Accounts and authentication establish owner, inviter, invitee, member, and actor identity.
- Group storage and live delivery maintain shared records separately from personal synchronization.
- Core counter rules provide value, step, limit, goal, reset, jump, name, and color behavior.
- Tally Super defines element and quick-setting permissions for group counters.
- TallyScript, JavaScript, and the common Tally API define shared-script capabilities and runtime limits.
- Embed behavior supplies independent snapshots for visible group counters.
- Sharing preferences keep group invitations independent from incoming Counter Copies.

## Privacy and Security

- Group records enforce current membership and effective permissions at the data boundary, not only in controls.
- Owners can administer only groups they own. Members can read or mutate only groups and records for which current membership and permission allow the operation.
- Invitation addresses, account data, group names and data, membership, permissions, activity, counter names and values, and scripts are not included in analytics.
- Private authentication and sharing secrets are never exposed through group payloads, public profiles, embeds, or analytics.
- A group snapshot embed exposes only encoded embed details and never group ownership, membership, permissions, activity, scripts, customization source, or account information.
- Shared scripts execute in an isolated browser runtime and can affect only their own group counter through authorized operations.
- Permanent group and shared-counter deletion requires deliberate confirmation and must not be represented as recoverable through personal Trash.

## Accessibility and Responsive Behavior

- Group creation, selection, invitation, membership, permissions, counters, folders, scripts, activity, ownership transfer, and deletion work from 320 CSS pixels through desktop widths.
- All group flows work in the current and previous major releases of Chrome, Edge, Firefox, and Safari, plus current Chrome on Android and Safari on iOS.
- Light and dark themes preserve complete controls, legible contrast, and clear focus indication.
- Controls, permission states, active-group context, live status, conflicts, errors, and confirmations have understandable names and keyboard operation.
- Permission and connection states are communicated textually or semantically and never by color alone.
- Live updates and errors are perceivable without unexpectedly moving keyboard focus.
- Dense permission controls remain operable at 320 CSS pixels without hiding required labels or actions.
- Nonessential live-update and layout motion respects reduced-motion and product animation preferences.

## Acceptance Scenarios

1. **Create and select groups**
   - Given a signed-in user owns one group and belongs to another
   - When the user deliberately selects the second group
   - Then all displayed and submitted shared operations are scoped to that group and no records move between groups or personal storage

2. **Invitation acceptance**
   - Given an owner invites an existing user with assigned access
   - When the invitee accepts
   - Then one active membership is created with that access and repeated acceptance creates no duplicate membership

3. **Invitation preference independence**
   - Given a user disables group invitations but continues accepting counter copies
   - When a group owner invites that user
   - Then no pending group invitation is created, existing memberships remain, and the copy-sharing preference is unchanged

4. **Owner departure guard**
   - Given the current owner has not transferred ownership
   - When the owner attempts to leave
   - Then departure is rejected and the group retains exactly one owner

5. **Ownership transfer**
   - Given an owner selects an eligible active member and confirms transfer
   - When transfer succeeds
   - Then that member becomes the sole owner and the former owner no longer has ownership administration solely by virtue of former ownership

6. **Full Access boundary**
   - Given a non-owner has Full Access
   - When the member creates counters, changes settings, manages folders, runs scripts, or customizes counters
   - Then those operations are permitted, but ownership transfer, member administration, and group deletion remain unavailable and unauthorized

7. **Custom permission enforcement**
   - Given a member has add and goal-add permission but lacks exact-value and goal-remove permission
   - When the member submits all four operation types, including requests outside normal controls
   - Then add and goal addition can succeed and exact-value and goal removal are rejected without partial mutation

8. **Shared-script delegated API authority**
   - Given a Scripts Only member has TallyScript permission and no direct minimum-setting permission
   - When the member runs a TallyScript that sets a minimum
   - Then the authorized script can publish the normalized minimum through a group operation while the member's direct minimum-setting request remains rejected

9. **Language-specific authorization**
   - Given a custom member may use TallyScript but not JavaScript
   - When the member attempts to edit or run the shared JavaScript
   - Then the operation is rejected even if the interface request is manually constructed

10. **Permission revoked during a script**
    - Given an authorized yielding shared script is running in a member's browser
    - When the owner revokes that language permission
    - Then subsequent script operations are rejected, the invocation cannot continue publishing, and its latest valid accepted state remains

11. **Concurrent counts**
    - Given two authorized members concurrently submit distinct add operations
    - When both operations are accepted
    - Then each accepted add affects the authoritative value exactly once and neither count is lost

12. **Duplicate operation delivery**
    - Given one accepted operation is delivered repeatedly because of retry or realtime duplication
    - When clients and shared storage process those deliveries
    - Then the operation has one effect and one accepted activity result

13. **Stale settings edit**
    - Given one member edits a counter setting after another member loaded an older version
    - When the second member submits a stale edit to the same setting
    - Then the stale edit is rejected, the newer edit is not overwritten, and refreshed authoritative state is visible

14. **Non-overlapping stale edit**
    - Given one member changes a counter name after another member loaded an older version
    - When the second member submits a stale color change whose color field is unchanged from that base version
    - Then the color change is reconciled into a new authoritative version, the accepted name remains, and the response identifies the reconciled state

15. **Realtime interruption**
    - Given an authorized member submits an operation as realtime connectivity fails
    - When no authoritative success is known
    - Then the interface does not claim success and recovers the stored result or a retryable failure after refresh

16. **Permanent shared deletion**
    - Given an authorized user initiates shared-counter or group deletion
    - When the user has not confirmed the destructive action
    - Then no deletion occurs; after confirmed successful deletion, the affected group-owned data is not placed in personal Trash

17. **Malformed group data isolation**
    - Given one group contains malformed data
    - When a member opens Tally
    - Then that group presents a recoverable error while personal counting and other valid groups remain usable

18. **Independent group embed**
    - Given a member can view a group counter
    - When the member creates and interacts with a snapshot embed
    - Then the embed grants no group access and its changes do not alter group state or activity

19. **Responsive and accessible groups**
    - Given a keyboard user at 320 CSS pixels in either theme on a supported browser
    - When the user selects a group, reviews permissions, and responds to a conflict or error
    - Then context, controls, status, and recovery actions remain reachable, named, visible, and understandable without color alone

20. **Analytics privacy**
    - Given group analytics are emitted
    - When invitation, membership, permission, operation, script, realtime, or failure events occur
    - Then the events contain no group data, member or account data, counter content, script, permissions payload, or sharing secret

## Sources

- PRD: [Explicit Data Ownership](../product-specification.md#explicit-data-ownership)
- PRD: [Safe Power](../product-specification.md#safe-power)
- PRD: [Group Counter](../product-specification.md#group-counter)
- PRD: [Shared Script Behavior](../product-specification.md#shared-script-behavior)
- PRD: [Live Group Requirements](../product-specification.md#live-group-requirements)
- PRD: [Group Lifecycle](../product-specification.md#group-lifecycle)
- PRD: [Shared Workspace](../product-specification.md#shared-workspace)
- PRD: [Permissions](../product-specification.md#permissions)
- PRD: [Concurrent Changes](../product-specification.md#concurrent-changes)
- PRD: [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- PRD: [Responsive Web Experience](../product-specification.md#responsive-web-experience)
- PRD: [Accessibility](../product-specification.md#accessibility)
- PRD: [Data and Security](../product-specification.md#data-and-security)
- PRD: [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- Guide: [Group sharing](../../src/content/guide/group-sharing.mdx)
- Guide: [Group permissions](../../src/content/guide/group-permissions.mdx)
- Guide: [Sharing choices](../../src/content/guide/sharing.mdx)
- Guide: [Sharing privacy](../../src/content/guide/sharing-privacy.mdx)
- Guide: [Scripting](../../src/content/guide/scripting.mdx)
- Guide: [Tally API](../../src/content/guide/tally-api.mdx)
- Guide: [Embeds](../../src/content/guide/embeds.mdx)
