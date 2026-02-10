<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const selectedPlaidCategory = ref('')
const selectedBudgetCategory = ref('')

onMounted(() => {
  store.fetchCategoryMappings()
  store.fetchPlaidCategories()
})

async function addMapping() {
  if (!selectedPlaidCategory.value || !selectedBudgetCategory.value) return

  await store.addCategoryMapping(selectedPlaidCategory.value, selectedBudgetCategory.value)
  selectedPlaidCategory.value = ''
  selectedBudgetCategory.value = ''
}

const budgetCategories = () => store.budgets.map(b => b.category)

const unmappedPlaidCategories = () =>
  store.plaidCategories.filter(
    pc => !store.categoryMappings.some(m => m.plaid_category === pc)
  )
</script>

<template>
  <div class="space-y-4">
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
      <h3 class="font-semibold text-gray-900 dark:text-white mb-2">Category Mappings</h3>
      <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
        Map Plaid categories to your budget categories so imported transactions match your budgets.
      </p>

      <div v-if="unmappedPlaidCategories().length > 0 || store.categoryMappings.length === 0" class="flex flex-wrap gap-2 mb-4">
        <select
          v-model="selectedPlaidCategory"
          class="flex-1 min-w-[150px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Select Plaid category...</option>
          <option v-for="cat in unmappedPlaidCategories()" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>

        <span class="flex items-center text-gray-400 dark:text-gray-500">→</span>

        <select
          v-model="selectedBudgetCategory"
          class="flex-1 min-w-[150px] px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm text-gray-900 dark:text-white"
        >
          <option value="">Select budget category...</option>
          <option v-for="cat in budgetCategories()" :key="cat" :value="cat">
            {{ cat }}
          </option>
        </select>

        <button
          @click="addMapping"
          :disabled="!selectedPlaidCategory || !selectedBudgetCategory"
          class="px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 transition-colors text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Add
        </button>
      </div>

      <div v-if="store.plaidCategories.length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
        Sync transactions first to see available Plaid categories.
      </div>

      <div v-if="budgetCategories().length === 0" class="text-sm text-gray-500 dark:text-gray-400 italic">
        Create some budgets first to map categories.
      </div>
    </div>

    <div v-if="store.categoryMappings.length > 0" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <div class="px-4 py-3 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-100 dark:border-gray-700">
        <h4 class="text-sm font-medium text-gray-700 dark:text-gray-300">Current Mappings</h4>
      </div>
      <div class="divide-y divide-gray-100 dark:divide-gray-700">
        <div
          v-for="mapping in store.categoryMappings"
          :key="mapping.id"
          class="flex items-center justify-between px-4 py-3 group"
        >
          <div class="flex items-center gap-2 text-sm">
            <span class="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-gray-700 dark:text-gray-300 font-mono text-xs">
              {{ mapping.plaid_category }}
            </span>
            <span class="text-gray-400 dark:text-gray-500">→</span>
            <span class="font-medium text-gray-900 dark:text-white">{{ mapping.budget_category }}</span>
          </div>
          <button
            @click="store.deleteCategoryMapping(mapping.id)"
            class="text-gray-300 dark:text-gray-600 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
