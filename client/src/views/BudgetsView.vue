<script setup lang="ts">
// @ts-nocheck
import { onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import BudgetForm from '@/components/BudgetForm.vue'
import BudgetCard from '@/components/BudgetCard.vue'
import EmptyState from '@/components/EmptyState.vue'

const store = useBudgetStore()

onMounted(() => {
  store.fetchBudgets()
})

const refresh = () => window.location.reload()
</script>

<template>
  <div class="space-y-8">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
        <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
      </div>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Set spending limits for different categories</p>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div>
        <BudgetForm />
      </div>

      <div class="lg:col-span-2">
        <div v-if="store.budgets.length > 0" class="grid gap-4">
          <BudgetCard
            v-for="budget in store.budgets"
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
  </div>
</template>
