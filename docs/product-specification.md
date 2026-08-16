# Tally Product Specification

## Document Status

The product definition and this document were approved on August 16, 2026.

## Product Summary

Tally is a free, open-source, local-first web workspace for counting anything. It provides immediate account-free counting and progressively reveals organization, goals, history, customization, automation, publishing, cloud continuity, and live collaboration as users need them.

Tally treats a counter as user-owned working data rather than a disposable number. A counter may remain private to one browser, synchronize across a user's devices, be transferred as an independent copy, appear as an independently interactive embed, or belong to a live shared group. These modes have explicit boundaries so that users can understand where data lives and who can change it.

## Problem

Simple tally tools become inadequate when a counting workflow needs custom increments, limits, milestones, recovery, organization, automation, visual adaptation, or collaboration. More capable tools often impose an account, network dependency, subscription, or complexity before a user can make the first count.

Tally must let a user begin counting immediately while allowing the same workspace to grow into a more capable system without requiring a different product or surrendering control of the data.

## Users

Tally serves a progressive, multi-audience user base:

- Everyday counter users track habits, exercise, inventory, scores, capacity, ideas, and other quantities.
- Organized workspace users manage many counters with folders, tags, search, history, and backups.
- Power users automate counter workflows with TallyScript or JavaScript and adapt the interface with Tally Super.
- Collaborators exchange independent counter copies or maintain live group-owned counters with explicit permissions.
- Publishers place independently interactive counter snapshots on websites.

No audience must adopt the capabilities intended for another audience. Advanced features must not obstruct basic account-free counting.

## Product Principles

### Local First

Personal counting works without registration or a configured online service. The browser saves personal data automatically and remains a usable source of the user's data when authentication or synchronization is unavailable.

### Progressive Capability

The shortest path through Tally is creating and changing a counter. Accounts, sharing, groups, scripting, embeds, and deep customization are optional extensions of that core workflow.

### Explicit Data Ownership

The product distinguishes device-local personal data, synchronized personal data, transferred copies, embedded snapshots, and live group-owned data. It must not imply synchronization or privacy boundaries that it does not enforce.

### Portable by Default

Users can export and restore a complete personal workspace without an account. Data-changing imports are validated and deliberate.

### Safe Power

Automation and collaboration are capable but bounded. Script runtimes protect the page from runaway work, and group permissions are enforced at the data boundary rather than only represented in the interface.

### Free and Open Source

Tally has no subscription, paid plan, premium entitlement, or feature gate. Tally Super is the name of a customization capability, not a commercial tier.

## Goals

- Make a useful counter available immediately without an account or network connection.
- Support flexible counting rules and meaningful progress without making ordinary counting complicated.
- Preserve personal data locally and make optional cloud behavior understandable and recoverable.
- Give users practical recovery, activity, organization, and transfer tools for long-lived workspaces.
- Support approachable and advanced automation without allowing uninterrupted scripts to make the application unusable.
- Support both independent sharing and live collaboration without confusing copies with shared state.
- Let users adapt counters and workspace presentation without restricting customization behind payment.
- Provide understandable behavior across desktop and mobile web, light and dark themes, and common failure states.

## Non-Goals

- Native mobile or desktop applications.
- Paid plans, subscriptions, trials, or premium entitlements.
- Mandatory accounts for personal counting.
- Server-hosted unattended automation.
- Live synchronized public embeds.
- Cloud synchronization of personal activity history, undo/redo state, or session statistics.
- Combining group-owned counters with personal counter storage.
- Guaranteeing suitability for safety-critical, regulated, financial, medical, or other high-stakes records.

## Domain Vocabulary

### Counter

A named personal or group-owned counting record with a current value, starting value, positive and negative steps, optional limits, optional goals, a goal direction, a color, and organizational metadata where supported.

### Personal Counter

A counter owned by one user's personal workspace. It may be device-local or synchronized when the user is signed in.

### Local Counter

A personal counter whose entire counter bundle remains on the current device even while its user is signed in. The bundle includes the core counter, script, per-counter Tally Super customization, and retained deleted state.

### Counter Bundle

The core counter record and its directly linked script, per-counter customization, and retained deleted state.

### Counter Copy

An independent snapshot transferred to another account. Accepting a copy creates a new personal counter with no ongoing relationship to the sender's counter.

### Counter Backup

