import express from 'express'
import cors from 'cors'
import { initDb } from './db.js'
import transactionsRouter from './routes/transactions.js'
import budgetsRouter from './routes/budgets.js'

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

app.use('/api/transactions', transactionsRouter)
app.use('/api/budgets', budgetsRouter)

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

async function start() {
  await initDb()
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

start()
