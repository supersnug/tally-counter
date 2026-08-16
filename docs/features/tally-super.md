# Tally Super

## Purpose

Define Tally Super as the free visual customization capability for counter cards and workspace surfaces. Customization may rearrange supported presentation while preserving counter behavior, data ownership, authorization, accessibility, and a guaranteed path to recover required actions and default layouts.

## User Outcomes

- A user can customize one counter without changing other counters or its counting rules.
- A user can move, scale, rotate, show, restore, and otherwise configure every supported counter element within explicit limits.
- Required counter elements remain available and recoverable regardless of customization.
- A user can add text, live counter summaries, and live statistics to supported workspace zones and choose each zone's layout behavior.
- A user can remove workspace customization or reset an element without deleting counter data.
- Customization follows its defined synchronization, Trash, backup, copy, and group ownership boundaries without requiring payment or an account.

## Scope

- Per-counter customizable elements, required and optional visibility, quick settings, transforms, and dimensions.
- Counter editor selection, placement, reset, hide, restore, and recoverability.
- Workspace element types, zones, transforms, layout modes, and removal.
- Per-counter and workspace customization data boundaries.
- Personal synchronization, Local Counter, Trash, backup, copy, group permission, and script seams.
- Safe handling of obsolete customization types.

## Out of Scope

- A paid plan, premium entitlement, subscription, trial, or account requirement.
- Changing core counter values, steps, starts, limits, goals, progress calculations, ownership, or Local Counter status merely through visual transforms.
- Hiding or permanently removing required counter elements.
- Arbitrary executable content, HTML, scripts, network resources, or unsupported workspace surfaces.
- Publishing customization source in snapshot embeds.
- Moving group-owned customization into a member's personal workspace or backup.
- Making Settings or required counter actions irrecoverably inaccessible.

## Domain and Data Boundaries

### Per-Counter Customization

Per-counter Tally Super data is linked to one stable counter identity and describes only that counter's supported elements, visibility, transforms, dimensions, and quick-setting presence. It does not replace or duplicate the core counter's value, rules, name, color, ownership, organization, script source, or activity records.

For a personal counter, per-counter customization is part of the Counter Bundle. It follows that bundle through Local Counter designation, eligible synchronization, Trash, restoration, backup, Counter Copy selection, and permanent deletion. For a group counter, it is group-owned data and follows group permissions and lifecycle.

### Workspace Customization

Workspace Tally Super data describes placed workspace elements and zone layout behavior independently of per-counter customization. It may reference live personal counters but does not own or copy their core records. Workspace data specific to a Local Counter remains browser-only and is excluded from personal cloud payloads.

Workspace customization is not part of any Counter Bundle. Deleting a counter does not redefine workspace customization as counter data; references that can no longer resolve must fail safely without exposing or recreating the counter.

### Required and Optional Counter Elements

The complete customizable counter-element set is:

| Element | Requirement | Allowed presentation changes |
| --- | --- | --- |
| Title | Required | Move, independent scale, rotate, reset transform |
| Count | Required | Move, independent scale, rotate, reset transform |
| Add button | Required | Move, independent scale, rotate, explicit width and height, reset transform |
| Subtract button | Optional | Move, independent scale, rotate, explicit width and height, hide, restore, reset transform |
| Reset button | Optional | Move, independent scale, rotate, hide, restore, reset transform |
| Embed button | Optional | Move, independent scale, rotate, hide, restore, reset transform |
| Settings button | Required | Move, independent scale, rotate, reset transform |
| Delete button | Required | Move, independent scale, rotate, reset transform |
| Goal bar | Optional | Move, independent scale, rotate, hide, restore, reset transform |
| Minimum indicator | Optional | Move, independent scale, rotate, hide, restore, reset transform |
| Maximum indicator | Optional | Move, independent scale, rotate, hide, restore, reset transform |
| Positive-step quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |
| Negative-step quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |
| Minimum quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |
| Maximum quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |
| Color quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |
| Goal-direction quick setting | Optional | Add, move, independent scale, rotate, remove, restore, reset transform |

Required means the element cannot be hidden, removed, or omitted from the usable counter. Optional means it can be absent from the card but must remain listed and restorable in that counter's editor. Add and subtract are the only counter elements with explicit width and height controls.

The numbered counter identity described by the counter-editor guide is permanent standard card chrome where that presentation is used. It cannot be removed, but it is not part of the PRD's customizable counter-element set and therefore has no independent transform, visibility, transfer, script, or group-permission record.

