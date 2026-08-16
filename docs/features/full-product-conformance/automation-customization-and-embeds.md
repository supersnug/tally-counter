# Automation, Customization, and Embeds

## Purpose

Close the report findings that allow scripts to execute unexpectedly or publish stale records, allow malformed customization to hide required actions, or allow public snapshots and generated markup to disclose or interpolate private source data.

## Existing Feature Sources

- [Automation Runtime](../automation-runtime.md)
- [Tally Super](../tally-super.md)
- [Snapshot Embeds](../snapshot-embeds.md)
- [Core Counter Engine](../core-counter-engine.md)
- [Live Groups](../live-groups.md)
- [Personal Workspace Organization](../personal-workspace-organization.md)
- [Experience, Security, and Verification](../experience-security-verification.md)

## Shared Contract

Scripts and customization are untrusted linked data. Loading validates but never executes them. Script publication and customization changes pass through current authoritative counter, authorization, normalization, allowlist, and recoverability boundaries. Snapshot publication constructs a new versioned public projection rather than serializing a source record.

## Findings and Required Behavior

### GAP-002 Explicit Language-Correct Script Start

**Current evidence:** Imported and cloud-loaded records preserve `enabled`; an effect starts every enabled script and hard-codes JavaScript regardless of recorded language. See `src/pages/CountersPage.tsx:677-693` and `859-881`.

**Required behavior:** Every loaded, synchronized, imported, copied, recovered, or previously running script becomes stopped. Source validates only under its recorded `tallyscript` or `javascript` language and cannot fall back to another interpreter. Execution begins only from an explicit authorized Run action and exposes visible running, stopped, completed, and error state.

**Acceptance:** Crafted enabled records, interrupted exit state, imports, copies, and cloud state never execute on load; a TallyScript record cannot enter JavaScript and vice versa. Together with GAP-007, this closes SPEC-004.

### GAP-003 Versioned Embed Projection

**Current evidence:** Sanitization spreads the source counter and encoding serializes the result, exposing existing and future private fields. See `src/features/counters/model.ts:95-117`, `167-176`, and `src/features/embed/EmbedComponents.tsx:29-38`.

**Required behavior:** Snapshot generation constructs a new versioned allowlist containing only normalized name, current/start values, positive/negative steps, limits, goals, direction, color, and approved embed options. Source identity, folder, tags, Local status, Trash metadata, script, customization, ownership, group, permission, and unknown fields are absent. Decoding validates version, exact required types, finite values, and options before rendering.

**Acceptance:** Decoded personal and group snapshot URLs contain only approved fields; adding a new private source field does not publish it; missing, unsupported, or malformed payloads render a clear error and no interactive counter.

### GAP-016 Current-State Script Publication

**Current evidence:** Runtimes mutate private cloned counters and publish whole records; yielding resumes from stale state after direct or cloud changes. See `src/features/scripting/tally-api.ts:32-196`, `src/features/scripting/tallyscript.ts:239-252`, `src/features/scripting/javascript.ts:67-86`, and `src/pages/CountersPage.tsx:597-620`.

**Required behavior:** Each Tally API operation publishes as an operation with stable identity against the current authoritative record. It rechecks counter existence, execution identity, authorization, limits, and normalization at publication time. Yielding retains language/runtime context but not authority to overwrite intervening fields. Resource or operation failure preserves the latest valid published state and stops only the affected execution when required.

**Acceptance:** A direct, synchronized, or group change made while a script sleeps remains authoritative unless a later script operation explicitly and validly changes that field; retry applies once; stale whole-record replacement cannot occur.

### GAP-023 Required Element Protection

**Current evidence:** Rendering trusts stored hidden state, and script/group APIs accept unsupported identifiers and transforms. See `src/features/counters/CounterCard.tsx:24-45`, `src/features/scripting/tally-api.ts:26-169`, and `supabase/migrations/20260802172745_shared_counter_groups.sql:395-438`.

**Required behavior:** Title, count, add, settings, and delete cannot be hidden through editor, import, sync, copy, script, or direct group operation. Every owning boundary allowlists element identifiers, supported transform fields, numeric ranges, dimensions, and visibility capability. Invalid required-element hiding preserves the last valid customization and reports the rejected operation.

**Acceptance:** Manually constructed personal and group payloads, imports, scripts, and cloud records cannot hide required actions; all required controls remain recoverable in valid custom layouts.

