<script setup lang="ts">
defineProps<{
  message?: string
}>()
</script>

<template>
  <div class="flex flex-col items-center justify-center gap-3">
    <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
    <span class="text-gray-500 dark:text-gray-400 text-sm">{{ message ?? 'Loading...' }}</span>
  </div>
</template>
