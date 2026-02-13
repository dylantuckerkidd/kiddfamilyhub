const ICLOUD_BASE = "https://caldav.icloud.com"

function basicAuth(email: string, password: string): string {
  return "Basic " + btoa(`${email}:${password}`)
}

/** Extract href text from an XML fragment (simple regex, no XML parser needed) */
function extractHref(xml: string, tag: string): string | null {
  // Look for <tag><DAV:href>...</DAV:href></tag> or <d:tag><d:href>...</d:href></d:tag>
  // Also handles namespace variants
  const patterns = [
    new RegExp(`<(?:\\w+:)?${tag}[^>]*>\\s*<(?:\\w+:)?href[^>]*>([^<]+)</(?:\\w+:)?href>`, "i"),
  ]
  for (const re of patterns) {
    const m = xml.match(re)
    if (m) return m[1].trim()
  }
  return null
}

/** Extract all href values from multistatus response */
function extractAllHrefs(xml: string): string[] {
  const hrefs: string[] = []
  const re = /<(?:\w+:)?href[^>]*>([^<]+)<\/(?:\w+:)?href>/gi
  let m
  while ((m = re.exec(xml)) !== null) {
    hrefs.push(m[1].trim())
  }
  return hrefs
}

/** Check if a response element contains VEVENT support */
function hasVEVENT(responseBlock: string): boolean {
  return /VEVENT/i.test(responseBlock)
}

/** Extract displayname from a response block */
function extractDisplayName(xml: string): string | null {
  const m = xml.match(/<(?:\w+:)?displayname[^>]*>([^<]+)<\/(?:\w+:)?displayname>/i)
  return m ? m[1].trim() : null
}

/**
 * Full CalDAV discovery chain:
 * 1. .well-known/caldav → principal URL
 * 2. PROPFIND principal → calendar-home-set
 * 3. PROPFIND home → find VEVENT calendar
 */
export async function discoverCalendarUrl(
  email: string,
  password: string
): Promise<{ calendarUrl: string; calendarName: string }> {
  const auth = basicAuth(email, password)
  const headers = {
    Authorization: auth,
    "Content-Type": "application/xml; charset=utf-8",
    Depth: "0",
  }

  // Step 1: discover principal
  const wellKnownRes = await fetch(`${ICLOUD_BASE}/.well-known/caldav`, {
    method: "PROPFIND",
    headers,
    redirect: "follow",
    body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:">
  <d:prop>
    <d:current-user-principal/>
  </d:prop>
</d:propfind>`,
  })
  const wellKnownXml = await wellKnownRes.text()
  const principalUrl = extractHref(wellKnownXml, "current-user-principal")
  if (!principalUrl) throw new Error("Could not discover CalDAV principal")

  // Step 2: discover calendar-home-set
  const principalBase = principalUrl.startsWith("http")
    ? principalUrl
    : `${ICLOUD_BASE}${principalUrl}`

  const principalRes = await fetch(principalBase, {
    method: "PROPFIND",
    headers,
    body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav">
  <d:prop>
    <c:calendar-home-set/>
  </d:prop>
</d:propfind>`,
  })
  const principalXml = await principalRes.text()
  const homeUrl = extractHref(principalXml, "calendar-home-set")
  if (!homeUrl) throw new Error("Could not discover calendar home set")

  // Step 3: list calendars, find one supporting VEVENT
  const homeBase = homeUrl.startsWith("http")
    ? homeUrl
    : `${ICLOUD_BASE}${homeUrl}`

  const homeRes = await fetch(homeBase, {
    method: "PROPFIND",
    headers: { ...headers, Depth: "1" },
    body: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:c="urn:ietf:params:xml:ns:caldav" xmlns:cs="http://calendarserver.org/ns/">
  <d:prop>
    <d:displayname/>
    <c:supported-calendar-component-set/>
    <d:resourcetype/>
  </d:prop>
</d:propfind>`,
  })
  const homeXml = await homeRes.text()

  // Split into response blocks
  const responseBlocks = homeXml.split(/<(?:\w+:)?response[^>]*>/i).slice(1)

  let bestUrl: string | null = null
  let bestName = "Home"

  for (const block of responseBlocks) {
    if (!hasVEVENT(block)) continue

    const hrefs = extractAllHrefs(block)
    const href = hrefs[0]
    if (!href) continue

    const name = extractDisplayName(block)

    // Prefer "Home" calendar
    if (name === "Home" || !bestUrl) {
      bestUrl = href.startsWith("http") ? href : `${ICLOUD_BASE}${href}`
      bestName = name || "Home"
      if (name === "Home") break
    }
  }

  if (!bestUrl) throw new Error("No VEVENT calendar found on iCloud account")

  return { calendarUrl: bestUrl, calendarName: bestName }
}

/** PUT a VEVENT to iCloud (create or update — CalDAV PUT is idempotent) */
export async function putCalendarEvent(
  calendarUrl: string,
  email: string,
  password: string,
  uid: string,
  icsData: string
): Promise<void> {
  const url = `${calendarUrl.replace(/\/$/, "")}/${uid}.ics`
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: basicAuth(email, password),
      "Content-Type": "text/calendar; charset=utf-8",
      "If-None-Match": "*",
    },
    body: icsData,
  })
  // 201 Created or 204 No Content are both success
  if (!res.ok && res.status !== 201 && res.status !== 204) {
    const text = await res.text()
    throw new Error(`CalDAV PUT failed (${res.status}): ${text.slice(0, 200)}`)
  }
}

/** DELETE a VEVENT from iCloud */
export async function deleteCalendarEvent(
  calendarUrl: string,
  email: string,
  password: string,
  uid: string
): Promise<void> {
  const url = `${calendarUrl.replace(/\/$/, "")}/${uid}.ics`
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Authorization: basicAuth(email, password),
    },
  })
  if (!res.ok && res.status !== 204 && res.status !== 404) {
    const text = await res.text()
    throw new Error(`CalDAV DELETE failed (${res.status}): ${text.slice(0, 200)}`)
  }
}

/** Test connection: run discovery and return calendar name */
export async function testConnection(
  email: string,
  password: string
): Promise<{ connected: boolean; calendarName?: string; calendarUrl?: string; error?: string }> {
  try {
    const { calendarUrl, calendarName } = await discoverCalendarUrl(email, password)
    return { connected: true, calendarName, calendarUrl }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Unknown error"
    return { connected: false, error: msg }
  }
}