A portable file containing selected active personal counters, their folder and tag metadata, and optionally their linked scripts and per-counter Tally Super customizations. A Counter Backup is distinct from account-to-account Counter Copy sharing.

### Group Counter

A live counter owned by a group. It is stored separately from every member's personal counters and changes for all authorized members.

### Embedded Counter

An independently interactive snapshot encoded for display outside the workspace. It does not read from or write to its source counter after publication.

### Activity History

The device-local record of personal counter value changes used for history views, charts, undo/redo, and statistics. Group activity is a separate group-owned record.

### Tally Super

The free capability for customizing the counter elements, workspace content, and layouts enumerated in this specification.

## Core Counter Requirements

### Counter Lifecycle

- A user can create, view, edit, and delete any number of personal counters.
- A new workspace may be empty; users are not required to retain sample counters.
- Each counter has a stable identity independent of its name.
- A blank name is normalized to a clear untitled label rather than blocking creation.
- A user can reset a counter to its configured starting value.
- A user can jump directly to a saved start, goal, minimum, or maximum where that destination exists.
- Counter changes are saved automatically in the browser.

### Values and Steps

- A counter supports positive, zero, and negative values.
- Positive and negative controls have independently configurable positive step magnitudes.
- Users can set the current value and starting value exactly when the requested value is within configured limits; an out-of-range request is clamped to the nearest limit.
- Invalid numeric input must not produce a non-finite counter value.
- Resetting is a value change and participates in activity history.

### Limits

- A counter may have no limits, a minimum only, a maximum only, or both limits.
- Minimum and maximum are hard constraints on the current and starting values.
- Counting, direct value entry, reset, jumps, imports, changed limits, and script results clamp current and starting values to the nearest configured limit.
- If entered limits are reversed, Tally normalizes them into ascending minimum and maximum order.
- When changed limits clamp the current value, that current-value change participates in Activity History.
- Reaching a limit disables further movement past that limit while preserving movement away from it.

### Goals and Progress

- A counter may have multiple unique numeric goals.
- Goal direction is either More Than or Less Than.
- More Than goals progress from the lowest goal to the highest goal.
- Less Than goals progress from the highest goal to the lowest goal.
- A More Than goal is complete when the current value is greater than or equal to the goal; a Less Than goal is complete when the current value is less than or equal to the goal.
- Progress indicates completed milestones and movement toward the next goal.
- The next incomplete goal determines the active segment. Progress through that segment is measured from the starting value or previous milestone to the next milestone and is clamped from zero to 100 percent.
- A previous milestone is the segment anchor when one exists. Before the first milestone, the starting value is the anchor only when it lies on the incomplete side of that milestone; otherwise, an available hard limit on the incomplete side is the anchor. If neither anchor is valid, progress before that milestone is zero percent and progress at completion is 100 percent.
- Progress details communicate progress toward the final goal and configured maximum where applicable.
- Reaching the final goal marks the counter complete but does not prevent further counting.
- Once all goals are complete, milestone progress displays complete even if counting continues beyond the final goal.
- Only minimum and maximum limits stop value movement.

### Appearance and Metadata

- Each counter has a preset or custom color.
- Personal counters may have one folder path and multiple unique tags.
- Counter cards expose the value and primary counting actions without requiring the editor to be open.
- Optional bounds and progress information remain understandable in light and dark themes.

## Personal Workspace Requirements

### Organization

- Users can create nested personal folders, including empty folders.
- Users can move counters between folders and move folders within the hierarchy.
- Deleting a folder does not delete its counters; affected counters move to the deleted folder's parent.
- Users can search personal counters by name, folder, or tag.
- Users can filter personal counters by tag.
- Search and filter states clearly distinguish no matches from an empty folder.

### History and Undo

- Personal value changes record the counter, previous value, resulting value, action kind, and time.
- Users can view recent activity and a per-counter value-over-time representation.
- Users can undo and redo eligible personal value changes globally or for a selected counter.
- A new non-redo value change clears the redo path it supersedes.
- Deleting activity history is distinct from resetting statistics.
- Personal history and undo/redo remain device-local and are not cloud-synchronized.

### Statistics

