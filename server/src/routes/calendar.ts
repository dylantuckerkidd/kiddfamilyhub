import { Router } from 'express'
import crypto from 'crypto'
import { getDb, saveDb } from '../db.js'
import { syncCreateEvent, syncUpdateEvent, syncDeleteEvent, testICloudConnection, invalidateAccountCache, type AccountCredentials } from '../services/icloud-sync.js'

const router = Router()

// Helper: load account credentials from DB
function getAccountCredentials(accountId: number): AccountCredentials | null {
  const db = getDb()
  const stmt = db.prepare('SELECT id, email, app_password FROM icloud_accounts WHERE id = ?')
  stmt.bind([accountId])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()
  if (!row) return null
  return { id: row.id as number, email: row.email as string, app_password: row.app_password as string }
}

// Get all family members
router.get('/people', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM family_members ORDER BY name')

  const people = []
  while (stmt.step()) {
    people.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(people)
})

// Add a family member
router.post('/people', (req, res) => {
  const { name, color } = req.body

  if (!name || !color) {
    return res.status(400).json({ error: 'Name and color are required' })
  }

  const db = getDb()
  db.run('INSERT INTO family_members (name, color) VALUES (?, ?)', [name, color])
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  res.status(201).json({ id, name, color })
})

// Update a family member
router.patch('/people/:id', (req, res) => {
  const { id } = req.params
  const { name, color } = req.body

  const db = getDb()

  if (name) {
    db.run('UPDATE family_members SET name = ? WHERE id = ?', [name, id])
  }
  if (color) {
    db.run('UPDATE family_members SET color = ? WHERE id = ?', [color, id])
  }

  saveDb()

  const stmt = db.prepare('SELECT * FROM family_members WHERE id = ?')
  stmt.bind([id])
  const person = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!person) {
    return res.status(404).json({ error: 'Person not found' })
  }

  res.json(person)
})

// Delete a family member
router.delete('/people/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM family_members WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

// ==========================================
// iCloud Accounts CRUD (before /:id params)
// ==========================================

router.get('/icloud-accounts', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT id, label, email, created_at FROM icloud_accounts ORDER BY id')
  const accounts = []
  while (stmt.step()) {
    accounts.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(accounts)
})

router.post('/icloud-accounts', (req, res) => {
  const { label, email, app_password } = req.body
  if (!label || !email || !app_password) {
    return res.status(400).json({ error: 'Label, email, and app_password are required' })
  }

  const db = getDb()
  db.run('INSERT INTO icloud_accounts (label, email, app_password) VALUES (?, ?, ?)', [label, email, app_password])
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  res.status(201).json({ id, label, email })
})

router.patch('/icloud-accounts/:id', (req, res) => {
  const { id } = req.params
  const { label, email, app_password } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (label !== undefined) { updates.push('label = ?'); params.push(label) }
  if (email !== undefined) { updates.push('email = ?'); params.push(email) }
  if (app_password !== undefined) { updates.push('app_password = ?'); params.push(app_password) }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE icloud_accounts SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
    invalidateAccountCache(Number(id))
  }

  const stmt = db.prepare('SELECT id, label, email, created_at FROM icloud_accounts WHERE id = ?')
  stmt.bind([id])
  const account = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!account) {
    return res.status(404).json({ error: 'Account not found' })
  }

  res.json(account)
})

router.delete('/icloud-accounts/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const accountId = Number(id)

  // Get creds + all synced UIDs before deleting
  const creds = getAccountCredentials(accountId)
  const syncStmt = db.prepare('SELECT ical_uid FROM event_icloud_sync WHERE account_id = ? AND ical_uid IS NOT NULL')
  syncStmt.bind([accountId])
  const uids: string[] = []
  while (syncStmt.step()) {
    const row = syncStmt.getAsObject()
    uids.push(row.ical_uid as string)
  }
  syncStmt.free()

  // Delete account (CASCADE will remove junction rows)
  db.run('DELETE FROM icloud_accounts WHERE id = ?', [accountId])
  saveDb()
  invalidateAccountCache(accountId)

  res.status(204).send()

  // Fire-and-forget: delete synced events from iCloud
  if (creds) {
    for (const uid of uids) {
      syncDeleteEvent(creds, uid)
    }
  }
})

