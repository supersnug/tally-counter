# Snapshot Embeds

## Purpose

Define public, independently interactive counter snapshots for iframe publication. A snapshot is an immutable projection of allowed counter fields at publication time, grants no source access, stores no visitor changes, and is never described or treated as live synchronization.

## User Outcomes

- A user can create an embed from a personal or group counter the user can view.
- A publisher can choose size, theme, reset, counter details, and attribution before generating iframe markup.
- A visitor can interact with the embedded counter within its encoded limits without changing the source.
- A publisher can understand that later source changes require a newly generated snapshot.
- Viewers never receive scripts, customization source, organization, ownership, account, group, permission, synchronization, or browser-storage data.
- Invalid or missing snapshot data produces a clear, contained error rather than a broken or misleading counter.

## Scope

- Snapshot eligibility for visible personal and group counters, including retained personal counters.
- The strict public projection and its field-level allowlist.
- Builder options, live preview, encoded payload, iframe publication, and immutable publication semantics.
- Independent in-frame interaction, reset, details, goals, progress, and hard limits.
- Validation, normalization, malformed data, unsupported versions, and recovery.
- Public privacy boundaries, iframe containment, accessibility, themes, and responsive sizing.

## Out of Scope

- Live synchronized public counters or subscriptions to source changes.
- Persisting visitor interactions locally or remotely.
- Updating personal synchronization, group storage, Activity History, statistics, or group activity from an embed.
- Granting source workspace, group, counter, account, or browser-storage access.
- Publishing scripts, Tally Super source, folders, tags, ownership, membership, permissions, or Local Counter status.
- Editing encoded data by hand as a supported publishing workflow.
- Server-hosted automation, collaborative public counting, analytics containing snapshot counter content, or high-stakes suitability guarantees.

## Domain and Data Boundaries

### Embedded Counter

An Embedded Counter is an independently interactive snapshot encoded for display outside the workspace. It is derived once from a source counter and has no ongoing relationship to that source after generation.

The source may be:

- an active personal counter the publisher can view;
- a retained personal counter still available in Trash; or
- a group counter visible to the publishing member.

Snapshot creation reads the source only for the one-time projection. It does not change source ownership, visibility, value, activity, synchronization eligibility, Trash state, group state, or permissions.

### Strict Public Snapshot Projection

The public payload is an allowlist, not a serialized Counter Bundle or group record. It may contain exactly these semantic fields:

| Area | Allowed fields |
| --- | --- |
| Envelope | Snapshot format identifier and supported format version |
| Counter display | Normalized display name, current value, starting value, supported color |
| Counting rules | Positive step magnitude, negative step magnitude, optional minimum, optional maximum |
| Goal presentation | Unique numeric goals and goal direction |
| Embed options | Standard or Compact size; Light, Dark, or Device-Matched theme; show Reset; show Counter Details; show Tally attribution |

No source stable identity, account identity, group identity, publication owner, storage locator, access token, or live endpoint is part of the projection. Any data not explicitly listed is private to the source boundary and must not be serialized, retained, rendered, announced, logged as counter content, or made available to the embed document.

### Explicitly Excluded Data

The strict allowlist excludes, among other unlisted fields:

- TallyScript or JavaScript source, recorded language, runtime state, errors, and invocation data;
- per-counter and workspace Tally Super customization source or transforms;
- folder paths, folder identities, tags, search metadata, and workspace placement;
- personal counter stable identity and Local Counter designation;
- Trash state, deletion time, retention deadline, and restoration information;
- account identity, email, username, authentication state, credentials, tokens, and sharing secrets;
- group identity, name, ownership, membership, invitations, permissions, activity, and operation identities;
- Activity History, undo/redo, session statistics, statistic baselines, and group activity;
- synchronization state, cloud eligibility, conflict data, browser-storage keys, and backup or copy records; and
- source creation, update, publication, or access timestamps unless a future public format explicitly adds one under a revised supported version.

### Detail Panel Boundary

