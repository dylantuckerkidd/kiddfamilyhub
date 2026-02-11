import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { existsSync } from 'fs'
import { initDb } from './db.js'
import transactionsRouter from './routes/transactions.js'
import budgetsRouter from './routes/budgets.js'
import plaidRouter from './routes/plaid.js'
import categoriesRouter from './routes/categories.js'
import calendarRouter from './routes/calendar.js'
import groceryRouter from './routes/grocery.js'
import todosRouter from './routes/todos.js'
import maintenanceRouter from './routes/maintenance.js'
import authRouter, { isValidToken } from './routes/auth.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const PORT = process.env.PORT || 4567

app.use(cors())
app.use(express.json())

// Auth routes (public)
app.use('/api/auth', authRouter)

// Auth middleware — skip public routes
app.use('/api', (req, res, next) => {
  if (req.path === '/health' || req.path.startsWith('/auth')) {
    return next()
  }

  // If no AUTH_PIN configured, skip auth (dev mode)
  if (!process.env.AUTH_PIN) {
    return next()
  }

  const authHeader = req.headers.authorization
  const token = authHeader?.replace('Bearer ', '')

  if (!token || !isValidToken(token)) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  next()
})

app.use('/api/transactions', transactionsRouter)
app.use('/api/budgets', budgetsRouter)
app.use('/api/plaid', plaidRouter)
app.use('/api/categories', categoriesRouter)
app.use('/api/calendar', calendarRouter)
app.use('/api/grocery', groceryRouter)
app.use('/api/todos', todosRouter)
app.use('/api/maintenance', maintenanceRouter)

app.get('/api/health', (_, res) => {
  res.json({ status: 'ok' })
})

// Serve client static files in production
const clientDistPath = path.resolve(__dirname, '..', '..', 'client', 'dist')
if (existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath))
  // SPA catch-all: non-API routes return index.html for Vue Router history mode
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api')) {
      res.sendFile(path.join(clientDistPath, 'index.html'))
    }
  })
}

async function start() {
  await initDb()
  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`)
  })
}

start()
