<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Doughnut } from 'vue-chartjs'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'
import { useBudgetStore } from '@/stores/budget'
import { useTheme } from '@/composables/useTheme'

ChartJS.register(ArcElement, Tooltip, Legend)

const props = defineProps<{
  selectedMonth?: string
}>()

const store = useBudgetStore()
const { isDark } = useTheme()

const chartKey = ref(0)

// Force re-render when theme or month changes
watch([isDark, () => props.selectedMonth], () => {
  chartKey.value++
})

// Filter transactions by selected month
const filteredTransactions = computed(() => {
  if (!props.selectedMonth) return store.transactions

  const [year, month] = props.selectedMonth.split('-')
  const startOfMonth = `${year}-${month}-01`
  const endOfMonth = `${year}-${month}-31`

  return store.transactions.filter(t => t.date >= startOfMonth && t.date <= endOfMonth)
})

const categoryColors = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

const categoryData = computed(() => {
  const expenses = filteredTransactions.value.filter(t => t.type === 'expense')

  const byCategory = expenses.reduce((acc, t) => {
    acc[t.category] = (acc[t.category] || 0) + t.amount
    return acc
  }, {} as Record<string, number>)

  return Object.entries(byCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
})

const chartData = computed(() => ({
  labels: categoryData.value.map(([cat]) => cat),
  datasets: [{
    data: categoryData.value.map(([, amount]) => amount),
    backgroundColor: categoryColors.slice(0, categoryData.value.length),
    borderColor: isDark.value ? '#1f2937' : '#ffffff',
    borderWidth: 2
  }]
}))

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: false
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          return ` $${value.toFixed(2)}`
        }
      }
    }
  },
  cutout: '65%'
}))

const totalExpenses = computed(() =>
  filteredTransactions.value
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0)
)

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(amount)
}
</script>

<template>
  <div class="card p-6">
    <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Spending by Category</h3>

    <div v-if="categoryData.length > 0" class="flex flex-col gap-4">
      <div class="relative h-48 w-48 mx-auto">
        <Doughnut :key="chartKey" :data="chartData" :options="chartOptions" />
        <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div class="text-center">
            <p class="text-xs text-gray-500 dark:text-gray-400">Total</p>
            <p class="text-lg font-bold text-gray-900 dark:text-white">{{ formatCurrency(totalExpenses) }}</p>
          </div>
        </div>
      </div>

      <div class="grid grid-cols-2 gap-2">
        <div
          v-for="([category, amount], index) in categoryData"
          :key="category"
          class="flex items-center gap-2 text-sm"
        >
          <span
            class="color-dot--lg"
            :style="{ backgroundColor: categoryColors[index] }"
          ></span>
          <span class="text-gray-600 dark:text-gray-400 truncate flex-1">{{ category }}</span>
          <span class="text-gray-900 dark:text-white font-medium">${{ amount.toFixed(0) }}</span>
        </div>
      </div>
    </div>

    <div v-else class="h-64 flex items-center justify-center text-gray-500 dark:text-gray-400">
      No expense data to display
    </div>
  </div>
</template>
