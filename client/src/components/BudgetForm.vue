<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

const category = ref('')
const limit = ref('')

const emit = defineEmits<{
  added: []
}>()

async function handleSubmit() {
  if (!category.value || !limit.value) return

  await store.addBudget({
    category: category.value,
    limit: parseFloat(limit.value)
  })

  category.value = ''
  limit.value = ''
  emit('added')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
    <h3 class="font-semibold text-gray-900 dark:text-white mb-5">Add Budget</h3>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
        <input
          v-model="category"
          type="text"
          placeholder="e.g., Groceries, Entertainment"
          required
          class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Monthly Limit</label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">$</span>
          <input
            v-model="limit"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
            class="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>
      <button
        type="submit"
        class="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 font-semibold shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 hover:shadow-lg"
      >
        Add Budget
      </button>
    </div>
  </form>
</template>
