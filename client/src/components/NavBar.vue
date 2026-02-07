<script setup lang="ts">
import { RouterLink, useRoute } from 'vue-router'

const route = useRoute()

const links = [
  { to: '/budget', label: 'Dashboard' },
  { to: '/budget/transactions', label: 'Transactions' },
  { to: '/budget/budgets', label: 'Budgets' },
  { to: '/budget/analytics', label: 'Analytics' },
  { to: '/budget/settings', label: 'Settings' }
]

const isActive = (path: string) => {
  if (path === '/budget') return route.path === '/budget'
  return route.path.startsWith(path)
}
</script>

<template>
  <nav class="bg-gradient-to-r from-emerald-600 to-teal-600 dark:from-emerald-800 dark:to-teal-800 shadow-lg">
    <div class="max-w-4xl mx-auto px-6 py-3">
      <div class="flex items-center gap-1">
        <RouterLink
          v-for="link in links"
          :key="link.to"
          :to="link.to"
          class="px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200"
          :class="isActive(link.to)
            ? 'bg-white/20 text-white'
            : 'text-emerald-100 hover:bg-white/10 hover:text-white'"
        >
          {{ link.label }}
        </RouterLink>
      </div>
    </div>
  </nav>
</template>