### GAP-024 Complete Transforms and Recovery

**Current evidence:** Utility elements are fixed-scale, there is no complete per-counter restore-all, and missing live references fabricate a zero counter. See `src/features/counters/model.ts:19-37`, `src/features/counters/CounterEditor.tsx:154-215`, and `src/features/tally-super/TallySuper.tsx:124-134`.

**Required behavior:** Every listed counter element supports its specified independent position, scale, rotation, and applicable dimensions. Optional elements remain visible and restorable in the editor when hidden on-card. A per-counter restore-all returns all elements to defaults. Missing live-counter references show an unavailable state without private stale labels or fabricated values. Obsolete types are ignored safely.

**Acceptance:** Each transform round-trips through persistence, sync, transfer, copy, Trash, and group operations; restore-all recovers a usable card; deleting or losing a referenced counter produces an accessible unavailable state.

### GAP-027 Safe Portable Iframe Markup

**Current evidence:** A user-controlled counter name is interpolated directly into a quoted iframe title. See `src/features/embed/EmbedComponents.tsx:38`.

**Required behavior:** Generated markup uses safe attribute encoding or DOM serialization for every user-controlled value and produces a valid contained iframe snippet. The URL itself contains only the approved encoded projection.

**Acceptance:** Names containing single quotes, double quotes, angle brackets, ampersands, Unicode, and attempted attributes remain inert title text when pasted into a host document. This also closes SPEC-008.

### GAP-028 Embed Telemetry Exclusion

**Current evidence:** Analytics and Speed Insights mount globally on `/embed` while the snapshot is in the query string. See `src/app/AppProviders.tsx:1-11`, `src/App.tsx:46-55`, and `src/features/embed/EmbedComponents.tsx:29-38`.

**Required behavior:** Embed routes do not initialize telemetry capable of collecting route URLs or snapshot payloads. Application analytics never include query strings, snapshot payloads, names, values, scripts, source identifiers, account data, or group data. Exclusion is structural rather than dependent on provider defaults.

**Acceptance:** Network and analytics inspection of builder, published embed, malformed embed, and embed interaction paths shows no snapshot URL or payload in telemetry.

### GAP-032 Complete Group Embed and Preview

**Current evidence:** Shared cards receive a no-op embed callback; preview buttons are static; clipboard failure is swallowed; details/progress are incomplete. See `src/features/groups/SharedGroups.tsx:160-168` and `src/features/embed/EmbedComponents.tsx:39-45`, `115-163`, and `210-253`.

**Required behavior:** Any visible group counter can create the same strict independent snapshot as a personal counter without granting group access. Builder preview is interactive but ephemeral, resets when encoded source/options change, enforces limits, and displays only approved four-field details. Clipboard and generation failures are visible and recoverable.

**Acceptance:** An authorized viewer publishes a group snapshot, interacts with preview without changing the source, changes options and observes preview reinitialization, handles denied clipboard access, and decodes no group/private fields.

### GAP-034 Keyboard Customization and Movement

**Current evidence:** Workspace Super placement/transforms and folder movement depend on pointer gestures. See `src/features/tally-super/TallySuper.tsx:201-278`, `607-698`, and `src/pages/CountersPage.tsx:1069-1100`.

**Required behavior:** Every placement, move, resize, scale, rotation, ordering, zone assignment, counter-folder assignment, and folder-parent action has a complete keyboard-operable alternative with an accessible name, state, constraints, and confirmation or recovery where needed. Pointer interactions remain available.

**Acceptance:** A keyboard-only user can reproduce and reverse every organization and customization result available by pointer without losing required actions or requiring horizontal page scrolling.

## Combined Acceptance

A user loads untrusted script/customization records, explicitly runs each recorded language, changes the counter while a script sleeps, and observes operation-based publication without stale overwrite. The user customizes and restores every element by keyboard, then publishes personal and group snapshots with hostile names. Decoded payloads and telemetry contain only approved public data, generated markup remains inert, preview is independently interactive, and no required action becomes hidden.

## Sources

- [PRD: Automation Requirements](../../product-specification.md#automation-requirements)
- [PRD: Tally Super Requirements](../../product-specification.md#tally-super-requirements)
- [PRD: Embed Requirements](../../product-specification.md#embed-requirements)
- Target-to-Codebase Gap Report findings 2, 3, 16, 23, 24, 27, 28, 32, and 34
- Code-Problems Report SPEC-004 and SPEC-008
