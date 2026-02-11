import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { apiFetch } from '@/composables/useApi'

export interface MaintenanceCategory {
  id: number
  name: string
  icon: string | null
  sort_order: number
  created_at: string
}

export interface MaintenanceItem {
  id: number
  title: string
  description: string | null
  category_id: number | null
  person_id: number | null
  frequency: string
  frequency_days: number | null
  next_due_date: string | null
  sort_order: number
  created_at: string
  // Joined fields
  category_name: string | null
  category_icon: string | null
  person_name: string | null
  person_color: string | null
  last_completed: string | null
}

export interface MaintenanceHistoryEntry {
  id: number
  item_id: number
  completed_date: string
  notes: string | null
  cost: number | null
  person_id: number | null
  created_at: string
  person_name: string | null
  person_color: string | null
}

export const useMaintenanceStore = defineStore('maintenance', () => {
  const items = ref<MaintenanceItem[]>([])
  const categories = ref<MaintenanceCategory[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  const today = computed(() => new Date().toISOString().split('T')[0])

  const overdueItems = computed(() =>
    items.value.filter(i => i.next_due_date && i.next_due_date < today.value)
  )

  const upcomingSoonItems = computed(() => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 7)
    const soonStr = soon.toISOString().split('T')[0]
    return items.value.filter(
      i => i.next_due_date && i.next_due_date >= today.value && i.next_due_date <= soonStr
    )
  })

  const upToDateItems = computed(() => {
    const soon = new Date()
    soon.setDate(soon.getDate() + 7)
    const soonStr = soon.toISOString().split('T')[0]
    return items.value.filter(
      i => !i.next_due_date || i.next_due_date > soonStr
    )
  })

  const groupedByCategory = computed(() => {
    const groups: { category: string; icon: string | null; items: MaintenanceItem[] }[] = []
    const map = new Map<string, { icon: string | null; items: MaintenanceItem[] }>()

    for (const item of items.value) {
      const cat = item.category_name || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, { icon: item.category_icon, items: [] })
      map.get(cat)!.items.push(item)
    }

    const keys = [...map.keys()].sort((a, b) => {
      if (a === 'Uncategorized') return 1
      if (b === 'Uncategorized') return -1
      return a.localeCompare(b)
    })

    for (const key of keys) {
      const data = map.get(key)!
      groups.push({ category: key, icon: data.icon, items: data.items })
    }
    return groups
  })

  async function fetchItems(showLoading = true) {
    if (showLoading && !initialized.value) loading.value = true
    try {
      const res = await apiFetch('/api/maintenance')
      items.value = await res.json()
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    const res = await apiFetch('/api/maintenance/categories')
    categories.value = await res.json()
  }

  async function addItem(data: {
    title: string
    description?: string
    category_id?: number | null
    person_id?: number | null
    frequency?: string
    frequency_days?: number | null
    next_due_date?: string | null
  }) {
    await apiFetch('/api/maintenance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await fetchItems(false)
  }

  async function updateItem(id: number, data: Partial<MaintenanceItem>) {
    await apiFetch(`/api/maintenance/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await fetchItems(false)
  }

  async function deleteItem(id: number) {
    await apiFetch(`/api/maintenance/${id}`, { method: 'DELETE' })
    await fetchItems(false)
  }

  async function completeItem(
    id: number,
    data: { notes?: string; cost?: number | null; person_id?: number | null; completed_date?: string }
  ) {
    await apiFetch(`/api/maintenance/${id}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await fetchItems(false)
  }

  async function fetchHistory(id: number): Promise<MaintenanceHistoryEntry[]> {
    const res = await apiFetch(`/api/maintenance/${id}/history`)
    return await res.json()
  }

  async function addCategory(data: { name: string; icon?: string }) {
    await apiFetch('/api/maintenance/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await fetchCategories()
  }

  async function updateCategory(id: number, data: Partial<MaintenanceCategory>) {
    await apiFetch(`/api/maintenance/categories/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
    await fetchCategories()
  }

  async function deleteCategory(id: number) {
    await apiFetch(`/api/maintenance/categories/${id}`, { method: 'DELETE' })
    await fetchCategories()
  }

  return {
    items,
    categories,
    loading,
    initialized,
    overdueItems,
    upcomingSoonItems,
    upToDateItems,
    groupedByCategory,
    fetchItems,
    fetchCategories,
    addItem,
    updateItem,
    deleteItem,
    completeItem,
    fetchHistory,
    addCategory,
    updateCategory,
    deleteCategory,
  }
})