- Session statistics include action count, net movement, total distance, most active counter, increments, decrements, and resets.
- An eligible action is an accepted current-value transition for an active personal counter during the current page session, including direct interaction, a jump, undo/redo, or a script-published transition. Loading or importing a replacement workspace does not create an action.
- Action count is the number of eligible actions; net movement is the sum of each resulting value minus its previous value; total distance is the sum of the absolute value of each transition.
- Increments and decrements count explicit positive and negative counter-control actions, not the sign of a direct value change. Resets count accepted reset actions.
- An action that leaves the value unchanged, including reset at the starting value or a count blocked by a hard limit, does not enter Activity History or statistics.
- Most active identifies the counter with the greatest number of eligible actions in the statistic's current baseline.
- Active-counter and completed-goal counts may also appear in the workspace or as Tally Super content.
- Users can reset one displayed statistic or all displayed statistics to a new baseline.
- Resetting statistics does not change counter values, delete Activity History, or remove undo/redo data.
- Session statistic baselines do not need to persist across a page session.

### Trash

- Trash is enabled by default and can be disabled.
- With Trash enabled, deleting a personal counter retains it for five days.
- The remaining retention time is visible.
- During retention, a trashed counter can be counted, reset, edited, scripted, embedded, restored, or permanently deleted.
- Restoring returns the counter bundle to the personal workspace and resolves identity collisions without overwriting another counter.
- Permanent deletion requires confirmation and removes the complete linked counter bundle.
- Automatic expiration also removes the complete linked counter bundle.
- With Trash disabled, deleting a counter requires permanent-deletion confirmation and removes the complete linked counter bundle.
- Signed-in users can choose whether retained non-local Trash is synchronized.

### Workspace Preferences

- Users can choose light or dark theme.
- Users can configure counter-card density, grid columns, number size, bounds visibility, animations, default new-counter color, Trash behavior, and cloud Trash behavior.
- Theme and layout controls must remain usable on desktop and mobile web.

## Tally Super Requirements

### Counter Customization

- Customizable counter elements are the title, count, add button, subtract button, reset button, embed button, settings button, delete button, goal bar, minimum indicator, maximum indicator, and quick settings for positive step, negative step, minimum, maximum, color, and goal direction.
- Users can reposition, independently scale, and rotate each customizable counter element; add and subtract controls also support explicit dimensions.
- The title, count, add button, settings button, and delete button are required and cannot be hidden. The remaining listed elements are optional.
- Users can hide and restore optional counter elements. Every optional element remains listed and restorable in the counter's Tally Super editor while hidden from its counter card.
- Users can expose the listed quick settings on a counter card.
- Per-counter customizations remain linked to that counter through transfer, synchronization, Trash, restoration, and deletion according to the counter bundle's data boundary.

### Workspace Customization

- Users can add normal or alternative custom text, live counter summaries, and full or compact live statistic elements.
- Available statistics are session actions, net movement, total distance, most active counter, increments, decrements, resets, active counters, and completed goals.
- Users can position, independently scale, resize, rotate, and remove workspace elements.
- Workspace zones are the workspace, top area, bottom area, Settings, and Stats.
- Users can select free, row, or column layout behavior for each zone.
- Users can remove all workspace customizations without deleting counter data.
- Obsolete customization types are ignored safely rather than preventing the workspace from loading.

## Automation Requirements

### Languages and Editing

- A counter can have one linked script represented as TallyScript or JavaScript source.
- TallyScript provides readable commands, variables, arithmetic, conditions, loops, and yielding sleep behavior.
- JavaScript supports advanced language features in an isolated runtime.
- Both languages use a common Tally API to add, subtract, set an exact value, set the starting value, reset, jump to a saved value, configure positive and negative steps, add or remove goals, set goal direction, configure or remove minimum and maximum limits, change counter name and color, and apply the Tally Super transforms available to that counter.
- Scripts cannot change whether a counter is local.

### Runtime Behavior

- Users can run and stop scripts explicitly.
- One-time scripts can complete and publish their resulting counter state.
- Yielding scripts can continue in the browser while Tally remains open.
- TallyScript stops after 10,000 uninterrupted loop iterations and reports the limit as a visible error; yielding through sleep begins a new uninterrupted interval.
- JavaScript stops after one second of uninterrupted CPU work or upon exceeding 16 MiB of memory or a 512 KiB stack and reports the limit as a visible error.
- Yielding scripts keep the interface operable, including the script stop control, between execution intervals.
- Excessive uninterrupted work or resource exhaustion terminates the script with a visible error, preserves its latest valid published state, and does not impair unrelated counters.
- Published script results obey counter normalization and hard limits.
- Running scripts stop when the page closes or reloads.
- On page exit, Tally records scripts as stopped locally and attempts any required final cloud persistence.
- On the next load, a script that was running before navigation is stopped even when a final cloud persistence attempt could not complete.
- A saved script loads and validates according to its recorded language but never resumes execution automatically; it must not be interpreted as another language.

