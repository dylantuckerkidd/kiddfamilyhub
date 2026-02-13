# Next Steps: Supabase + Capacitor iOS

## What's Done

- [x] Supabase SQL schema with tables, RLS, views, functions, seed data (`supabase/schema.sql`)
- [x] Supabase JS client installed and configured (`client/src/lib/supabase.ts`)
- [x] Auth rewritten for Supabase (email/password + Google + Apple OAuth)
- [x] All stores rewritten (grocery, calendar, todos) to use Supabase directly
- [x] Boolean types fixed across all views/stores
- [x] Budget features removed from routes/nav (files preserved with `// @ts-nocheck`)
- [x] Vite proxy and Express `useApi` composable removed
- [x] TypeScript compiles clean, Vite build succeeds

---

## Step 1: Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) and create a new project
2. Note your **Project URL** and **Anon Key** from Settings > API
3. Create `client/.env`:
   ```
   VITE_SUPABASE_URL=https://your-project-id.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key-here
   ```

## Step 2: Run the Schema

1. Go to Supabase Dashboard > SQL Editor
2. Paste the entire contents of `supabase/schema.sql` and run it
3. Verify tables were created in Table Editor (you should see all 7 tables)
4. Verify the two views exist: `calendar_events_with_person` and `todo_items_full`

## Step 3: Enable Auth Providers

### Email/Password
- Already enabled by default in Supabase

### Google OAuth
1. Supabase Dashboard > Authentication > Providers > Google
2. Create OAuth credentials at [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Authorized redirect URI: `https://your-project-id.supabase.co/auth/v1/callback`
3. Paste Client ID and Client Secret into Supabase

### Apple Sign In
1. Supabase Dashboard > Authentication > Providers > Apple
2. Requires Apple Developer account ($99/year)
3. Create a Service ID at [Apple Developer Portal](https://developer.apple.com/account/resources/identifiers/list/serviceId)
   - Return URL: `https://your-project-id.supabase.co/auth/v1/callback`
4. Generate a key and paste credentials into Supabase

## Step 4: Test the App

```bash
cd client
npm run dev
```

1. Open http://localhost:5173
2. Sign up with email/password
3. Check your email for confirmation link
4. Sign in and test:
   - Create family members
   - Add calendar events (single + recurring)
   - Add grocery items (check autocomplete suggestions work)
   - Add todos with categories, subtasks, due dates
   - Test bulk actions and drag reorder
5. Sign up a second account and verify data isolation (each user only sees their own data)

## Step 5: Capacitor iOS Setup

```bash
cd client

# Install Capacitor
npm install @capacitor/core @capacitor/cli
npx cap init "Family Hub" "com.yourname.familyhub" --web-dir dist
npm install @capacitor/ios @capacitor/app @capacitor/keyboard @capacitor/status-bar @capacitor/haptics

# Add iOS platform
npx cap add ios
```

### Configure `capacitor.config.ts`

```ts
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.yourname.familyhub',
  appName: 'Family Hub',
  webDir: 'dist',
  plugins: {
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true
    },
    StatusBar: {
      style: 'dark'
    }
  }
}

export default config
```

### iOS Safe Area CSS

Add to `client/src/App.vue` or your main CSS:
```css
:root {
  --safe-area-top: env(safe-area-inset-top);
  --safe-area-bottom: env(safe-area-inset-bottom);
}
```

Add to `client/index.html` in the `<meta name="viewport">` tag:
```html
<meta name="viewport" content="viewport-fit=cover, width=device-width, initial-scale=1.0">
```

### OAuth Deep Linking (for Google/Apple sign-in in Capacitor)

Add URL scheme to `capacitor.config.ts`:
```ts
server: {
  // For OAuth redirects in native app
  hostname: 'localhost'
}
```

Handle OAuth callbacks in `client/src/main.ts`:
```ts
import { App as CapApp } from '@capacitor/app'

CapApp.addListener('appUrlOpen', async ({ url }) => {
  if (url.includes('localhost')) {
    // Supabase will handle the OAuth token exchange
    const { data, error } = await supabase.auth.getSession()
    if (data.session) {
      router.push('/')
    }
  }
})
```

### Build & Open in Xcode

```bash
npm run build         # Build Vue app
npx cap sync          # Copy web assets + sync plugins
npx cap open ios      # Open in Xcode
```

## Step 6: Remove Express Server (when ready)

Once everything works with Supabase:

```bash
# Remove server workspace
rm -rf server/

# Update root package.json - remove server from workspaces and scripts
# Keep only:
#   "scripts": { "dev": "npm -w client run dev", "build": "npm -w client run build" }
#   "workspaces": ["client"]

# Remove server-only files
rm -rf data/ Dockerfile docker-compose.yml

# Remove .env (server env vars no longer needed)
rm .env
```

## Step 7: Deploy Web Version (optional)

### Vercel
```bash
cd client
npx vercel
# Set env vars: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
# Framework: Vite
# Build command: npm run build
# Output dir: dist
```

### Netlify
```bash
cd client
npx netlify deploy --prod
# Same env vars as above
```

Add a `client/_redirects` file for SPA routing:
```
/*    /index.html   200
```

## Step 8: App Store Submission

### Prerequisites
- Apple Developer account ($99/year) at [developer.apple.com](https://developer.apple.com)
- App icon (1024x1024 PNG, no transparency)
- Privacy policy URL (required)
- At least 3 screenshots per device size

### Steps
1. In Xcode: Product > Archive
2. Upload to App Store Connect via Xcode Organizer
3. Fill out app metadata in [App Store Connect](https://appstoreconnect.apple.com):
   - App name, subtitle, description
   - Keywords, category (Productivity)
   - Screenshots (6.7" and 6.1" iPhone at minimum)
   - Privacy policy URL
   - Age rating
4. Submit for review (typically 24-48 hours)

### Privacy Declarations
For App Store privacy questionnaire, the app collects:
- **Email address** - for account creation
- **User content** - calendar events, todos, grocery lists (stored in Supabase)
- No tracking, no third-party analytics in v1
