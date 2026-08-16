# Experience, Security, and Verification

## Purpose

This document defines the cross-cutting target-state contract by which Tally's workflows, data boundaries, safety behavior, accessibility, responsive behavior, browser support, analytics, and product claims are accepted. These requirements apply to basic local counting and to every optional account, synchronization, sharing, group, backup, embed, script, and customization flow.

## User Outcomes

- A user can complete core counting and recovery workflows from 320 CSS pixels through desktop widths on supported desktop and mobile browsers.
- A user receives complete, legible, keyboard-operable behavior in light and dark themes without depending on color or motion.
- Malformed data and optional online failures produce recoverable, action-specific states without preventing unrelated local counting.
- Authentication, personal cloud, group, sharing, and analytics boundaries preserve ownership, authorization, and private data.
- Destructive and replacing actions are deliberate, and uncertain persistence is never presented as a guarantee.
- Product surfaces and documentation consistently describe Tally as free, open source, account-optional, local-first, and unsuitable for unvalidated high-stakes reliance.

## Scope

- Cross-cutting verification of responsive layout, supported browsers, themes, accessibility, status communication, and reduced motion.
- Validation and recovery for malformed browser, backup, embed, synchronization, sharing, group, script, and customization data.
- Authentication, reauthentication, ownership, membership, permission, public-client credential, secret, and analytics boundaries.
- Destructive and replacing confirmations.
- Isolation of optional online and script failures from unrelated personal counting.
- Verification of free, open-source, account-optional, local-first, and high-stakes-suitability claims.

## Out of Scope

- Native mobile or desktop applications.
- Guarantees of zero data loss under every browser, device, or network failure.
- Certification or assurance for safety-critical, regulated, financial, medical, or other high-stakes records.
- A paid tier, subscription, trial, premium entitlement, or feature gate.
- Feature-specific behavior beyond what is necessary to state its cross-cutting acceptance boundary.
- Browser versions outside the stated support window.

## Domain and Data Boundaries

### Data Locations

Tally distinguishes these locations and ownership models:

| Data class | Boundary |
| --- | --- |
| Device-local personal data | Browser-resident and usable without an account or network. |
| Synchronized personal data | Owned by one account and synchronized without replacing browser persistence. |
| Local Counter bundle | Entirely excluded from cloud payloads, including its core counter, script, per-counter customization, and retained deleted state. |
| Counter Copy | A transferred snapshot that becomes a new independent recipient-owned personal counter. |
| Group-owned data | Separate group workspace governed by current membership and permissions. |
| Embedded Counter | An independently interactive snapshot that neither reads nor writes source state. |
| Counter Backup | A validated portable personal-data file with an explicit scope and no account or group ownership transfer. |
| Personal Activity History | Device-local history, undo/redo, and session statistics excluded from cloud synchronization. |

No status, label, claim, or interaction may imply synchronization, persistence, ownership, recoverability, or privacy that the corresponding boundary does not enforce.

### Trust Boundaries

- Browser code receives only credentials intended for public clients.
- Private authentication, recovery, reauthentication, and sharing secrets remain outside public profile and analytics data.
- Personal cloud records require account ownership.
- Group records require current membership and effective permission for every protected operation.
- Backup files, shared scripts, embed payloads, browser storage, and network responses are untrusted inputs and require validation before use.
- Interface visibility is not an authorization boundary.

### Analytics Boundary

Analytics may describe coarse product interaction and operational outcomes only. Analytics must not contain personal counter names or values, scripts, account data, group data, backup content, private authentication or sharing secrets, recipient addresses, or payloads from personal or group records.

## Detailed Behavior

### Progressive and Account-Optional Use

A first-time user can reach the personal workspace and create, increment, decrement, edit, reset, and delete a counter without registration or network access. Advanced controls, accounts, sharing, groups, scripting, embeds, and customization remain optional and do not obstruct the primary value and count actions.

Signing in adds optional online capabilities without replacing local browser persistence. Signing out, remote account deletion, or device deauthorization preserves browser-resident personal data, signs the user out where required, and explains the resulting state.

### Responsive Acceptance

Core personal counting, counter editing, settings, recovery, and account flows must be fully operable at every viewport width from 320 CSS pixels through desktop widths. Optional sharing, groups, scripting, embeds, backups, and customization flows must preserve the same minimum-width accessibility when present.

