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
  <div class="card overflow-hidden">
    <div v-if="transactions.length > 0" class="list-divider px-5">
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
