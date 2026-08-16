# Synchronization, Backup, and Portability

## Purpose

Close the report findings that can disclose Local Counter data, silently discard synchronized or imported workspace sections, overstate cloud durability, or prevent a clean deployment from enforcing the documented ownership boundaries.

## Existing Feature Sources

- [Accounts and Personal Synchronization](../accounts-and-personal-sync.md)
- [Backup and Restore](../backup-and-restore.md)
- [Counter Bundles, Local Counters, and Trash](../counter-bundles-local-trash.md)
- [Personal Workspace Organization](../personal-workspace-organization.md)
- [Automation Runtime](../automation-runtime.md)
- [Tally Super](../tally-super.md)
- [Experience, Security, and Verification](../experience-security-verification.md)

## Shared Contract

One validated synchronization-eligible workspace projection governs cloud payloads, material comparison, conflict choices, ongoing synchronization, and final persistence. One validated backup candidate governs preview and replacement. Both boundaries preserve complete Counter Bundles and exclude data outside their declared scope by construction.

## Findings and Required Behavior

### GAP-001 Local Counter Bundle Isolation

**Current evidence:** Cloud payloads filter Local Counter core records but upload complete script and Tally Super maps; cloud application replaces whole maps and can delete browser-only linked state. See `src/pages/CountersPage.tsx:323-438`, `400-412`, `467-479`, and `740-763`.

**Required behavior:** Cloud projection excludes every active or retained Local Counter core record, linked script, per-counter customization, retained metadata, and Local-Counter-specific workspace reference. Cloud discovery, use-cloud, keep-device, merge, ordinary writes, cloud Trash changes, and exit persistence all use the same projection. Applying eligible cloud state reattaches and preserves all excluded browser records unchanged.

**Acceptance:** Inspection of every cloud request and conflict result proves that no Local Counter identifier, script source, customization, retained state, or specific workspace reference leaves the browser, while all remain usable after each conflict choice. This also closes SPEC-005.

### GAP-005 Complete Conflict Scope

**Current evidence:** Material differences and merge cover active non-local counters while scripts, preferences, explicit folders, eligible Trash, and Tally Super data can be overwritten silently. See `src/pages/CountersPage.tsx:323-462`.

**Required behavior:** Conflict comparison covers normalized eligible Counter Bundles, explicit folders including empty folders, preferences, eligible retained Trash, and workspace Tally Super data. Keep device, use cloud, and merge operate atomically over that same scope. Divergent bundles preserve both versions with their own linked records; singleton conflicts require explicit resolution; excluded browser data survives every choice.

**Acceptance:** A two-device workspace differing independently in every eligible section enters conflict, presents all material differences, and resolves without dropping either divergent bundle, any empty folder, usable preference/customization value, eligible Trash, or excluded local data.

### GAP-006 Versioned Recoverable Synchronization

**Current evidence:** Ongoing writes are unconditional row upserts without revision checks, durable pending work, connectivity recovery, or acknowledged-state tracking. See `src/pages/CountersPage.tsx:463-496` and `supabase.sql:1-8`.

**Required behavior:** Each acknowledged cloud state has a revision. Writes compare against the acknowledged revision; concurrent divergence is preserved or enters explicit conflict rather than overwriting. Eligible browser changes enter a durable local queue before delivery. Retries retain operation identity, connectivity recovery resumes automatically, and only acknowledgement advances the known synchronized state.

**Acceptance:** Concurrent devices editing separate and same records, uncertain responses, reload while pending, and offline-to-online recovery never require change recreation, never apply one operation twice, and never silently discard a usable version.

### GAP-007 Truthful Synchronization Status

**Current evidence:** The footer reports synchronization whenever a session exists, including loading, saving, conflict, offline, and error; unload persistence is an untracked best-effort request. See `src/pages/CountersPage.tsx:704-793` and `1328-1333`.

**Required behavior:** The interface distinguishes browser-saved local-only, loading, saving/pending, acknowledged synchronized, offline qualification, conflict, and error. Controlled in-app navigation with active scripts records them stopped locally, displays final-save progress, and on bounded failure offers retry or continue with the browser copy preserved. Browser close/reload remains best effort and is never presented as guaranteed.