Counter Details may display exactly four counter rule values: positive step, negative step, minimum, and maximum. It must not reveal goals, source metadata, ownership, organization, scripts, customization, account state, group state, permissions, activity, or storage information as details.

Goals and direction may be used by the ordinary embedded counter presentation to communicate progress. Their inclusion in the display projection does not expand the Counter Details panel beyond the four allowed rule values.

### Runtime Interaction Boundary

Each loaded iframe creates one ephemeral runtime instance initialized from the encoded snapshot. Runtime value changes exist only in that iframe document's memory. Separate frames, tabs, browsers, and visitors do not share interaction state. Reloading or reopening initializes again from the encoded current and starting values.

The iframe does not write interaction state to the source, personal cloud storage, group storage, browser persistent storage, backup data, Activity History, statistics, or any publication record.

## Detailed Behavior

### Eligibility and Authorization

- An account is not required to publish a personal counter snapshot.
- A personal counter is eligible while the user can view it, including during Trash retention.
- A group counter is eligible while the signed-in member can view it.
- Snapshot creation requires view access only; it grants no view or mutation access to the source after generation.
- Loss of source access or later source deletion does not revoke an already generated standalone snapshot because the snapshot contains no source access relationship.
- Snapshot creation from malformed source data is rejected rather than publishing private or invalid fields.

### Builder State and Preview

The builder derives a candidate public projection from the source and exposes these independent options:

- Standard or Compact size;
- Light, Dark, or Device-Matched theme;
- Reset shown or hidden;
- Counter Details shown or hidden; and
- Tally attribution shown or hidden.

Every option change updates the candidate preview and generated iframe syntax and reinitializes preview value from the candidate snapshot. Preview interactions are ephemeral demonstrations: they do not modify the candidate payload, generated markup, source, or the next preview initialization. Closing and reopening the builder also reinitializes the preview. The generated standalone embed is independently interactive.

The builder must distinguish source data from projected public data and provide a clear statement that generation creates a non-live snapshot. Copying iframe markup does not mutate or publish back to the source.

### Projection and Generation

1. The publisher opens the builder from an eligible visible counter.
2. Tally reads and normalizes only fields required by the public allowlist.
3. Tally constructs a versioned candidate payload containing no unlisted source fields.
4. The publisher selects embed options and reviews the preview.
5. Tally encodes the complete candidate payload in the iframe source for the `/embed` route.
6. Generated iframe markup identifies dimensions appropriate to Standard or Compact presentation and provides an accessible iframe title.
7. Any later option or source change requires generation of a new payload and iframe snippet.

Generation is a projection operation, not a data transfer relationship, permission grant, synchronization subscription, or persistent publication update.

### Publication Semantics

- The encoded payload is immutable publication input for that iframe URL.
- Later changes to source value, start, steps, limits, goals, direction, name, color, script, customization, ownership, or permissions do not update the existing payload.
- Visitor interactions do not update the payload or source.
- Generating a new snapshot does not alter or revoke an older snapshot.
- A publisher replaces an embed by generating and installing new iframe markup at the destination site.
- Tally must describe the result as a snapshot, independent embed, or independently interactive counter, never as live, synchronized, shared-state, or collaborative publishing.
- Availability of an iframe URL is not evidence that its source counter or owner still exists.

### Embedded Display

The embed displays the projected counter name, current value, color, applicable controls, and ordinary progress meaning. Standard and Compact alter presentation density and dimensions, not counter rules or privacy boundaries.

The embed must remain understandable when:

- values or goals are negative;
- direction is Less Than;
- only one hard limit exists;
- both hard limits exist;
- no goals exist;
- the final goal is complete; or
- Reset and Counter Details are hidden.

### Theme Behavior

- Light always uses the embed's light presentation.
- Dark always uses the embed's dark presentation.
- Device-Matched follows the iframe visitor's preferred color scheme, not the publisher's current Tally theme or the host page's stored Tally preference.
- Theme changes affect presentation only and do not alter encoded or runtime counter state.
- Every theme retains legible contrast, visible focus, and complete enabled controls.