router.post('/icloud-accounts/:id/test', async (req, res) => {
  const accountId = Number(req.params.id)
  const creds = getAccountCredentials(accountId)
  if (!creds) {
    return res.status(404).json({ connected: false, error: 'Account not found' })
  }
  const result = await testICloudConnection(creds)
  res.json(result)
})

// ==========================================
// Calendar events
// ==========================================

// Get calendar events (optionally filter by month)
router.get('/events', (req, res) => {
  const { month, year } = req.query
  const db = getDb()

  let query = `
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
  `

  const params: any[] = []

  if (month && year) {
    const monthStr = String(month).padStart(2, '0')
    const monthStart = `${year}-${monthStr}-01`
    const monthEnd = `${year}-${monthStr}-31`
    query += ` WHERE (e.date BETWEEN ? AND ?)
               OR (e.end_date BETWEEN ? AND ?)
               OR (e.date < ? AND e.end_date > ?)`
    params.push(monthStart, monthEnd, monthStart, monthEnd, monthStart, monthEnd)
  }

  query += ' ORDER BY e.date, e.time'

  const stmt = db.prepare(query)
  if (params.length > 0) {
    stmt.bind(params)
  }

  const events: any[] = []
  while (stmt.step()) {
    events.push(stmt.getAsObject())
  }
  stmt.free()

  // Batch-query junction table to attach sync_account_ids to each event
  if (events.length > 0) {
    const eventIds = events.map(e => e.id)
    const placeholders = eventIds.map(() => '?').join(',')
    const syncStmt = db.prepare(`SELECT event_id, account_id FROM event_icloud_sync WHERE event_id IN (${placeholders})`)
    syncStmt.bind(eventIds)
    const syncMap = new Map<number, number[]>()
    while (syncStmt.step()) {
      const row = syncStmt.getAsObject()
      const eventId = row.event_id as number
      const accountId = row.account_id as number
      if (!syncMap.has(eventId)) syncMap.set(eventId, [])
      syncMap.get(eventId)!.push(accountId)
    }
    syncStmt.free()

    for (const event of events) {
      event.sync_account_ids = syncMap.get(event.id as number) || []
    }
  }

  res.json(events)
})

