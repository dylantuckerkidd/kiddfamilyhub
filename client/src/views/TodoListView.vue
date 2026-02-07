<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useTodosStore, type TodoItem, type TodoSubtask } from '@/stores/todos'
import { useCalendarStore } from '@/stores/calendar'
import { useGroceryStore } from '@/stores/grocery'
import { useSortable } from '@/composables/useSortable'

const store = useTodosStore()
const calendarStore = useCalendarStore()
const groceryStore = useGroceryStore()

const showEditModal = ref(false)
const showPersonModal = ref(false)
const showCategoryModal = ref(false)
const showCompleted = ref(false)
const editingTodo = ref<TodoItem | null>(null)
const showBulkConfirmDelete = ref(false)
const groceryAdded = ref(false)

// Quick-add form
const quickTitle = ref('')
const quickPersonId = ref<number | null>(null)
const quickCategoryId = ref<number | null>(null)

// Edit/Add modal form
const todoForm = ref({
  title: '',
  description: '',
  person_id: null as number | null,
  due_date: '',
  category_id: null as number | null
})

// Subtask state for edit modal
const editSubtasks = ref<TodoSubtask[]>([])
const newSubtaskTitle = ref('')
const subtaskListRef = ref<HTMLElement | null>(null)

// Person form
const personForm = ref({
  name: '',
  color: '#10b981'
})

// Category form
const categoryForm = ref({
  name: '',
  color: '#10b981'
})

const personColors = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

// Bulk action dropdowns
const showBulkPerson = ref(false)
const showBulkCategory = ref(false)
const showBulkDueDate = ref(false)
const bulkDueDate = ref('')

const todayStr = new Date().toISOString().split('T')[0]

// Drag and drop
const todoListRef = ref<HTMLElement | null>(null)
const canDrag = computed(() =>
  store.selectedPersonFilter === null && store.selectedCategoryFilter === null && !store.selectionMode
)

useSortable(todoListRef, async (oldIndex: number, newIndex: number) => {
  if (!canDrag.value) return
  const items = [...store.filteredActiveTodos]
  const [moved] = items.splice(oldIndex, 1)
  items.splice(newIndex, 0, moved)
  await store.reorderTodos(items.map(t => t.id))
})

function getDueDateClass(dueDate: string | null) {
  if (!dueDate) return ''
  if (dueDate === todayStr) return 'text-amber-600 dark:text-amber-400 font-medium'
  if (dueDate < todayStr) return 'text-red-600 dark:text-red-400 font-medium'
  return 'text-gray-500 dark:text-gray-400'
}

