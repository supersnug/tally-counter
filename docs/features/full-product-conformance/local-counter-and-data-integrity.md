# Local Counter and Data Integrity

## Purpose

Close the report findings that prevent personal and group counters from sharing one finite, normalized transition model and prevent personal workspaces from preserving complete Counter Bundles, trustworthy activity, stable organization, and recoverable browser state.

## Existing Feature Sources

- [Core Counter Engine](../core-counter-engine.md)
- [Counter Bundles, Local Counters, and Trash](../counter-bundles-local-trash.md)
- [Activity History and Statistics](../activity-history-and-statistics.md)
- [Personal Workspace Organization](../personal-workspace-organization.md)
- [Automation Runtime](../automation-runtime.md)
- [Experience, Security, and Verification](../experience-security-verification.md)

## Shared Contract

Every accepted current-value mutation, regardless of entry point or ownership context, passes through one finite normalization and transition contract. Every personal lifecycle operation acts on the complete Counter Bundle. Browser persistence failures and malformed records preserve usable in-memory and valid persisted data rather than silently substituting arbitrary values or clearing unrelated state.

## Findings and Required Behavior

### GAP-012 Atomic Counter Bundle Lifecycle

**Current evidence:** Automatic expiration and Trash-disabled deletion remove only core records; collision restoration updates only the counter identity. See `src/pages/CountersPage.tsx:100-108`, `254-265`, `964-989`, and `1521-1530`.

**Required behavior:** Trash movement, retained editing, restoration, expiration, and permanent deletion update the core counter, linked script, per-counter Tally Super customization, retained metadata, running execution, and applicable history association as one bundle operation. Collision-safe restoration remaps every linked identity and never overwrites an unrelated bundle. All permanent-deletion paths stop execution and remove every linked record.

**Acceptance:** Expiration, confirmed Trash-disabled deletion, explicit Trash deletion, and collision restoration each leave either one complete valid bundle or no bundle, with no orphaned scripts, customizations, retained metadata, or execution.

### GAP-014 Authoritative Numeric Normalization

**Current evidence:** `sanitize` can throw for malformed names, replace rejected values with zero, retain non-finite bounds, and permit infinite steps; local records lack record validation; group RPCs mutate JSON under different rules. See `src/features/counters/model.ts:95-116`, `src/pages/CountersPage.tsx:93-108`, and `supabase/migrations/20260802172745_shared_counter_groups.sql:326-474`.

**Required behavior:** Direct controls, editors, scripts, imports, copies, embeds, undo/redo, limit edits, and group operations accept only finite numeric records; normalize step magnitudes with zero becoming one; order reversed limits; clamp current and start; deduplicate finite goals; normalize blank names; validate color; and preserve prior valid state when an edit cannot be interpreted. Group exact-value, jump, and limit changes obey the same hard limits as personal changes.

**Acceptance:** Equivalent input through every mutation source produces the same normalized record and transition. `NaN`, infinities, malformed fields, and unsupported values never become authoritative and never cause arbitrary zero substitution. This also closes SPEC-006.

### GAP-015 Complete Transition Contract

**Current evidence:** Quick limit changes clamp without history, editor clamps are generic sets, jumps are staged editor changes, and scripts replace complete records. See `src/pages/CountersPage.tsx:531-535`, `597-620`, and `891-919`, plus `src/features/counters/CounterEditor.tsx:592-621`.

**Required behavior:** Every accepted current-value change emits one stable transition identity, counter identity, previous and resulting values, occurrence time, and accurate kind: positive, negative, reset, direct set, jump, limit-induced clamp, script publication, undo, or redo. Unchanged and rejected attempts emit none. Loading and import replacement do not manufacture activity.

**Acceptance:** The same transition identity survives retries, every visible accepted value change is explainable by one accurate event, and history, statistics, synchronization publication, and group activity consume it no more than once.

### GAP-017 Append-Only Undo and Redo

**Current evidence:** Undo removes the original history item and directly assigns its prior value; redo can violate current limits; a new action clears one global redo stack. See `src/pages/CountersPage.tsx:497-585` and `901-905`.

**Required behavior:** Original history is immutable. Undo and redo request normalized transitions against current limits and append their own events. New non-redo work clears only the superseded redo path for the affected counter; another counter's redo path remains available.

**Acceptance:** Charts retain the original action and append undo/redo facts, current limits are never bypassed, statistics include eligible undo/redo transitions, and independent counter redo paths do not erase each other.

### GAP-018 History, Statistics, and Retention

**Current evidence:** Retained-counter changes create no history; import clears history and redo; Clear History is immediate and changes statistics because both share one array; malformed history is trusted and only the newest 1,000 entries survive. See `src/pages/CountersPage.tsx:114-121`, `497-517`, `854-858`, `1019-1032`, and `1462-1472`, plus `src/features/history/HistoryModal.tsx:67`.

