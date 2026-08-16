# Automation Runtime

## Purpose

Define safe, explicit browser execution for one TallyScript or JavaScript script linked to a counter. The runtime preserves recorded language identity, publishes only valid counter operations, enforces language-specific resource limits, and never turns a browser invocation into unattended server automation.

## User Outcomes

- A user can save one script for a counter and know which language will interpret it.
- A user can explicitly run, stop, edit, and rerun finite or yielding automation.
- TallyScript and JavaScript can use the same bounded counter API without changing Local Counter status.
- A runaway or exhausted script stops visibly without making the page or unrelated counters unusable.
- A stopped, failed, imported, transferred, or reloaded script never starts automatically.
- An authorized group member can invoke a shared script without receiving equivalent direct-interface permissions.

## Scope

- Script ownership, source, recorded language, validation, and runtime state.
- TallyScript and isolated JavaScript execution.
- Explicit run and stop controls, finite completion, yielding, and page-exit behavior.
- The common Tally API and publication of normalized counter changes.
- Loop, CPU, memory, and stack resource limits.
- Personal, Local Counter, Trash, synchronization, backup, copy, and group seams.
- Visible runtime, validation, authorization, and persistence failures.

## Out of Scope

- Server-hosted, scheduled, or unattended automation.
- Automatic execution on load, import, copy acceptance, restoration, sign-in, or synchronization.
- More than one linked script per counter.
- Script access to arbitrary workspace, account, browser-storage, group, or network data.
- Changing whether a personal counter is a Local Counter.
- Granting a group member direct-interface permissions through script authorization.
- Guaranteeing suitability for safety-critical, regulated, financial, medical, or other high-stakes automation.

## Domain and Data Boundaries

### Script Record

A script record belongs to exactly one personal or group counter and contains:

- exactly one recorded language identity: `TallyScript` or `JavaScript`;
- source text interpreted only according to that identity; and
- a persistent stopped state.

Source and language identity are linked counter data. Runtime stack, instruction position, local variables, pending sleeps, elapsed resource counters, and in-progress working state are invocation data and are never resumable persisted state.

A personal script is part of its Counter Bundle. A group script is group-owned data and is not part of any member's personal workspace. There is at most one script record per counter in either ownership mode.

### Invocation Identity and State

Each explicit Run creates a new invocation with an identity distinct from the script record and from prior runs. An invocation is in exactly one of these states:

- **Running:** executing an uninterrupted interval.
- **Yielded:** waiting in a runtime-provided sleep and not consuming uninterrupted work.
- **Completed:** source reached normal completion.
- **Stopped:** the user, navigation, reload, page close, deletion, replacement, or loss of authority ended the invocation.
- **Failed:** validation, runtime, resource, authorization, or publication failure terminated the invocation.

`Completed`, `Stopped`, and `Failed` are terminal for that invocation. Running again always creates a fresh invocation with fresh local variables and resource accounting. Persistent script state is `Stopped` whenever no invocation is active.

### Language Identity

The recorded language is authoritative for editing validation, loading, execution, permission checks, import, synchronization, and transfer. Source recorded as TallyScript must never be interpreted as JavaScript, and JavaScript source must never be interpreted as TallyScript, including as a fallback after validation failure.

Changing language is a deliberate edit that replaces the recorded language identity and requires the source to validate in the newly selected language before it can run. It does not convert source implicitly and does not run the source.

### Publication Boundary

Script computation is private to its invocation until it invokes the common Tally API. Each mutating API call proposes an operation against the invocation's own counter. An operation becomes published only after counter normalization, hard-limit enforcement, ownership checks, and any group authorization or concurrency checks accept it.

Published state is ordinary counter state, not runtime state. A published personal current-value transition participates in Activity History and session statistics under the same eligibility rules as other accepted transitions. A published group operation participates in group activity and concurrency handling. Variables, stack state, intermediate expressions, and failed candidate operations are never published.

