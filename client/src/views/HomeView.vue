<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import StatCard from '@/components/StatCard.vue'
import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'
import BudgetCard from '@/components/BudgetCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useBudgetStore()

const income = computed(() =>
  store.transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0)
)

const expenses = computed(() =>
  store.transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
)

const balance = computed(() => income.value - expenses.value)

const recentTransactions = computed(() =>
  [...store.transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5)
)

const topBudgets = computed(() =>
  [...store.budgets]
    .sort((a, b) => (b.spent / b.limit) - (a.spent / a.limit))
    .slice(0, 3)
)

onMounted(() => {
  store.fetchTransactions()
  store.fetchBudgets()
})

const refresh = () => window.location.reload()
</script>

<template>
  <div class="space-y-8">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
        <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
      </div>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Track your income, expenses, and budgets</p>
    </div>

    <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
      <StatCard label="Income" :value="income" type="income" />
      <StatCard label="Expenses" :value="expenses" type="expense" />
      <StatCard label="Balance" :value="balance" type="balance" />
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <div>
        <TransactionForm />
      </div>

      <div class="space-y-4">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Top Budgets</h2>
          <RouterLink
            to="/budgets"
            class="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
          >
            View all
          </RouterLink>
        </div>
        <div v-if="topBudgets.length > 0" class="space-y-4">
          <BudgetCard
            v-for="budget in topBudgets"
            :key="budget.id"
            :budget="budget"
            @delete="store.deleteBudget"
          />
        </div>
        <div v-else class="card">
          <EmptyState message="No budgets set up yet" />
        </div>
      </div>
    </div>

    <div>
      <div class="flex items-center justify-between mb-4">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white">Recent Transactions</h2>
        <RouterLink
          to="/transactions"
          class="text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 transition-colors"
        >
          View all
        </RouterLink>
      </div>
      <TransactionList
        :transactions="recentTransactions"
        @delete="store.deleteTransaction"
      />
    </div>
  </div>
</template>
