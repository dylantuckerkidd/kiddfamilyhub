<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { RouterLink, useRoute, useRouter } from 'vue-router'
import { useTheme } from '@/composables/useTheme'
import { useAuthStore } from '@/stores/auth'

const props = defineProps<{
  mobileOpen?: boolean
}>()

const emit = defineEmits<{
  'update:mobileOpen': [value: boolean]
}>()

const route = useRoute()
const router = useRouter()
const { isDark, toggleTheme } = useTheme()
const auth = useAuthStore()

async function handleLogout() {
  await auth.logout()
  router.push('/login')
}

const isCollapsed = ref(false)

// On mobile drawer, always show labels regardless of collapse state
const showLabels = computed(() => props.mobileOpen || !isCollapsed.value)

const navItems = [
  {
    to: '/calendar',
    label: 'Calendar',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />`
  },
  {
    to: '/grocery',
    label: 'Grocery List',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />`
  },
  {
    to: '/todos',
    label: 'Todo List',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />`
  },
  {
    to: '/maintenance',
    label: 'Maintenance',
    icon: `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />`
  }
]

const isActive = (path: string) => {
  return route.path.startsWith(path)
}

function closeMobile() {
  emit('update:mobileOpen', false)
}

function handleNavClick() {
  closeMobile()
}

// Close drawer on route change
watch(() => route.path, () => {
  closeMobile()
})
</script>

<template>
  <!-- Mobile backdrop -->
  <Transition
    enter-active-class="transition-opacity duration-300"
    enter-from-class="opacity-0"
    enter-to-class="opacity-100"
    leave-active-class="transition-opacity duration-200"
    leave-from-class="opacity-100"
    leave-to-class="opacity-0"
  >
    <div
      v-if="mobileOpen"
      class="fixed inset-0 bg-black/50 z-40 md:hidden"
      @click="closeMobile"
    />
  </Transition>

  <div
    class="h-screen flex flex-col bg-gray-900 text-white transition-all duration-300
      fixed z-50 w-64 -translate-x-full
      md:relative md:translate-x-0"
    :class="[
      mobileOpen ? 'translate-x-0' : '',
      isCollapsed ? 'md:w-16' : 'md:w-56'
    ]"
  >
    <!-- Header -->
    <div class="p-4 border-b border-gray-700">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-400 to-teal-500 flex items-center justify-center flex-shrink-0">
          <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
          </svg>
        </div>
        <span v-if="showLabels" class="font-bold text-lg whitespace-nowrap">Family Hub</span>
      </div>
    </div>

    <!-- Navigation -->
    <nav class="flex-1 p-3 space-y-1">
      <RouterLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        @click="handleNavClick"
        class="flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200"
        :class="isActive(item.to)
          ? 'bg-emerald-600 text-white'
          : 'text-gray-400 hover:bg-gray-800 hover:text-white'"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" v-html="item.icon" />
        <span v-if="showLabels" class="whitespace-nowrap">{{ item.label }}</span>
      </RouterLink>
    </nav>

    <!-- Footer -->
    <div class="p-3 border-t border-gray-700 space-y-1">
      <!-- Theme Toggle -->
      <button
        @click="toggleTheme"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
      >
        <svg v-if="isDark" class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
        <svg v-else class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
        <span v-if="showLabels" class="whitespace-nowrap">{{ isDark ? 'Light Mode' : 'Dark Mode' }}</span>
      </button>

      <!-- Logout -->
      <button
        @click="handleLogout"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
      >
        <svg class="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        <span v-if="showLabels" class="whitespace-nowrap">Logout</span>
      </button>

      <!-- Collapse Toggle (desktop only) -->
      <button
        @click="isCollapsed = !isCollapsed"
        class="w-full hidden md:flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:bg-gray-800 hover:text-white transition-all duration-200"
      >
        <svg
          class="w-5 h-5 flex-shrink-0 transition-transform duration-300"
          :class="isCollapsed ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
        </svg>
        <span v-if="!isCollapsed" class="whitespace-nowrap">Collapse</span>
      </button>
    </div>
  </div>
</template>
