import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

// Get all category mappings
router.get('/mappings', (_, res) => {
  const db = getDb()
  const stmt = db.prepare('SELECT id, plaid_category, budget_category FROM category_mappings')

  const mappings = []
  while (stmt.step()) {
    mappings.push(stmt.getAsObject())
  }
  stmt.free()

  res.json(mappings)
})

// Create or update a category mapping
router.post('/mappings', (req, res) => {
  const { plaid_category, budget_category } = req.body

  if (!plaid_category || !budget_category) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = getDb()
  db.run(`
    INSERT INTO category_mappings (plaid_category, budget_category)
    VALUES (?, ?)
    ON CONFLICT(plaid_category) DO UPDATE SET budget_category = ?
  `, [plaid_category, budget_category, budget_category])

  const result = db.exec('SELECT last_insert_rowid()')
  const id = result[0]?.values[0]?.[0]
  saveDb()

  res.status(201).json({ id, plaid_category, budget_category })
})

// Delete a category mapping
router.delete('/mappings/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM category_mappings WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

// Get unique Plaid categories from transactions (for mapping UI)
router.get('/plaid-categories', (_, res) => {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT DISTINCT category FROM transactions
    WHERE plaid_transaction_id IS NOT NULL
    ORDER BY category
  `)

  const categories: string[] = []
  while (stmt.step()) {
    const row = stmt.getAsObject() as { category: string }
    categories.push(row.category)
  }
  stmt.free()

  res.json(categories)
})

export default router
