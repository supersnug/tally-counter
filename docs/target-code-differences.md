# Target-Code Differences

**BASE_SHA:** `4c522c942e44b8ef9b75ba28a87508ea4393f34e`

## Target directories

All ordinary Markdown files were reviewed in these exact directories:

- `/home/sageg/Projects/tally-counter/docs/.generated/accounts-and-personal-sync`
- `/home/sageg/Projects/tally-counter/docs/.generated/activity-history-and-statistics`
- `/home/sageg/Projects/tally-counter/docs/.generated/automation-runtime`
- `/home/sageg/Projects/tally-counter/docs/.generated/backup-and-restore`
- `/home/sageg/Projects/tally-counter/docs/.generated/core-counter-engine`
- `/home/sageg/Projects/tally-counter/docs/.generated/counter-bundles-local-trash`
- `/home/sageg/Projects/tally-counter/docs/.generated/counter-copy-sharing`
- `/home/sageg/Projects/tally-counter/docs/.generated/experience-security-verification`
- `/home/sageg/Projects/tally-counter/docs/.generated/live-groups`
- `/home/sageg/Projects/tally-counter/docs/.generated/personal-workspace-organization`
- `/home/sageg/Projects/tally-counter/docs/.generated/snapshot-embeds`
- `/home/sageg/Projects/tally-counter/docs/.generated/tally-super`

Target coverage: **61 ordinary Markdown files**, excluding every `UNIVERSAL.md`.

## Raw-code coverage

**137 permitted raw evidence files inventoried and reviewed:**

| Category | Count |
| --- | ---: |
| `src/` implementation, declarations, and CSS | 37 |
| User/developer MDX content | 56 |
| Vitest/component tests | 9 |
| Playwright tests | 1 |
| Supabase migrations | 11 |
| Supabase functions/configuration | 6 |
| Public source assets | 3 |
| Root runtime/build/test/deployment/package and requested documentation files | 14 |

Package-lock application metadata was inspected; generated dependency-entry detail was treated as excluded dependency material.

## Exclusions

- Every `docs/.generated/UNIVERSAL.md`
- Every `docs/.generated/full-product-conformance--*` directory
- `docs/full-reports.md`
- `docs/product-specification.md`
- Everything under `docs/features/`
- Everything under `docs/increments/`
- Dependencies, generated outputs, caches, `.git/`, secrets, `.env`, and `supabase/.temp/`
- Deliberately unresolved source choices listed below

## Differences

### TCD-001 - No common normalized counter-operation and accepted-transition boundary

- **Target requirements:** `CCE-NORM-001..006`, `CCE-OPS-002..005`, `CCE-TRN-001..007`, `AR-OP-003..007`, `LG-WORK-003`, `LG-WORK-005`
- **Target evidence:**
  - `docs/.generated/core-counter-engine/counter-state-and-normalization.md:9-15`
  - `docs/.generated/core-counter-engine/counter-operations-and-limits.md:9-15`
  - `docs/.generated/core-counter-engine/accepted-transitions.md:9-15`
  - `docs/.generated/automation-runtime/operation-publication.md:11-15`
- **Current evidence:**
  - `src/features/counters/model.ts:95-116` spreads arbitrary fields and converts malformed numeric input to `0` through `Number(value) || 0`; color and identity are not validated.
  - `src/pages/CountersPage.tsx:497-540` implements personal value changes separately and emits legacy `increment`, `decrement`, and `set` kinds.
  - `src/features/scripting/tally-api.ts:32-176` mutates a cloned whole counter directly.
  - `supabase/migrations/20260802172745_shared_counter_groups.sql:356-474` independently patches JSON and does not enforce the complete core normalization contract.
- **Required end state:** Introduce one pure counter schema/normalizer and typed operation service returning accepted, unchanged, or rejected outcomes. Accepted transitions need retry-stable identity, finite before/after values, time, counter identity, and exactly the nine normative action kinds. Every direct, script, import, copy, embed, and group adapter must use it.
- **Affected systems / likely paths:** `src/features/counters/`, `src/pages/CountersPage.tsx`, scripting API/runtime, embeds, backup/copy validators, group RPCs and migrations.
- **Verification seam:** Table/property tests run identical operation corpora through every adapter; assert normalization parity, atomic limit edits, normative action vocabulary, stable retry identity, and no event for unchanged/rejected operations.

### TCD-002 - Goal progress uses incomplete anchors and exposes unbounded percentages

- **Target requirements:** `CCE-GOAL-001..006`, `ESV-A11Y-004`
- **Target evidence:** `docs/.generated/core-counter-engine/directional-goals-and-progress.md:9-14`
- **Current evidence:**
  - `src/features/counters/CounterCard.tsx:106-116` always uses `start` as the first anchor and does not apply the required limit/zero/completion fallback.
  - `src/features/counters/CounterCard.tsx:260-273` displays unbounded `nextProgress`, `finalProgress`, and `maximumProgress`; only segment width is bounded later at lines 280-284.