At 320 CSS pixels:

- required content and actions remain reachable without clipping or irreversible overlap;
- dialogs and forms fit the viewport or provide intentional scrolling;
- labels, errors, status, and destructive consequences remain visible with their controls;
- no required workflow depends on horizontal page scrolling;
- custom layouts cannot make required counter actions irrecoverably inaccessible.

Responsive changes may alter arrangement and density but must not remove capability, context, confirmation, or recovery actions.

### Browser Support

Acceptance covers the current and previous major releases of Chrome, Edge, Firefox, and Safari, including current Chrome on Android and Safari on iOS. A workflow is supported only when its interaction, persistence, focus, scrolling, theme, validation, and recovery behavior is usable in each applicable browser.

Capability limitations imposed by a browser must produce an understandable fallback or unsupported state. They must not silently corrupt data or falsely report success.

### Theme and Visual State

Light and dark themes retain legible contrast, visible focus, complete controls, understandable disabled states, and readable errors, statuses, progress, and limits. Theme changes affect presentation, not data or authorization.

No state relies solely on color. Selected, pending, synchronized, local-only, offline, conflict, error, permission, completion, limit, and destructive states have text, icons with accessible names, or semantic state in addition to visual styling.

### Keyboard and Semantic Operation

Every interactive control has an understandable accessible name, a logical focus order, visible focus, and keyboard operation matching its role. Native semantics are used where available; custom interaction patterns expose equivalent name, role, value, state, and keyboard behavior.

Dialogs:

- receive focus at a meaningful starting point;
- contain focus while modal;
- close through their defined keyboard action unless a required decision prevents dismissal;
- return focus to a sensible invoking control;
- identify title, description, errors, and destructive consequences to assistive technology.

Status messages, asynchronous errors, and completed actions are perceivable without forcing unexpected focus movement. Progress and hard-limit state have textual or semantic meaning.

### Motion

Nonessential animation respects both the user's reduced-motion preference and Tally's animation setting. Disabling motion cannot remove information, completion feedback, focus indication, or access to an action.

### State Communication

Empty, loading, local-only, saving, synchronized, offline, conflict, error, pending, permission-denied, and destructive-confirmation states explain the available next action. A displayed success state requires confirmed success at the relevant boundary.

Realtime disconnection does not imply a successful group operation. Browser save does not imply cloud synchronization. A pending final network flush does not imply guaranteed persistence. Snapshot sharing or embedding does not imply a live relationship.

### Malformed Data Recovery

Malformed browser data must not prevent Tally from opening. Tally isolates invalid records or sections, preserves valid recoverable data where boundaries allow, and presents a clear recovery path rather than silently treating malformed values as trusted state.

Specific boundaries are:

- invalid JSON, unsupported backup structure, missing required sections, or malformed counter records cause an actionable import error before current data changes;
- invalid or missing embed data produces a clear error instead of a broken counter;
- obsolete workspace customization types are ignored safely rather than preventing load;
- malformed scripts are not run or interpreted as a different language;
- malformed synchronization, sharing, or group data cannot bypass ownership, membership, permission, or secret boundaries;
- invalid numeric input never creates a non-finite counter value.

### Destructive and Replacing Actions

Data replacement, permanent personal-counter deletion, account deletion, shared-counter deletion, and group deletion require a deliberate confirmation that identifies the scope and permanence of the action. Confirmation is distinct from initiation and is not inferred from navigation or a generic save action.

Import identifies the scope that will be replaced and validates the complete selected input before mutation. Failed validation or cancellation leaves current data unchanged.

### Authentication and Security Actions

Account security actions use appropriate authentication or reauthentication. Password creation requires at least eight characters including a lowercase letter, uppercase letter, digit, and symbol. The requirements are visible while entering a password.

Confirmation, recovery, and reauthentication tokens are accepted only for their intended account action and are never exposed in public profile or analytics data. Username and email sign-in identify the same account boundary. Usernames remain unique when used as shareable identities.

When an account or device is no longer authorized, Tally signs out locally, explains the event, and preserves browser data. Account deletion removes account-owned cloud access and data but does not erase personal data merely because it remains in the browser.

### Authorization Verification

Personal cloud reads and writes require ownership by the authenticated account. Group reads and writes require active membership and the effective permission for that operation. Counter Copy requests require the sender or recipient role appropriate to the action.

