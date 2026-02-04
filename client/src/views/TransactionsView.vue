<script setup lang="ts">
import { RouterLink } from 'vue-router'
</script>

<template>
  <div class="transactions">
    <header>
      <RouterLink to="/">← Back</RouterLink>
      <h1>Transactions</h1>
    </header>
    <main>
      <p>Transaction list will appear here.</p>
    </main>
  </div>
</template>

<style scoped>
.transactions {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem;
}

header {
  margin-bottom: 2rem;
}

header a {
  color: #42b883;
  text-decoration: none;
  display: block;
  margin-bottom: 0.5rem;
}
</style>
