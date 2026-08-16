# Counter Copy Sharing

## Purpose

Counter copy sharing lets one signed-in user transfer a snapshot of a personal counter to another signed-in user without granting access to the source counter or creating a continuing shared relationship. It is the account-to-account choice for users who want separate ownership and independent future changes rather than live collaboration.

## User Outcomes

- A sender can address an existing recipient by username or email and choose whether to offer the counter's linked script and per-counter Tally Super customization.
- A recipient can decline the request or accept the counter while independently choosing the offered linked data and Local Counter status.
- Both parties can distinguish a transferred copy from a live group counter.
- The sender receives a terminal accepted, declined, or receiving-disabled outcome but cannot observe the recipient's later counter use.
- Users can independently control incoming copies, sender-name disclosure, group invitations, and protection of outgoing sends.

## Scope

- Account-to-account transfer of a snapshot of one personal counter.
- Recipient lookup by username or email identity.
- Optional transfer of the source counter's linked script and per-counter Tally Super customization.
- Recipient acceptance, optional-data selection, Local Counter selection, and decline.
- Sender-visible request outcomes and acknowledgement.
- Incoming-copy, sender-anonymization, and outgoing-PIN privacy controls.

## Out of Scope

- Live synchronization between the source and accepted counter.
- Access to the sender's personal workspace, folders, tags, account, activity, or later counter changes.
- Group-owned counters, group invitations, and group membership.
- Counter Backup files, embeds, or public links.
- Transfer to a person without an account.
- Automatic execution of a transferred script.

## Domain and Data Boundaries

### Counter Copy

A Counter Copy is a point-in-time snapshot offered by one account to another. Its core projection contains only the source counter's normalized name, current value, starting value, positive and negative steps, optional minimum and maximum, goals, goal direction, and color. It contains only the linked script and per-counter customization that the sender elects to offer and the recipient elects to accept.

The projection excludes the source stable identity, folder, tags, Local Counter designation, Activity History, undo/redo state, statistics, Trash state, account and synchronization metadata, sharing records, and workspace customization. The recipient chooses the destination Local Counter status; the source designation is neither disclosed nor inherited.

The source remains a personal counter owned by the sender. A pending or completed request does not grant the recipient read or write access to that source.

### Independent Accepted Counter

Acceptance creates a new personal counter owned by the recipient with a new stable identity. The accepted counter has no synchronization, identity, permission, activity, Trash, or lifecycle relationship with the source or request.

After acceptance:

- Sender changes do not affect the recipient's counter.
- Recipient changes do not affect the sender's counter.
- Deleting either counter does not delete or alter the other.
- The sender cannot inspect the recipient's value changes, script activity, organization, Local Counter choice, Trash state, or deletion state.
- The recipient manages the new counter under ordinary personal-counter rules.
- If the recipient chooses Local Counter, the complete accepted counter bundle remains on that device and is excluded from personal cloud synchronization.

### Sharing Records

A sharing request records only the information needed to deliver the offer, present the sender according to the sender's privacy choice, preserve the offered snapshot and options, record a terminal outcome, and notify the sender. Sharing records are not part of All Tally Data backups and do not become personal counter activity.

## Detailed Behavior

### Eligibility and Addressing

1. The sender must be signed in and must own the personal counter being copied.
2. The recipient must be an existing account resolved from the entered username or email identity.
3. A sender cannot address the sender's own account.
4. A nonexistent or self recipient is rejected before a request is created.
5. Incoming-copy preference affects receiving only. Disabling incoming copies does not prevent the user from sending copies.

### Creating an Offer

The sender explicitly chooses whether to offer each linked-data category:

- linked script;
- per-counter Tally Super customization.

The two choices are independent. Data that is not offered must not be included in the request or exposed to the recipient.

If the sender has enabled an outgoing sending PIN, the sender must provide the configured six-digit PIN before a request can be sent. The PIN protects sending only; it is never requested from the recipient and is not transferred with the request.

Creating a request captures the offered snapshot. Changes to the source after submission do not alter the pending offer.

### Sender Identity Presentation

When sender anonymization is off, the incoming prompt identifies the sender by the sender's current username. When sender anonymization is on, the recipient sees `A Tally user` instead of the sender's username on copy-sharing messages. The prompt does not disclose the sender's email address. Anonymization does not weaken account ownership checks or make the request unauthenticated.

### Request States and Transitions

A request has these user-observable states:

