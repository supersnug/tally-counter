# Personal Workspace Organization

## Purpose

Define how a user organizes and finds active personal counters through explicit nested folders, tags, search, filtering, and workspace presentation preferences while preserving account-free, local-first use.

## User Outcomes

- A user can keep any number of personal counters understandable as the workspace grows.
- Empty and populated folder structures remain intentional user-owned data.
- Counters can be found by name, folder, or tag without altering their values or organization.
- Search and tag filters clearly distinguish no matching counters from an empty folder.
- Presentation preferences adapt the workspace for desktop and mobile without changing counter semantics.
- Organization remains portable and, when eligible, synchronized without uploading Local Counter bundles.

## Scope

- Explicit nested personal folders, including empty folders.
- Counter placement in at most one folder path.
- Multiple unique tags on a personal counter.
- Moving counters between folders and moving folders within the hierarchy.
- Folder deletion behavior.
- Search by counter name, folder, or tag.
- Tag filtering and combined discovery states.
- Workspace preferences for theme, card density, grid columns, number size, bounds visibility, animations, default new-counter color, Trash behavior, and cloud Trash behavior.
- Organization contracts with counter identity, synchronization, backup, Trash, and workspace customization.

## Out of Scope

- Numeric counter rules, goals, limits, progress, and accepted value transitions.
- Activity History, charts, undo/redo, and statistics.
- Trash retention, expiration, restoration, and permanent-deletion mechanics.
- Account lifecycle, synchronization transport, and conflict-resolution interaction.
- Backup file parsing and replacement workflows.
- Group-owned folders and group permissions.
- Tally Super element placement and transforms.
- Script execution, sharing, and embeds.

## Domain and Data Boundaries

### Personal Workspace

A personal workspace contains active personal counters, explicit personal folders, organization metadata, and preferences. It may contain both synchronization-eligible counters and Local Counter bundles. Personal workspace organization MUST remain separate from every group-owned workspace.

### Explicit Folder Record

A folder is an explicit record with a stable identity, a user-visible name, and either a parent folder identity or the workspace root as parent. A folder's existence MUST NOT be inferred only from counter paths; therefore, empty folders survive save, synchronization, export, import, and unrelated counter deletion where those operations include folders.

### Counter Organization Contract

An active personal counter may reference zero or one folder identity and zero or more unique tags. The stable counter identity is the seam to the core counter record. Folder and tag changes MUST NOT alter counter identity, numeric state, Activity History, scripts, or per-counter customization.

A folder path is the ordered list of folder names from the root to the referenced folder. Paths are derived for display and search; folder identity, not path text, is authoritative for relationships.

### Local Counter and Synchronization Seam

The complete folder structure, including empty folders, is synchronization-eligible. Organization attached exclusively to a Local Counter MUST NOT cause any part of that Counter Bundle to enter cloud payloads. Folder records may synchronize independently because they are workspace organization, but synchronized payloads MUST omit references that reveal a Local Counter identity or its counter metadata. Activity History, undo/redo, and session statistics are never organization payloads.

### Trash Seam

Active-workspace organization applies to active personal counters. Deleting a counter passes its organization metadata with the complete Counter Bundle into retained deleted state when Trash is enabled. A retained counter is absent from active folder results and active-counter counts. Restoration returns the bundle to the active workspace, preserving a valid folder reference when possible and resolving invalid references without losing the counter.

## Detailed Behavior

### Folder Creation

- A user MAY create a folder at the workspace root or inside another folder.
- Folder creation MUST produce an explicit record even when no counter is assigned to it.
- A folder receives a stable identity independent of its name or location.
- Folder names are user-visible path segments and MUST be nonblank after normalization.
- Sibling folder names MUST be distinguishable under the product's name-comparison rules.
- Creating or renaming a folder MUST NOT create, move, or modify a counter unless the user separately requests a move.

### Folder Hierarchy Rules

- The hierarchy MUST be acyclic.
- A folder MUST NOT be moved into itself or any of its descendants.
- Moving a folder changes its parent reference while retaining its identity, descendants, and assigned counters.
- Moving a folder carries its complete subtree as one hierarchy operation.
- A failed folder move leaves the previous hierarchy intact.
- The workspace root is not a deletable or movable folder.

### Counter Placement

