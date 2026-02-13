import { defineStore } from 'pinia'
import { ref } from 'vue'
import { supabase } from '@/lib/supabase'

export interface FamilyMember {
  id: number
  name: string
  color: string
}

export interface ICloudAccount {
  id: number
  label: string
  email: string
  calendar_url: string | null
  created_at: string
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
  event_type: string | null
  sync_account_ids: number[]
}

export const useCalendarStore = defineStore('calendar', () => {
  const events = ref<CalendarEvent[]>([])
  const familyMembers = ref<FamilyMember[]>([])
  const icloudAccounts = ref<ICloudAccount[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  // ---- Family Members ----

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

  // ---- iCloud Accounts ----

  async function fetchICloudAccounts() {
    const { data, error } = await supabase
      .from('icloud_sync_accounts_safe')
      .select('*')
      .order('created_at', { ascending: true })
    if (error) throw error
    icloudAccounts.value = data ?? []
  }

  async function addICloudAccount(account: { label: string; email: string; app_password: string }) {
    const { error } = await supabase
      .from('icloud_sync_accounts')
      .insert(account)
    if (error) throw error
    await fetchICloudAccounts()
  }

  async function updateICloudAccount(id: number, updates: { label?: string; email?: string; app_password?: string }) {
    const { error } = await supabase
      .from('icloud_sync_accounts')
      .update(updates)
      .eq('id', id)
    if (error) throw error
    await fetchICloudAccounts()
  }

  async function deleteICloudAccount(id: number) {
    const { error } = await supabase
      .from('icloud_sync_accounts')
      .delete()
      .eq('id', id)
    if (error) throw error
    icloudAccounts.value = icloudAccounts.value.filter(a => a.id !== id)
  }

  async function testICloudAccount(id: number): Promise<{ connected: boolean; calendarName?: string; error?: string }> {
    const { data, error } = await supabase.functions.invoke('icloud-sync', {
      body: { action: 'test', account_id: id }
    })
    if (error) return { connected: false, error: error.message }
    return data
  }

  // ---- Fire-and-forget sync helpers ----

  function fireAndForgetSync(action: string, payload: Record<string, unknown>) {
    supabase.functions.invoke('icloud-sync', {
      body: { action, ...payload }
    }).catch(err => console.error(`[iCloud Sync] ${action} failed:`, err))
  }

  // ---- Calendar Events ----

  async function seedHolidays() {
    await supabase.rpc('seed_holidays')
  }

  async function fetchEvents(month?: number, year?: number) {
    loading.value = true
    try {
      let query = supabase
        .from('calendar_events_with_person')
        .select('*')

      if (month !== undefined && year !== undefined) {
        const startDate = `${year}-${String(month).padStart(2, '0')}-01`
        const endDay = new Date(year, month, 0).getDate()
        const endDate = `${year}-${String(month).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`

        query = query.or(
          `and(date.gte.${startDate},date.lte.${endDate}),and(end_date.gte.${startDate},end_date.lte.${endDate}),and(date.lte.${startDate},end_date.gte.${endDate})`
        )
      }

      const { data, error } = await query.order('date', { ascending: true })
      if (error) throw error
      events.value = (data ?? []).map(e => ({
        ...e,
        sync_account_ids: e.sync_account_ids ?? []
      }))
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
    event_type?: string | null
    sync_account_ids?: number[]
  }) {
    const syncAccountIds = event.sync_account_ids ?? []

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
        person_id: event.person_id ?? null,
        event_type: event.event_type || null
      })
      .select('*')
      .single()
    if (error) throw error

    // Fire-and-forget sync to iCloud
    if (syncAccountIds.length > 0) {
      fireAndForgetSync('sync-create', { event_id: data.id, account_ids: syncAccountIds })
    }

    await fetchEvents()
    return data
  }

  async function addBirthdayEvent(data: {
    title: string
    date: string
    person_id?: number | null
    years?: number
    sync_account_ids?: number[]
  }) {
    const syncAccountIds = data.sync_account_ids ?? []
    const groupId = crypto.randomUUID()
    const baseDate = new Date(data.date + 'T00:00:00')
    const years = data.years || 5

    const eventRows: Array<{
      title: string
      date: string
      all_day: boolean
      person_id: number | null
      recurring_group_id: string
      event_type: string
    }> = []

    for (let y = 0; y < years; y++) {
      const eventDate = new Date(baseDate)
      eventDate.setFullYear(baseDate.getFullYear() + y)
      const dateStr = `${eventDate.getFullYear()}-${String(eventDate.getMonth() + 1).padStart(2, '0')}-${String(eventDate.getDate()).padStart(2, '0')}`
      eventRows.push({
        title: data.title,
        date: dateStr,
        all_day: true,
        person_id: data.person_id ?? null,
        recurring_group_id: groupId,
        event_type: 'birthday'
      })
    }

    if (eventRows.length === 0) return null

    const { data: inserted, error } = await supabase
      .from('calendar_events')
      .insert(eventRows)
      .select('id')
    if (error) throw error

    // Sync each created event
    if (syncAccountIds.length > 0 && inserted) {
      for (const row of inserted) {
        fireAndForgetSync('sync-create', { event_id: row.id, account_ids: syncAccountIds })
      }
    }

    await fetchEvents()
    return events.value.filter(e => e.recurring_group_id === groupId)
  }

  async function updateEvent(id: number, data: Partial<CalendarEvent> & { sync_account_ids?: number[] }) {
    const syncAccountIds = data.sync_account_ids
    const { person_name, person_color, sync_account_ids: _, ...updateData } = data as any
    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('id', id)
    if (error) throw error

    // If sync_account_ids provided, handle diff
    if (syncAccountIds !== undefined) {
      fireAndForgetSync('sync-diff', { event_id: id, new_account_ids: syncAccountIds })
    } else {
      // Just update existing syncs
      fireAndForgetSync('sync-update', { event_id: id })
    }

    await fetchEvents()
  }

  async function deleteEvent(id: number) {
    // Read sync rows before deleting (needed for iCloud cleanup)
    const { data: syncRows } = await supabase
      .from('event_icloud_sync')
      .select('account_id, ical_uid')
      .eq('event_id', id)

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('id', id)
    if (error) throw error
    events.value = events.value.filter(e => e.id !== id)

    // Fire-and-forget delete from iCloud
    if (syncRows && syncRows.length > 0) {
      fireAndForgetSync('sync-delete', { sync_rows: syncRows })
    }
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
    sync_account_ids?: number[]
  }) {
    const syncAccountIds = data.sync_account_ids ?? []
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

    const { data: inserted, error } = await supabase
      .from('calendar_events')
      .insert(eventRows)
      .select('id')
    if (error) throw error

    // Sync each created event
    if (syncAccountIds.length > 0 && inserted) {
      for (const row of inserted) {
        fireAndForgetSync('sync-create', { event_id: row.id, account_ids: syncAccountIds })
      }
    }

    await fetchEvents()
    return events.value.filter(e => e.recurring_group_id === groupId)
  }

  async function deleteEventSeries(groupId: string) {
    // Get all sync rows for events in this series
    const seriesEvents = events.value.filter(e => e.recurring_group_id === groupId)
    const allSyncRows: { account_id: number; ical_uid: string }[] = []

    for (const ev of seriesEvents) {
      const { data: syncRows } = await supabase
        .from('event_icloud_sync')
        .select('account_id, ical_uid')
        .eq('event_id', ev.id)
      if (syncRows) allSyncRows.push(...syncRows)
    }

    const { error } = await supabase
      .from('calendar_events')
      .delete()
      .eq('recurring_group_id', groupId)
    if (error) throw error
    events.value = events.value.filter(e => e.recurring_group_id !== groupId)

    // Fire-and-forget delete from iCloud
    if (allSyncRows.length > 0) {
      fireAndForgetSync('sync-delete', { sync_rows: allSyncRows })
    }
  }

  async function updateEventSeries(groupId: string, data: Partial<CalendarEvent> & { sync_account_ids?: number[] }) {
    const syncAccountIds = data.sync_account_ids
    const { person_name, person_color, sync_account_ids: _, ...updateData } = data as any
    const { error } = await supabase
      .from('calendar_events')
      .update(updateData)
      .eq('recurring_group_id', groupId)
    if (error) throw error

    // Fire-and-forget: update all synced events in the series
    const seriesEvents = events.value.filter(e => e.recurring_group_id === groupId)
    for (const ev of seriesEvents) {
      if (syncAccountIds !== undefined) {
        fireAndForgetSync('sync-diff', { event_id: ev.id, new_account_ids: syncAccountIds })
      } else {
        fireAndForgetSync('sync-update', { event_id: ev.id })
      }
    }

    await fetchEvents()
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
    seedHolidays,
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
