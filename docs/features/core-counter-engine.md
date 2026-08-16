# Core Counter Engine

## Purpose

Define the authoritative behavior of a counter: its identity, numeric state, steps, limits, goals, progress, metadata, and accepted value transitions. The same rules apply wherever a personal or group-owned counter is changed, including direct interaction, scripts, imports, reset, jumps, undo/redo, and limit edits.

## User Outcomes

- A user can create and count with a useful counter without an account or network connection.
- Positive, negative, and zero values behave predictably with independently configured add and subtract steps.
- Hard limits constrain every source of value changes consistently.
- Goals communicate directional milestone progress without preventing further counting.
- Reset and jump operations use saved values without obscuring which value is the reset point.
- Invalid input never leaves a counter with a non-finite or internally contradictory numeric state.

## Scope

- Stable counter identity and core counter fields.
- Creation, viewing, editing, reset, jump, and deletion requests.
- Current value, starting value, positive step, and negative step.
- Optional minimum and maximum hard limits.
- Multiple unique numeric goals, goal direction, completion, and segmented progress.
- Name and color metadata.
- Normalization of all counter mutations regardless of their source.
- The accepted-value-transition contract consumed by activity, persistence, synchronization, scripting, groups, imports, embeds, Trash, and presentation features.

## Out of Scope

- Folder hierarchy, tags, search, filtering, and workspace layout preferences.
- Storage, synchronization, conflict resolution, and backup file formats.
- Activity retention, charts, undo/redo selection, and statistic calculation.
- Trash retention, restoration, expiration, and permanent-deletion confirmation.
- Script language, execution, and resource limits.
- Group ownership, permissions, realtime delivery, and concurrency resolution.
- Embed encoding and independent embed state.
- Tally Super transforms and element visibility.

## Domain and Data Boundaries

### Counter Record

A counter has:

- A stable identity that does not change when its name, ownership context, or organization changes.
- A name.
- A finite current value and finite starting value.
- Finite positive and negative step magnitudes, each greater than zero.
- An optional finite minimum and optional finite maximum.
- Zero or more unique finite numeric goals.
- A goal direction of `More Than` or `Less Than`.
- A valid preset or custom color.

Personal organization metadata may refer to a personal counter by stable identity, but it is not part of the numeric engine. Group ownership metadata is likewise outside this boundary.

### Counter Bundle Seam

The core counter record is the required member of a Counter Bundle. Scripts, per-counter Tally Super customization, and retained deleted state attach to the same stable counter identity. Transfer, synchronization, Trash, restoration, and permanent deletion MUST treat the bundle according to their own data boundaries and MUST NOT silently detach linked data from its counter.

### Accepted Value Transition Contract

Every request that may change a current value MUST pass through the same normalization and limit rules. The result is one of:

- **Accepted transition:** the normalized resulting current value differs from the previous current value.
- **Unchanged attempt:** the normalized resulting current value equals the previous current value.
- **Rejected request:** the request cannot be interpreted as a valid operation without substituting an arbitrary numeric value.

An accepted transition exposes a unique transition identity, counter identity, previous value, resulting value, action kind, and occurrence time to the device-local personal activity feature or group activity boundary, as applicable. The transition identity MUST remain stable if delivery is retried. Action kind MUST distinguish at least positive control, negative control, reset, direct value entry, jump, limit-induced clamp, script-published change, undo, and redo. An unchanged attempt MUST NOT emit an accepted transition. Importing or loading replacement state MUST NOT emit accepted transitions merely because loaded values differ from the state they replace.

### Ownership Context Seam

The numeric rules are ownership-neutral. For a personal counter, persistence is browser-first and activity transitions are device-local. For a group counter, authorization and concurrency MUST be resolved before a requested operation is accepted, and accepted operations feed group-owned activity rather than personal Activity History. The engine MUST NOT move a counter between personal, Local Counter, synchronized personal, or group-owned contexts.

## Detailed Behavior

### Creation and Identity

