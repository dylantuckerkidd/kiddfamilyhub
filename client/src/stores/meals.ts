import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { supabase } from '@/lib/supabase'

export interface RecipeCategory {
  id: number
  name: string
  icon: string | null
  sort_order: number
  created_at: string
}

export interface Recipe {
  id: number
  title: string
  description: string | null
  category_id: number | null
  servings: number | null
  prep_time: number | null
  cook_time: number | null
  instructions: string | null
  created_at: string
  // Joined fields from view
  category_name: string | null
  category_icon: string | null
  usage_count: number
}

export interface RecipeIngredient {
  id?: number
  recipe_id?: number
  name: string
  quantity: number | null
  unit: string | null
  sort_order: number
}

export interface MealPlanEntry {
  id: number
  date: string
  meal_type: 'breakfast' | 'lunch' | 'dinner'
  recipe_id: number | null
  custom_title: string | null
  notes: string | null
  created_at: string
  // Joined fields from view
  recipe_title: string | null
  recipe_description: string | null
  recipe_prep_time: number | null
  recipe_cook_time: number | null
  recipe_servings: number | null
  recipe_category_name: string | null
  recipe_category_icon: string | null
}

export const useMealsStore = defineStore('meals', () => {
  const recipes = ref<Recipe[]>([])
  const recipeCategories = ref<RecipeCategory[]>([])
  const mealPlanEntries = ref<MealPlanEntry[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  const mealsByDateAndType = computed(() => {
    const map = new Map<string, MealPlanEntry>()
    for (const entry of mealPlanEntries.value) {
      map.set(`${entry.date}|${entry.meal_type}`, entry)
    }
    return map
  })

  const recipesByCategory = computed(() => {
    const groups: { category: string; icon: string | null; items: Recipe[] }[] = []
    const map = new Map<string, { icon: string | null; items: Recipe[] }>()

    for (const recipe of recipes.value) {
      const cat = recipe.category_name || 'Uncategorized'
      if (!map.has(cat)) map.set(cat, { icon: recipe.category_icon, items: [] })
      map.get(cat)!.items.push(recipe)
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

  // Recipe Categories
  async function fetchRecipeCategories() {
    const { data, error } = await supabase
      .from('recipe_categories')
      .select('*')
      .order('sort_order', { ascending: true })
    if (error) throw error
    recipeCategories.value = data ?? []

    if (recipeCategories.value.length === 0) {
      await seedDefaultCategories()
    }
  }

  async function seedDefaultCategories() {
    const defaults = [
      { name: 'Chicken', icon: '🍗', sort_order: 1 },
      { name: 'Beef', icon: '🥩', sort_order: 2 },
      { name: 'Pork', icon: '🥓', sort_order: 3 },
      { name: 'Seafood', icon: '🐟', sort_order: 4 },
      { name: 'Pasta', icon: '🍝', sort_order: 5 },
      { name: 'Soup', icon: '🍲', sort_order: 6 },
      { name: 'Salad', icon: '🥗', sort_order: 7 },
      { name: 'Vegetarian', icon: '🥬', sort_order: 8 },
      { name: 'Breakfast', icon: '🍳', sort_order: 9 },
      { name: 'Dessert', icon: '🍰', sort_order: 10 },
      { name: 'Snack', icon: '🍿', sort_order: 11 },
      { name: 'Other', icon: '🍽️', sort_order: 12 },
    ]
    const { data, error } = await supabase
      .from('recipe_categories')
      .insert(defaults)
      .select('*')
    if (error) throw error
    recipeCategories.value = data ?? []
  }

  // Recipes
  async function fetchRecipes(showLoading = true) {
    if (showLoading && !initialized.value) loading.value = true
    try {
      const { data, error } = await supabase
        .from('recipes_full')
        .select('*')
        .order('title', { ascending: true })
      if (error) throw error
      recipes.value = data ?? []
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function addRecipe(data: {
    title: string
    description?: string
    category_id?: number | null
    servings?: number | null
    prep_time?: number | null
    cook_time?: number | null
    instructions?: string
  }) {
    const { data: newRecipe, error } = await supabase
      .from('recipes')
      .insert({
        title: data.title,
        description: data.description || null,
        category_id: data.category_id ?? null,
        servings: data.servings ?? null,
        prep_time: data.prep_time ?? null,
        cook_time: data.cook_time ?? null,
        instructions: data.instructions || null,
      })
      .select('id')
      .single()
    if (error) throw error
    await fetchRecipes(false)
    return newRecipe
  }

  async function updateRecipe(id: number, data: {
    title?: string
    description?: string | null
    category_id?: number | null
    servings?: number | null
    prep_time?: number | null
    cook_time?: number | null
    instructions?: string | null
  }) {
    const { error } = await supabase
      .from('recipes')
      .update(data)
      .eq('id', id)
    if (error) throw error
    await fetchRecipes(false)
  }

  async function deleteRecipe(id: number) {
    const { error } = await supabase
      .from('recipes')
      .delete()
      .eq('id', id)
    if (error) throw error
    await fetchRecipes(false)
  }

  // Recipe Ingredients
  async function fetchIngredients(recipeId: number): Promise<RecipeIngredient[]> {
    const { data, error } = await supabase
      .from('recipe_ingredients')
      .select('*')
      .eq('recipe_id', recipeId)
      .order('sort_order', { ascending: true })
    if (error) throw error
    return data ?? []
  }

  async function saveIngredients(recipeId: number, ingredients: RecipeIngredient[]) {
    // Delete all existing ingredients for this recipe
    const { error: deleteError } = await supabase
      .from('recipe_ingredients')
      .delete()
      .eq('recipe_id', recipeId)
    if (deleteError) throw deleteError

    // Insert new ingredients
    if (ingredients.length > 0) {
      const rows = ingredients.map((ing, i) => ({
        recipe_id: recipeId,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit,
        sort_order: i,
      }))
      const { error: insertError } = await supabase
        .from('recipe_ingredients')
        .insert(rows)
      if (insertError) throw insertError
    }
  }

  // Meal Plan Entries
  async function fetchMealPlan(weekStart: string, weekEnd: string) {
    const { data, error } = await supabase
      .from('meal_plan_entries_full')
      .select('*')
      .gte('date', weekStart)
      .lte('date', weekEnd)
      .order('date', { ascending: true })
    if (error) throw error
    mealPlanEntries.value = data ?? []
  }

  async function addMealEntry(data: {
    date: string
    meal_type: 'breakfast' | 'lunch' | 'dinner'
    recipe_id?: number | null
    custom_title?: string | null
    notes?: string | null
  }) {
    const { error } = await supabase
      .from('meal_plan_entries')
      .insert({
        date: data.date,
        meal_type: data.meal_type,
        recipe_id: data.recipe_id ?? null,
        custom_title: data.custom_title ?? null,
        notes: data.notes ?? null,
      })
    if (error) throw error
  }

  async function updateMealEntry(id: number, data: {
    recipe_id?: number | null
    custom_title?: string | null
    notes?: string | null
  }) {
    const { error } = await supabase
      .from('meal_plan_entries')
      .update(data)
      .eq('id', id)
    if (error) throw error
  }

  async function deleteMealEntry(id: number) {
    const { error } = await supabase
      .from('meal_plan_entries')
      .delete()
      .eq('id', id)
    if (error) throw error
  }

  async function addWeekToGroceryList(weekStart: string, weekEnd: string): Promise<number> {
    const { data, error } = await supabase.rpc('add_meal_ingredients_to_grocery', {
      p_date_start: weekStart,
      p_date_end: weekEnd,
    })
    if (error) throw error
    return data as number
  }

  return {
    recipes,
    recipeCategories,
    mealPlanEntries,
    loading,
    initialized,
    mealsByDateAndType,
    recipesByCategory,
    fetchRecipeCategories,
    fetchRecipes,
    addRecipe,
    updateRecipe,
    deleteRecipe,
    fetchIngredients,
    saveIngredients,
    fetchMealPlan,
    addMealEntry,
    updateMealEntry,
    deleteMealEntry,
    addWeekToGroceryList,
  }
})
