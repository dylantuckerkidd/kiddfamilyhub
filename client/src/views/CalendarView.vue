<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useCalendarStore, type CalendarEvent } from '@/stores/calendar'
import { useTodosStore, type TodoItem } from '@/stores/todos'
import { useWeatherStore } from '@/stores/weather'
import WeatherWidget from '@/components/WeatherWidget.vue'
import PageHeader from '@/components/PageHeader.vue'
import BaseModal from '@/components/BaseModal.vue'
import LoadingSpinner from '@/components/LoadingSpinner.vue'
import FormInput from '@/components/FormInput.vue'
import FormTextarea from '@/components/FormTextarea.vue'
import FormActions from '@/components/FormActions.vue'

const store = useCalendarStore()
const todosStore = useTodosStore()
const weatherStore = useWeatherStore()

const currentDate = ref(new Date())
const viewMode = ref<'month' | 'week' | 'agenda'>('month')
const agendaDays = ref(30)
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
  person_ids: [] as number[],
  recurring: false,
  recurring_days: [] as number[],
  recurring_months: 1,
  is_birthday: false,
  birthday_years: 5,
  sync_account_ids: [] as number[]
})

const dayLabels = ['S', 'M', 'T', 'W', 'T', 'F', 'S']

function toggleRecurringDay(day: number) {
  const idx = eventForm.value.recurring_days.indexOf(day)
  if (idx >= 0) {
    eventForm.value.recurring_days.splice(idx, 1)
  } else {
    eventForm.value.recurring_days.push(day)
  }
}

function togglePerson(personId: number) {
  const idx = eventForm.value.person_ids.indexOf(personId)
  if (idx >= 0) {
    eventForm.value.person_ids.splice(idx, 1)
  } else {
    eventForm.value.person_ids.push(personId)
  }
}

function toggleSyncAccount(accountId: number) {
  const idx = eventForm.value.sync_account_ids.indexOf(accountId)
  if (idx >= 0) {
    eventForm.value.sync_account_ids.splice(idx, 1)
  } else {
    eventForm.value.sync_account_ids.push(accountId)
  }
}

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

function sortEvents<T extends { event: CalendarEvent }>(entries: T[]): T[] {
  return entries.sort((a, b) => {
    const aAllDay = a.event.all_day || !a.event.time
    const bAllDay = b.event.all_day || !b.event.time
    if (aAllDay && !bAllDay) return -1
    if (!aAllDay && bAllDay) return 1
    if (a.event.time && b.event.time) return a.event.time.localeCompare(b.event.time)
    return a.event.title.localeCompare(b.event.title)
  })
}

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

  // Sort each day's events: all-day first, then by time
  for (const [key, entries] of map) {
    map.set(key, sortEvents(entries))
  }

  return map
})

const todayStr = computed(() => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
})

const isToday = (dateStr: string) => {
  return dateStr === todayStr.value
}

// Agenda view computeds
const agendaItems = computed(() => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const items: { dateStr: string; label: string; relativeLabel: string | null; events: CalendarEvent[]; todos: TodoItem[] }[] = []

  for (let i = 0; i < agendaDays.value; i++) {
    const date = new Date(today)
    date.setDate(date.getDate() + i)
    const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

    const events = getEventsForDay(dateStr)
    const todos = getTodosForDay(dateStr)

    if (events.length === 0 && todos.length === 0) continue

    let relativeLabel: string | null = null
    if (i === 0) relativeLabel = 'Today'
    else if (i === 1) relativeLabel = 'Tomorrow'

    items.push({
      dateStr,
      label: date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
      relativeLabel,
      events,
      todos
    })
  }

  return items
})

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

  // Holiday events get indigo/blue
  if (event.event_type === 'holiday') {
    return {
      backgroundColor: 'rgb(99, 102, 241, 0.2)',
      borderLeft: '3px solid rgb(99, 102, 241)',
      color: 'rgb(79, 70, 229)'
    }
  }
  // Birthday events without a person color get pink/rose
  if (event.event_type === 'birthday') {
    return {
      backgroundColor: 'rgb(244, 63, 94, 0.2)',
      borderLeft: '3px solid rgb(244, 63, 94)',
      color: 'rgb(225, 29, 72)'
    }
  }
  // Shared event - use a nice teal/cyan color
  return {
    backgroundColor: 'rgb(20, 184, 166, 0.2)',
    borderLeft: '3px solid rgb(20, 184, 166)',
    color: 'rgb(13, 148, 136)'
  }
}

