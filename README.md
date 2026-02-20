# Kidd Family Hub

A family management PWA for organizing calendars, grocery lists, todos, meal plans, home maintenance, and budgets — all in one place.

## Features

- **Family Calendar** — Shared events with multi-day, recurring, and birthday support. iCloud CalDAV sync. Holidays auto-seeded.
- **Grocery Lists** — Add items with autocomplete from 100+ pre-seeded common items. Auto-categorized by aisle.
- **Todo Lists** — Categorized tasks with subtasks, drag-and-drop reordering, and family member assignment.
- **Meal Planning** — Weekly meal planner with a recipe book. Add recipe ingredients to your grocery list in one tap.
- **Home Maintenance** — Track recurring maintenance tasks (HVAC, plumbing, vehicles, etc.) with completion history and cost tracking.
- **Budget & Transactions** — Income/expense tracking with category budgets and Plaid bank integration.
- **Weather** — Current conditions and forecast on the calendar page.
- **Family Sharing** — Invite family members to share all data via invite codes.
- **Dark Mode** — System-aware with manual toggle.
- **Installable PWA** — Add to home screen on any device for a native app experience.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS v4, Chart.js |
| Backend | Supabase (Postgres, Auth, RLS, Edge Functions) |
| Deployment | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- npm
- A [Supabase](https://supabase.com) project

### Setup

```bash
git clone https://github.com/your-username/kiddfamilyhub.git
cd kiddfamilyhub
npm install
npm run dev
```

This starts the Vite dev server with hot reload.

### Environment Variables

Create a `.env` file in the project root:

```env
# Supabase
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Supabase Setup

Paste `supabase/schema.sql` into your Supabase project's SQL Editor to create all tables, RLS policies, views, and RPC functions.

## Deployment

The app deploys as a static SPA on Vercel. Push to your repo and connect it to Vercel — the `vercel.json` config handles build settings and SPA routing automatically.

## Project Structure

```
client/             Vue 3 frontend (Vite)
  src/
    views/          One view per feature (CalendarView, GroceryListView, etc.)
    stores/         Pinia stores (data fetching + state)
    components/     Reusable UI components
    composables/    useSortable, useTheme
    lib/            Supabase client
supabase/
  schema.sql        Full Postgres schema with RLS and RPCs
  functions/        Deno edge functions (iCloud sync)
```

## License

MIT
