<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMealsStore, type Recipe, type MealPlanEntry, type RecipeIngredient } from '@/stores/meals'

const store = useMealsStore()

// Tab state
const activeTab = ref<'plan' | 'recipes'>('plan')

// Week navigation
const currentWeekStart = ref(getMonday(new Date()))

function getMonday(d: Date): string {
  const date = new Date(d)
  const day = date.getDay()
  const diff = date.getDate() - day + (day === 0 ? -6 : 1)
  date.setDate(diff)
  return date.toISOString().split('T')[0]
}

function getWeekEnd(startStr: string): string {
  const d = new Date(startStr + 'T00:00:00')
  d.setDate(d.getDate() + 6)
  return d.toISOString().split('T')[0]
}

const weekEnd = computed(() => getWeekEnd(currentWeekStart.value))

const weekDays = computed(() => {
  const days: { date: string; label: string; dayName: string }[] = []
  const start = new Date(currentWeekStart.value + 'T00:00:00')
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().split('T')[0]
    days.push({
      date: dateStr,
      label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
    })
  }
  return days
})

const weekLabel = computed(() => {
  const start = new Date(currentWeekStart.value + 'T00:00:00')
  const end = new Date(weekEnd.value + 'T00:00:00')
  const startMonth = start.toLocaleDateString('en-US', { month: 'short' })
  const endMonth = end.toLocaleDateString('en-US', { month: 'short' })
  if (startMonth === endMonth) {
    return `${startMonth} ${start.getDate()} – ${end.getDate()}, ${start.getFullYear()}`
  }
  return `${startMonth} ${start.getDate()} – ${endMonth} ${end.getDate()}, ${end.getFullYear()}`
})

function prevWeek() {
  const d = new Date(currentWeekStart.value + 'T00:00:00')
  d.setDate(d.getDate() - 7)
  currentWeekStart.value = d.toISOString().split('T')[0]
}

function nextWeek() {
  const d = new Date(currentWeekStart.value + 'T00:00:00')
  d.setDate(d.getDate() + 7)
  currentWeekStart.value = d.toISOString().split('T')[0]
}

function goToday() {
  currentWeekStart.value = getMonday(new Date())
}

const isToday = (dateStr: string) => dateStr === new Date().toISOString().split('T')[0]

const mealTypes = ['breakfast', 'lunch', 'dinner'] as const

function getMealLabel(type: string): string {
  return type.charAt(0).toUpperCase() + type.slice(1)
}

function getMeal(date: string, type: string): MealPlanEntry | undefined {
  return store.mealsByDateAndType.get(`${date}|${type}`)
}

function getMealDisplayTitle(entry: MealPlanEntry): string {
  if (entry.recipe_title) return entry.recipe_title
  if (entry.custom_title) return entry.custom_title
  return 'Untitled'
}

// Meal Entry Modal
const showMealModal = ref(false)
const editingMealEntry = ref<MealPlanEntry | null>(null)
const mealForm = ref({
  date: '',
  meal_type: 'dinner' as 'breakfast' | 'lunch' | 'dinner',
  recipe_id: null as number | null,
  custom_title: '',
  notes: '',
  mode: 'recipe' as 'recipe' | 'custom',
})

function openMealModal(date: string, mealType: 'breakfast' | 'lunch' | 'dinner') {
  const existing = getMeal(date, mealType)
  if (existing) {
    editingMealEntry.value = existing
    mealForm.value = {
      date,
      meal_type: mealType,
      recipe_id: existing.recipe_id,
      custom_title: existing.custom_title || '',
      notes: existing.notes || '',
      mode: existing.recipe_id ? 'recipe' : 'custom',
    }
  } else {
    editingMealEntry.value = null
    mealForm.value = {
      date,
      meal_type: mealType,
      recipe_id: null,
      custom_title: '',
      notes: '',
      mode: 'recipe',
    }
  }
  showMealModal.value = true
}

async function saveMealEntry() {
  const isRecipe = mealForm.value.mode === 'recipe'
  const data = {
    date: mealForm.value.date,
    meal_type: mealForm.value.meal_type,
    recipe_id: isRecipe ? mealForm.value.recipe_id : null,
    custom_title: !isRecipe ? mealForm.value.custom_title.trim() || null : null,
    notes: mealForm.value.notes.trim() || null,
  }

  if (!data.recipe_id && !data.custom_title) return

  if (editingMealEntry.value) {
    await store.updateMealEntry(editingMealEntry.value.id, {
      recipe_id: data.recipe_id,
      custom_title: data.custom_title,
      notes: data.notes,
    })
  } else {
    await store.addMealEntry(data)
  }
  await store.fetchMealPlan(currentWeekStart.value, weekEnd.value)
  showMealModal.value = false
}