### Interaction and Limits

- Add uses the encoded positive step magnitude.
- Subtract uses the encoded negative step magnitude.
- Every resulting value clamps to encoded minimum and maximum when present.
- Reaching a limit disables movement farther past that limit while preserving movement away from it.
- Goals mark progress and completion but never stop movement; only limits stop movement.
- An action blocked by a hard limit leaves runtime value unchanged.
- Runtime interaction never changes encoded start, steps, limits, goals, direction, name, color, or options.
- No interaction is persisted across reload, navigation, or another iframe instance.

### Reset Option

When Reset is shown, activating it returns the ephemeral runtime value to the encoded starting value after limit normalization. When Reset is hidden, no reset control is exposed. Hiding Reset does not remove the encoded starting value needed to initialize and validate the snapshot.

Reset affects only the current iframe instance. It creates no personal Activity History, session statistic, group operation, group activity, synchronization write, or source change.

### Counter Details Option

When Counter Details is shown, the embed exposes only:

- positive step;
- negative step;
- minimum, when present; and
- maximum, when present.

Absent minimum or maximum is communicated as absent or omitted without inventing a value. When Counter Details is hidden, none of these values appears in a details surface, although step and limit behavior remains enforced.

### Attribution Option

Tally attribution may be shown or hidden independently of size, theme, Reset, and Counter Details. Hiding attribution changes presentation only and does not change interaction, limits, privacy, ownership, or snapshot semantics.

### Host Page and Iframe Boundary

- The generated snippet targets Tally's `/embed` route and is intended for hosts that permit iframes.
- The host page must allocate dimensions suitable for the selected size.
- Compact is the supported choice for constrained space; browser zoom is not a substitute for a fitting layout.
- Host restrictions that block iframes are external publication failures and do not change snapshot semantics.
- Manual payload editing is unsupported; publishers return to the builder and generate a new snippet.
- The embed remains contained and does not assume access to host-page DOM, storage, identity, or scripts.

## Validation and Normalization

- The payload must use a recognized snapshot format and supported version.
- Every required envelope, counter display, counting rule, goal, and option field must have the expected type.
- Current value, starting value, steps, limits, and goals must be finite numbers.
- Positive and negative steps normalize to positive magnitudes; zero normalizes to `1`.
- Reversed minimum and maximum normalize into ascending order.
- Current and starting values clamp to the normalized limits.
- Goals normalize to unique numeric values and are interpreted in the encoded More Than or Less Than direction.
- Goal direction must be one of the two supported values.
- A blank display name normalizes to the untitled label.
- Color must use the supported public counter color representation.
- Size, theme, and each boolean option must be supported values; unknown values are not guessed.
- Projection serialization includes only allowlisted fields. Decoding discards unlisted fields before any rendering, logging, or runtime use.
- Missing required data, unsupported versions, invalid required types, non-finite values, or an unusable payload produce the error state rather than a partially trusted counter.
- The decoded normalized object is a new public snapshot object and never a source Counter Bundle or group record with fields merely hidden from view.

## Failure and Recovery

- Missing, malformed, truncated, or undecodable payload data produces a clear embed error state.
- An unsupported format version identifies that the snapshot cannot be displayed and does not guess at newer semantics.
- Invalid required fields prevent counter interaction; no partial payload is represented as a valid source snapshot.
- Unlisted fields are discarded and never surfaced, even when a payload was manually modified.
- A builder projection failure leaves the source unchanged and reports that no valid snippet was generated.
- Clipboard failure leaves generated markup available for deliberate retry and does not claim it was copied.
- A host that blocks iframes may prevent display; the embed guidance identifies host support and sizing as external requirements.
- Reloading a valid embed recovers by reconstructing the normalized initial snapshot, not by recovering prior visitor interaction.
- Source deletion, account loss, group removal, synchronization failure, or offline source storage does not corrupt an already self-contained valid payload.
- An embed failure is contained to the embed and must not disable unrelated local personal counting.
- Tally does not claim permanent URL availability, zero data loss, or suitability for unvalidated high-stakes publication.

