# Activity History and Statistics

## Purpose

Define the device-local record and interpretation of accepted personal counter value changes, including recent activity, per-counter value-over-time views, global and counter-scoped undo/redo, and resettable page-session statistics.

## User Outcomes

- A user can understand when and how personal counter values changed on the current device.
- A user can inspect a counter's value over time and recover eligible changes through undo and redo.
- Session statistics distinguish signed movement, total distance, control actions, resets, and activity concentration.
- Resetting statistics creates a fresh measurement baseline without changing counters or deleting history.
- Deleting history is a deliberate operation distinct from statistics reset.
- Personal activity remains private to the device and does not silently synchronize or enter backups.

## Scope

- Device-local Activity History created by active and retained personal counters, including references to counters that later become unavailable.
- History entry fields and accepted-transition ingestion.
- Recent activity and per-counter value-over-time representation.
- Global and selected-counter undo/redo behavior.
- Redo invalidation after superseding non-redo changes.
- Page-session statistics and per-statistic or all-statistic baselines.
- Session actions, net movement, total distance, most active counter, increments, decrements, resets, active counters, and completed goals.
- History deletion and statistics-reset distinctions.
- Contracts with the counter engine, scripts, imports, Trash, synchronization, backup, and Tally Super.

## Out of Scope

- Counter numeric normalization, limits, goal calculation, and step configuration.
- Folder hierarchy, tags, search, filtering, and workspace preferences.
- Group-owned activity, actor attribution, and group concurrency.
- Cloud synchronization of any personal activity, undo/redo, or statistic state.
- Long-term analytics, reporting, forecasting, or cross-device activity aggregation.
- Trash retention and permanent-deletion mechanics.
- Script execution and resource limits.

## Domain and Data Boundaries

### Activity History

Activity History is the device-local chronological record of accepted current-value transitions for personal counters. Each entry contains:

- A unique activity-entry identity.
- Stable personal counter identity.
- An internal bundle-association identity used to resolve the entry to the same counter lifecycle without changing the recorded event facts.
- Previous finite value.
- Resulting finite value.
- Action kind.
- Occurrence time.

An entry MUST have different previous and resulting values. The stable counter identity recorded at acceptance is immutable event data. The separate bundle association resolves the entry to the current identity of that same counter after collision-safe restoration. History does not use mutable name, folder path, or tag metadata as identity.

### Accepted Transition Seam

The Core Counter Engine is authoritative for whether a request produces an accepted transition. Activity consumes each accepted personal transition exactly once after normalization and limit enforcement, using the transition's stable unique identity to make retried delivery idempotent. Unchanged attempts, rejected requests, counter creation, metadata edits, organization changes, page loading, and replacement imports MUST NOT create history or transition-derived statistics.

The action-kind contract distinguishes positive control, negative control, reset, direct value entry, jump, limit-induced clamp, script-published change, undo, and redo. Origin metadata MAY further identify the initiating surface, but MUST NOT change the statistical rules for the normative action kinds.

### Device-Local Boundary

Personal Activity History, undo/redo state, and session statistics belong only to the current browser device. They MUST NOT enter personal cloud synchronization, synchronization conflict comparison, Counter Backups, Tally Super transfers, or All Tally Data. Group activity is a separate group-owned record and MUST NOT enter personal Activity History.

### History, Undo, and Statistics Separation

- History is an append-only account of accepted transition facts until explicitly deleted. Controlled updates to a bundle association after collision-safe restoration do not rewrite the recorded identity, values, action kind, or occurrence time.
- Undo/redo state identifies which eligible forward changes can be reversed or reapplied; it is not reconstructed by rewriting History.
- Statistics derive from accepted transitions during the current page session relative to independent baselines.
- Resetting one or all statistics changes only statistic baselines.
- Deleting Activity History removes retained entries and invalidates undo/redo references to them, but does not change counter values or retroactively change already observed session-statistic totals.

## Detailed Behavior

### Recording Transitions

