<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useCalendarStore, type CalendarEvent } from '@/stores/calendar'
import { useTodosStore } from '@/stores/todos'
import { useWeatherStore, getWeatherInfo } from '@/stores/weather'
import { useGroceryStore } from '@/stores/grocery'
import { useMealsStore } from '@/stores/meals'
import { useMaintenanceStore } from '@/stores/maintenance'
import PageHeader from '@/components/PageHeader.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'

const calendarStore = useCalendarStore()
const todosStore = useTodosStore()
const weatherStore = useWeatherStore()
const groceryStore = useGroceryStore()
const mealsStore = useMealsStore()
const maintenanceStore = useMaintenanceStore()

const mode = ref<'today' | 'week'>('today')
const loading = ref(true)

// Date helpers
const now = new Date()
const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`

function getWeekStart(date: Date): Date {
  const d = new Date(date)
  d.setDate(d.getDate() - d.getDay())
  return d
}

function getWeekEnd(date: Date): Date {
  const d = getWeekStart(date)
  d.setDate(d.getDate() + 6)
  return d
}

function dateToStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

const weekStartDate = getWeekStart(now)
const weekEndDate = getWeekEnd(now)
const weekStartStr = dateToStr(weekStartDate)
const weekEndStr = dateToStr(weekEndDate)

const weekDays = computed(() => {
  const days: { date: Date; dateStr: string; label: string; shortLabel: string }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStartDate)
    d.setDate(d.getDate() + i)
    days.push({
      date: d,
      dateStr: dateToStr(d),
      label: d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      shortLabel: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
    })
  }
  return days
})

// Greeting
const greeting = computed(() => {
  const hour = now.getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
})

const fullDate = computed(() => {
  return now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
})

// Helper functions (from CalendarView)
function getEventStyle(event: CalendarEvent) {
  const people = event.people || []
  if (people.length === 1) {
    return {
      backgroundColor: people[0].color + '30',
      borderLeft: `3px solid ${people[0].color}`,
      color: people[0].color
    }
  }
  if (people.length >= 2) {
    const colors = people.map(p => p.color + '30')
    const pct = 100 / colors.length
    const stops = colors.map((c, i) => `${c} ${i * pct}%, ${c} ${(i + 1) * pct}%`).join(', ')
    const borderColors = people.map(p => p.color)
    const borderStops = borderColors.map((c, i) => `${c} ${i * pct}%, ${c} ${(i + 1) * pct}%`).join(', ')
    return {
      background: `linear-gradient(to right, ${stops})`,
      borderLeft: '3px solid transparent',
      borderImage: `linear-gradient(to bottom, ${borderStops}) 1`,
      color: people[0].color
    }
  }
  if (event.event_type === 'holiday') {
    return { backgroundColor: 'rgb(99, 102, 241, 0.2)', borderLeft: '3px solid rgb(99, 102, 241)', color: 'rgb(79, 70, 229)' }
  }
  if (event.event_type === 'birthday') {
    return { backgroundColor: 'rgb(244, 63, 94, 0.2)', borderLeft: '3px solid rgb(244, 63, 94)', color: 'rgb(225, 29, 72)' }
  }
  return { backgroundColor: 'rgb(20, 184, 166, 0.2)', borderLeft: '3px solid rgb(20, 184, 166)', color: 'rgb(13, 148, 136)' }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${String(minutes).padStart(2, '0')}${period}`
}

// Schedule
function getEventsForDate(dateStr: string) {
  return calendarStore.events.filter(event => {
    const endDate = event.end_date || event.date
    return dateStr >= event.date && dateStr <= endDate
  }).sort((a, b) => {
    const aAllDay = a.all_day || !a.time
    const bAllDay = b.all_day || !b.time
    if (aAllDay && !bAllDay) return -1
    if (!aAllDay && bAllDay) return 1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    return a.title.localeCompare(b.title)
  })
}

const todayEvents = computed(() => getEventsForDate(todayStr))

