<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useGroceryStore, type GroceryItem } from '@/stores/grocery'

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

const refresh = () => window.location.reload()
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Grocery List</h1>
          <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Keep track of what you need</p>
      </div>

      <button
        v-if="store.checkedItems.length > 0"
        @click="store.clearChecked"
        class="px-4 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-xl font-medium transition-colors"
      >
        Clear Checked ({{ store.checkedItems.length }})
      </button>
    </div>

    <!-- Add Item -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
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
            class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
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
          class="px-6 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </form>
    </div>

    <!-- Items List -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <!-- Loading State -->
      <div v-if="store.loading && !store.initialized" class="p-8">
        <div class="flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
        </div>
      </div>

      <!-- Unchecked Items (grouped by category) -->
      <div v-else-if="store.uncheckedItems.length > 0">
        <div v-for="group in store.groupedUncheckedItems" :key="group.category">
          <div class="px-4 py-2 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
            <span class="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
              {{ group.category }}
            </span>
          </div>
          <div class="divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="item in group.items"
              :key="item.id"
              class="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <button
                @click="store.toggleItem(item.id)"
                class="w-6 h-6 rounded-full border-2 border-gray-300 dark:border-gray-600 hover:border-emerald-500 dark:hover:border-emerald-500 transition-colors flex-shrink-0"
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
      <div v-else-if="store.checkedItems.length === 0" class="p-12 text-center">
        <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <div class="divide-y divide-gray-100 dark:divide-gray-700">
          <div
            v-for="item in store.checkedItems"
            :key="item.id"
            class="flex items-center gap-3 sm:gap-4 px-3 sm:px-4 py-3 sm:py-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors opacity-60"
          >
            <button
              @click="store.toggleItem(item.id)"
              class="w-6 h-6 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0"
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
    <div
      v-if="showEditModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showEditModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Item</h3>

        <form @submit.prevent="saveEdit" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              v-model="editForm.name"
              type="text"
              required
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Quantity</label>
              <input
                v-model.number="editForm.quantity"
                type="number"
                step="any"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                placeholder="1"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Unit</label>
              <input
                v-model="editForm.unit"
                type="text"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                placeholder="lbs, oz, etc."
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              v-model="editForm.category"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option value="">No category</option>
              <option v-for="cat in categories" :key="cat" :value="cat">{{ cat }}</option>
            </select>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="deleteItem"
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
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