async function deleteMealEntry() {
  if (editingMealEntry.value) {
    await store.deleteMealEntry(editingMealEntry.value.id)
    await store.fetchMealPlan(currentWeekStart.value, weekEnd.value)
    showMealModal.value = false
  }
}

// Recipe Picker (inline in meal modal)
const recipeSearch = ref('')
const recipeFilterCategory = ref<number | ''>('')

const filteredRecipesForPicker = computed(() => {
  let list = store.recipes
  if (recipeFilterCategory.value) {
    list = list.filter(r => r.category_id === recipeFilterCategory.value)
  }
  if (recipeSearch.value.trim()) {
    const q = recipeSearch.value.trim().toLowerCase()
    list = list.filter(r => r.title.toLowerCase().includes(q))
  }
  return list
})

function selectRecipeForMeal(recipe: Recipe) {
  mealForm.value.recipe_id = recipe.id
  mealForm.value.mode = 'recipe'
}

// Recipe Book Tab
const bookSearch = ref('')
const bookFilterCategory = ref<number | ''>('')

const filteredRecipesForBook = computed(() => {
  let list = store.recipes
  if (bookFilterCategory.value) {
    list = list.filter(r => r.category_id === bookFilterCategory.value)
  }
  if (bookSearch.value.trim()) {
    const q = bookSearch.value.trim().toLowerCase()
    list = list.filter(r =>
      r.title.toLowerCase().includes(q) ||
      (r.description && r.description.toLowerCase().includes(q))
    )
  }
  return list
})

// Recipe Add/Edit Modal
const showRecipeModal = ref(false)
const editingRecipe = ref<Recipe | null>(null)
const recipeForm = ref({
  title: '',
  description: '',
  category_id: null as number | null,
  servings: null as number | null,
  prep_time: null as number | null,
  cook_time: null as number | null,
  instructions: '',
})
const ingredientRows = ref<RecipeIngredient[]>([])

function openAddRecipeModal() {
  editingRecipe.value = null
  recipeForm.value = {
    title: '',
    description: '',
    category_id: null,
    servings: null,
    prep_time: null,
    cook_time: null,
    instructions: '',
  }
  ingredientRows.value = [{ name: '', quantity: null, unit: null, sort_order: 0 }]
  showRecipeModal.value = true
}

async function openEditRecipeModal(recipe: Recipe) {
  editingRecipe.value = recipe
  recipeForm.value = {
    title: recipe.title,
    description: recipe.description || '',
    category_id: recipe.category_id,
    servings: recipe.servings,
    prep_time: recipe.prep_time,
    cook_time: recipe.cook_time,
    instructions: recipe.instructions || '',
  }
  const ings = await store.fetchIngredients(recipe.id)
  ingredientRows.value = ings.length > 0 ? ings : [{ name: '', quantity: null, unit: null, sort_order: 0 }]
  showRecipeModal.value = true
}

function addIngredientRow() {
  ingredientRows.value.push({ name: '', quantity: null, unit: null, sort_order: ingredientRows.value.length })
}

function removeIngredientRow(index: number) {
  ingredientRows.value.splice(index, 1)
}

function moveIngredient(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= ingredientRows.value.length) return
  const rows = ingredientRows.value
  ;[rows[index], rows[target]] = [rows[target], rows[index]]
}

async function saveRecipe() {
  if (!recipeForm.value.title.trim()) return

  const data = {
    title: recipeForm.value.title.trim(),
    description: recipeForm.value.description.trim() || undefined,
    category_id: recipeForm.value.category_id,
    servings: recipeForm.value.servings,
    prep_time: recipeForm.value.prep_time,
    cook_time: recipeForm.value.cook_time,
    instructions: recipeForm.value.instructions.trim() || undefined,
  }

  const validIngredients = ingredientRows.value.filter(i => i.name.trim())

  if (editingRecipe.value) {
    await store.updateRecipe(editingRecipe.value.id, data)
    await store.saveIngredients(editingRecipe.value.id, validIngredients)
  } else {
    const newRecipe = await store.addRecipe(data)
    if (newRecipe && validIngredients.length > 0) {
      await store.saveIngredients(newRecipe.id, validIngredients)
    }
  }
  showRecipeModal.value = false
}

