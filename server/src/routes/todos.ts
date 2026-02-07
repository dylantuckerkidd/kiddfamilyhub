import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

// ==============================
// Static routes (before /:id)
// ==============================

// Get all todos with person and category info + subtask counts
router.get('/', (_, res) => {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT t.*, m.name as person_name, m.color as person_color,
      c.name as category_name, c.color as category_color,
      (SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id AND s.completed = 1) as subtask_completed_count
    FROM todo_items t
    LEFT JOIN family_members m ON t.person_id = m.id
    LEFT JOIN todo_categories c ON t.category_id = c.id
    ORDER BY t.completed, t.sort_order, t.due_date IS NULL, t.due_date, t.created_at DESC
  `)

  const todos = []
  while (stmt.step()) {
    todos.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(todos)
})

// Create a todo
router.post('/', (req, res) => {
  const { title, description, person_id, due_date, category_id } = req.body

  if (!title) {
    return res.status(400).json({ error: 'Title is required' })
  }

  const db = getDb()

  // Auto-assign sort_order (max + 1)
  const maxResult = db.exec('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM todo_items')
  const nextOrder = (maxResult[0].values[0][0] as number) + 1

  db.run(
    `INSERT INTO todo_items (title, description, person_id, due_date, category_id, sort_order) VALUES (?, ?, ?, ?, ?, ?)`,
    [title, description || null, person_id || null, due_date || null, category_id || null, nextOrder]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  const stmt = db.prepare(`
    SELECT t.*, m.name as person_name, m.color as person_color,
      c.name as category_name, c.color as category_color,
      0 as subtask_count, 0 as subtask_completed_count
    FROM todo_items t
    LEFT JOIN family_members m ON t.person_id = m.id
    LEFT JOIN todo_categories c ON t.category_id = c.id
    WHERE t.id = ?
  `)
  stmt.bind([id])
  const todo = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(todo)
})

// Reorder todos
router.put('/reorder', (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array is required' })
  }

  const db = getDb()
  for (let i = 0; i < ids.length; i++) {
    db.run('UPDATE todo_items SET sort_order = ? WHERE id = ?', [i, ids[i]])
  }
  saveDb()

  res.json({ success: true })
})

// Bulk update todos
router.patch('/bulk', (req, res) => {
  const { ids, updates } = req.body
  if (!Array.isArray(ids) || !updates) {
    return res.status(400).json({ error: 'ids array and updates object are required' })
  }

  const db = getDb()
  const setClauses: string[] = []
  const setParams: any[] = []

  if (updates.person_id !== undefined) {
    setClauses.push('person_id = ?')
    setParams.push(updates.person_id)
  }
  if (updates.due_date !== undefined) {
    setClauses.push('due_date = ?')
    setParams.push(updates.due_date)
  }
  if (updates.category_id !== undefined) {
    setClauses.push('category_id = ?')
    setParams.push(updates.category_id)
  }
  if (updates.completed !== undefined) {
    setClauses.push('completed = ?')
    setParams.push(updates.completed ? 1 : 0)
  }

  if (setClauses.length > 0) {
    const placeholders = ids.map(() => '?').join(',')
    db.run(
      `UPDATE todo_items SET ${setClauses.join(', ')} WHERE id IN (${placeholders})`,
      [...setParams, ...ids]
    )
    saveDb()
  }

  res.json({ success: true })
})

// Bulk delete todos
router.delete('/bulk', (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array is required' })
  }

  const db = getDb()
  const placeholders = ids.map(() => '?').join(',')
  db.run(`DELETE FROM todo_items WHERE id IN (${placeholders})`, ids)
  saveDb()

  res.status(204).send()
})

// Clear completed todos
router.delete('/clear-completed', (_, res) => {
  const db = getDb()
  db.run('DELETE FROM todo_items WHERE completed = 1')
  saveDb()
  res.status(204).send()
})

// === Categories (all static paths) ===

// List all categories
router.get('/categories', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM todo_categories ORDER BY sort_order, id')
  const categories = []
  while (stmt.step()) {
    categories.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(categories)
})

// Create category
router.post('/categories', (req, res) => {
  const { name, color } = req.body
  if (!name) {
    return res.status(400).json({ error: 'Name is required' })
  }

  const db = getDb()
  const maxResult = db.exec('SELECT COALESCE(MAX(sort_order), -1) as max_order FROM todo_categories')
  const nextOrder = (maxResult[0].values[0][0] as number) + 1

  db.run(
    'INSERT INTO todo_categories (name, color, sort_order) VALUES (?, ?, ?)',
    [name, color || null, nextOrder]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const id = result[0].values[0][0]

  const stmt = db.prepare('SELECT * FROM todo_categories WHERE id = ?')
  stmt.bind([id])
  const category = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(category)
})

// Update category
router.patch('/categories/:id', (req, res) => {
  const { id } = req.params
  const { name, color } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    params.push(name)
  }
  if (color !== undefined) {
    updates.push('color = ?')
    params.push(color)
  }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE todo_categories SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare('SELECT * FROM todo_categories WHERE id = ?')
  stmt.bind([id])
  const category = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!category) {
    return res.status(404).json({ error: 'Category not found' })
  }
  res.json(category)
})

// Delete category
router.delete('/categories/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('UPDATE todo_items SET category_id = NULL WHERE category_id = ?', [id])
  db.run('DELETE FROM todo_categories WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

// Update subtask (static path /subtasks/:id before dynamic /:id)
router.patch('/subtasks/:id', (req, res) => {
  const { id } = req.params
  const { title, completed } = req.body

  const db = getDb()
  const updates: string[] = []
  const params: any[] = []

  if (title !== undefined) {
    updates.push('title = ?')
    params.push(title)
  }
  if (completed !== undefined) {
    updates.push('completed = ?')
    params.push(completed ? 1 : 0)
  }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE todo_subtasks SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare('SELECT * FROM todo_subtasks WHERE id = ?')
  stmt.bind([id])
  const subtask = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!subtask) {
    return res.status(404).json({ error: 'Subtask not found' })
  }
  res.json(subtask)
})

// Delete subtask (static path /subtasks/:id before dynamic /:id)
router.delete('/subtasks/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM todo_subtasks WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

// ==============================
// Dynamic routes (/:id and below)
// ==============================

// Update a todo
router.patch('/:id', (req, res) => {
  const { id } = req.params
  const { title, description, completed, person_id, due_date, category_id, sort_order } = req.body

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
  if (completed !== undefined) {
    updates.push('completed = ?')
    params.push(completed ? 1 : 0)
  }
  if (person_id !== undefined) {
    updates.push('person_id = ?')
    params.push(person_id)
  }
  if (due_date !== undefined) {
    updates.push('due_date = ?')
    params.push(due_date)
  }
  if (category_id !== undefined) {
    updates.push('category_id = ?')
    params.push(category_id)
  }
  if (sort_order !== undefined) {
    updates.push('sort_order = ?')
    params.push(sort_order)
  }

  if (updates.length > 0) {
    params.push(id)
    db.run(`UPDATE todo_items SET ${updates.join(', ')} WHERE id = ?`, params)
    saveDb()
  }

  const stmt = db.prepare(`
    SELECT t.*, m.name as person_name, m.color as person_color,
      c.name as category_name, c.color as category_color,
      (SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id) as subtask_count,
      (SELECT COUNT(*) FROM todo_subtasks s WHERE s.todo_id = t.id AND s.completed = 1) as subtask_completed_count
    FROM todo_items t
    LEFT JOIN family_members m ON t.person_id = m.id
    LEFT JOIN todo_categories c ON t.category_id = c.id
    WHERE t.id = ?
  `)
  stmt.bind([id])
  const todo = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  if (!todo) {
    return res.status(404).json({ error: 'Todo not found' })
  }

  res.json(todo)
})

// List subtasks for a todo
router.get('/:id/subtasks', (req, res) => {
  const { id } = req.params
  const db = getDb()
  const stmt = db.prepare('SELECT * FROM todo_subtasks WHERE todo_id = ? ORDER BY sort_order, id')
  stmt.bind([id])
  const subtasks = []
  while (stmt.step()) {
    subtasks.push(stmt.getAsObject())
  }
  stmt.free()
  res.json(subtasks)
})

// Create subtask
router.post('/:id/subtasks', (req, res) => {
  const { id } = req.params
  const { title } = req.body

  if (!title) {
    return res.status(400).json({ error: 'Title is required' })
  }

  const db = getDb()
  const maxResult = db.exec(`SELECT COALESCE(MAX(sort_order), -1) as max_order FROM todo_subtasks WHERE todo_id = ${Number(id)}`)
  const nextOrder = (maxResult[0].values[0][0] as number) + 1

  db.run(
    'INSERT INTO todo_subtasks (todo_id, title, sort_order) VALUES (?, ?, ?)',
    [id, title, nextOrder]
  )
  saveDb()

  const result = db.exec('SELECT last_insert_rowid() as id')
  const subtaskId = result[0].values[0][0]

  const stmt = db.prepare('SELECT * FROM todo_subtasks WHERE id = ?')
  stmt.bind([subtaskId])
  const subtask = stmt.step() ? stmt.getAsObject() : null
  stmt.free()

  res.status(201).json(subtask)
})

// Reorder subtasks
router.put('/:id/subtasks/reorder', (req, res) => {
  const { ids } = req.body
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids array is required' })
  }

  const db = getDb()
  for (let i = 0; i < ids.length; i++) {
    db.run('UPDATE todo_subtasks SET sort_order = ? WHERE id = ?', [i, ids[i]])
  }
  saveDb()

  res.json({ success: true })
})

// Delete a single todo
router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM todo_items WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
