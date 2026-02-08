import { DAVClient, DAVCalendar } from 'tsdav'
import icalGenerator from 'ical-generator'
import crypto from 'crypto'

interface CalendarEvent {
  title: string
  description?: string | null
  date: string
  time?: string | null
  end_date?: string | null
  end_time?: string | null
  all_day?: number | boolean
}

let client: DAVClient | null = null
let cachedCalendar: DAVCalendar | null = null

function getDisplayName(cal: DAVCalendar): string {
  if (typeof cal.displayName === 'string') return cal.displayName
  return 'Home'
}

function getCredentials() {
  const email = process.env.ICLOUD_EMAIL
  const password = process.env.ICLOUD_APP_PASSWORD
  if (!email || !password) return null
  return { email, password }
}

async function getClient(): Promise<DAVClient | null> {
  const creds = getCredentials()
  if (!creds) return null

  if (client) return client

  const dav = new DAVClient({
    serverUrl: 'https://caldav.icloud.com',
    credentials: {
      username: creds.email,
      password: creds.password,
    },
    authMethod: 'Basic',
    defaultAccountType: 'caldav',
  })

  await dav.login()
  client = dav
  return client
}

async function getCalendar(): Promise<{ client: DAVClient; calendar: DAVCalendar } | null> {
  const dav = await getClient()
  if (!dav) return null

  if (cachedCalendar) return { client: dav, calendar: cachedCalendar }

  const calendars = await dav.fetchCalendars()

  // Filter to calendars that support VEVENT (excludes Reminders/VTODO calendars)
  const eventCalendars = calendars.filter(c =>
    c.components?.includes('VEVENT')
  )

  if (eventCalendars.length === 0) {
    console.error('[iCloud Sync] No event calendars found on iCloud account')
    console.error('[iCloud Sync] Available calendars:', calendars.map(c => `${getDisplayName(c)} (${c.components?.join(',')})`))
    return null
  }

  // Prefer "Home" calendar, fall back to first event calendar
  cachedCalendar = eventCalendars.find(c => getDisplayName(c) === 'Home') || eventCalendars[0]
  console.log(`[iCloud Sync] Using calendar: ${getDisplayName(cachedCalendar)}`)
  return { client: dav, calendar: cachedCalendar }
}

function buildICS(uid: string, event: CalendarEvent): string {
  const cal = icalGenerator({ name: 'Family Hub' })

  let start: Date
  let end: Date | undefined

  if (event.all_day || !event.time) {
    start = new Date(event.date + 'T00:00:00')
    // iCal all-day end dates are exclusive — DTEND is the day AFTER the last day
    // iCloud requires DTEND for all-day events
    const lastDay = event.end_date || event.date
    const endDate = new Date(lastDay + 'T00:00:00')
    endDate.setDate(endDate.getDate() + 1)
    end = endDate
  } else {
    start = new Date(event.date + 'T' + event.time + ':00')
    if (event.end_date && event.end_time) {
      end = new Date(event.end_date + 'T' + event.end_time + ':00')
    } else if (event.end_time) {
      end = new Date(event.date + 'T' + event.end_time + ':00')
    } else {
      // Default to 1 hour if no end time
      end = new Date(start.getTime() + 60 * 60 * 1000)
    }
  }

  const icalEvent = cal.createEvent({
    id: uid,
    start,
    end,
    allDay: !!(event.all_day || !event.time),
    summary: event.title,
    description: event.description || undefined,
  })

  return cal.toString()
}

export async function syncCreateEvent(event: CalendarEvent): Promise<string | null> {
  if (!getCredentials()) return null

  try {
    const result = await getCalendar()
    if (!result) return null

    const uid = crypto.randomUUID()
    const icsData = buildICS(uid, event)
    const url = `${result.calendar.url}${uid}.ics`

    await result.client.createCalendarObject({
      calendar: result.calendar,
      filename: `${uid}.ics`,
      iCalString: icsData,
    })

    console.log(`[iCloud Sync] Created event: ${event.title} (${uid})`)
    return uid
  } catch (err) {
    console.error('[iCloud Sync] Failed to create event:', err)
    return null
  }
}

export async function syncUpdateEvent(icalUid: string, event: CalendarEvent): Promise<boolean> {
  if (!getCredentials()) return true

  try {
    const result = await getCalendar()
    if (!result) return false

    const icsData = buildICS(icalUid, event)
    const url = `${result.calendar.url}${icalUid}.ics`

    await result.client.updateCalendarObject({
      calendarObject: {
        url,
        data: icsData,
      },
    })

    console.log(`[iCloud Sync] Updated event: ${event.title} (${icalUid})`)
    return true
  } catch (err) {
    console.error('[iCloud Sync] Failed to update event:', err)
    return false
  }
}

export async function syncDeleteEvent(icalUid: string): Promise<void> {
  if (!getCredentials()) return

  try {
    const result = await getCalendar()
    if (!result) return

    const url = `${result.calendar.url}${icalUid}.ics`

    await result.client.deleteCalendarObject({
      calendarObject: { url },
    })

    console.log(`[iCloud Sync] Deleted event: ${icalUid}`)
  } catch (err) {
    console.error('[iCloud Sync] Failed to delete event:', err)
  }
}

export async function testICloudConnection(): Promise<{ connected: boolean; calendarName?: string; error?: string }> {
  const creds = getCredentials()
  if (!creds) {
    return { connected: false, error: 'Not configured — set ICLOUD_EMAIL and ICLOUD_APP_PASSWORD' }
  }

  try {
    // Force fresh connection
    client = null
    cachedCalendar = null

    const result = await getCalendar()
    if (!result) {
      return { connected: false, error: 'No calendars found on iCloud account' }
    }

    return { connected: true, calendarName: getDisplayName(result.calendar) || 'Home' }
  } catch (err: any) {
    client = null
    cachedCalendar = null
    return { connected: false, error: err.message || 'Unknown error' }
  }
}

export async function getICloudStatus(): Promise<{ configured: boolean; connected: boolean; calendarName?: string }> {
  const creds = getCredentials()
  if (!creds) {
    return { configured: false, connected: false }
  }

  // If we have a cached calendar, we're connected
  if (cachedCalendar) {
    return { configured: true, connected: true, calendarName: getDisplayName(cachedCalendar) || 'Home' }
  }

  return { configured: true, connected: false }
}