- **Required end state:** Centralize directional progress derivation, implement the specified first-segment fallback, and clamp every externally exposed percentage to `0..100`.
- **Affected systems / likely paths:** Counter model/engine, `CounterCard`, embeds, Tally Super live counter summaries.
- **Verification seam:** Property tests over finite directional states, negative goals, missing start-side anchors, zero-length segments, and values beyond final goals/limits.

### TCD-003 - Activity, statistics, undo, and deletion are history-array approximations rather than the target event model

- **Target requirements:** `AHS-HIST-001..006`, `AHS-UNDO-001..006`, `AHS-STAT-001..007`, `AHS-REC-001..007`
- **Target evidence:**
  - `docs/.generated/activity-history-and-statistics/activity-ingestion-and-history.md:9-15`
  - `docs/.generated/activity-history-and-statistics/undo-and-redo.md:9-15`
  - `docs/.generated/activity-history-and-statistics/session-statistics.md:9-15`
  - `docs/.generated/activity-history-and-statistics/history-recovery-and-deletion.md:9-15`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:497-520` records mutable names and legacy kinds without bundle association or accepted-transition identity.
  - `src/pages/CountersPage.tsx:505` clears every redo path after any forward change.
  - `src/pages/CountersPage.tsx:541-560` implements undo by deleting the original history entry and directly assigning its prior value without current normalization or an appended undo fact.
  - `src/pages/CountersPage.tsx:562-585` directly assigns redo state and does not retain independent per-counter branches.
  - `src/features/stats/StatsModal.tsx:13-33` derives statistics from retained history and identifies Most Active by mutable name.
  - `src/pages/CountersPage.tsx:1019-1031` changes retained counters without history.
  - `src/pages/CountersPage.tsx:114-120` accepts parsed history wholesale; no record validation or durable quarantine exists.
  - `src/pages/CountersPage.tsx:1471` supports only wholesale deletion and deletes all redo state.
- **Required end state:** Add validated immutable activity entries keyed by transition identity, durable malformed-entry quarantine, a separate page-session transition ledger and independent statistic baselines, and identity-keyed undo/redo candidates that append new events rather than rewriting history. Support selected-lifecycle and all-history deletion transactionally without changing counters or statistics.
- **Affected systems / likely paths:** New history/statistics services, `CountersPage`, `HistoryModal`, `StatsModal`, Tally Super statistics, Trash lifecycle, persistence.
- **Verification seam:** Duplicate-ingestion, unknown-kind compatibility, malformed-kind quarantine, retained-transition, per-counter/global undo, clamped undo, independent redo, baseline reset, selected deletion, reload, and persistence-fault tests.

### TCD-004 - Personal folders are path strings and are absent from synchronization and backup aggregates

- **Target requirements:** `PWO-FLD-001..005`, `PWO-LIFE-001..003`, `PWO-LIFE-005..006`, `PWO-DISC-002..006`, `APS-ELG-001`, `BAR-ALL-002`, `BAR-CTR-002`
- **Target evidence:**
  - `docs/.generated/personal-workspace-organization/folder-hierarchy.md:9-14`
  - `docs/.generated/personal-workspace-organization/folder-and-counter-lifecycle.md:9-15`
  - `docs/.generated/personal-workspace-organization/tags-search-and-result-states.md:10-14`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:82-90` represents hierarchy through slash-delimited path text.
  - `src/pages/CountersPage.tsx:134-141` stores only path strings, with no stable folder identities.
  - `src/pages/CountersPage.tsx:1109-1117` deletes every descendant folder and moves all descendant counters to one parent instead of promoting direct children while preserving subtrees.
  - `src/pages/CountersPage.tsx:313-418` cloud records have no explicit folder section.
  - `src/features/settings/AppSettings.tsx:31-49` backup payloads contain no explicit folder records.
- **Required end state:** Introduce explicit identity-keyed folder records and parent references, preserve empty folders in local persistence and every applicable cloud/backup scope, derive paths only for display/search, and perform hierarchy changes as validated aggregate transactions.
- **Affected systems / likely paths:** Personal workspace model, `CountersPage`, editor folder selection, sync projection/application, backup validators and serializers.
- **Verification seam:** Empty-folder round trip, nested move, cycle/orphan recovery, direct-child promotion, counter-placement identity preservation, search path context, cloud round trip, and each backup scope.

### TCD-005 - Preferences are unvalidated, incomplete, and over-broadly transferred

