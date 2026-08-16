# Experience, Platform, and Maintainability

## Purpose

Close the report findings that prevent complete keyboard, semantic, responsive, reduced-motion, browser, deployment, licensing, documentation, repository-standard, and maintainability acceptance across all product features.

## Existing Feature Sources

- [Experience, Security, and Verification](../experience-security-verification.md)
- [Core Counter Engine](../core-counter-engine.md)
- [Personal Workspace Organization](../personal-workspace-organization.md)
- [Accounts and Personal Synchronization](../accounts-and-personal-sync.md)
- [Backup and Restore](../backup-and-restore.md)
- [Counter Copy Sharing](../counter-copy-sharing.md)
- [Live Groups](../live-groups.md)
- [Automation Runtime](../automation-runtime.md)
- [Snapshot Embeds](../snapshot-embeds.md)
- [Tally Super](../tally-super.md)

## Shared Contract

No feature is complete only on a default desktop pointer path. Accepted behavior remains operable and perceivable from 320 CSS pixels through desktop widths, in light and dark themes, with keyboard and assistive technology, reduced motion, malformed data, optional-service failure, and every supported browser. Source, tests, schema, license, and user documentation must support rather than contradict that delivered behavior.

## Product Findings and Required Behavior

### GAP-026 Dialog and Control Accessibility

**Current evidence:** Most modal roots lack dialog semantics, focus containment, Escape behavior, inert backgrounds, and focus restoration; switches and tabs lack complete names/state. Representative evidence: `src/features/counters/CounterEditor.tsx:460-480`, `src/features/auth/AuthModal.tsx:993-1010`, `src/features/settings/AppSettings.tsx:83-100`, `241-301`, and `src/features/embed/EmbedComponents.tsx:46-60`.

**Required behavior:** Every modal identifies its dialog role, title, description, errors, and destructive consequences; establishes meaningful initial focus; contains focus; handles its defined dismissal keys; makes obscured content unavailable; and restores focus. Every custom control exposes correct name, role, value/state, selection, and keyboard operation. Destructive and replacing actions remain deliberate.

**Acceptance:** Keyboard and screen-reader journeys through every editor, auth, conflict, backup, copy, group, Trash, embed, history, stats, and Super dialog preserve context and expose all outcomes without relying on color.

### GAP-035 Complete 320-Pixel Experience

**Current evidence:** Undo/redo disappear below 620px, the header lacks verified collapse, Super editor minimum widths exceed the viewport, and mobile Playwright projects are disabled. See `src/styles.css:69-103`, `4916-4945`, and `playwright.config.ts:39-63`.

**Required behavior:** Core and optional workflows retain every capability, context, confirmation, and recovery action at 320 CSS pixels without required horizontal page scrolling. Arrangement and density may change; functionality may not disappear. Dialogs intentionally scroll, custom layouts preserve required actions, and long content cannot force page overflow.

**Acceptance:** The complete personal, account, backup, script, embed, copy, group, Trash, organization, history, statistics, and customization journeys succeed at 320 pixels in both themes.

### GAP-036 Reduced Motion

**Current evidence:** Motion suppression uses only `.no-animations`; no `prefers-reduced-motion` rule exists. See `src/styles.css:2723-2728`.

**Required behavior:** Nonessential animation and transition respect both the operating-system reduced-motion preference and Tally's animation setting. Suppression never removes status, completion, focus, or action availability.

**Acceptance:** With either preference disabled, all nonessential motion stops across counters, goals, dialogs, navigation, drag alternatives, scripts, sync, and Super while information and focus remain complete.

### GAP-037 Semantic Progress and Status

**Current evidence:** Goal tracks lack progress semantics and many authentication, backup, sharing, and group messages are not status/alert live regions. See `src/features/counters/CounterCard.tsx:242-299`, `src/features/auth/AuthModal.tsx:482-967`, and `src/features/settings/AppSettings.tsx:196`.

