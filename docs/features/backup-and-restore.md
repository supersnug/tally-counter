# Backup and Restore

## Purpose

Define account-independent, portable JSON exports and deliberate, transactional imports for selected counters, Tally Super workspace data, or the complete portable personal workspace.

## User Outcomes

- A user can make and retain a portable copy of personal data without an account.
- A user can choose a narrow counter transfer, a workspace customization transfer, or a complete personal workspace snapshot.
- A user can see exactly what a file contains and what an import will replace before current data changes.
- Invalid or unsupported files cannot partially replace current data.
- Imported scripts remain stopped until the user explicitly runs them.
- Local Counter bundles can be deliberately moved between browsers without entering personal cloud synchronization.

## Scope

- Counter Backup, Tally Super transfer, and All Tally Data export scopes.
- Scope metadata, selection, inclusion choices, and inclusion matrices.
- File validation, preview, confirmation, replacement boundaries, transactionality, and recovery.
- Script trust warnings and stopped-script behavior.
- Backup seams with Counter Bundles, Local Counters, Trash, folders, preferences, Tally Super, synchronization, activity records, copies, and groups.

## Out of Scope

- Automatic scheduled backups or server-hosted backup storage.
- Account credentials, account identity, authentication recovery, and account synchronization conflict resolution.
- Counter Copy sharing, which transfers an independent copy through an account workflow rather than a backup file.
- Group-owned data and group activity.
- Activity History, undo/redo, and session statistics as portable data.
- Native filesystem guarantees beyond the browser's supported file download and selection behavior.

## Domain and Data Boundaries

### Backup Scopes

- **Counter Backup:** selected active personal counters, organization metadata needed by those counters, and optional linked scripts and per-counter Tally Super customizations.
- **Tally Super transfer:** complete workspace customization plus card density, grid columns, number size, bounds visibility, animations, and default new-counter color. It contains no counter data, per-counter customization, Trash, Trash behavior, or cloud Trash behavior.
- **All Tally Data:** the complete portable personal workspace: active personal Counter Bundles, retained personal Trash, explicit folders including empty folders, scripts, preferences, complete per-counter customization, and complete workspace customization.

All scopes exclude account credentials, authentication tokens, account identity, Counter Copy records, group-owned data, group activity, Activity History, undo/redo state, and session statistics.

### Export Inclusion Matrix

| Data area | Counter Backup | Tally Super transfer | All Tally Data |
| --- | --- | --- | --- |
| Selected active personal core counters | Included | Excluded | All included |
| Active Local Counter bundles | Included when selected | Excluded | Included |
| Retained Trash | Excluded | Excluded | Included |
| Local Counter designation | Included with its counter | Excluded | Included |
| Folder path and tags for included counters | Included | Excluded | Included |
| Complete explicit folder hierarchy, including empty folders | Excluded except organization represented by selected counters | Excluded | Included |
| Linked scripts | Optional for included counters | Excluded | Included |
| Per-counter Tally Super customization | Optional for included counters | Excluded | Included |
| Workspace Tally Super customization | Excluded | Included | Included |
| Card density | Excluded | Included | Included |
| Grid columns | Excluded | Included | Included |
| Number size | Excluded | Included | Included |
| Bounds visibility | Excluded | Included | Included |
| Animations | Excluded | Included | Included |
| Default new-counter color | Excluded | Included | Included |
| Theme and other personal preferences | Excluded | Excluded unless listed above | Included |
| Trash enabled preference | Excluded | Excluded | Included |
| Cloud Trash preference | Excluded | Excluded | Included |
| Activity History | Excluded | Excluded | Excluded |
| Undo/redo state | Excluded | Excluded | Excluded |
| Session statistics and baselines | Excluded | Excluded | Excluded |
| Account and authentication data | Excluded | Excluded | Excluded |
| Counter Copy records | Excluded | Excluded | Excluded |
| Group-owned data | Excluded | Excluded | Excluded |
| Embed publications or live links | Excluded | Excluded | Excluded |

