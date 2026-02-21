import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock the calendar store before importing todos
vi.mock('@/stores/calendar', () => ({
  useCalendarStore: () => ({
    familyMembers: [],
  }),
}))

import { useTodosStore, type TodoItem, type TodoCategory } from '@/stores/todos'

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: 1,
    title: 'Test',
    description: null,
    completed: false,
    person_id: null,
    due_date: null,
    category_id: null,
    sort_order: 0,
    created_at: '2024-01-01',
    person_name: null,
    person_color: null,
    category_name: null,
    category_color: null,
    subtask_count: 0,
    subtask_completed_count: 0,
    ...overrides,
  }
}

describe('useTodosStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('activeTodos', () => {
    it('filters out completed todos', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1, completed: false }),
        makeTodo({ id: 2, completed: true }),
        makeTodo({ id: 3, completed: false }),
      ]
      expect(store.activeTodos).toHaveLength(2)
      expect(store.activeTodos.map(t => t.id)).toEqual([1, 3])
    })
  })

  describe('completedTodos', () => {
    it('returns only completed todos', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1, completed: false }),
        makeTodo({ id: 2, completed: true }),
      ]
      expect(store.completedTodos).toHaveLength(1)
      expect(store.completedTodos[0].id).toBe(2)
    })
  })

  describe('filteredActiveTodos', () => {
    it('returns all active when no filters set', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1 }),
        makeTodo({ id: 2 }),
      ]
      expect(store.filteredActiveTodos).toHaveLength(2)
    })

    it('filters by person', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1, person_id: 10 }),
        makeTodo({ id: 2, person_id: 20 }),
      ]
      store.selectedPersonFilter = 10
      expect(store.filteredActiveTodos).toHaveLength(1)
      expect(store.filteredActiveTodos[0].id).toBe(1)
    })

    it('filters by category', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1, category_id: 5 }),
        makeTodo({ id: 2, category_id: 6 }),
      ]
      store.selectedCategoryFilter = 6
      expect(store.filteredActiveTodos).toHaveLength(1)
      expect(store.filteredActiveTodos[0].id).toBe(2)
    })

    it('filters by both person and category', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1, person_id: 10, category_id: 5 }),
        makeTodo({ id: 2, person_id: 10, category_id: 6 }),
        makeTodo({ id: 3, person_id: 20, category_id: 5 }),
      ]
      store.selectedPersonFilter = 10
      store.selectedCategoryFilter = 5
      expect(store.filteredActiveTodos).toHaveLength(1)
      expect(store.filteredActiveTodos[0].id).toBe(1)
    })
  })

  describe('groupedByCategory', () => {
    it('groups by named categories in sort_order, uncategorized last', () => {
      const store = useTodosStore()
      // Categories come pre-sorted by sort_order from the DB
      store.categories = [
        { id: 2, name: 'Home', color: null, sort_order: 1 },
        { id: 1, name: 'Work', color: null, sort_order: 2 },
      ] as TodoCategory[]
      store.todos = [
        makeTodo({ id: 1, category_id: 1 }),
        makeTodo({ id: 2, category_id: null }),
        makeTodo({ id: 3, category_id: 2 }),
      ]

      const groups = store.groupedByCategory
      expect(groups).toHaveLength(3)
      // Home (sort_order 1) comes before Work (sort_order 2)
      expect(groups[0].category?.name).toBe('Home')
      expect(groups[1].category?.name).toBe('Work')
      // Uncategorized last
      expect(groups[2].category).toBeNull()
      expect(groups[2].todos[0].id).toBe(2)
    })

    it('returns empty when no active todos', () => {
      const store = useTodosStore()
      store.todos = [makeTodo({ id: 1, completed: true })]
      expect(store.groupedByCategory).toHaveLength(0)
    })
  })

  describe('selection', () => {
    it('toggleSelection adds and removes IDs', () => {
      const store = useTodosStore()
      store.toggleSelection(1)
      expect(store.selectedIds.has(1)).toBe(true)
      store.toggleSelection(1)
      expect(store.selectedIds.has(1)).toBe(false)
    })

    it('selectAll selects all filtered active IDs', () => {
      const store = useTodosStore()
      store.todos = [
        makeTodo({ id: 1 }),
        makeTodo({ id: 2 }),
        makeTodo({ id: 3, completed: true }),
      ]
      store.selectAll()
      expect(store.selectedIds.size).toBe(2)
      expect(store.selectedIds.has(1)).toBe(true)
      expect(store.selectedIds.has(2)).toBe(true)
    })

    it('clearSelection empties set and resets selectionMode', () => {
      const store = useTodosStore()
      store.selectionMode = true
      store.toggleSelection(1)
      store.clearSelection()
      expect(store.selectedIds.size).toBe(0)
      expect(store.selectionMode).toBe(false)
    })
  })
})