const weekEventsByDay = computed(() => {
  return weekDays.value.map(day => ({
    ...day,
    events: getEventsForDate(day.dateStr)
  })).filter(day => day.events.length > 0)
})

// Todos
const todoDueToday = computed(() =>
  todosStore.activeTodos.filter(t => t.due_date === todayStr)
)

const todoOverdue = computed(() =>
  todosStore.activeTodos.filter(t => t.due_date && t.due_date < todayStr)
)

const todoNoDueDate = computed(() =>
  todosStore.activeTodos.filter(t => !t.due_date)
)

const todosByPerson = computed(() => {
  const map = new Map<string, typeof todosStore.activeTodos>()
  for (const todo of todosStore.activeTodos) {
    const key = todo.person_name || 'Unassigned'
    const existing = map.get(key) || []
    existing.push(todo)
    map.set(key, existing)
  }
  return map
})

// Meals
const mealTypes = ['breakfast', 'lunch', 'dinner'] as const

function getMeal(dateStr: string, type: string) {
  return mealsStore.mealsByDateAndType.get(`${dateStr}|${type}`)
}

function getMealTitle(dateStr: string, type: string) {
  const meal = getMeal(dateStr, type)
  if (!meal) return null
  return meal.recipe_title || meal.custom_title || null
}

const hasMeals = computed(() => mealsStore.mealPlanEntries.length > 0)

// Grocery
const uncheckedItems = computed(() => groceryStore.uncheckedItems)
const topGroceryItems = computed(() => uncheckedItems.value.slice(0, 5))
const remainingGroceryCount = computed(() => Math.max(0, uncheckedItems.value.length - 5))

// Maintenance
const hasMaintenanceAlerts = computed(() =>
  maintenanceStore.overdueItems.length > 0 || maintenanceStore.upcomingSoonItems.length > 0
)

function formatDueLabel(dateStr: string | null): string {
  if (!dateStr) return ''
  if (dateStr === todayStr) return 'Today'
  if (dateStr < todayStr) {
    const diff = Math.ceil((new Date(todayStr + 'T00:00:00').getTime() - new Date(dateStr + 'T00:00:00').getTime()) / 86400000)
    return `${diff}d overdue`
  }
  const diff = Math.ceil((new Date(dateStr + 'T00:00:00').getTime() - new Date(todayStr + 'T00:00:00').getTime()) / 86400000)
  return `in ${diff}d`
}

// Person summary (week mode)
const personSummary = computed(() => {
  if (calendarStore.familyMembers.length <= 1) return []
  return calendarStore.familyMembers.map(person => {
    const eventCount = calendarStore.events.filter(e => {
      const endDate = e.end_date || e.date
      const inWeek = e.date <= weekEndStr && endDate >= weekStartStr
      return inWeek && e.people?.some(p => p.id === person.id)
    }).length
    const todoCount = todosStore.activeTodos.filter(t => t.person_id === person.id).length
    return { ...person, eventCount, todoCount }
  })
})

// Weather subtitle
const weatherSubtitle = computed(() => {
  if (!weatherStore.current) return null
  const info = getWeatherInfo(weatherStore.current.weathercode)
  return `${info.emoji} ${Math.round(weatherStore.current.temperature)}°`
})

const contextSubtitle = computed(() => {
  const parts: string[] = []
  if (todayEvents.value.length > 0) parts.push(`${todayEvents.value.length} event${todayEvents.value.length > 1 ? 's' : ''} today`)
  if (todoOverdue.value.length > 0) parts.push(`${todoOverdue.value.length} overdue todo${todoOverdue.value.length > 1 ? 's' : ''}`)
  if (maintenanceStore.overdueItems.length > 0) parts.push(`${maintenanceStore.overdueItems.length} overdue task${maintenanceStore.overdueItems.length > 1 ? 's' : ''}`)
  if (parts.length === 0 && weatherSubtitle.value) return weatherSubtitle.value
  return parts.join(' · ') || 'All clear for today'
})