- **Target requirements:** `PWO-PREF-001..006`, `BAR-SUP-002..004`
- **Target evidence:**
  - `docs/.generated/personal-workspace-organization/workspace-preferences.md:9-15`
  - `docs/.generated/backup-and-restore/tally-super-transfer.md:9-14`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:186-205` merges arbitrary persisted preference values without validation; theme is held in a separate unvalidated store.
  - `src/features/settings/AppSettings.tsx:219-229` offers only automatic, two, or three columns, while target acceptance requires preserving a desired value such as four.
  - `src/features/settings/AppSettings.tsx:41-47` exports the unrestricted preference object for Tally Super transfer.
- **Required end state:** Define and validate the complete preference schema, separate saved from responsive-effective values, and use a closed six-field presentation-preference object for Tally Super transfer.
- **Affected systems / likely paths:** Preference model/provider, `App.tsx`, `CountersPage`, `AppSettings`, backup serializer/validator.
- **Verification seam:** Malformed persisted preferences, four-column narrow-layout preservation, default-color creation, Trash toggle behavior, Local/cloud-Trash eligibility, and exact-key transfer tests.

### TCD-006 - Counter bundles are split across stores, so lifecycle and Local Counter transitions are not atomic

- **Target requirements:** `CBT-BND-001..006`, `CBT-RET-002..006`, `CBT-END-001..006`, `CBT-LOC-001..006`, `APS-ELG-002..004`, `TS-PB-001..004`
- **Target evidence:**
  - `docs/.generated/counter-bundles-local-trash/bundle-model-and-eligibility.md:9-15`
  - `docs/.generated/counter-bundles-local-trash/trash-retention-and-operations.md:9-15`
  - `docs/.generated/counter-bundles-local-trash/restoration-and-permanent-deletion.md:9-15`
  - `docs/.generated/counter-bundles-local-trash/local-counter-transitions.md:9-15`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:92-205` stores counters, Trash, scripts, and customizations independently.
  - `src/pages/CountersPage.tsx:953-963` moves only the core counter into Trash.
  - `src/pages/CountersPage.tsx:255-264` expiration removes only the Trash core record, leaving linked script/customization records.
  - `src/pages/CountersPage.tsx:964-975` collision-safe restoration changes only core identity and does not relink script, customization, history association, or workspace references.
  - `src/features/counters/CounterEditor.tsx:739-755` changes Local designation immediately in draft state; cloud removal is not a coordinated conversion result.
  - `src/pages/CountersPage.tsx:469-479` filters only core counters while uploading unrestricted scripts and Tally Super data.
- **Required end state:** Represent one atomic Counter Bundle aggregate, use it for active/retained/deleted transitions, remap every linked identity on collision, remove every member on expiration/permanent deletion, and compute Local exclusion positively over complete bundles and workspace references.
- **Affected systems / likely paths:** Counter bundle repository, Trash UI/service, script/customization stores, history associations, synchronization projection, backup/copy operations.
- **Verification seam:** Fault injection between aggregate members, retained mutation/history behavior, expiration, collision restore, Local conversion failure, sign-out persistence, and inspection of every cloud payload.

### TCD-007 - Personal synchronization is unrevisioned last-write-wins with no durable delivery journal

- **Target requirements:** `APS-SYN-001..006`, `APS-CFL-001..006`, `APS-ELG-001..006`, `APS-SEC-003`, `ESV-A11Y-006`
- **Target evidence:**
  - `docs/.generated/accounts-and-personal-sync/sync-state-and-delivery.md:9-15`
  - `docs/.generated/accounts-and-personal-sync/conflict-resolution.md:9-15`
  - `docs/.generated/accounts-and-personal-sync/eligible-workspace.md:9-15`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:303-426` loads and independently applies sections without schema validation, revision, digest, session generation, or atomic candidate commit.
  - `src/pages/CountersPage.tsx:463-496` debounces unconditional whole-row `upsert` and reports `Synced` from one response.
  - `src/pages/CountersPage.tsx:427-462` conflict detection compares only counters; merge rewrites only core identity/name and does not resolve singleton values or relink scripts/customization.
  - `supabase.sql:1-35` has no cloud revision, operation identity, compare-and-swap function, or synchronization transaction.
  - No durable sync-journal store or Offline qualifier exists.
- **Required end state:** Define one validated `EligibleWorkspace`, durable local journal, exact target status model, session/base-revision-bound acknowledgements, compare-and-swap cloud writes, idempotent retries, reconnect recovery, and atomic three-choice conflict resolution preserving excluded browser data.
- **Affected systems / likely paths:** New sync/domain modules, browser persistence, `user_data` migrations/RPCs, account UI/status, conflict UI.
- **Verification seam:** Held acknowledgements, offline edit/reload/reconnect, two-device divergent writes, uncertain retries, stale-session responses, malformed cloud sections, and browser/cloud commit faults.

### TCD-008 - Script records can auto-resume, load under the wrong language, and lack coordinated navigation shutdown

- **Target requirements:** `APS-NAV-001..006`, `AR-SI-001..007`, `AR-LS-001..004`, `AR-LS-007`
- **Target evidence:**
  - `docs/.generated/accounts-and-personal-sync/script-shutdown-and-navigation.md:9-15`
  - `docs/.generated/automation-runtime/script-record-and-invocation.md:9-15`
  - `docs/.generated/automation-runtime/lifecycle-sharing-verification.md:9-15`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:677-693` automatically executes any persisted `enabled` script and always dispatches it as JavaScript, even when its recorded language is TallyScript.
  - `src/pages/CountersPage.tsx:641` persists `enabled: true`, conflating durable source with invocation state.
  - `src/pages/CountersPage.tsx:704-793` handles only unload/pagehide; there is no controlled in-app navigation coordinator, bounded acknowledgement wait, retry/continue UI, or truthful best-effort-only presentation.
  - `src/features/scripting/TallyScriptEditor.tsx:17-23` reports success immediately from a background marker, before runtime startup is confirmed.