### Workspace Elements and Zones

Supported workspace element types are:

- normal custom text;
- alternative-style custom text;
- live counter summaries;
- full live statistics; and
- compact live statistics.

Supported statistics are session actions, net movement, total distance, most active counter, increments, decrements, resets, active counters, and completed goals.

Each placed workspace element belongs to exactly one zone: Workspace, Top Area, Bottom Area, Settings, or Stats. Each zone independently uses one layout mode: Free, Row, or Column.

Permanent product text in the top and bottom bars is standard workspace chrome, not a removable placed customization. Where the editor permits repositioning or copying that text, the permanent source remains available; a placed copy is an ordinary removable custom text element. Remove All Workspace Customizations removes copies and other placed elements but not permanent product chrome.

## Detailed Behavior

### Counter Editor Entry and Selection

1. The user opens Tally Super for one counter and edits that counter at its actual card dimensions.
2. The editor lists every supported element for that counter, including optional elements currently absent from the card.
3. Selecting an element exposes only transforms and actions valid for that element and the actor's authority.
4. Changes apply only to the selected counter and preserve its live value, rules, limits, goals, and actions.
5. The preview uses the counter's live presentation data, including current value, limits, and final-goal progress.

### Counter Transform Rules

- Movement uses horizontal and vertical offsets within the counter's editable surface.
- Movement is constrained so an element cannot become permanently lost outside the recoverable editing surface.
- Horizontal and vertical scale are independent.
- Rotation is expressed in degrees around the element's own center.
- Add and subtract controls accept explicit width and height without stretching their icon or label as presentation content.
- Utility controls and informational elements do not accept explicit dimensions unless they are add or subtract.
- Reset Transform restores the selected element's default position, scale, rotation, and supported dimensions without changing its visibility, counter data, or another element.
- A transform changes presentation only; it never changes the element's semantic action or the counter rule represented by that element.

### Required Element Recoverability

- Title, count, add, settings, and delete are always present and cannot be hidden or removed.
- Every required element remains selectable in the editor even if overlap, scale, rotation, or placement makes it difficult to use on the card.
- Reset Transform provides a direct return to the default transform for each required element.
- The counter offers a path to restore all per-counter customization to defaults without deleting or replacing the counter.
- Custom layout constraints must preserve a reachable Settings action or an equivalent direct recovery entry into the counter editor.
- Required actions remain keyboard reachable and semantically identified after customization.

### Optional Element Visibility

An optional element has either `Shown` or `Hidden` presentation state when the underlying counter feature can be represented. Hide or Remove changes it to Hidden on the card but retains an editor entry. Restore changes it to Shown with a valid default or retained recoverable transform.

Hiding an indicator, goal bar, button, or quick setting changes presentation only. It does not remove a minimum, maximum, goal, step, color, direction, reset rule, or embed capability from the underlying counter. A display-only element whose underlying data is absent remains listed in the editor as unavailable and cannot be restored to the card until that data exists. Quick settings remain restorable because their purpose is to configure or create the corresponding underlying setting; merely restoring one does not fabricate a value until the user submits a valid change.

### Quick Settings

- A user can independently add or remove positive step, negative step, minimum, maximum, color, and goal-direction quick settings.
- A shown quick setting changes the same underlying counter setting as the full counter editor.
- Quick settings follow ordinary counter validation, normalization, limits, and group permissions.
- The minimum indicator and minimum quick setting are distinct elements; the same distinction applies to maximum.
- Adding a quick setting does not grant authority to use it. In group contexts, visibility and mutation permission are both enforced.
- Removing a quick setting from the card does not change the setting's current value.

### Goal Bar and Live Counter Meaning

The customized goal bar remains a presentation of the counter's actual directional milestone progress. It uses the same final-goal completion, negative-goal, Less Than, segment-anchor, and hard-limit rules as the standard counter. Transforming or hiding it does not recalculate, complete, remove, or constrain goals.

Workspace live counter summaries reference current personal counters. They remain presentations of source state, not independent Counter Copies or embedded snapshots. Removing a referenced personal counter makes the reference unavailable rather than leaking or recreating source data.

### Workspace Editor and Placement

1. The user starts the workspace editor from Tally Super settings.
2. The toolbox identifies supported element types and their configurable initial content or presentation.
3. Placing an item creates one workspace element in one selected zone.
4. A placed element can be selected, moved, independently scaled, resized, rotated, or removed.
5. Text content and color can be configured without executable markup.
6. Full and compact statistic elements display live values from the corresponding statistic definition rather than static copied text.
7. Removing a placed element deletes only that customization element.

