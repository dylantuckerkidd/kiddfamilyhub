<script setup lang="ts">
// @ts-nocheck
import { onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import BudgetForm from '@/components/BudgetForm.vue'
import BudgetCard from '@/components/BudgetCard.vue'
import EmptyState from '@/components/EmptyState.vue'
import PageHeader from '@/components/PageHeader.vue'

const store = useBudgetStore()

onMounted(() => {
  store.fetchBudgets()
})
</script>

<template>
  <div class="space-y-8">
    <PageHeader title="Budgets" subtitle="Set spending limits for different categories" />

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
        <div v-else class="card">
          <EmptyState message="No budgets set up yet" />
        </div>
      </div>
    </div>
  </div>
</template>
