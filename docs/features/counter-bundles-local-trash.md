# Counter Bundles, Local Counters, and Trash

## Purpose

Define the personal-counter ownership boundary and the rules that keep a counter's linked data together through local-only storage, deletion, retention, restoration, synchronization, transfer, and permanent removal.

## User Outcomes

- A user can understand whether a personal counter can leave the current browser.
- A user can recover a recently deleted counter with its script and per-counter customization intact.
- A user can permanently delete a counter and all data directly linked to it through one deliberate action.
- A signed-in user can keep selected counter bundles off the personal cloud without losing account features for other counters.
- Local-only status and Trash behavior remain distinct and predictable.

## Scope

- The Counter Bundle boundary for personal counters.
- Local Counter designation and cloud exclusion.
- Active, retained-in-Trash, restored, expired, and permanently deleted states.
- Trash and cloud Trash preferences.
- Bundle behavior at synchronization, backup, copy, embed, script, and Tally Super seams.

## Out of Scope

- Group counters, which are group-owned and never use personal Trash.
- Activity History, undo/redo, and session statistics, which are device-local records outside a Counter Bundle.
- Account conflict resolution beyond the bundle-preservation rules defined here.
- Backup file scope and import replacement behavior beyond this feature's bundle boundary.
- Counter Copy recipient and sender workflows beyond bundle transfer choices.
- Embed rendering beyond the rule that an embed is an independent snapshot.

## Domain and Data Boundaries

### Counter Bundle

A Counter Bundle is one atomic ownership and lifecycle unit containing:

- the core personal counter record, including stable identity, values, rules, appearance, folder path, tags, and Local Counter designation;
- zero or one linked script, including its recorded language and source;
- zero or one set of per-counter Tally Super customization data; and
- retained deleted state while the counter is in Trash, including the retention deadline.

Atomicity means that lifecycle and storage-boundary transitions apply to the complete bundle as one operation. A transition must not leave a linked script or per-counter customization orphaned, assign linked data to another counter, or expose only part of a Local Counter bundle to cloud synchronization. Optional transfer features may omit a script or customization only when that transfer explicitly offers those independent inclusion choices; omission creates a destination bundle without the omitted data and does not split or alter the source bundle.

Activity History, undo/redo state, session statistics, workspace-level Tally Super customization, account records, copy-sharing records, and group-owned data are not members of a Counter Bundle.

### Bundle States

A personal Counter Bundle is in exactly one lifecycle state:

- **Active:** visible in the personal workspace and eligible for ordinary organization and use.
- **Retained:** deleted from the active workspace, available in Trash until its five-day retention deadline, and still usable through Trash.
- **Permanently deleted:** removed as a complete bundle and no longer recoverable through Trash.

Local Counter is an independent storage designation on an active or retained bundle. It is not a lifecycle state. A Local Counter bundle remains local regardless of whether Trash is enabled or retained non-local Trash is configured to synchronize.

## Detailed Behavior

### Bundle Atomicity

- Creation establishes one stable counter identity to which the script and per-counter customization are linked.
- Editing the core counter, script, or customization updates the same bundle; it does not create a separate ownership boundary.
- Moving a bundle into Trash retains its core counter, script, customization, Local Counter designation, and deleted-state metadata together.
- Restoration returns that complete retained bundle to active state.
- Permanent deletion and automatic expiration remove the core counter, linked script, linked customization, and retained-state metadata together.
- A failed atomic lifecycle transition leaves the bundle in its prior state. No partial deletion, restoration, localization, or cloud inclusion is permitted.

### Local Counter Designation

- Local Counter can be enabled or disabled for an existing personal counter while the user is signed in and cloud storage is a meaningful choice.
- Enabling Local Counter changes the entire bundle to cloud-ineligible and removes that bundle from the user's personal cloud data.
- Removing a cloud bundle does not erase a stale browser-resident copy on another device. That device must not be represented as having received a remote permanent deletion of its local browser data.
- Disabling Local Counter makes the complete bundle eligible for personal synchronization under the account synchronization rules.
- Signing out does not clear or change Local Counter designation.
- The designation remains stored when its control or banner is hidden.
- Scripts cannot change Local Counter designation.
- A Local Counter bundle never enters a cloud payload, including synchronization upload, synchronized Trash, final script persistence, or account bootstrap and conflict payloads.