// Time picker helpers
const timeHours = Array.from({ length: 12 }, (_, i) => i + 1)
const timeMinutes = Array.from({ length: 12 }, (_, i) => i * 5)

function getTimeParts(time: string) {
  if (!time) return { hour: 12, minute: 0, period: 'AM' as 'AM' | 'PM' }
  const [h, m] = time.split(':').map(Number)
  // Snap minute to nearest 5
  const snapped = Math.round(m / 5) * 5
  return {
    hour: h % 12 || 12,
    minute: snapped >= 60 ? 0 : snapped,
    period: (h >= 12 ? 'PM' : 'AM') as 'AM' | 'PM'
  }
}

function setTimePart(field: 'time' | 'end_time', part: 'hour' | 'minute' | 'period', value: number | string) {
  const parts = getTimeParts(eventForm.value[field])
  if (part === 'hour') parts.hour = value as number
  else if (part === 'minute') parts.minute = value as number
  else parts.period = value as 'AM' | 'PM'
  let h24 = parts.hour % 12
  if (parts.period === 'PM') h24 += 12
  eventForm.value[field] = `${String(h24).padStart(2, '0')}:${String(parts.minute).padStart(2, '0')}`
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
  if (viewMode.value === 'month') prevMonth()
  else if (viewMode.value === 'week') prevWeek()
}

function next() {
  if (viewMode.value === 'month') nextMonth()
  else if (viewMode.value === 'week') nextWeek()
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
    // All-day events always first
    const aAllDay = a.all_day || !a.time
    const bAllDay = b.all_day || !b.time
    if (aAllDay && !bAllDay) return -1
    if (!aAllDay && bAllDay) return 1
    // Both timed — sort by time
    if (a.time && b.time) return a.time.localeCompare(b.time)
    // Both all-day — sort by title
    return a.title.localeCompare(b.title)
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
    // For week/agenda view, fetch all events
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
    person_ids: [],
    recurring: false,
    recurring_days: [],
    recurring_months: 1,
    is_birthday: false,
    birthday_years: 5,
    sync_account_ids: store.icloudAccounts.map(a => a.id)
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
    all_day: !!event.all_day,
    multi_day: !!hasEndDate,
    person_ids: (event.people || []).map(p => p.id),
    recurring: false,
    recurring_days: [],
    recurring_months: 1,
    is_birthday: event.event_type === 'birthday',
    birthday_years: 5,
    sync_account_ids: [...(event.sync_account_ids || [])]
  }
  showEventModal.value = true
}

