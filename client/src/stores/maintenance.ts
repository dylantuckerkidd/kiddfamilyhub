import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

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
  // Joined fields from view
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
      const { data, error } = await supabase
        .from('maintenance_items_full')
        .select('*')
        .order('sort_order', { ascending: true })
      if (error) throw error
      items.value = data ?? []
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function fetchCategories() {
    const { data, error } = await supabase
      .from('maintenance_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    categories.value = data ?? []

    // Seed default categories if none exist
    if (categories.value.length === 0) {
      await seedDefaultCategories()
    }
  }

  async function seedDefaultCategories() {
    const defaults = [
      { name: 'HVAC', icon: '🌡️', sort_order: 1 },
      { name: 'Plumbing', icon: '🚿', sort_order: 2 },
      { name: 'Electrical', icon: '⚡', sort_order: 3 },
      { name: 'Exterior', icon: '🏠', sort_order: 4 },
      { name: 'Appliances', icon: '🔌', sort_order: 5 },
      { name: 'Safety', icon: '🔒', sort_order: 6 },
      { name: 'Lawn & Garden', icon: '🌿', sort_order: 7 },
      { name: 'Cleaning', icon: '🧹', sort_order: 8 },
    ]
    const { data, error } = await supabase
      .from('maintenance_categories')
      .insert(defaults)
      .select('*')
    if (error) throw error
    categories.value = data ?? []
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
    const { error } = await supabase
      .from('maintenance_items')
      .insert({
        title: data.title,
        description: data.description || null,
        category_id: data.category_id ?? null,
        person_id: data.person_id ?? null,
        frequency: data.frequency || 'monthly',
        frequency_days: data.frequency_days ?? null,
        next_due_date: data.next_due_date ?? null,
      })
    if (error) throw error
    await fetchItems(false)
  }

  async function updateItem(id: number, data: Partial<MaintenanceItem>) {
    const { category_name, category_icon, person_name, person_color, last_completed, ...updateData } = data as any
    const { error } = await supabase
      .from('maintenance_items')
      .update(updateData)
      .eq('id', id)
    if (error) throw error
    await fetchItems(false)
  }

  async function deleteItem(id: number) {
    const { error } = await supabase
      .from('maintenance_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchItems(false)
  }

  async function completeItem(
    id: number,
    data: { notes?: string; cost?: number | null; person_id?: number | null; completed_date?: string }
  ) {
    const { error } = await supabase.rpc('complete_maintenance_item', {
      p_item_id: id,
      p_completed_date: data.completed_date || null,
      p_notes: data.notes || null,
      p_cost: data.cost ?? null,
      p_person_id: data.person_id ?? null,
    })
    if (error) throw error
    await fetchItems(false)
  }

  async function fetchHistory(id: number): Promise<MaintenanceHistoryEntry[]> {
    const { data, error } = await supabase
      .from('maintenance_history_with_person')
      .select('*')
      .eq('item_id', id)
      .order('completed_date', { ascending: false })
    if (error) throw error
    return data ?? []
  }

  async function addCategory(data: { name: string; icon?: string }) {
    const { error } = await supabase
      .from('maintenance_categories')
      .insert({
        name: data.name,
        icon: data.icon || null,
      })
    if (error) throw error
    await fetchCategories()
  }

  async function updateCategory(id: number, data: Partial<MaintenanceCategory>) {
    const { error } = await supabase
      .from('maintenance_categories')
      .update(data)
      .eq('id', id)
    if (error) throw error
    await fetchCategories()
  }

  async function deleteCategory(id: number) {
    const { error } = await supabase
      .from('maintenance_categories')
      .delete()
      .eq('id', id)
    if (error) throw error
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