function getDueDateLabel(dueDate: string) {
  if (dueDate === todayStr) return 'Today'
  if (dueDate < todayStr) {
    const days = Math.floor((Date.now() - new Date(dueDate + 'T00:00:00').getTime()) / 86400000)
    return days === 1 ? 'Yesterday' : `${days}d overdue`
  }
  const tomorrow = new Date()
  tomorrow.setDate(tomorrow.getDate() + 1)
  if (dueDate === tomorrow.toISOString().split('T')[0]) return 'Tomorrow'
  return new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function getTodoStyle(todo: TodoItem) {
  if (todo.category_color) {
    return {
      backgroundColor: todo.category_color + '20',
      borderLeft: `3px solid ${todo.category_color}`
    }
  }
  if (todo.person_color) {
    return {
      backgroundColor: todo.person_color + '30',
      borderLeft: `3px solid ${todo.person_color}`
    }
  }
  return {
    borderLeft: '3px solid #9ca3af'
  }
}

async function quickAdd() {
  if (!quickTitle.value.trim()) return
  await store.addTodo({
    title: quickTitle.value.trim(),
    person_id: quickPersonId.value,
    category_id: quickCategoryId.value
  })
  quickTitle.value = ''
}

async function toggleComplete(todo: TodoItem) {
  await store.updateTodo(todo.id, { completed: todo.completed ? 0 : 1 })
}

function openEditTodo(todo: TodoItem) {
  if (store.selectionMode) {
    store.toggleSelection(todo.id)
    return
  }
  editingTodo.value = todo
  todoForm.value = {
    title: todo.title,
    description: todo.description || '',
    person_id: todo.person_id,
    due_date: todo.due_date || '',
    category_id: todo.category_id
  }
  groceryAdded.value = false
  showEditModal.value = true
  loadSubtasks(todo.id)
}

async function loadSubtasks(todoId: number) {
  editSubtasks.value = await store.fetchSubtasks(todoId)
}

async function saveTodo() {
  if (!todoForm.value.title.trim()) return

  if (editingTodo.value) {
    await store.updateTodo(editingTodo.value.id, {
      title: todoForm.value.title.trim(),
      description: todoForm.value.description || null,
      person_id: todoForm.value.person_id,
      due_date: todoForm.value.due_date || null,
      category_id: todoForm.value.category_id
    })
  } else {
    await store.addTodo({
      title: todoForm.value.title.trim(),
      description: todoForm.value.description || undefined,
      person_id: todoForm.value.person_id,
      due_date: todoForm.value.due_date || undefined,
      category_id: todoForm.value.category_id
    })
  }

  showEditModal.value = false
}

async function deleteTodo() {
  if (editingTodo.value) {
    await store.deleteTodo(editingTodo.value.id)
    showEditModal.value = false
  }
}

// Subtask actions
async function addSubtask() {
  if (!editingTodo.value || !newSubtaskTitle.value.trim()) return
  const subtask = await store.addSubtask(editingTodo.value.id, newSubtaskTitle.value.trim())
  editSubtasks.value.push(subtask)
  newSubtaskTitle.value = ''
}

async function toggleSubtask(subtask: TodoSubtask) {
  const updated = await store.updateSubtask(subtask.id, { completed: subtask.completed ? 0 : 1 })
  const idx = editSubtasks.value.findIndex(s => s.id === subtask.id)
  if (idx >= 0) editSubtasks.value[idx] = updated
}

async function removeSubtask(subtask: TodoSubtask) {
  await store.deleteSubtask(subtask.id)
  editSubtasks.value = editSubtasks.value.filter(s => s.id !== subtask.id)
}

// Grocery link
async function addToGrocery() {
  if (!editingTodo.value) return
  await groceryStore.addItem({ name: editingTodo.value.title })
  groceryAdded.value = true
  setTimeout(() => { groceryAdded.value = false }, 2000)
}

// People
async function savePerson() {
  if (!personForm.value.name) return
  await calendarStore.addFamilyMember(personForm.value.name, personForm.value.color)
  personForm.value = { name: '', color: '#10b981' }
}

async function deletePerson(id: number) {
  await calendarStore.deleteFamilyMember(id)
  await store.fetchTodos()
}

// Categories
async function saveCategory() {
  if (!categoryForm.value.name) return
  await store.addCategory(categoryForm.value.name, categoryForm.value.color)
  categoryForm.value = { name: '', color: '#10b981' }
}

async function removeCategory(id: number) {
  await store.deleteCategory(id)
}

// Bulk actions
function toggleSelectionMode() {
  if (store.selectionMode) {
    store.clearSelection()
  } else {
    store.selectionMode = true
  }
}

async function bulkAssignPerson(personId: number | null) {
  const ids = [...store.selectedIds]
  if (ids.length === 0) return
  await store.bulkUpdate(ids, { person_id: personId })
  showBulkPerson.value = false
  store.clearSelection()
}

async function bulkAssignCategory(categoryId: number | null) {
  const ids = [...store.selectedIds]
  if (ids.length === 0) return
  await store.bulkUpdate(ids, { category_id: categoryId })
  showBulkCategory.value = false
  store.clearSelection()
}

async function bulkSetDueDate() {
  const ids = [...store.selectedIds]
  if (ids.length === 0 || !bulkDueDate.value) return
  await store.bulkUpdate(ids, { due_date: bulkDueDate.value })
  showBulkDueDate.value = false
  bulkDueDate.value = ''
  store.clearSelection()
}

async function bulkDeleteSelected() {
  const ids = [...store.selectedIds]
  if (ids.length === 0) return
  await store.bulkDelete(ids)
  showBulkConfirmDelete.value = false
  store.clearSelection()
}

onMounted(() => {
  calendarStore.fetchFamilyMembers()
  store.fetchTodos()
  store.fetchCategories()
})
</script>

<template>
  <div class="space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">
          Todo List
          <span class="text-base font-normal text-gray-500 dark:text-gray-400 ml-2">
            {{ store.activeTodos.length }} active<template v-if="store.completedTodos.length">, {{ store.completedTodos.length }} done</template>
          </span>
        </h1>
      </div>

      <div class="flex items-center gap-2">
        <!-- Select Mode Toggle -->
        <button
          @click="toggleSelectionMode"
          class="p-2 rounded-xl transition-colors border"
          :class="store.selectionMode
            ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-700'
            : 'bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
          title="Select mode"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        </button>

        <!-- Manage Categories -->
        <button
          @click="showCategoryModal = true"
          class="p-2 rounded-xl bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          title="Manage Categories"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A2 2 0 013 12V7a4 4 0 014-4z" />
          </svg>
        </button>

        <button
          @click="showPersonModal = true"
          class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors"
        >
          Manage People
        </button>
      </div>
    </div>

    <!-- Quick Add Bar -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
      <form @submit.prevent="quickAdd" class="flex gap-3 flex-wrap">
        <input
          v-model="quickTitle"
          type="text"
          placeholder="Add a new task..."
          class="flex-1 min-w-[200px] px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
          @keydown.enter.prevent="quickAdd"
        />
        <select
          v-model="quickPersonId"
          class="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
        >
          <option :value="null">Unassigned</option>
          <option v-for="person in store.familyMembers" :key="person.id" :value="person.id">
            {{ person.name }}
          </option>
        </select>
        <select
          v-if="store.categories.length > 0"
          v-model="quickCategoryId"
          class="px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
        >
          <option :value="null">No category</option>
          <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
            {{ cat.name }}
          </option>
        </select>
        <button
          type="submit"
          :disabled="!quickTitle.trim()"
          class="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>
    </div>

    <!-- Person Filter Pills -->
    <div v-if="store.familyMembers.length > 0" class="flex flex-wrap gap-2">
      <button
        @click="store.selectedPersonFilter = null"
        class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors border"
        :class="store.selectedPersonFilter === null
          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
      >
        All
      </button>
      <button
        v-for="person in store.familyMembers"
        :key="person.id"
        @click="store.selectedPersonFilter = store.selectedPersonFilter === person.id ? null : person.id"
        class="px-4 py-1.5 rounded-full text-sm font-medium transition-colors border flex items-center gap-2"
        :class="store.selectedPersonFilter === person.id
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
        :style="store.selectedPersonFilter === person.id ? { backgroundColor: person.color, borderColor: person.color } : {}"
      >
        <span
          v-if="store.selectedPersonFilter !== person.id"
          class="w-2.5 h-2.5 rounded-full"
          :style="{ backgroundColor: person.color }"
        ></span>
        {{ person.name }}
      </button>
    </div>

    <!-- Category Filter Pills -->
    <div v-if="store.categories.length > 0" class="flex flex-wrap gap-2">
      <button
        @click="store.selectedCategoryFilter = null"
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors border"
        :class="store.selectedCategoryFilter === null
          ? 'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 border-gray-800 dark:border-gray-200'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
      >
        All Categories
      </button>
      <button
        v-for="cat in store.categories"
        :key="cat.id"
        @click="store.selectedCategoryFilter = store.selectedCategoryFilter === cat.id ? null : cat.id"
        class="px-3 py-1 rounded-full text-xs font-medium transition-colors border flex items-center gap-1.5"
        :class="store.selectedCategoryFilter === cat.id
          ? 'text-white border-transparent'
          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'"
        :style="store.selectedCategoryFilter === cat.id && cat.color ? { backgroundColor: cat.color, borderColor: cat.color } : {}"
      >
        <span
          v-if="store.selectedCategoryFilter !== cat.id && cat.color"
          class="w-2 h-2 rounded-full"
          :style="{ backgroundColor: cat.color }"
        ></span>
        {{ cat.name }}
      </button>
    </div>

    <!-- Select All (in selection mode) -->
    <div v-if="store.selectionMode" class="flex items-center gap-3">
      <button
        @click="store.selectAll()"
        class="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
      >
        Select All ({{ store.filteredActiveTodos.length }})
      </button>
      <span class="text-sm text-gray-400">|</span>
      <button
        @click="store.clearSelection()"
        class="text-sm text-gray-500 dark:text-gray-400 hover:underline"
      >
        Clear
      </button>
      <span class="text-sm text-gray-500 dark:text-gray-400">
        {{ store.selectedIds.size }} selected
      </span>
    </div>

    <!-- Active Todos -->
    <div ref="todoListRef" class="space-y-2">
      <div
        v-for="todo in store.filteredActiveTodos"
        :key="todo.id"
        class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-start gap-3 hover:shadow-md transition-shadow cursor-pointer"
        :class="{ 'ring-2 ring-emerald-500': store.selectionMode && store.selectedIds.has(todo.id) }"
        :style="getTodoStyle(todo)"
        @click="openEditTodo(todo)"
      >
        <!-- Drag Handle -->
        <div
          v-if="canDrag"
          class="drag-handle mt-1 cursor-grab active:cursor-grabbing text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0"
          @click.stop
        >
          <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.5" /><circle cx="15" cy="5" r="1.5" />
            <circle cx="9" cy="10" r="1.5" /><circle cx="15" cy="10" r="1.5" />
            <circle cx="9" cy="15" r="1.5" /><circle cx="15" cy="15" r="1.5" />
            <circle cx="9" cy="20" r="1.5" /><circle cx="15" cy="20" r="1.5" />
          </svg>
        </div>

        <!-- Selection Checkbox -->
        <button
          v-if="store.selectionMode"
          @click.stop="store.toggleSelection(todo.id)"
          class="mt-0.5 w-5 h-5 rounded border-2 flex-shrink-0 flex items-center justify-center transition-colors"
          :class="store.selectedIds.has(todo.id)
            ? 'bg-emerald-500 border-emerald-500'
            : 'border-gray-300 dark:border-gray-600 hover:border-emerald-500'"
        >
          <svg v-if="store.selectedIds.has(todo.id)" class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
          </svg>
        </button>

        <!-- Completion Checkbox -->
        <button
          v-else
          @click.stop="toggleComplete(todo)"
          class="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-colors hover:border-emerald-500"
          :style="{ borderColor: todo.person_color || '#9ca3af' }"
        >
        </button>

        <div class="flex-1 min-w-0">
          <div class="text-gray-900 dark:text-white font-medium">{{ todo.title }}</div>
          <div v-if="todo.description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">{{ todo.description }}</div>
          <div class="flex items-center gap-3 mt-1 flex-wrap">
            <span
              v-if="todo.person_name"
              class="text-xs px-2 py-0.5 rounded-full"
              :style="{ backgroundColor: (todo.person_color || '#9ca3af') + '20', color: todo.person_color || '#9ca3af' }"
            >
              {{ todo.person_name }}
            </span>
            <span
              v-if="todo.category_name"
              class="text-xs px-2 py-0.5 rounded-full"
              :style="{ backgroundColor: (todo.category_color || '#9ca3af') + '20', color: todo.category_color || '#6b7280' }"
            >
              {{ todo.category_name }}
            </span>
            <span v-if="todo.due_date" class="text-xs" :class="getDueDateClass(todo.due_date)">
              {{ getDueDateLabel(todo.due_date) }}
            </span>
            <!-- Subtask progress -->
            <span v-if="todo.subtask_count > 0" class="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
              <span>{{ todo.subtask_completed_count }}/{{ todo.subtask_count }}</span>
              <div class="w-12 h-1.5 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                <div
                  class="h-full bg-emerald-500 rounded-full transition-all"
                  :style="{ width: (todo.subtask_completed_count / todo.subtask_count * 100) + '%' }"
                ></div>
              </div>
            </span>
          </div>
        </div>
      </div>

      <div
        v-if="store.filteredActiveTodos.length === 0 && !store.loading"
        class="text-center py-12 text-gray-400 dark:text-gray-500"
      >
        <svg class="w-12 h-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
        </svg>
        <p v-if="store.selectedPersonFilter !== null || store.selectedCategoryFilter !== null">No tasks matching filters</p>
        <p v-else>No active tasks — add one above!</p>
      </div>
    </div>

    <!-- Completed Section -->
    <div v-if="store.completedTodos.length > 0" class="space-y-2">
      <button
        @click="showCompleted = !showCompleted"
        class="flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
      >
        <svg
          class="w-4 h-4 transition-transform"
          :class="showCompleted ? 'rotate-90' : ''"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
        </svg>
        <span class="text-sm font-medium">Completed ({{ store.completedTodos.length }})</span>
      </button>

      <template v-if="showCompleted">
        <div class="flex justify-end">
          <button
            @click="store.clearCompleted()"
            class="text-sm text-red-500 hover:text-red-600 dark:text-red-400 dark:hover:text-red-300 transition-colors"
          >
            Clear All
          </button>
        </div>

        <div
          v-for="todo in store.completedTodos"
          :key="todo.id"
          class="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 flex items-start gap-3 opacity-60"
          :style="getTodoStyle(todo)"
        >
          <button
            @click="toggleComplete(todo)"
            class="mt-0.5 w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center bg-emerald-500 border-emerald-500"
          >
            <svg class="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <div class="flex-1 min-w-0">
            <div class="text-gray-500 dark:text-gray-400 line-through">{{ todo.title }}</div>
            <span
              v-if="todo.person_name"
              class="text-xs text-gray-400 dark:text-gray-500"
            >
              {{ todo.person_name }}
            </span>
          </div>
        </div>
      </template>
    </div>

    <!-- Bulk Actions Floating Bar -->
    <Teleport to="body">
      <Transition
        enter-active-class="transition-all duration-200 ease-out"
        enter-from-class="translate-y-full opacity-0"
        enter-to-class="translate-y-0 opacity-100"
        leave-active-class="transition-all duration-150 ease-in"
        leave-from-class="translate-y-0 opacity-100"
        leave-to-class="translate-y-full opacity-0"
      >
        <div
          v-if="store.selectionMode && store.selectedIds.size > 0"
          class="fixed bottom-6 left-1/2 -translate-x-1/2 bg-white dark:bg-gray-800 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center gap-3 z-50 flex-wrap justify-center"
        >
          <span class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
            {{ store.selectedIds.size }} selected
          </span>

          <div class="h-6 w-px bg-gray-200 dark:bg-gray-700"></div>

          <!-- Assign Person -->
          <div class="relative">
            <button
              @click="showBulkPerson = !showBulkPerson; showBulkCategory = false; showBulkDueDate = false"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Assign
            </button>
            <div
              v-if="showBulkPerson"
              class="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] z-10"
            >
              <button
                @click="bulkAssignPerson(null)"
                class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Unassigned
              </button>
              <button
                v-for="person in store.familyMembers"
                :key="person.id"
                @click="bulkAssignPerson(person.id)"
                class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
              >
                <span class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: person.color }"></span>
                {{ person.name }}
              </button>
            </div>
          </div>

          <!-- Change Category -->
          <div v-if="store.categories.length > 0" class="relative">
            <button
              @click="showBulkCategory = !showBulkCategory; showBulkPerson = false; showBulkDueDate = false"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Category
            </button>
            <div
              v-if="showBulkCategory"
              class="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-1 min-w-[150px] z-10"
            >
              <button
                @click="bulkAssignCategory(null)"
                class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                No category
              </button>
              <button
                v-for="cat in store.categories"
                :key="cat.id"
                @click="bulkAssignCategory(cat.id)"
                class="w-full px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 flex items-center gap-2"
              >
                <span v-if="cat.color" class="w-2.5 h-2.5 rounded-full" :style="{ backgroundColor: cat.color }"></span>
                {{ cat.name }}
              </button>
            </div>
          </div>

          <!-- Set Due Date -->
          <div class="relative">
            <button
              @click="showBulkDueDate = !showBulkDueDate; showBulkPerson = false; showBulkCategory = false"
              class="px-3 py-1.5 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Due Date
            </button>
            <div
              v-if="showBulkDueDate"
              class="absolute bottom-full mb-2 left-0 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-3 z-10"
            >
              <input
                v-model="bulkDueDate"
                type="date"
                class="px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm text-gray-900 dark:text-white"
              />
              <button
                @click="bulkSetDueDate"
                :disabled="!bulkDueDate"
                class="mt-2 w-full px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50"
              >
                Apply
              </button>
            </div>
          </div>

          <!-- Delete -->
          <button
            @click="showBulkConfirmDelete = true"
            class="px-3 py-1.5 text-sm bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Delete
          </button>

          <!-- Cancel -->
          <button
            @click="store.clearSelection()"
            class="px-3 py-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            Cancel
          </button>
        </div>
      </Transition>
    </Teleport>

    <!-- Bulk Delete Confirm Modal -->
    <div
      v-if="showBulkConfirmDelete"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
      @click.self="showBulkConfirmDelete = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Delete {{ store.selectedIds.size }} tasks?</h3>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">This action cannot be undone.</p>
        <div class="flex gap-3">
          <button
            @click="showBulkConfirmDelete = false"
            class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="bulkDeleteSelected"
            class="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl font-medium hover:bg-red-600 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>

    <!-- Edit/Add Modal -->
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showEditModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ editingTodo ? 'Edit Task' : 'Add Task' }}
        </h3>

        <form @submit.prevent="saveTodo" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              v-model="todoForm.title"
              type="text"
              required
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              placeholder="Task title"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              v-model="todoForm.description"
              rows="3"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
              placeholder="Optional description"
            ></textarea>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to</label>
              <select
                v-model="todoForm.person_id"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              >
                <option :value="null">Unassigned</option>
                <option v-for="person in store.familyMembers" :key="person.id" :value="person.id">
                  {{ person.name }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
              <select
                v-model="todoForm.category_id"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              >
                <option :value="null">No category</option>
                <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                  {{ cat.name }}
                </option>
              </select>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Due date</label>
            <input
              v-model="todoForm.due_date"
              type="date"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <!-- Add to Grocery List -->
          <div v-if="editingTodo">
            <button
              type="button"
              @click="addToGrocery"
              class="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl font-medium transition-colors"
              :class="groceryAdded
                ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
            >
              <svg v-if="!groceryAdded" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
              </svg>
              <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
              {{ groceryAdded ? 'Added to Grocery List!' : 'Add to Grocery List' }}
            </button>
          </div>

          <!-- Subtasks Section (edit mode only) -->
          <div v-if="editingTodo" class="border-t border-gray-200 dark:border-gray-700 pt-4">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Subtasks
              <span v-if="editSubtasks.length > 0" class="font-normal text-gray-400">
                ({{ editSubtasks.filter(s => s.completed).length }}/{{ editSubtasks.length }})
              </span>
            </label>

            <!-- Subtask List -->
            <div ref="subtaskListRef" class="space-y-1 mb-2">
              <div
                v-for="subtask in editSubtasks"
                :key="subtask.id"
                class="flex items-center gap-2 group py-1"
              >
                <button
                  type="button"
                  @click="toggleSubtask(subtask)"
                  class="w-4 h-4 rounded border flex-shrink-0 flex items-center justify-center transition-colors"
                  :class="subtask.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-300 dark:border-gray-600 hover:border-emerald-500'"
                >
                  <svg v-if="subtask.completed" class="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="3" d="M5 13l4 4L19 7" />
                  </svg>
                </button>
                <span
                  class="flex-1 text-sm"
                  :class="subtask.completed
                    ? 'line-through text-gray-400 dark:text-gray-500'
                    : 'text-gray-700 dark:text-gray-300'"
                >
                  {{ subtask.title }}
                </span>
                <button
                  type="button"
                  @click="removeSubtask(subtask)"
                  class="p-1 text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <!-- Add Subtask Input -->
            <div class="flex gap-2">
              <input
                v-model="newSubtaskTitle"
                type="text"
                placeholder="Add a subtask..."
                class="flex-1 px-3 py-1.5 text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                @keydown.enter.prevent="addSubtask"
              />
              <button
                type="button"
                @click="addSubtask"
                :disabled="!newSubtaskTitle.trim()"
                class="px-3 py-1.5 text-sm bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              v-if="editingTodo"
              type="button"
              @click="deleteTodo"
              class="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
            <div class="flex-1"></div>
            <button
              type="button"
              @click="showEditModal = false"
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              {{ editingTodo ? 'Save' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Categories Modal -->
    <div
      v-if="showCategoryModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showCategoryModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manage Categories</h3>

        <!-- Existing categories -->
        <div v-if="store.categories.length > 0" class="space-y-2 mb-6">
          <div
            v-for="cat in store.categories"
            :key="cat.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
          >
            <div class="flex items-center gap-3">
              <span
                class="w-4 h-4 rounded-full"
                :style="{ backgroundColor: cat.color || '#9ca3af' }"
              ></span>
              <span class="text-gray-900 dark:text-white">{{ cat.name }}</span>
            </div>
            <button
              @click="removeCategory(cat.id)"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add new category -->
        <form @submit.prevent="saveCategory" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              v-model="categoryForm.name"
              type="text"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              placeholder="Category name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in personColors"
                :key="color"
                type="button"
                @click="categoryForm.color = color"
                class="w-8 h-8 rounded-full transition-transform hover:scale-110"
                :class="categoryForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''"
                :style="{ backgroundColor: color }"
              ></button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="showCategoryModal = false"
              class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              :disabled="!categoryForm.name"
              class="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Category
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- People Modal -->
    <div
      v-if="showPersonModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showPersonModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manage Family Members</h3>

        <!-- Existing members -->
        <div v-if="store.familyMembers.length > 0" class="space-y-2 mb-6">
          <div
            v-for="person in store.familyMembers"
            :key="person.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
          >
            <div class="flex items-center gap-3">
              <span class="w-4 h-4 rounded-full" :style="{ backgroundColor: person.color }"></span>
              <span class="text-gray-900 dark:text-white">{{ person.name }}</span>
            </div>
            <button
              @click="deletePerson(person.id)"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add new member -->
        <form @submit.prevent="savePerson" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              v-model="personForm.name"
              type="text"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              placeholder="Family member name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in personColors"
                :key="color"
                type="button"
                @click="personForm.color = color"
                class="w-8 h-8 rounded-full transition-transform hover:scale-110"
                :class="personForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''"
                :style="{ backgroundColor: color }"
              ></button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="showPersonModal = false"
              class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              :disabled="!personForm.name"
              class="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Person
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