## Detailed Behavior

### Common File Envelope

Every exported file identifies:

- a recognizable Tally backup format;
- a supported format version;
- exactly one scope: Counter Backup, Tally Super transfer, or All Tally Data;
- the export time; and
- the presence of optional sections relevant to that scope.

The envelope does not contain account credentials or imply that the file is encrypted. Export time is descriptive metadata and does not determine data precedence during import.

### Counter Backup Export

1. The user selects one or more active personal counters.
2. The export flow offers independent choices to include linked scripts and per-counter customizations.
3. Each optional choice applies only to data linked to selected counters.
4. The export contains the selected core counters and their folder and tag metadata.
5. A selected Local Counter is included deliberately and retains its Local Counter designation in the file.
6. Retained Trash, empty folders unrelated to selected counters, workspace customization, general preferences, and excluded data do not enter the file.
7. Export does not alter source counters, Local Counter designation, synchronization eligibility, scripts, or customization.

### Tally Super Transfer Export

- The export includes complete workspace customization and exactly these general presentation preferences: card density, grid columns, number size, bounds visibility, animations, and default new-counter color.
- It excludes all core counters and per-counter customization because individual counter layouts have no destination counter in this scope.
- It excludes retained Trash, Trash enabled behavior, and cloud Trash behavior.
- It excludes theme and personal preferences not explicitly listed for this scope.
- Export does not remove or reset current customization.

### All Tally Data Export

- The export includes every active personal Counter Bundle, including Local Counters.
- It includes every retained personal Counter Bundle and its retention metadata.
- It includes the complete explicit folder hierarchy, including empty folders.
- It includes every linked script, complete per-counter customization, complete workspace customization, and all personal preferences.
- It does not include any data category designated as excluded in the matrix.
- Running state is not a resumable automation instruction. Scripts represented in the file are restored as stopped.

### Import Selection and Inspection

1. The user chooses the import action corresponding to the intended scope and selects a file.
2. Tally parses and validates the file without changing current data.
3. Tally verifies that the declared scope matches the selected import operation.
4. Tally presents the file scope, export time, included sections, and the exact categories of current data that successful import will replace.
5. For Counter Backup files, script and per-counter customization import options appear only when the respective sections exist in the file.
6. The user chooses among available optional sections and receives a warning when scripts are present or selected.
7. Tally requires deliberate confirmation before replacement begins.

Selecting or inspecting a file is never confirmation and must not change current data.

### Import Replacement Matrix

| Import operation | Replaced current data | Preserved current data |
| --- | --- | --- |
| Counter Backup | Active personal counters and the organization represented by that active-counter scope; linked scripts and per-counter customization according to selected file options | Retained Trash, workspace Tally Super customization, preferences, account data, device-local activity records, sharing records, and group data |
| Tally Super transfer | Workspace Tally Super customization and the six listed presentation preferences | Active counters, retained Trash, per-counter customization, all other preferences, account data, device-local activity records, sharing records, and group data |
| All Tally Data | Active personal Counter Bundles, retained personal Trash, explicit folders, scripts, all preferences, complete per-counter customization, and complete workspace customization | Account and authentication data, Counter Copy records, group-owned data, Activity History, undo/redo, and session statistics |

For Counter Backup import, omitted or unselected optional script and customization sections do not preserve linked data from active counters being replaced. Imported counters are created without those omitted sections. Retained bundles remain untouched because retained Trash is outside Counter Backup scope.

Counter Backup replaces active counters but does not replace the destination's explicit folder records. Existing folders, including unrelated empty folders, remain. Each imported folder path reuses the existing normalized path when it matches exactly; otherwise, the missing path segments are created. Internally contradictory paths or sibling-name collisions that cannot be represented without ambiguity reject the import before replacement. Active counters that are replaced do not leave orphaned scripts or per-counter customizations behind.

### Transactional Import

Import is atomic from the user's perspective:

1. The entire selected file and selected optional sections are validated and normalized into a candidate replacement without mutating current data.
2. Tally checks identities, references, folder relationships, required sections, script language metadata, and customization structure across the complete candidate.
3. On confirmation, running scripts attached to data in the replacement scope are stopped before that scope is replaced.
4. The selected replacement scope and all of its internal references are committed as one transaction.
5. If any required persistence step fails, the complete pre-import workspace remains authoritative and no partial replacement is exposed.
6. Only after successful commit does the imported scope become current and receive ordinary local persistence and synchronization eligibility.

No counter, folder, preference, script, Trash record, or customization from a failed import may leak into the current workspace.

### Imported Script State

- Every imported script is stored as stopped, regardless of source runtime state or backup scope.
- Imported scripts retain their recorded language and are validated as that language.
- A script is never interpreted as another language to make validation pass.
- No imported script executes during file inspection, validation, normalization, confirmation, commit, or initial post-import render.
- Running a successfully imported script requires a separate explicit user action after import.
- The import flow warns that scripts from untrusted sources may be unsafe despite runtime isolation and resource limits.

### Identities and Organization

- Counter identities within the candidate import must be valid and unique.
- Folder identities and parent relationships must form a valid acyclic hierarchy.
- Counter folder references must resolve to an included or valid destination folder according to scope.
- Counter Backup imports preserve destination folder records, reuse exact normalized destination paths, create missing path segments represented by imported counters, and do not claim to restore empty folders absent from the file.
- All Tally Data restores explicit folders, including empty folders.
- Imported Local Counter designation remains effective even when its control is hidden while signed out.

### Post-Import Synchronization

- Import first changes the browser workspace; an account is not required.
- If the user is signed in, successfully imported synchronization-eligible data enters ordinary personal synchronization after the local transaction commits.
- Local Counter bundles remain excluded from cloud payloads after import.
- Retained non-local Trash from All Tally Data follows the current imported cloud Trash preference.
- A cloud failure after local commit does not roll back the successful local import; it enters synchronization error handling while leaving the browser copy usable.

### Feature Seams

- **Counter Bundles:** core counter, script, per-counter customization, Local Counter designation, and retained state travel according to the selected scope and options; no orphaned linked data is created.
- **Local Counters:** portable files are the deliberate cross-device transfer path and do not constitute cloud synchronization.
- **Trash:** only All Tally Data includes retained bundles and retention metadata. Counter Backup never replaces current Trash.
- **Folders and tags:** Counter Backup carries organization for selected active counters; All Tally Data carries the complete explicit hierarchy.
- **Tally Super:** per-counter customization travels only with Counter Backup opt-in or All Tally Data; workspace customization travels only with Tally Super transfer or All Tally Data.
- **Scripts:** scripts travel only with Counter Backup opt-in or All Tally Data and always import stopped.
- **Synchronization:** successful import supplies a new browser state to ordinary eligibility and conflict rules; import itself is account-independent.
- **Counter Copy:** backup import is file-based replacement of a declared scope, not account-addressed independent-copy acceptance.
- **Groups:** no group-owned record enters or is replaced by a personal backup.
- **Activity records:** import does not create eligible actions and never imports or replaces Activity History, undo/redo, or session statistics.

## Validation and Normalization

- The selected file must be valid JSON and match the recognizable backup envelope.
- Format version must be supported without guessing at unknown semantics.
- Declared scope must match required sections and the import action selected by the user.
- Required sections must exist, have expected types, and contain valid internal references.
- Counter records must have valid stable identities and finite numeric values; values and starts are normalized and clamped to imported hard limits.
- Reversed imported limits are normalized into ascending minimum and maximum order.
- Goals are finite, unique numeric values and are ordered by the counter's goal-direction rules when used.
- Blank counter names normalize to the untitled label rather than invalidating an otherwise valid counter.
- Folder hierarchy must reject cycles and unresolved structural corruption.
- A retained bundle whose five-day deadline has already passed is treated as expired during candidate normalization and is not restored as usable Trash data.
- Script records require a supported recorded language and valid source representation; they remain stopped.
- Unknown or obsolete optional Tally Super customization types are ignored safely only where the customization contract permits; they must not prevent valid core counter data from loading.
- Unsupported structure, malformed counter records, invalid required linked data, or unsafe ambiguity fails the whole import before replacement.
- Optional import controls are derived from actual validated file sections, not merely from untrusted envelope claims.

