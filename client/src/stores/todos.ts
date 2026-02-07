import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCalendarStore } from './calendar'
import { apiFetch } from '@/composables/useApi'

export interface TodoCategory {
  id: number
  name: string
  color: string | null
  sort_order: number
}

export interface TodoSubtask {
  id: number
  todo_id: number
  title: string
  completed: number
  sort_order: number
}

export interface TodoItem {
  id: number
  title: string
  description: string | null
  completed: number
  person_id: number | null
  due_date: string | null
  category_id: number | null
  sort_order: number
  created_at: string
  person_name: string | null
  person_color: string | null
  category_name: string | null
  category_color: string | null
  subtask_count: number
  subtask_completed_count: number
}

export const useTodosStore = defineStore('todos', () => {
  const todos = ref<TodoItem[]>([])
  const categories = ref<TodoCategory[]>([])
  const loading = ref(false)
  const selectedPersonFilter = ref<number | null>(null)
  const selectedCategoryFilter = ref<number | null>(null)
  const selectionMode = ref(false)
  const selectedIds = ref<Set<number>>(new Set())

  const calendarStore = useCalendarStore()
  const familyMembers = computed(() => calendarStore.familyMembers)

  const activeTodos = computed(() =>
    todos.value.filter(t => !t.completed)
  )

  const completedTodos = computed(() =>
    todos.value.filter(t => t.completed)
  )

  const filteredActiveTodos = computed(() => {
    let result = activeTodos.value
    if (selectedPersonFilter.value !== null) {
      result = result.filter(t => t.person_id === selectedPersonFilter.value)
    }
    if (selectedCategoryFilter.value !== null) {
      result = result.filter(t => t.category_id === selectedCategoryFilter.value)
    }
    return result
  })

  const groupedByCategory = computed(() => {
    const groups: { category: TodoCategory | null; todos: TodoItem[] }[] = []
    const map = new Map<number | null, TodoItem[]>()

    for (const todo of activeTodos.value) {
      const key = todo.category_id
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(todo)
    }

    // Named categories first (in sort order), then uncategorized
    for (const cat of categories.value) {
      if (map.has(cat.id)) {
        groups.push({ category: cat, todos: map.get(cat.id)! })
      }
    }
    if (map.has(null)) {
      groups.push({ category: null, todos: map.get(null)! })
    }

    return groups
  })

  async function fetchTodos() {
    loading.value = true
    try {
      const res = await apiFetch('/api/todos')
      todos.value = await res.json()
    } finally {
      loading.value = false
    }
  }

  async function addTodo(data: { title: string; description?: string; person_id?: number | null; due_date?: string; category_id?: number | null }) {
    const res = await apiFetch('/api/todos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const todo = await res.json()
    await fetchTodos()
    return todo
  }

  async function updateTodo(id: number, data: Partial<TodoItem>) {
    const res = await apiFetch(`/api/todos/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const updated = await res.json()
    await fetchTodos()
    return updated
  }

  async function deleteTodo(id: number) {
    await apiFetch(`/api/todos/${id}`, { method: 'DELETE' })
    await fetchTodos()
  }

  async function clearCompleted() {
    await apiFetch('/api/todos/clear-completed', { method: 'DELETE' })
    await fetchTodos()
  }

  // === Reorder ===
  async function reorderTodos(ids: number[]) {
    await apiFetch('/api/todos/reorder', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
    await fetchTodos()
  }

  // === Categories ===
  async function fetchCategories() {
    const res = await apiFetch('/api/todos/categories')
    categories.value = await res.json()
  }

  async function addCategory(name: string, color: string | null) {
    const res = await apiFetch('/api/todos/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    })
    const cat = await res.json()
    await fetchCategories()
    return cat
  }

  async function updateCategory(id: number, data: { name?: string; color?: string | null }) {
    await apiFetch(`/api/todos/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    await fetchCategories()
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/api/todos/categories/${id}`, { method: 'DELETE' })
    await fetchCategories()
    await fetchTodos()
  }

  // === Subtasks ===
  async function fetchSubtasks(todoId: number): Promise<TodoSubtask[]> {
    const res = await apiFetch(`/api/todos/${todoId}/subtasks`)
    return await res.json()
  }

  async function addSubtask(todoId: number, title: string): Promise<TodoSubtask> {
    const res = await apiFetch(`/api/todos/${todoId}/subtasks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    })
    const subtask = await res.json()
    await fetchTodos()
    return subtask
  }

  async function updateSubtask(id: number, data: { title?: string; completed?: number }): Promise<TodoSubtask> {
    const res = await apiFetch(`/api/todos/subtasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const subtask = await res.json()
    await fetchTodos()
    return subtask
  }

  async function deleteSubtask(id: number) {
    await apiFetch(`/api/todos/subtasks/${id}`, { method: 'DELETE' })
    await fetchTodos()
  }

  async function reorderSubtasks(todoId: number, ids: number[]) {
    await apiFetch(`/api/todos/${todoId}/subtasks/reorder`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
  }

  // === Bulk Actions ===
  async function bulkUpdate(ids: number[], updates: { person_id?: number | null; due_date?: string | null; category_id?: number | null; completed?: number }) {
    await apiFetch('/api/todos/bulk', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids, updates })
    })
    await fetchTodos()
  }

  async function bulkDelete(ids: number[]) {
    await apiFetch('/api/todos/bulk', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids })
    })
    await fetchTodos()
  }

  // === Selection ===
  function toggleSelection(id: number) {
    const newSet = new Set(selectedIds.value)
    if (newSet.has(id)) {
      newSet.delete(id)
    } else {
      newSet.add(id)
    }
    selectedIds.value = newSet
  }

  function selectAll() {
    selectedIds.value = new Set(filteredActiveTodos.value.map(t => t.id))
  }

  function clearSelection() {
    selectedIds.value = new Set()
    selectionMode.value = false
  }

  return {
    todos,
    categories,
    loading,
    selectedPersonFilter,
    selectedCategoryFilter,
    selectionMode,
    selectedIds,
    familyMembers,
    activeTodos,
    completedTodos,
    filteredActiveTodos,
    groupedByCategory,
    fetchTodos,
    addTodo,
    updateTodo,
    deleteTodo,
    clearCompleted,
    reorderTodos,
    fetchCategories,
    addCategory,
    updateCategory,
    deleteCategory,
    fetchSubtasks,
    addSubtask,
    updateSubtask,
    deleteSubtask,
    reorderSubtasks,
    bulkUpdate,
    bulkDelete,
    toggleSelection,
    selectAll,
    clearSelection
  }
})
