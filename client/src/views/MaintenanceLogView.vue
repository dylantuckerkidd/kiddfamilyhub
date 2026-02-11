<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMaintenanceStore, type MaintenanceItem, type MaintenanceHistoryEntry } from '@/stores/maintenance'
import { useCalendarStore } from '@/stores/calendar'

const store = useMaintenanceStore()
const calendarStore = useCalendarStore()

const showAddModal = ref(false)
const showCompleteModal = ref(false)
const editingItem = ref<MaintenanceItem | null>(null)
const completingItem = ref<MaintenanceItem | null>(null)
const expandedHistory = ref<Record<number, MaintenanceHistoryEntry[]>>({})
const expandedItemId = ref<number | null>(null)

const filterCategory = ref<number | ''>('')
const filterPerson = ref<number | ''>('')

const frequencies = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'quarterly', label: 'Quarterly' },
  { value: 'biannual', label: 'Every 6 Months' },
  { value: 'annual', label: 'Annually' },
  { value: 'custom', label: 'Custom' },
]

const itemForm = ref({
  title: '',
  description: '',
  category_id: null as number | null,
  person_id: null as number | null,
  frequency: 'monthly',
  frequency_days: null as number | null,
  next_due_date: '',
})

const completeForm = ref({
  notes: '',
  cost: null as number | null,
  person_id: null as number | null,
  completed_date: new Date().toISOString().split('T')[0],
})

const today = computed(() => new Date().toISOString().split('T')[0])

const filteredGrouped = computed(() => {
  return store.groupedByCategory
    .map(group => ({
      ...group,
      items: group.items.filter(item => {
        if (filterCategory.value && item.category_id !== filterCategory.value) return false
        if (filterPerson.value && item.person_id !== filterPerson.value) return false
        return true
      }),
    }))
    .filter(group => group.items.length > 0)
})

const filteredOverdue = computed(() =>
  store.overdueItems.filter(i => {
    if (filterCategory.value && i.category_id !== filterCategory.value) return false
    if (filterPerson.value && i.person_id !== filterPerson.value) return false
    return true
  })
)

const filteredUpcomingSoon = computed(() =>
  store.upcomingSoonItems.filter(i => {
    if (filterCategory.value && i.category_id !== filterCategory.value) return false
    if (filterPerson.value && i.person_id !== filterPerson.value) return false
    return true
  })
)

const filteredUpToDate = computed(() =>
  store.upToDateItems.filter(i => {
    if (filterCategory.value && i.category_id !== filterCategory.value) return false
    if (filterPerson.value && i.person_id !== filterPerson.value) return false
    return true
  })
)

function getDueStatus(item: MaintenanceItem): 'overdue' | 'soon' | 'ok' | 'none' {
  if (!item.next_due_date) return 'none'
  const soon = new Date()
  soon.setDate(soon.getDate() + 7)
  const soonStr = soon.toISOString().split('T')[0]
  if (item.next_due_date < today.value) return 'overdue'
  if (item.next_due_date <= soonStr) return 'soon'
  return 'ok'
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Never'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function frequencyLabel(freq: string, days: number | null): string {
  const f = frequencies.find(x => x.value === freq)
  if (freq === 'custom' && days) return `Every ${days} days`
  return f?.label || freq
}

function openAddModal() {
  editingItem.value = null
  itemForm.value = {
    title: '',
    description: '',
    category_id: null,
    person_id: null,
    frequency: 'monthly',
    frequency_days: null,
    next_due_date: '',
  }
  showAddModal.value = true
}

function openEditModal(item: MaintenanceItem) {
  editingItem.value = item
  itemForm.value = {
    title: item.title,
    description: item.description || '',
    category_id: item.category_id,
    person_id: item.person_id,
    frequency: item.frequency,
    frequency_days: item.frequency_days,
    next_due_date: item.next_due_date || '',
  }
  showAddModal.value = true
}

async function saveItem() {
  if (!itemForm.value.title.trim()) return

  const data = {
    title: itemForm.value.title.trim(),
    description: itemForm.value.description.trim() || undefined,
    category_id: itemForm.value.category_id,
    person_id: itemForm.value.person_id,
    frequency: itemForm.value.frequency,
    frequency_days: itemForm.value.frequency === 'custom' ? itemForm.value.frequency_days : null,
    next_due_date: itemForm.value.next_due_date || null,
  }

  if (editingItem.value) {
    await store.updateItem(editingItem.value.id, data)
  } else {
    await store.addItem(data)
  }
  showAddModal.value = false
}

async function deleteItem() {
  if (editingItem.value) {
    await store.deleteItem(editingItem.value.id)
    showAddModal.value = false
  }
}