async function saveEvent() {
  if (!eventForm.value.title || !eventForm.value.date) return

  const endDate = eventForm.value.multi_day && eventForm.value.end_date ? eventForm.value.end_date : null
  const endTime = !eventForm.value.all_day && eventForm.value.end_time ? eventForm.value.end_time : null

  const syncIds = eventForm.value.sync_account_ids

  const personIds = eventForm.value.person_ids

  if (editingEvent.value) {
    await store.updateEvent(editingEvent.value.id, {
      title: eventForm.value.title,
      description: eventForm.value.description || null,
      date: eventForm.value.date,
      end_date: endDate,
      time: eventForm.value.all_day ? null : eventForm.value.time || null,
      end_time: endTime,
      all_day: eventForm.value.all_day,
      person_ids: personIds,
      sync_account_ids: syncIds
    })
  } else if (eventForm.value.is_birthday) {
    await store.addBirthdayEvent({
      title: eventForm.value.title,
      date: eventForm.value.date,
      person_ids: personIds,
      years: eventForm.value.birthday_years,
      sync_account_ids: syncIds
    })
  } else if (eventForm.value.recurring && eventForm.value.recurring_days.length > 0) {
    await store.addRecurringEvent({
      title: eventForm.value.title,
      description: eventForm.value.description || undefined,
      time: eventForm.value.all_day ? undefined : eventForm.value.time || undefined,
      end_time: endTime || undefined,
      all_day: eventForm.value.all_day,
      person_ids: personIds,
      days: eventForm.value.recurring_days,
      start_date: eventForm.value.date,
      months: eventForm.value.recurring_months,
      sync_account_ids: syncIds
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
      person_ids: personIds,
      sync_account_ids: syncIds
    })
  }

  // Refetch events to ensure the calendar updates
  await fetchEventsForView()
  showEventModal.value = false
}

async function saveEventSeries() {
  if (!editingEvent.value?.recurring_group_id) return

  const endTime = !eventForm.value.all_day && eventForm.value.end_time ? eventForm.value.end_time : null

  await store.updateEventSeries(editingEvent.value.recurring_group_id, {
    title: eventForm.value.title,
    description: eventForm.value.description || null,
    time: eventForm.value.all_day ? null : eventForm.value.time || null,
    end_time: endTime,
    all_day: eventForm.value.all_day,
    person_ids: eventForm.value.person_ids,
    sync_account_ids: eventForm.value.sync_account_ids
  } as any)

  await fetchEventsForView()
  showEventModal.value = false
}