async function deleteRecipe() {
  if (editingRecipe.value) {
    await store.deleteRecipe(editingRecipe.value.id)
    showRecipeModal.value = false
  }
}

// Grocery integration
const groceryMessage = ref('')

async function addWeekToGroceryList() {
  try {
    const count = await store.addWeekToGroceryList(currentWeekStart.value, weekEnd.value)
    groceryMessage.value = count > 0
      ? `Added ${count} ingredient${count > 1 ? 's' : ''} to grocery list!`
      : 'No recipe ingredients found for this week.'
    setTimeout(() => { groceryMessage.value = '' }, 3000)
  } catch (e) {
    groceryMessage.value = 'Error adding ingredients.'
    setTimeout(() => { groceryMessage.value = '' }, 3000)
  }
}

// Units for ingredient dropdown
const unitOptions = ['', 'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'L', 'piece', 'pieces', 'clove', 'cloves', 'can', 'cans', 'bunch', 'pinch', 'dash', 'slice', 'slices']

// Get selected recipe name for meal modal display
const selectedRecipeName = computed(() => {
  if (!mealForm.value.recipe_id) return null
  const r = store.recipes.find(r => r.id === mealForm.value.recipe_id)
  return r ? r.title : null
})

// Watch week changes to re-fetch meal plan
watch(currentWeekStart, () => {
  store.fetchMealPlan(currentWeekStart.value, weekEnd.value)
})

onMounted(async () => {
  await Promise.all([
    store.fetchRecipeCategories(),
    store.fetchRecipes(),
    store.fetchMealPlan(currentWeekStart.value, weekEnd.value),
  ])
})

const refresh = () => window.location.reload()
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
      <div>
        <div class="flex items-center gap-2">
          <h1 class="text-2xl font-bold text-gray-900 dark:text-white">Meal Plan</h1>
          <button @click="refresh" class="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors" title="Refresh"><svg class="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
        </div>
        <p class="text-gray-500 dark:text-gray-400 mt-1">Plan your weekly meals and manage recipes</p>
      </div>
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
      <button
        @click="activeTab = 'plan'"
        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="activeTab === 'plan'
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        Weekly Plan
      </button>
      <button
        @click="activeTab = 'recipes'"
        class="flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
        :class="activeTab === 'recipes'
          ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
          : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'"
      >
        Recipe Book
      </button>
    </div>

    <!-- ==================== WEEKLY PLAN TAB ==================== -->
    <div v-if="activeTab === 'plan'" class="space-y-4">
      <!-- Week Navigation -->
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2">
          <button
            @click="prevWeek"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <button
            @click="goToday"
            class="px-3 py-1.5 text-sm font-medium rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Today
          </button>
          <button
            @click="nextWeek"
            class="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-400 transition-colors"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <span class="text-lg font-semibold text-gray-900 dark:text-white ml-2">{{ weekLabel }}</span>
        </div>
        <div class="flex items-center gap-2">
          <Transition
            enter-active-class="transition-opacity duration-300"
            enter-from-class="opacity-0"
            enter-to-class="opacity-100"
            leave-active-class="transition-opacity duration-200"
            leave-from-class="opacity-100"
            leave-to-class="opacity-0"
          >
            <span v-if="groceryMessage" class="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              {{ groceryMessage }}
            </span>
          </Transition>
          <button
            @click="addWeekToGroceryList"
            class="px-3 py-2 text-sm font-medium bg-emerald-500 text-white rounded-xl hover:bg-emerald-600 transition-colors flex items-center gap-1.5"
          >
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
            </svg>
            <span class="hidden sm:inline">Add to Grocery List</span>
          </button>
        </div>
      </div>

      <!-- Desktop Grid -->
      <div class="hidden md:block bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
        <table class="w-full">
          <thead>
            <tr class="border-b border-gray-100 dark:border-gray-700">
              <th class="w-20 px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400"></th>
              <th
                v-for="day in weekDays"
                :key="day.date"
                class="px-2 py-2.5 text-center text-xs font-semibold uppercase tracking-wider"
                :class="isToday(day.date) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-500 dark:text-gray-400'"
              >
                <div>{{ day.dayName }}</div>
                <div class="text-sm font-bold mt-0.5" :class="isToday(day.date) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'">
                  {{ day.label }}
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mealType in mealTypes" :key="mealType" class="border-b border-gray-50 dark:border-gray-700/50 last:border-b-0">
              <td class="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 align-top pt-3">
                {{ getMealLabel(mealType) }}
              </td>
              <td
                v-for="day in weekDays"
                :key="day.date"
                class="px-1 py-1.5 align-top"
                :class="isToday(day.date) ? 'bg-emerald-50/50 dark:bg-emerald-900/10' : ''"
              >
                <div
                  v-if="getMeal(day.date, mealType)"
                  @click="openMealModal(day.date, mealType)"
                  class="group px-2 py-1.5 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors min-h-[2.5rem]"
                >
                  <div class="flex items-start gap-1">
                    <span v-if="getMeal(day.date, mealType)?.recipe_category_icon" class="text-xs mt-0.5">
                      {{ getMeal(day.date, mealType)!.recipe_category_icon }}
                    </span>
                    <span class="text-xs font-medium text-gray-800 dark:text-gray-200 line-clamp-2">
                      {{ getMealDisplayTitle(getMeal(day.date, mealType)!) }}
                    </span>
                  </div>
                </div>
                <div
                  v-else
                  @click="openMealModal(day.date, mealType)"
                  class="group flex items-center justify-center min-h-[2.5rem] rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-dashed border-transparent hover:border-gray-200 dark:hover:border-gray-600 transition-all"
                >
                  <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Mobile Stacked View -->
      <div class="md:hidden space-y-3">
        <div
          v-for="day in weekDays"
          :key="day.date"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden"
          :class="isToday(day.date) ? 'ring-2 ring-emerald-400 dark:ring-emerald-500' : ''"
        >
          <div class="px-4 py-2.5 border-b border-gray-100 dark:border-gray-700" :class="isToday(day.date) ? 'bg-emerald-50 dark:bg-emerald-900/20' : 'bg-gray-50 dark:bg-gray-700/50'">
            <span class="text-sm font-semibold" :class="isToday(day.date) ? 'text-emerald-700 dark:text-emerald-400' : 'text-gray-700 dark:text-gray-300'">
              {{ day.dayName }} {{ day.label }}
            </span>
          </div>
          <div class="divide-y divide-gray-50 dark:divide-gray-700/50">
            <div
              v-for="mealType in mealTypes"
              :key="mealType"
              @click="openMealModal(day.date, mealType)"
              class="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
            >
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-400 dark:text-gray-500 w-16">
                {{ getMealLabel(mealType) }}
              </span>
              <div v-if="getMeal(day.date, mealType)" class="flex items-center gap-1.5 flex-1 min-w-0">
                <span v-if="getMeal(day.date, mealType)?.recipe_category_icon" class="text-sm">
                  {{ getMeal(day.date, mealType)!.recipe_category_icon }}
                </span>
                <span class="text-sm text-gray-800 dark:text-gray-200 font-medium truncate">
                  {{ getMealDisplayTitle(getMeal(day.date, mealType)!) }}
                </span>
              </div>
              <div v-else class="flex-1 flex items-center">
                <span class="text-sm text-gray-300 dark:text-gray-600">Tap to add</span>
              </div>
              <svg class="w-4 h-4 text-gray-300 dark:text-gray-600 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ==================== RECIPE BOOK TAB ==================== -->
    <div v-if="activeTab === 'recipes'" class="space-y-4">
      <!-- Search + Filter + Add -->
      <div class="flex flex-col sm:flex-row gap-3">
        <div class="relative flex-1">
          <svg class="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            v-model="bookSearch"
            type="text"
            placeholder="Search recipes..."
            class="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
        <select
          v-model="bookFilterCategory"
          class="px-3 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">All Categories</option>
          <option v-for="cat in store.recipeCategories" :key="cat.id" :value="cat.id">
            {{ cat.icon }} {{ cat.name }}
          </option>
        </select>
        <button
          @click="openAddRecipeModal"
          class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors whitespace-nowrap"
        >
          + Add Recipe
        </button>
      </div>

      <!-- Loading State -->
      <div v-if="store.loading && !store.initialized" class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8">
        <div class="flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-gray-500 dark:text-gray-400 text-sm">Loading...</span>
        </div>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="store.recipes.length === 0"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-12 text-center"
      >
        <svg class="w-16 h-16 mx-auto text-gray-300 dark:text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
        </svg>
        <p class="text-gray-500 dark:text-gray-400 font-medium">No recipes yet</p>
        <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Add your first recipe to get started</p>
      </div>

      <!-- Recipe Cards Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="recipe in filteredRecipesForBook"
          :key="recipe.id"
          @click="openEditRecipeModal(recipe)"
          class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4 cursor-pointer hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all"
        >
          <div class="flex items-start justify-between gap-2 mb-2">
            <h3 class="font-semibold text-gray-900 dark:text-white line-clamp-1">{{ recipe.title }}</h3>
            <span v-if="recipe.category_icon" class="text-lg flex-shrink-0">{{ recipe.category_icon }}</span>
          </div>
          <p v-if="recipe.description" class="text-sm text-gray-500 dark:text-gray-400 line-clamp-2 mb-3">
            {{ recipe.description }}
          </p>
          <div class="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
            <span v-if="recipe.category_name" class="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
              {{ recipe.category_name }}
            </span>
            <span v-if="recipe.prep_time" class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {{ recipe.prep_time }}m prep
            </span>
            <span v-if="recipe.cook_time" class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
              </svg>
              {{ recipe.cook_time }}m cook
            </span>
            <span v-if="recipe.servings" class="flex items-center gap-1">
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              {{ recipe.servings }}
            </span>
          </div>
        </div>
      </div>

      <!-- No results after filtering -->
      <div
        v-if="filteredRecipesForBook.length === 0 && store.recipes.length > 0"
        class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-8 text-center"
      >
        <p class="text-gray-500 dark:text-gray-400">No recipes match your search</p>
      </div>
    </div>

    <!-- ==================== MEAL ENTRY MODAL ==================== -->
    <div
      v-if="showMealModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showMealModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-1">
          {{ editingMealEntry ? 'Edit Meal' : 'Add Meal' }}
        </h3>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-4">
          {{ getMealLabel(mealForm.meal_type) }} &middot;
          {{ new Date(mealForm.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) }}
        </p>

        <!-- Mode toggle -->
        <div class="flex gap-1 bg-gray-100 dark:bg-gray-700 rounded-lg p-1 mb-4">
          <button
            @click="mealForm.mode = 'recipe'"
            class="flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="mealForm.mode === 'recipe'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'"
          >
            From Recipe
          </button>
          <button
            @click="mealForm.mode = 'custom'"
            class="flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-colors"
            :class="mealForm.mode === 'custom'
              ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
              : 'text-gray-500 dark:text-gray-400'"
          >
            Custom
          </button>
        </div>

        <!-- Recipe Picker -->
        <div v-if="mealForm.mode === 'recipe'" class="space-y-3 mb-4">
          <!-- Selected recipe display -->
          <div v-if="selectedRecipeName" class="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
            <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
            <span class="text-sm font-medium text-emerald-700 dark:text-emerald-300 flex-1">{{ selectedRecipeName }}</span>
            <button @click="mealForm.recipe_id = null" class="text-emerald-500 hover:text-emerald-700 dark:hover:text-emerald-300">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Search + filter -->
          <div class="flex gap-2">
            <input
              v-model="recipeSearch"
              type="text"
              placeholder="Search recipes..."
              class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <select
              v-model="recipeFilterCategory"
              class="px-2 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All</option>
              <option v-for="cat in store.recipeCategories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- Recipe list -->
          <div class="max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-600 divide-y divide-gray-100 dark:divide-gray-700">
            <div
              v-for="recipe in filteredRecipesForPicker"
              :key="recipe.id"
              @click="selectRecipeForMeal(recipe)"
              class="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              :class="mealForm.recipe_id === recipe.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''"
            >
              <span v-if="recipe.category_icon" class="text-sm">{{ recipe.category_icon }}</span>
              <span class="text-sm text-gray-800 dark:text-gray-200 flex-1">{{ recipe.title }}</span>
              <span v-if="recipe.prep_time || recipe.cook_time" class="text-xs text-gray-400 dark:text-gray-500">
                {{ (recipe.prep_time || 0) + (recipe.cook_time || 0) }}min
              </span>
            </div>
            <div v-if="filteredRecipesForPicker.length === 0" class="px-3 py-4 text-center text-sm text-gray-400 dark:text-gray-500">
              No recipes found
            </div>
          </div>
        </div>

        <!-- Custom Title -->
        <div v-if="mealForm.mode === 'custom'" class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Meal Name</label>
          <input
            v-model="mealForm.custom_title"
            type="text"
            placeholder="e.g. Leftovers, Eating out..."
            class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
          />
        </div>

        <!-- Notes -->
        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
          <textarea
            v-model="mealForm.notes"
            rows="2"
            placeholder="Any notes..."
            class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
          />
        </div>

        <!-- Actions -->
        <div class="flex gap-3">
          <button
            v-if="editingMealEntry"
            type="button"
            @click="deleteMealEntry"
            class="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
          >
            Delete
          </button>
          <div class="flex-1"></div>
          <button
            @click="showMealModal = false"
            class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
          >
            Cancel
          </button>
          <button
            @click="saveMealEntry"
            class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
          >
            {{ editingMealEntry ? 'Save' : 'Add' }}
          </button>
        </div>
      </div>
    </div>

    <!-- ==================== RECIPE ADD/EDIT MODAL ==================== -->
    <div
      v-if="showRecipeModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showRecipeModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ editingRecipe ? 'Edit Recipe' : 'Add Recipe' }}
        </h3>

        <form @submit.prevent="saveRecipe" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              v-model="recipeForm.title"
              type="text"
              required
              placeholder="e.g. Chicken Parmesan"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              v-model="recipeForm.description"
              rows="2"
              placeholder="Optional description..."
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Category</label>
            <select
              v-model="recipeForm.category_id"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="null">No category</option>
              <option v-for="cat in store.recipeCategories" :key="cat.id" :value="cat.id">
                {{ cat.icon }} {{ cat.name }}
              </option>
            </select>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Servings</label>
              <input
                v-model.number="recipeForm.servings"
                type="number"
                min="1"
                placeholder="4"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Prep (min)</label>
              <input
                v-model.number="recipeForm.prep_time"
                type="number"
                min="0"
                placeholder="15"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cook (min)</label>
              <input
                v-model.number="recipeForm.cook_time"
                type="number"
                min="0"
                placeholder="30"
                class="w-full px-3 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Instructions</label>
            <textarea
              v-model="recipeForm.instructions"
              rows="4"
              placeholder="Step-by-step instructions..."
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
            />
          </div>

          <!-- Ingredients -->
          <div>
            <div class="flex items-center justify-between mb-2">
              <label class="text-sm font-medium text-gray-700 dark:text-gray-300">Ingredients</label>
              <button
                type="button"
                @click="addIngredientRow"
                class="text-sm text-emerald-500 hover:text-emerald-600 font-medium"
              >
                + Add
              </button>
            </div>
            <div class="space-y-2">
              <div v-for="(ing, i) in ingredientRows" :key="i" class="flex gap-2 items-start">
                <div class="flex flex-col -space-y-0.5">
                  <button
                    type="button"
                    @click="moveIngredient(i, -1)"
                    :disabled="i === 0"
                    class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7"/></svg>
                  </button>
                  <button
                    type="button"
                    @click="moveIngredient(i, 1)"
                    :disabled="i === ingredientRows.length - 1"
                    class="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors disabled:opacity-25 disabled:cursor-not-allowed"
                  >
                    <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                  </button>
                </div>
                <input
                  v-model.number="ing.quantity"
                  type="number"
                  step="0.25"
                  min="0"
                  placeholder="Qty"
                  class="w-16 px-2 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                />
                <select
                  v-model="ing.unit"
                  class="w-20 px-1 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                >
                  <option v-for="u in unitOptions" :key="u" :value="u || null">{{ u || 'unit' }}</option>
                </select>
                <input
                  v-model="ing.name"
                  type="text"
                  placeholder="Ingredient name"
                  class="flex-1 px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
                />
                <button
                  v-if="ingredientRows.length > 1"
                  type="button"
                  @click="removeIngredientRow(i)"
                  class="p-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              v-if="editingRecipe"
              type="button"
              @click="deleteRecipe"
              class="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
            <div class="flex-1"></div>
            <button
              type="button"
              @click="showRecipeModal = false"
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              {{ editingRecipe ? 'Save' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
