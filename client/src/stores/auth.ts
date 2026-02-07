import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(localStorage.getItem('auth_token'))

  const isAuthenticated = computed(() => !!token.value)

  function setToken(t: string | null) {
    token.value = t
    if (t) {
      localStorage.setItem('auth_token', t)
    } else {
      localStorage.removeItem('auth_token')
    }
  }

  async function login(pin: string): Promise<{ success: boolean; error?: string }> {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pin })
      })
      if (!res.ok) {
        const data = await res.json()
        return { success: false, error: data.error || 'Invalid PIN' }
      }
      const data = await res.json()
      setToken(data.token)
      return { success: true }
    } catch {
      return { success: false, error: 'Network error' }
    }
  }

  async function verify(): Promise<boolean> {
    if (!token.value) return false
    try {
      const res = await fetch('/api/auth/verify', {
        headers: { Authorization: `Bearer ${token.value}` }
      })
      if (!res.ok) {
        setToken(null)
        return false
      }
      return true
    } catch {
      return false
    }
  }

  async function logout() {
    if (token.value) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token.value}` }
        })
      } catch {
        // ignore
      }
    }
    setToken(null)
  }

  return {
    token,
    isAuthenticated,
    login,
    verify,
    logout
  }
})
