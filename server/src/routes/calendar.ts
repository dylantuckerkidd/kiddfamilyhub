import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

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

// Add a calendar event
router.post('/events', (req, res) => {
  const { title, description, date, time, end_date, end_time, all_day, person_id } = req.body

  if (!title || !date) {
    return res.status(400).json({ error: 'Title and date are required' })
  }

  const db = getDb()
  db.run(
    `INSERT INTO calendar_events (title, description, date, time, end_date, end_time, all_day, person_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [title, description || null, date, time || null, end_date || null, end_time || null, all_day ? 1 : 0, person_id || null]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

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
})

// Update a calendar event
router.patch('/events/:id', (req, res) => {
  const { id } = req.params
  const { title, description, date, time, end_date, end_time, all_day, person_id } = req.body

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
})

// Delete a calendar event
router.delete('/events/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM calendar_events WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
