import { serve } from "https://deno.land/std@0.177.0/http/server.ts"
import { adminClient, getAuthUserId } from "../_shared/supabase.ts"
import { buildICS, type CalendarEventData } from "../_shared/ics.ts"
import {
  testConnection,
  putCalendarEvent,
  deleteCalendarEvent,
  discoverCalendarUrl,
} from "../_shared/caldav.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  })
}

/** Fetch account credentials (including app_password) via admin client */
async function getAccountCreds(accountId: number, userId: string) {
  const { data, error } = await adminClient
    .from("icloud_sync_accounts")
    .select("id, email, app_password, calendar_url")
    .eq("id", accountId)
    .eq("user_id", userId)
    .single()
  if (error || !data) throw new Error("Account not found")
  return data
}

/** Ensure we have a cached calendar_url, running discovery if needed */
async function ensureCalendarUrl(
  account: { id: number; email: string; app_password: string; calendar_url: string | null }
): Promise<string> {
  if (account.calendar_url) return account.calendar_url

  const { calendarUrl } = await discoverCalendarUrl(account.email, account.app_password)

  // Cache it in DB
  await adminClient
    .from("icloud_sync_accounts")
    .update({ calendar_url: calendarUrl })
    .eq("id", account.id)

  return calendarUrl
}

