<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="home">
    <header>
      <h1>Budget App</h1>
    </header>
    <nav>
      <RouterLink to="/transactions">Transactions</RouterLink>
      <RouterLink to="/budgets">Budgets</RouterLink>
    </nav>
    <main>
      <p>Welcome to your personal budget tracker.</p>
    </main>
  </div>
</template>

<style scoped>
.home {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

header h1 {
  margin-bottom: 1rem;
}

nav {
  display: flex;
  gap: 1rem;
  margin-bottom: 2rem;
}

nav a {
  color: #42b883;
  text-decoration: none;
}

nav a:hover {
  text-decoration: underline;
}
</style>