- Every accepted personal current-value transition for an active or retained counter MUST append one chronological history entry.
- Occurrence time records when the normalized transition is accepted on the device.
- A transition MUST retain the stable identity active at acceptance even if the counter is later renamed, moved, retagged, trashed, or restored. Its bundle association MAY resolve to a new current identity assigned during collision-safe restoration without changing that recorded identity.
- An unchanged reset, a count blocked while already at a hard limit, or any other unchanged attempt MUST NOT append an entry.
- A limits edit that clamps current value appends one `limit-induced clamp` entry from the previous value to the final normalized value.
- Loading persisted state and importing a replacement workspace append no entries solely because replacement values differ.
- A script-published transition appends an entry only when a valid published state changes current value.

### Recent Activity

- Recent activity is ordered newest first by occurrence time, with stable tie-breaking by activity-entry identity.
- Each item MUST identify the affected counter in a user-understandable way, previous value, resulting value, action kind, and time.
- When the referenced counter remains available, activity MAY display its current name while retaining identity as the authoritative link.
- When a referenced counter is unavailable, the entry remains understandable as activity for an unavailable or deleted counter without attaching to another counter of the same name.
- Recent activity MAY be narrowed to a selected counter without changing retained data.

### Value-Over-Time Representation

- A per-counter history view plots accepted resulting values in chronological order.
- The representation MUST make time and value understandable textually or semantically in addition to any visual chart.
- The first displayed transition MAY use its previous value as the opening point so the movement is visible.
- Equal-time entries retain acceptance order.
- Gaps with no accepted transitions MUST NOT be represented as invented value changes.
- History deletion removes the deleted points from future history views; it does not synthesize replacement points.

### Undo Eligibility

- A forward change is an accepted transition whose action kind is not `undo` or `redo` and whose counter remains an active personal counter on this device. A retained counter's history remains visible but is not undoable until restoration.
- Global undo selects the most recent eligible forward change across active personal counters that has not already been undone or superseded.
- Selected-counter undo selects the most recent such change for that counter and does not alter eligibility for other counters.
- Folder moves, tags, preference edits, imports, creation, deletion, and other non-value operations are not eligible value changes.
- A trashed, permanently deleted, expired, group-owned, or otherwise unavailable counter is not an undo target while unavailable.
- Deleting the history entry that anchors an undoable change removes that change from undo eligibility.

### Applying Undo

- Undo requests the selected forward change's previous value through the Core Counter Engine under the counter's current limits.
- If normalization produces a different current value, undo is accepted, a new `undo` history entry is appended, and the forward change enters the corresponding redo path.
- If current limits or current state make the undo request unchanged, no history or statistic action is created and the forward change remains available unless the user explicitly clears or supersedes it.
- Undo MUST NOT rewrite or delete the original history entry.
- Undoing a selected counter MUST NOT change another counter merely because another counter has newer activity.

### Redo and Branching

- Redo is available only for a forward change successfully undone in the corresponding global or selected-counter path.
- Redo requests the original forward change's resulting value through current counter normalization and limits.
- An accepted redo appends a `redo` history entry and returns that forward change to the undoable state.
- If redo normalizes to the current value, it produces no entry or statistic action and remains available unless superseded or explicitly cleared.
- A new accepted non-redo forward value change clears the redo path it supersedes for that counter.
- Clearing one counter's redo path MUST NOT remove independent redo candidates for other counters.
- An accepted undo or redo is itself an eligible session-statistic action, but undo/redo history entries MUST NOT become independent forward candidates that recursively undo themselves.

### Page-Session Boundary

- A page session begins when the workspace application loads and ends when it closes or reloads.
- Session statistics begin from zero-equivalent baselines for transition-derived metrics.
- Statistic baselines do not need to persist after the page session ends.
- Existing Activity History from an earlier session is visible but MUST NOT be counted automatically in the new session's transition-derived statistics.
- Importing or loading replacement data during a session does not create actions.

### Eligible Statistical Action

An eligible action is an accepted current-value transition for an active personal counter during the current page session, including direct interaction, jump, undo, redo, limit-induced clamp, or a script-published transition. Every eligible action contributes once to action count, net movement, total distance, and per-counter activity count.

The following are not eligible actions:

- Any request that leaves current value unchanged.
- Rejected or unauthorized requests.
- Loading or importing replacement workspace data.
- Counter creation, deletion, restoration, rename, organization, or non-value settings changes.
- Group-owned counter transitions.

### Statistic Definitions

