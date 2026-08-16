# Repository Guidelines

## Project Structure & Module Organization

Tally is a Vite-powered React single-page application. `src/App.tsx` selects route screens from `src/pages/`, while global providers live in `src/app/`. Product capabilities are separated under `src/features/`, including `auth`, `counters`, `scripting`, and `tally-super`; reusable, feature-neutral UI lives in `src/shared/`. Shared infrastructure such as the optional Supabase client belongs in `src/lib/`. `src/main.tsx` mounts the app with React Strict Mode and imports `src/styles.css`. Database setup is documented in `supabase.sql`, while Edge Functions and local Supabase configuration live under `supabase/`. Vercel SPA routing is configured in `vercel.json`. Production output is generated in `dist/` and must not be committed.

Vitest unit and component tests live in `src/__tests__/`; Playwright browser tests live in `e2e/`. Keep tests focused by feature and name them `*.test.tsx` or `*.spec.ts`.

## Build, Test, and Development Commands

- `npm install` installs the locked dependencies.
- `npm run dev` starts Vite with hot module replacement.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm run test:coverage` runs Vitest and writes coverage to `coverage/`.
- `npm run e2e` runs Playwright against a production preview.
- `npm run build` creates the optimized `dist/` deployment.
- `npm run preview` serves the latest production build locally.

Before submitting changes, run `npm run typecheck && npm run build`.

## Coding Style & Naming Conventions

Use TypeScript/TSX for React code, two-space indentation, semicolons, and double quotes. Name components in PascalCase (`CounterCard`), functions and state in camelCase (`setSuperSettings`), and constants in uppercase snake case (`TRASH_LIFETIME`). Keep event handlers descriptive and avoid placing personal counter or account data in analytics events. Prefer focused components when expanding `App.tsx`; do not add more unrelated behavior to an already large function.

Reuse the established pill-switch structure for toggles: hidden checkbox, empty `<i>` track, then label text. Never place children inside the track. Verify every new toggle retains its `32px × 18px` pill shape in light and dark modes and does not collapse into a circle inside flex layouts.

## Testing Guidelines

Use Vitest with React Testing Library for component behavior and Playwright for complete browser workflows. No minimum coverage threshold is enforced yet; add assertions for every bug fix and new behavior. Run `npm run test:coverage` and `npm run e2e` when relevant. Manually verify signed-in Supabase synchronization because CI does not use production credentials.

## Commit & Pull Request Guidelines

Use short, imperative commit subjects such as `Add Vercel Speed Insights`. Pull requests should explain behavior changes, list verification commands, link issues, and include before/after screenshots for visual work. Call out database or environment changes explicitly.

## Security & Configuration

Never commit `.env`, service-role keys, access tokens, or files from `supabase/.temp/`. Browser code may use only `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY`. Preserve RLS ownership checks when changing `user_data`, and update both cloud synchronization and backup formats when adding persisted data.

## Agent skills

### Issue tracker

Planning issues are tracked in GitHub Issues for `supersnug/tally-counter`. See `docs/agents/issue-tracker.md`.

### Planning docs

Wayfinder plans from `docs/product-specification.md`; feature plans live in `docs/features/`, research in `docs/research/`, and strictly formatted increments in `docs/increments/`.

### Domain docs

This is a single-context repository with domain context at `CONTEXT.md` and ADRs under `docs/adr/`. See `docs/agents/domain.md`.
