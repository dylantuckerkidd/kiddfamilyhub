<script setup lang="ts">
import RefreshButton from '@/components/RefreshButton.vue'

defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
    <div>
      <div class="flex items-center gap-2">
        <h1 class="text-2xl font-bold text-gray-900 dark:text-white">{{ title }}</h1>
        <RefreshButton />
      </div>
      <p v-if="subtitle" class="text-gray-500 dark:text-gray-400 mt-1">{{ subtitle }}</p>
    </div>
    <slot name="actions" />
  </div>
</template>
