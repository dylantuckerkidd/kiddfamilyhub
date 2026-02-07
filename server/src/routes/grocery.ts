import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

// Get autocomplete suggestions
router.get('/suggestions', (req, res) => {
  const q = (req.query.q as string || '').trim()
  if (!q) return res.json([])

  const db = getDb()
  const stmt = db.prepare(
    'SELECT name, category FROM grocery_item_history WHERE name LIKE ? ORDER BY use_count DESC, last_used DESC LIMIT 10'
  )
  stmt.bind([`${q}%`])

  const suggestions: { name: string; category: string | null }[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    suggestions.push({ name: row.name as string, category: (row.category as string) || null })
  }
  stmt.free()

  res.json(suggestions)
})

// Get all grocery items
router.get('/', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM grocery_items ORDER BY checked, category, name')

  const items = []
  while (stmt.step()) {
    items.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(items)
})

// Add a grocery item
router.post('/', (req, res) => {
  const { name, quantity, unit } = req.body
  let { category } = req.body

  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const db = getDb()

  // Auto-assign category from history if not provided
  if (!category) {
    const histStmt = db.prepare('SELECT category FROM grocery_item_history WHERE name = ? COLLATE NOCASE')
    histStmt.bind([name])
    if (histStmt.step()) {
      const row = histStmt.getAsObject()
      category = row.category || null
    }
    histStmt.free()
  }

  db.run(
    'INSERT INTO grocery_items (name, quantity, unit, category) VALUES (?, ?, ?, ?)',
    [name, quantity || null, unit || null, category || null]
  )

  // Record name and category in history for autocomplete
  db.run(
    `INSERT INTO grocery_item_history (name, category) VALUES (?, ?)
     ON CONFLICT(name) DO UPDATE SET use_count = use_count + 1, last_used = CURRENT_TIMESTAMP, category = COALESCE(?, category)`,
    [name, category || null, category || null]
  )

  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  const stmt = db.prepare('SELECT * FROM grocery_items WHERE id = ?')
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(item)
})

// Update a grocery item
router.patch('/:id', (req, res) => {
  const { id } = req.params
  const { name, quantity, unit, category, checked } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }
  if (quantity !== undefined) {
    updates.push('quantity = ?')
    params.push(quantity)
  }
  if (unit !== undefined) {
    updates.push('unit = ?')
    params.push(unit)
  }
  if (category !== undefined) {
    updates.push('category = ?')
    params.push(category)
  }
  if (checked !== undefined) {
    updates.push('checked = ?')
    params.push(checked ? 1 : 0)
  }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE grocery_items SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare('SELECT * FROM grocery_items WHERE id = ?')
  stmt.bind([id])
  const item = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!item) {
    return res.status(404).json({ error: 'Item not found' })
  }

  // Update history when category is changed so the system learns corrections
  if (category !== undefined && item.name) {
    db.run(
      `UPDATE grocery_item_history SET category = ? WHERE name = ? COLLATE NOCASE`,
      [category || null, item.name]
    )
    saveDb()
  }

  res.json(item)
})

// Clear all checked items (must be before /:id route)
router.delete('/clear-checked', (_, res) => {
  const db = getDb()
  db.run('DELETE FROM grocery_items WHERE checked = 1')
  saveDb()
  res.status(204).send()
})

// Delete a grocery item
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM grocery_items WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