## Failure and Recovery

- Invalid JSON reports that the file cannot be parsed and changes nothing.
- Unsupported format version or scope reports the unsupported value and changes nothing.
- Missing required sections identify the missing area and change nothing.
- Malformed counters, folders, scripts, or required references identify the relevant record or section where safe and change nothing.
- Cancellation at inspection, options, warning, or confirmation leaves current data unchanged.
- A persistence failure during commit restores or retains the complete pre-import state and reports that import did not complete.
- A post-commit synchronization failure leaves the successful browser import visible and usable, reports synchronization failure separately, and permits retry.
- Export failure leaves source data unchanged and reports that no complete backup was produced.
- Browser download limitations are reported without claiming that a file was safely stored.
- Users are encouraged to retain an All Tally Data export before replacement, account deletion, or extensive workspace customization, but creating one is not required to import.

## Integrations and Dependencies

- Core counter validation defines numeric normalization, limits, goals, identity, folders, and tags.
- Counter Bundle rules define linked-data atomicity, Local Counter designation, and retained state.
- Tally Super defines valid workspace and per-counter customization sections.
- Script language validation and runtime safety define supported language identity and stopped-script handling.
- Personal browser persistence supplies the atomic current-workspace replacement boundary.
- Personal synchronization consumes the successfully committed browser state but is not required for export or import.
- Browser file APIs provide user-directed download and file selection.

## Privacy and Security

- Backup files may contain personal counter names, values, organization, scripts, preferences, and custom layouts and must be described as personal data.
- Files are not represented as encrypted unless encryption is actually provided by the export format.
- Backup content, filenames derived from personal data, and import details must not enter analytics.
- Account credentials, account identity, authentication tokens, private sharing secrets, group records, and group permissions are never exported.
- Importing a file never grants its creator access to the destination workspace.
- Script warnings explain that runtime isolation reduces risk but does not make untrusted source trustworthy.
- File parsing and validation occur before any imported script can execute or any current data can be replaced.

## Accessibility and Responsive Behavior

- Scope selection, file selection, optional inclusion controls, replacement summaries, warnings, confirmation, progress, success, and error states must be keyboard operable and programmatically named.
- Inclusion and replacement information must be available as text and not rely on icons, color, or table position alone.
- Confirmation identifies the selected scope and current data categories that will be replaced.
- Validation errors are announced and associate actionable information with the file or affected section.
- Script trust warnings are perceivable before confirmation.
- Backup and restore flows work from 320 CSS pixels through desktop widths, with matrices or summaries adapting without horizontal loss of required information.
- Light and dark themes retain legible contrast, and nonessential progress motion respects motion preferences.

## Acceptance Scenarios

