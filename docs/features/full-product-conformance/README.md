# Full Product Conformance Feature Suite

## Purpose

This suite combines the approved target-to-codebase gap report and the full code-problems report into traceable feature contracts for the Full Product Conformance increment. It supplements rather than replaces the PRD and the existing feature files. The PRD remains authoritative; existing feature files remain the detailed product contracts; these documents identify the currently observed differences that must be closed together.

## Identifier Rules

- `GAP-001` through `GAP-040` preserve the order of the target-to-codebase gap report.
- `SPEC-001` through `SPEC-008` preserve the identifiers from the code-problems report. They map to overlapping GAP findings where both reports describe the same defect.
- `STD-001` through `STD-018` preserve the identifiers from the code-problems report.
- File and line references are evidence from the reports, not permanent architecture. If code moves, acceptance follows the required behavior and the finding remains open until that behavior is proven.
- Closing a duplicate SPEC finding requires proof for both identifiers even when one correction satisfies both.

## Contracts

- [Local Counter and Data Integrity](local-counter-and-data-integrity.md) covers normalized counter behavior, atomic Counter Bundles, Activity History, undo/redo, statistics, organization, browser persistence, and progress.
- [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md) covers Local Counter cloud isolation, conflict-safe synchronization, truthful state, transactional backups and imports, and reproducible cloud schema.
- [Automation, Customization, and Embeds](automation-customization-and-embeds.md) covers script language and publication safety, Tally Super recovery and validation, strict snapshot publication, telemetry exclusion, and keyboard customization.
- [Sharing and Live Collaboration](sharing-and-live-collaboration.md) covers Counter Copy trust and atomicity, account/group ownership, group permissions and lifecycle, shared scripts, concurrency, and group quick settings.
- [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md) covers accessibility, responsive and browser acceptance, reduced motion, licensing, documentation accuracy, repository standards, and reported maintainability findings.

## Gap Coverage

| Finding | Severity | Contract |
| --- | --- | --- |
| GAP-001 Local Counter bundle isolation | Critical | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-001-local-counter-bundle-isolation) |
| GAP-002 Scripts resume or use the wrong language | Critical | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-002-explicit-language-correct-script-start) |
| GAP-003 Embeds expose private source fields | Critical | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-003-versioned-embed-projection) |
| GAP-004 Account deletion can destroy group data | Critical | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-004-account-deletion-and-group-ownership) |
| GAP-005 Conflict handling covers only counters | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-005-complete-conflict-scope) |
| GAP-006 Ongoing synchronization is last-write-wins | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-006-versioned-recoverable-synchronization) |
| GAP-007 Sync status overstates completion | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-007-truthful-synchronization-status) |
| GAP-008 Backup scopes mismatch contracts | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-008-exact-backup-scopes) |
| GAP-009 Import is not transactional | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-009-validated-atomic-import) |
| GAP-010 Counter Copy lacks a trusted projection | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-010-trusted-counter-copy-projection) |
| GAP-011 Counter Copy acceptance is not atomic | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-011-idempotent-atomic-copy-acceptance) |
| GAP-012 Counter Bundle lifecycle is incomplete | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-012-atomic-counter-bundle-lifecycle) |
| GAP-013 Migrations cannot recreate the schema | High | [Synchronization, Backup, and Portability](synchronization-backup-and-portability.md#gap-013-reproducible-database-deployment) |
| GAP-014 Numeric normalization is unsafe | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-014-authoritative-numeric-normalization) |
| GAP-015 Value changes bypass transition contracts | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-015-complete-transition-contract) |
| GAP-016 Yielding scripts overwrite changes | High | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-016-current-state-script-publication) |
| GAP-017 Undo/redo is not append-only | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-017-append-only-undo-and-redo) |
| GAP-018 Activity retention and validation differ | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-018-history-statistics-and-retention) |
| GAP-019 Shared scripts do not execute | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-019-shared-script-execution) |
| GAP-020 Group lifecycle and permissions incomplete | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-020-complete-group-lifecycle-and-permissions) |
| GAP-021 Group editor saves no changes | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-021-authoritative-group-editor-saves) |
| GAP-022 Group concurrency and recovery partial | High | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-022-retry-safe-group-concurrency) |
| GAP-023 Required Tally Super elements unprotected | High | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-023-required-element-protection) |
| GAP-024 Tally Super transformation and recovery incomplete | High | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-024-complete-transforms-and-recovery) |
| GAP-025 Browser storage recovery absent | High | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-025-browser-storage-failure-and-recovery) |
| GAP-026 Dialog and control accessibility incomplete | High | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-026-dialog-and-control-accessibility) |
| GAP-027 Iframe markup is not escaped | High | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-027-safe-portable-iframe-markup) |
| GAP-028 Embed telemetry exclusion absent | High | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-028-embed-telemetry-exclusion) |
| GAP-029 Goal progress rules are incorrect | Medium | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-029-correct-goal-progress) |
| GAP-030 Folder behavior differs | Medium | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-030-stable-folder-and-tag-organization) |
| GAP-031 Statistics surfaces disagree | Medium | [Local Counter and Data Integrity](local-counter-and-data-integrity.md#gap-031-unified-statistics) |
| GAP-032 Group embeds and preview incomplete | Medium | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-032-complete-group-embed-and-preview) |
| GAP-033 Group quick settings do nothing | Medium | [Sharing and Live Collaboration](sharing-and-live-collaboration.md#gap-033-authorized-group-quick-settings) |
| GAP-034 Keyboard organization/customization incomplete | Medium | [Automation, Customization, and Embeds](automation-customization-and-embeds.md#gap-034-keyboard-customization-and-movement) |
| GAP-035 320px experience not accepted | Medium | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-035-complete-320-pixel-experience) |
| GAP-036 Reduced motion ignored | Medium | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-036-reduced-motion) |
| GAP-037 Async and progress semantics incomplete | Medium | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-037-semantic-progress-and-status) |
| GAP-038 Browser acceptance incomplete | Medium | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-038-supported-browser-acceptance) |
| GAP-039 Open-source claim lacks a license | Low | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-039-enforced-open-source-claim) |
| GAP-040 Guides contradict behavior | Low | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#gap-040-authoritative-documentation) |

