import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useMealsStore, type MealPlanEntry, type Recipe } from '@/stores/meals'

function makeEntry(overrides: Partial<MealPlanEntry> = {}): MealPlanEntry {
  return {
    id: 1,
    date: '2024-01-01',
    meal_type: 'dinner',
    recipe_id: null,
    custom_title: null,
    notes: null,
    created_at: '2024-01-01',
    recipe_title: null,
    recipe_description: null,
    recipe_prep_time: null,
    recipe_cook_time: null,
    recipe_servings: null,
    recipe_category_name: null,
    recipe_category_icon: null,
    ...overrides,
  }
}

function makeRecipe(overrides: Partial<Recipe> = {}): Recipe {
  return {
    id: 1,
    title: 'Test Recipe',
    description: null,
    category_id: null,
    servings: null,
    prep_time: null,
    cook_time: null,
    instructions: null,
    created_at: '2024-01-01',
    category_name: null,
    category_icon: null,
    usage_count: 0,
    ...overrides,
  }
}

describe('useMealsStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('mealsByDateAndType', () => {
    it('creates map with date|type keys', () => {
      const store = useMealsStore()
      store.mealPlanEntries = [
        makeEntry({ id: 1, date: '2024-01-01', meal_type: 'breakfast' }),
        makeEntry({ id: 2, date: '2024-01-01', meal_type: 'dinner' }),
      ]
      const map = store.mealsByDateAndType
      expect(map.get('2024-01-01|breakfast')?.id).toBe(1)
      expect(map.get('2024-01-01|dinner')?.id).toBe(2)
      expect(map.has('2024-01-01|lunch')).toBe(false)
    })

    it('returns empty map when no entries', () => {
      const store = useMealsStore()
      expect(store.mealsByDateAndType.size).toBe(0)
    })

    it('later entry overwrites earlier for same date|type', () => {
      const store = useMealsStore()
      store.mealPlanEntries = [
        makeEntry({ id: 1, date: '2024-01-01', meal_type: 'dinner' }),
        makeEntry({ id: 2, date: '2024-01-01', meal_type: 'dinner' }),
      ]
      expect(store.mealsByDateAndType.get('2024-01-01|dinner')?.id).toBe(2)
    })
  })

  describe('recipesByCategory', () => {
    it('groups alphabetically with Uncategorized last', () => {
      const store = useMealsStore()
      store.recipes = [
        makeRecipe({ id: 1, category_name: 'Soup', category_icon: '🍲' }),
        makeRecipe({ id: 2, category_name: null }),
        makeRecipe({ id: 3, category_name: 'Chicken', category_icon: '🍗' }),
      ]
      const groups = store.recipesByCategory
      expect(groups).toHaveLength(3)
      expect(groups[0].category).toBe('Chicken')
      expect(groups[0].icon).toBe('🍗')
      expect(groups[1].category).toBe('Soup')
      expect(groups[2].category).toBe('Uncategorized')
    })

    it('returns empty array when no recipes', () => {
      const store = useMealsStore()
      expect(store.recipesByCategory).toHaveLength(0)
    })
  })
})
