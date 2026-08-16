# Accounts and Personal Synchronization

## Purpose

Define optional account lifecycle and personal cloud synchronization while preserving the browser as a usable local source, excluding device-local data, and requiring explicit user control when device and cloud data conflict.

## User Outcomes

- A user can count and retain personal data without creating an account.
- A user can create, access, secure, and delete an account where online services are configured.
- A signed-in user can synchronize eligible personal workspace data across devices while continuing to save in the browser.
- A user can distinguish local saving, cloud progress, synchronized state, conflict, offline state, and error.
- A user can resolve materially different device and cloud workspaces without losing Local Counter bundles or device-local activity records.

## Scope

- Account creation, sign-in, recovery, credential changes, sign-out, unauthorized-device handling, and account deletion.
- The inclusion and exclusion boundary for personal synchronization.
- Initial synchronization, ongoing synchronization, status, conflicts, merge behavior, offline queuing, and recovery.
- Synchronization seams with Counter Bundles, folders, Trash, scripts, Tally Super, backup, sharing, and groups.

## Out of Scope

- Mandatory accounts for personal counting, scripting, embeds, customization, or backups.
- Counter Copy delivery details and group membership or permission behavior.
- Synchronization of group-owned records, which use group storage and live group operations.
- Live public embeds.
- Server-hosted or unattended script execution.
- Backup file formats and import replacement rules.

## Domain and Data Boundaries

### Browser and Account Data

Signing in adds personal cloud synchronization; it does not replace browser persistence. The browser copy remains locally usable during authentication, network, synchronization, or optional-service failures.

Synchronization operates only on synchronization-eligible personal workspace data. It does not operate on every browser-resident record.

### Synchronization Inclusion Matrix

| Data area | Personal cloud eligibility | Rule |
| --- | --- | --- |
| Active non-local Counter Bundles | Included | Core counter, linked script, and per-counter Tally Super customization synchronize together. |
| Active Local Counter Bundles | Excluded | No part of the bundle enters a cloud payload. |
| Explicit personal folder structure | Included | Complete hierarchy synchronizes, including empty folders. |
| Tags and folder assignment | Included | They synchronize with eligible personal counters and folder structure. |
| Retained non-local Trash | Conditional | Included only while cloud Trash is enabled. |
| Retained Local Counter Bundles | Excluded | Local exclusion takes precedence over cloud Trash. |
| Personal preferences | Included | Workspace preferences synchronize, subject to the explicit exclusions below. |
| Workspace Tally Super data | Included with exclusions | Counter content or references specific to a Local Counter are removed from cloud payloads. |
| Per-counter Tally Super data | Included for non-local counters | It follows its Counter Bundle. Local-counter customization is excluded. |
| Activity History | Excluded | Remains device-local. |
| Undo/redo state | Excluded | Remains device-local. |
| Session statistics and baselines | Excluded | Remain device-local. |
| Account credentials and security tokens | Not workspace sync data | Managed by the authentication service, not personal workspace payloads. |
| Counter Copy records | Excluded | Sharing workflow data is separate from personal workspace sync. |
| Group-owned counters, folders, scripts, activity, and permissions | Excluded | Group storage is separate from every member's personal workspace. |
| Embed snapshots | Excluded | Embeds are independent encoded snapshots, not synchronized records. |

Conflict comparison, replacement, and merge use this same matrix. Excluded data must not influence whether eligible data materially conflicts and must survive every conflict choice.

## Detailed Behavior

### Account Optionality

- Personal counter creation, counting, editing, local scripting, embeds, Tally Super, Trash, and backup export or import do not require an account.
- Account entry points describe synchronization and account-dependent sharing or group capabilities without implying that local data requires registration.
- If online services are not configured or are unavailable, the personal workspace remains usable.

### Account Creation and Sign-In

- Account creation accepts an email address, unique username, password, and matching password confirmation.
- Passwords require at least eight characters and at least one lowercase letter, uppercase letter, digit, and symbol; each requirement is communicated while entering a password.
- Email confirmation and security tokens are accepted within Tally's account flow.
- Sign-in accepts either username and password or email and password.
- A successful authentication starts synchronization discovery; it does not immediately overwrite device data.
- Usernames identify accounts for account-dependent copies and group invitations without requiring another user to know the email address.

