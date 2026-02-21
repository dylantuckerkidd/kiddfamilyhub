<script setup lang="ts">
defineProps<{
  show: boolean
  maxWidth?: 'sm' | 'md' | 'lg'
  zIndex?: number
}>()

defineEmits<{
  close: []
}>()

const maxWidthClass: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
}
</script>

<template>
  <div
    v-if="show"
    class="fixed inset-0 bg-black/50 flex items-center justify-center p-4 overflow-y-auto"
    :style="{ zIndex: zIndex ?? 50 }"
    @click.self="$emit('close')"
  >
    <div
      class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full p-6 my-auto max-h-[90vh] overflow-y-auto"
      :class="maxWidthClass[maxWidth ?? 'md']"
    >
      <slot />
    </div>
  </div>
</template>
