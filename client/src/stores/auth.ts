import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'
import type { Session, User } from '@supabase/supabase-js'

interface FamilyMember {
  user_id: string
  email: string
  role: 'owner' | 'member'
  joined_at: string
}

interface FamilyInvite {
  id: number
  invite_code: string
  expires_at: string
}

interface FamilyInfo {
  in_family: boolean
  family_id?: string
  family_name?: string
  members?: FamilyMember[]
  pending_invites?: FamilyInvite[]
}

export const useAuthStore = defineStore('auth', () => {
  const session = ref<Session | null>(null)
  const user = ref<User | null>(null)
  const loading = ref(true)
  const familyInfo = ref<FamilyInfo>({ in_family: false })

  const isAuthenticated = computed(() => !!session.value)
  const inFamily = computed(() => familyInfo.value.in_family)

  async function fetchFamilyInfo() {
    const { data, error } = await supabase.rpc('get_family_info')
    if (!error && data) {
      familyInfo.value = data as FamilyInfo
    }
  }

  async function initialize() {
    const { data } = await supabase.auth.getSession()
    session.value = data.session
    user.value = data.session?.user ?? null
    loading.value = false

    if (data.session) {
      fetchFamilyInfo()
    }

    supabase.auth.onAuthStateChange((_event, newSession) => {
      session.value = newSession
      user.value = newSession?.user ?? null
      if (newSession) {
        fetchFamilyInfo()
      } else {
        familyInfo.value = { in_family: false }
      }
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
    familyInfo.value = { in_family: false }
  }

  async function createFamily(name: string): Promise<{ success: boolean; error?: string; invite_code?: string }> {
    const { data, error } = await supabase.rpc('create_family_and_invite', { p_name: name })
    if (error) return { success: false, error: error.message }
    await fetchFamilyInfo()
    return { success: true, invite_code: (data as { invite_code: string }).invite_code }
  }

  async function acceptInvite(code: string): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc('accept_family_invite', { p_code: code })
    if (error) return { success: false, error: error.message }
    await fetchFamilyInfo()
    return { success: true }
  }

  async function createInvite(): Promise<{ success: boolean; error?: string; invite_code?: string }> {
    const { data, error } = await supabase.rpc('create_family_invite')
    if (error) return { success: false, error: error.message }
    await fetchFamilyInfo()
    return { success: true, invite_code: (data as { invite_code: string }).invite_code }
  }

  async function leaveFamily(): Promise<{ success: boolean; error?: string }> {
    const { error } = await supabase.rpc('leave_family')
    if (error) return { success: false, error: error.message }
    await fetchFamilyInfo()
    return { success: true }
  }

  return {
    session,
    user,
    loading,
    isAuthenticated,
    familyInfo,
    inFamily,
    initialize,
    login,
    signUp,
    signInWithGoogle,
    signInWithApple,
    logout,
    fetchFamilyInfo,
    createFamily,
    acceptInvite,
    createInvite,
    leaveFamily
  }
})