A finite script may publish operations during its run and completes with the latest valid published counter state. A yielding script may publish across multiple intervals while Tally remains open. Stopping or failing an invocation does not roll back operations already validly published and does not publish unaccepted working state.

## Detailed Behavior

### Script Editing and Saving

1. A counter exposes one linked script editor with an explicit language selection.
2. Saving records source under the selected language identity and does not execute it.
3. Validation messages identify the recorded language and the source location when that location is available.
4. Editing source while an invocation is active requires that invocation to stop before a different saved source can run.
5. Loading valid saved source always presents it as stopped.
6. Imported or accepted transferred source is stopped and requires a separate explicit Run action.

### Run Transition

1. Run is accepted only for a valid saved script, a counter that still exists, and an actor currently authorized to invoke it.
2. Run creates fresh invocation state and changes the observable runtime state to Running.
3. Only one invocation of the linked script may be active for that counter at a time.
4. A second Run request while the invocation is Running or Yielded does not create concurrent execution.
5. Normal source completion transitions the invocation to Completed and leaves the script persistently stopped.
6. Completion preserves the latest valid published state and does not imply that every API request changed the counter.

### Yield and Sleep

- TallyScript supports `sleep` and its `wait` equivalent with a duration measured in milliseconds.
- JavaScript supports `await Tally.sleep(milliseconds)`.
- Entering sleep transitions Running to Yielded and returns control so the page and Stop control remain operable.
- When the wait ends and the invocation is still authorized and not stopped, it returns to Running in a new uninterrupted interval.
- Stop cancels a pending sleep promptly; the remainder of the source does not execute.
- A yielding loop can continue only while the page remains open and the invocation remains authorized.

### Explicit Stop and Lifecycle Stop

- Stop is available while the invocation is Running or Yielded.
- Stop transitions the invocation to Stopped, cancels pending work, and prevents later publication from that invocation.
- Closing, reloading, or navigating away from the page stops every active invocation.
- Before exit, Tally records scripts as stopped locally and attempts any required final cloud persistence where the browser permits.
- A final persistence attempt does not keep execution alive and does not create a server job.
- On the next load, every script is stopped, including one whose final cloud persistence could not complete.
- Removing or replacing the counter or script stops its active invocation before the data transition completes.

### TallyScript Runtime

TallyScript provides line-oriented commands, comments, variables, arithmetic, boolean conditions, `if` branches, `repeat` loops, `while` loops, and yielding sleep behavior. Commands are case-insensitive; remembered variable names are case-sensitive and exist only for the current invocation.

An uninterrupted interval may execute at most 10,000 loop iterations. Attempting to exceed that limit terminates the invocation as Failed with a visible loop-limit error. A completed sleep starts a new uninterrupted interval and resets this loop-iteration allowance. Non-yielding work cannot evade the limit by publishing counter operations.

### JavaScript Runtime

JavaScript executes in an isolated runtime with the common `Tally` API and runtime-provided live counter values. It may use advanced language features but receives no ambient authority to the application, account, source counter storage, group storage, or host page.

Each uninterrupted interval is limited to:

- one second of CPU work;
- 16 MiB of memory; and
- a 512 KiB stack.

Exceeding any limit terminates the invocation as Failed and identifies the exhausted resource in a visible error. A completed `Tally.sleep` begins a new uninterrupted CPU interval; it does not preserve excess memory or stack usage as permission to exceed their limits. Isolation and limits apply to finite and yielding scripts alike.

### Common Tally API

Both languages expose equivalent operations scoped to the linked counter:

- add the configured positive step or a supplied amount;
- subtract the configured negative step or a supplied amount;
- set the current value or starting value;
- reset to the starting value;
- jump to a supplied or available saved start, goal, minimum, or maximum;
- read and configure positive and negative step magnitudes;
- read, add, remove, or clear goals;
- read and set More Than or Less Than goal direction;
- read, configure, or remove minimum and maximum limits;
- read and change counter name and color; and
- move, independently scale, rotate, show, hide, or reset supported per-counter Tally Super elements, resize supported add and subtract controls, and add or remove supported quick settings.

