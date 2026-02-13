import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)

  const isAuthenticated = computed(() => !!session.value)

  async function initialize() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
    })
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function signUp(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { success: false, error: error.message }
    return { success: true }
  }

  async function signInWithGoogle() {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
  }

  async function signInWithApple() {
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: window.location.origin }
    })
  }

  async function logout() {
    await supabase.auth.signOut()
    session.value = null
    user.value = null
  }

  return {
    session,
    user,
    loading,
    isAuthenticated,
    initialize,
    login,
    signUp,
    signInWithGoogle,
    signInWithApple,
    logout
  }
})
