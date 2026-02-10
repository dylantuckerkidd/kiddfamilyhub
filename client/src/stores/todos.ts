import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { useCalendarStore } from './calendar'
import { supabase } from '@/lib/supabase'

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
  completed: boolean
  sort_order: number
}

export interface TodoItem {
  id: number
  title: string
  description: string | null
  completed: boolean
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
      const { data, error } = await supabase
        .from('todo_items_full')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      todos.value = data ?? []
    } finally {
      loading.value = false
    }
  }

  async function addTodo(data: { title: string; description?: string; person_id?: number | null; due_date?: string; category_id?: number | null }) {
    const { data: todo, error } = await supabase
      .from('todo_items')
      .insert({
        title: data.title,
        description: data.description || null,
        person_id: data.person_id ?? null,
        due_date: data.due_date || null,
        category_id: data.category_id ?? null
      })
      .select('*')
      .single()
    if (error) throw error
    await fetchTodos()
    return todo
  }

  async function updateTodo(id: number, data: Partial<TodoItem>) {
    // Strip view-only fields
    const { person_name, person_color, category_name, category_color, subtask_count, subtask_completed_count, ...updateData } = data as any
    const { error } = await supabase
      .from('todo_items')
      .update(updateData)
      .eq('id', id)
    if (error) throw error
    await fetchTodos()
  }

  async function deleteTodo(id: number) {
    const { error } = await supabase
      .from('todo_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchTodos()
  }

  async function clearCompleted() {
    const { error } = await supabase
      .from('todo_items')
      .delete()
      .eq('completed', true)
    if (error) throw error
    await fetchTodos()
  }

  // === Reorder ===
  async function reorderTodos(ids: number[]) {
    const { error } = await supabase.rpc('reorder_todos', { ids })
    if (error) throw error
    await fetchTodos()
  }

  // === Categories ===
  async function fetchCategories() {
    const { data, error } = await supabase
      .from('todo_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    categories.value = data ?? []
  }

  async function addCategory(name: string, color: string | null) {
    const { data: cat, error } = await supabase
      .from('todo_categories')
      .insert({ name, color })
      .select('*')
      .single()
    if (error) throw error
    await fetchCategories()
    return cat
  }

  async function updateCategory(id: number, data: { name?: string; color?: string | null }) {
    const { error } = await supabase
      .from('todo_categories')
      .update(data)
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  async function deleteCategory(id: number) {
    const { error } = await supabase
      .from('todo_categories')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
    await fetchTodos()
  }

  // === Subtasks ===
  async function fetchSubtasks(todoId: number): Promise<TodoSubtask[]> {
    const { data, error } = await supabase
      .from('todo_subtasks')
      .select('*')
      .eq('todo_id', todoId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  async function addSubtask(todoId: number, title: string): Promise<TodoSubtask> {
    const { data, error } = await supabase
      .from('todo_subtasks')
      .insert({ todo_id: todoId, title })
      .select('*')
      .single()
    if (error) throw error
    await fetchTodos()
    return data
  }

  async function updateSubtask(id: number, data: { title?: string; completed?: boolean }): Promise<TodoSubtask> {
    const { data: subtask, error } = await supabase
      .from('todo_subtasks')
      .update(data)
      .eq('id', id)
      .select('*')
      .single()
    if (error) throw error
    await fetchTodos()
    return subtask
  }

  async function deleteSubtask(id: number) {
    const { error } = await supabase
      .from('todo_subtasks')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchTodos()
  }

  async function reorderSubtasks(todoId: number, ids: number[]) {
    const { error } = await supabase.rpc('reorder_subtasks', {
      p_todo_id: todoId,
      ids
    })
    if (error) throw error
  }

  // === Bulk Actions ===
  async function bulkUpdate(ids: number[], updates: { person_id?: number | null; due_date?: string | null; category_id?: number | null; completed?: boolean }) {
    const { error } = await supabase
      .from('todo_items')
      .update(updates)
      .in('id', ids)
    if (error) throw error
    await fetchTodos()
  }

  async function bulkDelete(ids: number[]) {
    const { error } = await supabase
      .from('todo_items')
      .delete()
      .in('id', ids)
    if (error) throw error
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