1. **Given** selected active personal counters include a Local Counter, **When** Counter Backup is exported without optional linked data, **Then** the file includes the selected core counters, Local Counter designation, folder paths, and tags but excludes scripts, per-counter customization, Trash, and workspace customization.
2. **Given** selected counters have scripts and per-counter customization, **When** both Counter Backup options are enabled, **Then** only linked data for those selected counters is included.
3. **Given** workspace customization and varied personal preferences, **When** Tally Super transfer is exported, **Then** it includes workspace customization and the six listed presentation preferences while excluding per-counter customization, counters, Trash behavior, cloud Trash behavior, theme, and other preferences.
4. **Given** active counters, Local Counters, retained Trash, empty folders, scripts, preferences, and complete Tally Super data, **When** All Tally Data is exported, **Then** all those portable personal areas are included and device-local activity, account, sharing, and group data are excluded.
5. **Given** any export scope, **When** the file is produced, **Then** it identifies format version, scope, export time, and relevant optional sections.
6. **Given** a Counter Backup contains scripts but no per-counter customization, **When** it is inspected for import, **Then** the script option appears, the customization option does not, and no data has changed.
7. **Given** valid JSON declares the wrong scope for the selected import action, **When** validation runs, **Then** import is rejected with an actionable scope error and current data remains unchanged.
8. **Given** a malformed counter appears after several valid records in a file, **When** import validation runs, **Then** the entire import fails and none of the valid records partially replace current data.
9. **Given** a valid Counter Backup and existing retained Trash, **When** the user confirms import, **Then** the active-counter scope is replaced according to selected options and retained Trash remains unchanged.
10. **Given** a Counter Backup contains a counter in `Work/Clients` and the destination already contains that folder plus an unrelated empty folder, **When** import succeeds, **Then** the imported counter uses the existing `Work/Clients` path and the unrelated empty folder remains.
11. **Given** a valid Tally Super transfer, **When** import succeeds, **Then** workspace customization and the six listed preferences are replaced while counters, per-counter customization, Trash preferences, and other personal preferences remain unchanged.
12. **Given** a valid All Tally Data file and current account, group, Activity History, undo/redo, and session-statistic data, **When** import succeeds, **Then** the complete portable personal workspace is replaced and every excluded current area remains unchanged.
13. **Given** imported scripts were running when exported, **When** any supported import completes, **Then** every imported script is stopped and none runs until an explicit user action.
14. **Given** a script from an unfamiliar source is selected for import, **When** confirmation is presented, **Then** a perceivable untrusted-script warning appears before data replacement.
15. **Given** persistence fails while committing a validated import, **When** the failure is handled, **Then** the complete pre-import workspace remains authoritative and no imported record is exposed.
16. **Given** local import commits successfully while the user is signed in and cloud synchronization then fails, **When** the error appears, **Then** the imported browser workspace remains usable and synchronization can retry separately.
17. **Given** imported numeric values exceed imported hard limits, **When** candidate validation completes, **Then** current and starting values are clamped before the atomic commit.
18. **Given** an All Tally Data file contains retained Local Counter bundles, **When** it is imported on another browser, **Then** those bundles remain retained and local-only and do not enter cloud payloads.
19. **Given** the user cancels at the replacement confirmation, **When** the flow closes, **Then** counters, Trash, scripts, preferences, customization, and activity records are all unchanged.
20. **Given** an All Tally Data file contains a retained bundle whose five-day deadline has passed, **When** candidate normalization completes, **Then** the expired bundle is not restored into usable Trash.

## Sources

- [PRD: Product Principles - Portable by Default](../product-specification.md#portable-by-default)
- [PRD: Domain Vocabulary - Counter Backup](../product-specification.md#counter-backup)
- [PRD: Backup and Restore Requirements - Backup Scopes](../product-specification.md#backup-scopes)
- [PRD: Backup and Restore Requirements - Import Behavior](../product-specification.md#import-behavior)
- [PRD: Core Counter Requirements - Limits](../product-specification.md#limits)
- [PRD: Automation Requirements - Runtime Behavior](../product-specification.md#runtime-behavior)
- [PRD: Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [Backups guide](../../src/content/guide/backups.mdx)
- [Backup export guide](../../src/content/guide/backup-export.mdx)
- [Backup import guide](../../src/content/guide/backup-import.mdx)
- [Backup tutorial](../../src/content/guide/tutorial-backups.mdx)
- [Tally Super data guide](../../src/content/guide/tally-super-data.mdx)
- [App Settings guide](../../src/content/guide/app-settings.mdx)
- [Local Counters guide](../../src/content/guide/local-counters.mdx)
- [Scripting guide](../../src/content/guide/scripting.mdx)
