import { ref, watch } from 'vue'

const isDark = ref(localStorage.getItem('theme') === 'dark')

// Apply theme on load
if (isDark.value) {
  document.documentElement.classList.add('dark')
}

watch(isDark, (dark) => {
  if (dark) {
    document.documentElement.classList.add('dark')
    localStorage.setItem('theme', 'dark')
  } else {
    document.documentElement.classList.remove('dark')
    localStorage.setItem('theme', 'light')
  }
})

export function useTheme() {
  function toggleTheme() {
    isDark.value = !isDark.value
  }

  return {
    isDark,
    toggleTheme
  }
}
