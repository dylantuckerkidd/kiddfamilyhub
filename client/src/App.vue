<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import SideNav from './components/SideNav.vue'
import NavBar from './components/NavBar.vue'

const route = useRoute()

const isBudgetRoute = computed(() => route.path.startsWith('/budget'))
const isLoginRoute = computed(() => route.path === '/login')
</script>

<template>
  <!-- Login: no chrome -->
  <RouterView v-if="isLoginRoute" />

  <!-- App: full layout -->
  <div v-else class="flex h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
    <SideNav />

    <div class="flex-1 flex flex-col overflow-hidden">
      <NavBar v-if="isBudgetRoute" />

      <main class="flex-1 overflow-auto">
        <div class="max-w-6xl mx-auto px-6 py-8">
          <RouterView />
        </div>
      </main>
    </div>
  </div>
</template>