### Local Counter Visibility

- While signed in, an active counter's settings expose the Local Counter control and a Local Counter exposes a visible local-only status.
- While signed out, the Local Counter control and signed-in local-only banner are hidden, but the stored designation remains effective and reappears after sign-in.
- For any retained bundle while cloud Trash is disabled, the Local Counter control and local-only banner are hidden because every retained bundle is currently cloud-ineligible. The stored designation remains unchanged.
- For retained Trash while cloud Trash is enabled, a retained Local Counter displays local-only status and a retained non-local counter displays its cloud eligibility; the Local Counter control is available while signed in.
- Hidden controls must not imply that the designation was removed.

### Trash Preferences

- Trash is enabled by default.
- The user can independently configure whether Trash is enabled and, while signed in, whether retained non-local bundles synchronize.
- The cloud Trash preference applies only to retained, non-local bundles. It never overrides Local Counter exclusion.
- Changing the cloud Trash preference affects cloud eligibility for retained non-local bundles without changing their retained lifecycle state or deadline.

### Delete Transitions

With Trash enabled:

1. Deleting an active personal counter atomically changes its bundle to retained state.
2. The retention deadline is five days after the accepted deletion.
3. The bundle is removed from the active workspace and appears in Trash with remaining time.
4. A non-local retained bundle is cloud-eligible only when cloud Trash is enabled.
5. A Local Counter retained bundle remains browser-only in all cases.

With Trash disabled:

1. Deleting an active personal counter opens a permanent-deletion confirmation.
2. Cancellation leaves the complete bundle active and unchanged.
3. Confirmation atomically changes the complete bundle to permanently deleted.

### Retained Bundle Behavior

- Trash communicates the remaining retention time, using progressively useful units from days and hours through seconds as expiration approaches.
- During retention, the user can count, reset, edit, run or stop the linked script, create an embed snapshot, restore, or permanently delete the bundle.
- Counter normalization and hard limits apply to value changes made while retained. Accepted retained-counter transitions enter personal Activity History, but a retained counter is not an active personal counter, so those transitions create no session-statistic action and are unavailable to undo/redo until restoration.
- An embed made from a retained bundle is an independent snapshot and does not keep access to the retained bundle.
- Retention does not pause because the user is signed out, offline, or not viewing Trash.

### Restore Transition

1. Restore targets the complete retained bundle.
2. If its stable identity does not collide with an active personal counter, the bundle returns to active state with that identity.
3. If its identity collides, restoration assigns the restored bundle a new stable identity and preserves the active bundle unchanged.
4. Linked script and per-counter customization follow the restored identity.
5. Device-local Activity History keeps its immutable recorded event identity, while the retained bundle's association resolves those entries to the restored identity; entries associated with the colliding active counter remain associated with that active counter.
6. The restored bundle retains its Local Counter designation.
7. Successful restoration removes its retained-state metadata and returns it to the personal workspace without overwriting another counter.

### Permanent Deletion and Expiration

- Permanent deletion from Trash requires explicit confirmation.
- Cancellation leaves the retained bundle and deadline unchanged.
- Confirmation atomically removes the complete bundle.
- At or after the retention deadline, automatic expiration atomically removes the complete bundle without a second confirmation.
- Permanent deletion and automatic expiration are irreversible through Trash.
- A synchronized permanent deletion or expiration may remove the cloud copy of an eligible bundle but must not claim to erase stale browser data on an offline or unauthorized device.

### Feature Seams

