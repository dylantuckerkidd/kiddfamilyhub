<script setup lang="ts">
// @ts-nocheck
import { useBudgetStore } from '@/stores/budget'
import EmptyState from './EmptyState.vue'

const store = useBudgetStore()

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="card overflow-hidden">
    <div v-if="store.plaidItems.length > 0" class="list-divider">
      <div
        v-for="item in store.plaidItems"
        :key="item.item_id"
        class="flex items-center justify-between p-4 group"
      >
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/50 flex items-center justify-center">
            <svg class="w-5 h-5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <div>
            <p class="font-medium text-gray-900 dark:text-white">{{ item.institution_name }}</p>
            <p class="text-sm text-gray-500 dark:text-gray-400">Connected {{ formatDate(item.created_at) }}</p>
          </div>
        </div>
        <button
          @click="store.disconnectPlaidItem(item.item_id)"
          class="px-3 py-1.5 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
        >
          Disconnect
        </button>
      </div>
    </div>
    <EmptyState v-else message="No bank accounts connected" />
  </div>
</template>
