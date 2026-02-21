<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  label?: string
  modelValue?: string | number | null
}>()

defineEmits<{
  'update:modelValue': [value: string | number | null]
}>()
</script>

<template>
  <div>
    <label v-if="label" class="form-label">{{ label }}</label>
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      v-bind="$attrs"
      class="form-input"
    />
  </div>
</template>