- **Personal synchronization:** only complete non-local bundles are eligible. Retained non-local bundles additionally require cloud Trash to be enabled.
- **Backup and restore:** active Local Counter bundles are eligible for deliberate portable backup transfer. All Tally Data also includes retained bundles. The Local Counter designation travels as counter data.
- **Counter Copy:** an accepted copy is a new independent bundle. Script and customization can be omitted by explicit sender or recipient choice, and the recipient chooses the destination's Local Counter designation.
- **Scripts:** the linked script belongs to the bundle, can operate while the bundle is retained, cannot change Local Counter status, and is removed with permanent deletion.
- **Tally Super:** per-counter customization follows the bundle through Local Counter conversion, Trash, restoration, synchronization eligibility, and permanent deletion. Workspace customization remains outside the bundle.
- **Embeds:** publishing creates an independent snapshot and transfers no ownership, script, customization source, organization, Local Counter status, or live relationship.
- **Folders:** deleting a folder does not delete bundles; active counters move to the deleted folder's parent.
- **Activity records:** bundle deletion does not redefine Activity History, undo/redo, or statistics as bundle members.

## Validation and Normalization

- Every bundle must have one valid stable counter identity and at most one linked script and one per-counter customization record.
- Linked data must reference the bundle's current stable identity, including after collision-safe restoration.
- Retained-state association metadata must distinguish the retained bundle's Activity History from any colliding active counter so restoration can update only the retained bundle's current association without rewriting recorded event identity.
- A retained bundle must have a valid deletion time and a deadline exactly five days later.
- Remaining time must never be displayed as negative; a reached deadline triggers or reflects expiration.
- A malformed or missing optional script or customization section must not make valid core counter data appear to have been permanently deleted. The condition must enter recoverable error handling before a destructive transition.
- Core counter values restored from retained storage remain subject to counter numeric normalization and hard limits.
- Local Counter exclusion is evaluated before cloud Trash eligibility; no preference combination may make a Local Counter cloud-eligible.

## Failure and Recovery

- A failed move to Trash leaves the bundle active and reports that deletion did not complete.
- A failed restoration leaves the bundle retained with its deadline and linked data intact.
- A failed permanent deletion leaves the bundle retained or active, according to its prior state, and reports that deletion did not complete.
- A failed Local Counter conversion leaves the prior designation and cloud eligibility visible; it must not report completion for only one side of the transition.
- Offline or cloud failures do not prevent local counting, local Trash use, or Local Counter use.
- A cloud error leaves the browser bundle usable and must not silently remove it.
- Malformed browser data falls back to a recoverable application state without treating unreadable data as user-confirmed permanent deletion.
- The product must not promise that browser persistence or a final network write prevents every possible data-loss event. Users can make portable backups before permanent deletion or device transfer.

## Integrations and Dependencies

- Core counter identity, limits, normalization, folders, and tags define the core record inside the bundle.
- Personal synchronization consumes the eligibility rules and atomic bundle boundary defined here.
- Backup and restore consume the bundle boundary and can deliberately move Local Counter data between devices.
- The scripting runtime supplies the linked script lifecycle and must preserve stopped/running safety rules.
- Tally Super supplies per-counter customization linked to the stable identity.
- Counter Copy sharing consumes an independent snapshot of selected bundle sections.
- Embed publishing consumes only an allowed counter snapshot, not the bundle itself.

## Privacy and Security

- No part of a Local Counter bundle may be uploaded to personal cloud storage, analytics, sharing, or another online feature without a separate deliberate transfer action whose result is not personal synchronization.
- Personal cloud records for eligible bundles must enforce account ownership.
- Permanent deletion requires a perceivable confirmation that identifies the complete linked bundle as the deletion target.
- Analytics must not contain counter names, values, scripts, Local Counter content, or per-counter customization content.
- Backup files containing Local Counter bundles are personal data and must be described as intentional portable copies, not as cloud synchronization.

## Accessibility and Responsive Behavior

- Local-only, retained, expiring, cloud-eligible, and permanently deleting states must have textual or semantic meaning and must not rely on color alone.
- Delete, restore, script, embed, and permanent-delete controls must have understandable accessible names and keyboard operation.
- Confirmation dialogs must manage focus, identify the affected counter, expose cancel and confirm actions, and return focus predictably.
- Retention time must be available to assistive technology and remain understandable as its unit changes.
- Trash, recovery, Local Counter settings, and confirmations must work from 320 CSS pixels through desktop widths in light and dark themes.
- Required actions must remain reachable when per-counter customization changes layout.

