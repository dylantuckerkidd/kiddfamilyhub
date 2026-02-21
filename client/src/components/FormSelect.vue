<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  label?: string
  modelValue?: string | number | boolean | null
}>()

defineEmits<{
  'update:modelValue': [value: any]
}>()
</script>

<template>
  <div>
    <label v-if="label" class="form-label">{{ label }}</label>
    <select
      :value="modelValue"
      @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
      v-bind="$attrs"
      class="form-input"
    >
      <slot />
    </select>
  </div>
</template>
