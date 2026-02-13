<script setup lang="ts">
import { ref, computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SideNav from './components/SideNav.vue'

const route = useRoute()

const isLoginRoute = computed(() => route.path === '/login')
const mobileNavOpen = ref(false)
</script>

<template>
  <!-- Login: no chrome -->
  <RouterView v-if="isLoginRoute" />

  <!-- App: full layout -->
  <div v-else class="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
    <SideNav v-model:mobileOpen="mobileNavOpen" />

    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- Mobile header with hamburger -->
      <div class="flex items-center gap-3 px-4 py-3 md:hidden bg-white/80 dark:bg-gray-800/80 backdrop-blur border-b border-gray-200 dark:border-gray-700">
        <button
          @click="mobileNavOpen = true"
          class="p-1.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
        <span class="font-bold text-gray-900 dark:text-white">Family Hub</span>
      </div>

      <main class="flex-1 overflow-auto">
        <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
