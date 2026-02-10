import { Router } from 'express'
import crypto from 'crypto'
import { getDb, saveDb } from '../db.js'
import { syncCreateEvent, syncUpdateEvent, syncDeleteEvent, testICloudConnection, getICloudStatus } from '../services/icloud-sync.js'

const router = Router()

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
    // Include events that:
    // 1. Start in this month, OR
    // 2. End in this month, OR
    // 3. Span across this month (start before, end after)
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

  const events = []
  while (stmt.step()) {
    events.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(events)
})

// iCloud sync status (before /events/:id to avoid param capture)
router.get('/icloud-status', async (_, res) => {
  const status = await getICloudStatus()
  res.json(status)
})

// Test iCloud connection (before /events/:id to avoid param capture)
router.post('/icloud-test', async (_, res) => {
  const result = await testICloudConnection()
  res.json(result)
})

// Create recurring events
router.post('/events/recurring', (req, res) => {
  const { title, description, time, end_time, all_day, person_id, sync_to_icloud, days, start_date, months } = req.body

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
        `INSERT INTO calendar_events (title, description, date, time, end_time, all_day, person_id, sync_to_icloud, recurring_group_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [title, description || null, dateStr, time || null, end_time || null, all_day ? 1 : 0, person_id || null, sync_to_icloud ? 1 : 0, recurringGroupId]
      )
      const result = db.exec('SELECT last_insert_rowid() as id')
      createdIds.push(result[0].values[0][0] as number)
    }
    current.setDate(current.getDate() + 1)
  }

  saveDb()

  // Fetch all created events with person info
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

  res.status(201).json(events)

  // Fire-and-forget iCloud sync for each event
  if (sync_to_icloud) {
    for (const event of events) {
      syncCreateEvent({ title, description, date: event.date as string, time, end_time, all_day: all_day ? 1 : 0, color: event.person_color as string || null }).then(icalUid => {
        if (icalUid) {
          db.run('UPDATE calendar_events SET ical_uid = ? WHERE id = ?', [icalUid, event.id])
          saveDb()
        }
      })
    }
  }
})

// Delete all events in a recurring series
router.delete('/events/series/:groupId', (req, res) => {
  const { groupId } = req.params
  const db = getDb()

  // Fetch ical_uids before deleting
  const stmt = db.prepare('SELECT id, ical_uid FROM calendar_events WHERE recurring_group_id = ?')
  stmt.bind([groupId])
  const rows: any[] = []
  while (stmt.step()) {
    rows.push(stmt.getAsObject())
  }
  stmt.free()

  db.run('DELETE FROM calendar_events WHERE recurring_group_id = ?', [groupId])
  saveDb()

  res.status(204).send()

  // Fire-and-forget iCloud sync deletions
  for (const row of rows) {
    if (row.ical_uid) {
      syncDeleteEvent(row.ical_uid as string)
    }
  }
})

// Update all events in a recurring series
router.patch('/events/series/:groupId', (req, res) => {
  const { groupId } = req.params
  const { title, description, time, end_time, all_day, person_id, sync_to_icloud } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (time !== undefined) { updates.push('time = ?'); params.push(time) }
  if (end_time !== undefined) { updates.push('end_time = ?'); params.push(end_time) }
  if (all_day !== undefined) { updates.push('all_day = ?'); params.push(all_day ? 1 : 0) }
  if (person_id !== undefined) { updates.push('person_id = ?'); params.push(person_id) }
  if (sync_to_icloud !== undefined) { updates.push('sync_to_icloud = ?'); params.push(sync_to_icloud ? 1 : 0) }

  if (updates.length > 0) {
    params.push(groupId)
    db.run(`UPDATE calendar_events SET ${updates.join(', ')} WHERE recurring_group_id = ?`, params)
    saveDb()
  }

  // Fetch updated events
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

  res.json(events)

  // Fire-and-forget iCloud sync for each event
  for (const event of events) {
    const shouldSync = !!event.sync_to_icloud
    const eventData = { title: event.title as string, description: event.description as string, date: event.date as string, time: event.time as string, end_time: event.end_time as string, end_date: null as string | null, all_day: event.all_day as number, color: event.person_color as string || null }
    if (shouldSync && event.ical_uid) {
      syncUpdateEvent(event.ical_uid as string, eventData)
    } else if (shouldSync && !event.ical_uid) {
      syncCreateEvent(eventData).then(icalUid => {
        if (icalUid) {
          db.run('UPDATE calendar_events SET ical_uid = ? WHERE id = ?', [icalUid, event.id])
          saveDb()
        }
      })
    } else if (!shouldSync && event.ical_uid) {
      syncDeleteEvent(event.ical_uid as string)
      db.run('UPDATE calendar_events SET ical_uid = NULL WHERE id = ?', [event.id])
      saveDb()
    }
  }
})

// Add a calendar event
router.post('/events', (req, res) => {
  const { title, description, date, time, end_date, end_time, all_day, person_id, sync_to_icloud } = req.body

  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' })
  }

  const db = getDb()
  db.run(
    `INSERT INTO calendar_events (title, description, date, time, end_date, end_time, all_day, person_id, sync_to_icloud)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, date, time || null, end_date || null, end_time || null, all_day ? 1 : 0, person_id || null, sync_to_icloud ? 1 : 0]
  )

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]
  saveDb()

  // Fetch the created event with person info
  const stmt = db.prepare(`
    SELECT e.*, m.name as person_name, m.color as person_color
    FROM calendar_events e
    LEFT JOIN family_members m ON e.person_id = m.id
    WHERE e.id = ?
  `)
  stmt.bind([id])
  const event = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(event)

  // Sync to iCloud (fire-and-forget, after response sent)
  if (sync_to_icloud) {
    syncCreateEvent({ title, description, date, time, end_date, end_time, all_day: all_day ? 1 : 0, color: event?.person_color as string || null }).then(icalUid => {
      if (icalUid) {
        db.run('UPDATE calendar_events SET ical_uid = ? WHERE id = ?', [icalUid, id])
        saveDb()
      }
    })
  }
})