- `Pending`: delivered and awaiting the recipient's decision.
- `Accepted`: the recipient created an independent personal counter.
- `Declined`: the recipient explicitly rejected the offer.
- `Receiving disabled`: delivery was refused because the addressed account does not accept incoming copies.

Allowed transitions are:

- submission to `Pending` when the recipient accepts incoming copies;
- submission directly to `Receiving disabled` when the recipient has disabled incoming copies;
- `Pending` to `Accepted` after one successful acceptance;
- `Pending` to `Declined` after one successful decline.

Terminal states do not return to `Pending`. Repeated delivery or repeated handling of the same recipient decision must not create additional counters or change the terminal outcome. The sender can acknowledge a terminal result, which clears that completed request from the sender's outstanding outcomes without affecting either counter.

### Recipient Acceptance

For an offered script and an offered customization, the recipient receives separate include-or-omit choices. An option that was not offered is not shown as available and cannot be accepted.

The recipient also explicitly chooses whether the new counter is a Local Counter. A successful acceptance atomically creates one new personal counter with:

- a new identity;
- the captured core counter state;
- the script only if both offered and accepted;
- the per-counter customization only if both offered and accepted;
- the selected Local Counter status.

Any accepted script is saved in the stopped state and requires an explicit recipient action to run. Counter values and settings are normalized under ordinary personal-counter rules before the accepted counter becomes usable.

### Decline and Receiving Disabled

Declining creates no counter and imports no linked data. Receiving-disabled delivery creates no pending recipient prompt and no counter. These outcomes are distinct so the sender can tell a user decision from the recipient's standing privacy preference.

## Validation and Normalization

- Trim surrounding whitespace from a submitted username or email before lookup; an empty result is invalid.
- Resolve the address to exactly one account before creating a request.
- Reject a self recipient and an unresolved recipient without transferring snapshot data.
- Validate the offered counter snapshot and every accepted optional section before creating recipient data.
- Normalize counter names, numeric values, steps, limits, goals, colors, and customization data according to their owning feature rules.
- Invalid numeric data must not produce non-finite values. Limits clamp current and starting values, and reversed limits normalize into ascending order.
- Unknown or malformed optional linked data must not be interpreted as another script language or silently substituted with unrelated customization.
- A sending PIN is exactly six digits when enabled. PIN validation must not expose the configured PIN.

## Failure and Recovery

- Authentication, recipient lookup, submission, loading, acceptance, and decline failures produce an action-specific visible error and a safe next action.
- A failed send creates no recipient counter and must not be presented as delivered.
- A failed acceptance creates no partial counter bundle. The request remains available for retry unless a verified terminal outcome already exists.
- If completion is uncertain after a network interruption, refreshing the request state determines whether acceptance occurred; retrying the same acceptance must not create another counter.
- A malformed request or snapshot cannot be accepted. It remains isolated from personal data and produces an actionable error.
- Failure of copy sharing does not disable or alter local personal counting.
- No message may promise zero data loss during browser or network failure.

## Integrations and Dependencies

- Accounts and authentication establish sender and recipient identity.
- Personal counter rules define the copied core state and normalization.
- Local Counter rules define the recipient's device-only choice and cloud exclusion.
- TallyScript, JavaScript, and Tally Super define optional linked data and validation.
- Personal synchronization applies to an accepted non-local counter only after acceptance; it never links that counter to the sender.
- Sharing preferences provide incoming-copy, sender-anonymization, and outgoing-PIN controls independently from group-invitation preferences.

## Privacy and Security

- Every read and mutation of a sharing request is restricted to its sender or recipient as appropriate.
- Source-counter ownership is verified when the snapshot is offered.
- Accepting a request grants ownership only of the newly created counter, never access to the source account or workspace.
- The sending PIN must be stored and compared as a private authentication secret. It must not appear in public profile data, recipient payloads, browser-readable public data, logs intended for users, or analytics.
- Sender anonymization suppresses the username in recipient-facing copy messages. Analytics must not defeat that choice.
- Analytics must not include recipient addresses, usernames, account data, counter names or values, scripts, customization payloads, request payloads, or PIN data.
- Imported scripts are untrusted recipient-owned data, remain stopped, and retain normal runtime isolation and resource limits.

## Accessibility and Responsive Behavior

- Sending, privacy preferences, incoming prompts, optional-data choices, Local Counter selection, outcomes, and errors work from 320 CSS pixels wide through desktop widths.
- All flows work in the current and previous major releases of Chrome, Edge, Firefox, and Safari, plus current Chrome on Android and Safari on iOS.
- Light and dark themes retain legible contrast and complete controls.
- Every control has an understandable name and keyboard operation.
- Dialog focus is contained while open and returns to the invoking control when closed.
- Request status, errors, selected options, and terminal outcomes are conveyed textually or semantically and never by color alone.
- Status changes are perceivable without requiring the user to discover a visual-only update.
- Nonessential motion respects reduced-motion and product animation preferences.

