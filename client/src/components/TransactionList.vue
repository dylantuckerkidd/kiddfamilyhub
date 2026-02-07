<script setup lang="ts">
import type { Transaction } from '@/stores/budget'
import TransactionItem from './TransactionItem.vue'
import EmptyState from './EmptyState.vue'

defineProps<{
  transactions: Transaction[]
}>()

const emit = defineEmits<{
  delete: [id: number]
}>()
</script>

<template>
  <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
    <div v-if="transactions.length > 0" class="divide-y divide-gray-100 dark:divide-gray-700 px-5">
      <TransactionItem
        v-for="transaction in transactions"
        :key="transaction.id"
        :transaction="transaction"
        @delete="emit('delete', $event)"
      />
    </div>
    <EmptyState v-else message="No transactions yet" />
  </div>
</template>