Authorization is checked at the data boundary for direct controls, manually constructed requests, script-published operations, retries, and stale clients. Hiding or disabling a control supplements but never replaces enforcement.

### Script Safety

TallyScript stops after 10,000 uninterrupted loop iterations. JavaScript stops after one second of uninterrupted CPU work or after exceeding 16 MiB memory or a 512 KiB stack. Yielding starts a new uninterrupted interval and keeps the interface, including Stop, operable.

Resource failure produces a visible error, preserves the latest valid published state, and does not impair unrelated counters. Scripts stop on page close or reload and never resume automatically on next load. Imported and copied scripts remain stopped.

### Product Claims

Product and documentation claims must remain mutually consistent:

- `Free` means no subscription, paid plan, trial, premium entitlement, or feature gate applies to any product capability.
- `Open source` means Tally's complete source is publicly available under an open-source license. Tally Super is a free customization capability, not a commercial tier.
- `Account-optional` means personal counting, local automation, embeds, customization, backups, and local persistence do not require an account.
- `Local-first` means browser persistence remains a usable source of personal data and optional cloud services do not replace it.
- `Not for unvalidated high-stakes reliance` means Tally does not claim guaranteed suitability for safety-critical, regulated, financial, medical, or comparable records; important deployments require independent validation.

Claims must not promise zero data loss, live synchronization for snapshots, confidentiality beyond enforced boundaries, or safety certification that Tally does not provide.

## Validation and Normalization

- Validate untrusted input at its owning boundary before it changes trusted state.
- Reject or safely ignore unknown fields according to the format's forward-compatibility rules; unknown fields never grant authority or trigger script execution.
- Parse numeric input only to finite values and apply counter limits and other normalization consistently across direct interaction, imports, scripts, copies, and group operations.
- Validate backup format version, scope, required sections, and all selected records before replacement.
- Validate embed payload and required options before rendering interactive controls.
- Validate account-action tokens for purpose and authorization before changing credentials or identity.
- Validate synchronization ownership and group membership and permissions against current authoritative identity, not client-supplied claims.
- Treat analytics payload construction as validation: prohibited personal or secret fields must be absent, not merely redacted after collection.
- Product claim acceptance requires exact semantic consistency across user-facing product surfaces and documentation, even when wording differs.

## Failure and Recovery

- Every authentication, synchronization, sharing, group, embed, backup, and script failure has a visible state appropriate to the failed action.
- Failure messages state what did not complete and the safe available next action without disclosing secrets or private existence beyond the intended flow.
- A synchronization error leaves the browser copy usable and visible. Recovery can resume synchronization without requiring recreation of local changes.
- If browser and cloud contain materially different nonempty eligible data, the user receives explicit keep-device, use-cloud, or merge choices; no usable browser version is silently discarded.
- Malformed data falls back to a recoverable state and remains isolated from valid unrelated data.
- Optional online failures do not disable unrelated local personal counting.
- Script resource failures terminate only the affected script and preserve its latest valid published state.
- Failure during a replacing or destructive operation must not be reported as success; the visible state is reconciled with authoritative data.
- Tally states the limits of browser persistence, final network flushes, and synchronization rather than guaranteeing zero data loss.

## Integrations and Dependencies

- Core counter behavior supplies the account-free workflow and consistent numeric normalization.
- Browser persistence supplies the local-first baseline and malformed-data recovery boundary.
- Accounts and personal synchronization supply identity, cloud ownership, conflict, reauthentication, and status behavior.
- Backups and embeds supply untrusted portable and encoded-data boundaries.
- Counter Copy sharing and Live Groups supply role, privacy, permission, realtime, concurrency, and idempotency boundaries.
- Scripting supplies isolated runtime, resource, stop, language-identity, and published-state boundaries.
- Tally Super and workspace preferences supply theme, custom-layout, animation, and required-action recoverability rules.
- Public source and license availability support the open-source claim.

## Privacy and Security