- **Required end state:** Persist only stopped script records and keep invocation state in memory. Normalize every incoming record to stopped, dispatch solely by recorded language, stop on every lifecycle/authority transition, and route controlled navigation through a bounded shutdown/save coordinator with retry/continue outcomes.
- **Affected systems / likely paths:** Script record/invocation registry, editor, route/navigation shell, sync coordinator, import/copy/restore loaders.
- **Verification seam:** Stale-running records in both languages, reload/navigation/close, timeout/retry/continue, transfer/import, counter replacement/deletion, late callbacks, and simultaneous Run requests.

### TCD-009 - Script mutations publish stale whole-record snapshots instead of authoritative operations

- **Target requirements:** `AR-OP-001..007`, `AR-LS-005..006`, `TS-AS-004..007`, `LG-SCRIPT-004..006`
- **Target evidence:**
  - `docs/.generated/automation-runtime/operation-publication.md:9-15`
  - `docs/.generated/tally-super/group-and-script-authorization.md:12-15`
- **Current evidence:**
  - `src/features/scripting/tally-api.ts:32-176` mutates cloned counter/customization objects and allows arbitrary Tally Super identifiers/properties.
  - `src/pages/CountersPage.tsx:597-620` replaces the latest counter and customization with each cloned runtime result.
  - Script publications produce no accepted-transition identity, personal history/statistics, or owning group activity.
  - `src/features/scripting/tally-api.ts:147-169` permits unsupported dimensions, hiding required elements, and arbitrary quick-setting names.
- **Required end state:** Have both runtimes emit typed, stable-identity operations to the current authoritative personal/group boundary. Revalidate authority and arguments for every operation, return normalized current state, and reject invalid customization atomically without erasing prior accepted publications.
- **Affected systems / likely paths:** `tally-api.ts`, both runtimes, core operation service, history/statistics ingestion, group operation RPCs, Tally Super command schema.
- **Verification seam:** Equivalent language corpora, yielding script plus intervening direct count, hard-limit no-op, malformed multi-field call, duplicate shared operation, revocation after sleep, and required-element hiding.

### TCD-010 - Backup formats and imports do not implement the declared scopes or transactional workflow

- **Target requirements:** `BAR-ENV-001..006`, `BAR-CTR-001..006`, `BAR-SUP-001..006`, `BAR-ALL-001..006`, `BAR-TXN-001..006`, `BAR-VAL-001..006`
- **Target evidence:**
  - `docs/.generated/backup-and-restore/file-envelope-and-scope.md:9-15`
  - `docs/.generated/backup-and-restore/counter-backup.md:9-15`
  - `docs/.generated/backup-and-restore/tally-super-transfer.md:9-15`
  - `docs/.generated/backup-and-restore/all-tally-data.md:9-15`
  - `docs/.generated/backup-and-restore/transactional-import.md:9-15`
- **Current evidence:**
  - `src/features/settings/AppSettings.tsx:31-57` emits only `version`, `scope`, and `exportedAt`, with no format identifier or validated section metadata.
  - Counter export always includes all active counters and lacks selection, explicit folders, represented-path semantics, and Local/linked positive projection.
  - Tally Super export includes unrestricted preferences at `src/features/settings/AppSettings.tsx:41-47`.
  - All-data export omits retained bundles, retention metadata, and explicit folders.
  - `src/pages/CountersPage.tsx:794-890` does not validate format/version/declared scope, does not preview exact replacement categories, uses several independent React setters rather than one durable transaction, clears history/redo, and does not force imported scripts stopped.
- **Required end state:** Add a versioned recognized envelope and three closed scope schemas; positively project exact included data; validate complete candidates and references before preview; stop affected scripts; and commit one durable aggregate transaction while preserving excluded stores.
- **Affected systems / likely paths:** New backup schemas/serializers/import sessions, browser aggregate persistence, Settings UI, script loader, folders/Trash/customization stores.
- **Verification seam:** Exact-key export assertions, semantic round trips for all scopes, wrong-operation files, malformed fields/references, expired Trash, option-presence tampering, cancellation, concurrent destination change, and persistence-stage rollback.

### TCD-011 - Counter Copy trusts client snapshots and lacks source-bound positive projection

- **Target requirements:** `CCS-OFR-001..006`, `CCS-SEC-001..007`, `CCS-ADR-001..002`, `CCS-ADR-006`
- **Target evidence:**
  - `docs/.generated/counter-copy-sharing/projection-and-offer.md:9-15`
  - `docs/.generated/counter-copy-sharing/authorization-and-security.md:9-16`
- **Current evidence:**
  - `src/features/sharing/CopySharing.tsx:90-108` submits an unrestricted browser counter object and linked objects.
  - `supabase/migrations/20260802165524_share_counter_linked_data.sql:39-93` validates only JSON object shape/size, has no source identity or ownership lookup, and stores the client payload unchanged.
  - `src/features/sharing/CopySharing.tsx:34-37` returns full request payloads to both participants rather than role-specific projections.
- **Required end state:** Send only source identity and offer flags; resolve ownership server-side; normalize and construct an immutable allowlisted snapshot; keep secret/identity fields out by construction; and expose sender/recipient-specific projections.
- **Affected systems / likely paths:** Copy-sharing RPC schema/migrations, personal cloud source lookup, client hook and modal, analytics/log schemas.
- **Verification seam:** Exact snapshot equality, unowned source, all linked-option combinations, source edits/deletion, sender/recipient/third-user RLS, anonymization, PIN/log/analytics inspection.

