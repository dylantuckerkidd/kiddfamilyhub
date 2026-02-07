<script setup lang="ts">
defineProps<{
  label: string
  value: number
  type?: 'income' | 'expense' | 'balance'
}>()

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

const iconBg = {
  income: 'bg-emerald-100 dark:bg-emerald-900/50',
  expense: 'bg-red-100 dark:bg-red-900/50',
  balance: 'bg-blue-100 dark:bg-blue-900/50'
}

const iconColor = {
  income: 'text-emerald-600 dark:text-emerald-400',
  expense: 'text-red-600 dark:text-red-400',
  balance: 'text-blue-600 dark:text-blue-400'
}

const valueColor = {
  income: 'text-emerald-600 dark:text-emerald-400',
  expense: 'text-red-600 dark:text-red-400',
  balance: 'text-gray-900 dark:text-white'
}
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm hover:shadow-md transition-all duration-200 p-5 border border-gray-100 dark:border-gray-700">
    <div class="flex items-center gap-4">
      <div
        class="w-12 h-12 rounded-xl flex items-center justify-center"
        :class="iconBg[type || 'balance']"
      >
        <svg v-if="type === 'income'" class="w-6 h-6" :class="iconColor[type]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
        </svg>
        <svg v-else-if="type === 'expense'" class="w-6 h-6" :class="iconColor[type]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
        </svg>
        <svg v-else class="w-6 h-6" :class="iconColor[type || 'balance']" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div>
        <p class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ label }}</p>
        <p class="text-2xl font-bold" :class="valueColor[type || 'balance']">
          {{ formatCurrency(value) }}
        </p>
      </div>
    </div>
  </div>
</template>