The API contains no operation for Local Counter status. It contains no general-purpose access to other counters, folders, tags, Activity History, session statistics, account identity, credentials, synchronization payloads, copy records, group membership, permissions, browser storage, or network requests.

### Counter Operation Semantics

- API operations use the same counter rules as direct interaction.
- Current and starting values are finite and clamp to configured limits.
- Reversed limits normalize into ascending minimum and maximum order and clamp current and starting values.
- Positive and negative step settings are positive magnitudes; the selected operation determines direction.
- Goals are unique finite numbers and follow the counter's recorded direction.
- A blank name normalizes to the untitled label.
- Colors must use the supported counter color representation.
- A value operation that produces no transition because of a hard limit or identical destination does not enter Activity History or statistics.
- A script-published accepted current-value transition is an eligible script action but is not classified as a direct increment or decrement control unless it represents that explicit API operation under the statistics rules.

### Personal Counter Publication

For a personal counter, each accepted operation updates the browser-resident Counter Bundle. A non-local bundle is eligible for ordinary personal synchronization; a Local Counter bundle never enters a cloud payload. Runtime execution does not synchronize invocation state and does not make a local invocation run on another device.

A retained personal counter may be scripted during its retention period. Publication remains attached to that retained bundle and follows its Local Counter and cloud Trash eligibility. Permanent deletion or expiration removes the linked script and prevents further publication.

### Shared Script Authorization

- A group counter can have one shared TallyScript or JavaScript script.
- Editing, running, and stopping require current permission for the script's recorded language.
- Language permission authorizes that script to use every common Tally API operation against its own group counter.
- Script API authority does not grant the invoking member equivalent direct-interface permissions.
- Every shared publication is submitted as an authorized live group operation attributed to the invoking member.
- Membership, language permission, counter existence, operation identity, current authoritative state, hard limits, and concurrency rules are checked at publication.
- Revocation of membership or relevant language permission prevents subsequent publication and terminates the invocation visibly.
- Starting a shared script creates no unattended server job; it runs only in the invoking member's browser.

### Publication Ordering and Isolation

Operations from one invocation are proposed in source order. A later operation observes the latest state accepted for that invocation's counter, including normalization from earlier accepted operations. Rejected or failed operations do not silently become accepted through a later operation.

A runtime failure is isolated to its invocation and linked counter. It must not stop scripts on unrelated counters, corrupt unrelated counter state, or make primary page controls inoperable.

## Validation and Normalization

- A script record must reference one existing counter, contain source text, and identify exactly one supported language.
- Source must validate under its recorded language before Run can begin.
- TallyScript block structure, commands, expressions, variables, and durations must be syntactically valid.
- JavaScript must be valid for the isolated runtime and may access only the provided runtime globals and Tally API.
- Sleep durations and every numeric API argument must be finite; invalid values fail the operation or invocation without producing non-finite counter state.
- Step setters normalize magnitude to an absolute positive value and normalize zero to `1`.
- Goal direction accepts only More Than or Less Than language values.
- Goal values are finite and duplicate additions do not create duplicate goals.
- Limits are finite or absent, reversed pairs are ordered, and current and starting values are clamped after every relevant operation.
- Tally Super part names, quick-setting keys, transform values, and dimensions must be supported and finite; required elements cannot be hidden.
- A shared invocation validates current group membership and recorded-language permission at Run and again for each published operation.

## Failure and Recovery