### Shared Script Behavior

- A group counter can have one shared TallyScript or JavaScript script.
- A member with permission for the script's language can edit, run, and stop that script.
- A shared script executes in the invoking member's browser and applies resulting changes through authorized live group operations.
- Permission for the script's language authorizes that script to use every operation in the common Tally API against its group counter; it does not grant the member equivalent direct-interface permissions.
- Starting a shared script does not create an unattended server job.
- Shared script changes remain subject to group authorization, conflict handling, resource limits, and visible runtime errors.

## Embed Requirements

- Users can build an embedded snapshot from a personal or group counter they can view.
- Snapshot creation does not grant access to the source personal workspace or group.
- Embed options include standard or compact sizing; light, dark, or device-matched theme; optional reset; optional counter details; and optional Tally attribution.
- Counter details display only positive step, negative step, minimum, and maximum. Embeds never expose scripts, customization source, folder or tag organization, ownership, account, group-membership, permission, or browser-storage information.
- An embed is independently interactive and enforces the encoded counter's limits.
- Changes made inside an embed are not persisted and do not update the source counter.
- Later source changes do not update an already published embed.
- Invalid or missing embed data produces a clear error state rather than a broken counter.
- The product must not describe snapshot embeds as live synchronized publishing.

## Accounts and Personal Synchronization

### Account Lifecycle

- An account is optional for personal counting, local automation, embeds, customization, and backups.
- Where online services are configured, users can create an account, sign in, recover access, change credentials, sign out, and permanently delete the account.
- Users can sign in with email and password or username and password.
- Account security actions require appropriate authentication or reauthentication.
- Account deletion must not erase browser-resident personal data merely because cloud access ends.
- If a remote account is deleted or a device becomes unauthorized, Tally signs out locally, explains what happened, and preserves browser data.

### Synchronization Boundary

- Signing in adds cloud synchronization without replacing local browser persistence.
- Non-local personal counters synchronize across a user's devices.
- The complete personal folder structure, including empty folders, synchronizes.
- Preferences and all scripts belonging to non-local counters synchronize.
- Workspace Tally Super data synchronizes except for content or references specific to a Local Counter.
- All per-counter Tally Super data belonging to non-local counters synchronizes; per-counter Tally Super data belonging to Local Counters does not.
- Retained non-local Trash synchronizes only when the user enables that preference.
- Local Counter bundles never enter cloud payloads.
- Activity History, undo/redo, and session statistics never enter cloud payloads.
- The interface communicates local-only, loading, saving, synchronized, conflict, and error states.

### Conflict and Failure Behavior

- If both device and cloud contain nonempty, materially different personal workspace data, Tally does not silently choose one.
- The user can keep the device version, use the cloud version, or merge both.
- Conflict comparison and resolution operate only on synchronization-eligible data; every choice preserves Local Counter bundles, Activity History, undo/redo, and session statistics.
- Merge preserves non-conflicting counters and keeps both divergent versions with distinguishable identities rather than silently overwriting one.
- Concurrent differences in counters, explicit folders, preferences, scripts, synchronized Trash, and Tally Super data are preserved, merged, or presented for explicit resolution; no usable browser version is silently discarded.
- A synchronization error leaves the browser copy usable and visible.
- Network recovery can resume synchronization without requiring the user to recreate local changes.

## Backup and Restore Requirements

### Backup Scopes

- A Counter Backup contains selected active counters and may optionally include linked scripts and per-counter customizations.
- Tally Super transfer contains workspace customization plus card density, grid columns, number size, bounds visibility, animations, and default counter color without requiring counter data. It excludes Trash and cloud Trash behavior.
- All Tally Data is a portable personal workspace containing active counters, retained Trash, explicit folders, scripts, preferences, complete per-counter customization, and complete workspace customization.
- All Tally Data explicitly excludes account credentials, account identity, copy-sharing records, group-owned data, Activity History, undo/redo, and session statistics.
- Backup files identify their format version, scope, and export time.

### Import Behavior