// Fetch all data
onMounted(async () => {
  const fetches = [
    calendarStore.fetchEvents(),
    calendarStore.fetchFamilyMembers(),
    todosStore.fetchTodos(),
    groceryStore.fetchItems(),
    mealsStore.fetchMealPlan(weekStartStr, weekEndStr),
    maintenanceStore.fetchItems()
  ]

  // Weather loads independently
  if (!weatherStore.hasLocation) {
    weatherStore.detectLocation()
  } else if (!weatherStore.current) {
    weatherStore.fetchWeather()
  }

  await Promise.all(fetches)
  loading.value = false
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <PageHeader title="Digest" :subtitle="mode === 'today' ? 'Here\'s your day' : 'Your week at a glance'">
      <template #actions>
        <div class="toggle-group">
          <button
            @click="mode = 'today'"
            class="toggle-btn"
            :class="mode === 'today' ? 'toggle-btn--active' : ''"
          >
            Today
          </button>
          <button
            @click="mode = 'week'"
            class="toggle-btn"
            :class="mode === 'week' ? 'toggle-btn--active' : ''"
          >
            Week
          </button>
        </div>
      </template>
    </PageHeader>

    <!-- Loading -->
    <div v-if="loading" class="py-16">
      <LoadingSpinner message="Loading your digest..." />
    </div>

    <template v-else>
      <!-- Greeting Banner -->
      <div class="bg-gradient-to-r from-emerald-500 to-teal-500 rounded-2xl p-5 sm:p-6 text-white">
        <h2 class="text-xl sm:text-2xl font-bold">{{ greeting }}</h2>
        <p class="text-emerald-100 mt-1">{{ fullDate }}</p>
        <p class="text-emerald-200 text-sm mt-2">{{ contextSubtitle }}</p>
      </div>

      <!-- Grid Layout -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <!-- Left Column -->
        <div class="lg:col-span-2 space-y-4 sm:space-y-6">

          <!-- Schedule -->
          <div class="card p-4 sm:p-5">
            <div class="section-header">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Schedule
              </h3>
              <RouterLink to="/calendar" class="link">View calendar</RouterLink>
            </div>

            <!-- Today mode -->
            <template v-if="mode === 'today'">
              <div v-if="todayEvents.length === 0" class="empty-text">
                No events today
              </div>
              <div v-else class="space-y-2">
                <div
                  v-for="event in todayEvents"
                  :key="event.id"
                  class="px-3 py-2 rounded-lg text-sm font-medium"
                  :style="getEventStyle(event)"
                >
                  <div class="flex items-center gap-2">
                    <span v-if="event.event_type === 'holiday'">&#x2B50;</span>
                    <span v-else-if="event.event_type === 'birthday'">&#x1F382;</span>
                    <span>{{ event.title }}</span>
                  </div>
                  <div v-if="!event.all_day && event.time" class="text-xs mt-0.5 opacity-75">
                    {{ formatTime(event.time) }}<template v-if="event.end_time"> - {{ formatTime(event.end_time) }}</template>
                  </div>
                  <div v-else-if="event.all_day" class="text-xs mt-0.5 opacity-75">All day</div>
                </div>
              </div>
            </template>

            <!-- Week mode -->
            <template v-else>
              <div v-if="weekEventsByDay.length === 0" class="empty-text">
                No events this week
              </div>
              <div v-else class="space-y-4">
                <div v-for="day in weekEventsByDay" :key="day.dateStr">
                  <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2"
                    :class="{ 'text-emerald-600 dark:text-emerald-400': day.dateStr === todayStr }">
                    {{ day.shortLabel }}
                    <span v-if="day.dateStr === todayStr" class="ml-1 text-emerald-500">· Today</span>
                  </div>
                  <div class="space-y-1.5">
                    <div
                      v-for="event in day.events"
                      :key="event.id"
                      class="px-3 py-2 rounded-lg text-sm font-medium"
                      :style="getEventStyle(event)"
                    >
                      <div class="flex items-center gap-2">
                        <span v-if="event.event_type === 'holiday'">&#x2B50;</span>
                        <span v-else-if="event.event_type === 'birthday'">&#x1F382;</span>
                        <span>{{ event.title }}</span>
                      </div>
                      <div v-if="!event.all_day && event.time" class="text-xs mt-0.5 opacity-75">
                        {{ formatTime(event.time) }}<template v-if="event.end_time"> - {{ formatTime(event.end_time) }}</template>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Todos -->
          <div class="card p-4 sm:p-5">
            <div class="section-header">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                </svg>
                Todos
              </h3>
              <RouterLink to="/todos" class="link">View all</RouterLink>
            </div>

            <!-- Today mode -->
            <template v-if="mode === 'today'">
              <div v-if="todoOverdue.length === 0 && todoDueToday.length === 0 && todoNoDueDate.length === 0" class="empty-text">
                Nothing due today
              </div>
              <div v-else class="space-y-4">
                <!-- Overdue -->
                <div v-if="todoOverdue.length > 0">
                  <div class="text-xs font-semibold text-red-500 uppercase mb-2">Overdue ({{ todoOverdue.length }})</div>
                  <div class="space-y-1.5">
                    <div v-for="todo in todoOverdue" :key="todo.id"
                      class="flex items-center gap-2 alert-row alert-row--danger">
                      <span v-if="todo.person_color" class="color-dot" :style="{ backgroundColor: todo.person_color }"></span>
                      <span class="text-gray-900 dark:text-white flex-1 truncate">{{ todo.title }}</span>
                      <span v-if="todo.category_name" class="badge">{{ todo.category_name }}</span>
                      <span class="text-xs text-red-500 flex-shrink-0">{{ formatDueLabel(todo.due_date) }}</span>
                    </div>
                  </div>
                </div>
                <!-- Due Today -->
                <div v-if="todoDueToday.length > 0">
                  <div class="text-xs font-semibold text-amber-500 uppercase mb-2">Due Today ({{ todoDueToday.length }})</div>
                  <div class="space-y-1.5">
                    <div v-for="todo in todoDueToday" :key="todo.id"
                      class="flex items-center gap-2 alert-row alert-row--warning">
                      <span v-if="todo.person_color" class="color-dot" :style="{ backgroundColor: todo.person_color }"></span>
                      <span class="text-gray-900 dark:text-white flex-1 truncate">{{ todo.title }}</span>
                      <span v-if="todo.category_name" class="badge">{{ todo.category_name }}</span>
                    </div>
                  </div>
                </div>
                <!-- No Due Date -->
                <div v-if="todoNoDueDate.length > 0">
                  <div class="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-2">No Due Date ({{ todoNoDueDate.length }})</div>
                  <div class="space-y-1.5">
                    <div v-for="todo in todoNoDueDate" :key="todo.id"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                      <span v-if="todo.person_color" class="color-dot" :style="{ backgroundColor: todo.person_color }"></span>
                      <span class="text-gray-900 dark:text-white flex-1 truncate">{{ todo.title }}</span>
                      <span v-if="todo.category_name" class="badge">{{ todo.category_name }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Week mode -->
            <template v-else>
              <div v-if="todosStore.activeTodos.length === 0" class="empty-text">
                No active todos
              </div>
              <div v-else class="space-y-4">
                <div v-for="[person, todos] in todosByPerson" :key="person">
                  <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase mb-2">{{ person }} ({{ todos.length }})</div>
                  <div class="space-y-1.5">
                    <div v-for="todo in todos.slice(0, 5)" :key="todo.id"
                      class="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50 text-sm">
                      <span v-if="todo.person_color" class="color-dot" :style="{ backgroundColor: todo.person_color }"></span>
                      <span class="text-gray-900 dark:text-white flex-1 truncate">{{ todo.title }}</span>
                      <span v-if="todo.category_name" class="badge">{{ todo.category_name }}</span>
                      <span v-if="todo.due_date" class="text-xs text-gray-400 flex-shrink-0">{{ formatDueLabel(todo.due_date) }}</span>
                    </div>
                    <div v-if="todos.length > 5" class="text-xs text-gray-400 dark:text-gray-500 pl-3">
                      +{{ todos.length - 5 }} more
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- Meal Plan -->
          <div v-if="hasMeals" class="card p-4 sm:p-5">
            <div class="section-header">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
                Meal Plan
              </h3>
              <RouterLink to="/meals" class="link">View meals</RouterLink>
            </div>

            <!-- Today mode -->
            <template v-if="mode === 'today'">
              <div class="space-y-2">
                <div v-for="type in mealTypes" :key="type"
                  class="flex items-center gap-3 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-700/50">
                  <span class="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 w-16 flex-shrink-0">{{ type }}</span>
                  <span v-if="getMealTitle(todayStr, type)" class="text-sm text-gray-900 dark:text-white truncate">{{ getMealTitle(todayStr, type) }}</span>
                  <span v-else class="text-sm text-gray-400 dark:text-gray-500 italic">Not planned</span>
                </div>
              </div>
            </template>

            <!-- Week mode -->
            <template v-else>
              <div class="overflow-x-auto -mx-4 sm:-mx-5 px-4 sm:px-5">
                <table class="w-full text-sm min-w-[500px]">
                  <thead>
                    <tr>
                      <th class="text-left text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase pb-2 pr-3 w-12"></th>
                      <th v-for="day in weekDays" :key="day.dateStr"
                        class="text-center text-xs font-semibold uppercase pb-2 px-1"
                        :class="day.dateStr === todayStr ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-gray-500'">
                        {{ day.date.toLocaleDateString('en-US', { weekday: 'short' }) }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr v-for="type in mealTypes" :key="type">
                      <td class="text-xs font-semibold uppercase text-gray-400 dark:text-gray-500 pr-3 py-1.5">{{ type.charAt(0).toUpperCase() }}</td>
                      <td v-for="day in weekDays" :key="day.dateStr" class="text-center px-1 py-1.5">
                        <span v-if="getMealTitle(day.dateStr, type)"
                          class="text-xs text-gray-700 dark:text-gray-300 truncate block max-w-[80px]"
                          :title="getMealTitle(day.dateStr, type) ?? ''">
                          {{ getMealTitle(day.dateStr, type) }}
                        </span>
                        <span v-else class="text-xs text-gray-300 dark:text-gray-600">-</span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </template>
          </div>
        </div>

        <!-- Right Column -->
        <div class="space-y-4 sm:space-y-6">

          <!-- Weather -->
          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-yellow-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
                </svg>
                Weather
              </h3>
            </div>

            <template v-if="!weatherStore.hasLocation">
              <p class="text-sm text-gray-400 dark:text-gray-500 mb-2">No location set</p>
              <RouterLink to="/weather" class="link">Set up weather</RouterLink>
            </template>

            <template v-else-if="weatherStore.loading">
              <div class="space-y-2 animate-pulse">
                <div class="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                <div class="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
              </div>
            </template>

            <template v-else-if="weatherStore.current">
              <div class="flex items-center gap-3 mb-3">
                <span class="text-3xl">{{ getWeatherInfo(weatherStore.current.weathercode).emoji }}</span>
                <div>
                  <div class="text-2xl font-bold text-gray-900 dark:text-white">{{ Math.round(weatherStore.current.temperature) }}°F</div>
                  <div class="text-xs text-gray-500 dark:text-gray-400">{{ getWeatherInfo(weatherStore.current.weathercode).label }}</div>
                </div>
              </div>
              <div v-if="weatherStore.daily.length > 0" class="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                <span>H: {{ Math.round(weatherStore.daily[0].high) }}°</span>
                <span>L: {{ Math.round(weatherStore.daily[0].low) }}°</span>
                <span v-if="weatherStore.daily[0].precipitationProbability > 0">
                  {{ weatherStore.daily[0].precipitationProbability }}% precip
                </span>
              </div>
            </template>
          </div>

          <!-- Grocery -->
          <div class="card p-4 sm:p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                Grocery List
              </h3>
              <RouterLink to="/grocery" class="link">View list</RouterLink>
            </div>

            <div v-if="uncheckedItems.length === 0" class="text-sm text-gray-400 dark:text-gray-500">
              Shopping list is empty
            </div>
            <template v-else>
              <div class="text-xs text-gray-500 dark:text-gray-400 mb-2">{{ uncheckedItems.length }} item{{ uncheckedItems.length !== 1 ? 's' : '' }} to get</div>
              <div class="space-y-1">
                <div v-for="item in topGroceryItems" :key="item.id"
                  class="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                  <span class="w-1.5 h-1.5 rounded-full bg-gray-300 dark:bg-gray-600 flex-shrink-0"></span>
                  <span class="truncate">{{ item.name }}</span>
                  <span v-if="item.quantity" class="text-xs text-gray-400 dark:text-gray-500 flex-shrink-0">{{ item.quantity }}{{ item.unit ? ` ${item.unit}` : '' }}</span>
                </div>
                <div v-if="remainingGroceryCount > 0" class="text-xs text-gray-400 dark:text-gray-500 pl-4">
                  +{{ remainingGroceryCount }} more
                </div>
              </div>
            </template>
          </div>

          <!-- Maintenance Alerts -->
          <div v-if="hasMaintenanceAlerts" class="card p-4 sm:p-5">
            <div class="flex items-center justify-between mb-3">
              <h3 class="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <svg class="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Maintenance
              </h3>
              <RouterLink to="/maintenance" class="link">View all</RouterLink>
            </div>

            <div class="space-y-2">
              <!-- Overdue -->
              <div v-for="item in maintenanceStore.overdueItems" :key="item.id"
                class="alert-row alert-row--danger">
                <div class="flex items-center gap-2">
                  <span v-if="item.category_icon" class="flex-shrink-0">{{ item.category_icon }}</span>
                  <span class="text-gray-900 dark:text-white flex-1 truncate font-medium">{{ item.title }}</span>
                  <span class="text-xs text-red-500 flex-shrink-0">{{ formatDueLabel(item.next_due_date) }}</span>
                </div>
                <div v-if="item.person_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                  <span v-if="item.person_color" class="color-dot" :style="{ backgroundColor: item.person_color }"></span>
                  {{ item.person_name }}
                </div>
              </div>
              <!-- Upcoming soon -->
              <div v-for="item in maintenanceStore.upcomingSoonItems" :key="item.id"
                class="alert-row alert-row--warning">
                <div class="flex items-center gap-2">
                  <span v-if="item.category_icon" class="flex-shrink-0">{{ item.category_icon }}</span>
                  <span class="text-gray-900 dark:text-white flex-1 truncate font-medium">{{ item.title }}</span>
                  <span class="text-xs text-amber-600 dark:text-amber-400 flex-shrink-0">{{ formatDueLabel(item.next_due_date) }}</span>
                </div>
                <div v-if="item.person_name" class="text-xs text-gray-500 dark:text-gray-400 mt-0.5 flex items-center gap-1">
                  <span v-if="item.person_color" class="color-dot" :style="{ backgroundColor: item.person_color }"></span>
                  {{ item.person_name }}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Person Summary (week mode only, multiple family members) -->
      <div v-if="mode === 'week' && personSummary.length > 0" class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        <div v-for="person in personSummary" :key="person.id"
          class="card p-4 flex items-center gap-3">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
            :style="{ backgroundColor: person.color }">
            {{ person.name.charAt(0).toUpperCase() }}
          </div>
          <div class="min-w-0">
            <div class="text-sm font-medium text-gray-900 dark:text-white truncate">{{ person.name }}</div>
            <div class="text-xs text-gray-500 dark:text-gray-400">
              {{ person.eventCount }} event{{ person.eventCount !== 1 ? 's' : '' }} · {{ person.todoCount }} todo{{ person.todoCount !== 1 ? 's' : '' }}
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