- An active personal counter MAY be unfiled at the workspace root or assigned to one folder.
- Moving a counter changes only its folder reference.
- Moving a counter into an existing folder MUST NOT create a duplicate counter or change stable identity.
- A counter cannot simultaneously occupy multiple folder paths.
- Tags provide cross-cutting organization and do not imply folder placement.

### Folder Deletion

- Deleting a folder deletes that explicit folder record, not its counters.
- Counters assigned directly to the deleted folder move to the deleted folder's parent.
- Direct child folders also move to the deleted folder's parent, preserving each child's subtree.
- If moving children would create a sibling-name collision, deletion MUST require explicit collision resolution or fail without changing the hierarchy; it MUST NOT merge folders silently.
- Folder deletion MUST NOT delete, trash, renumber, or otherwise mutate any counter.
- Deleting an empty folder removes only that folder record.

### Tags

- A personal counter MAY have multiple tags.
- Tags MUST be unique within one counter after normalization.
- Adding or removing a tag MUST NOT change counter identity, folder placement, or numeric state.
- A tag may be shared by any number of counters.
- A tag with no assigned counters need not remain as an independent workspace record.
- Tag display and matching MUST preserve a stable user-understandable spelling while applying consistent comparison rules.

### Search

- Search examines active personal counters by counter name, assigned folder path, and tags.
- Search matching MUST be case-insensitive and ignore leading and trailing query whitespace.
- An empty normalized query applies no search restriction.
- A counter matches when any searchable field contains the normalized query.
- Folder matching includes each visible segment of the assigned folder path.
- Search MUST NOT expose retained Trash counters, group-owned counters, or data from another account.
- Search changes only the visible result set; it MUST NOT mutate counters or organization.

### Tag Filtering

- Users MAY select one tag filter from tags represented by active personal counters.
- The selected tag includes counters carrying that normalized tag and replaces any previously selected tag filter.
- Search and tag filtering combine by intersection: a visible counter must satisfy both the search query and active tag filter.
- Clearing the tag filter restores results still permitted by folder context and search.

### Folder Context and Result States

- Selecting a folder establishes that folder as the browsing context.
- Without search or a tag filter, a selected folder shows counters assigned directly to it and its direct child folders.
- Search or tag filtering evaluates counters assigned to the selected folder and every descendant folder; results retain enough folder-path context to show where each matching counter belongs.
- An empty folder state means the selected folder has no directly assigned counters and no child folders before search or tag restrictions.
- A no-matches state means counters exist in the selected folder or its descendants but none satisfy active search or tag restrictions.
- The interface MUST identify active search and filters and provide a direct way to clear them from a no-matches state.
- A workspace with no active counters and no folders is a distinct empty-workspace state with a clear counter-creation action.

### Workspace Preferences

- Theme supports light and dark presentation and applies consistently across the landing page, personal workspace, and guide surfaces.
- Counter-card density provides distinct compact, comfortable, and spacious presentations.
- Grid-column preference specifies the desired number of columns when available width permits; responsive constraints MAY reduce the rendered count to preserve usability.
- Number-size preference provides distinct small, standard, and large counter-value presentation.
- Bounds visibility controls whether optional minimum and maximum information appears on standard cards without changing the limits themselves.
- Animation preference controls nonessential product motion without suppressing necessary state communication.
- Default new-counter color supplies the initial valid color for subsequent counter creation and does not recolor existing counters.
- Trash is enabled by default. Disabling it changes future personal counter deletion into a confirmed permanent-deletion flow; it MUST NOT itself permanently delete retained counters.
- Cloud Trash behavior is meaningful only for signed-in, retained, non-local Trash and MUST NOT upload Local Counter bundles.
- Preference changes MUST NOT alter counter values, history, statistics, folder placement, or tags unless the preference explicitly governs that behavior.

### Active Counter Summaries

- An active-counter count includes active personal counters in the stated workspace or filtered scope and excludes retained Trash and group-owned counters.
- Completed-goal counts are derived from core counter goal state, not from folder or tag metadata.
- Tally Super MAY present these summaries as live workspace content but MUST use the same scope and definitions as the standard workspace.

## Validation and Normalization