### Zone Layout Modes

- **Free:** placed elements retain explicit positions within the zone.
- **Row:** the zone arranges its elements in an ordered horizontal flow and preserves their order as available width changes.
- **Column:** the zone arranges its elements in an ordered vertical flow and preserves their order as available width changes.
- Changing a zone's layout mode changes arrangement, not element content or source data.
- Every zone retains a usable way to select its placed elements and change or reset its layout.
- Settings remains available even when custom content is placed in the Settings zone.

### Workspace Statistics

Full and compact statistics use the same live definitions and baselines as Stats:

- session actions count eligible accepted personal value transitions;
- net movement sums signed value changes;
- total distance sums absolute value changes;
- most active counter uses eligible action count in the current baseline;
- increments, decrements, and resets use their defined action kinds;
- active counters and completed goals derive from current workspace counter state.

Resetting a displayed statistic changes its statistic baseline under the statistics rules. It does not reset a counter, delete Activity History, remove undo/redo data, or change the Tally Super element.

### Remove and Reset Semantics

- Reset Transform affects one selected element's presentation properties.
- Hide or Remove on an optional counter element removes it from the card but preserves its editor restoration path.
- Remove on a placed workspace element deletes only that element.
- Remove All Workspace Customizations removes placed workspace elements and resets zone customizations without deleting counters, scripts, folders, tags, activity, statistics definitions, account data, or per-counter customization.
- Restoring default per-counter presentation removes or resets that counter's customization without deleting core counter data or workspace customization.
- Obsolete customization types are ignored safely and do not prevent valid workspace or counter data from loading.

### Persistence and Transfer

- Personal per-counter customization persists with its Counter Bundle.
- Non-local per-counter customization synchronizes with that bundle; Local Counter customization never enters cloud payloads.
- Retained per-counter customization follows the complete bundle into Trash and returns on restoration.
- Permanent deletion and automatic expiration remove linked per-counter customization with the bundle.
- A Counter Backup may include per-counter customization only by explicit option; All Tally Data includes it.
- A Counter Copy sender may include linked per-counter customization, and the recipient may independently decline it.
- Workspace customization and its specified presentation preferences transfer through Tally Super transfer or All Tally Data, not through a Counter Backup or Counter Copy.
- Imported or transferred customization never executes script content.

### Group Customization and Permissions

- Group per-counter customization remains group-owned.
- Full Access and Super Only include authority for every listed counter element and quick setting; Super Only also includes counter name and color but no unrelated mutation.
- Custom access controls every listed counter element and quick setting independently.
- Permission to customize an element changes its presentation and does not grant the element's underlying action. For example, delete-button layout permission does not grant counter deletion.
- Indicator permission and corresponding setting permission are distinct.
- Every group customization write enforces current membership and effective permission at the data boundary.
- A revoked permission prevents subsequent unauthorized changes without removing already accepted group customization.

### Scripted Customization

The common Tally API may apply supported per-counter transforms, visibility changes, transform resets, add/subtract dimensions, and quick-setting additions or removals. Scripted customization follows the same element validity, required-element, normalization, ownership, publication, and group authorization rules as direct customization. Scripts cannot modify workspace customization through the per-counter API.

## Validation and Normalization

- Per-counter customization must reference exactly one existing counter identity.
- Element identifiers and quick-setting identifiers must be members of the complete supported sets; unknown identifiers grant no behavior.
- Position, scale, rotation, width, and height values must be finite.
- Scale and dimensions must remain positive and within ranges that preserve a recoverable editor representation and required controls.
- Explicit dimensions are valid only for add and subtract counter controls.
- Hide or remove requests for title, count, add, settings, or delete are rejected without changing the element.
- Optional element state accepts only Shown or Hidden and always retains an editor restoration entry.
- Workspace element type, statistic type, zone, and layout mode must be supported values.
- Text is treated as presentation text, not executable markup, and is normalized to supported length and color values.
- Live counter references must resolve to a current personal counter within the workspace boundary.
- Duplicate default counter elements are not created; an optional default can appear at most once on a counter.
- Obsolete customization types are ignored rather than interpreted as a supported type or allowed to block valid core data.

## Failure and Recovery

