# Workspace Premium Redesign — Design Spec

Date: 2026-10-02 | Status: approved by user | Scope: AI workspace only (all tools)

## Goal

Make the AI workspace (research desk and every other tool desk) feel premium in the
"diplomatic prestige" direction: deep ink + oxblood + brass on warm paper, serif
display type, embassy-briefing-room character. Light theme only — no dark mode
(dark mode was removed from the app and stays removed).

## Leverage point

`components/tool-workspace.tsx` renders the empty state, composer, message list,
and desk header for EVERY tool from shared code (`title`/`description` props vary
per tool). All changes land there (plus tokens in `app/globals.css`), so one
implementation pass upgrades every desk consistently. No per-tool work.

## Components

### 1. Design tokens (`app/globals.css`, light only)

- Keep warm-paper base; add prestige surfaces: deep-ink composer background,
  brass hairline dividers, oxblood reserved for primary actions.
- Reuse existing `diplomatic-grid` backdrop; add a soft radial seal watermark
  utility for empty states.
- One step up in serif display size for desk titles.
- No new dependencies. No `dark:` variants, no `data-theme` hooks.

### 2. Empty state — "the briefing room" (`tool-workspace.tsx`)

- Centered `max-w-xl` composition replacing the generic bot circle:
  - brass eyebrow line reusing the desk's existing label (e.g. "Research desk"),
  - large serif title (existing `title` prop),
  - Muni (`AuthAvatar`, existing component) with a one-line greeting that
    varies per tool via a new `greeting`/`starters` prop with sensible defaults,
  - 3 starter-brief chips per tool; clicking a chip fills the composer input
    (sets input state, focuses the textarea — does NOT auto-submit).
- Large faint watermark behind the composition: the existing `Landmark`
  lucide icon scaled up at low opacity over a radial wash (no new assets).
- Reduced-motion: static layout, no entrance animation.

### 3. Composer — "the dispatch box" (`tool-workspace.tsx`)

- Elevated card (stronger shadow), sticky and always visible (unchanged position).
- Mode selector restyled as a segmented brass-accent control (same
  quick/thorough/max behavior and rate-limit semantics — presentation only).
- Send button becomes a solid ink circle; character count + `Enter ↵ to send`
  hint appear on textarea focus.
- No changes to submit handling, validation, or API payloads.

### 4. Messages and desk headers (`tool-workspace.tsx`)

- User turns: ink-filled, right-aligned bubbles.
- AI turns: paper cards with patina avatar seal and thin brass top-rule;
  streaming cursor restyled as a brass block.
- Desk headers adopt the eyebrow + title lockup with hairline rule.
- Markdown rendering (`Streamdown`), link-safety checks, and status text are
  untouched.

### 5. Motion

- Empty state fades/slides in once; starter chips stagger ~60ms.
- Send button lifts on hover; existing transitions kept.
- All animation honors `prefers-reduced-motion` (existing guards + new CSS
  wrapped in the same media query pattern already in `globals.css`).

## Data flow

Unchanged. Starter chips write to the existing composer input state only.
No new state, routes, API calls, or props leave the workspace component
(except the optional per-tool `greeting`/`starters` config, defaulted).

## Error handling

Unchanged. Loading, error, and chat-load-failure states keep current behavior;
only their presentation tokens change where shared classes apply.

## Testing

- `pnpm lint` on touched files (must stay error-free; warnings tolerated only
  if pre-existing).
- `pnpm typecheck` clean.
- `pnpm build` succeeds (Vercel builds on push).
- Manual pass on desktop + one phone width: empty state, chip-to-composer,
  streaming response, reduced-motion rendering.

## Out of scope

- Sidebar, top bars, and non-workspace pages (explicitly deferred).
- Dark mode (removed; stays removed).
- New AI capabilities, models, rate limits, or API contracts.