### TCD-012 - Counter Copy state and acceptance are non-atomic and non-idempotent

- **Target requirements:** `CCS-REQ-001..006`, `CCS-ACP-001..008`, `CCS-VRF-001..006`
- **Target evidence:**
  - `docs/.generated/counter-copy-sharing/request-state-and-outcomes.md:9-15`
  - `docs/.generated/counter-copy-sharing/atomic-acceptance.md:9-17`
  - `docs/.generated/counter-copy-sharing/failure-accessibility-and-verification.md:9-15`
- **Current evidence:**
  - `supabase/migrations/20260802165524_share_counter_linked_data.sql:64-76` rejects disabled receiving instead of creating the distinct terminal `Receiving disabled` outcome.
  - `src/features/sharing/CopySharing.tsx:113-123` marks a request Accepted with a direct row update.
  - `src/pages/CountersPage.tsx:991-1016` performs that remote transition before allocating a timestamp-based destination and independently writing counter, script, and customization stores.
  - There is no acceptance operation identity, deterministic destination, claim/result recovery, Local delivery authorization, finalization, or retry journal.
- **Required end state:** Implement the closed observable state machine and a recipient-bound idempotent acceptance protocol. Non-local creation and Accepted must commit together; Local acceptance must remain Pending until one deterministic complete browser bundle is durably stored and the same operation finalizes without sending destination bundle fields.
- **Affected systems / likely paths:** New copy acceptance/result tables and RPCs, browser acceptance journal/aggregate store, copy prompts/statuses, synchronization exclusion.
- **Verification seam:** Concurrent accept/decline, duplicate delivery, each non-local transaction boundary, every Local claim/persist/finalize interruption, refresh recovery, changed operation identity, malformed candidate, and disabled-receiving outcome.

### TCD-013 - Group lifecycle lacks durable invitation outcomes, ownership transfer, and member leave

- **Target requirements:** `LG-LIFE-001..007`, `APS-ACC-006`
- **Target evidence:** `docs/.generated/live-groups/group-lifecycle-and-membership.md:9-15`
- **Current evidence:**
  - `supabase/migrations/20260802172745_shared_counter_groups.sql:267-283` deletes invitations after either response, so no terminal Accepted/Declined state remains.
  - `supabase/migrations/20260802172745_shared_counter_groups.sql:303-324` implements removal and group deletion but no ownership transfer or explicit non-owner leave operation.
  - `supabase/functions/delete-account/index.ts:28-37` deletes the user without checking owned groups; cascading ownership can delete group data.
  - `src/features/groups/SharedGroups.tsx:197-217` exposes no transfer or leave workflow.
- **Required end state:** Add explicit invitation and membership state machines, atomic sole-owner transfer with selected former-owner access, confirmed non-owner leave, owner-blocking rules, and account-deletion ownership checks.
- **Affected systems / likely paths:** Group schema/RPC migrations, account deletion Edge Function, `useSharedGroups`, Group Settings and invitation prompts.
- **Verification seam:** Duplicate responses, transfer faults, one-owner invariant, owner leave/removal denial, non-owner leave, account deletion while owner, group deletion isolation, and multi-group active-context tests.

### TCD-014 - Group permissions, workspace saves, scripts, and concurrency do not satisfy the authoritative operation model

- **Target requirements:** `LG-AUTH-001..006`, `LG-WORK-001..006`, `LG-CONC-001..007`, `LG-SCRIPT-001..006`, `TS-AS-001..007`
- **Target evidence:**
  - `docs/.generated/live-groups/permission-and-authorization.md:9-15`
  - `docs/.generated/live-groups/shared-workspace-operations.md:9-15`
  - `docs/.generated/live-groups/concurrency-realtime-and-activity.md:9-15`
  - `docs/.generated/live-groups/shared-script-execution.md:9-15`
- **Current evidence:**
  - `src/features/groups/permissions.ts:1-67` has no independent create-counter permission.
  - `supabase/migrations/20260802215607_shared_counter_folders.sql:102-108` incorrectly gives Settings Only folder-move authority.
  - `src/features/groups/SharedGroups.tsx:90-112` saves one field at a time from mutable editor state, allowing partial completion rather than one immutable-base coherent save.
  - `supabase/migrations/20260802223315_shared_counter_activity_events.sql:120-125` rejects every stale non-count operation and has no changed-field reconciliation result.
  - Stable operation identity is applied only to `perform_shared_counter_action`, not all group commands.
  - `src/features/groups/SharedGroups.tsx:174-184` supplies script editing but no Run/Stop callbacks; `src/features/scripting/TallyScriptEditor.tsx:17-23` can still report a successful start.
  - `supabase/migrations/20260802172745_shared_counter_groups.sql:373-472` performs incomplete JSON validation and permits whole script/customization patches.
