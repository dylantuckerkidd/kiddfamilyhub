# Kidd Family Hub

A self-hosted family management PWA for organizing calendars, grocery lists, todos, meal plans, home maintenance, and budgets — all in one place.

## Features

- **Family Calendar** — Shared events with multi-day, recurring, and birthday support. iCloud CalDAV sync. Holidays auto-seeded.
- **Grocery Lists** — Add items with autocomplete from 100+ pre-seeded common items. Auto-categorized by aisle.
- **Todo Lists** — Categorized tasks with subtasks, drag-and-drop reordering, and family member assignment.
- **Meal Planning** — Weekly meal planner with a recipe book. Add recipe ingredients to your grocery list in one tap.
- **Home Maintenance** — Track recurring maintenance tasks (HVAC, plumbing, vehicles, etc.) with completion history and cost tracking.
- **Budget & Transactions** — Income/expense tracking with category budgets and Plaid bank integration.
- **Weather** — Current conditions and forecast on the calendar page.
- **Family Sharing** — Invite family members to share all data via invite codes (Supabase mode).
- **Dark Mode** — System-aware with manual toggle.
- **Installable PWA** — Add to home screen on any device for a native app experience.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vue 3, TypeScript, Pinia, Vue Router, Tailwind CSS v4, Chart.js |
| Self-hosted backend | Express, sql.js (SQLite), tsdav (iCloud sync), Plaid SDK |
| Cloud backend | Supabase (Postgres, Auth, RLS, Edge Functions) |
| Deployment | Docker + Cloudflare Tunnel (self-hosted) or Vercel (cloud) |

## Getting Started

### Prerequisites

- Node.js 20+
- npm

### Local Development

```bash
git clone https://github.com/your-username/kiddfamilyhub.git
cd kiddfamilyhub
npm install
npm run dev
```

This starts the Express API server on `http://localhost:4567` and the Vite dev server with hot reload. No `AUTH_PIN` is needed in dev mode — authentication is skipped.

### Environment Variables

Create a `.env` file in the project root:

```env
# Authentication (omit for dev mode)
AUTH_PIN=your-pin

# Supabase (for cloud mode)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# iCloud CalDAV Sync (optional)
ICLOUD_EMAIL=you@icloud.com
ICLOUD_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Plaid Bank Integration (optional)
PLAID_CLIENT_ID=your-client-id
PLAID_SECRET=your-secret

# Cloudflare Tunnel (Docker deployment only)
CLOUDFLARE_TUNNEL_TOKEN=your-tunnel-token
```

## Deployment

### Docker (Raspberry Pi / Home Server)

```bash
docker compose up -d --build
```

This starts two containers:
- **family-hub** — the app on port 3000
- **cloudflared** — Cloudflare Tunnel for remote access

The SQLite database is persisted at `./data/budget.db` on the host via a volume mount.

### Vercel (Cloud)

The app deploys as a static SPA on Vercel with Supabase as the backend. Push to your repo and connect it to Vercel — the `vercel.json` config handles build settings and SPA routing automatically.

Run the Supabase schema setup by pasting `supabase/schema.sql` into your Supabase project's SQL Editor.

## Project Structure

```
client/             Vue 3 frontend (Vite)
  src/
    views/          One view per feature (CalendarView, GroceryListView, etc.)
    stores/         Pinia stores (data fetching + state)
    components/     Reusable UI components
    composables/    useSortable, useTheme
    lib/            Supabase client
server/             Express backend (self-hosted mode)
  src/
    routes/         API route definitions
    controllers/    Route handlers
    services/       iCloud sync service
    db.ts           SQLite schema, migrations, and seed data
supabase/
  schema.sql        Full Postgres schema with RLS and RPCs
  functions/        Deno edge functions (iCloud sync)
data/               SQLite database file (gitignored, auto-created)
```

## License

MIT
