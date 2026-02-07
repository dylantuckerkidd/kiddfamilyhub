<script setup lang="ts">
import NavBar from './NavBar.vue'
</script>

<template>
  <div class="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 transition-colors duration-200">
    <NavBar />
    <main class="max-w-4xl mx-auto px-6 py-8">
      <slot />
    </main>
  </div>
</template>
