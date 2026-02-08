<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCalendarStore, type CalendarEvent } from '@/stores/calendar'
import { useTodosStore, type TodoItem } from '@/stores/todos'

const store = useCalendarStore()
const todosStore = useTodosStore()

const currentDate = ref(new Date())
const viewMode = ref<'month' | 'week'>('month')
const showEventModal = ref(false)
const showPersonModal = ref(false)
const selectedDate = ref('')
const editingEvent = ref<CalendarEvent | null>(null)

// Event form
const eventForm = ref({
  title: '',
  description: '',
  date: '',
  end_date: '',
  time: '',
  end_time: '',
  all_day: true,
  multi_day: false,
  person_id: null as number | null
})

// Person form
const personForm = ref({
  name: '',
  color: '#10b981'
})

const personColors = [
  '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f97316', '#6366f1'
]

const currentYear = computed(() => currentDate.value.getFullYear())
const currentMonth = computed(() => currentDate.value.getMonth())

const monthName = computed(() => {
  return currentDate.value.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
})

// Week view computeds
const weekStart = computed(() => {
  const date = new Date(currentDate.value)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  return date
})

const weekDays = computed(() => {
  const days: { date: Date; dateStr: string; dayName: string; dayNameShort: string; dayNum: number; monthName: string }[] = []
  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart.value)
    date.setDate(date.getDate() + i)
    days.push({
      date,
      dateStr: date.toISOString().split('T')[0],
      dayName: date.toLocaleDateString('en-US', { weekday: 'short' }),
      dayNameShort: date.toLocaleDateString('en-US', { weekday: 'narrow' }),
      dayNum: date.getDate(),
      monthName: date.toLocaleDateString('en-US', { month: 'short' })
    })
  }
  return days
})

const weekLabel = computed(() => {
  const start = weekDays.value[0]
  const end = weekDays.value[6]
  if (start.date.getMonth() === end.date.getMonth()) {
    return `${start.monthName} ${start.dayNum} - ${end.dayNum}, ${start.date.getFullYear()}`
  }
  return `${start.monthName} ${start.dayNum} - ${end.monthName} ${end.dayNum}, ${end.date.getFullYear()}`
})

const daysInMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value + 1, 0).getDate()
})

const firstDayOfMonth = computed(() => {
  return new Date(currentYear.value, currentMonth.value, 1).getDay()
})

const calendarDays = computed(() => {
  const days: { date: number; currentMonth: boolean; dateStr: string }[] = []

  // Previous month days
  const prevMonthDays = new Date(currentYear.value, currentMonth.value, 0).getDate()
  for (let i = firstDayOfMonth.value - 1; i >= 0; i--) {
    const day = prevMonthDays - i
    const prevMonth = currentMonth.value === 0 ? 12 : currentMonth.value
    const prevYear = currentMonth.value === 0 ? currentYear.value - 1 : currentYear.value
    days.push({
      date: day,
      currentMonth: false,
      dateStr: `${prevYear}-${String(prevMonth).padStart(2, '0')}-${String(day).padStart(2, '0')}`
    })
  }

  // Current month days
  for (let i = 1; i <= daysInMonth.value; i++) {
    days.push({
      date: i,
      currentMonth: true,
      dateStr: `${currentYear.value}-${String(currentMonth.value + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    })
  }

  // Next month days to fill the grid
  const remainingDays = 42 - days.length
  for (let i = 1; i <= remainingDays; i++) {
    const nextMonth = currentMonth.value === 11 ? 1 : currentMonth.value + 2
    const nextYear = currentMonth.value === 11 ? currentYear.value + 1 : currentYear.value
    days.push({
      date: i,
      currentMonth: false,
      dateStr: `${nextYear}-${String(nextMonth).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    })
  }

  return days
})

const todosWithDueDates = computed(() =>
  todosStore.todos.filter(t => t.due_date && !t.completed)
)

const todosByDate = computed(() => {
  const map = new Map<string, TodoItem[]>()
  for (const todo of todosWithDueDates.value) {
    const existing = map.get(todo.due_date!) || []
    existing.push(todo)
    map.set(todo.due_date!, existing)
  }
  return map
})

const eventsByDate = computed(() => {
  const map = new Map<string, { event: CalendarEvent; isStart: boolean; isEnd: boolean; isMid: boolean }[]>()

  for (const event of store.events) {
    const startDate = new Date(event.date + 'T00:00:00')
    const endDate = event.end_date ? new Date(event.end_date + 'T00:00:00') : startDate

    // Add event to each day it spans
    const current = new Date(startDate)
    while (current <= endDate) {
      const dateStr = current.toISOString().split('T')[0]
      const existing = map.get(dateStr) || []
      existing.push({
        event,
        isStart: current.getTime() === startDate.getTime(),
        isEnd: current.getTime() === endDate.getTime(),
        isMid: current.getTime() !== startDate.getTime() && current.getTime() !== endDate.getTime()
      })
      map.set(dateStr, existing)
      current.setDate(current.getDate() + 1)
    }
  }
  return map
})

const isToday = (dateStr: string) => {
  const now = new Date()
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  return dateStr === today
}

function getEventStyle(event: CalendarEvent) {
  if (event.person_color) {
    return {
      backgroundColor: event.person_color + '30',
      borderLeft: `3px solid ${event.person_color}`,
      color: event.person_color
    }
  }
  // Shared event - use a nice teal/cyan color that's readable in both modes
  return {
    backgroundColor: 'rgb(20, 184, 166, 0.2)',
    borderLeft: '3px solid rgb(20, 184, 166)',
    color: 'rgb(13, 148, 136)'
  }
}

function formatTime(time: string): string {
  const [hours, minutes] = time.split(':').map(Number)
  const period = hours >= 12 ? 'pm' : 'am'
  const hour12 = hours % 12 || 12
  return minutes === 0 ? `${hour12}${period}` : `${hour12}:${String(minutes).padStart(2, '0')}${period}`
}

function prevMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value - 1, 1)
}