- **Session Actions:** number of eligible actions since this statistic's current baseline.
- **Net Movement:** sum of `resulting value - previous value` for eligible actions since baseline.
- **Total Distance:** sum of `absolute(resulting value - previous value)` for eligible actions since baseline.
- **Most Active Counter:** active personal counter with the greatest eligible-action count since this statistic's baseline.
- **Increments:** count of accepted positive-control actions since baseline, regardless of the magnitude or sign of the resulting value.
- **Decrements:** count of accepted negative-control actions since baseline, regardless of the magnitude or sign of the resulting value.
- **Resets:** count of accepted reset actions since baseline.
- **Active Counters:** number of active personal counters in the stated workspace or presentation scope; retained Trash and group counters are excluded.
- **Completed Goals:** number of completed goals among active personal counters in the stated workspace or presentation scope, using Core Counter Engine direction and completion rules.

Direct value entry, jumps, scripts, limit-induced clamps, undo, and redo contribute to Session Actions, Net Movement, Total Distance, and Most Active Counter but MUST NOT increment Increments, Decrements, or Resets unless their authoritative action kind is the corresponding explicit control action. A reset contributes to Resets only when it changes the value.

### Most Active Tie and Availability Rules

- Most Active compares eligible-action counts after its own baseline.
- A tie MUST resolve deterministically using the earliest counter to reach the tied count; if still tied, stable counter identity provides the final tie-break.
- Before any counter has an eligible action after baseline, Most Active has a clear no-activity state rather than selecting an arbitrary counter.
- If the leading counter becomes unavailable, Most Active recomputes among currently active personal counters using their eligible actions since baseline. If no currently active counter has an eligible action, it displays the no-activity state; it MUST NOT transfer the unavailable counter's actions to another counter.

### Statistic Baselines and Reset

- Each displayed statistic has an independent baseline.
- Resetting one transition-derived statistic makes its displayed value equivalent to no eligible actions having occurred for that statistic while leaving all other baselines unchanged.
- Resetting Active Counters or Completed Goals records the current absolute count as that statistic's baseline and displays `0`. Subsequent display is the signed change from that baseline and MUST be labeled as change since reset rather than as the current absolute count.
- Resetting all statistics establishes new baselines for every displayed statistic at one logical time.
- Statistic reset MUST NOT change counter values, append history, delete history, alter undo/redo state, or count as an eligible action.
- Standard Stats and Tally Super instances of the same statistic MUST share its value and baseline.

### Deleting Activity History

- History deletion MUST be a deliberate action clearly labeled as deleting activity rather than resetting statistics.
- The user can delete all personal Activity History or only the history associated with a selected counter. The confirmation identifies the chosen scope.
- Deletion removes matching history entries and invalidates matching undo and redo candidates.
- Deletion MUST NOT change any counter value, statistic baseline, or already accumulated current-session statistic.
- Deleted personal history cannot be recovered through cloud synchronization or backup because neither carries it.

## Validation and Normalization

- Activity entries MUST contain a valid unique entry identity, immutable recorded counter identity, bundle association, finite previous and resulting values, recognized action kind, and valid occurrence time.
- Entries with equal previous and resulting values are invalid and MUST NOT be retained as accepted transitions.
- Duplicate delivery of the same accepted-transition identity MUST be recorded and counted at most once.
- Entries are ordered by occurrence time and stable identity without mutating their recorded times.
- Statistic arithmetic MUST reject non-finite operands and MUST NOT display `NaN` or infinity.
- Negative net movement is valid; action count, total distance, increments, decrements, and resets MUST remain nonnegative.
- Baselines MUST never predate the current page session for session-derived calculations.
- Unknown action kinds MUST remain safely viewable as generic value changes but MUST NOT be misclassified as increment, decrement, or reset.

## Failure and Recovery

- Malformed activity data MUST NOT prevent counters or the workspace from opening.
- Invalid entries MUST be quarantined from Activity History, charts, undo/redo, and statistics rather than discarded or interpreted. A device-local recovery notice reports the number of quarantined entries and lets the user deliberately delete them. Quarantine persists across reload until deletion; valid history remains usable.
- Failure to persist a new local history entry MUST NOT reverse an already accepted counter transition; the user receives an understandable activity-persistence warning.
- If an undo or redo target is unavailable, the operation MUST fail without changing another counter or consuming the candidate.
- If current limits clamp undo or redo, the accepted normalized result is recorded; if no movement remains, no action is recorded.
- A failed history-deletion operation MUST leave retained history and undo/redo state intact.
- Reload starts fresh session baselines even if prior page-session statistic state cannot be recovered.
- Synchronization conflict resolution MUST leave all device-local history, undo/redo, and statistics untouched.

