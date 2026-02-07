<script setup lang="ts">
import { computed } from 'vue'
import type { Budget } from '@/stores/budget'
import ProgressBar from './ProgressBar.vue'

const props = defineProps<{
  budget: Budget
}>()

const emit = defineEmits<{
  delete: [id: number]
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

const percentage = computed(() => {
  if (props.budget.limit <= 0) return 0
  return Math.round((props.budget.spent / props.budget.limit) * 100)
})

const remaining = computed(() => props.budget.limit - props.budget.spent)

const statusColor = computed(() => {
  if (percentage.value >= 90) return 'text-red-600 dark:text-red-400'
  if (percentage.value >= 75) return 'text-amber-600 dark:text-amber-400'
  return 'text-emerald-600 dark:text-emerald-400'
})
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-5 border border-gray-100 dark:border-gray-700 hover:shadow-md transition-shadow duration-200 group">
    <div class="flex items-start justify-between mb-4">
      <div>
        <h3 class="font-semibold text-gray-900 dark:text-white">{{ budget.category }}</h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
          {{ formatCurrency(budget.spent) }} of {{ formatCurrency(budget.limit) }}
        </p>
      </div>
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold" :class="statusColor">{{ percentage }}%</span>
        <button
          @click="emit('delete', budget.id)"
          class="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all duration-200"
          title="Delete budget"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </div>
    <ProgressBar :spent="budget.spent" :limit="budget.limit" />
    <p class="text-sm mt-3" :class="remaining >= 0 ? 'text-gray-500 dark:text-gray-400' : 'text-red-600 dark:text-red-400 font-medium'">
      <template v-if="remaining >= 0">
        {{ formatCurrency(remaining) }} remaining
      </template>
      <template v-else>
        {{ formatCurrency(Math.abs(remaining)) }} over budget
      </template>
    </p>
  </div>
</template>
