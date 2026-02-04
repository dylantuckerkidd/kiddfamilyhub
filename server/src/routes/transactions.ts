import { Router } from 'express'
import { getDb, saveDb } from '../db.js'

const router = Router()

router.get('/', (_, res) => {
  const db = getDb()
  const stmt = db.prepare(`
    SELECT id, amount, description, category, date, type
    FROM transactions
    ORDER BY date DESC
  `)

  const transactions = []
  while (stmt.step()) {
    const row = stmt.getAsObject()
    transactions.push(row)
  }
  stmt.free()

  res.json(transactions)
})

router.post('/', (req, res) => {
  const { amount, description, category, date, type } = req.body

  if (!amount || !description || !category || !date || !type) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const db = getDb()
  db.run(`
    INSERT INTO transactions (amount, description, category, date, type)
    VALUES (?, ?, ?, ?, ?)
  `, [amount, description, category, date, type])

  const id = db.exec('SELECT last_insert_rowid()')[0].values[0][0]
  saveDb()

  res.status(201).json({
    id,
    amount,
    description,
    category,
    date,
    type
  })
})

router.delete('/:id', (req, res) => {
  const { id } = req.params
  const db = getDb()
  db.run('DELETE FROM transactions WHERE id = ?', [id])
  saveDb()
  res.status(204).send()
})

export default router