- An account is not required to export or import a backup.
- Tally validates the backup structure and selected scope before changing current data.
- Import options for scripts or per-counter customization appear only when the selected file contains those sections.
- Import clearly identifies which current data will be replaced and requires confirmation.
- Import replaces only the selected scope.
- Imported scripts are stopped by default and require an explicit user action to run.
- Invalid JSON, unsupported structure, missing required sections, or malformed counter records produce actionable errors without partially replacing current data.
- Users are warned that imported scripts from untrusted sources may be unsafe despite runtime isolation.

## Counter Copy Sharing Requirements

- Counter copy sharing requires both sender and recipient to have accounts.
- A sender can address a recipient by username or email identity.
- A sender cannot send a copy to the same account or to a nonexistent recipient.
- A sender can choose whether to include the linked script and per-counter customization.
- A recipient can accept or decline the copy.
- On acceptance, the recipient can independently accept or omit the included script and customization and can choose Local Counter status.
- An accepted copy receives a new personal identity and has no ongoing synchronization with the sender.
- Imported shared scripts remain stopped.
- The sender receives an accepted, declined, or receiving-disabled outcome without receiving the recipient's later counter activity.
- A user can disable incoming copies without losing outgoing sharing.
- A user can anonymize sender identity on incoming copy prompts.
- An optional sending PIN protects outgoing sends without exposing the PIN itself to other users or browser-readable public data.

## Live Group Requirements

### Group Lifecycle

- A signed-in user can create and own multiple groups.
- Owners can invite existing users by username or email identity.
- Invitees can accept or decline an invitation and can disable incoming group invitations.
- A non-owner member can leave a group after confirmation.
- An owner must transfer ownership or delete the group before leaving ownership unattended.
- Owners can remove members and permanently delete a group.
- Group deletion and shared-counter deletion are permanent and require clear confirmation where initiated from the interface.
- Group counters do not use personal Trash.

### Shared Workspace

- Group counters and folders are group-owned records, not synchronized personal copies.
- Members can belong to multiple groups and deliberately select the active group.
- Groups support nested shared folders and movement of counters and folders where authorized.
- Authorized member changes become visible to other active members without requiring a full page reload.
- Group activity identifies the actor, action, affected counter where applicable, and time.
- A group member can create an independent snapshot embed from a visible shared counter.

### Permissions

- Owners have full administrative and counter access.
- Owners can assign Full Access, Settings Only, Scripts Only, Super Only, Counting Only, or Custom access.
- Full Access grants every group counter, folder, settings, scripting, and Tally Super permission, including shared-counter creation.
- Counting Only grants add, subtract, and reset.
- Settings Only grants add, subtract, reset, and every listed counter-setting permission, but no folder, scripting, Super, delete, or create-counter permission.
- Scripts Only grants editing, running, and stopping TallyScript and JavaScript, but no other counter or folder mutation.
- Super Only grants counter name, color, and every listed Tally Super element and quick-setting permission, but no other counter or folder mutation.
- Custom access can independently control shared-counter creation; add, subtract, reset, and delete actions; folder creation, deletion, and movement; counter name, start, exact value, positive step, negative step, jumps, minimum, maximum, goal direction, goal addition, goal removal, and color; TallyScript and JavaScript; and every counter element and quick setting listed under Counter Customization.
- Interface controls reflect effective permissions, but hidden or disabled controls are not the security boundary.
- Unauthorized data operations are rejected even if requested outside the normal interface.
- A member cannot grant permissions beyond the member's authority.

### Concurrent Changes

- Repeated delivery of the same shared operation does not apply it more than once.
- Concurrent add and subtract operations are applied safely without losing an accepted count.
- A stale non-counting edit is rejected or reconciled explicitly rather than silently replacing a newer edit.
- Realtime disconnection does not imply a successful change; users receive an understandable error or refreshed state.

## Failure and Safety Requirements

- Malformed browser data falls back to a recoverable state without preventing the application from opening.
- Authentication, synchronization, sharing, group, embed, backup, and script failures produce user-visible states appropriate to the failed action.
- A failed optional online feature does not disable unrelated local personal counting.
- Data replacement, permanent deletion, account deletion, and group deletion require deliberate confirmation.
- Automatic Trash expiration and permanent deletion remove linked scripts and per-counter customizations as well as the core counter.
- Navigation with active scripts stops those scripts and preserves the latest locally publishable state before exit where the browser permits it.
- The product does not claim that browser persistence, final network flushes, or synchronization can guarantee zero data loss under every device or network failure.
- Product documentation distinguishes implemented safety boundaries from suitability guarantees and advises independent validation for important deployments.