### Recovery and Credential Changes

- A signed-out user can request password recovery through the configured email service.
- A signed-in user can change username, email, and password.
- Username changes enforce uniqueness.
- Email changes require confirmation through the new email address.
- Security-sensitive changes require authentication or reauthentication appropriate to the action and session age.
- Confirmation, recovery, and reauthentication tokens are used only for the requested security action and are not exposed as public profile data.

### Sign-Out, Revocation, and Account Deletion

- Signing out stops personal cloud synchronization on that device and leaves browser-resident personal data available.
- Signing out does not change Local Counter designation.
- If the remote account is deleted or the device becomes unauthorized, Tally signs out locally, explains the condition, and preserves browser data.
- Account deletion requires deliberate confirmation and any required reauthentication.
- Successful account deletion removes the account and cloud-owned data but does not erase browser-resident personal data merely because cloud access ended.
- Account deletion does not imply deletion of independently owned group data without the applicable group lifecycle rules.

### Synchronization State Model

The user-visible synchronization state is one of:

- **Local-only:** no authenticated synchronization session applies.
- **Loading:** cloud state or account authorization is being read.
- **Saving:** eligible local changes are pending or being sent.
- **Synchronized:** all known eligible changes are acknowledged and no unresolved conflict is present.
- **Conflict:** materially different nonempty eligible device and cloud data require a user choice.
- **Error:** an authentication, network, validation, authorization, or persistence failure prevents completion.

Offline is a connectivity qualifier, not a replacement for the synchronization state:

- `Local-only + Offline` applies when no authenticated synchronization session exists and the network is unavailable.
- `Loading + Offline` applies when cloud discovery was interrupted and has not produced an authoritative cloud state.
- `Saving + Offline` applies when eligible changes are saved in the browser but await cloud delivery.
- `Synchronized + Offline` applies only when the last acknowledged eligible state still equals the browser state and no change is pending; wording identifies when it was last synchronized and does not claim current cloud verification.
- `Conflict + Offline` preserves an already discovered conflict and its local resolution choices, but any choice requiring cloud persistence remains pending until connectivity returns.
- `Error + Offline` applies when a failed action requires intervention beyond ordinary connectivity recovery.

When connectivity returns, the qualifier clears, interrupted loading or saving resumes, and Synchronized appears without qualification only after the relevant cloud state is acknowledged. Status wording must distinguish successful browser persistence from completed cloud synchronization.

### Initial Synchronization

1. Authentication succeeds without changing personal workspace data.
2. Tally reads the eligible cloud workspace and derives the eligible device workspace using the inclusion matrix.
3. If both eligible workspaces are nonempty and materially different, Tally enters Conflict and makes no replacing choice automatically.
4. If one eligible side is empty and the other is nonempty, the nonempty eligible workspace seeds the empty side without altering excluded browser data.
5. If both eligible sides are equivalent, synchronization begins without a conflict prompt.
6. Local Counter bundles and device-local activity records remain in place throughout discovery and resolution.

Material difference means a user-meaningful difference in eligible counters, scripts, explicit folders, eligible Trash, preferences, or Tally Super data after validation and normalization. Transport metadata, export time, save time, or representation-only ordering does not create a material conflict.

### Conflict Choices

The conflict interface identifies the device and cloud versions and offers exactly these workspace-level choices:

- **Keep device version:** the eligible device workspace becomes the synchronized personal workspace and replaces eligible cloud data. Excluded device data is preserved unchanged.
- **Use cloud version:** the eligible cloud workspace replaces eligible device data. Local Counter bundles, Activity History, undo/redo, and session statistics are preserved unchanged.
- **Merge both:** eligible data is combined according to the preservation rules below, unresolved singleton conflicts receive explicit user resolution, and the resulting eligible workspace becomes the synchronized version.

No choice may upload excluded data, erase Local Counter bundles, clear Activity History, clear undo/redo, or reset session statistics.

