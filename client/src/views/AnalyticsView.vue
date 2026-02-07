<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import SpendingByCategory from '@/components/SpendingByCategory.vue'
import SpendingOverTime from '@/components/SpendingOverTime.vue'

const store = useBudgetStore()

const selectedMonth = ref<string>('')

onMounted(() => {
  store.fetchTransactions()
})

// Get all unique months from transactions, sorted newest first
const availableMonths = computed(() => {
  const monthSet = new Set<string>()

  for (const t of store.transactions) {
    const [year, month] = t.date.split('-')
    monthSet.add(`${year}-${month}`)
  }

  return Array.from(monthSet).sort().reverse()
})

// Auto-select most recent month when data loads
watch(availableMonths, (months) => {
  if (months.length > 0 && !selectedMonth.value) {
    selectedMonth.value = months[0]
  }
}, { immediate: true })

const selectedMonthStats = computed(() => {
  if (!selectedMonth.value) {
    return { income: 0, expenses: 0, net: 0 }
  }

  const [year, month] = selectedMonth.value.split('-')
  const startOfMonth = `${year}-${month}-01`
  const endOfMonth = `${year}-${month}-31`

  const monthTransactions = store.transactions.filter(t => {
    return t.date >= startOfMonth && t.date <= endOfMonth
  })

  const income = monthTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)

  const expenses = monthTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)

  return { income, expenses, net: income - expenses }
})

function formatMonthOption(value: string): string {
  const [year, month] = value.split('-').map(Number)
  const date = new Date(year, month - 1)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// Filter transactions for selected month
const selectedMonthTransactions = computed(() => {
  if (!selectedMonth.value) return []

  const [year, month] = selectedMonth.value.split('-')
  const startOfMonth = `${year}-${month}-01`
  const endOfMonth = `${year}-${month}-31`

  return store.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth)
})

const avgDailySpend = computed(() => {
  const expenseTransactions = selectedMonthTransactions.value.filter(t => t.type === 'expense')
  const uniqueDays = new Set(expenseTransactions.map(t => t.date))
  const dayCount = uniqueDays.size || 1

  const totalExpenses = expenseTransactions.reduce((sum, t) => sum + t.amount, 0)

  return totalExpenses / dayCount
})

const topCategory = computed(() => {
  const expenses = selectedMonthTransactions.value.filter(t => t.type === 'expense')

  const byCategory = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1])

  return sorted[0] ? { name: sorted[0][0], amount: sorted[0][1] } : null
})

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}
</script>

<template>
  <div class="space-y-8">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Analytics</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Visualize your spending patterns</p>
      </div>

      <div v-if="availableMonths.length > 0">
        <select
          v-model="selectedMonth"
          class="px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
        >
          <option v-for="month in availableMonths" :key="month" :value="month">
            {{ formatMonthOption(month) }}
          </option>
        </select>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <!-- Monthly Income -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center">
            <svg class="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Income</p>
            <p class="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{{ formatCurrency(selectedMonthStats.income) }}</p>
          </div>
        </div>
      </div>

      <!-- Monthly Expenses -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/50 flex items-center justify-center">
            <svg class="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Expenses</p>
            <p class="text-2xl font-bold text-red-600 dark:text-red-400">{{ formatCurrency(selectedMonthStats.expenses) }}</p>
          </div>
        </div>
      </div>

      <!-- Monthly Net -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-xl flex items-center justify-center"
            :class="selectedMonthStats.net >= 0 ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'"
          >
            <svg
              class="w-6 h-6"
              :class="selectedMonthStats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Net</p>
            <p
              class="text-2xl font-bold"
              :class="selectedMonthStats.net >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
            >
              {{ selectedMonthStats.net >= 0 ? '+' : '' }}{{ formatCurrency(selectedMonthStats.net) }}
            </p>
          </div>
        </div>
      </div>

      <!-- Avg Daily Spend -->
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700">
        <div class="flex items-center gap-4">
          <div class="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/50 flex items-center justify-center">
            <svg class="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <p class="text-sm font-medium text-gray-500 dark:text-gray-400">Avg Daily Spend</p>
            <p class="text-2xl font-bold text-gray-900 dark:text-white">{{ formatCurrency(avgDailySpend) }}</p>
          </div>
        </div>
      </div>
    </div>

    <div v-if="topCategory" class="bg-gradient-to-r from-purple-500 to-indigo-500 rounded-2xl p-6 text-white">
      <p class="text-purple-100 text-sm">Top spending category</p>
      <p class="text-2xl font-bold mt-1">{{ topCategory.name }}</p>
      <p class="text-purple-100 mt-1">{{ formatCurrency(topCategory.amount) }} total spent</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <SpendingByCategory :selected-month="selectedMonth" />
      <SpendingOverTime :selected-month="selectedMonth" />
    </div>
  </div>
</template>