- Invalid transforms are rejected at the affected element and do not corrupt the rest of the customization or core counter.
- A failed customization save leaves the last valid saved presentation authoritative and reports that the change did not persist.
- If a required element becomes difficult to reach, the editor's element list and Reset Transform remain available as recovery paths.
- If complete per-counter customization is malformed, the counter remains usable with a recoverable default presentation rather than becoming inaccessible.
- If workspace customization is malformed, supported content loads where safe and the standard workspace and Settings remain available.
- An obsolete element is ignored without preventing unrelated valid customization or counter data from loading.
- A missing or inaccessible live-counter reference shows an unavailable state and can be removed; it does not expose stale private data.
- A synchronization failure leaves browser customization usable and visibly unsynchronized under personal sync rules.
- A rejected group customization reports the failed action and refreshes authoritative presentation without claiming success.
- Removing or resetting customization is not represented as deleting or resetting counter data.

## Integrations and Dependencies

- Core counter presentation and rules provide the live title, count, actions, limits, goals, progress, steps, color, and direction shown by customizable elements.
- Counter Bundle rules define per-counter ownership, Local Counter exclusion, Trash retention, restoration, and deletion.
- Personal synchronization includes eligible workspace and per-counter data while excluding Local Counter bundles and Local Counter-specific workspace content.
- Backup and restore define Tally Super transfer, Counter Backup options, and All Tally Data inclusion.
- Counter Copy sharing provides independent sender and recipient choices for linked per-counter customization.
- Automation exposes only supported per-counter transforms and quick settings through the common Tally API.
- Live Groups enforce ownership and independent element and quick-setting permissions.
- Statistics supply live values and baseline behavior for workspace statistic elements.
- Snapshot embeds consume a strict counter projection and never consume Tally Super customization source.

## Privacy and Security

- Tally Super is free and open-source capability, not an entitlement or account tier.
- Custom text, live counter references, transforms, layouts, counter names, values, statistics, and customization payloads must not enter analytics.
- Local Counter per-counter customization and Local Counter-specific workspace content never enter personal cloud payloads.
- Group customization reads and writes enforce current membership and effective permissions at the data boundary.
- Workspace text is non-executable and cannot inject scripts, arbitrary HTML, credentials, or network resources.
- Snapshot embeds never expose per-counter or workspace customization source.
- Backup and transfer interfaces describe customization files as potentially personal data.
- A customization reference never grants access to a personal or group counter the viewer cannot otherwise access.

## Accessibility and Responsive Behavior

- Every customizable control retains an understandable accessible name, role, state, and keyboard operation after transformation.
- Required title, count, add, settings, and delete elements remain semantically present and recoverable.
- Optional visibility and quick-setting state are communicated textually or semantically and not by position or color alone.
- Editor selection, transform fields, hide, restore, remove, reset, zone selection, and layout modes are keyboard operable.
- Dragging has keyboard-accessible alternatives using explicit position and ordering controls.
- Counter and workspace editors work from 320 CSS pixels through desktop widths without losing toolbox actions or recovery controls.
- Free, Row, and Column layouts adapt without forcing required actions outside the reachable viewport.
- Light and dark themes preserve legible contrast for transformed text, focus indicators, controls, errors, and selection states.
- Rotation, movement, and live statistic updates do not rely on motion to communicate meaning and respect reduced-motion and product animation preferences.
- Custom layouts must not make Settings, primary counting, or required recovery actions irrecoverably inaccessible.

## Acceptance Scenarios