## Integrations and Dependencies

- **Core Counter Engine:** emits normalized accepted personal transitions and applies undo/redo requests; unchanged attempts never cross the seam as transitions.
- **Personal Workspace Organization:** supplies active-counter scope and current display metadata; folder and tag changes do not rewrite activity identity or counts.
- **Scripting:** valid script-published value transitions enter personal activity; rejected results and unpublished intermediate state do not.
- **Synchronization:** excludes Activity History, undo/redo, and statistics from payloads, conflict comparison, merge, and cloud replacement choices.
- **Backup and restore:** excludes all activity data from every backup scope; replacement import creates no action and does not manufacture history.
- **Trash:** retained transitions enter Activity History but not statistics and remain unavailable to undo selection. Restoration reconnects retained history through its bundle association; if restoration changes current identity to avoid a collision, event facts retain their recorded identity while only the retained bundle's association resolves to the new identity.
- **Tally Super:** full and compact live statistic elements use the same definitions and baselines as standard Stats.
- **Groups:** group activity records actor, action, affected counter, and time in a separate group-owned boundary and never contributes to personal session statistics.

## Privacy and Security

- Personal Activity History, undo/redo state, and session statistics MUST remain device-local and MUST NOT be uploaded.
- Analytics MUST NOT include counter identities, names, values, action details, history, scripts, account data, group data, or backup content.
- History views MUST expose only personal activity available in the current browser context.
- Group activity access MUST be governed by group membership and authorization separately from this feature.
- Clearing local history MUST not be described as erasing copies outside this boundary, although normative product flows never synchronize or back up personal history.
- Activity and statistics MUST NOT be presented as an auditable or guaranteed record for high-stakes use.

## Accessibility and Responsive Behavior

- Recent activity, charts, undo, redo, statistic reset, and history deletion controls MUST have understandable names and keyboard operation.
- Value-over-time information MUST be available in textual or semantic form, not only as a plotted line or color.
- Positive, negative, undo, redo, reset, no-activity, unavailable-counter, and failure states MUST not rely only on color.
- Destructive history deletion confirmation and status messages MUST be perceivable and focus-managed.
- Stats and history views MUST work from 320 CSS pixels through desktop widths without hiding values or required controls.
- Large numeric statistics MUST wrap or resize without truncating their meaning.
- Light and dark themes MUST preserve contrast for chart series, axes, focus, and status states.
- Nonessential chart and statistic animation MUST respect reduced-motion and workspace animation preferences.

## Acceptance Scenarios