- A workspace MAY contain no counters.
- Creating a counter assigns a new stable identity.
- The initial current value MUST equal the normalized starting value.
- Creation MUST succeed with a normalized untitled label when the submitted name is blank.
- Any number of personal counters MAY exist, subject only to practical browser or service constraints that are surfaced as failures rather than product limits.
- Copy acceptance and collision-safe Trash restoration MUST create or resolve identities without overwriting an unrelated counter.

### Positive and Negative Controls

- The positive control adds the configured positive step magnitude.
- The negative control subtracts the configured negative step magnitude.
- The sign of the current value does not alter either control's direction.
- Positive and negative step magnitudes are configured independently.
- A control request that begins inside the allowed range and would cross a hard limit MUST clamp to that limit and produce an accepted transition; a request made while already at the blocking limit is an unchanged attempt.
- At a minimum, movement below the minimum is disabled while positive movement remains available.
- At a maximum, movement above the maximum is disabled while negative movement remains available.

### Exact Value and Starting Value

- Exact value changes the current value without changing the starting value.
- Starting value changes the future reset destination without changing the current value, except when the same operation also changes limits and normalization clamps the current value.
- On counter creation, the starting value supplies the initial current value.
- Every current and starting value request MUST be clamped to configured hard limits.

### Reset

- Reset requests the configured starting value as the current value.
- A reset that changes the current value is an accepted `reset` transition.
- A reset while already at the starting value is an unchanged attempt and MUST NOT enter activity or statistics.
- The stored starting value MUST already satisfy active limits, so reset does not target an out-of-range value.

### Jumps

- A jump destination is available for the starting value, each goal, the minimum, and the maximum when that destination exists.
- Selecting a destination requests that finite saved value as the current value.
- A jump is clamped by current hard limits, including when a saved goal lies outside those limits.
- A jump that changes the value is an accepted `jump` transition; selecting the current value is an unchanged attempt.

### Limits

- A counter supports no limits, a minimum only, a maximum only, or both.
- When both limits exist, minimum MUST be less than or equal to maximum.
- Minimum and maximum constrain current value and starting value.
- Adding or changing limits MUST immediately normalize both current and starting values.
- If limit normalization changes the current value, exactly one `limit-induced clamp` transition MUST describe the previous and final normalized current values.
- A limit edit that changes only the starting value MUST NOT produce a current-value transition.
- Removing a limit does not itself move either value.
- Limits apply equally to controls, direct entry, reset, jumps, imports, scripts, undo, redo, and any other current-value source.

### Goals and Direction

- A counter MAY contain multiple goals, but each numeric goal value MUST be unique within that counter.
- Goal values MAY be positive, zero, or negative.
- `More Than` orders goals from lowest to highest.
- `Less Than` orders goals from highest to lowest.
- Under `More Than`, a goal is complete when current value is greater than or equal to its value.
- Under `Less Than`, a goal is complete when current value is less than or equal to its value.
- Changing direction immediately recomputes ordering, completion, and progress without changing current value.
- Adding, removing, or clearing goals recomputes completion and progress without creating a value transition.
- Goals are milestones, not hard limits. Reaching or passing any goal MUST NOT disable counting.

### Segmented Progress

- The next incomplete goal in directional order is the active milestone.
- Completed milestones are reported independently from progress through the active segment.
- For a goal after the first directional milestone, the previous milestone is the active segment's anchor.
- Before the first milestone, the starting value is the anchor only when it lies on the incomplete side of that milestone.
- If the starting value is not a valid anchor, an available hard limit on the incomplete side is the anchor.
- If neither anchor is valid, progress before completion is zero percent and progress at completion is 100 percent.
- With a valid anchor, active-segment progress is the directional distance traveled from the anchor to the current value divided by the directional distance from the anchor to the active milestone, clamped to zero through 100 percent.
- Crossing multiple goals in one transition completes every crossed milestone in directional order and makes the next incomplete goal active.
- Once all goals are complete, milestone progress remains complete even when counting continues beyond the final goal.
- Progress details MUST communicate final-goal progress and the configured maximum where applicable without implying that a goal is a limit.
- With no goals, the counter has no milestone-completion state; any bounds presentation MUST be described as bounds rather than goal progress.