**Required behavior:** Goal progress exposes direction, active/final milestone, bounded value, and completion through suitable progress semantics or equivalent text. Limits expose blocked direction. Loading, pending, saving, synchronized, completed, warning, and error messages use appropriate status/alert semantics without stealing focus or repeated noise.

**Acceptance:** Assistive technology receives each meaningful asynchronous state once and can distinguish progress, limit, completion, pending, and failure without visual color or hover.

### GAP-038 Supported Browser Acceptance

**Current evidence:** Playwright covers generic desktop engines while mobile Chrome, Mobile Safari, Chrome, and Edge projects are disabled and no current/previous release matrix is enforced. See `playwright.config.ts:38-73` and `e2e/app.spec.ts:8-164`.

**Required behavior:** Acceptance covers current and previous Chrome, Edge, Firefox, and Safari plus current Chrome on Android and Safari on iOS. Applicable persistence, focus, scrolling, validation, clipboard, download/upload, worker/runtime, realtime, theme, and recovery behavior is verified or has an explicit understandable fallback.

**Acceptance:** The supported matrix executes representative complete workflows, with device-specific limitations visible rather than silently corrupting state or reporting false success.

### GAP-039 Enforced Open-Source Claim

**Current evidence:** README calls Tally open source but the repository has no license and package metadata has no license field. See `README.md:1-3` and `package.json:1-5`.

**Required behavior:** The complete source is distributed under an explicit recognized open-source license; repository and package metadata identify it consistently; no feature, including Tally Super, implies a paid entitlement.

**Acceptance:** A reviewer can identify the license terms from the repository root and package metadata, and all product claims remain consistent with them.

### GAP-040 Authoritative Documentation

**Current evidence:** Guides claim queued sync and navigation waiting, complete backup, statistics/history coupling, and complete Local Counter exclusion that code does not provide. Examples: `src/content/guide/account-sync.mdx:9-17`, `README.md:102`, `src/content/guide/backup-export.mdx:17`, `src/content/guide/stats.mdx:23-25`, and `src/content/guide/local-counters.mdx:5-9`.

**Required behavior:** README, guides, tutorials, examples, setup instructions, security/reliability language, and generated public metadata describe delivered PRD behavior exactly. Documentation distinguishes browser save from cloud acknowledgement, best-effort exit from guarantees, snapshots from live data, statistics reset from history deletion, and suitability from high-stakes assurance.

**Acceptance:** A claim audit finds no contradiction with the PRD, feature contracts, observed product behavior, supported setup path, license, or safety boundaries.

## Repository Conformance Findings

### STD-001 Pill-Switch Contract

**Current evidence:** `src/features/counters/CounterEditor.tsx:747-754`, `src/features/auth/AuthModal.tsx:670-750`, `src/features/settings/AppSettings.tsx:246-300`, `src/features/tally-super/TallySuper.tsx:413-432`, `src/features/guide/GuideExamples.tsx:76`, `105`, `src/features/embed/EmbedComponents.tsx:70-78`, and `src/styles.css:1760-1764`, `2672-2675`, `3269-3275`.

All toggles use the documented hidden checkbox, empty `i` track, then label text structure with an invariant 32px by 18px pill in flex layouts, light theme, and dark theme. Current violations include `CounterEditor`, `AuthModal`, `AppSettings`, `TallySuper`, guide examples, embed controls, and conflicting CSS dimensions.

### STD-002 Feature Ownership Boundaries

**Current evidence:** `src/pages/CountersPage.tsx:92-1579`, including remote validation at `207-225`, synchronization at `302-462`, history at `497-586`, script runtime at `587-793`, backup import at `794-890`, folders at `1054-1117`, and rendering at `1140-1579`.

`src/pages/CountersPage.tsx` no longer owns unrelated validation, synchronization, persistence, history, runtime, import, folder, and rendering responsibilities as one divergent-change unit. Those behaviors expose cohesive feature-owned boundaries while preserving all current routes and capabilities.

### STD-003 Explicit Domain Types

**Current evidence:** `src/features/counters/model.ts:1` defines `AnyRecord = Record<string, any>` and that unrestricted shape crosses counters, scripts, customization, backups, groups, props, and runtime state.