- Only public-client credentials may reach browser code.
- Personal cloud data is private to its owning account.
- Local Counter bundles, personal Activity History, undo/redo, and session statistics never enter cloud payloads.
- Group data is private to authorized current members according to effective permissions.
- Snapshot embeds grant no source workspace or group access.
- Private tokens, passwords, sending PINs, and equivalent secrets never appear in public profile data, public browser-readable data, or analytics.
- Analytics excludes personal counter names and values, scripts, account data, group data, backup content, recipient identities, and private payloads.
- Security and privacy states are described according to enforced boundaries and do not overstate confidentiality, persistence, or suitability.
- Documentation advises independent validation for important deployments and does not characterize Tally as suitable for unvalidated high-stakes reliance.

## Accessibility and Responsive Behavior

Cross-cutting acceptance requires all of the following together:

- full core workflow operation from 320 CSS pixels through desktop widths;
- support for the current and previous major desktop browser releases and current Chrome on Android and Safari on iOS;
- complete controls and legible contrast in light and dark themes;
- keyboard access, understandable names, logical focus, and perceivable asynchronous feedback;
- non-color-only errors, statuses, permissions, progress, limits, and destructive states;
- reduced-motion and animation-setting compliance for nonessential motion;
- required counter actions recoverable from custom layouts;
- no malformed-data or optional-online error that blocks unrelated local counting.

A workflow is not accepted by passing only its default desktop, pointer, light-theme, online, valid-data path.

## Acceptance Scenarios

1. **Account-free core workflow**
   - Given a first-time user has no account and no network
   - When the user opens the workspace and creates, increments, decrements, edits, resets, and deletes a personal counter
   - Then the workflow remains usable and browser persistence does not require registration

2. **320 CSS pixel operation**
   - Given any core personal counting, editing, settings, recovery, or account flow at 320 CSS pixels
   - When the user completes the flow
   - Then labels, controls, errors, confirmation consequences, and recovery actions remain reachable without required horizontal page scrolling

3. **Supported browser matrix**
   - Given the current and previous major Chrome, Edge, Firefox, and Safari releases and current Chrome on Android and Safari on iOS
   - When each applicable core workflow is exercised
   - Then interaction, persistence, focus, scrolling, theme, validation, and recovery behavior is usable in every supported browser

4. **Theme completeness**
   - Given a workflow contains enabled, disabled, focused, pending, error, and destructive states
   - When it is viewed in light and dark themes
   - Then all controls and states remain complete, legible, and distinguishable without color alone

5. **Keyboard and dialog behavior**
   - Given a keyboard and assistive-technology user opens a destructive confirmation
   - When the user reviews, cancels, or confirms it
   - Then title, consequence, controls, focus containment, keyboard operation, error feedback, and focus return are perceivable and logical

6. **Reduced motion**
   - Given reduced motion or Tally animations are disabled
   - When a status, layout, or counter value changes
   - Then nonessential motion is suppressed without removing information, focus, or actions

7. **Malformed browser data**
   - Given browser storage contains malformed data alongside valid personal data
   - When Tally opens
   - Then the application reaches a recoverable state, isolates invalid data, preserves valid recoverable data where allowed, and keeps unrelated local counting usable

8. **Malformed backup**
   - Given a backup has invalid JSON, unsupported structure, a missing required section, or malformed counter records
   - When import is attempted
   - Then an actionable error appears and no selected current data is partially replaced

9. **Malformed embed**
   - Given embed data is missing or invalid
   - When the embed opens
   - Then a clear error state appears instead of a broken or misleading counter

10. **Obsolete customization data**
    - Given workspace customization includes an obsolete type
    - When the workspace loads
    - Then the obsolete type is ignored safely and does not prevent valid workspace or counter data from loading

11. **Optional online failure isolation**
    - Given authentication, synchronization, sharing, or group service is unavailable
    - When a local personal counter user continues counting
    - Then local counting remains usable and the failed online feature presents its own status and recovery action

12. **Synchronization truthfulness**
    - Given a change is saved in the browser but cloud completion is unconfirmed
    - When status is displayed
    - Then the interface distinguishes local saving from synchronization and does not claim synchronized success

13. **Authorization outside controls**
    - Given a user lacks ownership or group permission and constructs a protected request outside the interface
    - When the request reaches the data boundary
    - Then it is rejected without partial mutation or private-data disclosure

14. **Private security action**
    - Given an account action requires reauthentication
    - When the user supplies an invalid or wrong-purpose token
    - Then the action is rejected, the token remains private, and browser-resident personal counters remain unchanged