- Invalid source remains saved only as non-running source where editing permits and cannot enter Running; the user receives a visible language-specific validation error.
- A TallyScript loop-limit failure, JavaScript CPU timeout, memory exhaustion, or stack exhaustion transitions only that invocation to Failed and reports the exact limit category.
- A malformed API call publishes no partial candidate operation and identifies the invalid argument or operation where possible.
- A failed publication preserves the latest valid published state. It does not roll the counter back to invocation start and does not publish intermediate runtime data.
- Stop remains available and operable between yielding intervals.
- A runtime that cannot guarantee isolation or resource enforcement must reject Run rather than execute without the stated boundaries.
- A personal persistence or synchronization failure leaves the browser counter usable, marks cloud status honestly, and permits ordinary retry.
- A shared authorization, conflict, or connectivity failure does not imply success; the invocation stops or reports the rejected operation and preserves the latest authoritative accepted group state.
- Malformed script data is isolated from valid counters and must not prevent unrelated local counting.
- Reload recovery always presents the script as stopped and never reconstructs stack, variables, pending sleep, or instruction position.

## Integrations and Dependencies

- Core counter rules define values, starts, steps, limits, goals, progress, reset, jumps, names, colors, history, and statistics.
- Counter Bundle rules link personal scripts through Local Counter conversion, Trash, restoration, synchronization, and deletion.
- Personal synchronization persists eligible script source and published counter state but never executes or resumes scripts.
- Backup and Counter Copy transfer may include linked source by explicit choice and always deliver it stopped.
- Tally Super defines supported per-counter elements, transforms, dimensions, visibility, and quick settings.
- Live Groups provide current membership, language permissions, authorized operations, idempotency, concurrency, and group activity.
- Browser lifecycle and isolated runtime capabilities provide stop, yielding, CPU, memory, and stack enforcement.

## Privacy and Security

- Script source, counter names, values, account data, group data, and runtime errors containing source content must not enter analytics.
- The JavaScript global environment exposes only language facilities and explicitly provided counter runtime values and APIs; it exposes no credentials or private client configuration beyond credentials intended for public browser use.
- Scripts cannot read or change Local Counter designation, authentication state, sharing secrets, permission definitions, arbitrary browser storage, or unrelated counters.
- Group data operations enforce current membership and permission at the data boundary, not only through visible controls.
- Isolation and limits reduce risk but do not make untrusted scripts trustworthy; imports and transfers warn users before they choose to include untrusted source.
- Runtime state and errors must not disclose another counter, user, account, group, or invocation.
- Automation is not represented as suitable for unvalidated high-stakes reliance or guaranteed against every browser or device failure.

## Accessibility and Responsive Behavior

- Script language selection, editor, validation messages, Run, Stop, state, and errors have programmatic names and keyboard operation.
- Running, Yielded, Completed, Stopped, and Failed states are communicated textually or semantically and never by color alone.
- Runtime errors identify the affected script and resource or validation category without requiring users to infer failure from a stopped animation.
- Stop remains reachable at 320 CSS pixels while a script is Running or Yielded.
- Script editing and runtime controls work from 320 CSS pixels through desktop widths in light and dark themes on supported browsers.
- Focus is not moved unexpectedly by published counter updates, yields, or runtime-state announcements.
- Repeated background updates use appropriately restrained announcements and respect reduced-motion and product animation preferences.
- Required counter actions remain recoverable when scripts change supported Tally Super transforms.

## Acceptance Scenarios

