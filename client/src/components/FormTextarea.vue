<script setup lang="ts">
defineOptions({ inheritAttrs: false })

defineProps<{
  label?: string
  modelValue?: string
}>()

defineEmits<{
  'update:modelValue': [value: string]
}>()
</script>

<template>
  <div>
    <label v-if="label" class="form-label">{{ label }}</label>
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
      v-bind="$attrs"
      class="form-input resize-none"
    />
  </div>
</template>
