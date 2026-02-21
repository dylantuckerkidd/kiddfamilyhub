import { vi } from 'vitest'

// Mock Supabase client - return chainable no-op so stores can be imported
const chainable = (): any =>
  new Proxy(() => chainable(), {
    get: () => chainable,
  })

vi.mock('@/lib/supabase', () => ({
  supabase: chainable(),
}))
