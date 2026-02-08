import { DAVClient, DAVCalendar } from 'tsdav'
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

// Format date string "2026-02-10" to iCal date "20260210"
function fmtDate(dateStr: string): string {
  return dateStr.replace(/-/g, '')
}

// Format time string "18:00" to iCal time "T180000"
function fmtTime(timeStr: string): string {
  return 'T' + timeStr.replace(':', '') + '00'
}

// Add one day to a date string "2026-02-10" -> "2026-02-11"
function nextDay(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00Z') // noon UTC to avoid DST issues
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split('T')[0]
}

// Add one hour to a time string "18:00" -> "19:00"
function addHour(timeStr: string): { date: string | null; time: string } {
  const [h, m] = timeStr.split(':').map(Number)
  const newH = h + 1
  if (newH >= 24) return { date: null, time: `${String(newH - 24).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
  return { date: null, time: `${String(newH).padStart(2, '0')}:${String(m).padStart(2, '0')}` }
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function buildICS(uid: string, event: CalendarEvent): string {
  const isAllDay = !!(event.all_day || !event.time)
  const now = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')

  let dtstart: string
  let dtend: string

  if (isAllDay) {
    dtstart = `DTSTART;VALUE=DATE:${fmtDate(event.date)}`
    // iCal all-day DTEND is exclusive (day after last day). iCloud requires it.
    const lastDay = event.end_date || event.date
    dtend = `DTEND;VALUE=DATE:${fmtDate(nextDay(lastDay))}`
  } else {
    // Timed events: output as floating local time (no Z suffix)
    // "18:00" stays "180000" — no timezone conversion
    dtstart = `DTSTART:${fmtDate(event.date)}${fmtTime(event.time!)}`
    if (event.end_date && event.end_time) {
      dtend = `DTEND:${fmtDate(event.end_date)}${fmtTime(event.end_time)}`
    } else if (event.end_time) {
      dtend = `DTEND:${fmtDate(event.date)}${fmtTime(event.end_time)}`
    } else {
      // Default to 1 hour duration
      const { time: endTime } = addHour(event.time!)
      dtend = `DTEND:${fmtDate(event.date)}${fmtTime(endTime)}`
    }
  }

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Family Hub//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICS(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
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
