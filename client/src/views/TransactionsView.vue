<script setup lang="ts">
// @ts-nocheck
import { computed, onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import TransactionForm from '@/components/TransactionForm.vue'
import TransactionList from '@/components/TransactionList.vue'

const store = useBudgetStore()

const sortedTransactions = computed(() =>
  [...store.transactions].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  )
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
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
        <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
      </div>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Add and manage your transactions</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div>
        <TransactionForm />
      </div>

      <div class="lg:col-span-2">
        <TransactionList
          :transactions="sortedTransactions"
          @delete="store.deleteTransaction"
        />
      </div>
    </div>
  </div>
</template>