## Code-Problems Coverage

| Finding | Maps to |
| --- | --- |
| SPEC-001 | GAP-013 |
| SPEC-002 | GAP-021 |
| SPEC-003 | GAP-019 |
| SPEC-004 | GAP-002 and GAP-007 |
| SPEC-005 | GAP-001 |
| SPEC-006 | GAP-014 |
| SPEC-007 | GAP-029 |
| SPEC-008 | GAP-027 |
| STD-001 through STD-018 | [Experience, Platform, and Maintainability](experience-platform-and-maintainability.md#repository-conformance-findings) |

## Foundations to Preserve

The reports identify these aligned foundations. Conformance work must retain them while closing the findings:

- Browser code uses only public Supabase credentials.
- Personal `user_data` RLS checks account ownership.
- Group tables use membership RLS and mutation RPCs generally check permissions.
- Group count operations already use row locking and event identities in the latest wrapper.
- Sharing PIN hashes remain isolated in a private schema.
- JavaScript retains the specified CPU, memory, and stack limits.
- TallyScript retains its 10,000-iteration uninterrupted-loop limit and resets that interval after sleep.
- Explicit Trash permanent deletion retains confirmation and complete linked-record cleanup.
- Account deletion preserves browser-resident personal workspace state.
- Group-owned records remain separate from personal `user_data`.

## Verification Obligations

The combined reports require evidence beyond the existing local counter and component coverage:

- Inspect every personal cloud payload and conflict path for complete Local Counter exclusion.
- Exercise real synchronization discovery, all conflict choices, durable offline retry, acknowledgement, and concurrent devices.
- Prove every backup scope, round trip, preview, transactional replacement, and failed-import rollback.
- Prove Trash expiration, disabled-Trash deletion, retained mutation, and collision restoration with complete linked bundles.
- Prove Counter Copy source projection and retry-safe atomic acceptance.
- Exercise actual Supabase RLS and RPC behavior with multiple users, stale clients, retries, and denied permissions.
- Prove shared script execution, yielding, stopping, resource limits, and permission revocation.
- Prove group transfer, confirmed leave, custom counter creation, preset permissions, stale conflicts, reconnect, and uncertain delivery.
- Inspect embed projection, decoding, markup, route telemetry, clipboard failure, preview reset, and personal/group privacy.
- Exercise malformed browser sections, malformed records, quota/security failures, and visible unsaved recovery.
- Verify dialog focus, keyboard-only organization/customization, reduced motion, 320-pixel layouts, themes, semantic statuses, and the full supported desktop/mobile browser matrix.
- Prove a clean migration creates the complete schema and all ownership, authorization, atomicity, and idempotency boundaries.
- Verify all corrected behavior against the 12 existing feature files so a report fix cannot regress an already accepted outcome.

## Closure Rule

The increment is not complete until every GAP, SPEC, and STD row has observable proof, all linked existing feature contracts remain satisfied, and no correction removes an accepted feature to make a finding disappear.