## Acceptance Scenarios

1. **Independent accepted copy**
   - Given two signed-in users and a sender-owned personal counter
   - When the recipient accepts the offered copy
   - Then exactly one new recipient-owned personal counter with a new identity is created, and later changes on either side do not affect the other

2. **Independent optional-data choices**
   - Given a sender offers both a linked script and per-counter customization
   - When the recipient accepts the counter, omits the script, and accepts the customization
   - Then the new counter contains the customization, contains no linked script, and remains independent of the source

3. **Stopped imported script**
   - Given a valid linked script is offered and accepted
   - When acceptance completes
   - Then the script is stored with its recorded language, is stopped, and does not run until the recipient explicitly starts it

4. **Local accepted copy**
   - Given the recipient chooses Local Counter during acceptance
   - When the copy is created
   - Then the complete new counter bundle remains on that device and is excluded from personal cloud payloads

5. **Declined request**
   - Given a pending copy request
   - When the recipient declines it
   - Then no recipient counter is created and the sender receives a declined outcome

6. **Incoming copies disabled**
   - Given a recipient has disabled incoming copies
   - When another user sends to that recipient
   - Then no pending prompt or counter is created, the sender receives a receiving-disabled outcome, and both users can still send permitted outgoing copies

7. **Anonymized sender**
   - Given the sender enabled sender anonymization
   - When the recipient views an incoming copy prompt
   - Then the prompt identifies the sender as `A Tally user` and does not expose the sender's username

8. **Named sender**
   - Given the sender disabled sender anonymization
   - When the recipient views an incoming copy prompt
   - Then the prompt identifies the sender by current username and does not disclose the sender's email address

9. **Protected outgoing send**
   - Given the sender enabled a six-digit sending PIN
   - When the sender supplies an incorrect PIN
   - Then no request is created, a visible error is shown, and neither the configured PIN nor entered PIN is exposed

10. **Invalid recipient**
   - Given the sender enters the sender's own identity or an identity that does not resolve
   - When the send is submitted
   - Then the request is rejected before snapshot delivery and no sharing record is presented as pending

11. **Acceptance retry after interruption**
    - Given a recipient submitted acceptance and the connection failed before confirmation
    - When the recipient refreshes and retries the same decision
    - Then the confirmed terminal state is recovered and no more than one recipient counter exists

12. **Malformed offered data**
    - Given a request contains malformed required counter data
    - When the recipient attempts acceptance
    - Then no partial counter bundle is created, the recipient sees an actionable error, and existing personal counters remain usable

13. **Responsive and accessible sharing**
    - Given a keyboard user at 320 CSS pixels in either theme on a supported browser
    - When the user sends or responds to a copy request
    - Then every option, status, error, and completion action remains reachable, named, visible, and understandable without color alone

14. **Analytics privacy**
    - Given copy-sharing analytics are emitted
    - When send, accept, decline, disabled, or failure events occur
    - Then the events contain no counter content, script, account identity, recipient address, sharing secret, or request payload

## Sources

- PRD: [Product Summary](../product-specification.md#product-summary)
- PRD: [Explicit Data Ownership](../product-specification.md#explicit-data-ownership)
- PRD: [Counter Copy](../product-specification.md#counter-copy)
- PRD: [Counter Copy Sharing Requirements](../product-specification.md#counter-copy-sharing-requirements)
- PRD: [Synchronization Boundary](../product-specification.md#synchronization-boundary)
- PRD: [Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- PRD: [Responsive Web Experience](../product-specification.md#responsive-web-experience)
- PRD: [Accessibility](../product-specification.md#accessibility)
- PRD: [Data and Security](../product-specification.md#data-and-security)
- PRD: [Product Acceptance Criteria](../product-specification.md#product-acceptance-criteria)
- Guide: [Copy sharing](../../src/content/guide/copy-sharing.mdx)
- Guide: [Sharing choices](../../src/content/guide/sharing.mdx)
- Guide: [Sharing privacy](../../src/content/guide/sharing-privacy.mdx)
- Guide: [Local counters](../../src/content/guide/local-counters.mdx)
- Guide: [Accounts](../../src/content/guide/accounts.mdx)
- Guide: [Scripting](../../src/content/guide/scripting.mdx)
