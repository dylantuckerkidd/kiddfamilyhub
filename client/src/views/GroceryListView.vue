<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroceryStore, type GroceryItem } from '@/stores/grocery'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import FormInput from '@/components/FormInput.vue'
import FormActions from '@/components/FormActions.vue'

const store = useGroceryStore()

const newItemName = ref('')
const suggestions = ref<{ name: string; category: string | null }[]>([])
const showSuggestions = ref(false)
const selectedSuggestionIndex = ref(-1)
const pendingCategory = ref<string | null>(null)
const editingItem = ref<GroceryItem | null>(null)
const showEditModal = ref(false)

const editForm = ref({
  name: '',
  quantity: null as number | null,
  unit: '',
  category: ''
})

const categories = [
  'Produce',
  'Dairy',
  'Meat',
  'Bakery',
  'Frozen',
  'Pantry',
  'Beverages',
  'Snacks',
  'Household',
  'Other'
]

let debounceTimer: ReturnType<typeof setTimeout> | null = null

async function onInput() {
  selectedSuggestionIndex.value = -1
  pendingCategory.value = null
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(async () => {
    if (newItemName.value.trim().length > 0) {
      suggestions.value = await store.fetchSuggestions(newItemName.value)
      showSuggestions.value = suggestions.value.length > 0
    } else {
      suggestions.value = []
      showSuggestions.value = false
    }
  }, 150)
}

function hideSuggestionsDelayed() {
  setTimeout(() => { showSuggestions.value = false }, 150)
}

function selectSuggestion(suggestion: { name: string; category: string | null }) {
  newItemName.value = suggestion.name
  pendingCategory.value = suggestion.category
  showSuggestions.value = false
  selectedSuggestionIndex.value = -1
}

function onKeydown(e: KeyboardEvent) {
  if (!showSuggestions.value || suggestions.value.length === 0) return

  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.min(selectedSuggestionIndex.value + 1, suggestions.value.length - 1)
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedSuggestionIndex.value = Math.max(selectedSuggestionIndex.value - 1, -1)
  } else if (e.key === 'Enter' && selectedSuggestionIndex.value >= 0) {
    e.preventDefault()
    selectSuggestion(suggestions.value[selectedSuggestionIndex.value])
  } else if (e.key === 'Escape') {
    showSuggestions.value = false
  }
}

async function addItem() {
  if (!newItemName.value.trim()) return

  showSuggestions.value = false
  await store.addItem({
    name: newItemName.value.trim(),
    category: pendingCategory.value
  })
  newItemName.value = ''
  pendingCategory.value = null
}

function openEditModal(item: GroceryItem) {
  editingItem.value = item
  editForm.value = {
    name: item.name,
    quantity: item.quantity,
    unit: item.unit || '',
    category: item.category || ''
  }
  showEditModal.value = true
}

async function saveEdit() {
  if (!editingItem.value || !editForm.value.name.trim()) return

  await store.updateItem(editingItem.value.id, {
    name: editForm.value.name.trim(),
    quantity: editForm.value.quantity,
    unit: editForm.value.unit || null,
    category: editForm.value.category || null
  })

  showEditModal.value = false
}

async function deleteItem() {
  if (editingItem.value) {
    await store.deleteItem(editingItem.value.id)
    showEditModal.value = false
  }
}