### Name and Color

- A blank or whitespace-only name MUST normalize to a clear untitled label.
- Renaming MUST NOT change identity or activity ownership.
- A color MUST resolve to a supported preset or valid custom color representation.
- Invalid color input MUST preserve the last valid color or use the defined default during creation; it MUST NOT corrupt the counter record.

### Deletion Request Seam

- A personal delete request passes the stable counter identity and complete Counter Bundle to Trash behavior when Trash is enabled.
- When Trash is disabled, permanent deletion requires deliberate confirmation before the complete bundle is removed.
- Group-counter deletion passes through group authorization and permanent-deletion behavior and never uses personal Trash.
- Numeric state MUST NOT be partially deleted independently of its linked bundle.

## Validation and Normalization

- Numeric fields MUST accept only values that can be represented as finite numbers.
- Empty, malformed, `NaN`, positive infinity, and negative infinity MUST NOT become counter values, steps, limits, or goals.
- Step input is normalized to its absolute magnitude. Zero is normalized to `1`, matching the scripting contract.
- Reversed entered limits are reordered into ascending minimum and maximum values.
- After limits are normalized, starting value and current value are clamped independently to the inclusive interval they define.
- Goals are deduplicated by numeric value after numeric normalization.
- Goal ordering is derived from direction and MUST NOT be persisted as an independent source of truth.
- All mutation sources MUST receive the same normalized result for equivalent input.
- A rejected edit MUST leave the last valid state intact and identify the invalid field.

## Failure and Recovery

- Malformed persisted counter data MUST NOT prevent the workspace from opening. Valid records remain usable, and affected records produce a recoverable state or actionable error.
- Failure to persist or synchronize an accepted personal change MUST leave the browser copy visible and usable and MUST expose the relevant local-only, saving, conflict, or error state.
- A failed optional online operation MUST NOT disable local personal counting.
- A rejected script result MUST preserve the latest valid published counter state and report the script failure through the scripting boundary.
- A rejected unauthorized group operation MUST leave authoritative group state unchanged and expose an understandable failure or refreshed state.
- The product MUST NOT promise zero data loss under every browser, device, or network failure.

## Integrations and Dependencies

- **Activity History and Statistics:** consumes accepted personal value transitions exactly once; unchanged attempts, creation, loading, and replacement imports produce no activity event.
- **Personal Workspace Organization:** refers to active personal counters by stable identity and supplies folder and tag metadata without changing numeric rules.
- **Persistence and synchronization:** save normalized personal records automatically; Local Counter bundles remain device-only; synchronization conflicts preserve usable identities and versions.
- **Backup and restore:** validate complete records before replacement and normalize imported numeric state without manufacturing activity transitions.
- **Scripting:** all published Tally API mutations use these rules; scripts cannot bypass limits or change Local Counter status.
- **Trash:** retains or permanently removes the complete Counter Bundle and resolves restoration identity collisions without overwrite.
- **Tally Super:** reads counter state and may expose approved quick settings; transforms do not alter numeric semantics.
- **Embeds:** receive a snapshot of normalized counter state and independently enforce the encoded limits without writing back.
- **Groups:** authorize operations and resolve concurrent delivery before applying these ownership-neutral numeric rules.

## Privacy and Security

- Personal counter names, values, goals, scripts, and organization metadata are user-owned data and MUST NOT appear in analytics.
- Browser code MUST receive only credentials intended for public clients.
- Cloud personal records MUST enforce account ownership.
- Group-owned mutations MUST enforce membership and effective permissions at the data boundary, not only through control visibility.
- Local Counter bundles MUST never enter cloud payloads.
- Counter data MUST NOT be represented as guaranteed suitable for safety-critical, regulated, financial, medical, or other high-stakes records without independent validation.

## Accessibility and Responsive Behavior