## Integrations and Dependencies

- Core counter rules define current and starting values, independent steps, hard limits, directional goals, progress, completion, name, and color.
- Counter Bundle and Trash rules determine whether a personal source is currently visible and eligible for one-time projection.
- Group membership and permissions determine whether a group source is visible at generation time.
- Personal synchronization and group realtime systems are deliberately absent from embed runtime behavior.
- Tally Super does not supply customization source to the projection.
- Script runtime state and source are excluded and cannot execute in the embed.
- The browser iframe, URL, preferred-color-scheme, and host-page sizing capabilities provide the publication surface.

## Privacy and Security

- The encoded snapshot is public data. Publishers must be told that anyone with the iframe URL can inspect its allowlisted counter content.
- Publishers should avoid public counter names, values, goals, or limits that reveal private or sensitive information.
- The public serializer and decoder enforce the strict allowlist; private source fields are not protected merely by hiding interface elements.
- Snapshot creation grants no source access token, account access, group membership, permission, or synchronization capability.
- Embed analytics must not include counter name, value, start, steps, limits, goals, color, payload, source URL query content, account data, group data, or visitor interactions tied to counter content.
- The embed receives no authentication credentials, sharing secrets, private client credentials, browser-storage keys, script source, or customization source.
- The embed does not write counter interaction state to persistent browser storage or a remote service.
- Iframe content must not access or mutate the host page outside ordinary browser iframe boundaries.
- Public snapshots are not represented as private, access-controlled, revocable, or suitable for regulated or safety-critical records.

## Accessibility and Responsive Behavior

- Generated iframe markup includes an understandable title that does not require exposing private source metadata.
- Add, subtract, optional Reset, details disclosure, and interactive attribution content have understandable names and keyboard operation.
- Current value, progress, completion, minimum, maximum, disabled-at-limit state, and errors have textual or semantic meaning in addition to visual styling.
- Limit and error states do not rely on color alone.
- Focus remains visible in Light, Dark, and Device-Matched themes.
- Standard and Compact layouts retain complete enabled controls within their declared dimensions and adapt without clipping required content.
- Embedded content remains usable at 320 CSS pixels where the host allocates that width; publishers are guided to Compact for narrower placements.
- Device-Matched theme responds to the visitor's preference without unexpected state reset.
- Optional animation and value transitions respect reduced-motion and product animation preferences where applicable.
- Error states are announced to assistive technology and provide a concise explanation without exposing rejected payload data.

## Acceptance Scenarios