- **Required end state:** Use one known-permission registry across UI and database, add all independent permissions, submit coherent versioned operation sets from immutable bases, support explicit non-overlap reconciliation, make every operation idempotent/recoverable, and run shared scripts through real recorded-language runtimes with per-publication reauthorization.
- **Affected systems / likely paths:** Permission registry, group editor, `useSharedGroups`, group RPCs/events, script invocation registry, Tally Super group commands.
- **Verification seam:** Full preset matrix, unknown-key fuzzing, multi-field rollback, same-field conflict, non-overlap reconciliation, concurrent adds, uncertain response recovery, permission revocation, real shared Run/Stop, resource limits, and one activity record per accepted operation.

### TCD-015 - Group embeds and malformed-group isolation are not implemented

- **Target requirements:** `LG-UX-001..007`
- **Target evidence:** `docs/.generated/live-groups/group-embeds-and-experience.md:9-15`
- **Current evidence:**
  - `src/features/groups/SharedGroups.tsx:160-169` passes an empty `onEmbed` callback for shared counters.
  - `src/features/groups/useSharedGroups.ts:30-74` treats a loading/shape failure as one hook-level error rather than isolating one malformed group while retaining valid groups.
  - Existing tests cover only basic folders/activity and no group embed or malformed-group case.
- **Required end state:** Allow any viewing member to create the same strict independent snapshot projection, and validate/isolate each group so one malformed group cannot block valid groups or personal counting.
- **Affected systems / likely paths:** Shared counter view, embed serializer/builder, group validators/load hook, group recovery UI.
- **Verification seam:** Visible-member group snapshots, decoded exclusion assertions, source independence, access loss, malformed group beside valid group, and keyboard/mobile group journeys.

### TCD-016 - Snapshot embeds serialize private source records and lack a versioned public contract

- **Target requirements:** `SE-PC-001..007`, `SE-BM-001..007`, `SE-ER-003`, `SE-ER-005`, `SE-PR-001..007`, `SE-VA-001..007`
- **Target evidence:**
  - `docs/.generated/snapshot-embeds/public-snapshot-contract.md:9-15`
  - `docs/.generated/snapshot-embeds/builder-and-markup.md:9-15`
  - `docs/.generated/snapshot-embeds/privacy-and-containment.md:9-15`
  - `docs/.generated/snapshot-embeds/validation-accessibility-verification.md:9-15`
- **Current evidence:**
  - `src/features/counters/model.ts:95-116` retains arbitrary source fields through object spread; `src/features/counters/model.ts:167-175` encodes/decodes that object without versioned schema validation.
  - `src/features/embed/EmbedComponents.tsx:29-38` puts presentation options outside the payload and interpolates the unescaped counter name into iframe markup.
  - `src/features/embed/EmbedComponents.tsx:39-45` silently swallows clipboard failure.
  - `src/features/embed/EmbedComponents.tsx:217-231` presents a combined Range and invented infinities rather than exactly the four required detail fields.
  - `src/pages/EmbedPage.tsx:5-16` distinguishes neither malformed/truncated/version/schema errors nor strips unknown fields.
  - `src/app/AppProviders.tsx:5-12` mounts analytics and URL-oriented insights on every route, including encoded embed URLs.
  - Generated iframe markup has no explicit containment policy.
- **Required end state:** Define separate allowlisting serializer and decoder around a recognized/versioned public snapshot including options. Strip unknown fields before runtime, categorize invalid payloads, safely construct markup/attributes and containment policy, disclose public/non-live behavior, report clipboard failure, and disable URL/content telemetry on embed routes by construction.
- **Affected systems / likely paths:** New embed schema module, builder/runtime/page, app provider routing, iframe markup, group/personal/retained source adapters.
- **Verification seam:** Sentinel-rich exact projections, malformed/version fixtures, markup injection characters, clipboard rejection, two-frame independence, directional goals, exact detail fields, reload reset, telemetry interception, dependency inspection, and host containment tests.

### TCD-017 - Tally Super accepts malformed/unauthorized records and lacks complete keyboard recovery

- **Target requirements:** `TS-CE-001..007`, `TS-WS-001..007`, `TS-PB-001..007`, `TS-RV-001..007`, `TS-AS-001..007`
- **Target evidence:**
  - `docs/.generated/tally-super/counter-element-contract.md:9-15`
  - `docs/.generated/tally-super/workspace-customization.md:9-15`
  - `docs/.generated/tally-super/customization-persistence-boundaries.md:9-15`
  - `docs/.generated/tally-super/recovery-accessibility-verification.md:9-15`
- **Current evidence:**
  - `src/features/counters/CounterCard.tsx:24-45` honors `hidden` for every part, including required parts, when malformed/imported/scripted data requests it.
  - `src/features/counters/model.ts:142-164` performs only shallow object checks and obsolete-type filtering.
  - `src/features/tally-super/TallySuper.tsx:201-335` supports pointer movement/resizing but lacks explicit keyboard position, resize, zone, and order controls.
  - `src/features/tally-super/TallySuper.tsx:124-134` renders missing live-counter references using cached label/value fallback instead of `Unavailable` without stale content.
  - Workspace records have no stable order field/validator or bounded text/transform schema.
  - Bundle, Local, sync, Trash, backup, copy, and group ownership boundaries are handled by independent maps rather than one customization projection/aggregate.