## Experience and Quality Requirements

### Progressive Usability

- A first-time user can reach the personal workspace and create, increment, decrement, edit, reset, and delete a counter without creating an account.
- Advanced controls do not prevent the primary value and count actions from remaining apparent.
- Empty, loading, offline, synchronization, conflict, error, and destructive-confirmation states explain the user's available next action.

### Responsive Web Experience

- Core personal counting, counter editing, settings, recovery, and account flows work from 320 CSS pixels wide through desktop widths.
- Browser support covers the current and previous major releases of Chrome, Edge, Firefox, and Safari, including current Chrome on Android and Safari on iOS.
- Light and dark themes retain legible contrast and complete controls.
- Custom layouts must not make required counter actions irrecoverably inaccessible.

### Accessibility

- Interactive controls have understandable names and keyboard operation.
- Dialogs, status messages, errors, and destructive confirmations are perceivable without relying solely on color.
- Progress and limit states have textual or semantic meaning in addition to visual styling.
- Motion preferences and the product's animation setting are respected where motion is nonessential.

### Data and Security

- Browser code receives only credentials intended for public clients.
- Personal cloud records enforce account ownership.
- Group records enforce membership and permissions at the data boundary.
- Private authentication and sharing secrets are not exposed through public profile data or analytics.
- Analytics must not include personal counter names, values, scripts, account data, group data, or backup content.

## Product Acceptance Criteria

The complete Tally product is accepted only when every normative requirement in this specification is satisfied, including all of the following end-to-end criteria:

1. A user can complete the personal counter lifecycle and retain the result across reloads without an account or network connection.
2. Counter values, independent steps, starts, limits, directional goals, progress, reset, and jumps behave consistently through direct interaction, imports, and scripts.
3. Personal folders, tags, search, history, charts, undo/redo, statistics, and five-day Trash operate without confusing statistical reset, history deletion, restoration, and permanent deletion.
4. A signed-in user can distinguish Local Counter bundles from synchronized data, and no part of a Local Counter bundle is uploaded.
5. Personal synchronization includes complete folder structure and provides explicit conflict choices without silently discarding a usable browser copy.
6. All Tally Data export can restore the defined portable personal workspace while clearly excluding account, group, and device-local activity records.
7. TallyScript and JavaScript can perform supported operations while enforcing language identity, resource boundaries, hard counter limits, explicit stop behavior, and visible failures.
8. Tally Super can customize supported counter and workspace elements without payment and without making required counter functionality irrecoverable.
9. Personal and group counters can produce clearly described independent snapshot embeds whose interactions do not alter source data.
10. Counter copies remain independent, provide sender and recipient choices, and never start an imported script automatically.
11. Group counters remain separate from personal data; owners can administer membership and granular permissions; members can leave; and custom permissions include shared-counter creation.
12. Permitted group members can execute shared scripts in their browser, with effects passing through authorized and concurrency-safe group operations rather than unattended server automation.
13. Optional online failures do not prevent local personal counting, and destructive or replacing operations require deliberate confirmation.
14. Core workflows remain usable on desktop and mobile web, in light and dark themes, with keyboard-accessible and non-color-only states.
15. Tally's complete source is publicly available under an open-source license; no product capability requires a paid entitlement; and the product and its documentation consistently describe Tally as free, open source, account-optional, local-first, and unsuitable for unvalidated high-stakes reliance.

## Related Product Sources

This specification is the accepted product authority. Existing guides provide detailed user-facing explanations but must be reconciled to this specification where behavior or wording differs.

- [Project overview](../README.md)
- [Guide introduction](../src/content/guide/introduction.mdx)
- [Counters](../src/content/guide/counters.mdx)
- [Accounts and synchronization](../src/content/guide/account-sync.mdx)
- [Local counters](../src/content/guide/local-counters.mdx)
- [Backups](../src/content/guide/backups.mdx)
- [Copy sharing](../src/content/guide/copy-sharing.mdx)
- [Group sharing](../src/content/guide/group-sharing.mdx)
- [Group permissions](../src/content/guide/group-permissions.mdx)
- [Scripting](../src/content/guide/scripting.mdx)
- [Tally Super](../src/content/guide/tally-super.mdx)
- [Embeds](../src/content/guide/embeds.mdx)
- [Trash](../src/content/guide/trash.mdx)
- [Statistics](../src/content/guide/stats.mdx)