- Primary value, positive, and negative controls MUST remain apparent without opening the editor.
- Create, count, edit, reset, jump, and delete flows MUST work from 320 CSS pixels through desktop widths.
- Every control MUST have an understandable accessible name and keyboard operation.
- Disabled movement at limits, goal completion, progress, errors, and destructive confirmation MUST be perceivable without relying only on color.
- Progress MUST expose textual or semantic milestone, direction, and completion meaning.
- Light and dark themes MUST preserve legible values, bounds, progress, focus, and disabled states.
- Nonessential progress animation MUST respect reduced-motion preferences and the workspace animation preference.
- Custom layouts MUST NOT make required counter actions irrecoverably inaccessible.

## Acceptance Scenarios

1. **Given** an empty account-free workspace, **When** the user creates a counter with a blank name and starting value `0`, **Then** a new stable identity is assigned, the untitled label is used, and current value equals `0`.
2. **Given** positive step `12`, negative step `1`, and current value `0`, **When** the user activates positive once and negative twice, **Then** accepted transitions produce `12`, `11`, and `10` in order.
3. **Given** minimum `0`, maximum `10`, and current value `9`, **When** a positive step of `3` is applied, **Then** the value becomes `10` and one accepted positive-control transition records `9` to `10`.
4. **Given** current value equals maximum `10`, **When** the user activates the positive control, **Then** the value remains `10` and no accepted transition is emitted.
5. **Given** current value `7` and starting value `2`, **When** starting value changes to `4`, **Then** current value remains `7` and the next accepted reset moves it to `4`.
6. **Given** current value already equals the starting value, **When** Reset is selected, **Then** the request is unchanged and creates no history or statistic action.
7. **Given** entered limits `20` and `5`, current value `30`, and starting value `0`, **When** the limits are saved, **Then** they normalize to minimum `5` and maximum `20`, current becomes `20`, starting becomes `5`, and one limit-induced transition records the current-value clamp.
8. **Given** More Than goals `10`, `5`, and `20`, **When** current value moves from `4` to `12`, **Then** goals are ordered `5`, `10`, `20`, the first two are complete, and `20` is the active milestone.
9. **Given** Less Than goals `10`, `0`, and `-5`, **When** current value reaches `0`, **Then** goals `10` and `0` are complete and `-5` is next regardless of the goals' signs.
10. **Given** all directional goals are complete, **When** counting continues beyond the final goal within hard limits, **Then** milestone progress remains complete and counting remains available.
11. **Given** a More Than goal of `10`, starting-value anchor `0`, and current value `4`, **When** active-segment progress is calculated, **Then** the segment reports 40 percent.
12. **Given** a script publishes infinity as a current value, **When** the result is validated, **Then** the request is rejected, the last valid value remains, and a visible scripting error is available.
13. **Given** a replacement workspace import containing valid normalized counters, **When** the import succeeds, **Then** the imported state replaces only the selected scope and no activity transition is created solely from replacement.
14. **Given** a personal counter is deleted while Trash is enabled, **When** deletion is accepted, **Then** its complete bundle enters retained deleted state under the same identity and numeric data is not separately destroyed.
15. **Given** a signed-in synchronization write fails after a local count, **When** the accepted transition is saved in the browser, **Then** the new value remains usable and visible with synchronization Error status.

## Sources

- [Product Summary](../product-specification.md#product-summary)
- [Product Principles](../product-specification.md#product-principles)
- [Domain Vocabulary](../product-specification.md#domain-vocabulary)
- [Core Counter Requirements](../product-specification.md#core-counter-requirements)
- [Automation Requirements](../product-specification.md#automation-requirements)
- [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [Experience and Quality Requirements](../product-specification.md#experience-and-quality-requirements)
- [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- [Counters guide](../../src/content/guide/counters.mdx)
- [Counter values guide](../../src/content/guide/counter-values.mdx)
- [Counter limits guide](../../src/content/guide/counter-limits.mdx)
- [Counter goals guide](../../src/content/guide/counter-goals.mdx)
- [First counter tutorial](../../src/content/guide/tutorial-counters.mdx)
- [Goals tutorial](../../src/content/guide/tutorial-goals.mdx)
- [Tally API guide](../../src/content/guide/tally-api.mdx)
- [Scripting guide](../../src/content/guide/scripting.mdx)