// Create recurring events
router.post('/events/recurring', (req, res) => {
  const { title, description, time, end_time, all_day, person_id, sync_account_ids, days, start_date, months } = req.body

  if (!title || !start_date || !days || !Array.isArray(days) || days.length === 0 || !months) {
    return res.status(400).json({ error: 'Title, start_date, days array, and months are required' })
  }

  const db = getDb()
  const recurringGroupId = crypto.randomUUID()

  const start = new Date(start_date + 'T00:00:00')
  const end = new Date(start)
  end.setMonth(end.getMonth() + months)

  const createdIds: number[] = []
  const current = new Date(start)

  while (current < end) {
    if (days.includes(current.getDay())) {
      const dateStr = current.toISOString().split('T')[0]
      db.run(
        `INSERT INTO calendar_events (title, description, date, time, end_time, all_day, person_id, recurring_group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || null, dateStr, time || null, end_time || null, all_day ? 1 : 0, person_id || null, recurringGroupId]
      )
      const result = db.exec('SELECT last_insert_rowid() as id')
      createdIds.push(result[0].values[0][0] as number)
    }
    current.setDate(current.getDate() + 1)
  }

  saveDb()

  if (createdIds.length === 0) {
    return res.status(201).json([])
  }

  const placeholders = createdIds.map(() => '?').join(',')
  const stmt = db.prepare(`
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
    WHERE e.id IN (${placeholders})
    ORDER BY e.date
  `)
  stmt.bind(createdIds)
  const events: any[] = []
  while (stmt.step()) {
    events.push(stmt.getAsObject())
  }
  stmt.free()

  // Insert junction rows immediately to persist sync choice
  const accountIds: number[] = Array.isArray(sync_account_ids) ? sync_account_ids : []
  if (accountIds.length > 0) {
    for (const event of events) {
      for (const accountId of accountIds) {
        db.run('INSERT OR IGNORE INTO event_icloud_sync (event_id, account_id) VALUES (?, ?)', [event.id, accountId])
      }
    }
    saveDb()
  }

  // Attach sync_account_ids to response
  for (const event of events) {
    event.sync_account_ids = accountIds
  }

  res.status(201).json(events)

  // Fire-and-forget iCloud sync for each event to each account
  if (accountIds.length > 0) {
    for (const event of events) {
      for (const accountId of accountIds) {
        const creds = getAccountCredentials(accountId)
        if (!creds) continue
        syncCreateEvent(creds, { title, description, date: event.date as string, time, end_time, all_day: all_day ? 1 : 0, color: event.person_color as string || null }).then(icalUid => {
          if (icalUid) {
            db.run('UPDATE event_icloud_sync SET ical_uid = ? WHERE event_id = ? AND account_id = ?', [icalUid, event.id, accountId])
            saveDb()
          }
        })
      }
    }
  }
})

// Delete all events in a recurring series
router.delete('/events/series/:groupId', (req, res) => {
  const { groupId } = req.params
  const db = getDb()

  // Get all event IDs in the series
  const stmt = db.prepare('SELECT id FROM calendar_events WHERE recurring_group_id = ?')
  stmt.bind([groupId])
  const eventIds: number[] = []
  while (stmt.step()) {
    eventIds.push(stmt.getAsObject().id as number)
  }
  stmt.free()

  // Get all junction rows for these events
  const syncRows: { account_id: number; ical_uid: string }[] = []
  if (eventIds.length > 0) {
    const placeholders = eventIds.map(() => '?').join(',')
    const syncStmt = db.prepare(`SELECT account_id, ical_uid FROM event_icloud_sync WHERE event_id IN (${placeholders}) AND ical_uid IS NOT NULL`)
    syncStmt.bind(eventIds)
    while (syncStmt.step()) {
      syncRows.push(syncStmt.getAsObject() as any)
    }
    syncStmt.free()
  }

  db.run('DELETE FROM calendar_events WHERE recurring_group_id = ?', [groupId])
  saveDb()

  res.status(204).send()

  // Fire-and-forget: delete from iCloud
  for (const row of syncRows) {
    const creds = getAccountCredentials(row.account_id)
    if (creds) {
      syncDeleteEvent(creds, row.ical_uid)
    }
  }
})

// Update all events in a recurring series
router.patch('/events/series/:groupId', (req, res) => {
  const { groupId } = req.params
  const { title, description, time, end_time, all_day, person_id, sync_account_ids } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (time !== undefined) { updates.push('time = ?'); params.push(time) }
  if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time) }
  if (all_day !== undefined) { updates.push('all_day = ?'); params.push(all_day ? 1 : 0) }
  if (person_id !== undefined) { updates.push('person_id = ?'); params.push(person_id) }

  if (updates.length > 0) {
    params.push(groupId)
    db.run(`UPDATE calendar_events SET ${updates.join(', ')} WHERE recurring_group_id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare(`
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
    WHERE e.recurring_group_id = ?
    ORDER BY e.date
  `)
  stmt.bind([groupId])
  const events: any[] = []
  while (stmt.step()) {
    events.push(stmt.getAsObject())
  }
  stmt.free()

  // If sync_account_ids provided, diff junction for each event
  const newAccountIds: number[] | undefined = Array.isArray(sync_account_ids) ? sync_account_ids : undefined

  if (newAccountIds !== undefined) {
    for (const event of events) {
      diffSyncAccounts(db, event.id as number, newAccountIds, {
        title: event.title as string,
        description: event.description as string,
        date: event.date as string,
        time: event.time as string,
        end_time: event.end_time as string,
        end_date: null,
        all_day: event.all_day as number,
        color: event.person_color as string || null,
      })
    }
  }

  // Attach sync_account_ids to response
  for (const event of events) {
    const syncStmt = db.prepare('SELECT account_id FROM event_icloud_sync WHERE event_id = ?')
    syncStmt.bind([event.id])
    const ids: number[] = []
    while (syncStmt.step()) {
      ids.push(syncStmt.getAsObject().account_id as number)
    }
    syncStmt.free()
    event.sync_account_ids = newAccountIds !== undefined ? newAccountIds : ids
  }

  res.json(events)
})

// Add a calendar event
router.post('/events', (req, res) => {
  const { title, description, date, time, end_date, end_time, all_day, person_id, sync_account_ids } = req.body

  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' })
  }

  const db = getDb()
  db.run(
    `INSERT INTO calendar_events (title, description, date, time, end_date, end_time, all_day, person_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, date, time || null, end_date || null, end_time || null, all_day ? 1 : 0, person_id || null]
  )

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0] as number
  saveDb()

  // Fetch the created event with person info
  const stmt = db.prepare(`
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
    WHERE e.id = ?
  `)
  stmt.bind([id])
  const event: any = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  const accountIds: number[] = Array.isArray(sync_account_ids) ? sync_account_ids : []

  // Insert junction rows immediately to persist the user's sync choice
  for (const accountId of accountIds) {
    db.run('INSERT OR IGNORE INTO event_icloud_sync (event_id, account_id) VALUES (?, ?)', [id, accountId])
  }
  if (accountIds.length > 0) saveDb()

  if (event) {
    event.sync_account_ids = accountIds
  }

  res.status(201).json(event)

  // Fire-and-forget: sync to each iCloud account, then update junction with ical_uid
  for (const accountId of accountIds) {
    const creds = getAccountCredentials(accountId)
    if (!creds) continue
    syncCreateEvent(creds, { title, description, date, time, end_date, end_time, all_day: all_day ? 1 : 0, color: event?.person_color as string || null }).then(icalUid => {
      if (icalUid) {
        db.run('UPDATE event_icloud_sync SET ical_uid = ? WHERE event_id = ? AND account_id = ?', [icalUid, id, accountId])
        saveDb()
      }
    })
  }
})

// Update a calendar event
router.patch('/events/:id', (req, res) => {
  const { id } = req.params
  const { title, description, date, time, end_date, end_time, all_day, person_id, sync_account_ids } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (date !== undefined) { updates.push('date = ?'); params.push(date) }
  if (time !== undefined) { updates.push('time = ?'); params.push(time) }
  if (end_date !== undefined) { updates.push('end_date = ?'); params.push(end_date) }
  if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time) }
  if (all_day !== undefined) { updates.push('all_day = ?'); params.push(all_day ? 1 : 0) }
  if (person_id !== undefined) { updates.push('person_id = ?'); params.push(person_id) }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE calendar_events SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare(`
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
    WHERE e.id = ?
  `)
  stmt.bind([id])
  const event: any = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!event) {
    return res.status(404).json({ error: 'Event not found' })
  }

  const eventData = {
    title: event.title as string,
    description: event.description as string,
    date: event.date as string,
    time: event.time as string,
    end_date: event.end_date as string,
    end_time: event.end_time as string,
    all_day: event.all_day as number,
    color: event.person_color as string || null,
  }

  // Diff sync accounts if provided
  const newAccountIds: number[] | undefined = Array.isArray(sync_account_ids) ? sync_account_ids : undefined
  if (newAccountIds !== undefined) {
    diffSyncAccounts(db, Number(id), newAccountIds, eventData)
  }

  // Attach current sync_account_ids
  const syncStmt = db.prepare('SELECT account_id FROM event_icloud_sync WHERE event_id = ?')
  syncStmt.bind([id])
  const currentIds: number[] = []
  while (syncStmt.step()) {
    currentIds.push(syncStmt.getAsObject().account_id as number)
  }
  syncStmt.free()
  event.sync_account_ids = newAccountIds !== undefined ? newAccountIds : currentIds

  res.json(event)
})

// Delete a calendar event
router.delete('/events/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()

  // Get all junction rows before deleting
  const syncStmt = db.prepare('SELECT account_id, ical_uid FROM event_icloud_sync WHERE event_id = ? AND ical_uid IS NOT NULL')
  syncStmt.bind([id])
  const syncRows: { account_id: number; ical_uid: string }[] = []
  while (syncStmt.step()) {
    syncRows.push(syncStmt.getAsObject() as any)
  }
  syncStmt.free()

  db.run('DELETE FROM calendar_events WHERE id = ?', [id])
  saveDb()

  res.status(204).send()

  // Fire-and-forget: delete from each iCloud account
  for (const row of syncRows) {
    const creds = getAccountCredentials(row.account_id)
    if (creds) {
      syncDeleteEvent(creds, row.ical_uid)
    }
  }
})

// ==========================================
// Helper: diff sync accounts for an event
// ==========================================
function diffSyncAccounts(db: any, eventId: number, newAccountIds: number[], eventData: any) {
  // Get current junction rows
  const syncStmt = db.prepare('SELECT account_id, ical_uid FROM event_icloud_sync WHERE event_id = ?')
  syncStmt.bind([eventId])
  const currentRows = new Map<number, string | null>()
  while (syncStmt.step()) {
    const row = syncStmt.getAsObject()
    currentRows.set(row.account_id as number, (row.ical_uid as string) || null)
  }
  syncStmt.free()

  const currentAccountIds = new Set(currentRows.keys())
  const newAccountIdSet = new Set(newAccountIds)

  // Accounts to add (in new but not current)
  for (const accountId of newAccountIds) {
    if (!currentAccountIds.has(accountId)) {
      // Insert junction row immediately to persist intent
      db.run('INSERT OR IGNORE INTO event_icloud_sync (event_id, account_id) VALUES (?, ?)', [eventId, accountId])
      saveDb()
      const creds = getAccountCredentials(accountId)
      if (!creds) continue
      syncCreateEvent(creds, eventData).then(icalUid => {
        if (icalUid) {
          db.run('UPDATE event_icloud_sync SET ical_uid = ? WHERE event_id = ? AND account_id = ?', [icalUid, eventId, accountId])
          saveDb()
        }
      })
    }
  }

  // Accounts to remove (in current but not new)
  for (const [accountId, icalUid] of currentRows) {
    if (!newAccountIdSet.has(accountId)) {
      if (icalUid) {
        const creds = getAccountCredentials(accountId)
        if (creds) {
          syncDeleteEvent(creds, icalUid)
        }
      }
      db.run('DELETE FROM event_icloud_sync WHERE event_id = ? AND account_id = ?', [eventId, accountId])
      saveDb()
    }
  }

  // Accounts that remain: update iCloud event data
  for (const accountId of newAccountIds) {
    if (currentAccountIds.has(accountId)) {
      const icalUid = currentRows.get(accountId)
      if (icalUid) {
        const creds = getAccountCredentials(accountId)
        if (creds) {
          syncUpdateEvent(creds, icalUid, eventData).then(ok => {
            if (!ok) {
              // Update failed — recreate (junction row already exists, just clear uid and retry)
              db.run('UPDATE event_icloud_sync SET ical_uid = NULL WHERE event_id = ? AND account_id = ?', [eventId, accountId])
              saveDb()
              syncCreateEvent(creds, eventData).then(newUid => {
                if (newUid) {
                  db.run('UPDATE event_icloud_sync SET ical_uid = ? WHERE event_id = ? AND account_id = ?', [newUid, eventId, accountId])
                  saveDb()
                }
              })
            }
          })
        }
      }
    }
  }
}

export default router