/** Fetch a calendar event by ID via admin client */
async function getEvent(eventId: number, userId: string): Promise<CalendarEventData & { id: number }> {
  const { data, error } = await adminClient
    .from("calendar_events")
    .select("id, title, description, date, time, end_date, end_time, all_day")
    .eq("id", eventId)
    .eq("user_id", userId)
    .single()
  if (error || !data) throw new Error("Event not found")
  return data
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  try {
    const userId = await getAuthUserId(req)
    const body = await req.json()
    const { action } = body

    // ---- TEST CONNECTION ----
    if (action === "test") {
      const { account_id } = body
      const account = await getAccountCreds(account_id, userId)
      const result = await testConnection(account.email, account.app_password)

      // Cache calendar URL on successful test
      if (result.connected && result.calendarUrl) {
        await adminClient
          .from("icloud_sync_accounts")
          .update({ calendar_url: result.calendarUrl })
          .eq("id", account_id)
      }

      return json(result)
    }

    // ---- SYNC CREATE ----
    if (action === "sync-create") {
      const { event_id, account_ids } = body as { event_id: number; account_ids: number[] }
      const event = await getEvent(event_id, userId)
      const results: { account_id: number; success: boolean }[] = []

      for (const accountId of account_ids) {
        try {
          const account = await getAccountCreds(accountId, userId)
          const calendarUrl = await ensureCalendarUrl(account)
          const uid = crypto.randomUUID()
          const icsData = buildICS(uid, event)

          await putCalendarEvent(calendarUrl, account.email, account.app_password, uid, icsData)

          // Save junction row
          await adminClient
            .from("event_icloud_sync")
            .insert({ event_id, account_id: accountId, ical_uid: uid })

          results.push({ account_id: accountId, success: true })
        } catch (err) {
          console.error(`sync-create failed for account ${accountId}:`, err)
          results.push({ account_id: accountId, success: false })
        }
      }

      return json({ results })
    }

    // ---- SYNC UPDATE ----
    if (action === "sync-update") {
      const { event_id } = body as { event_id: number }
      const event = await getEvent(event_id, userId)

      // Find all synced accounts for this event
      const { data: syncRows } = await adminClient
        .from("event_icloud_sync")
        .select("account_id, ical_uid")
        .eq("event_id", event_id)

      if (!syncRows || syncRows.length === 0) return json({ results: [] })

      const results: { account_id: number; success: boolean }[] = []

      for (const row of syncRows) {
        try {
          const account = await getAccountCreds(row.account_id, userId)
          const calendarUrl = await ensureCalendarUrl(account)
          const icsData = buildICS(row.ical_uid, event)

          await putCalendarEvent(calendarUrl, account.email, account.app_password, row.ical_uid, icsData)
          results.push({ account_id: row.account_id, success: true })
        } catch (err) {
          console.error(`sync-update failed for account ${row.account_id}:`, err)
          results.push({ account_id: row.account_id, success: false })
        }
      }

      return json({ results })
    }

    // ---- SYNC DELETE ----
    if (action === "sync-delete") {
      const { sync_rows } = body as {
        sync_rows: { account_id: number; ical_uid: string }[]
      }

      const results: { account_id: number; success: boolean }[] = []

      for (const row of sync_rows) {
        try {
          const account = await getAccountCreds(row.account_id, userId)
          const calendarUrl = await ensureCalendarUrl(account)

          await deleteCalendarEvent(calendarUrl, account.email, account.app_password, row.ical_uid)
          results.push({ account_id: row.account_id, success: true })
        } catch (err) {
          console.error(`sync-delete failed for account ${row.account_id}:`, err)
          results.push({ account_id: row.account_id, success: false })
        }
      }

      return json({ results })
    }

    // ---- SYNC DIFF ----
    // Handle changes when sync_account_ids changes on an event
    if (action === "sync-diff") {
      const { event_id, new_account_ids } = body as {
        event_id: number
        new_account_ids: number[]
      }

      const event = await getEvent(event_id, userId)

      // Get current sync state
      const { data: currentRows } = await adminClient
        .from("event_icloud_sync")
        .select("account_id, ical_uid")
        .eq("event_id", event_id)

      const currentIds = new Set((currentRows || []).map((r) => r.account_id))
      const newIds = new Set(new_account_ids)

      // Accounts to add
      const toAdd = new_account_ids.filter((id) => !currentIds.has(id))
      // Accounts to remove
      const toRemove = (currentRows || []).filter((r) => !newIds.has(r.account_id))
      // Accounts to update (already synced, just update the event data)
      const toUpdate = (currentRows || []).filter((r) => newIds.has(r.account_id))

      // Add new syncs
      for (const accountId of toAdd) {
        try {
          const account = await getAccountCreds(accountId, userId)
          const calendarUrl = await ensureCalendarUrl(account)
          const uid = crypto.randomUUID()
          const icsData = buildICS(uid, event)

          await putCalendarEvent(calendarUrl, account.email, account.app_password, uid, icsData)

          await adminClient
            .from("event_icloud_sync")
            .insert({ event_id, account_id: accountId, ical_uid: uid })
        } catch (err) {
          console.error(`sync-diff add failed for account ${accountId}:`, err)
        }
      }

      // Remove old syncs
      for (const row of toRemove) {
        try {
          const account = await getAccountCreds(row.account_id, userId)
          const calendarUrl = await ensureCalendarUrl(account)

          await deleteCalendarEvent(calendarUrl, account.email, account.app_password, row.ical_uid)

          await adminClient
            .from("event_icloud_sync")
            .delete()
            .eq("event_id", event_id)
            .eq("account_id", row.account_id)
        } catch (err) {
          console.error(`sync-diff remove failed for account ${row.account_id}:`, err)
        }
      }

      // Update existing syncs
      for (const row of toUpdate) {
        try {
          const account = await getAccountCreds(row.account_id, userId)
          const calendarUrl = await ensureCalendarUrl(account)
          const icsData = buildICS(row.ical_uid, event)

          await putCalendarEvent(calendarUrl, account.email, account.app_password, row.ical_uid, icsData)
        } catch (err) {
          console.error(`sync-diff update failed for account ${row.account_id}:`, err)
        }
      }

      return json({ ok: true })
    }

    return json({ error: `Unknown action: ${action}` }, 400)
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Internal error"
    console.error("icloud-sync error:", err)
    return json({ error: msg }, msg === "Unauthorized" ? 401 : 500)
  }
})