function nextMonth() {
  currentDate.value = new Date(currentYear.value, currentMonth.value + 1, 1)
}

function prevWeek() {
  const date = new Date(currentDate.value)
  date.setDate(date.getDate() - 7)
  currentDate.value = date
}

function nextWeek() {
  const date = new Date(currentDate.value)
  date.setDate(date.getDate() + 7)
  currentDate.value = date
}

function prev() {
  if (viewMode.value === 'month') {
    prevMonth()
  } else {
    prevWeek()
  }
}

function next() {
  if (viewMode.value === 'month') {
    nextMonth()
  } else {
    nextWeek()
  }
}

function goToToday() {
  currentDate.value = new Date()
}

function getEventsForDay(dateStr: string) {
  return store.events.filter(event => {
    const startDate = event.date
    const endDate = event.end_date || event.date
    return dateStr >= startDate && dateStr <= endDate
  }).sort((a, b) => {
    // All-day events first, then by time
    if (a.all_day && !b.all_day) return -1
    if (!a.all_day && b.all_day) return 1
    if (a.time && b.time) return a.time.localeCompare(b.time)
    return 0
  })
}

function getTodosForDay(dateStr: string) {
  return todosByDate.value.get(dateStr) || []
}

function getTodoStyle(todo: TodoItem) {
  const color = todo.person_color || '#14b8a6'
  return {
    borderLeft: `3px dashed ${color}`,
    backgroundColor: color + '1a',
    color
  }
}

// Fetch events based on current view
function fetchEventsForView() {
  if (viewMode.value === 'month') {
    store.fetchEvents(currentMonth.value + 1, currentYear.value)
  } else {
    // For week view, fetch all events (the API returns all if no month specified)
    store.fetchEvents()
  }
}

function openAddEvent(dateStr: string) {
  editingEvent.value = null
  eventForm.value = {
    title: '',
    description: '',
    date: dateStr,
    end_date: '',
    time: '',
    end_time: '',
    all_day: true,
    multi_day: false,
    person_id: null
  }
  selectedDate.value = dateStr
  showEventModal.value = true
}

function openEditEvent(event: CalendarEvent) {
  editingEvent.value = event
  const hasEndDate = event.end_date && event.end_date !== event.date
  eventForm.value = {
    title: event.title,
    description: event.description || '',
    date: event.date,
    end_date: event.end_date || '',
    time: event.time || '',
    end_time: event.end_time || '',
    all_day: event.all_day === 1,
    multi_day: !!hasEndDate,
    person_id: event.person_id
  }
  showEventModal.value = true
}

