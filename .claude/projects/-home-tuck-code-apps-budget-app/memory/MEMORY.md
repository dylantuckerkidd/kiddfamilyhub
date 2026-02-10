# Budget App Project Memory

## Tech Stack (Post-Supabase Migration)
- **Client**: Vue 3 + Pinia + Tailwind CSS + Vite, TypeScript
- **Backend**: Supabase (PostgreSQL + Auth + RLS)
- **Auth**: Supabase Auth (email/password + Google + Apple OAuth)
- **Database**: PostgreSQL via Supabase, schema at `supabase/schema.sql`
- No more Express server - client talks directly to Supabase

## Key Patterns
- Stores use `supabase.from('table').select/insert/update/delete` pattern
- Views use PostgreSQL views: `calendar_events_with_person`, `todo_items_full`
- RPC functions: `add_grocery_item`, `get_grocery_suggestions`, `reorder_todos`, `reorder_subtasks`
- `user_id` auto-set by database trigger on INSERT (no need to pass from client)
- RLS policies enforce user data isolation
- Pinia stores use composition API (`defineStore('name', () => { ... })`)
- Stores refetch full list after mutations

## Architecture Notes
- Auth store initializes in main.ts before app mount
- Router guard checks `auth.isAuthenticated` (from Supabase session)
- Supabase client singleton at `client/src/lib/supabase.ts`
- Boolean fields use proper `boolean` type (not integer 0/1)
- Budget features commented out (v1 scope: calendar, todos, grocery)
- Budget-related files have `// @ts-nocheck` to skip type checking

## V1 Scope
- Calendar, Todos, Grocery List only
- Budget/Plaid features removed from routes and nav
- Settings page is a stub

## Env Vars
- `VITE_SUPABASE_URL` - Supabase project URL
- `VITE_SUPABASE_ANON_KEY` - Supabase anon key

## File Locations
- SQL schema: `supabase/schema.sql`
- Supabase client: `client/src/lib/supabase.ts`
- Env example: `client/.env.example`
