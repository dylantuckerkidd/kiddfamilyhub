<script setup lang="ts">
// @ts-nocheck
import { ref } from 'vue'
import type { Transaction } from '@/stores/budget'
import { useBudgetStore } from '@/stores/budget'

const props = defineProps<{
  transaction: Transaction
}>()

const emit = defineEmits<{
  delete: [id: number]
}>()

const store = useBudgetStore()
const isEditing = ref(false)
const editCategory = ref('')

function startEdit() {
  editCategory.value = props.transaction.category
  isEditing.value = true
}

async function saveCategory() {
  if (editCategory.value && editCategory.value !== props.transaction.category) {
    await store.updateTransactionCategory(props.transaction.id, editCategory.value)
  }
  isEditing.value = false
}

function cancelEdit() {
  isEditing.value = false
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD'
  }).format(amount)
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric'
  })
}
</script>

<template>
  <div class="flex items-center gap-4 py-4 group">
    <div
      class="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
      :class="transaction.type === 'income' ? 'bg-emerald-100 dark:bg-emerald-900/50' : 'bg-red-100 dark:bg-red-900/50'"
    >
      <svg
        v-if="transaction.type === 'income'"
        class="w-5 h-5 text-emerald-600 dark:text-emerald-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 11l5-5m0 0l5 5m-5-5v12" />
      </svg>
      <svg
        v-else
        class="w-5 h-5 text-red-600 dark:text-red-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 13l-5 5m0 0l-5-5m5 5V6" />
      </svg>
    </div>
    <div class="flex-1 min-w-0">
      <p class="font-medium text-gray-900 dark:text-white truncate">{{ transaction.description }}</p>
      <div class="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400">
        <template v-if="isEditing">
          <input
            v-model="editCategory"
            type="text"
            class="px-2 py-0.5 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
            @keyup.enter="saveCategory"
            @keyup.escape="cancelEdit"
            autofocus
          />
          <button @click="saveCategory" class="text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 px-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>
          <button @click="cancelEdit" class="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 px-1">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </template>
        <template v-else>
          <button
            @click="startEdit"
            class="hover:text-emerald-600 dark:hover:text-emerald-400 hover:underline transition-colors"
            title="Click to edit category"
          >
            {{ transaction.category }}
          </button>
          <span>·</span>
          <span>{{ formatDate(transaction.date) }}</span>
        </template>
      </div>
    </div>
    <div class="flex items-center gap-3">
      <span
        class="font-semibold tabular-nums"
        :class="transaction.type === 'income' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'"
      >
        {{ transaction.type === 'income' ? '+' : '-' }}{{ formatCurrency(transaction.amount) }}
      </span>
      <button
        @click="emit('delete', transaction.id)"
        class="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 opacity-0 group-hover:opacity-100 transition-all duration-200"
        title="Delete transaction"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      </button>
    </div>
  </div>
</template>
