<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const auth = useAuthStore()
const router = useRouter()

const isSignUp = ref(false)
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)
const signUpSuccess = ref(false)

async function handleSubmit() {
  error.value = ''
  loading.value = true
  try {
    if (isSignUp.value) {
      const result = await auth.signUp(email.value, password.value)
      if (result.success) {
        signUpSuccess.value = true
      } else {
        error.value = result.error || 'Sign up failed'
      }
    } else {
      const result = await auth.login(email.value, password.value)
      if (result.success) {
        router.push('/')
      } else {
        error.value = result.error || 'Invalid credentials'
      }
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
          Family Hub
        </h1>
        <p class="text-sm text-center text-gray-500 dark:text-gray-400 mb-6">
          {{ isSignUp ? 'Create your account' : 'Sign in to continue' }}
        </p>

        <!-- Sign Up Success -->
        <div v-if="signUpSuccess" class="text-center space-y-3">
          <div class="p-3 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 rounded-lg text-sm">
            Check your email to confirm your account, then sign in.
          </div>
          <button
            @click="signUpSuccess = false; isSignUp = false"
            class="text-sm text-emerald-600 dark:text-emerald-400 hover:underline"
          >
            Back to Sign In
          </button>
        </div>

        <template v-else>
          <!-- OAuth Buttons -->
          <div class="space-y-3 mb-6">
            <button
              @click="auth.signInWithGoogle()"
              class="w-full flex items-center justify-center gap-3 py-3 px-4 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-200 font-medium"
            >
              <svg class="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>
            <!-- TODO: Enable once Apple Developer account is set up -->
            <!-- <button
              @click="auth.signInWithApple()"
              class="w-full flex items-center justify-center gap-3 py-3 px-4 bg-black dark:bg-white rounded-lg hover:opacity-90 transition-opacity text-white dark:text-black font-medium"
            >
              <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
              </svg>
              Continue with Apple
            </button> -->
          </div>

          <!-- Divider -->
          <div class="relative mb-6">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-300 dark:border-gray-600"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">or</span>
            </div>
          </div>

          <!-- Email/Password Form -->
          <form @submit.prevent="handleSubmit" class="space-y-4">
            <div>
              <input
                v-model="email"
                type="email"
                placeholder="Email"
                autocomplete="email"
                required
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                :disabled="loading"
              />
            </div>

            <div>
              <input
                v-model="password"
                type="password"
                placeholder="Password"
                autocomplete="current-password"
                required
                minlength="6"
                class="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                :disabled="loading"
              />
            </div>

            <div v-if="error" class="text-sm text-red-500 dark:text-red-400 text-center">
              {{ error }}
            </div>

            <button
              type="submit"
              :disabled="!email || !password || loading"
              class="w-full py-3 px-4 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              <span v-if="loading">{{ isSignUp ? 'Creating account...' : 'Signing in...' }}</span>
              <span v-else>{{ isSignUp ? 'Create Account' : 'Sign In' }}</span>
            </button>
          </form>

          <!-- Toggle Sign Up / Sign In -->
          <p class="text-center text-sm text-gray-500 dark:text-gray-400 mt-4">
            <template v-if="isSignUp">
              Already have an account?
              <button @click="isSignUp = false; error = ''" class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">Sign In</button>
            </template>
            <template v-else>
              Don't have an account?
              <button @click="isSignUp = true; error = ''" class="text-emerald-600 dark:text-emerald-400 hover:underline font-medium">Sign Up</button>
            </template>
          </p>
        </template>
      </div>
    </div>
  </div>
</template>
