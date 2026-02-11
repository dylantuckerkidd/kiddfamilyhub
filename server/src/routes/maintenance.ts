import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

const FREQUENCY_DAYS: Record<string, number> = {
  weekly: 7,
  monthly: 30,
  quarterly: 90,
  biannual: 182,
  annual: 365,
}

// --- Categories ---

// Get all categories
router.get('/categories', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM maintenance_categories ORDER BY sort_order, name')
  const categories = []
  while (stmt.step()) {
    categories.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(categories)
})

// Create a category
router.post('/categories', (req, res) => {
  const { name, icon } = req.body
  if (!name) return res.status(400).json({ error: 'Name is required' })

  const db = getDb()
  db.run(
    'INSERT INTO maintenance_categories (name, icon) VALUES (?, ?)',
    [name, icon || null]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  const stmt = db.prepare('SELECT * FROM maintenance_categories WHERE id = ?')
  stmt.bind([id])
  const cat = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(cat)
})

// Update a category
router.patch('/categories/:id', (req, res) => {
  const { id } = req.params
  const { name, icon, sort_order } = req.body
  const db = getDb()

  const updates: string[] = []
  const params: any[] = []
  if (name !== undefined) { updates.push('name = ?'); params.push(name) }
  if (icon !== undefined) { updates.push('icon = ?'); params.push(icon) }
  if (sort_order !== undefined) { updates.push('sort_order = ?'); params.push(sort_order) }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE maintenance_categories SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare('SELECT * FROM maintenance_categories WHERE id = ?')
  stmt.bind([id])
  const cat = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!cat) return res.status(404).json({ error: 'Category not found' })
  res.json(cat)
})

// Delete a category
router.delete('/categories/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM maintenance_categories WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

// --- Items ---

// Get all items with joined data
router.get('/', (_, res) => {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT
      mi.*,
      mc.name as category_name,
      mc.icon as category_icon,
      fm.name as person_name,
      fm.color as person_color,
      (SELECT MAX(mh.completed_date) FROM maintenance_history mh WHERE mh.item_id = mi.id) as last_completed
    FROM maintenance_items mi
    LEFT JOIN maintenance_categories mc ON mi.category_id = mc.id
    LEFT JOIN family_members fm ON mi.person_id = fm.id
    ORDER BY
      CASE WHEN mi.next_due_date IS NULL THEN 1 ELSE 0 END,
      mi.next_due_date ASC
  `)

  const items = []
  while (stmt.step()) {
    items.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(items)
})

// Create an item
router.post('/', (req, res) => {
  const { title, description, category_id, person_id, frequency, frequency_days, next_due_date } = req.body
  if (!title) return res.status(400).json({ error: 'Title is required' })

  const db = getDb()
  db.run(
    `INSERT INTO maintenance_items (title, description, category_id, person_id, frequency, frequency_days, next_due_date)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      title,
      description || null,
      category_id || null,
      person_id || null,
      frequency || 'monthly',
      frequency_days || null,
      next_due_date || null,
    ]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  // Return the full joined item
  const stmt = db.prepare(`
    SELECT
      mi.*,
      mc.name as category_name,
      mc.icon as category_icon,
      fm.name as person_name,
      fm.color as person_color,
      NULL as last_completed
    FROM maintenance_items mi
    LEFT JOIN maintenance_categories mc ON mi.category_id = mc.id
    LEFT JOIN family_members fm ON mi.person_id = fm.id
    WHERE mi.id = ?
  `)
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(item)
})

// Get history for an item (static path before /:id)
router.get('/:id/history', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const stmt = db.prepare(`
    SELECT mh.*, fm.name as person_name, fm.color as person_color
    FROM maintenance_history mh
    LEFT JOIN family_members fm ON mh.person_id = fm.id
    WHERE mh.item_id = ?
    ORDER BY mh.completed_date DESC
  `)
  stmt.bind([id])

  const history = []
  while (stmt.step()) {
    history.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(history)
})

// Complete an item (static path before /:id)
router.post('/:id/complete', (req, res) => {
  const { id } = req.params
  const { notes, cost, person_id, completed_date } = req.body

  const db = getDb()

  // Get the item to calculate next due date
  const itemStmt = db.prepare('SELECT * FROM maintenance_items WHERE id = ?')
  itemStmt.bind([id])
  const item = itemStmt.step() ? itemStmt.getAsObject() : null
  itemStmt.free()

  if (!item) return res.status(404).json({ error: 'Item not found' })

  const completedOn = completed_date || new Date().toISOString().split('T')[0]

  // Insert history entry
  db.run(
    'INSERT INTO maintenance_history (item_id, completed_date, notes, cost, person_id) VALUES (?, ?, ?, ?, ?)',
    [id, completedOn, notes || null, cost || null, person_id || item.person_id || null]
  )

  // Calculate next due date
  const freq = item.frequency as string
  const days = freq === 'custom' ? (item.frequency_days as number) : FREQUENCY_DAYS[freq]
  if (days) {
    const d = new Date(completedOn)
    d.setDate(d.getDate() + days)
    const nextDue = d.toISOString().split('T')[0]
    db.run('UPDATE maintenance_items SET next_due_date = ? WHERE id = ?', [nextDue, id])
  }

  saveDb()

  // Return updated item
  const stmt = db.prepare(`
    SELECT
      mi.*,
      mc.name as category_name,
      mc.icon as category_icon,
      fm.name as person_name,
      fm.color as person_color,
      (SELECT MAX(mh.completed_date) FROM maintenance_history mh WHERE mh.item_id = mi.id) as last_completed
    FROM maintenance_items mi
    LEFT JOIN maintenance_categories mc ON mi.category_id = mc.id
    LEFT JOIN family_members fm ON mi.person_id = fm.id
    WHERE mi.id = ?
  `)
  stmt.bind([id])
  const updated = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.json(updated)
})

// Update an item
router.patch('/:id', (req, res) => {
  const { id } = req.params
  const { title, description, category_id, person_id, frequency, frequency_days, next_due_date } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) { updates.push('title = ?'); params.push(title) }
  if (description !== undefined) { updates.push('description = ?'); params.push(description) }
  if (category_id !== undefined) { updates.push('category_id = ?'); params.push(category_id || null) }
  if (person_id !== undefined) { updates.push('person_id = ?'); params.push(person_id || null) }
  if (frequency !== undefined) { updates.push('frequency = ?'); params.push(frequency) }
  if (frequency_days !== undefined) { updates.push('frequency_days = ?'); params.push(frequency_days) }
  if (next_due_date !== undefined) { updates.push('next_due_date = ?'); params.push(next_due_date || null) }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE maintenance_items SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare(`
    SELECT
      mi.*,
      mc.name as category_name,
      mc.icon as category_icon,
      fm.name as person_name,
      fm.color as person_color,
      (SELECT MAX(mh.completed_date) FROM maintenance_history mh WHERE mh.item_id = mi.id) as last_completed
    FROM maintenance_items mi
    LEFT JOIN maintenance_categories mc ON mi.category_id = mc.id
    LEFT JOIN family_members fm ON mi.person_id = fm.id
    WHERE mi.id = ?
  `)
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!item) return res.status(404).json({ error: 'Item not found' })
  res.json(item)
})

// Delete an item
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM maintenance_items WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
