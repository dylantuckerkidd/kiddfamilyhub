<script setup lang="ts">
// @ts-nocheck
import { ref, onMounted } from 'vue'
import { useBudgetStore } from '@/stores/budget'

const store = useBudgetStore()
const isLoading = ref(false)
const isScriptLoaded = ref(false)
const error = ref('')

onMounted(() => {
  if (!(window as any).Plaid) {
    const script = document.createElement('script')
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js'
    script.onload = () => {
      isScriptLoaded.value = true
    }
    document.head.appendChild(script)
  } else {
    isScriptLoaded.value = true
  }
})

async function connectBank() {
  if (!isScriptLoaded.value) {
    error.value = 'Plaid is still loading, please try again'
    return
  }

  isLoading.value = true
  error.value = ''

  try {
    const linkToken = await store.createLinkToken()

    if (!linkToken) {
      throw new Error('Failed to get link token')
    }

    const handler = (window as any).Plaid.create({
      token: linkToken,
      onSuccess: async (publicToken: string, metadata: any) => {
        isLoading.value = true
        try {
          await store.exchangePlaidToken(publicToken, metadata.institution)
        } finally {
          isLoading.value = false
        }
      },
      onExit: (err: any) => {
        if (err) {
          error.value = err.display_message || 'Connection cancelled'
        }
        isLoading.value = false
      },
    })

    handler.open()
  } catch (e: any) {
    console.error('Plaid error:', e)
    error.value = e.message || 'Failed to initialize bank connection'
    isLoading.value = false
  }
}
</script>

<template>
  <button
    @click="connectBank"
    :disabled="isLoading || !isScriptLoaded"
    class="inline-flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-xl hover:from-indigo-600 hover:to-purple-600 transition-all duration-200 font-semibold shadow-md shadow-indigo-200 dark:shadow-indigo-900/30 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
    </svg>
    <span v-if="isLoading">Connecting...</span>
    <span v-else-if="!isScriptLoaded">Loading...</span>
    <span v-else>Connect Bank Account</span>
  </button>
  <p v-if="error" class="mt-2 text-sm text-red-600 dark:text-red-400">{{ error }}</p>
</template>