- **Required end state:** Create canonical element/workspace definitions and one customization command validator shared by every ingress. Derive required elements regardless of stored data, reject unsupported properties atomically, represent unavailable references safely, add complete keyboard transform/order/zone controls, and bind customization to owning bundle/workspace/group projections.
- **Affected systems / likely paths:** `TallySuper.tsx`, `CounterEditor`, `CounterCard`, model/schema modules, scripting commands, sync/backup/copy/group adapters.
- **Verification seam:** Enumerated element-table tests, required-hide attempts through every ingress, malformed/obsolete records, unavailable live references, 320-pixel keyboard editor journey, persistence failure, Local/cloud payload inspection, collision restoration, and group revocation.

### TCD-018 - Browser persistence failures and malformed stored sections are not recoverable

- **Target requirements:** `ESV-DATA-001..007`, `APS-SEC-003`, `AHS-REC-001..002`
- **Target evidence:** `docs/.generated/experience-security-verification/persistence-and-malformed-data-recovery.md:9-15`
- **Current evidence:**
  - `src/pages/CountersPage.tsx:93-205` largely trusts parsed containers and either accepts whole sections or discards them; record-level isolation is absent.
  - `src/pages/CountersPage.tsx:227-278` invokes `localStorage.setItem` without handling quota, security, unavailable-storage, or serialization errors.
  - `src/App.tsx:35-40` likewise performs unguarded theme reads/writes.
  - No unsaved state, retry path, quarantine diagnostics, recovery export, or aggregate transaction exists.
- **Required end state:** Add guarded persistence adapters with explicit results, per-section/record validation and quarantine, usable in-memory fallback, textual unsaved status, retry/recovery actions, and aggregate transactions for replacement/lifecycle operations.
- **Affected systems / likely paths:** Browser persistence/domain repository, app/theme preferences, counters/history/scripts/Tally Super/folders, status UI.
- **Verification seam:** Malformed containers and mixed valid/invalid records, quota/security/serialization failures, continued counting, reload-persistent quarantine, retry after recovery, and transaction rollback.

### TCD-019 - Account security actions and deletion do not enforce all required reauthentication/ownership preconditions

- **Target requirements:** `APS-ACC-004`, `APS-ACC-006`, `ESV-SEC-007`, `ESV-FAIL-007`
- **Target evidence:** `docs/.generated/accounts-and-personal-sync/account-lifecycle.md:12-15`
- **Current evidence:**
  - `src/features/auth/AuthModal.tsx:419-433` invokes account deletion using only a typed word and current session.
  - `supabase/functions/delete-account/index.ts:12-37` validates the session but requires no fresh reauthentication and performs no owned-group check.
  - `src/features/auth/AuthModal.tsx:293-310` initiates email change without an explicit reauthentication flow.
- **Required end state:** Use purpose-appropriate fresh authentication for destructive/security-sensitive actions, bind responses to the current session generation, and block deletion until every owned group is transferred or deliberately deleted.
- **Affected systems / likely paths:** Auth command model/UI, account deletion Edge Function, group ownership RPCs, token handling.
- **Verification seam:** Absent/expired/wrong-purpose tokens, stale session responses, owned-group deletion block, successful transfer/delete then account deletion, and browser-data preservation.

### TCD-020 - Dialog, toggle, responsive, motion, and browser evidence does not meet release acceptance

- **Target requirements:** `ESV-A11Y-001..007`, `ESV-RESP-001..007`, `ESV-FAIL-001..006`, `APS-SEC-005..006`, `CCS-VRF-006`, `LG-UX-004..006`, `TS-RV-003..005`, `SE-VA-003..006`
- **Target evidence:**
  - `docs/.generated/experience-security-verification/keyboard-dialog-and-status-semantics.md:9-15`
  - `docs/.generated/experience-security-verification/responsive-browser-and-theme-acceptance.md:9-15`
  - `docs/.generated/experience-security-verification/destructive-actions-and-failure-isolation.md:9-15`
- **Current evidence:**
  - Most modals, including `src/features/counters/CounterEditor.tsx:460-799`, lack dialog role, accessible title/description association, focus containment, Escape policy, and focus restoration.
  - Many switches are button-plus-`i`, not hidden checkbox + empty track + label text; examples include `src/features/settings/AppSettings.tsx:241-301` and `src/features/auth/AuthModal.tsx:665-750`.
  - `src/styles.css:2672-2693` makes these tracks `36px x 21px`, not the required `32px x 18px`.
  - `src/styles.css:4937-4938` removes undo/redo access on narrow screens.
  - No `prefers-reduced-motion` rule exists; product animation suppression applies only inside `.app-shell`.
  - `playwright.config.ts:38-73` covers three generic desktop engines only; branded/current-and-previous Edge/Chrome and mobile projects are commented out.
  - `e2e/app.spec.ts:1-164` has no 320-pixel, keyboard-only, theme, reduced-motion, malformed-data, offline, destructive-focus, accessibility-tree, or supported-mobile journey.
