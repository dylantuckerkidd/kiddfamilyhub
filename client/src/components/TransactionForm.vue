<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()

onMounted(() => {
  store.fetchBudgets()
})

const type = ref<'income' | 'expense'>('expense')
const amount = ref('')
const description = ref('')
const category = ref('')

// Get budget categories for dropdown suggestions
const budgetCategories = computed(() => {
  return store.budgets.map(b => b.category)
})

const emit = defineEmits<{
  added: []
}>()

async function handleSubmit() {
  if (!amount.value || !description.value) return

  await store.addTransaction({
    type: type.value,
    amount: parseFloat(amount.value),
    description: description.value,
    category: category.value || 'Uncategorized',
    date: new Date().toISOString().split('T')[0]
  })

  amount.value = ''
  description.value = ''
  category.value = ''
  emit('added')
}
</script>

<template>
  <form @submit.prevent="handleSubmit" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
    <h3 class="font-semibold text-gray-900 dark:text-white mb-5">Add Transaction</h3>

    <div class="flex gap-2 mb-5">
      <button
        type="button"
        @click="type = 'expense'"
        class="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
        :class="type === 'expense'
          ? 'bg-gradient-to-r from-red-500 to-rose-500 text-white shadow-md shadow-red-200 dark:shadow-red-900/30'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
      >
        Expense
      </button>
      <button
        type="button"
        @click="type = 'income'"
        class="flex-1 py-2.5 px-4 rounded-xl text-sm font-semibold transition-all duration-200"
        :class="type === 'income'
          ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-md shadow-emerald-200 dark:shadow-emerald-900/30'
          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'"
      >
        Income
      </button>
    </div>

    <div class="space-y-4">
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Amount</label>
        <div class="relative">
          <span class="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500 font-medium">$</span>
          <input
            v-model="amount"
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            required
            class="w-full pl-8 pr-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Description</label>
        <input
          v-model="description"
          type="text"
          placeholder="What was this for?"
          required
          class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
      </div>
      <div>
        <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Category</label>
        <input
          v-model="category"
          type="text"
          list="budget-categories"
          placeholder="Select or type a category"
          class="w-full px-4 py-3 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent focus:bg-white dark:focus:bg-gray-600 transition-all text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
        />
        <datalist id="budget-categories">
          <option v-for="cat in budgetCategories" :key="cat" :value="cat" />
        </datalist>
        <p v-if="budgetCategories.length > 0" class="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Select from your budgets or type a custom category
        </p>
      </div>
      <button
        type="submit"
        class="w-full py-3 px-4 bg-gradient-to-r from-emerald-500 to-teal-500 text-white rounded-xl hover:from-emerald-600 hover:to-teal-600 transition-all duration-200 font-semibold shadow-md shadow-emerald-200 dark:shadow-emerald-900/30 hover:shadow-lg"
      >
        Add Transaction
      </button>
    </div>
  </form>
</template>
