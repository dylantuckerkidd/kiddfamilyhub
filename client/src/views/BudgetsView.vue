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
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Budgets</h1>
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
