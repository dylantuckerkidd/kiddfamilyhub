<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
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
        <div v-else class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
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
