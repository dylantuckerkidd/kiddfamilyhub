<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMaintenanceStore, type MaintenanceItem, type MaintenanceHistoryEntry } from '@/stores/maintenance'
import { useCalendarStore } from '@/stores/calendar'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import FormInput from '@/components/FormInput.vue'
import FormTextarea from '@/components/FormTextarea.vue'
import FormActions from '@/components/FormActions.vue'

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
    <PageHeader title="Home Maintenance" subtitle="Track recurring household tasks">
      <template #actions>
        <button
          @click="openAddModal"
          class="btn-primary"
        >
          + Add Task
        </button>
      </template>
    </PageHeader>

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
    <div v-if="store.loading && !store.initialized" class="card p-8">
      <LoadingSpinner />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="store.items.length === 0"
      class="card p-8 sm:p-12 text-center"
    >
      <svg class="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        class="card overflow-hidden"
      >
        <!-- Category Header -->
        <div class="list-group-header">
          <span class="list-group-label">
            {{ group.icon }} {{ group.category }}
          </span>
        </div>

        <!-- Items -->
        <div class="list-divider">
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
              <h4 class="list-group-label mb-2">
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
        class="card p-8 text-center"
      >
        <p class="text-gray-500 dark:text-gray-400">No tasks match the selected filters</p>
      </div>
    </div>

    <!-- Add/Edit Modal -->
    <BaseModal :show="showAddModal" @close="showAddModal = false">
      <h3 class="modal-title">
        {{ editingItem ? 'Edit Task' : 'Add Task' }}
      </h3>

      <form @submit.prevent="saveItem" class="space-y-4">
        <FormInput v-model="itemForm.title" label="Title" type="text" required placeholder="e.g. Replace HVAC filter" />

        <FormTextarea v-model="itemForm.description" label="Description" rows="2" placeholder="Optional notes..." />

        <div>
          <label class="form-label">Category</label>
          <select
            v-model="itemForm.category_id"
            class="form-input"
          >
            <option :value="null">No category</option>
            <option v-for="cat in store.categories" :key="cat.id" :value="cat.id">
              {{ cat.icon }} {{ cat.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="form-label">Assigned To</label>
          <select
            v-model="itemForm.person_id"
            class="form-input"
          >
            <option :value="null">Unassigned</option>
            <option v-for="member in calendarStore.familyMembers" :key="member.id" :value="member.id">
              {{ member.name }}
            </option>
          </select>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="form-label">Frequency</label>
            <select
              v-model="itemForm.frequency"
              class="form-input"
            >
              <option v-for="f in frequencies" :key="f.value" :value="f.value">{{ f.label }}</option>
            </select>
          </div>
          <div v-if="itemForm.frequency === 'custom'">
            <FormInput v-model.number="itemForm.frequency_days" label="Days" type="number" min="1" placeholder="e.g. 45" />
          </div>
          <div v-else>
            <FormInput v-model="itemForm.next_due_date" label="Next Due" type="date" />
          </div>
        </div>

        <div v-if="itemForm.frequency === 'custom'">
          <FormInput v-model="itemForm.next_due_date" label="Next Due Date" type="date" />
        </div>

        <FormActions>
          <template #left>
            <button
              v-if="editingItem"
              type="button"
              @click="deleteItem"
              class="btn-danger"
            >
              Delete
            </button>
          </template>
          <button
            type="button"
            @click="showAddModal = false"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
          >
            {{ editingItem ? 'Save' : 'Add' }}
          </button>
        </FormActions>
      </form>
    </BaseModal>

    <!-- Complete Modal -->
    <BaseModal :show="showCompleteModal && !!completingItem" @close="showCompleteModal = false">
      <h3 class="modal-title mb-1">
        Mark Complete
      </h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">{{ completingItem?.title }}</p>

      <form @submit.prevent="confirmComplete" class="space-y-4">
        <FormInput v-model="completeForm.completed_date" label="Completed Date" type="date" />

        <div>
          <label class="form-label">Completed By</label>
          <select
            v-model="completeForm.person_id"
            class="form-input"
          >
            <option :value="null">Unspecified</option>
            <option v-for="member in calendarStore.familyMembers" :key="member.id" :value="member.id">
              {{ member.name }}
            </option>
          </select>
        </div>

        <FormInput v-model.number="completeForm.cost" label="Cost (optional)" type="number" step="0.01" min="0" placeholder="0.00" />

        <FormTextarea v-model="completeForm.notes" label="Notes (optional)" rows="2" placeholder="Any notes about this completion..." />

        <FormActions>
          <button
            type="button"
            @click="showCompleteModal = false"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
          >
            Complete
          </button>
        </FormActions>
      </form>
    </BaseModal>
  </div>
</template>