1. **Given** a valid saved TallyScript, **When** the user selects Run, **Then** a fresh Running invocation begins with no variables or instruction position from a prior invocation.
2. **Given** TallyScript source is recorded as TallyScript, **When** it fails TallyScript validation but resembles JavaScript, **Then** it is not interpreted as JavaScript and does not run.
3. **Given** a finite script publishes several valid API operations and reaches the end, **When** the invocation completes, **Then** its state is Completed, the latest normalized published counter state remains, and the script is persistently stopped.
4. **Given** a yielding loop is waiting in sleep, **When** the user activates Stop, **Then** the wait is canceled, no later source executes, and already validly published state remains.
5. **Given** a TallyScript loop performs 10,000 uninterrupted iterations without yielding, **When** it attempts another uninterrupted iteration, **Then** the invocation fails with a visible loop-limit error and unrelated counters remain operable.
6. **Given** a TallyScript loop sleeps after an uninterrupted interval, **When** the sleep completes, **Then** execution resumes in a new uninterrupted interval with a new 10,000-iteration allowance.
7. **Given** JavaScript consumes more than one second of uninterrupted CPU work, **When** the CPU boundary is exceeded, **Then** only that invocation fails with a visible CPU-limit error.
8. **Given** JavaScript exceeds 16 MiB of memory or a 512 KiB stack, **When** the boundary is enforced, **Then** the invocation terminates visibly and preserves its latest valid published state.
9. **Given** a script proposes a value beyond a configured maximum, **When** the API operation is accepted, **Then** the published current value is clamped to the maximum and no non-finite or out-of-range state is exposed.
10. **Given** a script calls an API with a non-finite numeric argument, **When** validation occurs, **Then** no invalid counter state is published and the failure is visible.
11. **Given** a Local Counter has a linked script, **When** that script publishes changes, **Then** the browser bundle changes but no script source, invocation state, or counter bundle data enters personal cloud payloads.
12. **Given** a script is active during page reload, **When** exit and the next load occur, **Then** the invocation stops, final persistence is attempted where permitted, and the script does not resume even if that attempt failed.
13. **Given** an imported or accepted transferred script was marked running at its source, **When** it first appears in the destination, **Then** it is stopped and requires a separate explicit Run action.
14. **Given** a Scripts Only group member has permission for the shared script's recorded language but lacks direct minimum permission, **When** the member runs a script that sets the minimum, **Then** the authorized API operation can succeed while an equivalent direct-interface request remains unauthorized.
15. **Given** a group member may run TallyScript but not JavaScript, **When** the member attempts to run a shared JavaScript record, **Then** Run is rejected by recorded-language authorization without interpreting it as TallyScript.
16. **Given** a yielding shared script is active, **When** the member loses membership or recorded-language permission, **Then** subsequent publication is rejected, the invocation terminates visibly, and the latest authoritative accepted group state remains.
17. **Given** a script publishes a current-value transition, **When** the transition changes a personal counter value, **Then** it follows ordinary Activity History and session-statistics eligibility without exposing runtime variables.
18. **Given** an isolated runtime cannot enforce its stated resource boundaries, **When** Run is requested, **Then** execution is refused with a visible error rather than proceeding unsafely.

## Sources

- [PRD: Safe Power](../product-specification.md#safe-power)
- [PRD: Counter Bundle](../product-specification.md#counter-bundle)
- [PRD: History and Undo](../product-specification.md#history-and-undo)
- [PRD: Statistics](../product-specification.md#statistics)
- [PRD: Languages and Editing](../product-specification.md#languages-and-editing)
- [PRD: Runtime Behavior](../product-specification.md#runtime-behavior)
- [PRD: Shared Script Behavior](../product-specification.md#shared-script-behavior)
- [PRD: Synchronization Boundary](../product-specification.md#synchronization-boundary)
- [PRD: Import Behavior](../product-specification.md#import-behavior)
- [PRD: Permissions](../product-specification.md#permissions)
- [PRD: Concurrent Changes](../product-specification.md#concurrent-changes)
- [PRD: Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [PRD: Accessibility](../product-specification.md#accessibility)
- [PRD: Data and Security](../product-specification.md#data-and-security)
- [Guide: Scripting](../../src/content/guide/scripting.mdx)
- [Guide: TallyScript](../../src/content/guide/tallyscript.mdx)
- [Guide: Tally API](../../src/content/guide/tally-api.mdx)
- [Guide: Automation tutorial](../../src/content/guide/tutorial-automation.mdx)
- [Guide: Counter values](../../src/content/guide/counter-values.mdx)
- [Guide: Counter limits](../../src/content/guide/counter-limits.mdx)
- [Guide: Account synchronization](../../src/content/guide/account-sync.mdx)
- [Guide: Group permissions](../../src/content/guide/group-permissions.mdx)
- [Guide: Tally Super counter editor](../../src/content/guide/tally-super-counter-editor.mdx)
