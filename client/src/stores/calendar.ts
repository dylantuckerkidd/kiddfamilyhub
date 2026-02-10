import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

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
  all_day: boolean
  person_id: number | null
  person_name: string | null
  person_color: string | null
  recurring_group_id: string | null
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const familyMembers = ref<FamilyMember[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  async function fetchFamilyMembers() {
    const { data, error } = await supabase
      .from('family_members')
      .select('id, name, color')
      .order('created_at', { ascending: true })
    if (error) throw error
    familyMembers.value = data ?? []
  }

  async function addFamilyMember(name: string, color: string) {
    const { data, error } = await supabase
      .from('family_members')
      .insert({ name, color })
      .select('id, name, color')
      .single()
    if (error) throw error
    familyMembers.value.push(data)
    return data
  }

  async function updateFamilyMember(id: number, updates: { name?: string; color?: string }) {
    const { data, error } = await supabase
      .from('family_members')
      .update(updates)
      .eq('id', id)
      .select('id, name, color')
      .single()
    if (error) throw error
    const index = familyMembers.value.findIndex(m => m.id === id)
    if (index >= 0) familyMembers.value[index] = data
    return data
  }

  async function deleteFamilyMember(id: number) {
    const { error } = await supabase
      .from('family_members')
      .delete()
      .eq('id', id)
    if (error) throw error
    familyMembers.value = familyMembers.value.filter(m => m.id !== id)
  }

  async function fetchEvents(month?: number, year?: number) {
    loading.value = true
    try {
      let query = supabase
        .from('calendar_events_with_person')
        .select('*')

      if (month !== undefined && year !== undefined) {
        // Fetch events that overlap with the given month
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

        query = query.or(
          `and(date.gte.${startDate},date.lte.${endDate}),and(end_date.gte.${startDate},end_date.lte.${endDate}),and(date.lte.${startDate},end_date.gte.${endDate})`
        )
      }

      const { data, error } = await query.order('date', { ascending: true })
      if (error) throw error
      events.value = data ?? []
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
    const { data, error } = await supabase
      .from('calendar_events')
      .insert({
        title: event.title,
        description: event.description || null,
        date: event.date,
        time: event.all_day ? null : event.time || null,
        end_date: event.end_date || null,
        end_time: event.all_day ? null : event.end_time || null,
        all_day: event.all_day ?? true,
        person_id: event.person_id ?? null
      })
      .select('*')
      .single()
    if (error) throw error

    // Refetch to get joined person data from view
    await fetchEvents()
    return data
  }

  async function updateEvent(id: number, data: Partial<CalendarEvent>) {
    // Strip view-only fields
    const { person_name, person_color, ...updateData } = data as any
    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
    if (error) throw error

    // Refetch to get joined data
    await fetchEvents()
  }

  async function deleteEvent(id: number) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
    if (error) throw error
    events.value = events.value.filter(e => e.id !== id)
  }

  async function addRecurringEvent(data: {
    title: string
    description?: string
    time?: string
    end_time?: string
    all_day?: boolean
    person_id?: number | null
    days: number[]
    start_date: string
    months: number
  }) {
    // Generate recurring events client-side
    const groupId = crypto.randomUUID()
    const startDate = new Date(data.start_date + 'T00:00:00')
    const endDate = new Date(startDate)
    endDate.setMonth(endDate.getMonth() + data.months)

    const eventRows: Array<{
      title: string
      description: string | null
      date: string
      time: string | null
      end_time: string | null
      all_day: boolean
      person_id: number | null
      recurring_group_id: string
    }> = []

    const current = new Date(startDate)
    while (current < endDate) {
      if (data.days.includes(current.getDay())) {
        const dateStr = current.toISOString().split('T')[0]
        eventRows.push({
          title: data.title,
          description: data.description || null,
          date: dateStr,
          time: data.all_day ? null : data.time || null,
          end_time: data.all_day ? null : data.end_time || null,
          all_day: data.all_day ?? true,
          person_id: data.person_id ?? null,
          recurring_group_id: groupId
        })
      }
      current.setDate(current.getDate() + 1)
    }

    if (eventRows.length === 0) return null

    const { error } = await supabase
      .from('calendar_events')
      .insert(eventRows)
    if (error) throw error

    // Refetch to get view data
    await fetchEvents()
    return events.value.filter(e => e.recurring_group_id === groupId)
  }

  async function deleteEventSeries(groupId: string) {
    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurring_group_id', groupId)
    if (error) throw error
    events.value = events.value.filter(e => e.recurring_group_id !== groupId)
  }

  async function updateEventSeries(groupId: string, data: Partial<CalendarEvent>) {
    // Strip view-only fields
    const { person_name, person_color, ...updateData } = data as any
    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('recurring_group_id', groupId)
    if (error) throw error

    // Refetch to get joined data
    await fetchEvents()
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
    deleteEvent,
    addRecurringEvent,
    deleteEventSeries,
    updateEventSeries
  }
})