### Merge Preservation Rules

- Identical records with the same stable identity produce one merged record.
- A record present on only one side is preserved.
- Divergent Counter Bundles with the same stable identity are both preserved as independent, distinguishable bundles. One retains the identity and the other receives a new stable identity; each linked script and per-counter customization follows its corresponding counter.
- Divergent retained Counter Bundles follow the same identity and linked-data rule when retained Trash is synchronization-eligible.
- Explicit folders from both sides are preserved, including empty folders. Identity or path collisions that cannot represent both structures receive distinguishable identities or names without dropping descendants.
- Tags and counter folder assignments follow their preserved counter version and are reconciled to preserved folders.
- Compatible preference and workspace Tally Super changes are combined.
- A single-valued preference, workspace element, or other eligible record that cannot be combined without choosing a value is presented for explicit resolution. A divergent linked script makes its Counter Bundle divergent and follows the bundle-preservation rule. Until resolution completes, neither usable version is silently discarded.
- Workspace Tally Super content or references specific to Local Counters remain browser-only and are reattached to the preserved local workspace after eligible merge data is applied.
- Merge completion is atomic from the user's perspective: the merged eligible workspace is committed as one resolution or the pre-resolution device and cloud versions remain available for retry.

### Ongoing Synchronization

- Accepted changes to eligible personal data are saved in the browser and queued for cloud persistence.
- Cloud acknowledgement advances Saving to Synchronized only for the acknowledged eligible state.
- Concurrent differences are preserved, merged, or presented for explicit resolution; a later save must not silently replace a usable divergent version.
- Network loss leaves queued local changes in the browser for retry.
- Network recovery resumes synchronization without requiring recreation of local changes.
- Synchronization of a Counter Bundle uses the complete eligible bundle boundary.
- Enabling Local Counter removes the complete bundle from cloud eligibility. Disabling it makes the complete bundle eligible.
- Changing cloud Trash behavior updates eligibility only for retained non-local bundles.

### Scripts and Navigation

- Scripts execute in the browser and publish normalized counter state to their Counter Bundle.
- A script linked to a non-local counter synchronizes as saved source and published counter state; runtime execution itself is not a cloud job.
- Running scripts stop when the page closes or reloads.
- On page exit, scripts are recorded as stopped locally before any final cloud persistence attempt.
- Tally attempts required final cloud persistence where the browser permits, without claiming a zero-data-loss guarantee.
- On the next load, a script recorded or remotely observed as previously running is stopped and never resumes automatically, even if final cloud persistence failed.
- Controlled in-app navigation with active scripts records them stopped locally, shows a `Stopping scripts and saving` state, and waits for required pending eligible changes to be acknowledged. If persistence fails or exceeds the bounded navigation wait, Tally reports that cloud saving did not complete and lets the user retry or continue navigation with the browser copy preserved.
- Browser close, reload, and external navigation record scripts stopped locally and make a best-effort final persistence attempt where the browser permits, but cannot be blocked indefinitely or represented as guaranteed.
- Pages without active scripts are not delayed solely for script shutdown.

### Feature Seams

- **Counter Bundles:** only complete non-local bundles synchronize. Local exclusion and bundle atomicity are authoritative at payload construction and conflict application.
- **Trash:** retained non-local bundles synchronize only when cloud Trash is enabled; deadlines and linked data remain part of the bundle.
- **Tally Super:** eligible workspace customization synchronizes, excluding Local Counter content or references; per-counter customization follows bundle eligibility.
- **Backup:** backups remain account-independent and can recover or transfer data without changing the synchronization boundary by themselves.
- **Counter Copy:** account identity enables addressing and delivery, but accepted copies become independent personal bundles and are not an extension of the sender's synchronization.
- **Groups:** group-owned records use separate storage, authorization, and conflict handling and never enter personal cloud payloads.
- **Embeds:** snapshots do not read from or write to personal synchronization.
- **Activity and statistics:** device-local history, undo/redo, and session statistics continue independently of cloud choices.

## Validation and Normalization