- Folder names MUST trim surrounding whitespace and reject or replace blank results with a clear untitled-folder label according to one consistent product rule.
- Folder names MUST reject path separators or control characters that would make displayed paths ambiguous.
- Folder parent references MUST resolve to an existing explicit folder or the workspace root.
- Cyclic, self-parented, and orphaned relationships MUST NOT be accepted as valid hierarchy mutations.
- A counter folder reference MUST resolve to an existing folder or normalize to the workspace root during validated import or recovery.
- Tag input MUST trim surrounding whitespace, reject blank tags, and deduplicate tags using case-insensitive comparison.
- Search input MUST be treated as text, never executable syntax.
- Preference values MUST be members of their documented choices or normalize to safe defaults.
- Imports MUST validate folder identities, parent relationships, counter references, and preferences before replacing the selected scope.

## Failure and Recovery

- Malformed hierarchy data MUST NOT prevent the workspace from opening. Recoverable valid folders and counters remain available, and orphaned counters fall back to the workspace root with a visible recovery notice when needed.
- A failed create, rename, move, tag, or delete operation MUST leave the last valid organization state intact.
- A synchronization error leaves browser organization usable and visible and permits synchronization to resume after network recovery.
- Materially different device and cloud organization MUST NOT be silently overwritten. Conflict choices and merge behavior apply only to synchronization-eligible data and preserve Local Counter bundles.
- Merge MUST preserve explicit empty folders and both divergent usable counter versions with distinguishable identities where automatic reconciliation is unsafe.
- Invalid or unsupported preference values MUST fall back to safe, usable presentation without hiding required actions.
- If a saved column or density preference cannot fit the viewport, responsive presentation MUST temporarily adapt without destroying the saved preference.

## Integrations and Dependencies

- **Core Counter Engine:** supplies stable personal counter identities, names, colors, limits, and goal-completion state; organization never changes numeric semantics.
- **Activity History and Statistics:** receives counter identity independently of folder and tag changes; moving or retagging a counter does not rewrite prior activity. Active-counter and completed-goal summaries use the explicit scope rules in this document.
- **Personal synchronization:** includes explicit folder structure, preferences, and organization for eligible counters; excludes Local Counter bundle references and all activity data.
- **Backup and restore:** Counter Backup includes selected active counters with folder and tag metadata; All Tally Data includes explicit folders and preferences; validated replacement affects only the selected scope.
- **Trash:** owns retained deleted state, countdown, restore, expiration, and permanent deletion while preserving the complete Counter Bundle and its recoverable organization metadata.
- **Tally Super:** may place counters and live summaries on workspace surfaces; standard Settings remains available, and custom layouts cannot make organization or required counter actions irrecoverable.
- **Groups:** group folders are separate group-owned records and MUST NOT appear in or be mutated through personal organization.

## Privacy and Security

- Counter names, folder names, tags, values, and personalized workspace content MUST NOT appear in analytics.
- Local Counter identities and bundle metadata MUST be omitted from cloud payloads.
- Personal cloud organization records MUST enforce account ownership.
- Search MUST operate only over data the current user is authorized to view and MUST NOT leak hidden, trashed, group, or other-account metadata through suggestions or counts.
- Backup files containing organization and counter metadata are personal data and MUST be presented as files the user should store and transfer safely.
- Browser code MUST receive only credentials intended for public clients.

## Accessibility and Responsive Behavior

- Folder creation, navigation, move, rename, delete, search, filters, and preference controls MUST be keyboard operable and have understandable names.
- Hierarchy depth and parent-child relationships MUST have semantic or textual representation, not indentation alone.
- Empty, no-matches, loading, offline, synchronization, conflict, and error states MUST be distinguishable without relying only on color.
- Search and filter status MUST be announced or otherwise perceivable when results change.
- Theme and layout controls MUST remain usable from 320 CSS pixels through desktop widths.
- Compact, comfortable, and spacious card modes MUST preserve complete primary counting controls and accessible focus targets.
- Light and dark themes MUST retain legible contrast for folder selection, tags, filters, focus, and status.
- Responsive column reduction MUST avoid horizontal clipping of required actions.
- Nonessential folder, filter, and layout motion MUST respect reduced-motion and animation preferences.

## Acceptance Scenarios