async function deleteEventSeries() {
  if (!editingEvent.value?.recurring_group_id) return

  await store.deleteEventSeries(editingEvent.value.recurring_group_id)
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
onMounted(async () => {
  store.fetchFamilyMembers()
  store.fetchICloudAccounts()
  await store.seedHolidays()
  fetchEventsForView()
  todosStore.fetchTodos()

  // Init weather
  if (!weatherStore.hasLocation) {
    weatherStore.detectLocation()
  } else if (!weatherStore.current) {
    weatherStore.fetchWeather()
  }
})

watch([currentDate, viewMode], () => {
  fetchEventsForView()
})

</script>

<template>
  <div class="space-y-4 sm:space-y-6">
    <!-- Header -->
    <PageHeader title="Calendar" subtitle="Family events and schedules">
      <template #actions>
        <button
          @click="showPersonModal = true"
          class="btn-primary btn--sm sm:text-base"
        >
          Manage People
        </button>
      </template>
    </PageHeader>

    <!-- Calendar -->
    <div class="card overflow-hidden">
      <!-- Loading State -->
      <div v-if="store.loading && !store.initialized" class="p-16">
        <LoadingSpinner message="Loading calendar..." />
      </div>

      <template v-else>
      <!-- Calendar Header -->
      <div class="flex items-center justify-between p-3 sm:p-4 border-b border-gray-100 dark:border-gray-700">
        <button
          v-if="viewMode !== 'agenda'"
          @click="prev"
          class="btn-icon"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div v-else class="w-9"></div>

        <div class="flex flex-col sm:flex-row items-center gap-2 sm:gap-4">
          <div class="flex items-center gap-3">
            <h2 class="text-base sm:text-xl font-semibold text-gray-900 dark:text-white text-center">
              {{ viewMode === 'month' ? monthName : viewMode === 'week' ? weekLabel : 'Upcoming Events' }}
            </h2>
            <select
              v-if="viewMode === 'agenda'"
              v-model="agendaDays"
              class="px-2 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white"
            >
              <option :value="7">7 days</option>
              <option :value="14">14 days</option>
              <option :value="30">30 days</option>
              <option :value="60">60 days</option>
              <option :value="90">90 days</option>
            </select>
          </div>
          <div class="flex items-center gap-2">
            <button
              v-if="viewMode !== 'agenda'"
              @click="goToToday"
              class="px-3 py-1 text-xs sm:text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Today
            </button>
            <!-- View Toggle -->
            <div class="toggle-group">
              <button
                @click="viewMode = 'week'"
                class="toggle-btn px-2 sm:px-3 py-1 text-xs sm:text-sm"
                :class="viewMode === 'week' ? 'toggle-btn--active' : ''"
              >
                Week
              </button>
              <button
                @click="viewMode = 'month'"
                class="toggle-btn px-2 sm:px-3 py-1 text-xs sm:text-sm"
                :class="viewMode === 'month' ? 'toggle-btn--active' : ''"
              >
                Month
              </button>
              <button
                @click="viewMode = 'agenda'"
                class="toggle-btn px-2 sm:px-3 py-1 text-xs sm:text-sm"
                :class="viewMode === 'agenda' ? 'toggle-btn--active' : ''"
              >
                <span class="hidden sm:inline">Agenda</span>
                <span class="sm:hidden">List</span>
              </button>
            </div>
          </div>
        </div>

        <button
          v-if="viewMode !== 'agenda'"
          @click="next"
          class="btn-icon"
        >
          <svg class="w-5 h-5 text-gray-600 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <div v-else class="w-9"></div>
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
                  <span v-if="event.event_type === 'holiday'">&#x2B50; </span><span v-else-if="event.event_type === 'birthday'">&#x1F382; </span><svg v-if="event.sync_account_ids?.length" class="w-2.5 h-2.5 inline-block opacity-50 sm:mr-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>{{ event.title }}
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
      <template v-else-if="viewMode === 'week'">
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
                <div class="font-medium text-sm flex items-center gap-1.5">
                  <span v-if="event.event_type === 'holiday'">&#x2B50; </span><span v-else-if="event.event_type === 'birthday'">&#x1F382; </span>
                  <svg v-if="event.sync_account_ids?.length" class="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  {{ event.title }}
                </div>
                <div v-if="!event.all_day && event.time" class="text-xs mt-1 opacity-75">
                  {{ formatTime(event.time) }}
                  <template v-if="event.end_time">- {{ formatTime(event.end_time) }}</template>
                </div>
                <div v-else-if="event.all_day" class="text-xs mt-1 opacity-75">All day</div>
                <div v-if="event.people?.length" class="text-xs mt-1 opacity-75">{{ event.people.map(p => p.name).join(', ') }}</div>
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
                <div class="font-medium text-sm flex items-center gap-1.5">
                  <span v-if="event.event_type === 'holiday'">&#x2B50; </span><span v-else-if="event.event_type === 'birthday'">&#x1F382; </span>
                  <svg v-if="event.sync_account_ids?.length" class="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  {{ event.title }}
                </div>
                <div v-if="!event.all_day && event.time" class="text-xs mt-1 opacity-75">
                  {{ formatTime(event.time) }}
                  <template v-if="event.end_time">- {{ formatTime(event.end_time) }}</template>
                </div>
                <div v-else-if="event.all_day" class="text-xs mt-1 opacity-75">All day</div>
                <div v-if="event.description" class="text-xs mt-2 opacity-60 line-clamp-2">{{ event.description }}</div>
                <div v-if="event.people?.length" class="text-xs mt-2 opacity-75">{{ event.people.map(p => p.name).join(', ') }}</div>
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

      <!-- AGENDA VIEW -->
      <template v-else-if="viewMode === 'agenda'">
        <div v-if="agendaItems.length === 0" class="p-8 sm:p-16 text-center">
          <div class="text-gray-400 dark:text-gray-500 text-4xl mb-3">&#x1F4C5;</div>
          <p class="text-gray-500 dark:text-gray-400 font-medium">No upcoming events</p>
          <p class="text-gray-400 dark:text-gray-500 text-sm mt-1">Nothing scheduled in the next {{ agendaDays }} days</p>
        </div>

        <div v-else class="divide-y divide-gray-100 dark:divide-gray-700">
          <div v-for="day in agendaItems" :key="day.dateStr" class="p-3 sm:p-4">
            <!-- Date header -->
            <div class="flex items-center gap-2 mb-2 sm:mb-3">
              <div
                class="text-sm sm:text-base font-semibold"
                :class="isToday(day.dateStr) ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-900 dark:text-white'"
              >
                {{ day.label }}
              </div>
              <span
                v-if="day.relativeLabel"
                class="px-2 py-0.5 text-xs font-medium rounded-full"
                :class="day.relativeLabel === 'Today' ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'"
              >
                {{ day.relativeLabel }}
              </span>
            </div>

            <!-- Events and todos for this day -->
            <div class="space-y-2 sm:ml-2">
              <!-- Events -->
              <div
                v-for="event in day.events"
                :key="event.id"
                @click="openEditEvent(event)"
                class="p-3 rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
                :style="getEventStyle(event)"
              >
                <div class="font-medium text-sm flex items-center gap-1.5">
                  <span v-if="event.event_type === 'holiday'">&#x2B50; </span>
                  <span v-else-if="event.event_type === 'birthday'">&#x1F382; </span>
                  <svg v-if="event.sync_account_ids?.length" class="w-3 h-3 flex-shrink-0 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
                  {{ event.title }}
                </div>
                <div v-if="!event.all_day && event.time" class="text-xs mt-1 opacity-75">
                  {{ formatTime(event.time) }}
                  <template v-if="event.end_time">- {{ formatTime(event.end_time) }}</template>
                </div>
                <div v-else-if="event.all_day" class="text-xs mt-1 opacity-75">All day</div>
                <div v-if="event.people?.length" class="text-xs mt-1 opacity-75">{{ event.people.map(p => p.name).join(', ') }}</div>
              </div>

              <!-- Todos -->
              <div
                v-for="todo in day.todos"
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
      </template>
      </template>
    </div>

    <!-- Weather Widget -->
    <WeatherWidget />

    <!-- Family Members Legend -->
    <div v-if="store.familyMembers.length > 0" class="flex flex-wrap gap-2 sm:gap-3">
      <div
        v-for="person in store.familyMembers"
        :key="person.id"
        class="flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-gray-800 rounded-full border border-gray-200 dark:border-gray-700"
      >
        <span class="color-dot--lg" :style="{ backgroundColor: person.color }"></span>
        <span class="text-sm text-gray-700 dark:text-gray-300">{{ person.name }}</span>
      </div>
    </div>

    <!-- Event Modal -->
    <BaseModal :show="showEventModal" @close="showEventModal = false">
      <h3 class="modal-title">
        {{ editingEvent ? (eventForm.is_birthday ? 'Edit Birthday' : 'Edit Event') : (eventForm.is_birthday ? 'Add Birthday' : 'Add Event') }}
      </h3>

      <form @submit.prevent="saveEvent" class="space-y-4">
        <FormInput v-model="eventForm.title" label="Title" type="text" required placeholder="Event title" />

        <div class="grid grid-cols-2 gap-3">
          <FormInput
            v-model="eventForm.date"
            :label="eventForm.multi_day ? 'Start Date' : 'Date'"
            type="date"
            required
          />
          <FormInput
            v-if="eventForm.multi_day"
            v-model="eventForm.end_date"
            label="End Date"
            type="date"
            :min="eventForm.date"
          />
        </div>

        <div class="flex items-center gap-4 flex-wrap">
          <div v-if="!eventForm.is_birthday" class="flex items-center gap-2">
            <input
              v-model="eventForm.all_day"
              type="checkbox"
              id="all_day"
              class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
            />
            <label for="all_day" class="text-sm text-gray-700 dark:text-gray-300">All day</label>
          </div>
          <div v-if="!eventForm.recurring && !eventForm.is_birthday" class="flex items-center gap-2">
            <input
              v-model="eventForm.multi_day"
              type="checkbox"
              id="multi_day"
              class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
            />
            <label for="multi_day" class="text-sm text-gray-700 dark:text-gray-300">Multi-day</label>
          </div>
          <div v-if="!editingEvent && !eventForm.is_birthday" class="flex items-center gap-2">
            <input
              v-model="eventForm.recurring"
              type="checkbox"
              id="recurring"
              class="w-4 h-4 text-emerald-500 rounded focus:ring-emerald-500"
            />
            <label for="recurring" class="text-sm text-gray-700 dark:text-gray-300">Recurring</label>
          </div>
          <div v-if="!editingEvent && !eventForm.recurring" class="flex items-center gap-2">
            <input
              v-model="eventForm.is_birthday"
              type="checkbox"
              id="is_birthday"
              class="w-4 h-4 text-pink-500 rounded focus:ring-pink-500"
              @change="if (eventForm.is_birthday) { eventForm.all_day = true; eventForm.multi_day = false; eventForm.recurring = false }"
            />
            <label for="is_birthday" class="text-sm text-gray-700 dark:text-gray-300">Birthday</label>
          </div>
        </div>

        <!-- Recurring options -->
        <div v-if="eventForm.recurring && !editingEvent" class="space-y-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl">
          <div>
            <label class="form-label mb-2">Days of week</label>
            <div class="flex gap-1.5">
              <button
                v-for="(label, idx) in dayLabels"
                :key="idx"
                type="button"
                @click="toggleRecurringDay(idx)"
                class="w-9 h-9 rounded-full text-sm font-medium transition-colors"
                :class="eventForm.recurring_days.includes(idx)
                  ? 'bg-emerald-500 text-white'
                  : 'bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'"
              >
                {{ label }}
              </button>
            </div>
          </div>
          <div>
            <label class="form-label">Duration</label>
            <select
              v-model="eventForm.recurring_months"
              class="form-input bg-white dark:bg-gray-700"
            >
              <option :value="1">1 month</option>
              <option :value="2">2 months</option>
              <option :value="3">3 months</option>
              <option :value="4">4 months</option>
              <option :value="5">5 months</option>
              <option :value="6">6 months</option>
            </select>
          </div>
        </div>

        <!-- Birthday options -->
        <div v-if="eventForm.is_birthday && !editingEvent" class="space-y-3 p-3 bg-pink-50 dark:bg-pink-900/20 rounded-xl">
          <div>
            <label class="form-label">Years to create</label>
            <select
              v-model="eventForm.birthday_years"
              class="form-input focus:ring-pink-500"
            >
              <option :value="3">3 years</option>
              <option :value="5">5 years</option>
              <option :value="10">10 years</option>
            </select>
          </div>
        </div>

        <div v-if="!eventForm.all_day" class="space-y-3">
          <div>
            <label class="form-label">Start Time</label>
            <div class="flex gap-2">
              <select
                :value="getTimeParts(eventForm.time).hour"
                @change="setTimePart('time', 'hour', +($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option v-for="h in timeHours" :key="h" :value="h">{{ h }}</option>
              </select>
              <select
                :value="getTimeParts(eventForm.time).minute"
                @change="setTimePart('time', 'minute', +($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option v-for="m in timeMinutes" :key="m" :value="m">:{{ String(m).padStart(2, '0') }}</option>
              </select>
              <select
                :value="getTimeParts(eventForm.time).period"
                @change="setTimePart('time', 'period', ($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
          <div>
            <label class="form-label">End Time <span class="font-normal text-gray-400">(optional)</span></label>
            <div class="flex gap-2">
              <select
                :value="getTimeParts(eventForm.end_time).hour"
                @change="setTimePart('end_time', 'hour', +($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option v-for="h in timeHours" :key="h" :value="h">{{ h }}</option>
              </select>
              <select
                :value="getTimeParts(eventForm.end_time).minute"
                @change="setTimePart('end_time', 'minute', +($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option v-for="m in timeMinutes" :key="m" :value="m">:{{ String(m).padStart(2, '0') }}</option>
              </select>
              <select
                :value="getTimeParts(eventForm.end_time).period"
                @change="setTimePart('end_time', 'period', ($event.target as HTMLSelectElement).value)"
                class="flex-1 px-2 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-gray-900 dark:text-white text-sm"
              >
                <option value="AM">AM</option>
                <option value="PM">PM</option>
              </select>
            </div>
          </div>
        </div>

        <div v-if="store.familyMembers.length > 0">
          <label class="form-label mb-2">Assign to</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="person in store.familyMembers"
              :key="person.id"
              type="button"
              @click="togglePerson(person.id)"
              class="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5"
              :class="eventForm.person_ids.includes(person.id)
                ? 'ring-1 ring-offset-1 dark:ring-offset-gray-800'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
              :style="eventForm.person_ids.includes(person.id) ? { backgroundColor: person.color + '25', color: person.color, '--tw-ring-color': person.color } : {}"
            >
              <span class="w-2.5 h-2.5 rounded-full flex-shrink-0" :style="{ backgroundColor: person.color }"></span>
              {{ person.name }}
            </button>
          </div>
        </div>

        <FormTextarea v-model="eventForm.description" label="Description" :rows="2" placeholder="Optional description" />

        <!-- iCloud Sync -->
        <div v-if="store.icloudAccounts.length > 0" class="space-y-2">
          <label class="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
            </svg>
            Sync to iCloud
          </label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="account in store.icloudAccounts"
              :key="account.id"
              type="button"
              @click="toggleSyncAccount(account.id)"
              class="px-3 py-1.5 text-xs rounded-lg font-medium transition-colors flex items-center gap-1.5"
              :class="eventForm.sync_account_ids.includes(account.id)
                ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 ring-1 ring-blue-300 dark:ring-blue-700'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'"
            >
              <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
              </svg>
              {{ account.label }}
            </button>
          </div>
        </div>

        <FormActions>
          <template #left>
            <button
              v-if="editingEvent"
              type="button"
              @click="deleteEvent"
              class="btn-danger btn--sm"
            >
              Delete
            </button>
            <button
              v-if="editingEvent?.recurring_group_id"
              type="button"
              @click="deleteEventSeries"
              class="btn-danger-solid btn--sm"
            >
              Delete Series
            </button>
          </template>
          <button
            type="button"
            @click="showEventModal = false"
            class="btn-secondary btn--sm"
          >
            Cancel
          </button>
          <button
            v-if="editingEvent?.recurring_group_id"
            type="button"
            @click="saveEventSeries"
            class="px-4 py-2.5 bg-blue-500 text-white rounded-xl font-medium hover:bg-blue-600 transition-colors text-sm"
          >
            Save Series
          </button>
          <button
            type="submit"
            :disabled="eventForm.recurring && eventForm.recurring_days.length === 0"
            class="btn-primary btn--sm"
          >
            {{ editingEvent ? 'Save' : 'Add' }}
          </button>
        </FormActions>
      </form>
    </BaseModal>

    <!-- People Modal -->
    <BaseModal :show="showPersonModal" @close="showPersonModal = false">
      <h3 class="modal-title">Manage Family Members</h3>

      <!-- Existing members -->
      <div v-if="store.familyMembers.length > 0" class="space-y-2 mb-6">
        <div
          v-for="person in store.familyMembers"
          :key="person.id"
          class="manage-list-item"
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
        <FormInput v-model="personForm.name" label="Name" type="text" placeholder="Family member name" />

        <div>
          <label class="form-label mb-2">Color</label>
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

        <FormActions>
          <button
            type="button"
            @click="showPersonModal = false"
            class="flex-1 btn-secondary"
          >
            Close
          </button>
          <button
            type="submit"
            :disabled="!personForm.name"
            class="flex-1 btn-primary"
          >
            Add Person
          </button>
        </FormActions>
      </form>
    </BaseModal>
  </div>
</template>
