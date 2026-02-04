import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

router.get('/', (_, res) => {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT b.id, b.category, b.amount_limit,
      COALESCE(SUM(CASE WHEN t.type = 'expense' THEN t.amount ELSE 0 END), 0) as spent
    FROM budgets b
    LEFT JOIN transactions t ON t.category = b.category
      AND strftime('%Y-%m', t.date) = strftime('%Y-%m', 'now')
    GROUP BY b.id
  `)

  const budgets = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    budgets.push({
      id: row.id,
      category: row.category,
      limit: row.amount_limit,
      spent: row.spent
    })
  }
  stmt.free()

  res.json(budgets)
})

router.post('/', (req, res) => {
  const { category, limit } = req.body

  if (!category || limit === undefined) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = getDb()
  db.run(`
    INSERT INTO budgets (category, amount_limit)
    VALUES (?, ?)
    ON CONFLICT(category) DO UPDATE SET amount_limit = excluded.amount_limit
  `, [category, limit])

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  saveDb()

  res.status(201).json({
    id,
    category,
    limit,
    spent: 0
  })
})

router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM budgets WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
