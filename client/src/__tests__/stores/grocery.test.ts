import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useGroceryStore, type GroceryItem } from '@/stores/grocery'

function makeItem(overrides: Partial<GroceryItem> = {}): GroceryItem {
  return {
    id: 1,
    name: 'Milk',
    quantity: null,
    unit: null,
    category: null,
    checked: false,
    created_at: '2024-01-01',
    ...overrides,
  }
}

describe('useGroceryStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('uncheckedItems / checkedItems', () => {
    it('separates checked and unchecked items', () => {
      const store = useGroceryStore()
      store.items = [
        makeItem({ id: 1, checked: false }),
        makeItem({ id: 2, checked: true }),
        makeItem({ id: 3, checked: false }),
      ]
      expect(store.uncheckedItems).toHaveLength(2)
      expect(store.checkedItems).toHaveLength(1)
      expect(store.checkedItems[0].id).toBe(2)
    })
  })

  describe('groupedUncheckedItems', () => {
    it('groups alphabetically with Uncategorized last', () => {
      const store = useGroceryStore()
      store.items = [
        makeItem({ id: 1, category: 'Produce', checked: false }),
        makeItem({ id: 2, category: null, checked: false }),
        makeItem({ id: 3, category: 'Dairy', checked: false }),
      ]
      const groups = store.groupedUncheckedItems
      expect(groups).toHaveLength(3)
      expect(groups[0].category).toBe('Dairy')
      expect(groups[1].category).toBe('Produce')
      expect(groups[2].category).toBe('Uncategorized')
    })

    it('returns empty array when no unchecked items', () => {
      const store = useGroceryStore()
      store.items = [makeItem({ id: 1, checked: true })]
      expect(store.groupedUncheckedItems).toHaveLength(0)
    })

    it('groups multiple items under same category', () => {
      const store = useGroceryStore()
      store.items = [
        makeItem({ id: 1, category: 'Dairy', checked: false }),
        makeItem({ id: 2, category: 'Dairy', checked: false }),
      ]
      const groups = store.groupedUncheckedItems
      expect(groups).toHaveLength(1)
      expect(groups[0].items).toHaveLength(2)
    })
  })
})