1. **Given** a personal counter changes from `3` to `5` through its positive control, **When** the transition is accepted, **Then** one history entry records identity, `3`, `5`, positive-control action, and time, and all general movement statistics update once.
2. **Given** a counter is already at its maximum, **When** the positive control is attempted, **Then** no history entry or statistic action is created.
3. **Given** a reset changes `10` to starting value `2`, **When** accepted, **Then** Session Actions increases by one, Net Movement changes by `-8`, Total Distance by `8`, and Resets by one.
4. **Given** direct value entry changes `-5` to `5`, **When** accepted, **Then** Session Actions and distance metrics update, but Increments and Decrements do not.
5. **Given** accepted actions add `5` and subtract `5`, **When** statistics are viewed, **Then** Net Movement is `0`, Total Distance is `10`, and action count is `2`.
6. **Given** two counters have history and counter `A` has the newest eligible change, **When** global undo is selected, **Then** `A` requests its prior value and an accepted undo is recorded.
7. **Given** counter `B` is selected while counter `A` has newer activity, **When** selected-counter undo is used, **Then** the newest eligible change for `B` is targeted and `A` is unchanged.
8. **Given** a successful undo created a redo candidate, **When** a new non-redo value change is accepted for that counter, **Then** the superseded redo path for that counter is cleared without clearing another counter's redo path.
9. **Given** an undo target value lies below a newly configured minimum, **When** undo is requested, **Then** the target is clamped by the current minimum and any resulting movement is recorded as one undo action.
10. **Given** an undo request normalizes to the current value, **When** it is attempted, **Then** no history or statistic action is created and the candidate is not silently consumed.
11. **Given** Session Actions is reset after five actions, **When** two more eligible actions occur, **Then** it displays `2` while history still contains all seven transitions and other statistic baselines remain unchanged.
12. **Given** all statistics are reset, **When** the reset completes, **Then** counter values, Activity History, and undo/redo candidates remain unchanged.
13. **Given** history for one counter is deliberately deleted, **When** deletion succeeds, **Then** its entries and anchored undo/redo candidates are removed while current counter value and accumulated session statistics remain unchanged.
14. **Given** a replacement workspace is imported, **When** current values differ from the prior workspace, **Then** no history entries or actions are created merely from replacement.
15. **Given** the page reloads with prior device-local history retained, **When** a new page session starts, **Then** prior history is viewable and transition-derived session statistics start at their fresh baselines.
16. **Given** synchronization resolves a device/cloud conflict, **When** a cloud or merged workspace is selected, **Then** device-local history, undo/redo, and session statistics do not enter the comparison and are not uploaded.
17. **Given** malformed local activity includes a non-finite value, **When** the workspace opens, **Then** counters and valid history remain usable, the invalid entry is quarantined with a recovery notice, it affects no chart, undo/redo, or statistic, and it remains quarantined after reload until deliberately deleted.
18. **Given** a Tally Super mini statistic and standard Stats both show Total Distance, **When** an eligible action occurs or that statistic is reset, **Then** both surfaces show the same value and baseline behavior.
19. **Given** Active Counters is `4`, **When** that statistic is reset and one active counter is then deleted, **Then** the reset display changes from `0` to `-1`, is labeled as change since reset, and any separately presented absolute active-counter count remains `3`.
20. **Given** the Most Active leader enters Trash and another active counter has eligible actions since baseline, **When** Most Active is recomputed, **Then** the highest eligible active counter is shown; if none has an eligible action, the no-activity state is shown.
21. **Given** a retained counter changes value in Trash, **When** the transition is accepted, **Then** one history entry is recorded but no session statistic changes and undo remains unavailable until restoration.
22. **Given** a retained bundle collides with an active counter identity, **When** restoration assigns the retained bundle a new identity, **Then** its history keeps the identity recorded at each event, resolves to the restored counter through bundle association, and does not attach to the colliding active counter.
23. **Given** history exists for several counters, **When** the user confirms deletion for one selected counter, **Then** only that counter's entries and anchored undo/redo candidates are removed; when all-history deletion is confirmed, all remaining entries and candidates are removed without changing counter values or statistic baselines.

## Sources

- [Product Principles](../product-specification.md#product-principles)
- [Domain Vocabulary](../product-specification.md#domain-vocabulary)
- [Core Counter Requirements](../product-specification.md#core-counter-requirements)
- [History and Undo](../product-specification.md#history-and-undo)
- [Statistics](../product-specification.md#statistics)
- [Synchronization Boundary](../product-specification.md#synchronization-boundary)
- [Backup Scopes](../product-specification.md#backup-scopes)
- [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [Experience and Quality Requirements](../product-specification.md#experience-and-quality-requirements)
- [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- [Statistics guide](../../src/content/guide/stats.mdx)
- [Settings tutorial](../../src/content/guide/tutorial-settings.mdx)
- [Counter limits guide](../../src/content/guide/counter-limits.mdx)
- [Counter values guide](../../src/content/guide/counter-values.mdx)
- [Tally Super workspace guide](../../src/content/guide/tally-super-workspace.mdx)
- [Tally Super data guide](../../src/content/guide/tally-super-data.mdx)
- [Account synchronization guide](../../src/content/guide/account-sync.mdx)
- [Backups guide](../../src/content/guide/backups.mdx)
- [Backup import guide](../../src/content/guide/backup-import.mdx)
- [Trash guide](../../src/content/guide/trash.mdx)
- [Scripting guide](../../src/content/guide/scripting.mdx)