- Email, username, password, and confirmation inputs must be validated before submitting an account action.
- Username uniqueness is enforced at the account data boundary, not only by interface availability checks.
- Password requirement indicators do not replace server-side enforcement.
- Cloud payloads are filtered by eligibility before upload and validated before application.
- Local Counter references must be removed from synchronization-eligible workspace Tally Super data without deleting the browser-resident references.
- Counter values received through synchronization are normalized and clamped by current counter rules before becoming usable.
- Stable identities must be unique within the resolved personal workspace; merge-created duplicates receive new identities with linked data updated atomically.
- Material conflict comparison ignores excluded data and non-semantic serialization differences.
- Authentication and synchronization responses must be associated with the current account session so stale responses cannot mutate a later session.

## Failure and Recovery

- Authentication failure reports the failed action and leaves the browser workspace usable.
- A synchronization read, write, validation, or authorization failure leaves the visible browser copy usable and enters Error rather than Synchronized.
- Failed conflict resolution leaves the pre-resolution device data intact and permits retry or another choice.
- Failed merge does not partially apply records or partially upload a merged workspace.
- Loss of authorization signs the user out, explains the reason, and preserves browser data.
- Offline edits remain queued locally and resume when connectivity and authorization return.
- If final script persistence cannot complete during exit, the next load still treats the script as stopped and presents any resulting synchronization state honestly.
- Malformed cloud data must not prevent local personal counting or trigger silent replacement.
- The product does not claim guaranteed zero data loss under every browser, device, account, or network failure.

## Integrations and Dependencies

- The authentication service provides account identity, email delivery, session authorization, recovery, and reauthentication.
- Personal cloud storage enforces ownership for every synchronized record.
- Counter Bundle rules define payload atomicity and Local Counter exclusion.
- Folder organization defines the explicit hierarchy, including empty folders.
- Trash preferences determine retained non-local bundle eligibility.
- Tally Super defines workspace and per-counter customization boundaries.
- Script runtime state supplies the stopped-on-exit and never-auto-resume guarantees.
- Counter Copy and group features consume account identity but maintain separate data ownership boundaries.

## Privacy and Security

- Browser code receives only credentials intended for public clients.
- Personal cloud records enforce the authenticated account's ownership at the data boundary.
- Passwords, confirmation codes, recovery tokens, reauthentication tokens, and sharing secrets are not exposed through public profiles, workspace payloads, or analytics.
- Local Counter bundles, Activity History, undo/redo, and session statistics never enter cloud payloads.
- Analytics must not include personal counter names, values, scripts, account data, group data, or synchronization payload content.
- Account deletion and security-sensitive credential changes require deliberate confirmation and appropriate authentication.
- Status text must not claim cloud completion before acknowledgement.

## Accessibility and Responsive Behavior

- Account creation, sign-in, recovery, reauthentication, conflict resolution, and account deletion must work from 320 CSS pixels through desktop widths.
- Forms have programmatic labels, field-level errors, requirement text, and keyboard operation.
- Loading, saving, synchronized, conflict, offline, and error states are announced semantically and do not rely on color alone.
- Conflict choices identify their effect on device and cloud data in text before confirmation.
- Destructive account deletion and replacing conflict choices use focus-managed, keyboard-operable confirmation dialogs.
- Light and dark themes retain legible contrast for status, validation, and disabled controls.
- Motion is nonessential to understanding synchronization progress and respects motion preferences.

## Acceptance Scenarios