onMounted(() => {
  store.fetchItems()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <PageHeader title="Grocery List" subtitle="Keep track of what you need">
      <template #actions>
        <button
          v-if="store.checkedItems.length > 0"
          @click="store.clearChecked"
          class="btn-secondary"
        >
          Clear Checked ({{ store.checkedItems.length }})
        </button>
      </template>
    </PageHeader>

    <!-- Add Item -->
    <div class="card p-4">
      <form @submit.prevent="addItem" class="flex gap-3">
        <div class="flex-1 relative">
          <input
            v-model="newItemName"
            @input="onInput"
            @keydown="onKeydown"
            @focus="onInput"
            @blur="hideSuggestionsDelayed"
            type="text"
            placeholder="Add an item..."
            autocomplete="off"
            class="form-input"
          />
          <ul
            v-if="showSuggestions && suggestions.length > 0"
            class="absolute z-10 left-0 right-0 mt-1 bg-white dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl shadow-lg overflow-hidden"
          >
            <li
              v-for="(suggestion, index) in suggestions"
              :key="suggestion.name"
              @mousedown.prevent="selectSuggestion(suggestion)"
              :class="[
                'px-4 py-2.5 cursor-pointer flex items-center justify-between transition-colors',
                index === selectedSuggestionIndex
                  ? 'bg-emerald-50 dark:bg-emerald-900/30'
                  : 'hover:bg-gray-50 dark:hover:bg-gray-600'
              ]"
            >
              <span class="text-gray-900 dark:text-white">{{ suggestion.name }}</span>
              <span
                v-if="suggestion.category"
                class="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              >
                {{ suggestion.category }}
              </span>
            </li>
          </ul>
        </div>
        <button
          type="submit"
          :disabled="!newItemName.trim()"
          class="btn-primary px-6"
        >
          Add
        </button>
      </form>
    </div>

    <!-- Items List -->
    <div class="card overflow-hidden">
      <!-- Loading State -->
      <div v-if="store.loading && !store.initialized" class="p-8">
        <LoadingSpinner />
      </div>

      <!-- Unchecked Items (grouped by category) -->
      <div v-else-if="store.uncheckedItems.length > 0">
        <div v-for="group in store.groupedUncheckedItems" :key="group.category">
          <div class="list-group-header">
            <span class="list-group-label">
              {{ group.category }}
            </span>
          </div>
          <div class="list-divider">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <button
                @click="store.toggleItem(item.id)"
                class="w-8 h-8 sm:w-6 sm:h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex-shrink-0"
              ></button>

              <div class="flex-1 min-w-0" @click="openEditModal(item)">
                <div class="flex items-center gap-2 cursor-pointer">
                  <span class="text-gray-900 dark:text-white font-medium">{{ item.name }}</span>
                  <span v-if="item.quantity" class="text-gray-500 dark:text-gray-400 text-sm">
                    {{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else-if="store.checkedItems.length === 0" class="p-8 sm:p-12 text-center">
        <svg class="w-12 h-12 sm:w-16 sm:h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400">Your grocery list is empty</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Add items above to get started</p>
      </div>

      <!-- Checked Items -->
      <div v-if="store.checkedItems.length > 0">
        <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-t border-gray-100 dark:border-gray-700">
          <span class="text-sm font-medium text-gray-500 dark:text-gray-400">
            Checked ({{ store.checkedItems.length }})
          </span>
        </div>
        <div class="list-divider">
          <div
            v-for="item in store.checkedItems"
            :key="item.id"
            class="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60"
          >
            <button
              @click="store.toggleItem(item.id)"
              class="w-8 h-8 sm:w-6 sm:h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"
            >
              <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </button>

            <div class="flex-1 min-w-0" @click="openEditModal(item)">
              <div class="flex items-center gap-2 cursor-pointer">
                <span class="text-gray-500 dark:text-gray-400 line-through">{{ item.name }}</span>
                <span v-if="item.quantity" class="text-gray-400 dark:text-gray-500 text-sm line-through">
                  {{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Edit Modal -->
    <BaseModal :show="showEditModal" @close="showEditModal = false">
      <h3 class="modal-title">Edit Item</h3>

      <form @submit.prevent="saveEdit" class="space-y-4">
        <FormInput v-model="editForm.name" label="Name" type="text" required />

        <div class="grid grid-cols-2 gap-3">
          <FormInput v-model.number="editForm.quantity" label="Quantity" type="number" step="any" placeholder="1" />
          <FormInput v-model="editForm.unit" label="Unit" type="text" placeholder="lbs, oz, etc." />
        </div>

        <div>
          <label class="form-label">Category</label>
          <select
            v-model="editForm.category"
            class="form-input"
          >
            <option value="">No category</option>
            <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
          </select>
        </div>

        <FormActions>
          <template #left>
            <button
              type="button"
              @click="deleteItem"
              class="btn-danger"
            >
              Delete
            </button>
          </template>
          <button
            type="button"
            @click="showEditModal = false"
            class="btn-secondary"
          >
            Cancel
          </button>
          <button
            type="submit"
            class="btn-primary"
          >
            Save
          </button>
        </FormActions>
      </form>
    </BaseModal>
  </div>
</template>