Unrestricted `Record<string, any>` no longer defines counters, scripts, customizations, backup sections, group rows, component contracts, or runtime state. Persisted fields, ownership modes, operation identities, language, scope, and validation results are statically explicit at trust boundaries.

### STD-004 Guide Examples Reuse Product Contracts

**Current evidence:** `src/features/guide/GuideExamples.tsx:72-122` reconstructs settings, backup, embeds, Trash, sharing, groups, and Tally Super behavior.

Guide examples do not independently reimplement settings, backup, embed, Trash, sharing, group, or Super behavior. They reuse production components or shared behavior models so examples cannot drift from accepted interfaces.

### STD-005 Test Location

**Current evidence:** Tests currently live at `src/features/groups/SharedGroups.test.tsx`, `src/features/sharing/CopySharing.test.tsx`, `src/features/scripting/javascript.test.ts`, `src/features/scripting/tallyscript.test.ts`, `src/features/tally-super/TallySuper.test.tsx`, and `src/features/trash/TrashModal.test.tsx`.

Vitest unit and component tests live under `src/__tests__/` as required, including current group, sharing, scripting, Super, and Trash tests.

### STD-006 Test Suffixes

**Current evidence:** `src/features/scripting/javascript.test.ts`, `src/features/scripting/tallyscript.test.ts`, and `src/__tests__/group-permissions.test.ts` use an undocumented suffix.

Tests use the documented `*.test.tsx` or `*.spec.ts` naming contract; TypeScript tests use the accepted suffix/location convention consistently.

### STD-007 Quotes and Semicolons

**Current evidence:** Inconsistencies include `playwright.config.ts:3-82`, `vite.config.js:2`, `src/vite-env.d.ts:3-11`, `supabase/functions/delete-account/index.ts:1-38`, and tutorial MDX imports under `src/content/guide/tutorial-*.mdx`.

TypeScript, TSX, JavaScript, Edge Functions, configuration, declarations, and MDX imports conform to the repository's double-quote and semicolon style without changing behavior.

### STD-008 Constant Naming

**Current evidence:** Nonconforming declarations include `src/features/counters/model.ts:39` (`starter`), `src/features/scripting/javascript.ts:12` (`quickJsModule`), `src/features/scripting/tallyscript-compiler.ts:8` (`expressionNames`), `:49` (`settingCommands`), and `corsHeaders` in both Edge Functions.

Module-level constants use uppercase snake case, including current starter data, runtime module handles, compiler command maps, and Edge Function CORS headers.

### STD-009 Shared Super Permission Mapping

**Current evidence:** Equivalent permission maps exist in `src/features/counters/CounterEditor.tsx:7-16` and `src/features/groups/SharedGroups.tsx:115-124`.

Counter editor and group editor consume one authoritative mapping between Super parts and effective permissions, including embed and goal-direction quick controls.

### STD-010 Shared Supabase Error Formatting

**Current evidence:** Equivalent `readableError` implementations exist in `src/features/groups/SharedGroups.tsx:13-23` and `src/features/groups/useSharedGroups.ts:6-16`.

Group surfaces consume one error formatter for message, details, hint, and code so equivalent failures remain consistent and accessible.

### STD-011 Shared Goal Calculation

**Current evidence:** Goal completion and progress are independently implemented in `src/features/counters/CounterCard.tsx:87-116`, `src/features/tally-super/TallySuper.tsx:135-163`, and `src/features/embed/EmbedComponents.tsx:127-130`, `212-214`.

Counter cards, Tally Super, embeds, guides, and group cards consume the same normalized goal completion and bounded progress result from the Core Counter Engine.

### STD-012 Shared Counter Clamping

**Current evidence:** Equivalent clamping appears in `src/pages/CountersPage.tsx:497-503`, `1019-1029`, `src/pages/LandingPage.tsx:211-223`, `src/features/embed/EmbedComponents.tsx:173-180`, and `src/features/guide/GuideExamples.tsx:27-30`.

