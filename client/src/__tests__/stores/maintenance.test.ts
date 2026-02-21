import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMaintenanceStore, type MaintenanceItem } from '@/stores/maintenance'

function makeItem(overrides: Partial<MaintenanceItem> = {}): MaintenanceItem {
  return {
    id: 1,
    title: 'Test',
    description: null,
    category_id: null,
    person_id: null,
    frequency: 'monthly',
    frequency_days: null,
    next_due_date: null,
    sort_order: 0,
    created_at: '2024-01-01',
    category_name: null,
    category_icon: null,
    person_name: null,
    person_color: null,
    last_completed: null,
    ...overrides,
  }
}

describe('useMaintenanceStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // Fix "today" so tests are deterministic
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-06-15'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('overdueItems', () => {
    it('returns items with next_due_date before today', () => {
      const store = useMaintenanceStore()
      store.items = [
        makeItem({ id: 1, next_due_date: '2024-06-14' }),
        makeItem({ id: 2, next_due_date: '2024-06-15' }),
        makeItem({ id: 3, next_due_date: null }),
      ]
      expect(store.overdueItems).toHaveLength(1)
      expect(store.overdueItems[0].id).toBe(1)
    })
  })

  describe('upcomingSoonItems', () => {
    it('returns items due within 7 days (inclusive of today)', () => {
      const store = useMaintenanceStore()
      store.items = [
        makeItem({ id: 1, next_due_date: '2024-06-15' }), // today
        makeItem({ id: 2, next_due_date: '2024-06-22' }), // 7 days out
        makeItem({ id: 3, next_due_date: '2024-06-23' }), // 8 days out
        makeItem({ id: 4, next_due_date: '2024-06-14' }), // yesterday (overdue)
      ]
      expect(store.upcomingSoonItems).toHaveLength(2)
      expect(store.upcomingSoonItems.map(i => i.id)).toEqual([1, 2])
    })
  })

  describe('upToDateItems', () => {
    it('returns items with no due date or due after 7 days', () => {
      const store = useMaintenanceStore()
      store.items = [
        makeItem({ id: 1, next_due_date: null }),
        makeItem({ id: 2, next_due_date: '2024-06-23' }), // 8 days out
        makeItem({ id: 3, next_due_date: '2024-06-15' }), // today (upcoming)
      ]
      expect(store.upToDateItems).toHaveLength(2)
      expect(store.upToDateItems.map(i => i.id)).toEqual([1, 2])
    })
  })

  describe('groupedByCategory', () => {
    it('groups alphabetically with Uncategorized last', () => {
      const store = useMaintenanceStore()
      store.items = [
        makeItem({ id: 1, category_name: 'Plumbing', category_icon: '🚿' }),
        makeItem({ id: 2, category_name: null }),
        makeItem({ id: 3, category_name: 'HVAC', category_icon: '🌡️' }),
      ]
      const groups = store.groupedByCategory
      expect(groups).toHaveLength(3)
      expect(groups[0].category).toBe('HVAC')
      expect(groups[0].icon).toBe('🌡️')
      expect(groups[1].category).toBe('Plumbing')
      expect(groups[2].category).toBe('Uncategorized')
    })

    it('returns empty when no items', () => {
      const store = useMaintenanceStore()
      expect(store.groupedByCategory).toHaveLength(0)
    })
  })
})
