import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface GroceryItem {
  id: number
  name: string
  quantity: number | null
  unit: string | null
  category: string | null
  checked: boolean
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
      const { data, error } = await supabase
        .from('grocery_items')
        .select('*')
        .order('created_at', { ascending: true })
      if (error) throw error
      items.value = data ?? []
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
    const { error } = await supabase.rpc('add_grocery_item', {
      p_name: item.name,
      p_quantity: item.quantity ?? null,
      p_unit: item.unit ?? null,
      p_category: item.category ?? null
    })
    if (error) throw error
    await fetchItems(false)
  }

  async function updateItem(id: number, data: Partial<GroceryItem>) {
    const { error } = await supabase
      .from('grocery_items')
      .update(data)
      .eq('id', id)
    if (error) throw error
    await fetchItems(false)
  }

  async function toggleItem(id: number) {
    const item = items.value.find(i => i.id === id)
    if (item) {
      const { error } = await supabase
        .from('grocery_items')
        .update({ checked: !item.checked })
        .eq('id', id)
      if (error) throw error
      await fetchItems(false)
    }
  }

  async function deleteItem(id: number) {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchItems(false)
  }

  async function clearChecked() {
    const { error } = await supabase
      .from('grocery_items')
      .delete()
      .eq('checked', true)
    if (error) throw error
    await fetchItems(false)
  }

  async function fetchSuggestions(query: string): Promise<{ name: string; category: string | null }[]> {
    if (!query.trim()) return []
    const { data, error } = await supabase.rpc('get_grocery_suggestions', {
      query: query.trim()
    })
    if (error) throw error
    return data ?? []
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
