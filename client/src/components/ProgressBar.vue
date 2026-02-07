<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{
  spent: number
  limit: number
}>()

const percentage = computed(() => {
  if (props.limit <= 0) return 0
  return Math.min((props.spent / props.limit) * 100, 100)
})

const colorClass = computed(() => {
  if (percentage.value >= 90) return 'from-red-400 to-red-500'
  if (percentage.value >= 75) return 'from-amber-400 to-orange-500'
  return 'from-emerald-400 to-teal-500'
})

const bgClass = computed(() => {
  if (percentage.value >= 90) return 'bg-red-100 dark:bg-red-900/30'
  if (percentage.value >= 75) return 'bg-amber-100 dark:bg-amber-900/30'
  return 'bg-emerald-100 dark:bg-emerald-900/30'
})
</script>

<template>
  <div class="w-full rounded-full h-3 overflow-hidden" :class="bgClass">
    <div
      class="h-full rounded-full bg-gradient-to-r transition-all duration-500 ease-out"
      :class="colorClass"
      :style="{ width: `${percentage}%` }"
    />
  </div>
</template>
