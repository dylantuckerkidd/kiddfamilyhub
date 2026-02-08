import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '@/composables/useApi'

export interface FamilyMember {
  id: number
  name: string
  color: string
}

export interface CalendarEvent {
  id: number
  title: string
  description: string | null
  date: string
  time: string | null
  end_date: string | null
  end_time: string | null
  all_day: number
  person_id: number | null
  person_name: string | null
  person_color: string | null
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const familyMembers = ref<FamilyMember[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  async function fetchFamilyMembers() {
    const res = await apiFetch('/api/calendar/people')
    familyMembers.value = await res.json()
  }

  async function addFamilyMember(name: string, color: string) {
    const res = await apiFetch('/api/calendar/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, color })
    })
    const member = await res.json()
    familyMembers.value.push(member)
    return member
  }

  async function updateFamilyMember(id: number, data: { name?: string; color?: string }) {
    const res = await apiFetch(`/api/calendar/people/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const updated = await res.json()
    const index = familyMembers.value.findIndex(m => m.id === id)
    if (index >= 0) {
      familyMembers.value[index] = updated
    }
    return updated
  }

  async function deleteFamilyMember(id: number) {
    await apiFetch(`/api/calendar/people/${id}`, { method: 'DELETE' })
    familyMembers.value = familyMembers.value.filter(m => m.id !== id)
  }

  async function fetchEvents(month?: number, year?: number) {
    loading.value = true
    try {
      let url = '/api/calendar/events'
      if (month !== undefined && year !== undefined) {
        url += `?month=${month}&year=${year}`
      }
      const res = await apiFetch(url)
      events.value = await res.json()
      initialized.value = true
    } finally {
      loading.value = false
    }
  }

  async function addEvent(event: {
    title: string
    description?: string
    date: string
    time?: string
    end_date?: string
    end_time?: string
    all_day?: boolean
    person_id?: number | null
  }) {
    const res = await apiFetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event)
    })
    if (!res.ok) return null
    const newEvent = await res.json()
    if (newEvent) {
      events.value.push(newEvent)
    }
    return newEvent
  }

  async function updateEvent(id: number, data: Partial<CalendarEvent>) {
    const res = await apiFetch(`/api/calendar/events/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    const updated = await res.json()
    const index = events.value.findIndex(e => e.id === id)
    if (index >= 0) {
      events.value[index] = updated
    }
    return updated
  }

  async function deleteEvent(id: number) {
    await apiFetch(`/api/calendar/events/${id}`, { method: 'DELETE' })
    events.value = events.value.filter(e => e.id !== id)
  }

  return {
    events,
    familyMembers,
    loading,
    initialized,
    fetchFamilyMembers,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent
  }
})