15. **Script resource failure**
    - Given a script exceeds its uninterrupted loop, CPU, memory, or stack limit
    - When the limit is reached
    - Then the affected script stops with a visible error, its latest valid published state remains, and unrelated counters stay operable

16. **Deliberate destructive action**
    - Given a user initiates data replacement, permanent counter deletion, account deletion, shared-counter deletion, or group deletion
    - When explicit confirmation has not occurred
    - Then no destructive or replacing change occurs

17. **Analytics content restriction**
    - Given analytics are emitted from personal, account, sharing, group, backup, embed, or script workflows
    - When the payload is inspected
    - Then it contains no personal counter name or value, script, account data, group data, backup content, recipient identity, private token, PIN, or private record payload

18. **Free capability claim**
    - Given any product capability including Tally Super, scripts, sharing, groups, embeds, backups, or customization
    - When a user attempts to use it under its stated account and online prerequisites
    - Then no subscription, payment, trial, premium entitlement, or commercial feature gate is required

19. **Open-source claim**
    - Given Tally describes itself as open source
    - When the claim is verified
    - Then the complete source is publicly available under an open-source license and no product surface describes Tally Super as a paid tier

20. **Account-optional and local-first claims**
    - Given Tally describes itself as account-optional and local-first
    - When personal counting, local automation, embeds, customization, backups, sign-out, or account deletion is exercised
    - Then those claims match the enforced browser and account boundaries and account loss alone does not erase browser-resident personal data

21. **High-stakes and persistence claims**
    - Given product or user documentation discusses reliability or important records
    - When the wording is reviewed
    - Then it avoids zero-data-loss and safety-suitability guarantees and advises independent validation for safety-critical, regulated, financial, medical, or comparable use

22. **Cross-cutting combined path**
    - Given a keyboard user on a supported mobile browser at 320 CSS pixels, in dark theme, with reduced motion and malformed optional online data
    - When the user opens Tally and operates a valid local personal counter
    - Then the counter remains usable, the malformed online state is isolated and perceivable, controls remain complete, and no private data enters analytics

## Sources

- PRD: [Product Summary](../product-specification.md#product-summary)
- PRD: [Product Principles](../product-specification.md#product-principles)
- PRD: [Local First](../product-specification.md#local-first)
- PRD: [Explicit Data Ownership](../product-specification.md#explicit-data-ownership)
- PRD: [Safe Power](../product-specification.md#safe-power)
- PRD: [Free and Open Source](../product-specification.md#free-and-open-source)
- PRD: [Non-Goals](../product-specification.md#non-goals)
- PRD: [Synchronization Boundary](../product-specification.md#synchronization-boundary)
- PRD: [Conflict and Failure Behavior](../product-specification.md#conflict-and-failure-behavior)
- PRD: [Import Behavior](../product-specification.md#import-behavior)
- PRD: [Runtime Behavior](../product-specification.md#runtime-behavior)
- PRD: [Embed Requirements](../product-specification.md#embed-requirements)
- PRD: [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- PRD: [Experience and Quality Requirements](../product-specification.md#experience-and-quality-requirements)
- PRD: [Progressive Usability](../product-specification.md#progressive-usability)
- PRD: [Responsive Web Experience](../product-specification.md#responsive-web-experience)
- PRD: [Accessibility](../product-specification.md#accessibility)
- PRD: [Data and Security](../product-specification.md#data-and-security)
- PRD: [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- Guide: [Introduction](../../src/content/guide/introduction.mdx)
- Guide: [Accounts](../../src/content/guide/accounts.mdx)
- Guide: [Account security](../../src/content/guide/account-security.mdx)
- Guide: [Account management](../../src/content/guide/account-management.mdx)
- Guide: [Account synchronization](../../src/content/guide/account-sync.mdx)
- Guide: [Local counters](../../src/content/guide/local-counters.mdx)
- Guide: [Backups](../../src/content/guide/backups.mdx)
- Guide: [Backup import](../../src/content/guide/backup-import.mdx)
- Guide: [Embeds](../../src/content/guide/embeds.mdx)
- Guide: [Sharing privacy](../../src/content/guide/sharing-privacy.mdx)
- Guide: [Scripting](../../src/content/guide/scripting.mdx)
- Guide: [Appearance settings](../../src/content/guide/appearance-settings.mdx)
