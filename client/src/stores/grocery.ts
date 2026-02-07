import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/composables/useApi'

export interface GroceryItem {
  id: number
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  checked: number
  created_at: string
}

export const useGroceryStore = defineStore('grocery', () => {
  const items = ref<GroceryItem[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  const uncheckedItems = computed(() => items.value.filter(i => !i.checked))
  const checkedItems = computed(() => items.value.filter(i => i.checked))

  const groupedUncheckedItems = computed(() => {
    const groups: { category: string; items: GroceryItem[] }[] = []
    const map = new Map<string, GroceryItem[]>()

    for (const item of uncheckedItems.value) {
      const cat = item.category || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }

    // Sort categories: named categories first alphabetically, Uncategorized last
    const keys = [...map.keys()].sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })

    for (const key of keys) {
      groups.push({ category: key, items: map.get(key)! })
    }
    return groups
  })

  async function fetchItems(showLoading = true) {
    if (showLoading && !initialized.value) {
      loading.value = true
    }
    try {
      const res = await apiFetch('/api/grocery')
      items.value = await res.json()
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function addItem(item: {
    name: string
    quantity?: number | null
    unit?: string | null
    category?: string | null
  }) {
    await apiFetch('/api/grocery', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(item)
    })
    await fetchItems()
  }

  async function updateItem(id: number, data: Partial<GroceryItem>) {
    await apiFetch(`/api/grocery/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    await fetchItems()
  }

  async function toggleItem(id: number) {
    const item = items.value.find(i => i.id === id)
    if (item) {
      await apiFetch(`/api/grocery/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checked: item.checked ? 0 : 1 })
      })
      await fetchItems()
    }
  }

  async function deleteItem(id: number) {
    await apiFetch(`/api/grocery/${id}`, { method: 'DELETE' })
    await fetchItems()
  }

  async function clearChecked() {
    await apiFetch('/api/grocery/clear-checked', { method: 'DELETE' })
    await fetchItems()
  }

  async function fetchSuggestions(query: string): Promise<{ name: string; category: string | null }[]> {
    if (!query.trim()) return []
    const res = await apiFetch(`/api/grocery/suggestions?q=${encodeURIComponent(query.trim())}`)
    return await res.json()
  }

  return {
    items,
    loading,
    initialized,
    uncheckedItems,
    checkedItems,
    groupedUncheckedItems,
    fetchItems,
    addItem,
    updateItem,
    toggleItem,
    deleteItem,
    clearChecked,
    fetchSuggestions
  }
})
