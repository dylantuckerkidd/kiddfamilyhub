# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Family Hub is a household management PWA with features for calendar, grocery lists, todos, meal planning, home maintenance tracking, budgeting/transactions, and weather. It deploys as a static SPA on Vercel with Supabase as the backend.

## Development Commands

```bash
npm run dev              # Start Vite dev server with hot reload
npm run build            # Build client (vue-tsc + vite)
npm run preview          # Preview production build locally
```

The project uses npm workspaces with a single `client/` workspace. Use `-w client` to target it (e.g., `npm -w client add <pkg>`).

## Architecture

### Client (Vue 3 + TypeScript)

- **Framework**: Vue 3 with Composition API, Pinia stores, Vue Router, Tailwind CSS v4
- **Entry**: `client/src/main.ts` — initializes auth store before mounting
- **Router**: `client/src/router/index.ts` — auth guard redirects unauthenticated users to `/login`, default route is `/calendar`
- **Stores** (`client/src/stores/`): Each feature has a Pinia store (calendar, grocery, todos, meals, budget, maintenance, weather, auth). Stores contain the data-fetching logic and talk directly to Supabase.
- **Supabase client**: `client/src/lib/supabase.ts` — configured via `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` env vars
- **Views** (`client/src/views/`): One view per feature, lazy-loaded via router
- **Composables** (`client/src/composables/`): `useSortable` (drag-and-drop via SortableJS), `useTheme`

### Supabase

- **Schema**: `supabase/schema.sql` — run in Supabase SQL Editor to set up tables, RLS, views, and RPCs
- **Edge Functions**: `supabase/functions/icloud-sync/` — Deno-based iCloud CalDAV sync
- **Family sharing**: RLS policies use `get_family_user_ids()` helper to scope data to the user's family group. The `family_users` junction table links auth users to families.

## Key Patterns

- **Family-aware RLS**: Supabase tables use `user_id IN (SELECT get_family_user_ids())` for row-level security, allowing family members to share data.
- **Dates are stored as TEXT strings** (YYYY-MM-DD format) in Supabase.

## Environment Variables

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase connection (client-side)