1. **Given** a user can view a personal counter, **When** the user generates a snapshot, **Then** the payload contains only the allowlisted envelope, display, rule, goal, and option fields and grants no source access.
2. **Given** a member can view a group counter, **When** the member generates an embed, **Then** no group identity, membership, permission, activity, operation, or account data enters the payload.
3. **Given** a retained personal counter is still visible in Trash, **When** a snapshot is generated and the source later expires, **Then** the valid snapshot remains independent and cannot access the deleted bundle.
4. **Given** source data includes a script, Tally Super transforms, folders, tags, Local Counter status, history, and synchronization metadata, **When** projection occurs, **Then** every such field is absent from the public snapshot object and encoded payload.
5. **Given** the publisher selects Compact, Device-Matched theme, hidden Reset, shown Counter Details, and hidden attribution, **When** markup is generated, **Then** those independent options are encoded without changing source data.
6. **Given** an existing embed and later changes to the source name, value, limits, goals, or color, **When** the existing iframe loads again, **Then** it uses its original encoded snapshot until the publisher installs newly generated markup.
7. **Given** two visitors open the same embed URL, **When** each changes the count, **Then** each iframe has independent ephemeral state and neither visitor nor the source receives the other's changes.
8. **Given** a visitor changes an embedded value and reloads, **When** the iframe initializes again, **Then** it returns to the encoded current value rather than the visitor's prior value.
9. **Given** an encoded maximum of 10 and current value of 9, **When** Add would exceed the maximum, **Then** runtime value clamps to 10 and further upward movement is disabled while subtraction remains available.
10. **Given** the final goal is reached without a maximum, **When** the visitor adds again, **Then** progress remains complete and counting continues because a goal is not a hard limit.
11. **Given** Reset is shown and runtime value differs from the encoded start, **When** Reset is activated, **Then** only that iframe returns to the normalized encoded start and no history, statistic, group activity, or source write occurs.
12. **Given** Counter Details is shown, **When** the visitor opens it, **Then** only positive step, negative step, present minimum, and present maximum are displayed as details.
13. **Given** a payload includes manually added account, script, or permission fields, **When** it is decoded, **Then** those unlisted fields are discarded before rendering or runtime use and cannot expand embed authority.
14. **Given** a payload contains reversed limits and out-of-range finite current and starting values, **When** normalization succeeds, **Then** limits are ordered and both values are clamped before interaction begins.
15. **Given** a payload contains a non-finite value or misses a required field, **When** it loads, **Then** a clear non-interactive error state appears instead of a partially trusted counter.
16. **Given** a payload has an unsupported format version, **When** the route loads, **Then** it reports an unsupported snapshot and does not infer or silently downgrade semantics.
17. **Given** Device-Matched theme is selected and the visitor's preferred color scheme changes, **When** the embed responds, **Then** presentation changes without altering runtime value or encoded state.
18. **Given** a keyboard user opens a Compact embed at 320 CSS pixels, **When** the user counts, opens details, reaches a limit, and resets where enabled, **Then** every enabled control and state remains reachable, named, visible, and understandable without color alone.
19. **Given** clipboard access fails in the builder, **When** the publisher selects Copy, **Then** the source remains unchanged, failure is visible, and the generated markup remains available for retry.
20. **Given** a destination platform blocks arbitrary iframes, **When** the publisher installs the snippet, **Then** the failure is described as a host restriction and does not imply source or snapshot synchronization failure.
21. **Given** the publisher changes the interactive preview value, **When** an embed option changes or the builder is reopened, **Then** the preview returns to the candidate snapshot value and the generated payload never contains the preview-only interaction.

## Sources

- [PRD: Explicit Data Ownership](../product-specification.md#explicit-data-ownership)
- [PRD: Embedded Counter](../product-specification.md#embedded-counter)
- [PRD: Trash](../product-specification.md#trash)
- [PRD: Embed Requirements](../product-specification.md#embed-requirements)
- [PRD: Account Lifecycle](../product-specification.md#account-lifecycle)
- [PRD: Shared Workspace](../product-specification.md#shared-workspace)
- [PRD: Failure and Safety Requirements](../product-specification.md#failure-and-safety-requirements)
- [PRD: Responsive Web Experience](../product-specification.md#responsive-web-experience)
- [PRD: Accessibility](../product-specification.md#accessibility)
- [PRD: Data and Security](../product-specification.md#data-and-security)
- [Guide: Embeds](../../src/content/guide/embeds.mdx)
- [Guide: Embed customization](../../src/content/guide/embed-customize.mdx)
- [Guide: Embed publication](../../src/content/guide/embed-publish.mdx)
- [Guide: Embed tutorial](../../src/content/guide/tutorial-embeds.mdx)
- [Guide: Counters](../../src/content/guide/counters.mdx)
- [Guide: Counter values](../../src/content/guide/counter-values.mdx)
- [Guide: Counter goals](../../src/content/guide/counter-goals.mdx)
- [Guide: Counter limits](../../src/content/guide/counter-limits.mdx)
- [Guide: Trash](../../src/content/guide/trash.mdx)
- [Guide: Group sharing](../../src/content/guide/group-sharing.mdx)
