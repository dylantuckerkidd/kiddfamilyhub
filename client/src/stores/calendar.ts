import { defineStore } from 'pinia'
import { ref } from 'vue'
import { apiFetch } from '@/composables/useApi'

export interface FamilyMember {
  id: number
  name: string
  color: string
}

export interface ICloudAccount {
  id: number
  label: string
  email: string
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
  sync_account_ids: number[]
  person_id: number | null
  person_name: string | null
  person_color: string | null
  recurring_group_id: string | null
  event_type: string | null
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const familyMembers = ref<FamilyMember[]>([])
  const icloudAccounts = ref<ICloudAccount[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  async function fetchFamilyMembers() {
    const res = await apiFetch('/api/calendar/people')
    if (res.ok) familyMembers.value = await res.json()
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

  // iCloud Accounts
  async function fetchICloudAccounts() {
    const res = await apiFetch('/api/calendar/icloud-accounts')
    if (res.ok) icloudAccounts.value = await res.json()
  }

  async function addICloudAccount(data: { label: string; email: string; app_password: string }) {
    const res = await apiFetch('/api/calendar/icloud-accounts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) return null
    const account = await res.json()
    icloudAccounts.value.push(account)
    return account
  }

  async function updateICloudAccount(id: number, data: { label?: string; email?: string; app_password?: string }) {
    const res = await apiFetch(`/api/calendar/icloud-accounts/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) return null
    const updated = await res.json()
    const index = icloudAccounts.value.findIndex(a => Number(a.id) === Number(id))
    if (index >= 0) {
      icloudAccounts.value[index] = updated
    }
    return updated
  }

  async function deleteICloudAccount(id: number) {
    await apiFetch(`/api/calendar/icloud-accounts/${id}`, { method: 'DELETE' })
    icloudAccounts.value = icloudAccounts.value.filter(a => a.id !== id)
  }

  async function testICloudAccount(id: number): Promise<{ connected: boolean; calendarName?: string; error?: string }> {
    try {
      const res = await apiFetch(`/api/calendar/icloud-accounts/${id}/test`, { method: 'POST' })
      return await res.json()
    } catch {
      return { connected: false, error: 'Failed to reach server' }
    }
  }

  async function fetchEvents(month?: number, year?: number) {
    loading.value = true
    try {
      let url = '/api/calendar/events'
      if (month !== undefined && year !== undefined) {
        url += `?month=${month}&year=${year}`
      }
      const res = await apiFetch(url)
      if (res.ok) {
        events.value = await res.json()
        initialized.value = true
      }
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
    sync_account_ids?: number[]
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
    if (!res.ok) return null
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

  async function addRecurringEvent(data: {
    title: string
    description?: string
    time?: string
    end_time?: string
    all_day?: boolean
    sync_account_ids?: number[]
    person_id?: number | null
    days: number[]
    start_date: string
    months: number
  }) {
    const res = await apiFetch('/api/calendar/events/recurring', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) return null
    const newEvents: CalendarEvent[] = await res.json()
    events.value.push(...newEvents)
    return newEvents
  }

  async function addBirthdayEvent(data: {
    title: string
    date: string
    person_id?: number | null
    sync_account_ids?: number[]
    years?: number
  }) {
    const res = await apiFetch('/api/calendar/events/birthday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) return null
    const newEvents: CalendarEvent[] = await res.json()
    events.value.push(...newEvents)
    return newEvents
  }

  async function deleteEventSeries(groupId: string) {
    await apiFetch(`/api/calendar/events/series/${groupId}`, { method: 'DELETE' })
    events.value = events.value.filter(e => e.recurring_group_id !== groupId)
  }

  async function updateEventSeries(groupId: string, data: Partial<CalendarEvent>) {
    const res = await apiFetch(`/api/calendar/events/series/${groupId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!res.ok) return null
    const updatedEvents: CalendarEvent[] = await res.json()
    events.value = events.value.filter(e => e.recurring_group_id !== groupId)
    events.value.push(...updatedEvents)
    return updatedEvents
  }

  return {
    events,
    familyMembers,
    icloudAccounts,
    loading,
    initialized,
    fetchFamilyMembers,
    addFamilyMember,
    updateFamilyMember,
    deleteFamilyMember,
    fetchICloudAccounts,
    addICloudAccount,
    updateICloudAccount,
    deleteICloudAccount,
    testICloudAccount,
    fetchEvents,
    addEvent,
    updateEvent,
    deleteEvent,
    addRecurringEvent,
    addBirthdayEvent,
    deleteEventSeries,
    updateEventSeries
  }
})
