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
  color?: string | null
}

export interface AccountCredentials {
  id: number
  email: string
  app_password: string
}

// Per-account client cache keyed by account ID
const accountCache = new Map<number, { client: DAVClient; calendar: DAVCalendar }>()

function getDisplayName(cal: DAVCalendar): string {
  if (typeof cal.displayName === 'string') return cal.displayName
  return 'Home'
}

async function getClientForAccount(creds: AccountCredentials): Promise<{ client: DAVClient; calendar: DAVCalendar } | null> {
  const cached = accountCache.get(creds.id)
  if (cached) return cached

  try {
    const dav = new DAVClient({
      serverUrl: 'https://caldav.icloud.com',
      credentials: {
        username: creds.email,
        password: creds.app_password,
      },
      authMethod: 'Basic',
      defaultAccountType: 'caldav',
    })

    await dav.login()

    const calendars = await dav.fetchCalendars()
    const eventCalendars = calendars.filter(c => c.components?.includes('VEVENT'))

    if (eventCalendars.length === 0) {
      console.error(`[iCloud Sync] No event calendars found for account ${creds.id} (${creds.email})`)
      return null
    }

    const calendar = eventCalendars.find(c => getDisplayName(c) === 'Home') || eventCalendars[0]
    console.log(`[iCloud Sync] Account ${creds.id}: using calendar "${getDisplayName(calendar)}"`)

    const result = { client: dav, calendar }
    accountCache.set(creds.id, result)
    return result
  } catch (err) {
    console.error(`[iCloud Sync] Failed to connect account ${creds.id}:`, err)
    return null
  }
}

export function invalidateAccountCache(accountId: number) {
  accountCache.delete(accountId)
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
    const lastDay = event.end_date || event.date
    dtend = `DTEND;VALUE=DATE:${fmtDate(nextDay(lastDay))}`
  } else {
    dtstart = `DTSTART:${fmtDate(event.date)}${fmtTime(event.time!)}`
    if (event.end_date && event.end_time) {
      dtend = `DTEND:${fmtDate(event.end_date)}${fmtTime(event.end_time)}`
    } else if (event.end_time) {
      dtend = `DTEND:${fmtDate(event.date)}${fmtTime(event.end_time)}`
    } else {
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

  if (event.color) {
    lines.push(`COLOR:${event.color}`)
    lines.push(`X-APPLE-CALENDAR-COLOR:${event.color}`)
  }

  lines.push('END:VEVENT', 'END:VCALENDAR')
  return lines.join('\r\n')
}

export async function syncCreateEvent(creds: AccountCredentials, event: CalendarEvent): Promise<string | null> {
  try {
    const result = await getClientForAccount(creds)
    if (!result) return null

    const uid = crypto.randomUUID()
    const icsData = buildICS(uid, event)

    await result.client.createCalendarObject({
      calendar: result.calendar,
      filename: `${uid}.ics`,
      iCalString: icsData,
    })

    console.log(`[iCloud Sync] Account ${creds.id}: created event "${event.title}" (${uid})`)
    return uid
  } catch (err) {
    console.error(`[iCloud Sync] Account ${creds.id}: failed to create event:`, err)
    return null
  }
}

export async function syncUpdateEvent(creds: AccountCredentials, icalUid: string, event: CalendarEvent): Promise<boolean> {
  try {
    const result = await getClientForAccount(creds)
    if (!result) return false

    const icsData = buildICS(icalUid, event)
    const url = `${result.calendar.url}${icalUid}.ics`

    await result.client.updateCalendarObject({
      calendarObject: {
        url,
        data: icsData,
      },
    })

    console.log(`[iCloud Sync] Account ${creds.id}: updated event "${event.title}" (${icalUid})`)
    return true
  } catch (err) {
    console.error(`[iCloud Sync] Account ${creds.id}: failed to update event:`, err)
    return false
  }
}

export async function syncDeleteEvent(creds: AccountCredentials, icalUid: string): Promise<void> {
  try {
    const result = await getClientForAccount(creds)
    if (!result) return

    const url = `${result.calendar.url}${icalUid}.ics`

    await result.client.deleteCalendarObject({
      calendarObject: { url },
    })

    console.log(`[iCloud Sync] Account ${creds.id}: deleted event ${icalUid}`)
  } catch (err) {
    console.error(`[iCloud Sync] Account ${creds.id}: failed to delete event:`, err)
  }
}

export async function testICloudConnection(creds: AccountCredentials): Promise<{ connected: boolean; calendarName?: string; error?: string }> {
  try {
    // Force fresh connection for this account
    invalidateAccountCache(creds.id)

    const result = await getClientForAccount(creds)
    if (!result) {
      return { connected: false, error: 'No calendars found on iCloud account' }
    }

    return { connected: true, calendarName: getDisplayName(result.calendar) || 'Home' }
  } catch (err: any) {
    invalidateAccountCache(creds.id)
    return { connected: false, error: err.message || 'Unknown error' }
  }
}