**Acceptance:** Simulated pending, offline, rejected, conflicting, timed-out, and acknowledged writes produce only their accurate states and actions. Reload never resumes a script and never converts an unacknowledged write into a synchronized claim. Together with GAP-002, this closes SPEC-004.

### GAP-008 Exact Backup Scopes

**Current evidence:** Counter Backup exports all active counters and complete global linked maps; All Tally Data omits Trash, explicit folders, and theme; Tally Super transfer includes the whole preferences object including Trash settings. See `src/features/settings/AppSettings.tsx:31-49` and `src/App.tsx:35-40`.

**Required behavior:** Counter Backup contains only selected active counters, their represented organization metadata, and optionally only their linked scripts and per-counter customizations. Tally Super transfer contains workspace customization plus exactly card density, grid columns, number size, bounds visibility, animations, and default color, excluding Trash behavior. All Tally Data contains all active and retained bundles, explicit folders, scripts, preferences including theme and Trash settings, and complete counter/workspace customization while excluding account, sharing, group, history, undo/redo, and statistics.

**Acceptance:** Each exported envelope identifies format, version, scope, and time; decoded contents match the inclusion matrix exactly; unrelated counters or private sections are absent; an All Tally Data round trip reproduces the portable workspace.

### GAP-009 Validated Atomic Import

**Current evidence:** Import does not validate format, version, scope, complete numeric records, hierarchy, language, or cross-references; it mutates React stores separately and clears history and redo. See `src/pages/CountersPage.tsx:794-890`.

**Required behavior:** Parse and validate the complete selected candidate before mutation, including envelope, supported version and scope, required sections, finite normalized records, unique identities, folder hierarchy, script language/source contract, customization types, and cross-section references. Preview exact replacement categories and optional linked sections, warn about untrusted scripts, require confirmation, and commit the selected scope atomically. Imported scripts are stopped. Device-local history, undo/redo, and statistics remain unchanged.

**Acceptance:** Every invalid candidate leaves the prior workspace byte-for-byte authoritative; cancellation changes nothing; an injected commit failure rolls back the whole replacement; valid scope imports replace only previewed categories and never execute a script.

### GAP-013 Reproducible Database Deployment

**Current evidence:** The documented migration command starts with migrations that alter `profiles` and `counter_shares` before any migration creates the base schema; those definitions exist only in `supabase.sql`. See `README.md:123-138`, `supabase/migrations/20260802163542_account_sharing_settings.sql`, and `supabase.sql:1-183`.

**Required behavior:** The versioned migration chain can create the complete personal synchronization, account profile, Counter Copy, group, folder, activity, function, trigger, index, and RLS schema from an empty supported Supabase project. It applies in deterministic order, preserves ownership and membership checks, and makes the documented setup path sufficient without manual reference-SQL assembly.

**Acceptance:** Applying migrations to a clean database succeeds, applying the supported repeat/development workflow remains safe, and multi-user authorization tests prove personal ownership, copy roles, group membership, granular permission, secret isolation, atomicity, and retry boundaries. This also closes SPEC-001.

## Combined Acceptance

From a clean migrated deployment, two devices begin with materially different workspaces containing Local Counters, non-local active and retained bundles, empty folders, scripts, preferences, and customizations. They resolve initial conflict, edit concurrently, go offline, reload, and recover without data loss or false status. No Local Counter data enters inspected payloads. Each backup scope contains exactly its contract, invalid imports change nothing, and All Tally Data restores the complete portable workspace with scripts stopped.

## Sources

- [PRD: Accounts and Personal Synchronization](../../product-specification.md#accounts-and-personal-synchronization)
- [PRD: Backup and Restore Requirements](../../product-specification.md#backup-and-restore-requirements)
- [PRD: Data and Security](../../product-specification.md#data-and-security)
- Target-to-Codebase Gap Report findings 1, 5, 6, 7, 8, 9, and 13
- Code-Problems Report SPEC-001, SPEC-004, and SPEC-005
