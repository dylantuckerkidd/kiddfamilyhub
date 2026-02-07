<script setup lang="ts">
import { computed } from 'vue'
import { Bar } from 'vue-chartjs'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { useBudgetStore } from '@/stores/budget'
import { useTheme } from '@/composables/useTheme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const props = defineProps<{
  selectedMonth?: string
}>()

const store = useBudgetStore()
const { isDark } = useTheme()

const chartData = computed(() => {
  const days: { date: string; label: string; expenses: number; income: number }[] = []

  if (props.selectedMonth) {
    // Generate all days for the selected month
    const [year, month] = props.selectedMonth.split('-').map(Number)
    const daysInMonth = new Date(year, month, 0).getDate()

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      days.push({ date: dateStr, label: String(day), expenses: 0, income: 0 })
    }
  }

  // Aggregate transactions by day
  for (const t of store.transactions) {
    const day = days.find(d => d.date === t.date)
    if (day) {
      if (t.type === 'expense') {
        day.expenses += t.amount
      } else {
        day.income += t.amount
      }
    }
  }

  return {
    labels: days.map(d => d.label),
    datasets: [
      {
        label: 'Expenses',
        data: days.map(d => d.expenses),
        backgroundColor: isDark.value ? 'rgba(239, 68, 68, 0.7)' : 'rgba(239, 68, 68, 0.8)',
        borderRadius: 4
      },
      {
        label: 'Income',
        data: days.map(d => d.income),
        backgroundColor: isDark.value ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.8)',
        borderRadius: 4
      }
    ]
  }
})

const chartOptions = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      display: true,
      position: 'top' as const,
      align: 'end' as const,
      labels: {
        color: isDark.value ? '#9ca3af' : '#6b7280',
        usePointStyle: true,
        pointStyle: 'circle',
        padding: 16
      }
    },
    tooltip: {
      callbacks: {
        label: (context: any) => {
          const value = context.raw as number
          return ` ${context.dataset.label}: $${value.toFixed(2)}`
        }
      }
    }
  },
  scales: {
    x: {
      grid: {
        display: false
      },
      ticks: {
        color: isDark.value ? '#9ca3af' : '#6b7280',
        maxTicksLimit: 10
      }
    },
    y: {
      grid: {
        color: isDark.value ? 'rgba(75, 85, 99, 0.3)' : 'rgba(229, 231, 235, 1)'
      },
      ticks: {
        color: isDark.value ? '#9ca3af' : '#6b7280',
        callback: (value: any) => `$${value}`
      }
    }
  }
}))
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
    <h3 class="font-semibold text-gray-900 dark:text-white mb-4">Daily Breakdown</h3>

    <div class="h-64">
      <Bar :data="chartData" :options="chartOptions" />
    </div>
  </div>
</template>
