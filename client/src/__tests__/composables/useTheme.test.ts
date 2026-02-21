import { describe, it, expect, beforeEach, vi } from 'vitest'
import { nextTick } from 'vue'

async function importFreshTheme() {
  vi.resetModules()
  const mod = await import('@/composables/useTheme')
  return mod.useTheme()
}

describe('useTheme', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('isDark reads from localStorage on init', async () => {
    localStorage.setItem('theme', 'dark')
    const { isDark } = await importFreshTheme()
    expect(isDark.value).toBe(true)
  })

  it('isDark is false when localStorage has no theme', async () => {
    const { isDark } = await importFreshTheme()
    expect(isDark.value).toBe(false)
  })

  it('toggleTheme flips value and persists to localStorage', async () => {
    const { isDark, toggleTheme } = await importFreshTheme()
    expect(isDark.value).toBe(false)

    toggleTheme()
    await nextTick()
    expect(isDark.value).toBe(true)
    expect(localStorage.getItem('theme')).toBe('dark')

    toggleTheme()
    await nextTick()
    expect(isDark.value).toBe(false)
    expect(localStorage.getItem('theme')).toBe('light')
  })
})