**Required behavior:** Eligible retained-counter transitions enter device-local history but not active-counter statistics. Import replacement does not clear Activity History or undo/redo. History deletion is confirmed and supports all-history or selected-counter scope. Statistic baselines are independent from history storage. Invalid history records are quarantined while valid records remain available; any retention policy is explicit and cannot silently falsify the documented history model.

**Acceptance:** Clearing selected history leaves other counters and statistic values unchanged; importing leaves device-local activity intact; retained changes appear in history with the right statistical treatment; malformed entries cannot block or corrupt valid activity.

### GAP-025 Browser Storage Failure and Recovery

**Current evidence:** Local-storage writes are unguarded and reads generally trust parsed shapes after JSON parsing. See `src/App.tsx:35-40` and `src/pages/CountersPage.tsx:93-204`, `227-278`.

**Required behavior:** Quota, security, serialization, malformed-array, and malformed-record failures cannot crash the workspace. Failed writes leave the in-memory workspace usable and visibly unsaved. Reads validate sections and records, isolate invalid data, preserve valid recoverable data, and offer an understandable recovery action without silently replacing the workspace with defaults.

**Acceptance:** Injected write failures and mixed valid/malformed storage both allow continued local counting, identify unsaved or quarantined data, and retain all independently valid records.

### GAP-029 Correct Goal Progress

**Current evidence:** The first segment always anchors on the starting value, does not fall back to an incomplete-side limit, and displayed next/final/maximum percentages are not consistently clamped. See `src/features/counters/CounterCard.tsx:99-116` and `260-297`.

**Required behavior:** Previous milestones anchor later segments. Before the first milestone, start anchors only from the incomplete side; otherwise an applicable hard limit anchors; with neither, progress is zero before completion and 100 at completion. Next, final, maximum, compact, standard, Super, guide, and embed presentations use shared calculations and display only 0 through 100 percent.

**Acceptance:** More Than and Less Than counters with starts on either side, optional limits, crossed goals, and values beyond completion show the same bounded result on every surface. This also closes SPEC-007.

### GAP-030 Stable Folder and Tag Organization

**Current evidence:** Folders are path strings without stable identity or rename; empty folders do not synchronize or back up; deleting a parent removes descendants and flattens counters; tags deduplicate case-sensitively. See `src/pages/CountersPage.tsx:82-142` and `1054-1117`, plus `src/features/counters/model.ts:103-107`.

**Required behavior:** Personal folders have stable identities and parent relationships, including empty folders. Rename and movement preserve descendants and references. Deleting one folder moves direct counters and direct child folders to its parent while preserving each subtree. Tags compare case-insensitively while preserving selected display spelling. Persistence, synchronization, conflict merge, and All Tally Data retain the complete hierarchy.

**Acceptance:** Nested empty and populated folders survive reload, sync, conflict, export/import, rename, movement, and parent deletion without flattening or losing descendants; tags differing only by case resolve to one identity.

### GAP-031 Unified Statistics

**Current evidence:** Standard Stats omits Active Counters and Completed Goals; Tally Super calculates independently; Most Active groups by mutable name. See `src/features/stats/StatsModal.tsx:13-120` and `src/features/tally-super/TallySuper.tsx:59-113`.

**Required behavior:** Standard and Tally Super surfaces consume one identity-based statistic model and baseline for actions, net movement, total distance, most active counter, increments, decrements, resets, active counters, and completed goals. Renaming does not split identity. Resetting one or all displayed statistics starts a new baseline without changing history or values.

**Acceptance:** All statistic surfaces agree before and after rename, undo/redo, retained changes, goal completion, selected reset, and all reset.

## Combined Acceptance

A malformed persisted workspace containing valid and invalid active and retained bundles opens without crashing. The user can organize surviving counters, perform direct, jump, limit, script, undo, and redo changes, inspect accurate unified history/statistics/progress, and complete Trash expiration and collision restoration. Every accepted change is finite, clamped, uniquely identified, and bundle-safe; failed persistence remains visible without destroying the usable in-memory workspace.

## Sources

- [PRD: Core Counter Requirements](../../product-specification.md#core-counter-requirements)
- [PRD: Personal Workspace Requirements](../../product-specification.md#personal-workspace-requirements)
- [PRD: Failure and Safety Requirements](../../product-specification.md#failure-and-safety-requirements)
- Target-to-Codebase Gap Report findings 12, 14, 15, 17, 18, 25, 29, 30, and 31
- Code-Problems Report SPEC-006 and SPEC-007
