<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useBudgetStore } from '@/stores/budget'
import PlaidLink from '@/components/PlaidLink.vue'
import ConnectedAccounts from '@/components/ConnectedAccounts.vue'
import CategoryMappings from '@/components/CategoryMappings.vue'

const store = useBudgetStore()
const syncMessage = ref('')

onMounted(() => {
  store.fetchPlaidItems()
  store.fetchBudgets()
})

async function handleSync() {
  const synced = await store.syncTransactions()
  syncMessage.value = `Synced ${synced} new transaction${synced !== 1 ? 's' : ''}`
  setTimeout(() => {
    syncMessage.value = ''
  }, 3000)
}
</script>

<template>
  <div class="space-y-8">
    <div>
      <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
      <p class="text-gray-500 dark:text-gray-400 mt-1">Manage your connected accounts</p>
    </div>

    <div class="space-y-6">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-100 dark:border-gray-700">
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-2">Bank Connections</h2>
        <p class="text-gray-500 dark:text-gray-400 text-sm mb-4">
          Connect your bank accounts to automatically import transactions.
          Using Plaid sandbox for testing.
        </p>

        <div class="flex flex-wrap items-center gap-3">
          <PlaidLink />

          <button
            v-if="store.plaidItems.length > 0"
            @click="handleSync"
            :disabled="store.isSyncing"
            class="inline-flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all duration-200 font-medium disabled:opacity-50"
          >
            <svg
              class="w-5 h-5"
              :class="{ 'animate-spin': store.isSyncing }"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            <span v-if="store.isSyncing">Syncing...</span>
            <span v-else>Sync Transactions</span>
          </button>
        </div>

        <p v-if="syncMessage" class="mt-3 text-sm text-emerald-600 dark:text-emerald-400 font-medium">
          {{ syncMessage }}
        </p>

        <div class="mt-4 p-3 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
          <p class="text-sm text-amber-800 dark:text-amber-200">
            <strong>Sandbox Mode:</strong> Use credentials <code class="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">user_good</code> / <code class="bg-amber-100 dark:bg-amber-800/50 px-1 rounded">pass_good</code> to test.
          </p>
        </div>
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Connected Accounts</h2>
        <ConnectedAccounts />
      </div>

      <div>
        <h2 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Category Mappings</h2>
        <CategoryMappings />
      </div>
    </div>
  </div>
</template>