- **Required end state:** Supply reusable focus-managed semantic dialogs/statuses and conforming pill switches; preserve all capabilities at 320 CSS pixels; honor OS and product motion settings; and execute the complete required browser/theme/input/state matrix.
- **Affected systems / likely paths:** Shared UI primitives, every modal/toggle, responsive CSS, Playwright configuration/specs, feature component tests.
- **Verification seam:** Automated keyboard/focus assertions, accessibility-tree checks, 320-pixel no-page-overflow journeys, both themes, OS/product motion partitions, desktop current/previous coverage, and real Android Chrome/iOS Safari checks.

### TCD-021 - The migration chain cannot reproduce a clean deployment, and requirement-level release evidence is absent

- **Target requirements:** `APS-SEC-001`, `APS-SEC-004`, `APS-SEC-A01..A06`, `ESV-REL-006..008`, `ESV-SEC-A01..A06`, `ESV-REL-A03..A07`
- **Target evidence:**
  - `docs/.generated/accounts-and-personal-sync/security-recovery-and-verification.md:9-15`
  - `docs/.generated/experience-security-verification/product-claims-and-release-verification.md:14-17`
  - `docs/.generated/experience-security-verification/security-authorization-and-analytics.md:42-49`
- **Current evidence:**
  - The first migration, `supabase/migrations/20260802163542_account_sharing_settings.sql:1-9`, assumes `profiles` and `counter_shares` already exist.
  - The base personal/profile/share schema exists only in `supabase.sql:1-468`, which README calls a reference rather than an ordered migration at `README.md:123-127`.
  - `supabase/config.toml:66-71` enables a missing `seed.sql`.
  - No database/RLS/transaction test suite exists.
  - CI at `.github/workflows/ci.yml:16-49` runs typecheck, unit coverage, and build only; Playwright runs generic browser projects without requirement mapping.
  - Analytics are mounted without an allowlisted event schema at `src/app/AppProviders.tsx:1-12`.
- **Required end state:** Convert the complete schema into an ordered clean migration chain, provide deterministic fixtures and multi-user policy/transaction/idempotency tests, make local reset reproducible, define analytics schemas/exclusions, and maintain an evidence map from stable requirement IDs to automated/manual verification.
- **Affected systems / likely paths:** Supabase migrations/config/seeds, database tests, CI workflows, analytics provider/schema, Playwright matrix, release documentation.
- **Verification seam:** `supabase db reset` from empty storage, multi-account ownership and forged-request tests, transaction fault injection, analytics interception/schema tests, CI requirement mapping, and the combined cross-device/offline/browser completion journey.

## Target requirements confirmed matching code

The following target requirements have direct matching implementation evidence and are not repeated as differences:

- `APS-ACC-001..003`: account-free operation, registration password checks, and username/email sign-in.
- `APS-SEC-002` / `ESV-SEC-001`: browser configuration exposes only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`.
- `CCE-OPS-001`, `CCE-OPS-006`: positive/negative controls use independent directions, and goals do not stop counting.
- `AR-JS-001..003`, `AR-JS-005..006`: QuickJS isolation, configured CPU/memory/stack boundaries, host-mediated sleep, and cancellation are present.
- `AR-TS-001..007`: line-oriented commands, case behavior, validation, 10,000-iteration intervals, sleep reset, and cancellation are implemented.
- `CBT-RET-001`, `CBT-RET-006`: Trash defaults on, cloud Trash is separate, and retention runs without authentication.
- `CCS-ADR-003..005`: incoming-copy preference remains independent, anonymized sender fallback exists, and outgoing PINs are six digits.
- `PWO-PREF-003..006`: responsive effective layout does not rewrite saved preferences; default color and Trash/cloud-Trash controls have the intended local direction.
- `SE-ER-001..002`, `SE-ER-004`, `SE-ER-006..007`: iframe values are ephemeral, controls clamp, Reset is frame-local, themes are presentation-only, and interactions do not persist.
- `ESV-REL-001`, `ESV-REL-003..004`: no entitlement gate exists; account-optional and local browser operation are implemented.
- `LG-AUTH-004`: protected shared-counter actions re-evaluate current membership/permission at the database boundary.

## Deliberate decisions excluded

No implementation choice or finding was made for:

- `PWO-FOLDER-BLANK-NAME`
- `PWO-FOLDER-SIBLING-COMPARISON`
- Exact sibling-name comparison/collision policy
- `PWO-TAG-DISPLAY-SPELLING` and surviving tag display spelling
- Exact open-source license selection
- Other target text explicitly marked as source-undecided, including narrow protocol encoding/lifetime/storage choices in Counter Copy acceptance

The repository currently claims "open source" without an adopted root license, but selection of the exact license is deliberately excluded from this manifest.

## Limitations

- `HEAD` equals the requested BASE_SHA. The working tree contained changes only to `.gitignore` and forbidden `docs/features/` / `docs/increments/` paths; those changes were not used as evidence.
- No files were edited, generated, or written during the analysis.
- Secrets and `supabase/.temp/` were not inspected.
- Dependency package contents and generated package-lock dependency detail were excluded; only application package metadata was relevant.
- This is static raw-code evidence. Supabase deployment, browser behavior, accessibility trees, network telemetry, and real mobile/cross-device behavior were not executed; absent executable evidence is reported where required.
