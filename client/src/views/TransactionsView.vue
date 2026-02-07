<script setup lang="ts">
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
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Transactions</h1>
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
