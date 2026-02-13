export interface CalendarEventData {
  title: string
  description?: string | null
  date: string
  time?: string | null
  end_date?: string | null
  end_time?: string | null
  all_day?: boolean
}

/** "2026-02-10" → "20260210" */
export function fmtDate(dateStr: string): string {
  return dateStr.replace(/-/g, "")
}

/** "18:00" → "T180000" */
export function fmtTime(timeStr: string): string {
  return "T" + timeStr.replace(":", "") + "00"
}

/** Add one day: "2026-02-10" → "2026-02-11" */
export function nextDay(dateStr: string): string {
  const d = new Date(dateStr + "T12:00:00Z")
  d.setUTCDate(d.getUTCDate() + 1)
  return d.toISOString().split("T")[0]
}

/** Add one hour to a time string: "18:00" → "19:00" */
export function addHour(timeStr: string): string {
  const [h, m] = timeStr.split(":").map(Number)
  const newH = (h + 1) % 24
  return `${String(newH).padStart(2, "0")}:${String(m).padStart(2, "0")}`
}

export function escapeICS(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n")
}

export function buildICS(uid: string, event: CalendarEventData): string {
  const isAllDay = !!(event.all_day || !event.time)
  const now = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "")

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
      dtend = `DTEND:${fmtDate(event.date)}${fmtTime(addHour(event.time!))}`
    }
  }

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Family Hub//EN",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${now}`,
    dtstart,
    dtend,
    `SUMMARY:${escapeICS(event.title)}`,
  ]

  if (event.description) {
    lines.push(`DESCRIPTION:${escapeICS(event.description)}`)
  }

  lines.push("END:VEVENT", "END:VCALENDAR")
  return lines.join("\r\n")
}
