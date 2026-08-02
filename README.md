# Tally

A local-first, open-source tally workspace for everything from a single click counter to synchronized group counters, automation, custom layouts, and embeds. An account is optional: Tally works entirely in the browser and adds Supabase sync and online sharing only when you sign in.

## How it works

Each counter stores its own name, current value, starting value, color, and counting rules. Use the plus and minus buttons to change a counter independently of every other counter.

The positive and negative buttons can have different step amounts. For example, a counter may add `5` when pressing plus and subtract `2` when pressing minus. Values can move above or below zero unless a minimum or maximum prevents them from doing so.

Personal counters are saved automatically in local storage. Optional Supabase accounts synchronize non-local counters and preferences between devices. Shared group counters live only in their group records and are not mixed into personal counter data.

## Features

- Create and manage multiple named counters
- Count with positive and negative values
- Configure separate positive and negative step amounts
- Set optional hard minimum and maximum values
- Reset a counter to its configured starting value
- Choose a preset color or any custom color
- Switch between light and dark themes
- Automatically save counters in the browser
- Optionally sign in and synchronize counters between devices
- Recover deleted counters from five-day Trash
- Export and import counters, scripts, and Tally Super JSON backups
- Send counter copies with optional linked scripts and customizations
- Collaborate on live group counters with preset or custom permissions
- Automate counters with TallyScript or sandboxed JavaScript
- Customize counter elements and workspace layouts with Tally Super

## Goals and progress

A counter can have multiple goals. Goals use one of two directions:

- **More than:** goals are completed from the lowest value to the highest value.
- **Less than:** goals are completed from the highest value to the lowest value.

For example, goals of `-20`, `-15`, and `20` are ordered differently depending on the selected direction. With **More than**, `-20` is the first goal. With **Less than**, `-20` is the final goal.

The segmented progress bar shows every milestone and fills smoothly toward the next one. Its percentage displays progress toward the next goal. Hovering over the percentage also shows progress toward the final goal and, when configured, the maximum value.

Reaching the final goal marks the counter as complete, but it does not stop counting. Only the optional minimum and maximum values act as hard limits.

## Embedding a counter

Open the embed builder from the code icon on a counter card. It provides a live preview and generates an iframe snippet for use on another website.

Embed options include:

- Compact or standard sizing
- Light, dark, or device-matched theme
- Show or hide the reset control
- Show or hide counter settings information
- Show or remove the “Powered by Tally” watermark

The counter configuration is encoded into the embed URL, so an embedded counter does not depend on the main page's local storage. The deployed origin is configured by `EMBED_ORIGIN` in `src/features/counters/model.ts`.

## Accounts, copies, and groups

Accounts add cross-device sync without replacing local persistence. Individual counters can remain local-only. Copy sharing sends an independent counter to another account; recipients can decline it or import it locally, including linked scripts and per-counter customization when supplied.

Groups contain live shared counters in normalized Supabase tables. Owners invite members and assign Full Access, Settings Only, Scripts Only, Super Only, Counting Only, or fine-grained Custom permissions. Shared counters are stored only with the group.

## Scripting and Tally Super

Scripting is built into each counter and offers two languages:

- **TallyScript** uses readable commands, conditions, variables, `repeat`, `while`, and `if` blocks. It is intended for approachable counter automation without requiring full JavaScript syntax.
- **JavaScript** supports the full language inside an isolated QuickJS WebAssembly sandbox. Execution limits protect the page from uninterrupted CPU, memory, and stack exhaustion while yielding scripts can continue in the background.

Both languages expose the same Tally API. Scripts can add or subtract, set exact and starting values, reset, jump to saved values, configure positive and negative steps, add or remove goals, change goal direction, and manage minimum or maximum limits. Cosmetic APIs can update counter names, colors, preferences, and supported Tally Super transforms. The Local Counter setting is intentionally unavailable to scripts.

Example TallyScript:

```text
set positive step to 2

repeat 3 times
  add
end

if count is at least 6
  add goal 10
end
```

Example JavaScript:

```js
for (let i = 0; i < 3; i++) {
  Tally.value.add();
}

Tally.goals.add(10);
```

Scripts are stored per counter, synchronize separately through Supabase, and can be included selectively in backups and counter-copy shares. Running scripts stop when the page closes or reloads; Tally waits for pending cloud synchronization before completing that navigation when necessary.

Tally Super provides transform controls for counter elements and workspace UI, including position, independent scaling, dimensions, and rotation. Its per-counter customizations are stored separately from core counter data and can be included selectively in backups and shares.

## Development

Install dependencies and start the local development server:

```bash
npm install
npm run dev
```

Create a production build with:

```bash
npm run build
```

The production files are generated in `dist`. Vercel SPA rewrites are configured in `vercel.json` so `/counters`, `/embed`, and other client routes load directly.

## Supabase setup

1. Create a Supabase project.
2. Link the Supabase CLI and apply the migrations in `supabase/migrations/` with `npx supabase db push --linked`. `supabase.sql` remains a reference for the original schema.
3. In Authentication settings, keep the Email provider enabled and configure the site URL and allowed redirect URLs for both the deployed `/counters` page and local development.
4. Copy `.env.example` to `.env` and enter the project's URL and publishable key.
5. Restart the Vite development server.

Deploy the authenticated account-deletion Edge Function:

```bash
supabase functions deploy delete-account --no-verify-jwt
supabase functions deploy username-login --no-verify-jwt
```

The function performs its own server-side JWT validation before using the service role to delete the calling user. Supabase provides `SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` to deployed Edge Functions automatically; do not add the service-role key to the frontend `.env` file.

The browser must only receive the Supabase publishable key. Never add a service-role or secret key to a `VITE_` environment variable.

## Disclaimer

The code in this project was generated with artificial intelligence. See [DISCLAIMER.md](DISCLAIMER.md) for details.
