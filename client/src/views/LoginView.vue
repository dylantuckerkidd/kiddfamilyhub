<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const pin = ref('')
const error = ref('')
const loading = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    const result = await auth.login(pin.value)
    if (result.success) {
      router.push('/')
    } else {
      error.value = result.error || 'Invalid PIN'
      pin.value = ''
    }
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 px-4">
    <div class="w-full max-w-sm">
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
        <!-- Logo -->
        <div class="flex justify-center mb-6">
          <div class="w-14 h-14 rounded-xl bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center">
            <svg class="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
            </svg>
          </div>
        </div>

        <h1 class="text-xl font-bold text-center text-gray-900 dark:text-white mb-1">
          Kidd Family Hub
        </h1>
        <p class="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
          Enter your PIN to continue
        </p>

        <form @submit.prevent="handleSubmit" class="space-y-4">
          <div>
            <input
              v-model="pin"
              type="password"
              inputmode="numeric"
              placeholder="PIN"
              autocomplete="current-password"
              class="w-full px-4 py-3 text-center text-lg tracking-widest rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
              :disabled="loading"
            />
          </div>

          <div v-if="error" class="text-sm text-red-500 dark:text-red-400 text-center">
            {{ error }}
          </div>

          <button
            type="submit"
            :disabled="!pin || loading"
            class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
          >
            <span v-if="loading">Verifying...</span>
            <span v-else>Unlock</span>
          </button>
        </form>
      </div>
    </div>
  </div>
</template>