## Acceptance Scenarios

1. **Given** Trash is enabled and an active counter has a linked script and per-counter customization, **When** the user deletes it, **Then** the complete bundle enters Trash with one five-day deadline and no linked data remains active or orphaned.
2. **Given** a retained bundle has not expired, **When** the user changes its value and runs its script, **Then** accepted changes follow ordinary normalization and remain attached to that retained bundle.
3. **Given** a retained bundle is changed while in Trash, **When** the value transition is accepted, **Then** its retained value and personal Activity History are updated but no undo/redo candidate or session-statistic action is created while it remains retained.
4. **Given** a retained bundle has the same stable identity as an active counter, **When** the user restores it, **Then** the restored bundle receives a distinguishable stable identity, its immutable history facts resolve through the retained bundle association, and neither bundle nor the active counter's history is overwritten.
5. **Given** a retained bundle reaches its deadline, **When** expiration is applied, **Then** its core record, script, customization, and retained-state metadata are removed atomically.
6. **Given** Trash is disabled, **When** the user requests deletion and cancels the confirmation, **Then** the complete bundle remains active and unchanged.
7. **Given** Trash is disabled, **When** the user confirms deletion, **Then** the complete bundle is permanently removed without entering Trash.
8. **Given** a signed-in user enables Local Counter on a non-local bundle, **When** the transition succeeds, **Then** the complete bundle remains in the browser and is excluded from subsequent cloud payloads.
9. **Given** another device has a stale browser copy, **When** a bundle is made local on the current device, **Then** the cloud copy is removed without claiming to erase the other device's browser copy.
10. **Given** a Local Counter is deleted while cloud Trash is enabled, **When** it enters Trash, **Then** the complete retained bundle remains local and no part enters a cloud payload.
11. **Given** a retained non-local bundle and cloud Trash is disabled, **When** synchronization runs, **Then** that bundle is excluded while active non-local bundles remain eligible.
12. **Given** Local Counter status controls are hidden after sign-out, **When** the workspace is reopened, **Then** the stored designation remains effective and the bundle remains excluded upon later sign-in.
13. **Given** cloud Trash is disabled, **When** a signed-in user views any retained bundle, **Then** Local Counter controls and banners are hidden without changing the stored designation; when cloud Trash is enabled, retained local-only and cloud-eligible status becomes visible.
14. **Given** a restoration persistence operation fails, **When** the failure is reported, **Then** the bundle remains retained with its original deadline and complete linked data.
15. **Given** an active Local Counter is selected for a portable counter backup, **When** the export succeeds, **Then** the selected bundle data is included according to the chosen backup options without enabling cloud synchronization.
16. **Given** a retained bundle is embedded and later permanently deleted, **When** the embed is used, **Then** it remains an independent non-persisted snapshot and has no access to the deleted source.

## Sources

- [PRD: Domain Vocabulary - Local Counter](../product-specification.md#local-counter)
- [PRD: Domain Vocabulary - Counter Bundle](../product-specification.md#counter-bundle)
- [PRD: Personal Workspace Requirements - Trash](../product-specification.md#trash)
- [PRD: Accounts and Personal Synchronization - Synchronization Boundary](../product-specification.md#synchronization-boundary)
- [PRD: Tally Super Requirements - Counter Customization](../product-specification.md#counter-customization)
- [PRD: Automation Requirements - Runtime Behavior](../product-specification.md#runtime-behavior)
- [PRD: Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [Counters guide](../../src/content/guide/counters.mdx)
- [Trash guide](../../src/content/guide/trash.mdx)
- [Trash and Local Counters guide](../../src/content/guide/trash-local.mdx)
- [Local Counters guide](../../src/content/guide/local-counters.mdx)
- [Trash and Local Counters tutorial](../../src/content/guide/tutorial-trash-local.mdx)
- [Tally Super data guide](../../src/content/guide/tally-super-data.mdx)
- [Scripting guide](../../src/content/guide/scripting.mdx)