1. **Given** no online service or account session is available, **When** a user creates and changes a personal counter, **Then** it remains usable and persists in the browser without an account.
2. **Given** valid unique account details and a conforming password, **When** account creation and required email confirmation succeed, **Then** the user can sign in by username or email.
3. **Given** a password omits a required character class, **When** account creation is attempted, **Then** the unmet requirement is identified and the invalid account action is not accepted.
4. **Given** a signed-in workspace has eligible changes saved locally and queued without a confirmed delivery failure, **When** cloud acknowledgement is pending, **Then** status reports Saving rather than Synchronized.
5. **Given** device and cloud eligible workspaces are both nonempty and materially different, **When** discovery completes, **Then** no side is silently selected and Keep device, Use cloud, and Merge both are offered.
6. **Given** a conflict and Local Counter bundles on the device, **When** the user chooses Use cloud, **Then** eligible device data is replaced while every Local Counter bundle and device-local activity record remains unchanged.
7. **Given** a conflict, **When** the user chooses Keep device, **Then** eligible device data becomes the synchronized version and excluded device data is not uploaded.
8. **Given** both sides contain divergent versions of one counter identity, **When** Merge both completes, **Then** both versions survive with distinguishable identities and each retains its corresponding script and customization.
9. **Given** both sides contain incompatible values for a single-valued preference, **When** merge cannot combine them, **Then** the user explicitly selects a value before resolution completes.
10. **Given** a Local Counter is referenced by workspace customization, **When** synchronization uploads workspace Tally Super data, **Then** the Local Counter reference and bundle are absent from the payload but remain in the browser.
11. **Given** cloud Trash is disabled, **When** a non-local counter enters Trash, **Then** its retained bundle is excluded from synchronization while its browser retention continues.
12. **Given** cloud Trash is enabled and a retained non-local bundle exists, **When** synchronization succeeds, **Then** the complete retained bundle and deadline synchronize without including any Local Counter bundle.
13. **Given** the network fails after local edits, **When** connectivity returns, **Then** queued eligible changes resume synchronization without requiring the user to recreate them.
14. **Given** a running script and pending eligible changes, **When** the page exits, **Then** the script is recorded stopped locally, final persistence is attempted, and the next load does not resume the script automatically even if that attempt failed.
15. **Given** the device becomes unauthorized, **When** an authenticated request is rejected, **Then** Tally signs out, explains the condition, and preserves browser-resident personal data.
16. **Given** the user confirms permanent account deletion, **When** deletion succeeds, **Then** account and cloud-owned data are removed while browser-resident personal data remains available.
17. **Given** malformed cloud workspace data, **When** synchronization validation fails, **Then** the browser workspace remains usable and an actionable error is shown without partial replacement.
18. **Given** eligible changes are saved locally while the device goes offline, **When** status is displayed and connectivity later returns, **Then** it shows Saving plus Offline while pending, resumes delivery automatically, and reports unqualified Synchronized only after acknowledgement.
19. **Given** an active script has pending eligible changes, **When** the user starts controlled in-app navigation and final persistence times out, **Then** the script is recorded stopped, the incomplete cloud save is visible, and the user can retry or continue with the browser copy preserved.
20. **Given** a signed-in cloud write returns a confirmed persistence, authorization, or validation failure, **When** status is displayed, **Then** it reports Error with the failed action and recovery path rather than Saving or Synchronized.

## Sources

- [PRD: Product Principles - Local First](../product-specification.md#local-first)
- [PRD: Product Principles - Explicit Data Ownership](../product-specification.md#explicit-data-ownership)
- [PRD: Accounts and Personal Synchronization - Account Lifecycle](../product-specification.md#account-lifecycle)
- [PRD: Accounts and Personal Synchronization - Synchronization Boundary](../product-specification.md#synchronization-boundary)
- [PRD: Accounts and Personal Synchronization - Conflict and Failure Behavior](../product-specification.md#conflict-and-failure-behavior)
- [PRD: Automation Requirements - Runtime Behavior](../product-specification.md#runtime-behavior)
- [PRD: Experience and Quality Requirements - Data and Security](../product-specification.md#data-and-security)
- [Accounts guide](../../src/content/guide/accounts.mdx)
- [Account security guide](../../src/content/guide/account-security.mdx)
- [Account synchronization guide](../../src/content/guide/account-sync.mdx)
- [Account management guide](../../src/content/guide/account-management.mdx)
- [Account tutorial](../../src/content/guide/tutorial-account.mdx)
- [Local Counters guide](../../src/content/guide/local-counters.mdx)
- [Introduction guide](../../src/content/guide/introduction.mdx)
- [Tally Super data guide](../../src/content/guide/tally-super-data.mdx)