// Update a calendar event
router.patch('/events/:id', (req, res) => {
  const { id } = req.params
  const { title, description, date, time, end_date, end_time, all_day, person_id, sync_to_icloud } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    params.push(title)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    params.push(description)
  }
  if (date !== undefined) {
    updates.push('date = ?')
    params.push(date)
  }
  if (time !== undefined) {
    updates.push('time = ?')
    params.push(time)
  }
  if (end_date !== undefined) {
    updates.push('end_date = ?')
    params.push(end_date)
  }
  if (end_time !== undefined) {
    updates.push('end_time = ?')
    params.push(end_time)
  }
  if (all_day !== undefined) {
    updates.push('all_day = ?')
    params.push(all_day ? 1 : 0)
  }
  if (person_id !== undefined) {
    updates.push('person_id = ?')
    params.push(person_id)
  }
  if (sync_to_icloud !== undefined) {
    updates.push('sync_to_icloud = ?')
    params.push(sync_to_icloud ? 1 : 0)
  }

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
  const event = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!event) {
    return res.status(404).json({ error: 'Event not found' })
  }

  res.json(event)

  // Sync to iCloud (fire-and-forget, after response sent)
  const shouldSync = !!event.sync_to_icloud
  const eventData = { title: event.title as string, description: event.description as string, date: event.date as string, time: event.time as string, end_date: event.end_date as string, end_time: event.end_time as string, all_day: event.all_day as number, color: event.person_color as string || null }

  if (!shouldSync && event.ical_uid) {
    // Sync toggled off — remove from iCloud
    syncDeleteEvent(event.ical_uid as string)
    db.run('UPDATE calendar_events SET ical_uid = NULL WHERE id = ?', [id])
    saveDb()
  } else if (shouldSync && event.ical_uid) {
    syncUpdateEvent(event.ical_uid as string, eventData).then(ok => {
      if (!ok) {
        db.run('UPDATE calendar_events SET ical_uid = NULL WHERE id = ?', [id])
        saveDb()
        syncCreateEvent(eventData).then(newUid => {
          if (newUid) {
            db.run('UPDATE calendar_events SET ical_uid = ? WHERE id = ?', [newUid, id])
            saveDb()
          }
        })
      }
    })
  } else if (shouldSync && !event.ical_uid) {
    syncCreateEvent(eventData).then(icalUid => {
      if (icalUid) {
        db.run('UPDATE calendar_events SET ical_uid = ? WHERE id = ?', [icalUid, id])
        saveDb()
      }
    })
  }
})

// Delete a calendar event
router.delete('/events/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()

  // Fetch ical_uid before deleting
  const stmt = db.prepare('SELECT ical_uid FROM calendar_events WHERE id = ?')
  stmt.bind([id])
  const row = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  db.run('DELETE FROM calendar_events WHERE id = ?', [id])
  saveDb()

  res.status(204).send()

  // Sync deletion to iCloud (fire-and-forget, after response sent)
  if (row?.ical_uid) {
    syncDeleteEvent(row.ical_uid as string)
  }
})

export default router