async function saveEvent() {
  if (!eventForm.value.title || !eventForm.value.date) return

  const endDate = eventForm.value.multi_day && eventForm.value.end_date ? eventForm.value.end_date : null
  const endTime = !eventForm.value.all_day && eventForm.value.end_time ? eventForm.value.end_time : null

  if (editingEvent.value) {
    await store.updateEvent(editingEvent.value.id, {
      title: eventForm.value.title,
      description: eventForm.value.description || null,
      date: eventForm.value.date,
      end_date: endDate,
      time: eventForm.value.all_day ? null : eventForm.value.time || null,
      end_time: endTime,
      all_day: eventForm.value.all_day ? 1 : 0,
      person_id: eventForm.value.person_id
    })
  } else {
    await store.addEvent({
      title: eventForm.value.title,
      description: eventForm.value.description || undefined,
      date: eventForm.value.date,
      end_date: endDate || undefined,
      time: eventForm.value.all_day ? undefined : eventForm.value.time || undefined,
      end_time: endTime || undefined,
      all_day: eventForm.value.all_day,
      person_id: eventForm.value.person_id
    })
  }

  // Refetch events to ensure the calendar updates
  await fetchEventsForView()
  showEventModal.value = false
}

async function deleteEvent() {
  if (editingEvent.value) {
    await store.deleteEvent(editingEvent.value.id)
    await fetchEventsForView()
    showEventModal.value = false
  }
}

async function savePerson() {
  if (!personForm.value.name) return

  await store.addFamilyMember(personForm.value.name, personForm.value.color)
  personForm.value = { name: '', color: '#10b981' }
  showPersonModal.value = false
}

async function deletePerson(id: number) {
  await store.deleteFamilyMember(id)
}

// Fetch data on mount and when view changes
onMounted(() => {
  store.fetchFamilyMembers()
  fetchEventsForView()
  todosStore.fetchTodos()
})