1. **Given** a counter with default presentation, **When** the user moves, independently scales, and rotates the title, **Then** only the title presentation changes and the counter's name and rules remain unchanged.
2. **Given** the add button is selected, **When** the user sets valid width and height, **Then** its control surface resizes while its action and label remain usable.
3. **Given** the reset button is selected, **When** explicit width and height are requested, **Then** unsupported dimensions are rejected without changing the valid reset-button presentation.
4. **Given** the user attempts to hide title, count, add, settings, or delete, **When** the request is validated, **Then** it is rejected and the required element remains present and recoverable.
5. **Given** an optional subtract button is hidden, **When** the user opens that counter's editor, **Then** subtract remains listed and Restore returns one valid subtract control to the card.
6. **Given** a transformed required element overlaps other content, **When** the user selects it from the editor list and activates Reset Transform, **Then** its default transform is restored without changing counter data.
7. **Given** a minimum exists and its indicator is hidden, **When** counting reaches the minimum, **Then** the hard limit remains enforced even though the indicator is absent.
8. **Given** the minimum quick setting is shown, **When** an authorized user changes it, **Then** ordinary limit ordering and clamping apply; removing the quick setting afterward does not remove the minimum.
9. **Given** goals include negative values in Less Than direction, **When** the goal bar is transformed, **Then** it continues to present the standard directional final-goal progress without changing completion.
10. **Given** custom text, a live counter summary, and compact statistics, **When** the user places them in supported zones, **Then** each belongs to one zone and remains selectable, transformable, removable, and non-executable.
11. **Given** a zone contains several elements, **When** its mode changes from Free to Row and then Column, **Then** element order is preserved and content or source data is not changed.
12. **Given** custom content is placed in Settings, **When** the layout becomes narrow or malformed content is ignored, **Then** Settings and customization recovery remain reachable.
13. **Given** workspace statistic elements are visible, **When** eligible counter actions occur or a statistic baseline resets, **Then** the elements reflect the standard live statistic definitions without changing counter values or Activity History.
14. **Given** workspace and per-counter customization exist, **When** Remove All Workspace Customizations is confirmed, **Then** workspace elements and zone customizations are removed while per-counter customization and all counter data remain.
15. **Given** a Local Counter has per-counter and workspace-specific customization, **When** personal synchronization constructs a payload, **Then** the entire bundle customization and Local Counter-specific workspace references are excluded but remain in the browser.
16. **Given** a customized personal counter enters Trash and is later restored, **When** restoration succeeds, **Then** its complete per-counter customization follows the restored bundle and any collision-safe identity.
17. **Given** a Counter Copy includes per-counter customization, **When** the recipient accepts the counter but declines customization, **Then** the independent counter is created with default presentation and the sender is unchanged.
18. **Given** a group member can customize the delete button but cannot delete counters, **When** the member changes its transform and then requests deletion, **Then** the transform can succeed and deletion remains unauthorized.
19. **Given** a script attempts to hide a required element, **When** the API operation is validated, **Then** publication is rejected and the required element remains available.
20. **Given** stored customization contains an obsolete type, **When** the workspace loads, **Then** that type is ignored and valid counters, supported customization, Settings, and recovery controls remain usable.
21. **Given** a workspace contains permanent top- and bottom-bar text plus removable custom copies, **When** Remove All Workspace Customizations is confirmed, **Then** the copies are removed and the permanent product text remains available.
22. **Given** a counter has no goals or minimum, **When** its Tally Super editor opens, **Then** the goal bar and minimum indicator remain listed as unavailable, while the minimum quick setting can be restored and creates no minimum until a valid value is submitted.
23. **Given** a group customization request is rejected because permission was revoked or authoritative state changed, **When** the rejection returns, **Then** the failed action is reported visibly, authoritative presentation is refreshed, and the interface does not claim the requested customization succeeded.

## Sources

- [PRD: Progressive Capability](../product-specification.md#progressive-capability)
- [PRD: Free and Open Source](../product-specification.md#free-and-open-source)
- [PRD: Tally Super](../product-specification.md#tally-super)
- [PRD: Counter Customization](../product-specification.md#counter-customization)
- [PRD: Workspace Customization](../product-specification.md#workspace-customization)
- [PRD: Statistics](../product-specification.md#statistics)
- [PRD: Trash](../product-specification.md#trash)
- [PRD: Synchronization Boundary](../product-specification.md#synchronization-boundary)
- [PRD: Backup Scopes](../product-specification.md#backup-scopes)
- [PRD: Counter Copy Sharing Requirements](../product-specification.md#counter-copy-sharing-requirements)
- [PRD: Permissions](../product-specification.md#permissions)
- [PRD: Responsive Web Experience](../product-specification.md#responsive-web-experience)
- [PRD: Accessibility](../product-specification.md#accessibility)
- [PRD: Data and Security](../product-specification.md#data-and-security)
- [Guide: Tally Super](../../src/content/guide/tally-super.mdx)
- [Guide: Counter editor](../../src/content/guide/tally-super-counter-editor.mdx)
- [Guide: Workspace customization](../../src/content/guide/tally-super-workspace.mdx)
- [Guide: Tally Super data](../../src/content/guide/tally-super-data.mdx)
- [Guide: Tally Super tutorial](../../src/content/guide/tutorial-super.mdx)
- [Guide: Statistics](../../src/content/guide/stats.mdx)
- [Guide: Backups](../../src/content/guide/backups.mdx)
- [Guide: Counter Copy sharing](../../src/content/guide/copy-sharing.mdx)
- [Guide: Group permissions](../../src/content/guide/group-permissions.mdx)
- [Guide: Tally API](../../src/content/guide/tally-api.mdx)