function openCompleteModal(item: MaintenanceItem) {
  completingItem.value = item
  completeForm.value = {
    notes: '',
    cost: null,
    person_id: item.person_id,
    completed_date: new Date().toISOString().split('T')[0],
  }
  showCompleteModal.value = true
}

async function confirmComplete() {
  if (!completingItem.value) return
  await store.completeItem(completingItem.value.id, {
    notes: completeForm.value.notes || undefined,
    cost: completeForm.value.cost,
    person_id: completeForm.value.person_id,
    completed_date: completeForm.value.completed_date,
  })
  showCompleteModal.value = false
}

async function toggleHistory(itemId: number) {
  if (expandedItemId.value === itemId) {
    expandedItemId.value = null
    return
  }
  if (!expandedHistory.value[itemId]) {
    expandedHistory.value[itemId] = await store.fetchHistory(itemId)
  }
  expandedItemId.value = itemId
}

onMounted(async () => {
  await Promise.all([
    store.fetchItems(),
    store.fetchCategories(),
    calendarStore.fetchFamilyMembers(),
  ])
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Home Maintenance</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Track recurring household tasks</p>
      </div>
      <button
        @click="openAddModal"
        class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
      >
        + Add Task
      </button>
    </div>

    <!-- Status Bar -->
    <div class="flex flex-wrap gap-3">
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400">
        <span class="w-2 h-2 rounded-full bg-red-500"></span>
        Overdue: {{ filteredOverdue.length }}
      </div>
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
        <span class="w-2 h-2 rounded-full bg-amber-500"></span>
        Due Soon: {{ filteredUpcomingSoon.length }}
      </div>
      <div class="flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400">
        <span class="w-2 h-2 rounded-full bg-green-500"></span>
        Up to Date: {{ filteredUpToDate.length }}
      </div>
    </div>

    <!-- Filter Bar -->
    <div class="flex flex-wrap gap-3">
      <select
        v-model="filterCategory"
        class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">All Categories</option>
        <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
          {{ cat.icon }} {{ cat.name }}
        </option>
      </select>
      <select
        v-model="filterPerson"
        class="px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">All People</option>
        <option v-for="member in calendarStore.familyMembers" :key="member.id" :value="member.id">
          {{ member.name }}
        </option>
      </select>
    </div>

    <!-- Loading State -->
    <div v-if="store.loading && !store.initialized" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
      <div class="flex flex-col items-center justify-center gap-3">
        <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span class="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
      </div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="store.items.length === 0"
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center"
    >
      <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085" />
      </svg>
      <p class="text-gray-500 dark:text-gray-400 font-medium">No maintenance tasks yet</p>
      <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Add a task to start tracking your home maintenance</p>
    </div>

    <!-- Items grouped by category -->
    <div v-else class="space-y-4">
      <div
        v-for="group in filteredGrouped"
        :key="group.category"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
      >
        <!-- Category Header -->
        <div class="px-4 py-2.5 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
          <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
            {{ group.icon }} {{ group.category }}
          </span>
        </div>

        <!-- Items -->
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="item in group.items" :key="item.id">
            <div class="flex items-start gap-3 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
              <!-- Complete button -->
              <button
                @click.stop="openCompleteModal(item)"
                class="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 transition-colors"
                :class="{
                  'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/50': getDueStatus(item) === 'overdue',
                  'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 hover:bg-amber-200 dark:hover:bg-amber-900/50': getDueStatus(item) === 'soon',
                  'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-900/50': getDueStatus(item) === 'ok' || getDueStatus(item) === 'none',
                }"
                title="Mark complete"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
                </svg>
              </button>

              <!-- Item details -->
              <div class="flex-1 min-w-0 cursor-pointer" @click="openEditModal(item)">
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-gray-900 dark:text-white font-medium">{{ item.title }}</span>
                  <span class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400">
                    {{ frequencyLabel(item.frequency, item.frequency_days) }}
                  </span>
                  <span
                    v-if="item.person_name"
                    class="text-xs px-2 py-0.5 rounded-full text-white"
                    :style="{ backgroundColor: item.person_color || '#6b7280' }"
                  >
                    {{ item.person_name }}
                  </span>
                </div>
                <p v-if="item.description" class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate">
                  {{ item.description }}
                </p>
                <div class="flex items-center gap-4 mt-1 text-xs">
                  <span class="text-gray-400 dark:text-gray-500">
                    Last: {{ formatDate(item.last_completed) }}
                  </span>
                  <span
                    :class="{
                      'text-red-600 dark:text-red-400 font-medium': getDueStatus(item) === 'overdue',
                      'text-amber-600 dark:text-amber-400 font-medium': getDueStatus(item) === 'soon',
                      'text-green-600 dark:text-green-400': getDueStatus(item) === 'ok',
                      'text-gray-400 dark:text-gray-500': getDueStatus(item) === 'none',
                    }"
                  >
                    {{ item.next_due_date ? 'Due: ' + formatDate(item.next_due_date) : 'No due date' }}
                  </span>
                </div>
              </div>

              <!-- History toggle -->
              <button
                @click.stop="toggleHistory(item.id)"
                class="mt-0.5 w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                title="View history"
              >
                <svg
                  class="w-4 h-4 transition-transform"
                  :class="{ 'rotate-180': expandedItemId === item.id }"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
              </button>
            </div>

            <!-- History panel -->
            <div
              v-if="expandedItemId === item.id && expandedHistory[item.id]"
              class="bg-gray-50 dark:bg-gray-900/50 border-t border-gray-100 dark:border-gray-700 px-4 py-3"
            >
              <h4 class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400 mb-2">
                Completion History
              </h4>
              <div v-if="expandedHistory[item.id].length === 0" class="text-sm text-gray-400 dark:text-gray-500">
                No completions recorded yet
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="entry in expandedHistory[item.id]"
                  :key="entry.id"
                  class="flex items-center gap-3 text-sm"
                >
                  <span class="text-gray-600 dark:text-gray-300 font-medium">{{ formatDate(entry.completed_date) }}</span>
                  <span
                    v-if="entry.person_name"
                    class="text-xs px-1.5 py-0.5 rounded-full text-white"
                    :style="{ backgroundColor: entry.person_color || '#6b7280' }"
                  >
                    {{ entry.person_name }}
                  </span>
                  <span v-if="entry.cost" class="text-gray-500 dark:text-gray-400">${{ entry.cost.toFixed(2) }}</span>
                  <span v-if="entry.notes" class="text-gray-400 dark:text-gray-500 truncate">{{ entry.notes }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- No results after filtering -->
      <div
        v-if="filteredGrouped.length === 0 && store.items.length > 0"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center"
      >
        <p class="text-gray-500 dark:text-gray-400">No tasks match the selected filters</p>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <div
      v-if="showAddModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showAddModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ editingItem ? 'Edit Task' : 'Add Task' }}
        </h3>

        <form @submit.prevent="saveItem" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              v-model="itemForm.title"
              type="text"
              required
              placeholder="e.g. Replace HVAC filter"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              v-model="itemForm.description"
              rows="2"
              placeholder="Optional notes..."
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              v-model="itemForm.category_id"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="null">No category</option>
              <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assigned To</label>
            <select
              v-model="itemForm.person_id"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="null">Unassigned</option>
              <option v-for="member in calendarStore.familyMembers" :key="member.id" :value="member.id">
                {{ member.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Frequency</label>
              <select
                v-model="itemForm.frequency"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              >
                <option v-for="f in frequencies" :key="f.value" :value="f.value">{{ f.label }}</option>
              </select>
            </div>
            <div v-if="itemForm.frequency === 'custom'">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Days</label>
              <input
                v-model.number="itemForm.frequency_days"
                type="number"
                min="1"
                placeholder="e.g. 45"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
            <div v-else>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Due</label>
              <input
                v-model="itemForm.next_due_date"
                type="date"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div v-if="itemForm.frequency === 'custom'">
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Next Due Date</label>
            <input
              v-model="itemForm.next_due_date"
              type="date"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div class="flex gap-3 pt-2">
            <button
              v-if="editingItem"
              type="button"
              @click="deleteItem"
              class="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
            <div class="flex-1"></div>
            <button
              type="button"
              @click="showAddModal = false"
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              {{ editingItem ? 'Save' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- Complete Modal -->
    <div
      v-if="showCompleteModal && completingItem"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showCompleteModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          Mark Complete
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ completingItem.title }}</p>

        <form @submit.prevent="confirmComplete" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completed Date</label>
            <input
              v-model="completeForm.completed_date"
              type="date"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Completed By</label>
            <select
              v-model="completeForm.person_id"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="null">Unspecified</option>
              <option v-for="member in calendarStore.familyMembers" :key="member.id" :value="member.id">
                {{ member.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cost (optional)</label>
            <input
              v-model.number="completeForm.cost"
              type="number"
              step="0.01"
              min="0"
              placeholder="0.00"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
            <textarea
              v-model="completeForm.notes"
              rows="2"
              placeholder="Any notes about this completion..."
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div class="flex gap-3 pt-2">
            <div class="flex-1"></div>
            <button
              type="button"
              @click="showCompleteModal = false"
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              Complete
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