watch([currentDate, viewMode], () => {
  fetchEventsForView()
})
</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
      <div>
        <h1 class="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">Calendar</h1>
        <p class="text-gray-500 dark:text-gray-400 mt-1 text-sm">Family events and schedules</p>
      </div>

      <button
        @click="showPersonModal = true"
        class="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-medium transition-colors text-sm sm:text-base"
      >
        Manage People
      </button>
    </div>

    <!-- Calendar -->
    <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
      <!-- Loading State -->
      <div v-if="store.loading && !store.initialized" class="p-16">
        <div class="flex flex-col items-center justify-center gap-3">
          <div class="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
          <span class="text-gray-500 dark:text-gray-400 text-sm">Loading calendar...</span>
        </div>
      </div>

      <template v-else>
      <!-- Calendar Header -->
      <div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700">
        <button
          @click="prev"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>

        <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <h2 class="text-base sm:text-xl font-semibold text-gray-900 dark:text-white text-center">
            {{ viewMode === 'month' ? monthName : weekLabel }}
          </h2>
          <div class="flex items-center gap-2">
            <button
              @click="goToToday"
              class="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Today
            </button>
            <!-- View Toggle -->
            <div class="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
              <button
                @click="viewMode = 'week'"
                class="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors"
                :class="viewMode === 'week' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'"
              >
                Week
              </button>
              <button
                @click="viewMode = 'month'"
                class="px-2 sm:px-3 py-1 text-xs sm:text-sm rounded-md transition-colors"
                :class="viewMode === 'month' ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm' : 'text-gray-600 dark:text-gray-400'"
              >
                Month
              </button>
            </div>
          </div>
        </div>

        <button
          @click="next"
          class="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>

      <!-- MONTH VIEW -->
      <template v-if="viewMode === 'month'">
        <!-- Day Headers -->
        <div class="grid grid-cols-7 border-b border-gray-100 dark:border-gray-700">
          <div
            v-for="(day, i) in ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']"
            :key="day"
            class="py-2 sm:py-3 text-center text-xs sm:text-sm font-medium text-gray-500 dark:text-gray-400"
          >
            <span class="hidden sm:inline">{{ day }}</span>
            <span class="sm:hidden">{{ ['S','M','T','W','T','F','S'][i] }}</span>
          </div>
        </div>

        <!-- Calendar Grid -->
        <div class="grid grid-cols-7">
          <div
            v-for="(day, index) in calendarDays"
            :key="index"
            @click="openAddEvent(day.dateStr)"
            class="min-h-16 sm:min-h-32 p-1 sm:p-2 border-b border-r border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
            :class="{
              'bg-gray-50 dark:bg-gray-800/50': !day.currentMonth,
              'bg-emerald-50 dark:bg-emerald-900/30': isToday(day.dateStr)
            }"
          >
            <div class="flex items-center justify-center mb-1 sm:mb-2">
              <span
                class="w-6 h-6 sm:w-8 sm:h-8 flex items-center justify-center text-xs sm:text-sm rounded-full"
                :class="{
                  'text-gray-400 dark:text-gray-600': !day.currentMonth,
                  'text-gray-900 dark:text-white': day.currentMonth && !isToday(day.dateStr),
                  'bg-emerald-500 text-white font-semibold': isToday(day.dateStr)
                }"
              >
                {{ day.date }}
              </span>
            </div>

            <!-- Events for this day -->
            <div class="space-y-0.5 sm:space-y-1">
              <div
                v-for="({ event, isStart, isEnd, isMid }, idx) in (eventsByDate.get(day.dateStr) || []).slice(0, 3)"
                :key="`${event.id}-${idx}`"
                @click.stop="openEditEvent(event)"
                class="px-1 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs truncate cursor-pointer hover:opacity-80 transition-opacity font-medium"
                :class="{
                  'rounded': !event.end_date || event.end_date === event.date,
                  'rounded-l': isStart && event.end_date && event.end_date !== event.date,
                  'rounded-r': isEnd && event.end_date && event.end_date !== event.date,
                  'rounded-none': isMid
                }"
                :style="getEventStyle(event)"
              >
                <template v-if="isStart">
                  <span v-if="event.time" class="opacity-75 hidden sm:inline">{{ formatTime(event.time) }}<template v-if="event.end_time && (!event.end_date || event.end_date === event.date)">-{{ formatTime(event.end_time) }}</template></span>
                  {{ event.title }}
                </template>
                <template v-else-if="isEnd && event.end_time">
                  <span class="opacity-75 hidden sm:inline">ends {{ formatTime(event.end_time) }}</span>
                  <span class="sm:hidden opacity-50">{{ event.title }}</span>
                </template>
                <template v-else>
                  <span class="opacity-50">{{ event.title }}</span>
                </template>
              </div>
              <!-- Todos with due dates -->
              <div
                v-for="todo in getTodosForDay(day.dateStr).slice(0, Math.max(0, 3 - (eventsByDate.get(day.dateStr) || []).length))"
                :key="`todo-${todo.id}`"
                @click.stop
                class="px-1 sm:px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs truncate rounded font-medium flex items-center gap-1"
                :style="getTodoStyle(todo)"
              >
                <svg class="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                {{ todo.title }}
              </div>
              <div
                v-if="(eventsByDate.get(day.dateStr) || []).length + getTodosForDay(day.dateStr).length > 3"
                class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400 pl-1"
              >
                +{{ (eventsByDate.get(day.dateStr) || []).length + getTodosForDay(day.dateStr).length - 3 }} more
              </div>
            </div>
          </div>
        </div>
      </template>

      <!-- WEEK VIEW -->
      <template v-else>
        <!-- Mobile: stacked list -->
        <div class="flex flex-col md:hidden divide-y divide-gray-100 dark:divide-gray-700">
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
          >
            <!-- Day Header -->
            <div
              @click="openAddEvent(day.dateStr)"
              class="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              :class="{ 'bg-emerald-50 dark:bg-emerald-900/20': isToday(day.dateStr) }"
            >
              <div
                class="w-10 h-10 flex items-center justify-center text-lg font-semibold rounded-full flex-shrink-0"
                :class="isToday(day.dateStr) ? 'bg-emerald-500 text-white' : 'text-gray-900 dark:text-white'"
              >
                {{ day.dayNum }}
              </div>
              <div class="text-sm font-medium text-gray-500 dark:text-gray-400">{{ day.dayName }}</div>
              <div class="flex-1"></div>
              <svg class="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
              </svg>
            </div>

            <!-- Events -->
            <div v-if="getEventsForDay(day.dateStr).length > 0 || getTodosForDay(day.dateStr).length > 0" class="px-4 pb-3 space-y-2">
              <div
                v-for="event in getEventsForDay(day.dateStr)"
                :key="event.id"
                @click="openEditEvent(event)"
                class="p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                :style="getEventStyle(event)"
              >
                <div class="font-medium text-sm">{{ event.title }}</div>
                <div v-if="!event.all_day && event.time" class="text-xs mt-1 opacity-75">
                  {{ formatTime(event.time) }}
                  <template v-if="event.end_time">- {{ formatTime(event.end_time) }}</template>
                </div>
                <div v-else-if="event.all_day" class="text-xs mt-1 opacity-75">All day</div>
                <div v-if="event.person_name" class="text-xs mt-1 opacity-75">{{ event.person_name }}</div>
              </div>

              <div
                v-for="todo in getTodosForDay(day.dateStr)"
                :key="`todo-${todo.id}`"
                class="p-3 rounded-lg"
                :style="getTodoStyle(todo)"
              >
                <div class="font-medium text-sm flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {{ todo.title }}
                </div>
                <div v-if="todo.person_name" class="text-xs mt-1 opacity-75">{{ todo.person_name }}</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Desktop: side-by-side grid -->
        <div class="hidden md:grid grid-cols-7 divide-x divide-gray-100 dark:divide-gray-700">
          <div
            v-for="day in weekDays"
            :key="day.dateStr"
            class="min-h-[500px] flex flex-col"
          >
            <!-- Day Header -->
            <div
              @click="openAddEvent(day.dateStr)"
              class="p-3 text-center border-b border-gray-100 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50"
              :class="{ 'bg-emerald-50 dark:bg-emerald-900/20': isToday(day.dateStr) }"
            >
              <div class="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">{{ day.dayName }}</div>
              <div
                class="mt-1 w-10 h-10 mx-auto flex items-center justify-center text-lg font-semibold rounded-full"
                :class="isToday(day.dateStr) ? 'bg-emerald-500 text-white' : 'text-gray-900 dark:text-white'"
              >
                {{ day.dayNum }}
              </div>
            </div>

            <!-- Events -->
            <div class="flex-1 p-2 space-y-2 overflow-y-auto">
              <div
                v-for="event in getEventsForDay(day.dateStr)"
                :key="event.id"
                @click="openEditEvent(event)"
                class="p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                :style="getEventStyle(event)"
              >
                <div class="font-medium text-sm">{{ event.title }}</div>
                <div v-if="!event.all_day && event.time" class="text-xs mt-1 opacity-75">
                  {{ formatTime(event.time) }}
                  <template v-if="event.end_time">- {{ formatTime(event.end_time) }}</template>
                </div>
                <div v-else-if="event.all_day" class="text-xs mt-1 opacity-75">All day</div>
                <div v-if="event.description" class="text-xs mt-2 opacity-60 line-clamp-2">{{ event.description }}</div>
                <div v-if="event.person_name" class="text-xs mt-2 opacity-75">{{ event.person_name }}</div>
              </div>

              <!-- Todos with due dates -->
              <div
                v-for="todo in getTodosForDay(day.dateStr)"
                :key="`todo-${todo.id}`"
                class="p-3 rounded-lg"
                :style="getTodoStyle(todo)"
              >
                <div class="font-medium text-sm flex items-center gap-1.5">
                  <svg class="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  {{ todo.title }}
                </div>
                <div v-if="todo.person_name" class="text-xs mt-1 opacity-75">{{ todo.person_name }}</div>
              </div>

              <!-- Add event button -->
              <button
                @click="openAddEvent(day.dateStr)"
                class="w-full py-2 flex items-center justify-center gap-1 text-gray-400 dark:text-gray-500 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-gray-100 dark:hover:bg-gray-700/50 rounded-lg transition-colors text-sm"
              >
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                </svg>
                <span>Add</span>
              </button>
            </div>
          </div>
        </div>
      </template>
      </template>
    </div>

    <!-- Family Members Legend -->
    <div v-if="store.familyMembers.length > 0" class="flex flex-wrap gap-2 sm:gap-3">
      <div
        v-for="person in store.familyMembers"
        :key="person.id"
        class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700"
      >
        <span class="w-3 h-3 rounded-full" :style="{ backgroundColor: person.color }"></span>
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ person.name }}</span>
      </div>
    </div>

    <!-- Event Modal -->
    <div
      v-if="showEventModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showEventModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {{ editingEvent ? 'Edit Event' : 'Add Event' }}
        </h3>

        <form @submit.prevent="saveEvent" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Title</label>
            <input
              v-model="eventForm.title"
              type="text"
              required
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              placeholder="Event title"
            />
          </div>

          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {{ eventForm.multi_day ? 'Start Date' : 'Date' }}
              </label>
              <input
                v-model="eventForm.date"
                type="date"
                required
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
            <div v-if="eventForm.multi_day">
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
              <input
                v-model="eventForm.end_date"
                type="date"
                :min="eventForm.date"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div class="flex items-center gap-4">
            <div class="flex items-center gap-2">
              <input
                v-model="eventForm.all_day"
                type="checkbox"
                id="all_day"
                class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
              />
              <label for="all_day" class="text-sm text-gray-700 dark:text-gray-300">All day</label>
            </div>
            <div class="flex items-center gap-2">
              <input
                v-model="eventForm.multi_day"
                type="checkbox"
                id="multi_day"
                class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
              />
              <label for="multi_day" class="text-sm text-gray-700 dark:text-gray-300">Multi-day</label>
            </div>
          </div>

          <div v-if="!eventForm.all_day" class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Time</label>
              <input
                v-model="eventForm.time"
                type="time"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Time <span class="font-normal text-gray-400">(optional)</span></label>
              <input
                v-model="eventForm.end_time"
                type="time"
                class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Assign to</label>
            <select
              v-model="eventForm.person_id"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="null">No one (shared)</option>
              <option v-for="person in store.familyMembers" :key="person.id" :value="person.id">
                {{ person.name }}
              </option>
            </select>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
            <textarea
              v-model="eventForm.description"
              rows="2"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white resize-none"
              placeholder="Optional description"
            ></textarea>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              v-if="editingEvent"
              type="button"
              @click="deleteEvent"
              class="px-4 py-2.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-xl font-medium hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
            >
              Delete
            </button>
            <div class="flex-1"></div>
            <button
              type="button"
              @click="showEventModal = false"
              class="px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              class="px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors"
            >
              {{ editingEvent ? 'Save' : 'Add' }}
            </button>
          </div>
        </form>
      </div>
    </div>

    <!-- People Modal -->
    <div
      v-if="showPersonModal"
      class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      @click.self="showPersonModal = false"
    >
      <div class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-md p-6">
        <h3 class="text-lg font-semibold text-gray-900 dark:text-white mb-4">Manage Family Members</h3>

        <!-- Existing members -->
        <div v-if="store.familyMembers.length > 0" class="space-y-2 mb-6">
          <div
            v-for="person in store.familyMembers"
            :key="person.id"
            class="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl"
          >
            <div class="flex items-center gap-3">
              <span class="w-4 h-4 rounded-full" :style="{ backgroundColor: person.color }"></span>
              <span class="text-gray-900 dark:text-white">{{ person.name }}</span>
            </div>
            <button
              @click="deletePerson(person.id)"
              class="p-1 text-gray-400 hover:text-red-500 transition-colors"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </button>
          </div>
        </div>

        <!-- Add new member -->
        <form @submit.prevent="savePerson" class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
            <input
              v-model="personForm.name"
              type="text"
              class="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
              placeholder="Family member name"
            />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Color</label>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="color in personColors"
                :key="color"
                type="button"
                @click="personForm.color = color"
                class="w-8 h-8 rounded-full transition-transform hover:scale-110"
                :class="personForm.color === color ? 'ring-2 ring-offset-2 ring-gray-400 dark:ring-offset-gray-800' : ''"
                :style="{ backgroundColor: color }"
              ></button>
            </div>
          </div>

          <div class="flex gap-3 pt-2">
            <button
              type="button"
              @click="showPersonModal = false"
              class="flex-1 px-4 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl font-medium hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              Close
            </button>
            <button
              type="submit"
              :disabled="!personForm.name"
              class="flex-1 px-4 py-2.5 bg-emerald-500 text-white rounded-xl font-medium hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Person
            </button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>