Personal workspace, landing examples, embeds, guides, scripts, imports, and groups consume one finite hard-limit normalization operation rather than local `Math.min`/`Math.max` variants.

### STD-013 Single Cloud Projection

**Current evidence:** Substantially identical cloud payloads are built in `src/pages/CountersPage.tsx:371-385`, `401-412`, `467-481`, and `740-762`.

Ordinary save, conflict resolution, initial seed, ongoing sync, and exit persistence consume one synchronization-eligible payload builder so privacy and scope cannot drift.

### STD-014 Shared Guide Navigation

**Current evidence:** `src/pages/GuidePage.tsx` and `src/pages/DeveloperGuidePage.tsx` duplicate collapsible navigation and heading indexing, including the same `.guide-content h2, .guide-content h3` query.

Guide and developer-guide pages share heading indexing, collapsible navigation, keyboard, and active-section behavior instead of maintaining duplicate shells.

### STD-015 Account Subsystem Boundaries

**Current evidence:** `src/features/auth/AuthModal.tsx:68-1051` combines registration, login, OTP, recovery, credential/profile changes, sharing/group settings, sign-out, and deletion.

Authentication UI preserves one coherent user flow while registration, login, OTP, recovery, credential/profile changes, sharing preferences, group preferences, sign-out, and deletion use focused subsystem boundaries rather than one divergent-change implementation.

### STD-016 Feature-Scoped Styling

**Current evidence:** `src/styles.css:1-6262` owns styling for nearly every product feature and changes for unrelated concerns.

Feature work no longer requires unrelated edits throughout one global stylesheet. Shared tokens remain global while feature styles have navigable ownership and preserve cascade order, responsive behavior, and themes.

### STD-017 Remove Conflicting CSS Duplication

**Current evidence:** Repeated or overriding blocks include Super transforms at `src/styles.css:501-537`, compact counters at `2708-2719` and `2749-2787`, landing hero sizing at `2827-2855`, `5975-6000`, `6040-6051`, and `.counter-scripting-tab` at `5147-5149`, `6068-6070`.

Repeated Super transforms, compact counter rules, landing hero sizing, and scripting-tab blocks resolve to one intentional rule set per state without override-order accidents.

### STD-018 Remove Unused Page Barrel

**Current evidence:** `src/pages/index.ts:1-6` only forwards page exports while `src/App.tsx` directly imports pages for lazy route splitting.

The unused page export barrel no longer sits between route-level lazy imports and page modules. Removing or giving it a real consumer does not alter route splitting or public module behavior.

## Maintainability Acceptance

- All 18 STD identifiers have focused automated or static verification where practical and no longer reproduce at their cited locations or equivalent replacements.
- Refactoring preserves every accepted feature and public route; it does not hide failures by deleting capability, tests, guides, or supported behavior.
- Shared normalization, goal calculation, permission mapping, cloud projection, and error formatting each have one authoritative contract consumed across ownership contexts.
- Feature boundaries reduce divergent change without introducing compatibility layers unsupported by persisted data or external consumers.

## Combined Acceptance

A keyboard and screen-reader user on a supported mobile browser at 320 CSS pixels, in dark theme with reduced motion, can open malformed local data, operate a valid local counter, recover from optional online failure, and complete every dialog-driven workflow with semantic progress and status. The same release passes the full browser matrix, exposes an open-source license, documents only delivered guarantees, conforms to repository standards, and resolves every cited duplication, divergent-change, primitive-type, and middle-man finding without removing accepted functionality.

## Sources

- [PRD: Experience and Quality Requirements](../../product-specification.md#experience-and-quality-requirements)
- [PRD: Failure and Safety Requirements](../../product-specification.md#failure-and-safety-requirements)
- [PRD: Product Acceptance Criteria](../../product-specification.md#product-acceptance-criteria)
- Repository `AGENTS.md`
- Target-to-Codebase Gap Report findings 26 and 35 through 40
- Code-Problems Report STD-001 through STD-018