1. **Given** an empty personal workspace, **When** the user creates a folder with no counters, **Then** an explicit empty folder with stable identity appears and remains part of the workspace data.
2. **Given** folder `Projects` containing child folder `2026` and a counter in `2026`, **When** `Projects` moves under `Archive`, **Then** both folders retain identity, the subtree remains intact, and the counter path becomes `Archive/Projects/2026`.
3. **Given** folder `A` contains counter `One` and child folder `B`, **When** `A` is deleted, **Then** `One` and `B` move to `A`'s parent and no counter enters Trash.
4. **Given** a requested folder move would place a folder inside its descendant, **When** the move is validated, **Then** it fails and the hierarchy remains unchanged.
5. **Given** a counter in `Work/Clients` tagged `urgent` and `calls`, **When** the user searches `client` and filters by `urgent`, **Then** the counter is visible because its folder path and tag satisfy the combined restrictions.
6. **Given** a selected folder contains counters but none match the active query, **When** results are shown, **Then** the state says there are no matches and offers to clear restrictions rather than describing the folder as empty.
7. **Given** a selected folder has no directly assigned counters, no child folders, and no active restrictions, **When** it is opened, **Then** the interface identifies an empty folder rather than no matches.
8. **Given** tags `Ideas` and ` ideas ` are submitted for one counter, **When** tags are normalized, **Then** one user-visible tag remains.
9. **Given** a folder contains no direct counters but a descendant counter matches an active tag, **When** that tag filter is selected from the folder, **Then** the descendant counter appears with its folder context.
10. **Given** a counter moves between folders, **When** its organization is saved, **Then** its stable identity, value, linked script, customization, and prior activity remain unchanged.
11. **Given** a signed-in workspace contains a Local Counter in an otherwise synchronized folder, **When** organization synchronizes, **Then** the folder may synchronize but no Local Counter identity or bundle metadata enters the payload.
12. **Given** a Counter Backup selects counters from nested folders, **When** it is exported, **Then** their required folder and tag metadata is included without unrelated active counters.
13. **Given** malformed imported hierarchy contains a cycle, **When** validation runs, **Then** replacement is rejected with an actionable error and current workspace organization remains intact.
14. **Given** a user selects a desktop grid preference of four columns, **When** the workspace is viewed at 320 CSS pixels, **Then** the rendered columns reduce as needed while the saved preference and all required controls remain available.
15. **Given** Trash is disabled, **When** a user requests personal counter deletion, **Then** organization passes the complete bundle to confirmed permanent deletion and does not remove it before confirmation.
16. **Given** device and cloud contain different nonempty folder structures, **When** synchronization detects the conflict, **Then** the user receives explicit resolution choices and Local Counter bundles remain untouched.

## Sources

- [Product Summary](../product-specification.md#product-summary)
- [Product Principles](../product-specification.md#product-principles)
- [Domain Vocabulary](../product-specification.md#domain-vocabulary)
- [Personal Workspace Requirements](../product-specification.md#personal-workspace-requirements)
- [Accounts and Personal Synchronization](../product-specification.md#accounts-and-personal-synchronization)
- [Backup and Restore Requirements](../product-specification.md#backup-and-restore-requirements)
- [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [Experience and Quality Requirements](../product-specification.md#experience-and-quality-requirements)
- [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- [Introduction guide](../../src/content/guide/introduction.mdx)
- [App settings guide](../../src/content/guide/app-settings.mdx)
- [Appearance settings guide](../../src/content/guide/appearance-settings.mdx)
- [Settings tutorial](../../src/content/guide/tutorial-settings.mdx)
- [Local counters guide](../../src/content/guide/local-counters.mdx)
- [Account synchronization guide](../../src/content/guide/account-sync.mdx)
- [Backups guide](../../src/content/guide/backups.mdx)
- [Backup export guide](../../src/content/guide/backup-export.mdx)
- [Backup import guide](../../src/content/guide/backup-import.mdx)
- [Trash guide](../../src/content/guide/trash.mdx)
- [Trash and Local Counters guide](../../src/content/guide/trash-local.mdx)
- [Trash and Local Counter tutorial](../../src/content/guide/tutorial-trash-local.mdx)
- [Tally Super workspace guide](../../src/content/guide/tally-super-workspace.mdx)
- [Tally Super data guide](../../src/content/guide/tally-super-data.mdx)
